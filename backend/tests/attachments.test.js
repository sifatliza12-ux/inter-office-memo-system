const request = require('supertest');

const app = require('../src/app');
const Memo = require('../src/models/Memo');
const Attachment = require('../src/models/Attachment');
const { createOrganizationWithAdmin } = require('./helpers');
const { loginAs, createEmployee, createSubmittedWorkflow } = require('./workflowHelpers');

// Stage 8b: attachments now go through Supabase Storage instead of local
// disk. tests/setup.js registers a global jest.mock for
// src/config/supabaseClient (a real in-memory upload/download/remove round
// trip, not just "doesn't throw" — see supabaseStorageMock.js) so this
// suite runs without any real network call; required directly here only to
// inspect/reset its call history between tests.
const supabaseMock = require('./supabaseStorageMock');

const PDF_BUFFER = Buffer.from('%PDF-1.4\n%mock pdf content for testing\n%%EOF');
const PNG_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03]);
const OVERSIZED_BUFFER = Buffer.concat([PDF_BUFFER, Buffer.alloc(11 * 1024 * 1024)]);

beforeEach(() => {
  supabaseMock.reset();
});

describe('Attachments: POST/GET /api/memos/:id/attachments', () => {
  it('allows the author and any participant to upload; rejects an uninvolved same-org user (403) and another org (404)', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    const authorUpload = await request(app)
      .post(`/api/memos/${memoId}/attachments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .attach('file', PDF_BUFFER, 'author-doc.pdf');
    expect(authorUpload.status).toBe(201);
    expect(authorUpload.body.attachment.filename).toBe('author-doc.pdf');
    expect(authorUpload.body.attachment.storedFilename).not.toBe('author-doc.pdf');

    const participantUpload = await request(app)
      .post(`/api/memos/${memoId}/attachments`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .attach('file', PNG_BUFFER, 'photo.png');
    expect(participantUpload.status).toBe(201);

    const { user: bystander, password: bystanderPassword } = await createEmployee(organizationId, {
      name: 'Bystander',
    });
    const bystanderToken = await loginAs(app, bystander.email, bystanderPassword);
    const bystanderUpload = await request(app)
      .post(`/api/memos/${memoId}/attachments`)
      .set('Authorization', `Bearer ${bystanderToken}`)
      .attach('file', PDF_BUFFER, 'sneaky.pdf');
    expect(bystanderUpload.status).toBe(403);

    const orgB = await createOrganizationWithAdmin(app, { name: 'Organization B' });
    const tokenB = await loginAs(app, orgB.payload.adminEmail, orgB.payload.adminPassword);
    const crossOrgUpload = await request(app)
      .post(`/api/memos/${memoId}/attachments`)
      .set('Authorization', `Bearer ${tokenB}`)
      .attach('file', PDF_BUFFER, 'cross-org.pdf');
    expect(crossOrgUpload.status).toBe(404);

    const list = await request(app)
      .get(`/api/memos/${memoId}/attachments`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(list.status).toBe(200);
    expect(list.body.attachments).toHaveLength(2);

    // The bystander/cross-org attempts were rejected before ever reaching
    // Supabase — only the two legitimate uploads actually called it.
    expect(supabaseMock.upload).toHaveBeenCalledTimes(2);
  });

  it('uploads the buffer to Supabase Storage under {organizationId}/{memoId}/{storedFilename} and persists that full path as storedFilename', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    const response = await request(app)
      .post(`/api/memos/${memoId}/attachments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .attach('file', PDF_BUFFER, 'metadata-check.pdf');
    expect(response.status).toBe(201);

    const storedInDb = await Attachment.findById(response.body.attachment._id);
    expect(storedInDb.storedFilename.startsWith(`${organizationId}/${memoId}/`)).toBe(true);
    expect(storedInDb.filename).toBe('metadata-check.pdf');
    expect(storedInDb.size).toBe(PDF_BUFFER.length);
    expect(storedInDb.mimetype).toBe('application/pdf');

    expect(supabaseMock.upload).toHaveBeenCalledTimes(1);
    const [calledBucket, calledPath, calledBuffer] = supabaseMock.upload.mock.calls[0];
    expect(calledBucket).toBe('test-bucket');
    expect(calledPath).toBe(storedInDb.storedFilename);
    expect(Buffer.compare(calledBuffer, PDF_BUFFER)).toBe(0);
  });

  it('rejects an oversized file', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    const response = await request(app)
      .post(`/api/memos/${memoId}/attachments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .attach('file', OVERSIZED_BUFFER, 'huge.pdf');

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/size/i);
    // Rejected by multer before attachment.service.js ever runs — storage
    // was never touched.
    expect(supabaseMock.upload).not.toHaveBeenCalled();
  }, 20000);

  it('rejects a disallowed file extension', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    const response = await request(app)
      .post(`/api/memos/${memoId}/attachments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .attach('file', Buffer.from('#!/bin/sh\necho hi'), 'script.sh');

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/not allowed/i);
    expect(supabaseMock.upload).not.toHaveBeenCalled();
  });

  it("rejects a file whose actual content doesn't match its claimed extension (magic-byte check, not just extension)", async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    // Plain text content, but claiming to be a .pdf by extension — the
    // extension alone would pass an extension-only check, so this proves
    // the actual bytes are being inspected.
    const response = await request(app)
      .post(`/api/memos/${memoId}/attachments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .attach('file', Buffer.from('this is definitely not a pdf'), 'fake.pdf');

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/not allowed/i);

    const attachmentsInDb = await Attachment.find({ memoId });
    expect(attachmentsInDb).toHaveLength(0);
    expect(supabaseMock.upload).not.toHaveBeenCalled();
  });

  it('returns filename, size, uploader name, and date, in chronological order', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    await request(app)
      .post(`/api/memos/${memoId}/attachments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .attach('file', PDF_BUFFER, 'first.pdf');
    await request(app)
      .post(`/api/memos/${memoId}/attachments`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .attach('file', PNG_BUFFER, 'second.png');

    const response = await request(app)
      .get(`/api/memos/${memoId}/attachments`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(response.body.attachments.map((a) => a.filename)).toEqual(['first.pdf', 'second.png']);
    expect(response.body.attachments[0].uploadedBy.name).toBe('Jane Admin');
    expect(response.body.attachments[1].uploadedBy.name).toBe('Participant 1');
    expect(response.body.attachments[0].size).toBe(PDF_BUFFER.length);
    expect(typeof response.body.attachments[0].uploadedAt).toBe('string');
    // storedFilename (the raw Supabase Storage key) is still never exposed
    // in the list response — unaffected by the Stage 8b storage change.
    expect(response.body.attachments[0].storedFilename).toBeUndefined();
  });

  it('does not change memo status when uploading', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    await request(app)
      .post(`/api/memos/${memoId}/attachments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .attach('file', PDF_BUFFER, 'doc.pdf');

    const memo = await Memo.findById(memoId);
    expect(memo.status).toBe('submitted');
  });
});

describe('Attachments: GET /api/memos/:id/attachments/:attachmentId/download', () => {
  it('allows an authorized user to download; 403 for an uninvolved same-org user; 404 for another org', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    const upload = await request(app)
      .post(`/api/memos/${memoId}/attachments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .attach('file', PDF_BUFFER, 'doc.pdf');
    const attachmentId = upload.body.attachment._id;

    const participantDownload = await request(app)
      .get(`/api/memos/${memoId}/attachments/${attachmentId}/download`)
      .set('Authorization', `Bearer ${participants[0].token}`);
    expect(participantDownload.status).toBe(200);
    expect(Buffer.compare(participantDownload.body, PDF_BUFFER)).toBe(0);

    const { user: bystander, password: bystanderPassword } = await createEmployee(organizationId, {
      name: 'Bystander',
    });
    const bystanderToken = await loginAs(app, bystander.email, bystanderPassword);
    const bystanderDownload = await request(app)
      .get(`/api/memos/${memoId}/attachments/${attachmentId}/download`)
      .set('Authorization', `Bearer ${bystanderToken}`);
    expect(bystanderDownload.status).toBe(403);

    const orgB = await createOrganizationWithAdmin(app, { name: 'Organization B' });
    const tokenB = await loginAs(app, orgB.payload.adminEmail, orgB.payload.adminPassword);
    const crossOrgDownload = await request(app)
      .get(`/api/memos/${memoId}/attachments/${attachmentId}/download`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(crossOrgDownload.status).toBe(404);

    // The upload above is the only call that should have touched storage's
    // download path; the 403 and 404 attempts must both have been rejected
    // by assertCanAccessAttachments/findMemoInOrg BEFORE ever reaching
    // Supabase — authorization gates access to storage, not the other way
    // around.
    expect(supabaseMock.download).toHaveBeenCalledTimes(1);
  });

  it('cannot be reached by guessing an attachment id that belongs to a different memo', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const workflowA = await createSubmittedWorkflow(app, organizationId, authorToken, 1, { subject: 'Memo A' });
    const workflowB = await createSubmittedWorkflow(app, organizationId, authorToken, 1, { subject: 'Memo B' });

    const uploadOnA = await request(app)
      .post(`/api/memos/${workflowA.memoId}/attachments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .attach('file', PDF_BUFFER, 'a-doc.pdf');
    const attachmentIdFromA = uploadOnA.body.attachment._id;

    // Same author, genuinely authorized on memo B — but this attachment
    // belongs to memo A, not B.
    const crossMemoAttempt = await request(app)
      .get(`/api/memos/${workflowB.memoId}/attachments/${attachmentIdFromA}/download`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(crossMemoAttempt.status).toBe(404);
    expect(supabaseMock.download).not.toHaveBeenCalled();
  });

  it('cannot be reached by requesting the storedFilename/storage key directly through this app — never served as a static/public path', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    const upload = await request(app)
      .post(`/api/memos/${memoId}/attachments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .attach('file', PDF_BUFFER, 'doc.pdf');
    const { storedFilename } = upload.body.attachment;
    expect(storedFilename).toEqual(expect.any(String));

    // The legitimate, authorized route works.
    const legitimateDownload = await request(app)
      .get(`/api/memos/${memoId}/attachments/${upload.body.attachment._id}/download`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(legitimateDownload.status).toBe(200);

    // But a request for the exact same object by its raw storage key —
    // the "obvious" thing to try if you already know it, e.g. from the
    // list response above — must not work by any path through THIS app,
    // authenticated or not. (The Supabase bucket itself being private is
    // a separate, infrastructure-level guarantee — see the Stage 8b
    // report's manual-verification note.)
    const attemptedPaths = [
      `/uploads/${storedFilename}`,
      `/api/uploads/${storedFilename}`,
      `/${storedFilename}`,
    ];

    // eslint-disable-next-line no-restricted-syntax
    for (const attemptedPath of attemptedPaths) {
      // eslint-disable-next-line no-await-in-loop
      const response = await request(app).get(attemptedPath).set('Authorization', `Bearer ${authorToken}`);
      expect(response.status).toBe(404);
    }
  });
});

describe('Attachments: DELETE /api/memos/:id/attachments/:attachmentId', () => {
  it('allows the uploader or the memo author to delete; anyone else gets 403', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 2);

    const upload = await request(app)
      .post(`/api/memos/${memoId}/attachments`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .attach('file', PDF_BUFFER, 'p1-doc.pdf');
    const attachmentId = upload.body.attachment._id;
    const { storedFilename } = upload.body.attachment;

    // A different participant (not the uploader, not the author) — 403.
    const wrongParticipantAttempt = await request(app)
      .delete(`/api/memos/${memoId}/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${participants[1].token}`);
    expect(wrongParticipantAttempt.status).toBe(403);
    expect(supabaseMock.remove).not.toHaveBeenCalled();

    // The author (not the uploader) — allowed.
    const authorDelete = await request(app)
      .delete(`/api/memos/${memoId}/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(authorDelete.status).toBe(204);

    const remaining = await Attachment.find({ memoId });
    expect(remaining).toHaveLength(0);

    // The DB record is gone AND the storage object was removed.
    expect(supabaseMock.remove).toHaveBeenCalledTimes(1);
    const [calledBucket, calledPaths] = supabaseMock.remove.mock.calls[0];
    expect(calledBucket).toBe('test-bucket');
    expect(calledPaths).toEqual([storedFilename]);
    expect(supabaseMock.objects.has(`test-bucket::${storedFilename}`)).toBe(false);

    // The uploader may delete their own upload too.
    const secondUpload = await request(app)
      .post(`/api/memos/${memoId}/attachments`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .attach('file', PNG_BUFFER, 'p1-photo.png');
    const secondAttachmentId = secondUpload.body.attachment._id;

    const uploaderDelete = await request(app)
      .delete(`/api/memos/${memoId}/attachments/${secondAttachmentId}`)
      .set('Authorization', `Bearer ${participants[0].token}`);
    expect(uploaderDelete.status).toBe(204);
    expect(supabaseMock.remove).toHaveBeenCalledTimes(2);
  });

  it('does not change memo status when deleting', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    const upload = await request(app)
      .post(`/api/memos/${memoId}/attachments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .attach('file', PDF_BUFFER, 'doc.pdf');

    await request(app)
      .delete(`/api/memos/${memoId}/attachments/${upload.body.attachment._id}`)
      .set('Authorization', `Bearer ${authorToken}`);

    const memo = await Memo.findById(memoId);
    expect(memo.status).toBe('submitted');
  });
});
