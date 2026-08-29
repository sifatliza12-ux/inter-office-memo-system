const express = require('express');

const workflowTemplateController = require('../controllers/workflowTemplate.controller');
const protect = require('../middleware/auth');
const authorize = require('../middleware/role');

const router = express.Router();

router.use(protect);

// List is intentionally NOT admin-only — any authenticated same-org user
// needs it to populate the memo-creation template picker. Everything else
// (create/update/deactivate) is admin-only, same as departments/users.
router.get('/', workflowTemplateController.listWorkflowTemplates);

router.post('/', authorize('admin'), workflowTemplateController.createWorkflowTemplate);
router.patch('/:id', authorize('admin'), workflowTemplateController.updateWorkflowTemplate);
router.patch('/:id/deactivate', authorize('admin'), workflowTemplateController.deactivateWorkflowTemplate);

module.exports = router;
