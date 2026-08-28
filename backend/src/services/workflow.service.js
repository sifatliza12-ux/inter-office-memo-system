const Memo = require('../models/Memo');
const WorkflowStep = require('../models/WorkflowStep');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const memoService = require('./memo.service');
const {
  notifyAwaitingApproval,
  notifyFinalApproval,
  notifyRejected,
  notifyChangesRequested,
  notifyParticipantAdded,
} = require('./notification.service');
const { logAuditEvent } = require('./audit.service');
const { snapshotMemoVersion } = require('./memoVersion.service');
const { recordWorkflowAction, listActions } = require('./workflowAction.service');

const STEP_ORDER_INCREMENT = 10;

// "The current step" is always computed fresh from the WorkflowStep
// documents (lowest stepOrder still 'pending') — never read from the
// memo.currentApproverId/currentStepOrder cache. Those fields exist only for
// Stage 6's inbox queries; trusting them here would let a stale or tampered
// cache stand in for the real authorization decision.
const getCurrentStep = (memoId) => WorkflowStep.findOne({ memoId, status: 'pending' }).sort({ stepOrder: 1 });

const findMemoInOrg = async (organizationId, id) => {
  const memo = await Memo.findOne({ _id: id, organizationId });
  if (!memo) {
    throw new ApiError(404, 'Memo not found');
  }
  return memo;
};

const assertNonEmptyComment = (comment, actionLabel) => {
  if (!comment || !String(comment).trim()) {
    throw new ApiError(400, `A comment is required to ${actionLabel}`);
  }
};

// Shared by approve/reject/request-changes: independently re-verifies the
// caller is the current step's userId — never trusts a client claim that
// "it's my turn."
const assertIsCurrentApprover = async (memo, requestingUserId) => {
  if (memo.status !== 'submitted') {
    throw new ApiError(400, 'Memo is not awaiting approval');
  }

  const currentStep = await getCurrentStep(memo._id);
  if (!currentStep || currentStep.userId.toString() !== String(requestingUserId)) {
    throw new ApiError(403, 'It is not your turn to act on this memo');
  }

  return currentStep;
};

// Recomputes and caches the current step after an action changes which step
// is pending — or clears the cache entirely when there is none (workflow
// finished, terminated, or paused).
const syncCurrentApproverCache = async (memo) => {
  const nextStep = await getCurrentStep(memo._id);
  if (nextStep) {
    memo.currentApproverId = nextStep.userId;
    memo.currentStepOrder = nextStep.stepOrder;
    memo.currentStepSince = new Date();
  } else {
    memo.currentApproverId = undefined;
    memo.currentStepOrder = undefined;
    memo.currentStepSince = undefined;
  }
  return nextStep;
};

const approveMemo = async (organizationId, id, requestingUserId, comment) => {
  const memo = await findMemoInOrg(organizationId, id);
  const currentStep = await assertIsCurrentApprover(memo, requestingUserId);

  currentStep.status = 'approved';
  currentStep.actionDate = new Date();
  if (comment !== undefined) {
    currentStep.comment = comment;
  }
  await currentStep.save();

  const nextStep = await syncCurrentApproverCache(memo);

  if (!nextStep) {
    memo.status = 'approved';
    memo.finalApproverId = requestingUserId;
    memo.finalApprovedAt = new Date();
  }

  await memo.save();

  // Stage 13b: alongside the currentStep write above, not instead of it.
  await recordWorkflowAction({
    memoId: memo._id,
    organizationId,
    versionNumber: memo.currentVersionNumber,
    actor: requestingUserId,
    action: 'APPROVED',
    comment,
    recipient: nextStep ? nextStep.userId : null,
  });

  if (nextStep) {
    await notifyAwaitingApproval(memo, nextStep.userId);
  } else {
    await notifyFinalApproval(memo);
  }

  await logAuditEvent({
    organizationId,
    userId: requestingUserId,
    eventType: 'WORKFLOW_APPROVED',
    description: `Memo ${memo.referenceNumber} ("${memo.subject}") was approved at this step.`,
  });

  if (!nextStep) {
    await logAuditEvent({
      organizationId,
      userId: requestingUserId,
      eventType: 'WORKFLOW_COMPLETED',
      description: `Memo ${memo.referenceNumber} ("${memo.subject}") completed its approval workflow.`,
    });
  }

  return memo;
};

