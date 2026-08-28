const asyncHandler = require('../utils/asyncHandler');
const memoService = require('../services/memo.service');

const createMemo = asyncHandler(async (req, res) => {
  const memo = await memoService.createMemo(
    req.user.organizationId,
    req.user.id,
    req.user.departmentId,
    req.body
  );
  res.status(201).json({ memo });
});

const listMyMemos = asyncHandler(async (req, res) => {
  const { status, category, priority } = req.query;
  const memos = await memoService.listMyMemos(req.user.organizationId, req.user.id, {
    status,
    category,
    priority,
  });
  res.status(200).json({ memos });
});

const listInbox = asyncHandler(async (req, res) => {
  const { status, category, priority } = req.query;
  const memos = await memoService.listInbox(req.user.organizationId, req.user.id, {
    status,
    category,
    priority,
  });
  res.status(200).json({ memos });
});

const searchMemos = asyncHandler(async (req, res) => {
  const { q, status, category, priority, department, dateFrom, dateTo, page, limit } = req.query;
  const result = await memoService.searchMemos(req.user.organizationId, req.user.id, {
    q,
    status,
    category,
    priority,
    department,
    dateFrom,
    dateTo,
    page,
    limit,
  });
  res.status(200).json(result);
});

const getMemo = asyncHandler(async (req, res) => {
  const memo = await memoService.getMemoById(req.user.organizationId, req.params.id, req.user.id);
  res.status(200).json({ memo });
});

const updateMemo = asyncHandler(async (req, res) => {
  const memo = await memoService.updateMemo(req.user.organizationId, req.params.id, req.user.id, req.body);
  res.status(200).json({ memo });
});

const deleteMemo = asyncHandler(async (req, res) => {
  await memoService.deleteMemo(req.user.organizationId, req.params.id, req.user.id);
  res.status(204).send();
});

const submitMemo = asyncHandler(async (req, res) => {
  const { memo, workflowSteps } = await memoService.submitMemo(
    req.user.organizationId,
    req.params.id,
    req.user.id
  );
  res.status(200).json({ memo, workflowSteps });
});

const getMemoVersions = asyncHandler(async (req, res) => {
  const versions = await memoService.listMemoVersions(req.user.organizationId, req.params.id, req.user.id);
  res.status(200).json({ versions });
});

module.exports = {
  createMemo,
  listMyMemos,
  listInbox,
  searchMemos,
  getMemo,
  updateMemo,
  deleteMemo,
  submitMemo,
  getMemoVersions,
};
