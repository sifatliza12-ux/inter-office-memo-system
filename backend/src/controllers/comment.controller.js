const asyncHandler = require('../utils/asyncHandler');
const commentService = require('../services/comment.service');

const createComment = asyncHandler(async (req, res) => {
  const comment = await commentService.createComment(
    req.user.organizationId,
    req.params.id,
    req.user.id,
    req.body.text
  );
  res.status(201).json({ comment });
});

const listComments = asyncHandler(async (req, res) => {
  const comments = await commentService.listComments(req.user.organizationId, req.params.id, req.user.id);
  res.status(200).json({ comments });
});

module.exports = { createComment, listComments };
