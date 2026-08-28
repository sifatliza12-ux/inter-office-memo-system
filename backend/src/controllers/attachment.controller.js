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
  const { attachment, buffer } = await attachmentService.getAttachmentForDownload(
    req.user.organizationId,
    req.params.id,
    req.params.attachmentId,
    req.user.id
  );
  // res.attachment() (not a hand-built Content-Disposition string) so the
  // user-supplied original filename goes through Express's own
  // content-disposition encoding/escaping — the same header-injection
  // safety res.download() gave for free in Stage 8, now that there's no
  // local file for res.download() itself to serve.
  res.attachment(attachment.filename);
  res.type(attachment.mimetype);
  res.send(buffer);
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
