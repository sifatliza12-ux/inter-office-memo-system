const asyncHandler = require('../utils/asyncHandler');
const dashboardService = require('../services/dashboard.service');

const getDashboard = asyncHandler(async (req, res) => {
  const summary = await dashboardService.getUserDashboard(req.user.organizationId, req.user.id);
  res.status(200).json(summary);
});

const getOrganizationDashboard = asyncHandler(async (req, res) => {
  const summary = await dashboardService.getOrganizationDashboard(req.user.organizationId);
  res.status(200).json(summary);
});

module.exports = { getDashboard, getOrganizationDashboard };
