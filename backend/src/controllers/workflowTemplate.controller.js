const asyncHandler = require('../utils/asyncHandler');
const workflowTemplateService = require('../services/workflowTemplate.service');

const createWorkflowTemplate = asyncHandler(async (req, res) => {
  const workflowTemplate = await workflowTemplateService.createWorkflowTemplate(
    req.user.organizationId,
    req.user.id,
    req.body
  );
  res.status(201).json({ workflowTemplate });
});

// includeInactive is only ever honored for an admin caller — a non-admin's
// own query string can never widen this past active-only.
const listWorkflowTemplates = asyncHandler(async (req, res) => {
  const includeInactive = req.user.role === 'admin' && req.query.includeInactive === 'true';
  const workflowTemplates = await workflowTemplateService.listWorkflowTemplates(req.user.organizationId, {
    includeInactive,
  });
  res.status(200).json({ workflowTemplates });
});

const updateWorkflowTemplate = asyncHandler(async (req, res) => {
  const workflowTemplate = await workflowTemplateService.updateWorkflowTemplate(
    req.user.organizationId,
    req.params.id,
    req.body
  );
  res.status(200).json({ workflowTemplate });
});

const deactivateWorkflowTemplate = asyncHandler(async (req, res) => {
  const workflowTemplate = await workflowTemplateService.deactivateWorkflowTemplate(
    req.user.organizationId,
    req.params.id
  );
  res.status(200).json({ workflowTemplate });
});

module.exports = {
  createWorkflowTemplate,
  listWorkflowTemplates,
  updateWorkflowTemplate,
  deactivateWorkflowTemplate,
};
