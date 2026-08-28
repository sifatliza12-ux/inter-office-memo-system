const multer = require('multer');

const ApiError = require('../utils/ApiError');

// 10MB, per the Stage 8 spec. Enforced by multer itself, before a single
// byte reaches attachment.service.js — an oversized upload never gets far
// enough to be buffered in memory or written to disk.
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_SIZE_MB = 10;

// Memory storage: the file only ever gets uploaded to Supabase Storage
// (Stage 8b) after attachment.service.js has validated its actual content
// (magic bytes), not just its extension/declared Content-Type. An invalid
// upload never leaves this process, let alone reaches storage.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

// multer's own errors (e.g. LIMIT_FILE_SIZE) aren't ApiError instances and
// have no statusCode, so left alone they'd fall through to the generic
// error handler as a 500. This translates them into a clean 400 instead.
const uploadSingleFile = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) {
      return next();
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new ApiError(400, `File exceeds the maximum allowed size of ${MAX_FILE_SIZE_MB}MB`));
    }
    return next(new ApiError(400, err.message || 'File upload failed'));
  });
};

module.exports = { uploadSingleFile, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB };
