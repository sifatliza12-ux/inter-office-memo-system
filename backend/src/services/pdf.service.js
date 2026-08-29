const PDFDocument = require('pdfkit');

// Stage 4b — visual/branding pass only. The data this file receives (memo,
// organization, department, author, participantNames, workflowActions,
// comments, attachments) is unchanged from Stage 13e: workflowActions still
// comes from WorkflowAction via getMemoActions (export.service.js), not the
// older WorkflowStep-only history. Nothing here alters what is queried or
// how Approval History is assembled — only how it is laid out and colored.

// Brand layer (masthead, rules, reference number) — Stage 4a's blue +
// restrained-tangerine identity, not the workflow-status palette below.
const BRAND = {
  blue: '#1e3a8a', // blue-900
  tangerine: '#c2410c', // tangerine-700
  rule: '#d6d3d1', // stone-300
  textBody: '#1c1917', // stone-900
  textMuted: '#57534e', // stone-600 — darker than the screen's stone-400/500
  // muted tone so it stays legible on paper/photocopy, not just backlit glass.
};

// Workflow-event color mapping — same hue families as Stage 4a's Section 2
// (blue = progress, tangerine = friction/attention, slate = administrative),
// shifted to each family's darker end. Screen tones (e.g. tangerine-500)
// read fine backlit but measure too light for print/grayscale contrast; the
// PDF needs its own print-safe tier of the same palette, not the screen one.
const EVENT_COLORS = {
  MEMO_SUBMITTED: '#1d4ed8', // blue-700
  RESUBMITTED: '#1d4ed8', // blue-700
  APPROVED: '#1e3a8a', // blue-900
  REDIRECTED: '#1e40af', // blue-800
  CHANGES_REQUESTED: '#c2410c', // tangerine-700
  DECLINED_REDIRECTED: '#9a3412', // tangerine-800
  DECLINED: '#7c2d12', // tangerine-900
  PARTICIPANT_ADDED: '#475569', // slate-600
  PARTICIPANT_REMOVED: '#475569', // slate-600
};
const MINOR_EVENTS = new Set(['PARTICIPANT_ADDED', 'PARTICIPANT_REMOVED']);

const STATUS_COLORS = {
  draft: '#57534e',
  submitted: '#1d4ed8',
  changes_requested: '#c2410c',
  approved: '#1e3a8a',
  rejected: '#7c2d12',
};

// Every status the Memo model's enum actually reaches in practice (see
// dashboard.service.js's TRACKED_STATUSES for the same list) — each one
// mapped to an explicit, unambiguous label so a reader never has to infer
// "in progress" vs. "done" from context. This is the PRD's "visually
// unambiguous" requirement — satisfied via label text first (readable with
// zero color), color second.
const STATUS_LABELS = {
  draft: 'DRAFT',
  submitted: 'IN PROGRESS — submitted, awaiting approval',
  changes_requested: 'CHANGES REQUESTED',
  approved: 'APPROVED',
  rejected: 'REJECTED',
};

// Stage 13e: labels for WorkflowAction.action (Stage 13b/13c's more complete
// event log) — covers REDIRECTED/DECLINED_REDIRECTED/PARTICIPANT_REMOVED,
// which have no WorkflowStep-only equivalent. Unchanged this stage.
const WORKFLOW_ACTION_EVENT_LABELS = {
  MEMO_SUBMITTED: 'Submitted',
  RESUBMITTED: 'Resubmitted',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
  CHANGES_REQUESTED: 'Changes Requested',
  REDIRECTED: 'Redirected',
  DECLINED_REDIRECTED: 'Declined & Redirected',
  PARTICIPANT_ADDED: 'Participant Added',
  PARTICIPANT_REMOVED: 'Participant Removed',
};

const formatDate = (date) => (date ? new Date(date).toLocaleString() : '—');

// Matches the spec's "Aug 26 · 9:15 AM" timeline format — short date +
// separate time, joined with a middot, rather than one long localized
// timestamp string (kept for the header block via formatDate above).
const formatEventDate = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  const datePart = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const timePart = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
};

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const contentBounds = (doc) => ({
  x: doc.page.margins.left,
  width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
});

