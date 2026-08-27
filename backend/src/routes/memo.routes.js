const express = require('express');

const memoController = require('../controllers/memo.controller');
const workflowController = require('../controllers/workflow.controller');
const protect = require('../middleware/auth');

const router = express.Router();

// Any authenticated user manages their own memos — these routes are
// intentionally not admin-only.
router.use(protect);

router.post('/', memoController.createMemo);

// Registered ahead of GET /:id so "mine"/"inbox" are never captured as :id.
router.get('/mine', memoController.listMyMemos);
router.get('/inbox', memoController.listInbox);

router.get('/:id', memoController.getMemo);
router.patch('/:id', memoController.updateMemo);
router.delete('/:id', memoController.deleteMemo);
router.post('/:id/submit', memoController.submitMemo);

router.post('/:id/approve', workflowController.approveMemo);
router.post('/:id/reject', workflowController.rejectMemo);
router.post('/:id/request-changes', workflowController.requestChanges);
router.post('/:id/resubmit', workflowController.resubmitMemo);
router.post('/:id/workflow/add-participant', workflowController.addParticipant);
router.get('/:id/workflow', workflowController.getWorkflowHistory);

module.exports = router;
