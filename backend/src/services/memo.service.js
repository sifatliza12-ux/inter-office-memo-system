const Memo = require('../models/Memo');
const User = require('../models/User');
const WorkflowStep = require('../models/WorkflowStep');
const ApiError = require('../utils/ApiError');
const { generateMemoReferenceNumber } = require('./referenceNumber.service');
const { assertDepartmentBelongsToOrg } = require('./user.service');
const { notifyAwaitingApproval } = require('./notification.service');
const { logAuditEvent } = require('./audit.service');
const { snapshotMemoVersion, listVersions } = require('./memoVersion.service');
const { recordWorkflowAction } = require('./workflowAction.service');
const { getActiveTemplateForAssignment } = require('./workflowTemplate.service');

const ALLOWED_CATEGORIES = ['Administrative', 'Financial', 'Procurement', 'HR', 'Academic', 'Technical', 'General'];
const ALLOWED_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const STEP_ORDER_INCREMENT = 10;

// Never trust workflow participant ids blindly: every one of them must
// exist and belong to the same organization as the memo's author.
const assertParticipantsBelongToOrg = async (organizationId, workflowParticipants) => {
  if (!workflowParticipants || workflowParticipants.length === 0) {
    return;
  }

  const uniqueIds = [...new Set(workflowParticipants.map(String))];
  const foundUsers = await User.find({ _id: { $in: uniqueIds }, organizationId }).select('_id');
  const foundIds = new Set(foundUsers.map((user) => user._id.toString()));

  const missing = uniqueIds.some((id) => !foundIds.has(id));
  if (missing) {
    throw new ApiError(400, 'One or more workflow participants do not exist in your organization');
  }
};

// Stage 15: resolves an optional templateId + templateAssignments
// ([{ order, userId }]) into an ordered participant list, matching the
// template's position order. Every position must have an assignment whose
// userId belongs to this organization AND is an active user — any failure
// on either check rejects the whole call with 422 (no partial creation),
// per the PRD §15.3 requirement. The template itself being missing/inactive/
// cross-org is a 400 (getActiveTemplateForAssignment), consistent with how
// an invalid departmentId/workflowParticipants reference is handled
// elsewhere in this file — 422 here is reserved specifically for
// per-position assignment failures.
const resolveTemplateAssignments = async (organizationId, templateId, templateAssignments) => {
  const template = await getActiveTemplateForAssignment(organizationId, templateId);

  const assignmentByOrder = new Map(
    (Array.isArray(templateAssignments) ? templateAssignments : [])
      .filter((assignment) => assignment && assignment.userId)
      .map((assignment) => [Number(assignment.order), assignment.userId])
  );

  const userIds = template.positions.map((position) => assignmentByOrder.get(position.order));

  if (userIds.some((userId) => !userId)) {
    throw new ApiError(422, 'Every workflow template position must be assigned a user');
  }

  const uniqueIds = [...new Set(userIds.map(String))];
  const activeUsers = await User.find({ _id: { $in: uniqueIds }, organizationId, status: 'active' }).select('_id');
  const activeIds = new Set(activeUsers.map((user) => user._id.toString()));

  if (uniqueIds.some((id) => !activeIds.has(id))) {
    throw new ApiError(
      422,
      'Every workflow template position must be assigned to an active user in your organization'
    );
  }

  return {
    workflowParticipants: userIds,
    templateRoleLabels: template.positions.map((position) => position.roleLabel),
    workflowTemplateId: template._id,
  };
};

const assertValidCategory = (category) => {
  if (category !== undefined && !ALLOWED_CATEGORIES.includes(category)) {
    throw new ApiError(400, `category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`);
  }
};

const assertValidPriority = (priority) => {
  if (priority !== undefined && !ALLOWED_PRIORITIES.includes(priority)) {
    throw new ApiError(400, `priority must be one of: ${ALLOWED_PRIORITIES.join(', ')}`);
  }
};

