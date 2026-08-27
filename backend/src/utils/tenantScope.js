// Reusable query-scoping helper for future organization-owned resources
// (memos, departments, notifications, audit logs, workflow steps, ...).
// Every query for tenant-owned data should be built through this helper so the
// organization filter always comes from the authenticated request context
// (req.user.organizationId), never from a client-supplied field.
const withOrgScope = (req, filter = {}) => ({
  ...filter,
  organizationId: req.user.organizationId,
});

module.exports = { withOrgScope };
