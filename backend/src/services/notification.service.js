const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');

// The single place that ever writes a Notification, used by workflow.service.js,
// memo.service.js, and comment.service.js. A notification failure must never
// fail the action that triggered it, so this always resolves — never
// rejects — logging the error instead of throwing it.
const createNotification = async ({ userId, memoId, title, message }) => {
  try {
    await Notification.create({ userId, memoId, title, message });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to create notification:', error);
  }
};

const memoLabel = (memo) => `${memo.referenceNumber} — ${memo.subject}`;

// Covers submit (first participant), an approve that advances to the next
// step, and resubmit (the re-appended participant) — the same situation
// ("it's now your turn") from three different triggering actions.
const notifyAwaitingApproval = (memo, userId) =>
  createNotification({
    userId,
    memoId: memo._id,
    title: 'Memo awaiting your approval',
    message: `${memoLabel(memo)} is awaiting your approval.`,
  });

const notifyFinalApproval = (memo) =>
  createNotification({
    userId: memo.authorId,
    memoId: memo._id,
    title: 'Memo approved',
    message: `${memoLabel(memo)} has been fully approved.`,
  });

const notifyRejected = (memo) =>
  createNotification({
    userId: memo.authorId,
    memoId: memo._id,
    title: 'Memo rejected',
    message: `${memoLabel(memo)} was rejected.`,
  });

const notifyChangesRequested = (memo) =>
  createNotification({
    userId: memo.authorId,
    memoId: memo._id,
    title: 'Changes requested on your memo',
    message: `${memoLabel(memo)}: changes were requested.`,
  });

const notifyParticipantAdded = (memo, userId) =>
  createNotification({
    userId,
    memoId: memo._id,
    title: 'Added to a memo workflow',
    message: `You were added to the approval workflow for ${memoLabel(memo)}.`,
  });

const notifyNewComment = (memo, recipientIds) =>
  Promise.all(
    recipientIds.map((userId) =>
      createNotification({
        userId,
        memoId: memo._id,
        title: 'New comment on a memo',
        message: `${memoLabel(memo)}: a new comment was posted.`,
      })
    )
  );

const listNotifications = async (userId, { unreadOnly } = {}) => {
  const filter = { userId };
  if (unreadOnly === 'true' || unreadOnly === true) {
    filter.isRead = false;
  }
  return Notification.find(filter).sort({ createdAt: -1 });
};

// Scoped by userId in the query itself (not just organizationId), matching
// this codebase's existing pattern of a single scoped findOne + 404 (e.g.
// findMemoInOrg) rather than fetching first and checking ownership after —
// this way a wrong-owner request and a nonexistent id are indistinguishable
// to the caller.
const markAsRead = async (userId, id) => {
  const notification = await Notification.findOne({ _id: id, userId });
  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }
  notification.isRead = true;
  await notification.save();
  return notification;
};

const markAllAsRead = async (userId) => {
  await Notification.updateMany({ userId, isRead: false }, { isRead: true });
};

const getUnreadCount = async (userId) => Notification.countDocuments({ userId, isRead: false });

module.exports = {
  createNotification,
  notifyAwaitingApproval,
  notifyFinalApproval,
  notifyRejected,
  notifyChangesRequested,
  notifyParticipantAdded,
  notifyNewComment,
  listNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
};
