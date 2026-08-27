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
      enum: [
        'draft',
        'submitted',
        'changes_requested',
        'pending',
        'in_review',
        'approved',
        'rejected',
        'published',
      ],
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
    // Cache only — always derived from the WorkflowStep with status
    // 'pending' and the lowest stepOrder. Never trusted as ground truth for
    // authorization; recomputed and kept in sync by every workflow action.
    currentApproverId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    currentStepOrder: {
      type: Number,
    },
    // Set whenever currentApproverId is set to a new value (submit, an
    // approve that advances to the next step, resubmit) and cleared
    // whenever currentApproverId is cleared — never touched by anything
    // that doesn't change whose turn it is (e.g. add-participant). Powers
    // the Stage 6 inbox "age" column precisely, replacing the updatedAt
    // approximation used before this field existed.
    currentStepSince: {
      type: Date,
    },
    finalApproverId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    finalApprovedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

memoSchema.index({ organizationId: 1, referenceNumber: 1 }, { unique: true });

module.exports = mongoose.model('Memo', memoSchema);
