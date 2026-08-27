const express = require('express');

const authRoutes = require('./auth.routes');
const organizationRoutes = require('./organization.routes');
const departmentRoutes = require('./department.routes');
const userRoutes = require('./user.routes');
const directoryRoutes = require('./directory.routes');
const memoRoutes = require('./memo.routes');
const dashboardRoutes = require('./dashboard.routes');
const workflowStepRoutes = require('./workflowStep.routes');
const commentRoutes = require('./comment.routes');
const notificationRoutes = require('./notification.routes');
const auditLogRoutes = require('./auditLog.routes');
const reportRoutes = require('./report.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/organizations', organizationRoutes);
router.use('/departments', departmentRoutes);
router.use('/users', userRoutes);
router.use('/directory', directoryRoutes);
router.use('/memos', memoRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/workflow-steps', workflowStepRoutes);
router.use('/comments', commentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/reports', reportRoutes);

module.exports = router;
