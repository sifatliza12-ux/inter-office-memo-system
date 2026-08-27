const asyncHandler = require('../utils/asyncHandler');
const attachmentService = require('../services/attachment.service');

const uploadAttachment = asyncHandler(async (req, res) => {
  const attachment = await attachmentService.uploadAttachment(
    req.user.organizationId,
    req.params.id,
    req.user.id,
    req.file
  );
  res.status(201).json({ attachment });
});

const listAttachments = asyncHandler(async (req, res) => {
  const attachments = await attachmentService.listAttachments(
    req.user.organizationId,
    req.params.id,
    req.user.id
  );
  res.status(200).json({ attachments });
});

const downloadAttachment = asyncHandler(async (req, res) => {
  const { attachment, absolutePath } = await attachmentService.getAttachmentForDownload(
    req.user.organizationId,
    req.params.id,
    req.params.attachmentId,
    req.user.id
  );
  res.download(absolutePath, attachment.filename);
});

const deleteAttachment = asyncHandler(async (req, res) => {
  await attachmentService.deleteAttachment(
    req.user.organizationId,
    req.params.id,
    req.params.attachmentId,
    req.user.id
  );
  res.status(204).send();
});

module.exports = { uploadAttachment, listAttachments, downloadAttachment, deleteAttachment };