// Forces a page break BEFORE drawing something that must not itself be
// split (a timeline node, a comment block) or that would otherwise leave a
// heading orphaned alone at the bottom of a page.
const ensureSpace = (doc, neededHeight) => {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight > bottom) {
    doc.addPage();
  }
};

const sectionHeading = (doc, text) => {
  const { x, width } = contentBounds(doc);
  ensureSpace(doc, 50); // heading + room for at least one line of content
  doc.moveDown(0.9);
  const y = doc.y;
  doc.rect(x, y + 2, 3, 12).fill(BRAND.blue);
  doc.fillColor(BRAND.blue).fontSize(12).font('Helvetica-Bold').text(text, x + 10, y, { width: width - 10 });
  doc.moveDown(0.3);
  doc
    .moveTo(x, doc.y)
    .lineTo(x + width, doc.y)
    .lineWidth(0.75)
    .strokeColor(BRAND.rule)
    .stroke();
  doc.moveDown(0.45);
  doc.fillColor(BRAND.textBody).fontSize(10).font('Helvetica');
};

const LABEL_COL_WIDTH = 92;

// One "TO: value" row of the header block, in the classic
// TO/FROM/DATE/SUBJECT memo convention — a fixed label column so values
// align into a clean left edge, the way a real organizational memo reads
// rather than a loose "Label: value" printout.
const metaRow = (doc, label, value, options = {}) => {
  const { x, width } = contentBounds(doc);
  const y = doc.y;
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(BRAND.textMuted)
    .text(label.toUpperCase(), x, y, { width: LABEL_COL_WIDTH });
  const displayValue = value === undefined || value === null || value === '' ? '—' : String(value);
  doc
    .font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(options.fontSize || 10.5)
    .fillColor(options.color || BRAND.textBody)
    .text(displayValue, x + LABEL_COL_WIDTH, y, { width: width - LABEL_COL_WIDTH });
  doc.moveDown(0.4);
};

const drawMasthead = (doc, organization) => {
  doc.rect(0, 0, doc.page.width, 8).fill(BRAND.blue);
  doc.y = doc.page.margins.top;

  doc
    .fontSize(17)
    .font('Helvetica-Bold')
    .fillColor(BRAND.blue)
    .text(organization.name.toUpperCase(), { align: 'center' });
  doc
    .fontSize(8.5)
    .font('Helvetica')
    .fillColor(BRAND.textMuted)
    .text(`Organization ID: ${organization.identifier}`, { align: 'center' });

  doc.moveDown(0.5);
  const centerX = doc.page.width / 2;
  const ruleHalfWidth = 46;
  doc
    .moveTo(centerX - ruleHalfWidth, doc.y)
    .lineTo(centerX + ruleHalfWidth, doc.y)
    .lineWidth(1.5)
    .strokeColor(BRAND.tangerine)
    .stroke();
  doc.moveDown(0.9);

  doc.fontSize(14).font('Helvetica-Bold').fillColor(BRAND.textBody).text('MEMORANDUM', { align: 'center' });
  doc.moveDown(1);
};

const drawHeaderBlock = (doc, { memo, department, author }) => {
  metaRow(doc, 'To', department ? department.name : 'Unassigned');
  metaRow(doc, 'From', author ? author.name : 'Unknown');
  metaRow(doc, 'Date Created', formatDate(memo.createdAt));
  metaRow(doc, 'Date Submitted', formatDate(memo.submittedAt));
  metaRow(doc, 'Subject', memo.subject, { bold: true });
  metaRow(doc, 'Reference', memo.referenceNumber, { fontSize: 10 });
  metaRow(doc, 'Status', STATUS_LABELS[memo.status] || String(memo.status).toUpperCase(), {
    bold: true,
    color: STATUS_COLORS[memo.status] || BRAND.textBody,
  });
  metaRow(doc, 'Priority', memo.priority);
  metaRow(doc, 'Category', memo.category);
  metaRow(doc, 'Version', memo.currentVersionNumber);

  doc.moveDown(0.3);
  const { x, width } = contentBounds(doc);
  doc.moveTo(x, doc.y).lineTo(x + width, doc.y).lineWidth(1).strokeColor(BRAND.blue).stroke();
  doc.moveDown(0.6);
};

