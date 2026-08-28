const mongoose = require('mongoose');

const { Schema } = mongoose;

// Immutable content snapshot, one per submit/resubmit — see Stage 13a. No
// route ever updates or deletes a MemoVersion, by anyone, including admins;
// that guarantee lives in there being no PATCH/DELETE route wired to this
// model at all, the same way AuditLog enforces immutability.
const memoVersionSchema = new Schema(
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
    versionNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    // Full copy of the memo's content fields at the moment this version was
    // created — values, never a live reference back to the Memo document.
    subject: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    priority: {
      type: String,
      required: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

memoVersionSchema.index({ memoId: 1, versionNumber: 1 }, { unique: true });

module.exports = mongoose.model('MemoVersion', memoVersionSchema);
