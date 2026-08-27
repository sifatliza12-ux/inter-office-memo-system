const request = require('supertest');

const app = require('../src/app');
const AuditLog = require('../src/models/AuditLog');
const { createOrganizationWithAdmin } = require('./helpers');
const { loginAs, createEmployee, createSubmittedWorkflow } = require('./workflowHelpers');

const PDF_BUFFER = Buffer.from('%PDF-1.4\n%mock pdf content for testing\n%%EOF');

describe('Audit logging: events', () => {
  it('logs USER_LOGIN on a successful login only, not on a failed attempt', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;

    const failedLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: org.payload.adminEmail, password: 'WrongPassword123' });
    expect(failedLogin.status).toBe(401);
    expect(await AuditLog.find({ organizationId, eventType: 'USER_LOGIN' })).toHaveLength(0);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: org.payload.adminEmail, password: org.payload.adminPassword });
    expect(loginResponse.status).toBe(200);

    const loginLogs = await AuditLog.find({ organizationId, eventType: 'USER_LOGIN' });
    expect(loginLogs).toHaveLength(1);
    expect(loginLogs[0].userId.toString()).toBe(loginResponse.body.user._id);
    expect(loginLogs[0].description).toContain(org.payload.adminName);
  });

  it('logs USER_LOGOUT when POST /api/auth/logout is called', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const token = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const response = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);

    const logoutLogs = await AuditLog.find({ organizationId, eventType: 'USER_LOGOUT' });
    expect(logoutLogs).toHaveLength(1);
    expect(logoutLogs[0].description).toContain(org.payload.adminName);
  });

  it('logs USER_CREATED for the initial admin created via organization registration', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;

    const createdLogs = await AuditLog.find({ organizationId, eventType: 'USER_CREATED' });
    expect(createdLogs).toHaveLength(1);
    expect(createdLogs[0].userId.toString()).toBe(org.response.body.user._id);
    expect(createdLogs[0].description).toContain(org.payload.adminName);
  });

  it('logs USER_CREATED (attributed to the admin) when an admin creates a user, and USER_ACTIVATED/USER_DEACTIVATED on status toggle', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const adminToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const adminUserId = org.response.body.user._id;

    const createResponse = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Employee', email: `new-employee-${Date.now()}@acme.test`, password: 'NewEmployee123' });
    expect(createResponse.status).toBe(201);
    const newUserId = createResponse.body.user._id;

    const createdLogs = await AuditLog.find({ organizationId, eventType: 'USER_CREATED', userId: adminUserId });
    const newUserCreatedLog = createdLogs.find((log) => log.description.includes('New Employee'));
    expect(newUserCreatedLog).toBeDefined();

    const deactivateResponse = await request(app)
      .patch(`/api/users/${newUserId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'inactive' });
    expect(deactivateResponse.status).toBe(200);

    const activateResponse = await request(app)
      .patch(`/api/users/${newUserId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active' });
    expect(activateResponse.status).toBe(200);

    const deactivatedLogs = await AuditLog.find({ organizationId, eventType: 'USER_DEACTIVATED', userId: adminUserId });
    expect(deactivatedLogs).toHaveLength(1);
    expect(deactivatedLogs[0].description).toContain('New Employee');

    const activatedLogs = await AuditLog.find({ organizationId, eventType: 'USER_ACTIVATED', userId: adminUserId });
    expect(activatedLogs).toHaveLength(1);
    expect(activatedLogs[0].description).toContain('New Employee');
  });

  it('logs MEMO_CREATED, MEMO_MODIFIED, MEMO_SUBMITTED, and WORKFLOW_ASSIGNED (naming every participant)', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { user: participant } = await createEmployee(organizationId, { name: 'Workflow Participant' });

    const createResponse = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ subject: 'Audit Test Memo', body: 'Body text' });
    expect(createResponse.status).toBe(201);
    const memoId = createResponse.body.memo._id;
    const { referenceNumber } = createResponse.body.memo;

    const createdLogs = await AuditLog.find({ organizationId, eventType: 'MEMO_CREATED' });
    expect(createdLogs).toHaveLength(1);
    expect(createdLogs[0].description).toContain(referenceNumber);

    const updateResponse = await request(app)
      .patch(`/api/memos/${memoId}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ workflowParticipants: [participant._id.toString()] });
    expect(updateResponse.status).toBe(200);

    const modifiedLogs = await AuditLog.find({ organizationId, eventType: 'MEMO_MODIFIED' });
    expect(modifiedLogs).toHaveLength(1);
    expect(modifiedLogs[0].description).toContain(referenceNumber);

    const submitResponse = await request(app)
      .post(`/api/memos/${memoId}/submit`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(submitResponse.status).toBe(200);

    const submittedLogs = await AuditLog.find({ organizationId, eventType: 'MEMO_SUBMITTED' });
    expect(submittedLogs).toHaveLength(1);
    expect(submittedLogs[0].description).toContain(referenceNumber);

    const assignedLogs = await AuditLog.find({ organizationId, eventType: 'WORKFLOW_ASSIGNED' });
    expect(assignedLogs).toHaveLength(1);
    expect(assignedLogs[0].description).toContain(referenceNumber);
    expect(assignedLogs[0].description).toContain('Workflow Participant');
  });

  it('logs WORKFLOW_APPROVED for every approval and WORKFLOW_COMPLETED only on the final step', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 2);

    const firstApprove = await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({});
    expect(firstApprove.status).toBe(200);
    expect(await AuditLog.find({ organizationId, eventType: 'WORKFLOW_APPROVED' })).toHaveLength(1);
    expect(await AuditLog.find({ organizationId, eventType: 'WORKFLOW_COMPLETED' })).toHaveLength(0);

    const secondApprove = await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${participants[1].token}`)
      .send({});
    expect(secondApprove.status).toBe(200);
    expect(await AuditLog.find({ organizationId, eventType: 'WORKFLOW_APPROVED' })).toHaveLength(2);
    expect(await AuditLog.find({ organizationId, eventType: 'WORKFLOW_COMPLETED' })).toHaveLength(1);
  });

  it('logs WORKFLOW_REJECTED, CHANGE_REQUESTED, and MEMO_RESUBMITTED', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const rejectFixture = await createSubmittedWorkflow(app, organizationId, authorToken, 1);
    const rejectResponse = await request(app)
      .post(`/api/memos/${rejectFixture.memoId}/reject`)
      .set('Authorization', `Bearer ${rejectFixture.participants[0].token}`)
      .send({ comment: 'Not approved' });
    expect(rejectResponse.status).toBe(200);
    const rejectedLogs = await AuditLog.find({ organizationId, eventType: 'WORKFLOW_REJECTED' });
    expect(rejectedLogs).toHaveLength(1);
    expect(rejectedLogs[0].description).toContain('Not approved');

    const changesFixture = await createSubmittedWorkflow(app, organizationId, authorToken, 1);
    const changesResponse = await request(app)
      .post(`/api/memos/${changesFixture.memoId}/request-changes`)
      .set('Authorization', `Bearer ${changesFixture.participants[0].token}`)
      .send({ comment: 'Please revise the budget section' });
    expect(changesResponse.status).toBe(200);
    const changeLogs = await AuditLog.find({ organizationId, eventType: 'CHANGE_REQUESTED' });
    expect(changeLogs).toHaveLength(1);
    expect(changeLogs[0].description).toContain('Please revise the budget section');

    const resubmitResponse = await request(app)
      .post(`/api/memos/${changesFixture.memoId}/resubmit`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(resubmitResponse.status).toBe(200);
    expect(await AuditLog.find({ organizationId, eventType: 'MEMO_RESUBMITTED' })).toHaveLength(1);
  });

  it('logs WORKFLOW_PARTICIPANT_ADDED (Stage 5 behavior, now routed through the shared audit service)', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);
    const { user: candidate } = await createEmployee(organizationId, { name: 'Late Participant' });

    const response = await request(app)
      .post(`/api/memos/${memoId}/workflow/add-participant`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ userId: candidate._id.toString(), reason: 'Needs sign-off' });
    expect(response.status).toBe(201);

    expect(await AuditLog.find({ organizationId, eventType: 'WORKFLOW_PARTICIPANT_ADDED' })).toHaveLength(1);
  });

  it('logs COMMENT_ADDED', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, referenceNumber } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    const response = await request(app)
      .post(`/api/memos/${memoId}/comments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ text: 'Looks good so far' });
    expect(response.status).toBe(201);

    const logs = await AuditLog.find({ organizationId, eventType: 'COMMENT_ADDED' });
    expect(logs).toHaveLength(1);
    expect(logs[0].description).toContain(referenceNumber);
  });

  it('logs ATTACHMENT_UPLOADED and ATTACHMENT_DELETED', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, referenceNumber } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    const uploadResponse = await request(app)
      .post(`/api/memos/${memoId}/attachments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .attach('file', PDF_BUFFER, 'audit-test.pdf');
    expect(uploadResponse.status).toBe(201);
    const attachmentId = uploadResponse.body.attachment._id;

    const uploadLogs = await AuditLog.find({ organizationId, eventType: 'ATTACHMENT_UPLOADED' });
    expect(uploadLogs).toHaveLength(1);
    expect(uploadLogs[0].description).toContain('audit-test.pdf');
    expect(uploadLogs[0].description).toContain(referenceNumber);

    const deleteResponse = await request(app)
      .delete(`/api/memos/${memoId}/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(deleteResponse.status).toBe(204);

    const deleteLogs = await AuditLog.find({ organizationId, eventType: 'ATTACHMENT_DELETED' });
    expect(deleteLogs).toHaveLength(1);
    expect(deleteLogs[0].description).toContain('audit-test.pdf');
  });
});

describe('Audit logging resilience', () => {
  it('does not fail the triggering action when AuditLog.create throws', async () => {
    const org = await createOrganizationWithAdmin(app);
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const createSpy = jest.spyOn(AuditLog, 'create').mockRejectedValueOnce(new Error('Simulated failure'));

    const response = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ subject: 'Resilience Test Memo', body: 'Body' });

    expect(response.status).toBe(201);
    expect(consoleErrorSpy).toHaveBeenCalled();

    createSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});

describe('GET /api/audit-logs', () => {
  it('rejects a non-admin user with 403', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const { user: employee, password } = await createEmployee(organizationId, { name: 'Regular Employee' });
    const employeeToken = await loginAs(app, employee.email, password);

    const response = await request(app).get('/api/audit-logs').set('Authorization', `Bearer ${employeeToken}`);
    expect(response.status).toBe(403);
  });

  it('returns paginated results for an admin, newest first, with actor name populated', async () => {
    const org = await createOrganizationWithAdmin(app);
    const adminToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subject: 'Listed Memo', body: 'Body' });

    const response = await request(app).get('/api/audit-logs').set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(response.body.auditLogs.length).toBeGreaterThanOrEqual(3);
    expect(response.body.auditLogs[0].eventType).toBe('MEMO_CREATED');
    expect(response.body.auditLogs[0].userId.name).toBe(org.payload.adminName);
    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('page', 1);
    expect(response.body).toHaveProperty('limit');
  });

  it("never returns another organization's audit entries, even with matching filters", async () => {
    const orgA = await createOrganizationWithAdmin(app, { name: 'Org Audit A' });
    const orgATokenAdmin = await loginAs(app, orgA.payload.adminEmail, orgA.payload.adminPassword);

    const orgB = await createOrganizationWithAdmin(app, { name: 'Org Audit B' });
    const orgBTokenAdmin = await loginAs(app, orgB.payload.adminEmail, orgB.payload.adminPassword);

    await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${orgBTokenAdmin}`)
      .send({ subject: 'Org B Only Memo', body: 'Body' });

    const responseAsA = await request(app)
      .get('/api/audit-logs?eventType=MEMO_CREATED')
      .set('Authorization', `Bearer ${orgATokenAdmin}`);
    expect(responseAsA.body.auditLogs).toHaveLength(0);

    const responseAsB = await request(app)
      .get('/api/audit-logs?eventType=MEMO_CREATED')
      .set('Authorization', `Bearer ${orgBTokenAdmin}`);
    expect(responseAsB.body.auditLogs).toHaveLength(1);
  });

  it('filters by eventType, userId, and date range individually and combined', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const adminToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const { user: employee, password } = await createEmployee(organizationId, { name: 'Filter Target Employee' });
    const employeeToken = await loginAs(app, employee.email, password);

    await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subject: 'Admin Memo', body: 'Body' });
    await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ subject: 'Employee Memo', body: 'Body' });

    const byEventType = await request(app)
      .get('/api/audit-logs?eventType=MEMO_CREATED')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(byEventType.body.auditLogs).toHaveLength(2);

    // The employee's own audit trail up to this point: one USER_LOGIN (from
    // loginAs above) and one MEMO_CREATED — filtering by userId alone
    // returns both, proving the filter isn't accidentally scoped to one
    // eventType.
    const byUser = await request(app)
      .get(`/api/audit-logs?userId=${employee._id.toString()}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(byUser.body.auditLogs).toHaveLength(2);
    expect(byUser.body.auditLogs.every((log) => log.userId._id === employee._id.toString())).toBe(true);

    const combined = await request(app)
      .get(`/api/audit-logs?eventType=MEMO_CREATED&userId=${employee._id.toString()}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(combined.body.auditLogs).toHaveLength(1);
    expect(combined.body.auditLogs[0].description).toContain('Employee Memo');

    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const outOfRange = await request(app)
      .get(`/api/audit-logs?dateFrom=${future}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(outOfRange.body.auditLogs).toHaveLength(0);

    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const inRange = await request(app)
      .get(`/api/audit-logs?dateFrom=${past}&eventType=MEMO_CREATED`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(inRange.body.auditLogs).toHaveLength(2);
  });

  it('paginates correctly and returns an accurate total', async () => {
    const org = await createOrganizationWithAdmin(app);
    const adminToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        request(app)
          .post('/api/memos')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ subject: `Paginated Memo ${index}`, body: 'body' })
      )
    );

    const pageOne = await request(app)
      .get('/api/audit-logs?eventType=MEMO_CREATED&limit=2&page=1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(pageOne.body.auditLogs).toHaveLength(2);
    expect(pageOne.body.total).toBe(5);
    expect(pageOne.body.page).toBe(1);
    expect(pageOne.body.limit).toBe(2);

    const pageTwo = await request(app)
      .get('/api/audit-logs?eventType=MEMO_CREATED&limit=2&page=2')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(pageTwo.body.auditLogs).toHaveLength(2);

    const pageThree = await request(app)
      .get('/api/audit-logs?eventType=MEMO_CREATED&limit=2&page=3')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(pageThree.body.auditLogs).toHaveLength(1);

    const allIds = [...pageOne.body.auditLogs, ...pageTwo.body.auditLogs, ...pageThree.body.auditLogs].map(
      (log) => log._id
    );
    expect(new Set(allIds).size).toBe(5);
  });

  it('has no PATCH or DELETE route for audit logs — a guessed one 404s for an authenticated admin, not 403', async () => {
    const org = await createOrganizationWithAdmin(app);
    const adminToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const fakeId = '507f1f77bcf86cd799439011';

    const patchResponse = await request(app)
      .patch(`/api/audit-logs/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'tampered' });
    expect(patchResponse.status).toBe(404);

    const deleteResponse = await request(app)
      .delete(`/api/audit-logs/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteResponse.status).toBe(404);
  });
});