const rejectMemo = async (organizationId, id, requestingUserId, comment) => {
  assertNonEmptyComment(comment, 'reject a memo');

  const memo = await findMemoInOrg(organizationId, id);
  const currentStep = await assertIsCurrentApprover(memo, requestingUserId);

  currentStep.status = 'rejected';
  currentStep.actionDate = new Date();
  currentStep.comment = comment;
  await currentStep.save();

  memo.status = 'rejected';
  memo.currentApproverId = undefined;
  memo.currentStepOrder = undefined;
  memo.currentStepSince = undefined;
  await memo.save();

  // Stage 13b: alongside the currentStep write above, not instead of it.
  await recordWorkflowAction({
    memoId: memo._id,
    organizationId,
    versionNumber: memo.currentVersionNumber,
    actor: requestingUserId,
    action: 'DECLINED',
    comment,
    recipient: null,
  });

  await notifyRejected(memo);

  await logAuditEvent({
    organizationId,
    userId: requestingUserId,
    eventType: 'WORKFLOW_REJECTED',
    description: `Memo ${memo.referenceNumber} ("${memo.subject}") was rejected: ${comment}`,
  });

  return memo;
};

const requestChanges = async (organizationId, id, requestingUserId, comment) => {
  assertNonEmptyComment(comment, 'request changes on a memo');

  const memo = await findMemoInOrg(organizationId, id);
  const currentStep = await assertIsCurrentApprover(memo, requestingUserId);

  // Permanent historical record — never deleted or reused, even after a
  // resubmission appends a fresh step for the same participant.
  currentStep.status = 'changes_requested';
  currentStep.actionDate = new Date();
  currentStep.comment = comment;
  await currentStep.save();

  memo.status = 'changes_requested';
  memo.currentApproverId = undefined;
  memo.currentStepOrder = undefined;
  memo.currentStepSince = undefined;
  await memo.save();

  // Stage 13b: alongside the currentStep write above, not instead of it.
  await recordWorkflowAction({
    memoId: memo._id,
    organizationId,
    versionNumber: memo.currentVersionNumber,
    actor: requestingUserId,
    action: 'CHANGES_REQUESTED',
    comment,
    recipient: null,
  });

  await notifyChangesRequested(memo);

  await logAuditEvent({
    organizationId,
    userId: requestingUserId,
    eventType: 'CHANGE_REQUESTED',
    description: `Changes were requested on memo ${memo.referenceNumber} ("${memo.subject}"): ${comment}`,
  });

  return memo;
};

// Shared insertion primitive for resubmit and add-participant: creates a new
// 'pending' WorkflowStep positioned strictly after `referenceStepOrder`,
// using a midpoint between it and whatever step (if any) currently follows.
// Falls back to renumbering the remaining pending/future steps (fresh gaps
// of 10, relative order preserved) when no integer gap is left, then retries
// once — renumbering always creates room, so a second attempt always fits.
const insertStepAfter = async (memoId, referenceStepOrder, userId) => {
  const nextStep = await WorkflowStep.findOne({
    memoId,
    stepOrder: { $gt: referenceStepOrder },
  }).sort({ stepOrder: 1 });

  if (!nextStep) {
    return WorkflowStep.create({
      memoId,
      userId,
      stepOrder: referenceStepOrder + STEP_ORDER_INCREMENT,
      status: 'pending',
    });
  }

  const gap = nextStep.stepOrder - referenceStepOrder;

  if (gap > 1) {
    const midpoint = Math.floor((referenceStepOrder + nextStep.stepOrder) / 2);
    return WorkflowStep.create({ memoId, userId, stepOrder: midpoint, status: 'pending' });
  }

  // No integer room left. Only pending/future steps are ever renumbered —
  // approved/rejected/changes_requested steps are permanent history, and by
  // construction nothing already finalized can have a stepOrder above the
  // reference point (steps are only ever acted on in ascending order), so
  // this is guaranteed to capture every step that needs to move.
  const stepsToRenumber = await WorkflowStep.find({
    memoId,
    stepOrder: { $gt: referenceStepOrder },
    status: 'pending',
  }).sort({ stepOrder: 1 });

  let nextOrder = referenceStepOrder + STEP_ORDER_INCREMENT;
  // eslint-disable-next-line no-restricted-syntax
  for (const step of stepsToRenumber) {
    step.stepOrder = nextOrder;
    // eslint-disable-next-line no-await-in-loop
    await step.save();
    nextOrder += STEP_ORDER_INCREMENT;
  }

  return insertStepAfter(memoId, referenceStepOrder, userId);
};