const createMemo = async (organizationId, authorId, authorDepartmentId, payload) => {
  const { subject, body, category, priority, departmentId, workflowParticipants, templateId, templateAssignments } =
    payload;

  if (!subject || !body) {
    throw new ApiError(400, 'subject and body are required');
  }

  assertValidCategory(category);
  assertValidPriority(priority);

  const resolvedDepartmentId = departmentId !== undefined ? departmentId : authorDepartmentId;
  await assertDepartmentBelongsToOrg(organizationId, resolvedDepartmentId);

  let resolvedParticipants = workflowParticipants || [];
  let workflowTemplateId;
  let templateRoleLabels;

  // If templateId is absent, this is the existing manual flow, completely
  // unchanged (PRD §15.3).
  if (templateId) {
    ({
      workflowParticipants: resolvedParticipants,
      templateRoleLabels,
      workflowTemplateId,
    } = await resolveTemplateAssignments(organizationId, templateId, templateAssignments));
  } else {
    await assertParticipantsBelongToOrg(organizationId, resolvedParticipants);
  }

  const referenceNumber = await generateMemoReferenceNumber(organizationId);

  const memo = await Memo.create({
    organizationId,
    authorId,
    departmentId: resolvedDepartmentId || undefined,
    subject,
    body,
    category,
    priority,
    workflowParticipants: resolvedParticipants,
    workflowTemplateId,
    templateRoleLabels,
    referenceNumber,
    status: 'draft',
  });

  await logAuditEvent({
    organizationId,
    userId: authorId,
    eventType: 'MEMO_CREATED',
    description: `Memo ${memo.referenceNumber} ("${memo.subject}") was created.`,
  });

  return memo;
};

const listMyMemos = async (organizationId, authorId, { status, category, priority } = {}) => {
  const filter = { organizationId, authorId };

  if (status) {
    filter.status = status;
  }
  if (category) {
    filter.category = category;
  }
  if (priority) {
    filter.priority = priority;
  }

  // Populated so the author's own list can show "waiting on: X" without a
  // second call — see Stage 6.
  return Memo.find(filter)
    .sort({ createdAt: -1 })
    .populate('currentApproverId', 'name')
    .populate('finalApproverId', 'name');
};

// Memos where it is currently this user's turn to act — the query this
// stands on (currentApproverId matching the caller) is exactly the use the
// Stage 5 comment on Memo.currentApproverId flagged the cache for. Filters
// are applied as given, with no assumption baked in about which status
// values are realistic here — that's left to the caller.
const listInbox = async (organizationId, userId, { status, category, priority } = {}) => {
  const filter = { organizationId, currentApproverId: userId };

  if (status) {
    filter.status = status;
  }
  if (category) {
    filter.category = category;
  }
  if (priority) {
    filter.priority = priority;
  }

  const memos = await Memo.find(filter)
    .sort({ updatedAt: 1 })
    .populate('authorId', 'name')
    .populate('departmentId', 'name');

  // "Age" is time since currentStepSince — set precisely whenever
  // currentApproverId is set to a new value (submit, an approve that
  // advances the step, resubmit) and left untouched by anything that
  // doesn't change whose turn it is (e.g. add-participant). Every code path
  // that sets currentApproverId also sets currentStepSince in the same
  // save, so it's always present here.
  const now = Date.now();
  return memos.map((memo) => {
    const memoObject = memo.toObject();
    memoObject.ageMs = now - new Date(memo.currentStepSince).getTime();
    return memoObject;
  });
};

const escapeRegex = (string) => String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Same visibility rule as comments/attachments (Stage 7/8): authored by the
// caller, or the caller holds ANY WorkflowStep on the memo (past/current/
// future). Combined via a single top-level $and with every other filter —
// never a second, independent $or — so there is no way for the visibility
// clause to be accidentally widened by whatever the caller passed in q/
// status/etc. A memo this query wouldn't return is a memo GET /memos/:id
// would also 403/404 on for this same user; that invariant is what the
// Stage 8 "never leak a memo the user isn't authorized to view" requirement
// actually rests on.
const searchMemos = async (
  organizationId,
  requestingUserId,
  { q, status, category, priority, department, dateFrom, dateTo, page, limit } = {}
) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 20);

  const participantMemoIds = await WorkflowStep.find({ userId: requestingUserId }).distinct('memoId');

  const andClauses = [
    { organizationId },
    { $or: [{ authorId: requestingUserId }, { _id: { $in: participantMemoIds } }] },
  ];

  if (status) {
    andClauses.push({ status });
  }
  if (category) {
    andClauses.push({ category });
  }
  if (priority) {
    andClauses.push({ priority });
  }
  if (department) {
    andClauses.push({ departmentId: department });
  }
  if (dateFrom || dateTo) {
    const dateFilter = {};
    if (dateFrom) {
      dateFilter.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      dateFilter.$lte = new Date(dateTo);
    }
    andClauses.push({ createdAt: dateFilter });
  }
  if (q) {
    const regex = new RegExp(escapeRegex(q), 'i');
    andClauses.push({ $or: [{ subject: regex }, { body: regex }, { referenceNumber: regex }] });
  }

  const filter = { $and: andClauses };

  const [memos, total] = await Promise.all([
    Memo.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('authorId', 'name')
      .populate('departmentId', 'name'),
    Memo.countDocuments(filter),
  ]);

  return { memos, total, page: pageNum, limit: limitNum };
};

