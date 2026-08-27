const asyncHandler = require('../utils/asyncHandler');
const userService = require('../services/user.service');

const createUser = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.user.organizationId, req.user.id, req.body);
  res.status(201).json({ user });
});

const listUsers = asyncHandler(async (req, res) => {
  const { status, departmentId, role } = req.query;
  const users = await userService.listUsers(req.user.organizationId, { status, departmentId, role });
  res.status(200).json({ users });
});

const getUser = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.user.organizationId, req.params.id);
  res.status(200).json({ user });
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.user.organizationId, req.params.id, req.body);
  res.status(200).json({ user });
});

const updateUserStatus = asyncHandler(async (req, res) => {
  const user = await userService.updateUserStatus(
    req.user.organizationId,
    req.params.id,
    req.body.status,
    req.user.id
  );
  res.status(200).json({ user });
});

module.exports = {
  createUser,
  listUsers,
  getUser,
  updateUser,
  updateUserStatus,
};
