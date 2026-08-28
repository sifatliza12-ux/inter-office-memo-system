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
    // Full Supabase Storage object key the file actually lives under
    // ({organizationId}/{memoId}/{randomizedName}, Stage 8b) — never
    // derived from user input, so it can't be used for path traversal or
    // to collide with another upload. Formerly a local disk filename
    // (Stage 8); the field wasn't renamed since its role — the opaque
    // server-side storage locator, never exposed to clients — is unchanged.
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