const drawBody = (doc, memo) => {
  sectionHeading(doc, 'Memo Body');
  doc.fontSize(10.5).font('Helvetica').fillColor(BRAND.textBody).text(memo.body, {
    align: 'left',
    lineGap: 2,
  });
};

const drawParticipants = (doc, participantNames) => {
  sectionHeading(doc, 'Workflow Participants');
  if (participantNames.length === 0) {
    doc.text('None.');
    return;
  }
  participantNames.forEach((name, index) => {
    ensureSpace(doc, 16);
    doc.fillColor(BRAND.tangerine).font('Helvetica-Bold').fontSize(9.5).text(`${index + 1}.`, {
      continued: true,
      indent: 0,
    });
    doc.fillColor(BRAND.textBody).font('Helvetica').fontSize(10).text(`  ${name}`);
  });
};

// Measures the block's rendered height at the target column width BEFORE
// drawing, so ensureSpace can be called with an accurate figure — the only
// way to guarantee a multi-line timeline node never straddles a page break.
const measureTimelineNode = (doc, action, textWidth) => {
  const label = (WORKFLOW_ACTION_EVENT_LABELS[action.action] || action.action).toUpperCase();
  const name = action.actor?.name || 'Unknown user';
  const metaLine = `${formatEventDate(action.createdAt)}   ·   ${name}`;

  doc.font('Helvetica-Bold').fontSize(10.5);
  let height = doc.heightOfString(label, { width: textWidth });
  doc.font('Helvetica').fontSize(9);
  height += 2 + doc.heightOfString(metaLine, { width: textWidth });
  if (action.recipient?.name) {
    height += 2 + doc.heightOfString(`-> sent to ${action.recipient.name}`, { width: textWidth });
  }
  if (action.comment) {
    doc.font('Helvetica-Oblique').fontSize(9);
    height += 3 + doc.heightOfString(`"${action.comment}"`, { width: textWidth });
  }
  return height;
};

const drawTimelineNode = (doc, action, dotX, textX, textWidth) => {
  const isMinor = MINOR_EVENTS.has(action.action);
  const color = EVENT_COLORS[action.action] || BRAND.textMuted;
  const label = (WORKFLOW_ACTION_EVENT_LABELS[action.action] || action.action).toUpperCase();
  const name = action.actor?.name || 'Unknown user';
  const metaLine = `${formatEventDate(action.createdAt)}   ·   ${name}`;

  const startY = doc.y;
  doc.circle(dotX, startY + 5, isMinor ? 2.5 : 4).fill(color);

  doc
    .font('Helvetica-Bold')
    .fontSize(isMinor ? 9 : 10.5)
    .fillColor(color)
    .text(label, textX, startY, { width: textWidth });
  doc.font('Helvetica').fontSize(9).fillColor(BRAND.textMuted).text(metaLine, textX, doc.y + 1, { width: textWidth });
  if (action.recipient?.name) {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(BRAND.textBody)
      .text(`-> sent to ${action.recipient.name}`, textX, doc.y + 1, { width: textWidth });
  }
  if (action.comment) {
    doc
      .font('Helvetica-Oblique')
      .fontSize(9)
      .fillColor(BRAND.textBody)
      .text(`"${action.comment}"`, textX, doc.y + 2, { width: textWidth });
  }
  return startY;
};