const resubmitMemo = async (organizationId, id, requestingUserId) => {
  const memo = await findMemoInOrg(organizationId, id);

  if (memo.authorId.toString() !== String(requestingUserId)) {
    throw new ApiError(403, 'Only the author may resubmit this memo');
  }

  if (memo.status !== 'changes_requested') {
    throw new ApiError(400, 'Only a memo with changes requested can be resubmitted');
  }

  // The most recent changes-requested record — highest stepOrder among them,
  // since a memo could in principle have been sent back more than once.
  const changesRequestedStep = await WorkflowStep.findOne({
    memoId: memo._id,
    status: 'changes_requested',
  }).sort({ stepOrder: -1 });

  if (!changesRequestedStep) {
    throw new ApiError(400, 'No changes-requested step was found for this memo');
  }

  const newStep = await insertStepAfter(memo._id, changesRequestedStep.stepOrder, changesRequestedStep.userId);

  memo.status = 'submitted';
  memo.currentApproverId = newStep.userId;
  memo.currentStepOrder = newStep.stepOrder;
  memo.currentStepSince = new Date();
  // Stage 13a: a new content snapshot per resubmit. originalWorkflowParticipants
  // is deliberately NOT touched here — it was set once at first submission
  // and stays the historical record forever, regardless of how many times
  // the memo is resubmitted or how workflowParticipants (live) has changed.
  memo.currentVersionNumber += 1;
  await memo.save();

  // Snapshots whatever content is on the memo right now — i.e. whatever the
  // author edited via PATCH before calling resubmit.
  await snapshotMemoVersion(memo, requestingUserId);

  // Stage 13b: alongside the new WorkflowStep created above, not instead of
  // it. versionNumber is read AFTER the increment above, so this correctly
  // reflects the NEW version this resubmission just produced.
  await recordWorkflowAction({
    memoId: memo._id,
    organizationId,
    versionNumber: memo.currentVersionNumber,
    actor: requestingUserId,
    action: 'RESUBMITTED',
    recipient: newStep.userId,
  });

  await notifyAwaitingApproval(memo, newStep.userId);

  await logAuditEvent({
    organizationId,
    userId: requestingUserId,
    eventType: 'MEMO_RESUBMITTED',
    description: `Memo ${memo.referenceNumber} ("${memo.subject}") was resubmitted for approval.`,
  });

  return memo;
};

const addParticipant = async (organizationId, id, requestingUserId, { userId, reason }) => {
  if (!userId) {
    throw new ApiError(400, 'userId is required');
  }
  assertNonEmptyComment(reason, 'add a workflow participant');

  const memo = await findMemoInOrg(organizationId, id);

  if (memo.status !== 'submitted') {
    throw new ApiError(400, 'Participants can only be added while a memo is awaiting approval');
  }

  // Never trust a client claim of participation: independently confirm the
  // requester holds SOME WorkflowStep (any status) on this memo. An author
  // who is not separately a participant has no step here either, so this
  // also naturally covers "author gets 403 on this specific action."
  const requesterStep = await WorkflowStep.findOne({ memoId: memo._id, userId: requestingUserId });
  if (!requesterStep) {
    throw new ApiError(403, 'Only a workflow participant may add another participant');
  }

  const newParticipant = await User.findOne({ _id: userId, organizationId });
  if (!newParticipant) {
    throw new ApiError(400, 'userId does not belong to your organization');
  }

  const alreadyParticipant = await WorkflowStep.findOne({ memoId: memo._id, userId });
  if (alreadyParticipant) {
    throw new ApiError(400, 'This user is already a participant in this memo\'s workflow');
  }

  // Always inserted immediately after whoever CURRENTLY holds the memo,
  // regardless of whether the requester is that same current approver, a
  // past approver, or a not-yet-reached future participant.
  const currentStep = await getCurrentStep(memo._id);
  if (!currentStep) {
    throw new ApiError(400, 'No active step was found for this memo');
  }

  const newStep = await insertStepAfter(memo._id, currentStep.stepOrder, userId);

  memo.workflowParticipants.push(userId);
  await memo.save();

  // Stage 13b: alongside the new WorkflowStep created above, not instead of
  // it.
  await recordWorkflowAction({
    memoId: memo._id,
    organizationId,
    versionNumber: memo.currentVersionNumber,
    actor: requestingUserId,
    action: 'PARTICIPANT_ADDED',
    comment: reason,
    recipient: userId,
  });

  await logAuditEvent({
    organizationId,
    userId: requestingUserId,
    eventType: 'WORKFLOW_PARTICIPANT_ADDED',
    description: `${newParticipant.name} was added to the workflow for memo "${memo.subject}" (reason: ${reason})`,
  });
  await notifyParticipantAdded(memo, userId);

  return { memo, workflowStep: newStep };
};

