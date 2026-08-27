const AuditLog = require('../models/AuditLog');

// The single place that ever writes an AuditLog, used by every service that
// needs to record a significant event (auth, memo, workflow, comment,
// attachment, user/organization administration). Same resilience pattern as
// Stage 7's createNotification: a logging failure must never fail the
// action that triggered it, so this always resolves — never rejects —
// logging the error instead of throwing it.
const logAuditEvent = async ({ organizationId, userId, eventType, description }) => {
  try {
    await AuditLog.create({ organizationId, userId, eventType, description });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to write audit log:', error);
  }
};

// Same pagination shape as Stage 8's memo search: page/limit/total, newest
// first. Always scoped by organizationId — an admin must never be able to
// widen this query to see another organization's audit trail, regardless of
// what filters are supplied.
const listAuditLogs = async (organizationId, { eventType, userId, dateFrom, dateTo, page, limit } = {}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 20);

  const filter = { organizationId };

  if (eventType) {
    filter.eventType = eventType;
  }
  if (userId) {
    filter.userId = userId;
  }
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) {
      filter.createdAt.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      filter.createdAt.$lte = new Date(dateTo);
    }
  }

  const [auditLogs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('userId', 'name'),
    AuditLog.countDocuments(filter),
  ]);

  return { auditLogs, total, page: pageNum, limit: limitNum };
};

module.exports = { logAuditEvent, listAuditLogs };
