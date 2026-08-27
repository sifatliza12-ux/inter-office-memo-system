const express = require('express');

const memoController = require('../controllers/memo.controller');
const protect = require('../middleware/auth');

const router = express.Router();

// Any authenticated user manages their own memos — these routes are
// intentionally not admin-only.
router.use(protect);

router.post('/', memoController.createMemo);

// Registered ahead of GET /:id so "mine" is never captured as an :id param.
router.get('/mine', memoController.listMyMemos);

router.get('/:id', memoController.getMemo);
router.patch('/:id', memoController.updateMemo);
router.delete('/:id', memoController.deleteMemo);
router.post('/:id/submit', memoController.submitMemo);

module.exports = router;
