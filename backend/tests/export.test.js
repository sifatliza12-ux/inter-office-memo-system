const request = require('supertest');

const app = require('../src/app');
const { createOrganizationWithAdmin } = require('./helpers');
const { loginAs, createEmployee, createSubmittedWorkflow } = require('./workflowHelpers');

const PDF_BUFFER = Buffer.from('%PDF-1.4\n%mock pdf content for testing\n%%EOF');

// A basic byte-signature/structural check, per the spec's own "no need to
// assert exact rendered text layout" — real PDFs start with the %PDF-
// header and end with an %%EOF marker; this is enough to prove pdfkit
// actually produced a parseable file, not garbage or a truncated stream.
const isWellFormedPdf = (buffer) =>
  Buffer.isBuffer(buffer) &&
  buffer.length > 100 &&
  buffer.slice(0, 5).toString('latin1') === '%PDF-' &&
  buffer.toString('latin1').includes('%%EOF');

describe('GET /api/memos/:id/export/pdf', () => {
  it('allows the author and any participant to export; rejects an uninvolved same-org user (403) and another org (404)', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    const authorExport = await request(app)
      .get(`/api/memos/${memoId}/export/pdf`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(authorExport.status).toBe(200);
    expect(isWellFormedPdf(authorExport.body)).toBe(true);

    const participantExport = await request(app)
      .get(`/api/memos/${memoId}/export/pdf`)
      .set('Authorization', `Bearer ${participants[0].token}`);
    expect(participantExport.status).toBe(200);
    expect(isWellFormedPdf(participantExport.body)).toBe(true);

    const { user: bystander, password: bystanderPassword } = await createEmployee(organizationId, {
      name: 'Bystander',
    });
    const bystanderToken = await loginAs(app, bystander.email, bystanderPassword);
    const bystanderExport = await request(app)
      .get(`/api/memos/${memoId}/export/pdf`)
      .set('Authorization', `Bearer ${bystanderToken}`);
    expect(bystanderExport.status).toBe(403);

    const orgB = await createOrganizationWithAdmin(app, { name: 'Organization B' });
    const tokenB = await loginAs(app, orgB.payload.adminEmail, orgB.payload.adminPassword);
    const crossOrgExport = await request(app)
      .get(`/api/memos/${memoId}/export/pdf`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(crossOrgExport.status).toBe(404);
  });

  it('returns the correct Content-Type and Content-Disposition headers', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, referenceNumber } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    const response = await request(app)
      .get(`/api/memos/${memoId}/export/pdf`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/pdf/);
    expect(response.headers['content-disposition']).toContain('attachment');
    expect(response.headers['content-disposition']).toContain(referenceNumber);
  });

  it('generates a non-empty, well-formed PDF for a bare minimal memo', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    const response = await request(app)
      .get(`/api/memos/${memoId}/export/pdf`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(response.status).toBe(200);
    expect(isWellFormedPdf(response.body)).toBe(true);
  });

  it('exports without error a memo with attachments, comments, and a changes-requested/resubmit cycle', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 2);

    // Changes-requested / resubmit cycle on the first step
    await request(app)
      .post(`/api/memos/${memoId}/request-changes`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ comment: 'Please revise section 2' });
    await request(app).post(`/api/memos/${memoId}/resubmit`).set('Authorization', `Bearer ${authorToken}`);

    // The reinserted step is for the same participant who requested
    // changes; approving it advances to the second (original) step.
    await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ comment: 'Looks good now' });
    await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${participants[1].token}`)
      .send({});

    await request(app)
      .post(`/api/memos/${memoId}/comments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ text: 'Thanks everyone.' });

    const uploadResponse = await request(app)
      .post(`/api/memos/${memoId}/attachments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .attach('file', PDF_BUFFER, 'supporting-doc.pdf');
    expect(uploadResponse.status).toBe(201);

    const response = await request(app)
      .get(`/api/memos/${memoId}/export/pdf`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(response.status).toBe(200);
    expect(isWellFormedPdf(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(500);
  });
});
