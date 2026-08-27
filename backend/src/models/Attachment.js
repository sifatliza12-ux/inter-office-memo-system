const mongoose = require('mongoose');

const { Schema } = mongoose;

const attachmentSchema = new Schema(
  {
    memoId: {
      type: Schema.Types.ObjectId,
      ref: 'Memo',
      required: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    // Original, user-supplied filename — display only, never used to
    // construct a filesystem path.
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    // Random, server-generated filename the file is actually stored under
    // on disk (uploads/<storedFilename>) — never derived from user input,
    // so it can't be used for path traversal or to collide with another
    // upload.
    storedFilename: {
      type: String,
      required: true,
      unique: true,
    },
    size: {
      type: Number,
      required: true,
    },
    mimetype: {
      type: String,
      required: true,
      trim: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

attachmentSchema.index({ memoId: 1 });

module.exports = mongoose.model('Attachment', attachmentSchema);
