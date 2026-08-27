const express = require('express');

const organizationRoutes = require('./organization.routes');
const departmentRoutes = require('./department.routes');
const userRoutes = require('./user.routes');
const memoRoutes = require('./memo.routes');
const workflowStepRoutes = require('./workflowStep.routes');
const commentRoutes = require('./comment.routes');
const notificationRoutes = require('./notification.routes');
const auditLogRoutes = require('./auditLog.routes');

const router = express.Router();

router.use('/organizations', organizationRoutes);
router.use('/departments', departmentRoutes);
router.use('/users', userRoutes);
router.use('/memos', memoRoutes);
router.use('/workflow-steps', workflowStepRoutes);
router.use('/comments', commentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/audit-logs', auditLogRoutes);

module.exports = router;
