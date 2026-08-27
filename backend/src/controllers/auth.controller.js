const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/auth.service');

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { token, user } = await authService.login({ email, password });
  res.status(200).json({ token, user });
});

const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);
  res.status(200).json({ user });
});

module.exports = { login, getMe };
