const asyncHandler = require('../utils/asyncHandler');
const departmentService = require('../services/department.service');

const createDepartment = asyncHandler(async (req, res) => {
  const department = await departmentService.createDepartment(req.user.organizationId, req.body);
  res.status(201).json({ department });
});

const listDepartments = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const departments = await departmentService.listDepartments(req.user.organizationId, { status });
  res.status(200).json({ departments });
});

const getDepartment = asyncHandler(async (req, res) => {
  const department = await departmentService.getDepartmentById(req.user.organizationId, req.params.id);
  res.status(200).json({ department });
});

const updateDepartment = asyncHandler(async (req, res) => {
  const department = await departmentService.updateDepartment(
    req.user.organizationId,
    req.params.id,
    req.body
  );
  res.status(200).json({ department });
});

const updateDepartmentStatus = asyncHandler(async (req, res) => {
  const department = await departmentService.updateDepartmentStatus(
    req.user.organizationId,
    req.params.id,
    req.body.status
  );
  res.status(200).json({ department });
});

module.exports = {
  createDepartment,
  listDepartments,
  getDepartment,
  updateDepartment,
  updateDepartmentStatus,
};