// View privacy rule, regardless of status: only the author or a listed
// workflow participant may view a memo. Any other same-org user gets 403.
// Cross-organization access is handled one level up, by the 404 thrown when
// the scoped lookup finds nothing.
const getMemoById = async (organizationId, id, requestingUserId) => {
  const memo = await Memo.findOne({ _id: id, organizationId });

  if (!memo) {
    throw new ApiError(404, 'Memo not found');
  }

  const isAuthor = memo.authorId.toString() === String(requestingUserId);
  const isParticipant = memo.workflowParticipants.some(
    (participantId) => participantId.toString() === String(requestingUserId)
  );

  if (!isAuthor && !isParticipant) {
    throw new ApiError(403, 'You do not have access to this memo');
  }

  return memo;
};

// Shared by update/delete/submit: only the author may ever mutate a memo,
// regardless of its status — a non-author gets 403 even for a submitted
// memo, not just for a draft.
const getMemoForMutation = async (organizationId, id, requestingUserId) => {
  const memo = await Memo.findOne({ _id: id, organizationId });

  if (!memo) {
    throw new ApiError(404, 'Memo not found');
  }

  if (memo.authorId.toString() !== String(requestingUserId)) {
    throw new ApiError(403, 'You do not have access to this memo');
  }

  return memo;
};

const updateMemo = async (organizationId, id, requestingUserId, payload) => {
  const memo = await getMemoForMutation(organizationId, id, requestingUserId);

  if (memo.status !== 'draft' && memo.status !== 'changes_requested') {
    throw new ApiError(400, 'Only a draft or changes-requested memo can be edited');
  }

  const { subject, body, category, priority, departmentId, workflowParticipants } = payload;

  assertValidCategory(category);
  assertValidPriority(priority);

  if (departmentId !== undefined) {
    await assertDepartmentBelongsToOrg(organizationId, departmentId);
  }
  if (workflowParticipants !== undefined) {
    await assertParticipantsBelongToOrg(organizationId, workflowParticipants);
  }

  if (subject !== undefined) {
    memo.subject = subject;
  }
  if (body !== undefined) {
    memo.body = body;
  }
  if (category !== undefined) {
    memo.category = category;
  }
  if (priority !== undefined) {
    memo.priority = priority;
  }
  if (departmentId !== undefined) {
    memo.departmentId = departmentId || undefined;
  }
  if (workflowParticipants !== undefined) {
    // A template-seeded roleLabel (Stage 15) is positionally aligned with
    // workflowParticipants at seed time, so it's only preserved index-by-
    // index where the SAME user still occupies the SAME index after this
    // edit — every other position loses its seeded label (the
    // correspondence for that slot no longer holds), rather than a change
    // to one position wiping the label for every position. This never
    // touches WorkflowStep.roleLabel — that field belongs exclusively to
    // the separate, unchanged PATCH /:id/workflow/role endpoint
    // (workflow.service.js's setMyRoleLabel), so a participant's own
    // already-customized label can never be affected by this edit.
    const oldParticipants = memo.workflowParticipants;
    const oldLabels = memo.templateRoleLabels || [];
    memo.templateRoleLabels = workflowParticipants.map((userId, index) =>
      oldParticipants[index] && oldParticipants[index].toString() === String(userId) ? oldLabels[index] : undefined
    );
    memo.workflowParticipants = workflowParticipants;
  }

  await memo.save();

  await logAuditEvent({
    organizationId,
    userId: requestingUserId,
    eventType: 'MEMO_MODIFIED',
    description: `Memo ${memo.referenceNumber} ("${memo.subject}") was modified.`,
  });

  return memo;
};

const deleteMemo = async (organizationId, id, requestingUserId) => {
  const memo = await getMemoForMutation(organizationId, id, requestingUserId);

  if (memo.status !== 'draft') {
    throw new ApiError(400, 'Only a draft memo can be deleted');
  }

  await memo.deleteOne();
};

