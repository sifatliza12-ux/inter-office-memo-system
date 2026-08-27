const asyncHandler = require('../utils/asyncHandler');
const auditService = require('../services/audit.service');

const listAuditLogs = asyncHandler(async (req, res) => {
  const { eventType, userId, dateFrom, dateTo, page, limit } = req.query;
  const result = await auditService.listAuditLogs(req.user.organizationId, {
    eventType,
    userId,
    dateFrom,
    dateTo,
    page,
    limit,
  });
  res.status(200).json(result);
});

module.exports = { listAuditLogs };
