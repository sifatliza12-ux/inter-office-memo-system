const mongoose = require('mongoose');

const { Schema } = mongoose;

const workflowStepSchema = new Schema(
  {
    memoId: {
      type: Schema.Types.ObjectId,
      ref: 'Memo',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    stepOrder: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'changes_requested'],
      default: 'pending',
    },
    actionDate: {
      type: Date,
    },
    comment: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

workflowStepSchema.index({ memoId: 1, stepOrder: 1 }, { unique: true });

module.exports = mongoose.model('WorkflowStep', workflowStepSchema);
