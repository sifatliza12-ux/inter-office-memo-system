const WorkflowAction = require('../models/WorkflowAction');

// The ONLY place that ever creates a WorkflowAction document — see Stage
// 13b. Same resilience pattern as Stage 7's createNotification and Stage
// 9's logAuditEvent: a failure here must never fail the workflow action
// that triggered it, so this always resolves, never rejects — logging the
// error instead of throwing it. Callers can therefore just `await` this
// with no try/catch of their own, exactly like every existing
// logAuditEvent/notify* call site already does.
const recordWorkflowAction = async ({ memoId, organizationId, versionNumber, actor, action, comment, recipient }) => {
  try {
    await WorkflowAction.create({
      memoId,
      organizationId,
      versionNumber,
      actor,
      action,
      comment: comment || undefined,
      recipient: recipient || undefined,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to record workflow action:', error);
  }
};

const listActions = (memoId) =>
  WorkflowAction.find({ memoId }).sort({ createdAt: 1 }).populate('actor', 'name').populate('recipient', 'name');

module.exports = { recordWorkflowAction, listActions };