// The vertical connector spine only ever gets drawn between two nodes that
// land on the SAME page — otherwise the line would run off the bottom of
// one page into empty space, which reads as a rendering bug on paper.
const drawTimeline = (doc, workflowActions) => {
  sectionHeading(doc, 'Workflow History');
  if (workflowActions.length === 0) {
    doc.fontSize(10).font('Helvetica').fillColor(BRAND.textBody).text('No workflow history.');
    return;
  }

  const { x } = contentBounds(doc);
  const dotX = x + 4;
  const textX = x + 20;
  const textWidth = doc.page.width - doc.page.margins.right - textX;

  workflowActions.forEach((action, index) => {
    const neededHeight = measureTimelineNode(doc, action, textWidth);
    ensureSpace(doc, neededHeight + 6);

    const startY = drawTimelineNode(doc, action, dotX, textX, textWidth);
    const endY = doc.y;

    const isLast = index === workflowActions.length - 1;
    if (!isLast) {
      const nextStartY = endY + 16;
      const nextHeight = measureTimelineNode(doc, workflowActions[index + 1], textWidth);
      const pageBottom = doc.page.height - doc.page.margins.bottom;
      if (nextStartY + nextHeight <= pageBottom) {
        doc
          .moveTo(dotX, startY + 9)
          .lineTo(dotX, nextStartY - 3)
          .lineWidth(1)
          .strokeColor(BRAND.rule)
          .stroke();
      }
    }
    doc.y = endY + 16;
  });
};

const measureComment = (doc, comment, textWidth) => {
  const name = comment.authorId?.name || 'Unknown user';
  doc.font('Helvetica-Bold').fontSize(10);
  let height = doc.heightOfString(name, { width: textWidth });
  doc.font('Helvetica').fontSize(9);
  height += 2 + doc.heightOfString(formatDate(comment.createdAt), { width: textWidth });
  doc.font('Helvetica').fontSize(10);
  height += 3 + doc.heightOfString(comment.text, { width: textWidth });
  return height;
};

const drawComments = (doc, comments) => {
  sectionHeading(doc, 'Comments');
  if (comments.length === 0) {
    doc.text('No comments.');
    return;
  }
  const { x, width } = contentBounds(doc);
  comments.forEach((comment) => {
    const neededHeight = measureComment(doc, comment, width);
    ensureSpace(doc, neededHeight + 12);

    const name = comment.authorId?.name || 'Unknown user';
    doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND.textBody).text(name, x, doc.y, { width, continued: true });
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(BRAND.textMuted)
      .text(`   ${formatDate(comment.createdAt)}`, { width });
    doc.font('Helvetica').fontSize(10).fillColor(BRAND.textBody).text(comment.text, x, doc.y + 2, { width });
    doc.y += 12;
  });
};

const drawAttachments = (doc, attachments) => {
  sectionHeading(doc, 'Attachments');
  if (attachments.length === 0) {
    doc.text('No attachments.');
    return;
  }
  attachments.forEach((attachment) => {
    ensureSpace(doc, 16);
    doc
      .fillColor(BRAND.textBody)
      .font('Helvetica')
      .fontSize(10)
      .text(`•  ${attachment.filename}  (${formatSize(attachment.size)})`);
  });
};

const drawFooters = (doc, organization) => {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const { x, width } = contentBounds(doc);
    const y = doc.page.height - doc.page.margins.bottom + 18;
    // pdfkit's text() runs its own page-overflow check even for an
    // explicitly-positioned draw, so writing inside the reserved bottom
    // margin can silently trigger an unwanted extra page. Zeroing the
    // margin for this one draw call (and restoring it right after) avoids
    // that without affecting how content above already flowed.
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor(BRAND.textMuted)
      .text(`${organization.name}   ·   Page ${i + 1 - range.start} of ${range.count}`, x, y, {
        width,
        align: 'center',
        lineBreak: false,
      });
    doc.page.margins.bottom = bottomMargin;
  }
};

const renderMemoPdf = (
  doc,
  { memo, organization, department, author, participantNames, workflowActions, comments, attachments }
) => {
  drawMasthead(doc, organization);
  drawHeaderBlock(doc, { memo, department, author });
  drawBody(doc, memo);
  drawParticipants(doc, participantNames);
  drawTimeline(doc, workflowActions);
  drawComments(doc, comments);
  drawAttachments(doc, attachments);
  drawFooters(doc, organization);
};

// Buffered in memory rather than piped straight to the response — this is a
// generate-on-demand, never-persisted document at course-project scale, so
// the simplicity of "build the whole thing, then send one response with a
// correct Content-Length" outweighs the marginal benefit of streaming.
// bufferPages is required for drawFooters' post-hoc switchToPage pass.
const generateMemoPdfBuffer = (data) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 54, bufferPages: true, size: 'LETTER' });
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
