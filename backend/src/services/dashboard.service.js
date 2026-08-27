const mongoose = require('mongoose');

const Memo = require('../models/Memo');
const WorkflowStep = require('../models/WorkflowStep');
const User = require('../models/User');
const Department = require('../models/Department');

// The five workflow statuses actually reachable in practice (Stage 4/5) —
// 'pending'/'in_review'/'published' are unused Stage-1 placeholder enum
// values with no code path that ever sets them, so they're left out of every
// by-status breakdown rather than reported as permanent zeroes.
const TRACKED_STATUSES = ['draft', 'submitted', 'changes_requested', 'approved', 'rejected'];

const ACTIONED_STEP_STATUSES = ['approved', 'rejected', 'changes_requested'];

const zeroFilledStatusCounts = (aggregateRows) => {
  const counts = TRACKED_STATUSES.reduce((accumulator, status) => {
    accumulator[status] = 0;
    return accumulator;
  }, {});

  aggregateRows.forEach((row) => {
    if (Object.prototype.hasOwnProperty.call(counts, row._id)) {
      counts[row._id] = row.count;
    }
  });

  return counts;
};

// req.user.organizationId/id arrive as strings (decoded straight off the
// JWT) — fine for .find()/.countDocuments(), which cast automatically, but
// .aggregate() does not cast its $match stage, so status-breakdown queries
// need explicit ObjectIds or they would silently match nothing.
const toObjectId = (id) => new mongoose.Types.ObjectId(id);

const getUserDashboard = async (organizationId, userId) => {
  const [inboxCount, myMemosCount, myMemosByStatusRows, authoredMemoIds] = await Promise.all([
    Memo.countDocuments({ organizationId, currentApproverId: userId }),
    Memo.countDocuments({ organizationId, authorId: userId }),
    Memo.aggregate([
      { $match: { organizationId: toObjectId(organizationId), authorId: toObjectId(userId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Memo.distinct('_id', { organizationId, authorId: userId }),
  ]);

  // Recent activity: WorkflowStep actions performed BY this user, or taken
  // on a memo this user authored — nothing else. A step matching `userId` is
  // always already scoped to this user's own organization by construction
  // (workflow participants are asserted to belong to the same org as the
  // memo's author, both at create and at submit time — see
  // assertParticipantsBelongToOrg in memo.service.js), so no separate
  // organizationId filter is needed on that branch; the authored-memo branch
  // is scoped explicitly via authoredMemoIds above.
  const recentActivitySteps = await WorkflowStep.find({
    status: { $in: ACTIONED_STEP_STATUSES },
    $or: [{ userId }, { memoId: { $in: authoredMemoIds } }],
  })
    .sort({ actionDate: -1 })
    .limit(10)
    .populate('userId', 'name')
    .populate('memoId', 'referenceNumber subject');

  const recentActivity = recentActivitySteps.map((step) => ({
    memoId: step.memoId?._id,
    referenceNumber: step.memoId?.referenceNumber,
    subject: step.memoId?.subject,
    action: step.status,
    actorName: step.userId?.name,
    date: step.actionDate,
  }));

  return {
    inboxCount,
    myMemosCount,
    myMemosByStatus: zeroFilledStatusCounts(myMemosByStatusRows),
    recentActivity,
  };
};

const getOrganizationDashboard = async (organizationId) => {
  const [totalUsers, activeUsers, totalDepartments, totalMemos, memosByStatusRows, pendingWorkflows] =
    await Promise.all([
      User.countDocuments({ organizationId }),
      User.countDocuments({ organizationId, status: 'active' }),
      Department.countDocuments({ organizationId }),
      Memo.countDocuments({ organizationId }),
      Memo.aggregate([
        { $match: { organizationId: toObjectId(organizationId) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Memo.countDocuments({ organizationId, status: { $in: ['submitted', 'changes_requested'] } }),
    ]);

  return {
    totalUsers,
    activeUsers,
    totalDepartments,
    totalMemos,
    memosByStatus: zeroFilledStatusCounts(memosByStatusRows),
    pendingWorkflows,
  };
};

module.exports = {
  getUserDashboard,
  getOrganizationDashboard,
  // Exported for reuse by Stage 10's report.service.js — same status
  // breakdown shape, same ObjectId-casting caveat for .aggregate() — rather
  // than duplicating them. Neither existing endpoint above is changed by
  // this export.
  TRACKED_STATUSES,
  zeroFilledStatusCounts,
  toObjectId,
};
