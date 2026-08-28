const mongoose = require('mongoose');

const { Schema } = mongoose;

// General event log — the shape faculty feedback asked for ("there are no
// separate Reviewer and Approver step types... every step can simply be a
// comment/action... even an approval is a comment in reality"). Written
// ALONGSIDE WorkflowStep, not instead of it, for this stage — see Stage
// 13b. Immutable: no PATCH/DELETE route is ever wired up for this model,
// same pattern as AuditLog and MemoVersion.
const workflowActionSchema = new Schema(
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
    // Which MemoVersion (Stage 13a's memo.currentVersionNumber) was current
    // at the moment this action happened.
    versionNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    actor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // MEMO_SUBMITTED / APPROVED / DECLINED / CHANGES_REQUESTED / RESUBMITTED
    // / PARTICIPANT_ADDED are the events Stage 5/13a already produce via
    // WorkflowStep. Stage 13c will add REDIRECTED and PARTICIPANT_REMOVED
    // for actions with no WorkflowStep equivalent at all — not implemented
    // yet, do not add them early.
    action: {
      type: String,
      required: true,
      enum: ['MEMO_SUBMITTED', 'APPROVED', 'DECLINED', 'CHANGES_REQUESTED', 'RESUBMITTED', 'PARTICIPANT_ADDED'],
    },
    comment: {
      type: String,
      trim: true,
    },
    // Who the memo went to as a result of this action, where applicable —
    // unset for actions with no resulting recipient (a final approval, a
    // decline, or a request-changes, all of which either finish or pause
    // the workflow rather than hand it to someone).
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

workflowActionSchema.index({ memoId: 1, createdAt: 1 });

module.exports = mongoose.model('WorkflowAction', workflowActionSchema);
