const bcrypt = require('bcrypt');

const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { generateToken } = require('../utils/jwt');
const { logAuditEvent } = require('./audit.service');

const SALT_ROUNDS = 10;

const hashPassword = async (password) => bcrypt.hash(password, SALT_ROUNDS);

const login = async ({ email, password }) => {
  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new ApiError(401, 'Invalid email or password');
  }

  if (user.status !== 'active') {
    throw new ApiError(403, 'This account is not active');
  }

  const token = generateToken({
    id: user._id.toString(),
    organizationId: user.organizationId.toString(),
    role: user.role,
    departmentId: user.departmentId ? user.departmentId.toString() : null,
  });

  await logAuditEvent({
    organizationId: user.organizationId,
    userId: user._id,
    eventType: 'USER_LOGIN',
    description: `${user.name} logged in.`,
  });

  return { token, user };
};

// No token blocklisting/invalidation — out of scope for this stage. This
// endpoint's only real job is giving logout an audit trail.
const logout = async (userId, organizationId) => {
  const user = await User.findById(userId).select('name');

  await logAuditEvent({
    organizationId,
    userId,
    eventType: 'USER_LOGOUT',
    description: `${user ? user.name : 'A user'} logged out.`,
  });
};

const getCurrentUser = async (userId) => {
  const user = await User.findById(userId).populate('organizationId', 'name identifier subscriptionTier');

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return user;
};

module.exports = { login, logout, getCurrentUser, hashPassword };
