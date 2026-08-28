const asyncHandler = require('../utils/asyncHandler');
const workflowService = require('../services/workflow.service');

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
  getWorkflowHistory,
  getMemoActions,
};
