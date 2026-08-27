const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notification.service');

const listNotifications = asyncHandler(async (req, res) => {
  const notifications = await notificationService.listNotifications(req.user.id, {
    unreadOnly: req.query.unreadOnly,
  });
  res.status(200).json({ notifications });
});

const markAsRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markAsRead(req.user.id, req.params.id);
  res.status(200).json({ notification });
});

const markAllAsRead = asyncHandler(async (req, res) => {
  await notificationService.markAllAsRead(req.user.id);
  res.status(200).json({ message: 'All notifications marked as read' });
});

const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await notificationService.getUnreadCount(req.user.id);
  res.status(200).json({ count });
});

module.exports = { listNotifications, markAsRead, markAllAsRead, getUnreadCount };