const submitMemo = async (organizationId, id, requestingUserId) => {
  const memo = await getMemoForMutation(organizationId, id, requestingUserId);

  if (memo.status !== 'draft') {
    throw new ApiError(400, 'Only a draft memo can be submitted');
  }

  if (!memo.workflowParticipants || memo.workflowParticipants.length === 0) {
    throw new ApiError(400, 'At least one workflow participant is required to submit a memo');
  }

  // Re-validate at submit time rather than trusting whatever was stored at
  // create/edit time — cheap, and closes off any drift between when the
  // participants were set and when the memo is actually submitted.
  await assertParticipantsBelongToOrg(organizationId, memo.workflowParticipants);

  // Stage 15: seeds each step's roleLabel from the memo's templateRoleLabels
  // when present (positionally aligned with workflowParticipants — see the
  // Memo model comment and updateMemo above). A starting value only: the
  // participant can still edit/clear their own label afterward via the
  // existing, unchanged PATCH /:id/workflow/role endpoint. Manual (non-
  // template) memos have no templateRoleLabels, so roleLabel is left unset,
  // exactly as before this stage.
  const steps = memo.workflowParticipants.map((userId, index) => {
    const step = {
      memoId: memo._id,
      userId,
      stepOrder: (index + 1) * STEP_ORDER_INCREMENT,
    };
    const templateRoleLabel = memo.templateRoleLabels && memo.templateRoleLabels[index];
    if (templateRoleLabel) {
      step.roleLabel = templateRoleLabel;
    }
    return step;
  });

  try {
    await WorkflowStep.insertMany(steps, { ordered: true });
  } catch (error) {
    await WorkflowStep.deleteMany({ memoId: memo._id });
    throw new ApiError(500, 'Failed to create the approval workflow for this memo; submission was not completed');
  }

  const createdSteps = await WorkflowStep.find({ memoId: memo._id }).sort({ stepOrder: 1 });

  memo.status = 'submitted';
  memo.submittedAt = new Date();
  // The current step is always the first one at submission time (lowest
  // stepOrder, all freshly created as 'pending') — cache it now so the
  // invariant "cache matches a fresh computation" holds from this moment on,
  // not just after the first workflow action.
  memo.currentApproverId = createdSteps[0].userId;
  memo.currentStepOrder = createdSteps[0].stepOrder;
  memo.currentStepSince = memo.submittedAt;
  // Stage 13a: the historical record of what was originally planned, set
  // ONCE here from whatever workflowParticipants contains at this exact
  // moment — copied, not referenced, so later mutations to the live
  // workflowParticipants array (e.g. add-participant) can never affect it.
  memo.originalWorkflowParticipants = [...memo.workflowParticipants];
  memo.currentVersionNumber = 1;

  try {
    await memo.save();
  } catch (error) {
    // Roll back the steps we just created so a save failure can't leave
    // WorkflowSteps behind for a memo that's still a draft.
    await WorkflowStep.deleteMany({ memoId: memo._id });
    throw error;
  }

  // First content snapshot — see Stage 13a. Deliberately after the memo
  // save succeeds, so a MemoVersion only ever exists for a memo state that
  // actually made it to 'submitted'.
  await snapshotMemoVersion(memo, requestingUserId);

  // Stage 13b: general event-log entry alongside the WorkflowStep write
  // above — written IN ADDITION to it, not instead of it, this stage.
  await recordWorkflowAction({
    memoId: memo._id,
    organizationId,
    versionNumber: memo.currentVersionNumber,
    actor: requestingUserId,
    action: 'MEMO_SUBMITTED',
    recipient: createdSteps[0].userId,
  });

  await notifyAwaitingApproval(memo, createdSteps[0].userId);

  await logAuditEvent({
    organizationId,
    userId: requestingUserId,
    eventType: 'MEMO_SUBMITTED',
    description: `Memo ${memo.referenceNumber} ("${memo.subject}") was submitted for approval.`,
  });

  // Describes WHO was assigned, as a separate event from the submission
  // itself. Names resolved in workflowParticipants order (the same order
  // the steps above were created in), not just IDs, so this reads clearly
  // to an admin without a second lookup.
  const participantUsers = await User.find({ _id: { $in: memo.workflowParticipants } }).select('name');
  const nameById = new Map(participantUsers.map((user) => [user._id.toString(), user.name]));
  const participantNames = memo.workflowParticipants.map(
    (userId) => nameById.get(userId.toString()) || 'Unknown user'
  );
  await logAuditEvent({
    organizationId,
    userId: requestingUserId,
    eventType: 'WORKFLOW_ASSIGNED',
    description: `Workflow for memo ${memo.referenceNumber} was assigned to: ${participantNames.join(', ')}.`,
  });

  return { memo, workflowSteps: createdSteps };
};

// Same view-authorization as GET /api/memos/:id (author, or any user with a
// WorkflowStep on the memo, any status) — see Stage 13a.
const listMemoVersions = async (organizationId, id, requestingUserId) => {
  const memo = await getMemoById(organizationId, id, requestingUserId);
  return listVersions(memo._id);
};

module.exports = {
  createMemo,
  listMyMemos,
  listInbox,
  searchMemos,
  getMemoById,
  updateMemo,
  deleteMemo,
  submitMemo,
  listMemoVersions,
};
