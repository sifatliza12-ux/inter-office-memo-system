const PDFDocument = require('pdfkit');

// Every status the Memo model's enum actually reaches in practice (see
// dashboard.service.js's TRACKED_STATUSES for the same list) — each one
// mapped to an explicit, unambiguous label so a reader never has to infer
// "in progress" vs. "done" from context. This is the PRD's "visually
// unambiguous" requirement, satisfied via clear text rather than color.
const STATUS_LABELS = {
  draft: 'DRAFT',
  submitted: 'IN PROGRESS — submitted, awaiting approval',
  changes_requested: 'CHANGES REQUESTED',
  approved: 'APPROVED',
  rejected: 'REJECTED',
};

const WORKFLOW_ACTION_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  changes_requested: 'Changes Requested',
};

const formatDate = (date) => (date ? new Date(date).toLocaleString() : '—');

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const addSectionHeading = (doc, text) => {
  doc.moveDown(0.8);
  doc.fontSize(13).font('Helvetica-Bold').text(text);
  doc.fontSize(10).font('Helvetica');
  doc.moveDown(0.2);
};

const addKeyValue = (doc, key, value) => {
  doc.font('Helvetica-Bold').text(`${key}: `, { continued: true });
  doc.font('Helvetica').text(value === undefined || value === null || value === '' ? '—' : String(value));
};

const renderMemoPdf = (
  doc,
  { memo, organization, department, author, participantNames, workflowSteps, comments, attachments }
) => {
  doc.fontSize(18).font('Helvetica-Bold').text(organization.name, { align: 'center' });
  doc
    .fontSize(9)
    .font('Helvetica')
    .text(`Organization Identifier: ${organization.identifier}`, { align: 'center' });
  doc.moveDown(1);

  doc.fontSize(16).font('Helvetica-Bold').text('MEMORANDUM', { align: 'center' });
  doc.moveDown(1);

  doc.fontSize(10).font('Helvetica');
  addKeyValue(doc, 'Reference Number', memo.referenceNumber);
  addKeyValue(doc, 'Subject', memo.subject);
  addKeyValue(doc, 'Author', author ? author.name : 'Unknown');
  addKeyValue(doc, 'Department', department ? department.name : 'Unassigned');
  addKeyValue(doc, 'Category', memo.category);
  addKeyValue(doc, 'Priority', memo.priority);
  addKeyValue(doc, 'Date Created', formatDate(memo.createdAt));
  addKeyValue(doc, 'Date Submitted', formatDate(memo.submittedAt));

  doc.moveDown(0.5);
  doc
    .fontSize(12)
    .font('Helvetica-Bold')
    .text(`Status: ${STATUS_LABELS[memo.status] || String(memo.status).toUpperCase()}`);

  addSectionHeading(doc, 'Memo Body');
  doc.font('Helvetica').text(memo.body);

  addSectionHeading(doc, 'Workflow Participants');
  if (participantNames.length === 0) {
    doc.text('None.');
  } else {
    participantNames.forEach((name, index) => doc.text(`${index + 1}. ${name}`));
  }

  addSectionHeading(doc, 'Approval History');
  if (workflowSteps.length === 0) {
    doc.text('No workflow history.');
  } else {
    workflowSteps.forEach((step) => {
      const name = step.userId?.name || 'Unknown user';
      const action = WORKFLOW_ACTION_LABELS[step.status] || step.status;
      doc.font('Helvetica-Bold').text(`${name} — ${action}`, { continued: true });
      doc.font('Helvetica').text(`  (${formatDate(step.actionDate)})`);
      if (step.comment) {
        doc.font('Helvetica-Oblique').text(`"${step.comment}"`);
      }
      doc.font('Helvetica').moveDown(0.2);
    });
  }

  addSectionHeading(doc, 'Comments');
  if (comments.length === 0) {
    doc.text('No comments.');
  } else {
    comments.forEach((comment) => {
      const name = comment.authorId?.name || 'Unknown user';
      doc.font('Helvetica-Bold').text(`${name}`, { continued: true });
      doc.font('Helvetica').text(`  (${formatDate(comment.createdAt)})`);
      doc.text(comment.text);
      doc.moveDown(0.2);
    });
  }

  addSectionHeading(doc, 'Attachments');
  if (attachments.length === 0) {
    doc.text('No attachments.');
  } else {
    attachments.forEach((attachment) => {
      doc.text(`${attachment.filename} (${formatSize(attachment.size)})`);
    });
  }
};

// Buffered in memory rather than piped straight to the response — this is a
// generate-on-demand, never-persisted document at course-project scale, so
// the simplicity of "build the whole thing, then send one response with a
// correct Content-Length" outweighs the marginal benefit of streaming.
const generateMemoPdfBuffer = (data) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      renderMemoPdf(doc, data);
    } catch (error) {
      reject(error);
      return;
    }

    doc.end();
  });

module.exports = { generateMemoPdfBuffer };