// Shared by redirect/decline-redirect: the target must exist in this org
// and must not already be reachable through the LIVE route. Deliberately
// checks workflowParticipants (live), never originalWorkflowParticipants —
// the original route (Stage 13a) is historical and immutable, and has no
// bearing on who is currently a valid redirect target.
const assertValidRedirectTarget = async (memo, organizationId, userId) => {
  const target = await User.findOne({ _id: userId, organizationId });
  if (!target) {
    throw new ApiError(400, 'userId does not belong to your organization');
  }

  const alreadyLiveParticipant = memo.workflowParticipants.some(
    (participantId) => participantId.toString() === String(userId)
  );
  if (alreadyLiveParticipant) {
    throw new ApiError(400, "This user is already a participant in this memo's current workflow");
  }

  return target;
};

// Stage 13c. Deliberately NOT built on approveMemo() — see the module-level
// note in the Stage 13c spec: approveMemo() would itself call
// recordWorkflowAction('APPROVED'), producing the exact duplicate-action
// problem this function exists to avoid. A redirect is ONE decision
// ("I approve my step, and I'm routing it to someone specific instead of
// the normal next person"), recorded as exactly one REDIRECTED action.
const redirectMemo = async (organizationId, id, requestingUserId, { userId, comment }) => {
  if (!userId) {
    throw new ApiError(400, 'userId is required');
  }
  assertNonEmptyComment(comment, 'redirect a memo');

  const memo = await findMemoInOrg(organizationId, id);
  const currentStep = await assertIsCurrentApprover(memo, requestingUserId);
  await assertValidRedirectTarget(memo, organizationId, userId);

  // The current handler's own step transitions exactly like a normal
  // approval (same status/actionDate/comment semantics) — this is
  // WorkflowStep historical compatibility only. It is NOT accompanied by an
  // APPROVED WorkflowAction; see recordWorkflowAction below.
  currentStep.status = 'approved';
  currentStep.actionDate = new Date();
  currentStep.comment = comment;
  await currentStep.save();

  // Inserted immediately after the current (now-approved) step, using the
  // same midpoint-stepOrder primitive Stage 5's add-participant/resubmit
  // already use. The normal next participant's own step is untouched and
  // stays in the sequence at its original position — merely no longer the
  // lowest pending stepOrder, so no longer reachable as "current" unless a
  // later action routes back to them.
  const newStep = await insertStepAfter(memo._id, currentStep.stepOrder, userId);

  // Live route only (never originalWorkflowParticipants) — the target is
  // now genuinely part of the current/remaining route, exactly like
  // add-participant's existing push. Required for the target to pass
  // getMemoById's view-authorization check at all (author or a listed
  // workflowParticipants entry) — without this, the redirect target could
  // approve/reject via a raw request (that check doesn't consult this
  // array) but couldn't view the memo through any normal read endpoint.
  memo.workflowParticipants.push(userId);

  // Recomputes currentApproverId/currentStepOrder/currentStepSince from the
  // real WorkflowStep data (lowest pending stepOrder), which by
  // construction is now newStep — the same shared cache-sync primitive
  // approve/reject/request-changes already use, not duplicated logic.
  await syncCurrentApproverCache(memo);
  await memo.save();

  await recordWorkflowAction({
    memoId: memo._id,
    organizationId,
    versionNumber: memo.currentVersionNumber,
    actor: requestingUserId,
    action: 'REDIRECTED',
    comment,
    recipient: userId,
  });

  await notifyAwaitingApproval(memo, userId);

  return { memo, workflowStep: newStep };
};

