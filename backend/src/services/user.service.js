const User = require('../models/User');
const Department = require('../models/Department');
const ApiError = require('../utils/ApiError');
const { isValidEmail } = require('../utils/validators');
const { hashPassword } = require('./auth.service');

const ALLOWED_STATUSES = ['active', 'inactive', 'suspended'];

// Never trust a client-supplied departmentId: confirm it actually belongs to
// the requesting admin's own organization before it can be assigned to anyone.
const assertDepartmentBelongsToOrg = async (organizationId, departmentId) => {
  if (!departmentId) {
    return;
  }

  const department = await Department.findOne({ _id: departmentId, organizationId });
  if (!department) {
    throw new ApiError(400, 'departmentId does not belong to your organization');
  }
};

const createUser = async (organizationId, { name, email, password, role, designation, departmentId }) => {
  if (!name || !email || !password) {
    throw new ApiError(400, 'name, email, and password are required');
  }

  if (!isValidEmail(email)) {
    throw new ApiError(400, 'Please provide a valid email address');
  }

  if (password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters long');
  }

  await assertDepartmentBelongsToOrg(organizationId, departmentId);

  const hashedPassword = await hashPassword(password);

  return User.create({
    organizationId,
    departmentId: departmentId || undefined,
    name,
    email: email.toLowerCase(),
    password: hashedPassword,
    role,
    designation,
  });
};

const listUsers = async (organizationId, { status, departmentId, role } = {}) => {
  const filter = { organizationId };

  if (status) {
    filter.status = status;
  }
  if (departmentId) {
    filter.departmentId = departmentId;
  }
  if (role) {
    filter.role = role;
  }

  return User.find(filter).sort({ createdAt: -1 });
};

// Same 404-for-both-cases rule as departments: don't let the status code
// reveal whether a user id belongs to another organization or doesn't exist.
const getUserById = async (organizationId, id) => {
  const user = await User.findOne({ _id: id, organizationId });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return user;
};

const updateUser = async (organizationId, id, { name, designation, role, departmentId }) => {
  const user = await getUserById(organizationId, id);

  if (departmentId) {
    await assertDepartmentBelongsToOrg(organizationId, departmentId);
  }

  if (name !== undefined) {
    user.name = name;
  }
  if (designation !== undefined) {
    user.designation = designation;
  }
  if (role !== undefined) {
    user.role = role;
  }
  if (departmentId !== undefined) {
    user.departmentId = departmentId || undefined;
  }

  await user.save();
  return user;
};

const updateUserStatus = async (organizationId, id, status, requestingUserId) => {
  if (!ALLOWED_STATUSES.includes(status)) {
    throw new ApiError(400, `status must be one of: ${ALLOWED_STATUSES.join(', ')}`);
  }

  if (String(id) === String(requestingUserId) && status !== 'active') {
    throw new ApiError(400, 'You cannot deactivate your own account');
  }

  const user = await getUserById(organizationId, id);
  user.status = status;
  await user.save();
  return user;
};

module.exports = {
  createUser,
  listUsers,
  getUserById,
  updateUser,
  updateUserStatus,
};
