const asyncHandler = require('../utils/asyncHandler');
const reportService = require('../services/report.service');

const getOrganizationReport = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo, department, category } = req.query;
  const report = await reportService.getOrganizationReport(req.user.organizationId, {
    dateFrom,
    dateTo,
    department,
    category,
  });
  res.status(200).json(report);
});

module.exports = { getOrganizationReport };
