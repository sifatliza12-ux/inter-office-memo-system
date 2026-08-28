const path = require('path');
const crypto = require('crypto');

const Attachment = require('../models/Attachment');
const Memo = require('../models/Memo');
const WorkflowStep = require('../models/WorkflowStep');
const ApiError = require('../utils/ApiError');
const { logAuditEvent } = require('./audit.service');
const { getSupabaseClient, getSupabaseBucket } = require('../config/supabaseClient');

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
// re-verified here — never trusted from a client claim. Unchanged from
// Stage 8 — the storage backend change below never touches this.
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
  // another upload. Nested under organizationId/memoId in the bucket:
  // storedFilename is the FULL Supabase Storage object key (not just the
  // random leaf name), stored as-is in the DB so download/delete never
  // need to reconstruct it from separate pieces.
  const storedFilename = `${organizationId}/${memo._id}/${crypto.randomUUID()}.${detected.ext}`;

  const supabase = getSupabaseClient();
  const bucket = getSupabaseBucket();
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storedFilename, file.buffer, { contentType: detected.mimetype, upsert: false });
  if (uploadError) {
    throw new ApiError(502, `Failed to upload attachment to storage: ${uploadError.message}`);
  }

  let attachment;
  try {
    attachment = await Attachment.create({
      memoId: memo._id,
      organizationId,
      filename: file.originalname,
      storedFilename,
      size: file.size,
      mimetype: detected.mimetype,
      uploadedBy: requestingUserId,
    });
  } catch (error) {
    // Don't leave an orphaned object in storage if the DB record failed.
    await supabase.storage.from(bucket).remove([storedFilename]).catch(() => {});
    throw error;
  }

  await logAuditEvent({
    organizationId,
    userId: requestingUserId,
    eventType: 'ATTACHMENT_UPLOADED',
    description: `File "${file.originalname}" was uploaded to memo ${memo.referenceNumber} ("${memo.subject}").`,
  });

  return attachment;
};

const listAttachments = async (organizationId, memoId, requestingUserId) => {
  const memo = await findMemoInOrg(organizationId, memoId);
  await assertCanAccessAttachments(memo, requestingUserId);

  // storedFilename is excluded here — no legitimate client use for it, and
  // the download endpoint below never accepts one as input anyway, so there
  // is no reason for an authorized client to ever see the raw storage key.
  return Attachment.find({ memoId: memo._id })
    .select('-storedFilename')
    .sort({ createdAt: 1 })
    .populate('uploadedBy', 'name');
};

// Authorization happens first, exactly as in Stage 8, before any storage
// access is even attempted — a 403/404 here means Supabase is never
// touched. Once authorized, the object is fetched server-side (using the
// service-role client) and its bytes returned directly, rather than handing
// the client any kind of URL (signed or otherwise) — see the "download
// approach" note in the Stage 8b report for why proxying bytes was chosen
// over a short-lived signed URL: it means the authorization check runs on
// every single byte-serving request, with no window at all — not even a
// short one — where a captured/cached URL could work on its own.
const getAttachmentForDownload = async (organizationId, memoId, attachmentId, requestingUserId) => {
  const memo = await findMemoInOrg(organizationId, memoId);
  await assertCanAccessAttachments(memo, requestingUserId);

  const attachment = await Attachment.findOne({ _id: attachmentId, memoId: memo._id });
  if (!attachment) {
    throw new ApiError(404, 'Attachment not found');
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage.from(getSupabaseBucket()).download(attachment.storedFilename);
  if (error || !data) {
    throw new ApiError(502, `Failed to retrieve attachment from storage: ${error?.message || 'not found'}`);
  }

  // supabase-js's download() resolves a Blob (a browser-shaped API it
  // polyfills even under Node) — converted to a Buffer here so the
  // controller can res.send() it directly, same as Stage 8's res.download().
  const buffer = Buffer.from(await data.arrayBuffer());

  return { attachment, buffer };
};

const deleteAttachment = async (organizationId, memoId, attachmentId, requestingUserId) => {
  const memo = await findMemoInOrg(organizationId, memoId);

  const attachment = await Attachment.findOne({ _id: attachmentId, memoId: memo._id });
  if (!attachment) {
    throw new ApiError(404, 'Attachment not found');
  }

  assertCanDeleteAttachment(memo, attachment, requestingUserId);

  await attachment.deleteOne();

  await logAuditEvent({
    organizationId,
    userId: requestingUserId,
    eventType: 'ATTACHMENT_DELETED',
    description: `File "${attachment.filename}" was deleted from memo ${memo.referenceNumber} ("${memo.subject}").`,
  });

  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(getSupabaseBucket()).remove([attachment.storedFilename]);
  if (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to remove attachment object from storage:', error);
  }
};

module.exports = {
  ALLOWED_TYPES,
  uploadAttachment,
  listAttachments,
  getAttachmentForDownload,
  deleteAttachment,
};
