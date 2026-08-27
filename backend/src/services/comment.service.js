const Comment = require('../models/Comment');
const Memo = require('../models/Memo');
const WorkflowStep = require('../models/WorkflowStep');
const ApiError = require('../utils/ApiError');
const { notifyNewComment } = require('./notification.service');
const { logAuditEvent } = require('./audit.service');

const MAX_COMMENT_LENGTH = 5000;

const findMemoInOrg = async (organizationId, id) => {
  const memo = await Memo.findOne({ _id: id, organizationId });
  if (!memo) {
    throw new ApiError(404, 'Memo not found');
  }
  return memo;
};

// Same authorization rule as Stage 5's add-participant check: the author, or
// anyone holding ANY WorkflowStep on this memo regardless of status (past,
// current, or future participant). Independently re-verified here — never
// trusted from a client claim. A same-org user with no relationship to the
// memo gets 403, matching memo detail / workflow history.
const assertCanAccessComments = async (memo, requestingUserId) => {
  if (memo.authorId.toString() === String(requestingUserId)) {
    return;
  }

  const step = await WorkflowStep.findOne({ memoId: memo._id, userId: requestingUserId });
  if (!step) {
    throw new ApiError(403, "You do not have access to this memo's comments");
  }
};

const createComment = async (organizationId, memoId, requestingUserId, text) => {
  const memo = await findMemoInOrg(organizationId, memoId);
  await assertCanAccessComments(memo, requestingUserId);

  const trimmed = text ? String(text).trim() : '';
  if (!trimmed) {
    throw new ApiError(400, 'Comment text is required');
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    throw new ApiError(400, `Comment text must be at most ${MAX_COMMENT_LENGTH} characters`);
  }

  const comment = await Comment.create({ memoId: memo._id, authorId: requestingUserId, text: trimmed });

  // Notify everyone with a WorkflowStep on this memo (any status), plus the
  // memo's author even if the author never became a participant themselves,
  // except the commenter — never notify someone about their own comment.
  const participantIds = await WorkflowStep.find({ memoId: memo._id }).distinct('userId');
  const recipientIds = [...new Set([...participantIds.map(String), memo.authorId.toString()])].filter(
    (id) => id !== String(requestingUserId)
  );
  await notifyNewComment(memo, recipientIds);

  await logAuditEvent({
    organizationId,
    userId: requestingUserId,
    eventType: 'COMMENT_ADDED',
    description: `A comment was added to memo ${memo.referenceNumber} ("${memo.subject}").`,
  });

  return comment.populate('authorId', 'name');
};

const listComments = async (organizationId, memoId, requestingUserId) => {
  const memo = await findMemoInOrg(organizationId, memoId);
  await assertCanAccessComments(memo, requestingUserId);

  return Comment.find({ memoId: memo._id }).sort({ createdAt: 1 }).populate('authorId', 'name');
};

module.exports = { createComment, listComments };
