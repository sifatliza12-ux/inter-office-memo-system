const User = require('../models/User');
const Department = require('../models/Department');

// A minimal, read-only listing of an organization's active users and active
// departments — used to populate the memo department/workflow-participant
// pickers. Deliberately separate from the admin-only management endpoints
// in user.service.js/department.service.js: any authenticated member of the
// organization may browse this, not just admins.
const listOrganizationDirectory = async (organizationId) => {
  const [users, departments] = await Promise.all([
    User.find({ organizationId, status: 'active' })
      .select('_id name email departmentId role')
      .sort({ name: 1 }),
    Department.find({ organizationId, status: 'active' }).select('_id name').sort({ name: 1 }),
  ]);

  return { users, departments };
};

module.exports = { listOrganizationDirectory };
