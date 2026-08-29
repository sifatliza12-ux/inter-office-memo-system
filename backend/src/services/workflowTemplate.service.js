const WorkflowTemplate = require('../models/WorkflowTemplate');
const ApiError = require('../utils/ApiError');

const MAX_ROLE_LABEL_LENGTH = 100;

// Positions are always re-sequenced from array order (10, 20, 30…) — the
// frontend form has no manual order field (PRD §15.5), and the client never
// supplies `order` for create/update. Only `templateAssignments` at memo
// creation ever refers back to these values, matching whatever the template
// was last saved with.
const normalizePositions = (positions) => {
  if (!Array.isArray(positions) || positions.length === 0) {
    throw new ApiError(400, 'At least one position is required');
  }

  return positions.map((position, index) => {
    const roleLabel = typeof position?.roleLabel === 'string' ? position.roleLabel.trim() : '';
    if (!roleLabel) {
      throw new ApiError(400, 'Every position requires a roleLabel');
    }
    if (roleLabel.length > MAX_ROLE_LABEL_LENGTH) {
      throw new ApiError(400, `roleLabel must be ${MAX_ROLE_LABEL_LENGTH} characters or fewer`);
    }
    return { order: (index + 1) * 10, roleLabel };
  });
};

const createWorkflowTemplate = async (organizationId, requestingUserId, { name, positions }) => {
  if (!name || !String(name).trim()) {
    throw new ApiError(400, 'Template name is required');
  }

  return WorkflowTemplate.create({
    organizationId,
    name: String(name).trim(),
    positions: normalizePositions(positions),
    createdBy: requestingUserId,
  });
};

// Non-admin callers always get active-only, regardless of any query param
// they pass — includeInactive is only ever true when the controller has
// already confirmed the caller is an admin.
const listWorkflowTemplates = async (organizationId, { includeInactive = false } = {}) => {
  const filter = { organizationId };
  if (!includeInactive) {
    filter.status = 'active';
  }
  return WorkflowTemplate.find(filter).sort({ createdAt: -1 });
};

// Same 404-not-403 pattern as department/user lookups (department.service.js,
// user.service.js): doesn't distinguish "doesn't exist" from "belongs to
// another organization", so a caller can't use the status code to probe for
// another org's template ids.
const getTemplateById = async (organizationId, id) => {
  const template = await WorkflowTemplate.findOne({ _id: id, organizationId });
  if (!template) {
    throw new ApiError(404, 'Workflow template not found');
  }
  return template;
};

const updateWorkflowTemplate = async (organizationId, id, { name, positions }) => {
  const template = await getTemplateById(organizationId, id);

  if (template.status !== 'active') {
    throw new ApiError(400, 'Only an active workflow template can be updated');
  }

  if (name !== undefined) {
    if (!String(name).trim()) {
      throw new ApiError(400, 'Template name is required');
    }
    template.name = String(name).trim();
  }
  if (positions !== undefined) {
    template.positions = normalizePositions(positions);
  }

  await template.save();
  return template;
};

// One-way: no reactivate endpoint this stage (PRD §15.2). Deactivating never
// deletes the document or touches any memo already built from it.
const deactivateWorkflowTemplate = async (organizationId, id) => {
  const template = await getTemplateById(organizationId, id);
  template.status = 'inactive';
  await template.save();
  return template;
};

// Used by memo.service.js's createMemo to resolve a templateId into its
// position list. Same 400-for-invalid-body-reference convention as
// assertDepartmentBelongsToOrg/assertParticipantsBelongToOrg (user.service.js
// / memo.service.js) — this is about an invalid reference in the request
// body, not a URL-addressed resource, so it's deliberately 400 rather than
// 404. The 422s for incomplete/invalid position assignments are raised by
// the caller, one layer up, once it has this template's positions in hand.
const getActiveTemplateForAssignment = async (organizationId, id) => {
  const template = await WorkflowTemplate.findOne({ _id: id, organizationId, status: 'active' });
  if (!template) {
    throw new ApiError(400, 'templateId does not reference an active workflow template in your organization');
  }
  return template;
};

module.exports = {
  createWorkflowTemplate,
  listWorkflowTemplates,
  updateWorkflowTemplate,
  deactivateWorkflowTemplate,
  getActiveTemplateForAssignment,
};
