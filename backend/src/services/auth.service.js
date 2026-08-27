const bcrypt = require('bcrypt');

const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { generateToken } = require('../utils/jwt');

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

  return { token, user };
};

const getCurrentUser = async (userId) => {
  const user = await User.findById(userId).populate('organizationId', 'name identifier subscriptionTier');

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return user;
};

module.exports = { login, getCurrentUser, hashPassword };
