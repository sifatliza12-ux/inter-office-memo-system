const MemoVersion = require('../models/MemoVersion');

// Snapshots the memo's CURRENT content fields into a new immutable
// MemoVersion at versionNumber `memo.currentVersionNumber`. Callers are
// responsible for setting memo.currentVersionNumber to the version being
// snapshotted and saving the memo BEFORE calling this, so a version only
// ever exists for a memo state that was actually persisted — see
// memo.service.js's submitMemo and workflow.service.js's resubmitMemo.
const snapshotMemoVersion = (memo, requestingUserId) =>
  MemoVersion.create({
    memoId: memo._id,
    organizationId: memo.organizationId,
    versionNumber: memo.currentVersionNumber,
    subject: memo.subject,
    body: memo.body,
    category: memo.category,
    priority: memo.priority,
    departmentId: memo.departmentId,
    createdBy: requestingUserId,
  });

const listVersions = (memoId) =>
  MemoVersion.find({ memoId }).sort({ versionNumber: 1 }).populate('createdBy', 'name');

module.exports = { snapshotMemoVersion, listVersions };
