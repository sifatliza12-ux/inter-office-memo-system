const express = require('express');

const notificationController = require('../controllers/notification.controller');
const protect = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/unread-count', notificationController.getUnreadCount);
router.get('/', notificationController.listNotifications);
router.patch('/read-all', notificationController.markAllAsRead);
router.patch('/:id/read', notificationController.markAsRead);

module.exports = router;
