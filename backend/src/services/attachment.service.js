const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const Attachment = require('../models/Attachment');
const Memo = require('../models/Memo');
const WorkflowStep = require('../models/WorkflowStep');
const ApiError = require('../utils/ApiError');

// Overridable so the test suite can point this at its own throwaway
// directory instead of the real backend/uploads/ — otherwise the test
// suite's own cleanup (tests/setup.js) would delete the same directory a
// concurrently running dev server writes into, which is exactly what caused
// an ENOENT there in practice.
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Each allowed extension maps to the mimetype we record and the magic-byte
// signature its actual file content must start with — the client-supplied
// extension and declared Content-Type are never trusted on their own.
// doc/xls (legacy binary Office formats) share the same outer OLE container
// signature and can't be told apart from bytes alone without full parsing;
// docx/xlsx are both zip-based (OOXML) and share the zip local-file-header
// signature for the same reason. This is the practical limit of signature
// checking without a full format parser — noted, not silently assumed away.
const ALLOWED_TYPES = {
  pdf: { mimetype: 'application/pdf', signature: [0x25, 0x50, 0x44, 0x46] },
  doc: { mimetype: 'application/msword', signature: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
  xls: { mimetype: 'application/vnd.ms-excel', signature: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
  docx: {
    mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    signature: [0x50, 0x4b, 0x03, 0x04],
  },
  xlsx: {
    mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    signature: [0x50, 0x4b, 0x03, 0x04],
  },
  png: { mimetype: 'image/png', signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  jpg: { mimetype: 'image/jpeg', signature: [0xff, 0xd8, 0xff] },
  jpeg: { mimetype: 'image/jpeg', signature: [0xff, 0xd8, 0xff] },
};

const bufferStartsWith = (buffer, signature) =>
  buffer.length >= signature.length && signature.every((byte, index) => buffer[index] === byte);

// Returns the validated { ext, mimetype } only if BOTH the extension is on
// the allowlist AND the actual file bytes match that type's signature —
// either one alone is not trusted.
const detectAllowedType = (originalname, buffer) => {
  const ext = path.extname(originalname || '').toLowerCase().replace(/^\./, '');
  const spec = ALLOWED_TYPES[ext];
  if (!spec || !bufferStartsWith(buffer, spec.signature)) {
    return null;
  }
  return { ext, mimetype: spec.mimetype };
};

const findMemoInOrg = async (organizationId, id) => {
  const memo = await Memo.findOne({ _id: id, organizationId });
  if (!memo) {
    throw new ApiError(404, 'Memo not found');
  }
  return memo;
};

// Same rule as Stage 7's comments: the author, or anyone holding ANY
// WorkflowStep on this memo regardless of status. Independently
// re-verified here — never trusted from a client claim.
const assertCanAccessAttachments = async (memo, requestingUserId) => {
  if (memo.authorId.toString() === String(requestingUserId)) {
    return;
  }
  const step = await WorkflowStep.findOne({ memoId: memo._id, userId: requestingUserId });
  if (!step) {
    throw new ApiError(403, "You do not have access to this memo's attachments");
  }
};

const assertCanDeleteAttachment = (memo, attachment, requestingUserId) => {
  const isUploader = attachment.uploadedBy.toString() === String(requestingUserId);
  const isAuthor = memo.authorId.toString() === String(requestingUserId);
  if (!isUploader && !isAuthor) {
    throw new ApiError(403, 'Only the uploader or the memo author may delete this attachment');
  }
};

const uploadAttachment = async (organizationId, memoId, requestingUserId, file) => {
  const memo = await findMemoInOrg(organizationId, memoId);
  await assertCanAccessAttachments(memo, requestingUserId);

  if (!file) {
    throw new ApiError(400, 'A file is required');
  }

  const detected = detectAllowedType(file.originalname, file.buffer);
  if (!detected) {
    throw new ApiError(
      400,
      `File type not allowed. Accepted types: ${Object.keys(ALLOWED_TYPES).join(', ')}`
    );
  }

  // Random, server-generated name — never the client-supplied original
  // filename — so it can't be used for path traversal or to collide with
  // another upload.
  const storedFilename = `${crypto.randomUUID()}.${detected.ext}`;
  const absolutePath = path.join(UPLOADS_DIR, storedFilename);
  // Re-ensured immediately before every write, not just once at module
  // load — self-healing against the directory having been removed after
  // the process started (by anything: a cleanup script, a volume reset),
  // rather than only working the first time and failing with ENOENT ever
  // after.
  await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.promises.writeFile(absolutePath, file.buffer);

  try {
    return await Attachment.create({
      memoId: memo._id,
      organizationId,
      filename: file.originalname,
      storedFilename,
      size: file.size,
      mimetype: detected.mimetype,
      uploadedBy: requestingUserId,
    });
  } catch (error) {
    // Don't leave an orphaned file on disk if the DB record failed.
    await fs.promises.unlink(absolutePath).catch(() => {});
    throw error;
  }
};

const listAttachments = async (organizationId, memoId, requestingUserId) => {
  const memo = await findMemoInOrg(organizationId, memoId);
  await assertCanAccessAttachments(memo, requestingUserId);

  // storedFilename is excluded here — no legitimate client use for it, and
  // the download endpoint below never accepts one as input anyway, so there
  // is no reason for an authorized client to ever see the raw storage path.
  return Attachment.find({ memoId: memo._id })
    .select('-storedFilename')
    .sort({ createdAt: 1 })
    .populate('uploadedBy', 'name');
};

// The download path is always derived from the attachment record the
// caller was just authorized to see — never from anything in the request
// URL directly — so there is no way to reach a file by guessing or
// constructing a storedFilename/path.
const getAttachmentForDownload = async (organizationId, memoId, attachmentId, requestingUserId) => {
  const memo = await findMemoInOrg(organizationId, memoId);
  await assertCanAccessAttachments(memo, requestingUserId);

  const attachment = await Attachment.findOne({ _id: attachmentId, memoId: memo._id });
  if (!attachment) {
    throw new ApiError(404, 'Attachment not found');
  }

  return { attachment, absolutePath: path.join(UPLOADS_DIR, attachment.storedFilename) };
};

const deleteAttachment = async (organizationId, memoId, attachmentId, requestingUserId) => {
  const memo = await findMemoInOrg(organizationId, memoId);

  const attachment = await Attachment.findOne({ _id: attachmentId, memoId: memo._id });
  if (!attachment) {
    throw new ApiError(404, 'Attachment not found');
  }

  assertCanDeleteAttachment(memo, attachment, requestingUserId);

  await attachment.deleteOne();

  const absolutePath = path.join(UPLOADS_DIR, attachment.storedFilename);
  await fs.promises.unlink(absolutePath).catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to remove attachment file from disk:', error);
  });
};

module.exports = {
  ALLOWED_TYPES,
  uploadAttachment,
  listAttachments,
  getAttachmentForDownload,
  deleteAttachment,
};
