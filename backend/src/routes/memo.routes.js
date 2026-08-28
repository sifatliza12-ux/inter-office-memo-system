const express = require('express');

const memoController = require('../controllers/memo.controller');
const workflowController = require('../controllers/workflow.controller');
const commentController = require('../controllers/comment.controller');
const attachmentController = require('../controllers/attachment.controller');
const exportController = require('../controllers/export.controller');
const protect = require('../middleware/auth');
const { uploadSingleFile } = require('../middleware/upload');

const router = express.Router();

// Any authenticated user manages their own memos — these routes are
// intentionally not admin-only.
router.use(protect);

router.post('/', memoController.createMemo);

// Registered ahead of GET /:id so "mine"/"inbox"/"search" are never
// captured as :id.
router.get('/mine', memoController.listMyMemos);
router.get('/inbox', memoController.listInbox);
router.get('/search', memoController.searchMemos);

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

// Immutable content snapshots (Stage 13a) — read-only, no PATCH/DELETE ever
// wired up for MemoVersion, by design.
router.get('/:id/versions', memoController.getMemoVersions);

// Stage 13b: general workflow event log, written alongside (not instead of)
// the WorkflowStep-backed /:id/workflow route above. Read-only, no
// PATCH/DELETE ever wired up for WorkflowAction, by design.
router.get('/:id/actions', workflowController.getMemoActions);

// Generated on-demand per request, never persisted — not a new Attachment.
router.get('/:id/export/pdf', exportController.exportMemoPdf);

// General discussion comments — a separate collection/thread from the
// approve/reject/request-changes comments recorded on WorkflowStep above.
router.post('/:id/comments', commentController.createComment);
router.get('/:id/comments', commentController.listComments);

// Attachments — stored in a private Supabase Storage bucket (Stage 8b),
// never as static/public files; only ever served through the authorized
// download endpoint below, which proxies the bytes server-side.
router.post('/:id/attachments', uploadSingleFile, attachmentController.uploadAttachment);
router.get('/:id/attachments', attachmentController.listAttachments);
router.get('/:id/attachments/:attachmentId/download', attachmentController.downloadAttachment);
router.delete('/:id/attachments/:attachmentId', attachmentController.deleteAttachment);

module.exports = router;
