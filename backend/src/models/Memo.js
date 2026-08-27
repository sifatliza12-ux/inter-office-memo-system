const mongoose = require('mongoose');

const { Schema } = mongoose;

const memoSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ['general', 'policy', 'announcement', 'request', 'report'],
      default: 'general',
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    status: {
      type: String,
      enum: ['draft', 'pending', 'in_review', 'approved', 'rejected', 'published'],
      default: 'draft',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Memo', memoSchema);
