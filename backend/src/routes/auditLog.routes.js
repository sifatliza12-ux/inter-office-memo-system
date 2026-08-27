const express = require('express');

const auditLogController = require('../controllers/auditLog.controller');
const protect = require('../middleware/auth');
const authorize = require('../middleware/role');

const router = express.Router();

// Admin-only, tenant-scoped, read-only by design — no POST/PATCH/DELETE
// route is ever registered here, so a request to one 404s (the route
// simply doesn't exist) rather than 403ing past an authorization check.
router.use(protect, authorize('admin'));

router.get('/', auditLogController.listAuditLogs);

module.exports = router;
