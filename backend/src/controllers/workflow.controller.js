const asyncHandler = require('../utils/asyncHandler');
const workflowService = require('../services/workflow.service');
const ApiError = require('../utils/ApiError');

const approveMemo = asyncHandler(async (req, res) => {
  const memo = await workflowService.approveMemo(
    req.user.organizationId,
    req.params.id,
    req.user.id,
    req.body.comment
  );
  res.status(200).json({ memo });
});

const rejectMemo = asyncHandler(async (req, res) => {
  const memo = await workflowService.rejectMemo(
    req.user.organizationId,
    req.params.id,
    req.user.id,
    req.body.comment
  );
  res.status(200).json({ memo });
});

const requestChanges = asyncHandler(async (req, res) => {
  const memo = await workflowService.requestChanges(
    req.user.organizationId,
    req.params.id,
    req.user.id,
    req.body.comment
  );
  res.status(200).json({ memo });
});

const resubmitMemo = asyncHandler(async (req, res) => {
  const memo = await workflowService.resubmitMemo(req.user.organizationId, req.params.id, req.user.id);
  res.status(200).json({ memo });
});

const addParticipant = asyncHandler(async (req, res) => {
  const { memo, workflowStep } = await workflowService.addParticipant(
    req.user.organizationId,
    req.params.id,
    req.user.id,
    req.body
  );
  res.status(201).json({ memo, workflowStep });
});

const redirectMemo = asyncHandler(async (req, res) => {
  const { memo, workflowStep } = await workflowService.redirectMemo(
    req.user.organizationId,
    req.params.id,
    req.user.id,
    req.body
  );
  res.status(200).json({ memo, workflowStep });
});

const declineRedirectMemo = asyncHandler(async (req, res) => {
  const { memo, workflowStep } = await workflowService.declineRedirectMemo(
    req.user.organizationId,
    req.params.id,
    req.user.id,
    req.body
  );
  res.status(200).json({ memo, workflowStep });
});

const removeParticipant = asyncHandler(async (req, res) => {
  const { memo, workflowStep } = await workflowService.removeParticipant(
    req.user.organizationId,
    req.params.id,
    req.user.id,
    req.body
  );
  res.status(200).json({ memo, workflowStep });
});

// Pre-Stage-3. `express.json()` already rejects malformed JSON with a 400
// before this handler ever runs — this only needs to catch a request whose
// body parsed successfully but isn't a JSON object (a bare string, number,
// array, or null), which req.body.roleLabel would otherwise silently read
// as undefined instead of properly failing validation.
const setMyRoleLabel = asyncHandler(async (req, res) => {
  if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
    throw new ApiError(400, 'Request body must be a JSON object');
  }
  const workflowStep = await workflowService.setMyRoleLabel(req.user.organizationId, req.params.id, req.user.id, req.body);
  res.status(200).json({ workflowStep });
});

const getWorkflowHistory = asyncHandler(async (req, res) => {
  const workflowSteps = await workflowService.getWorkflowHistory(
    req.user.organizationId,
    req.params.id,
    req.user.id
  );
  res.status(200).json({ workflowSteps });
});

const getMemoActions = asyncHandler(async (req, res) => {
  const actions = await workflowService.getMemoActions(req.user.organizationId, req.params.id, req.user.id);
  res.status(200).json({ actions });
});

module.exports = {
  approveMemo,
  rejectMemo,
  requestChanges,
  resubmitMemo,
  addParticipant,
  redirectMemo,
  declineRedirectMemo,
  removeParticipant,
  setMyRoleLabel,
  getWorkflowHistory,
  getMemoActions,
};
