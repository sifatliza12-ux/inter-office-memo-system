const Memo = require('../models/Memo');
const WorkflowStep = require('../models/WorkflowStep');
const WorkflowAction = require('../models/WorkflowAction');
const Department = require('../models/Department');
const { zeroFilledStatusCounts, toObjectId } = require('./dashboard.service');

// Same enum as Memo.js's category field — duplicated locally rather than
// imported, matching dashboard.service.js's own TRACKED_STATUSES precedent
// of keeping a small, local, explicit list rather than reaching into
// memo.service.js's private constants.
const CATEGORIES = ['Administrative', 'Financial', 'Procurement', 'HR', 'Academic', 'Technical', 'General'];
const MS_PER_HOUR = 1000 * 60 * 60;

const zeroFilledCategoryCounts = (aggregateRows) => {
  const counts = CATEGORIES.reduce((accumulator, category) => {
    accumulator[category] = 0;
    return accumulator;
  }, {});

  aggregateRows.forEach((row) => {
    if (Object.prototype.hasOwnProperty.call(counts, row._id)) {
      counts[row._id] = row.count;
    }
  });

  return counts;
};

// Plain filter object, usable directly with .find()/.countDocuments()/
// .distinct() (which cast string ids automatically). dateFrom/dateTo always
// filter by Memo.createdAt — including for averageWorkflowCompletionTime
// below, which is otherwise about submittedAt/finalApprovedAt — so every
// field in the report is scoped by the same "memos created in this window"
// definition, not a mix of different date meanings.
const buildMemoFilter = (organizationId, { dateFrom, dateTo, department, category } = {}) => {
  const filter = { organizationId };

  if (department) {
    filter.departmentId = department;
  }
  if (category) {
    filter.category = category;
  }
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) {
      filter.createdAt.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      filter.createdAt.$lte = new Date(dateTo);
    }
  }

  return filter;
};

// .aggregate()'s $match stage doesn't cast strings to ObjectIds the way
// .find()/.countDocuments() do (see dashboard.service.js's toObjectId
// comment) — organizationId and departmentId are the only ObjectId-typed
// fields this filter can contain, so those are the only two that need it.
const toAggregateMatch = (filter) => {
  const match = { ...filter };
  match.organizationId = toObjectId(match.organizationId);
  if (match.departmentId) {
    match.departmentId = toObjectId(match.departmentId);
  }
  return match;
};

const getOrganizationReport = async (organizationId, { dateFrom, dateTo, department, category } = {}) => {
  const filter = buildMemoFilter(organizationId, { dateFrom, dateTo, department, category });
  const matchStage = toAggregateMatch(filter);

  const [
    statusRows,
    departmentRows,
    categoryRows,
    urgentMemoCount,
    pendingApprovalsCount,
    rejectedCount,
    matchingMemoIds,
    completionAgg,
    departments,
  ] = await Promise.all([
    Memo.aggregate([{ $match: matchStage }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Memo.aggregate([{ $match: matchStage }, { $group: { _id: '$departmentId', count: { $sum: 1 } } }]),
    Memo.aggregate([{ $match: matchStage }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
    Memo.countDocuments({ ...filter, priority: 'urgent' }),
    Memo.countDocuments({ ...filter, status: { $in: ['submitted', 'changes_requested'] } }),
    Memo.countDocuments({ ...filter, status: 'rejected' }),
    // Lightweight — only ids, never full documents — used below to scope
    // the WorkflowStep count to memos matching the filter without a
    // $lookup pipeline, the same "resolve ids on one collection, $in on
    // the other" idiom Stage 8's search already established.
    Memo.distinct('_id', filter),
    // $group with zero input documents (nothing matched $match) produces
    // zero output groups — completionAgg is [] in that case, which is how
    // "no completed memos matched" is distinguished from "average was 0".
    Memo.aggregate([
      { $match: { ...matchStage, status: 'approved' } },
      {
        $group: {
          _id: null,
          avgMs: { $avg: { $subtract: ['$finalApprovedAt', '$submittedAt'] } },
        },
      },
    ]),
    Department.find({ organizationId }).select('name'),
  ]);

  // A memo sent back twice has two separate 'changes_requested'
  // WorkflowStep documents (Stage 5/6: each request-changes/resubmit cycle
  // appends a fresh step, never reuses one) — counting WorkflowStep rows
  // directly, not memos, is what makes this counter measure how often
  // changes were requested rather than how many memos are currently
  // sitting in that status (that's memosByStatus.changes_requested).
  // Stage 13e: WorkflowAction counts, scoped by the same matchingMemoIds
  // idiom as changeRequestCount above — a redirect and a decline-redirect
  // are both "the memo got routed somewhere other than the normal next
  // step," so they're counted together under one metric.
  const [changeRequestCount, redirectCount, participantRemovalCount] = await Promise.all([
    WorkflowStep.countDocuments({
      memoId: { $in: matchingMemoIds },
      status: 'changes_requested',
    }),
    WorkflowAction.countDocuments({
      memoId: { $in: matchingMemoIds },
      action: { $in: ['REDIRECTED', 'DECLINED_REDIRECTED'] },
    }),
    WorkflowAction.countDocuments({
      memoId: { $in: matchingMemoIds },
      action: 'PARTICIPANT_REMOVED',
    }),
  ]);

  const departmentNameById = new Map(departments.map((dept) => [dept._id.toString(), dept.name]));
  const memosByDepartment = departmentRows.map((row) => ({
    department: row._id ? departmentNameById.get(row._id.toString()) || 'Unknown department' : 'Unassigned',
    count: row.count,
  }));

  const averageWorkflowCompletionTime =
    completionAgg.length > 0 ? completionAgg[0].avgMs / MS_PER_HOUR : null;

  return {
    memosByStatus: zeroFilledStatusCounts(statusRows),
    memosByDepartment,
    memosByCategory: zeroFilledCategoryCounts(categoryRows),
    urgentMemoCount,
    pendingApprovalsCount,
    rejectedCount,
    changeRequestCount,
    averageWorkflowCompletionTime,
    redirectCount,
    participantRemovalCount,
  };
};

module.exports = { getOrganizationReport };
