const Organization = require('../models/Organization');
const Department = require('../models/Department');
const User = require('../models/User');
const memoService = require('./memo.service');
const workflowService = require('./workflow.service');
const commentService = require('./comment.service');
const attachmentService = require('./attachment.service');
const { generateMemoPdfBuffer } = require('./pdf.service');

// getMemoById runs first and throws 404/403 before any of the reads below
// ever happen. Each of getWorkflowHistory/listComments/listAttachments then
// independently re-verifies that exact same view-authorization rule (author,
// or any WorkflowStep holder, any status) on its own — matching this
// codebase's established defense-in-depth convention (no downstream read
// ever trusts that some earlier check already covered it).
const exportMemoPdf = async (organizationId, memoId, requestingUserId) => {
  const memo = await memoService.getMemoById(organizationId, memoId, requestingUserId);

  const [organization, department, author, participantUsers, workflowSteps, comments, attachments] =
    await Promise.all([
      Organization.findById(organizationId),
      memo.departmentId ? Department.findById(memo.departmentId) : Promise.resolve(null),
      User.findById(memo.authorId).select('name'),
      User.find({ _id: { $in: memo.workflowParticipants } }).select('name'),
      workflowService.getWorkflowHistory(organizationId, memoId, requestingUserId),
      commentService.listComments(organizationId, memoId, requestingUserId),
      attachmentService.listAttachments(organizationId, memoId, requestingUserId),
    ]);

  // memo.workflowParticipants order is the workflow's real step order (see
  // memo.service.js's createMemo/submitMemo) — resolved via a Map rather
  // than trusting User.find's $in result order, which MongoDB does not
  // guarantee.
  const nameById = new Map(participantUsers.map((user) => [user._id.toString(), user.name]));
  const participantNames = memo.workflowParticipants.map(
    (userId) => nameById.get(userId.toString()) || 'Unknown user'
  );

  const buffer = await generateMemoPdfBuffer({
    memo,
    organization,
    department,
    author,
    participantNames,
    workflowSteps,
    comments,
    attachments,
  });

  // referenceNumber is server-generated, but built in part from the
  // organization's client-supplied identifier (Stage 1 never constrained
  // its character set) — sanitized here before it reaches a
  // Content-Disposition header, rather than trusted as already safe.
  const safeReference = memo.referenceNumber.replace(/[^a-zA-Z0-9-]/g, '_');
  const filename = `${safeReference}.pdf`;

  return { buffer, filename };
};

module.exports = { exportMemoPdf };
