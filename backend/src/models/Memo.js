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
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
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
      enum: ['Administrative', 'Financial', 'Procurement', 'HR', 'Academic', 'Technical', 'General'],
      default: 'General',
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'pending', 'in_review', 'approved', 'rejected', 'published'],
      default: 'draft',
    },
    workflowParticipants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    referenceNumber: {
      type: String,
      required: true,
      trim: true,
    },
    submittedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

memoSchema.index({ organizationId: 1, referenceNumber: 1 }, { unique: true });

module.exports = mongoose.model('Memo', memoSchema);