// Stage 13c. Deliberately NOT built on rejectMemo() — it would terminate
// the memo (status: 'rejected') and notify the author, neither of which
// matches decline-and-redirect's semantics (memo stays 'submitted', the
// new target is notified, not the author). Also, like approveMemo() above,
// it would independently record a DECLINED WorkflowAction, duplicating the
// one combined DECLINED_REDIRECTED action this function must produce.
const declineRedirectMemo = async (organizationId, id, requestingUserId, { userId, comment }) => {
  if (!userId) {
    throw new ApiError(400, 'userId is required');
  }
  assertNonEmptyComment(comment, 'decline and redirect a memo');

  const memo = await findMemoInOrg(organizationId, id);
  const currentStep = await assertIsCurrentApprover(memo, requestingUserId);
  await assertValidRedirectTarget(memo, organizationId, userId);

  // WorkflowStep historical compatibility only — marked exactly like a
  // plain rejection, but the memo itself is NOT terminated below (unlike
  // rejectMemo()).
  currentStep.status = 'rejected';
  currentStep.actionDate = new Date();
  currentStep.comment = comment;
  await currentStep.save();

  // Fixed current-stepOrder + 10, per spec — not the general midpoint
  // insertion primitive used by redirect/resubmit/add-participant.
  const newStep = await WorkflowStep.create({
    memoId: memo._id,
    userId,
    stepOrder: currentStep.stepOrder + STEP_ORDER_INCREMENT,
    status: 'pending',
  });

  // Live route only — see the identical comment in redirectMemo above.
  memo.workflowParticipants.push(userId);
  memo.currentApproverId = newStep.userId;
  memo.currentStepOrder = newStep.stepOrder;
  memo.currentStepSince = new Date();
  await memo.save();

  await recordWorkflowAction({
    memoId: memo._id,
    organizationId,
    versionNumber: memo.currentVersionNumber,
    actor: requestingUserId,
    action: 'DECLINED_REDIRECTED',
    comment,
    recipient: userId,
  });

  await notifyAwaitingApproval(memo, userId);

  return { memo, workflowStep: newStep };
};

// Stage 13c. Removes a not-yet-reached participant from the LIVE route
// only — originalWorkflowParticipants (Stage 13a) is never touched here or
// anywhere else outside first submission.
const removeParticipant = async (organizationId, id, requestingUserId, { userId, reason }) => {
  if (!userId) {
    throw new ApiError(400, 'userId is required');
  }
  assertNonEmptyComment(reason, 'remove a workflow participant');

  const memo = await findMemoInOrg(organizationId, id);

  if (memo.status !== 'submitted') {
    throw new ApiError(400, 'Participants can only be removed while a memo is awaiting approval');
  }

  // Same broadened authorization as add-participant: any user holding SOME
  // WorkflowStep (any status) on this memo — past, current, or future.
  const requesterStep = await WorkflowStep.findOne({ memoId: memo._id, userId: requestingUserId });
  if (!requesterStep) {
    throw new ApiError(403, 'Only a workflow participant may remove another participant');
  }

  const targetStep = await WorkflowStep.findOne({ memoId: memo._id, userId });
  if (!targetStep) {
    throw new ApiError(400, "userId is not a participant in this memo's workflow");
  }

  // Independently recomputed, not read from the memo.currentApproverId
  // cache — same reasoning as assertIsCurrentApprover above.
  const currentStep = await getCurrentStep(memo._id);
  if (currentStep && currentStep.userId.toString() === String(userId)) {
    throw new ApiError(400, 'The current holder cannot be removed — use redirect instead');
  }

  if (targetStep.status !== 'pending') {
    throw new ApiError(400, 'Only a participant whose step is still pending can be removed');
  }

  // Distinct from 'rejected': this participant never acted, the step was
  // simply cancelled before they were reached.
  targetStep.status = 'removed';
  await targetStep.save();

  memo.workflowParticipants = memo.workflowParticipants.filter(
    (participantId) => participantId.toString() !== String(userId)
  );
  await memo.save();

  await recordWorkflowAction({
    memoId: memo._id,
    organizationId,
    versionNumber: memo.currentVersionNumber,
    actor: requestingUserId,
    action: 'PARTICIPANT_REMOVED',
    comment: reason,
    recipient: null,
  });

  return { memo, workflowStep: targetStep };
};

const getWorkflowHistory = async (organizationId, id, requestingUserId) => {
  // Reuses Stage 4's view-authorization exactly (author or any participant,
  // past/present) rather than a separate rule for this endpoint. Unchanged
  // by Stage 13b — still returns WorkflowStep data exactly as before.
  const memo = await memoService.getMemoById(organizationId, id, requestingUserId);

  return WorkflowStep.find({ memoId: memo._id }).sort({ stepOrder: 1 }).populate('userId', 'name');
};

// Stage 13b: same view-authorization as GET /api/memos/:id (author, or any
// user with a WorkflowStep on the memo, any status) — a NEW, separate
// endpoint from getWorkflowHistory above, not a replacement for it.
const getMemoActions = async (organizationId, id, requestingUserId) => {
  const memo = await memoService.getMemoById(organizationId, id, requestingUserId);
  return listActions(memo._id);
};

module.exports = {
  approveMemo,
  rejectMemo,
  requestChanges,
  resubmitMemo,
  addParticipant,
  redirectMemo,
  declineRedirectMemo,
  removeParticipant,
  getWorkflowHistory,
  getMemoActions,
};
