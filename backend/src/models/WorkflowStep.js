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
      // 'removed' (Stage 13c) means this step was cancelled by
      // remove-participant BEFORE the participant ever acted — distinct
      // from 'rejected', which means they actively declined. A step is
      // never deleted, only ever transitioned to a terminal status, so
      // this always represents genuine history.
      enum: ['pending', 'approved', 'rejected', 'changes_requested', 'removed'],
      default: 'pending',
    },
    actionDate: {
      type: Date,
    },
    comment: {
      type: String,
      trim: true,
    },
    // Pre-Stage-3: purely descriptive metadata the participant sets for
    // themselves (e.g. "Legal Advisor") — never read by any authorization,
    // ordering, or workflow-decision logic. Normalized (trimmed, empty ->
    // unset) by workflow.service.js's setMyRoleLabel before it ever reaches
    // this field.
    roleLabel: {
      type: String,
      trim: true,
      maxlength: 100,
    },
  },
  { timestamps: true }
);

workflowStepSchema.index({ memoId: 1, stepOrder: 1 }, { unique: true });

module.exports = mongoose.model('WorkflowStep', workflowStepSchema);
