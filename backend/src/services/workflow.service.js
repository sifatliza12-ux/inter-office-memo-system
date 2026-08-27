const Memo = require('../models/Memo');
const WorkflowStep = require('../models/WorkflowStep');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const ApiError = require('../utils/ApiError');
const memoService = require('./memo.service');
const {
  notifyAwaitingApproval,
  notifyFinalApproval,
  notifyRejected,
  notifyChangesRequested,
  notifyParticipantAdded,
} = require('./notification.service');

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

  if (nextStep) {
    await notifyAwaitingApproval(memo, nextStep.userId);
  } else {
    await notifyFinalApproval(memo);
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
  await notifyRejected(memo);

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
  await notifyChangesRequested(memo);

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
  await memo.save();
  await notifyAwaitingApproval(memo, newStep.userId);

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

  await AuditLog.create({
    organizationId,
    userId: requestingUserId,
    eventType: 'WORKFLOW_PARTICIPANT_ADDED',
    description: `${newParticipant.name} was added to the workflow for memo "${memo.subject}" (reason: ${reason})`,
  });
  await notifyParticipantAdded(memo, userId);

  return { memo, workflowStep: newStep };
};

const getWorkflowHistory = async (organizationId, id, requestingUserId) => {
  // Reuses Stage 4's view-authorization exactly (author or any participant,
  // past/present) rather than a separate rule for this endpoint.
  const memo = await memoService.getMemoById(organizationId, id, requestingUserId);

  return WorkflowStep.find({ memoId: memo._id }).sort({ stepOrder: 1 }).populate('userId', 'name');
};

module.exports = {
  approveMemo,
  rejectMemo,
  requestChanges,
  resubmitMemo,
  addParticipant,
  getWorkflowHistory,
};
