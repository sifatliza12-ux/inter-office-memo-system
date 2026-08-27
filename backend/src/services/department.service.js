const Department = require('../models/Department');
const ApiError = require('../utils/ApiError');

const ALLOWED_STATUSES = ['active', 'inactive'];

const createDepartment = async (organizationId, { name, description }) => {
  if (!name) {
    throw new ApiError(400, 'Department name is required');
  }

  return Department.create({ organizationId, name, description });
};

const listDepartments = async (organizationId, { status } = {}) => {
  const filter = { organizationId };

  if (status) {
    filter.status = status;
  }

  return Department.find(filter).sort({ createdAt: -1 });
};

// Deliberately returns 404 (not 403) whether the department doesn't exist at
// all or simply belongs to another organization, so a caller can't use the
// status code to probe for another org's department ids.
const getDepartmentById = async (organizationId, id) => {
  const department = await Department.findOne({ _id: id, organizationId });

  if (!department) {
    throw new ApiError(404, 'Department not found');
  }

  return department;
};

const updateDepartment = async (organizationId, id, { name, description }) => {
  const department = await getDepartmentById(organizationId, id);

  if (name !== undefined) {
    department.name = name;
  }
  if (description !== undefined) {
    department.description = description;
  }

  await department.save();
  return department;
};

const updateDepartmentStatus = async (organizationId, id, status) => {
  if (!ALLOWED_STATUSES.includes(status)) {
    throw new ApiError(400, `status must be one of: ${ALLOWED_STATUSES.join(', ')}`);
  }

  const department = await getDepartmentById(organizationId, id);
  department.status = status;
  await department.save();
  return department;
};

module.exports = {
  createDepartment,
  listDepartments,
  getDepartmentById,
  updateDepartment,
  updateDepartmentStatus,
};
