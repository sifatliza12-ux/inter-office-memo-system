const request = require('supertest');

const app = require('../src/app');
const { createOrganizationWithAdmin } = require('./helpers');
const { loginAs, createEmployee, createSubmittedWorkflow } = require('./workflowHelpers');

describe('Dashboard: GET /api/dashboard', () => {
  it('inboxCount matches the length of the actual inbox list', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const { participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 2);

    const [dashboard, inbox] = await Promise.all([
      request(app).get('/api/dashboard').set('Authorization', `Bearer ${participants[0].token}`),
      request(app).get('/api/memos/inbox').set('Authorization', `Bearer ${participants[0].token}`),
    ]);

    expect(dashboard.status).toBe(200);
    expect(dashboard.body.inboxCount).toBe(inbox.body.memos.length);
    expect(dashboard.body.inboxCount).toBe(1);

    // The second participant's turn hasn't come up yet.
    const dashboardSecond = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${participants[1].token}`);
    expect(dashboardSecond.body.inboxCount).toBe(0);
  });

  it('myMemosByStatus counts correctly across a mix of draft/submitted/approved memos authored by the caller', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    // Draft: created but never submitted.
    await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ subject: 'Draft memo', body: 'Body' });

    // Submitted: left pending.
    await createSubmittedWorkflow(app, organizationId, authorToken, 1, { subject: 'Submitted memo' });

    // Approved: submitted then approved by its single participant.
    const approvedWorkflow = await createSubmittedWorkflow(app, organizationId, authorToken, 1, {
      subject: 'Approved memo',
    });
    await request(app)
      .post(`/api/memos/${approvedWorkflow.memoId}/approve`)
      .set('Authorization', `Bearer ${approvedWorkflow.participants[0].token}`)
      .send({});

    const dashboard = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${authorToken}`);

    expect(dashboard.status).toBe(200);
    expect(dashboard.body.myMemosCount).toBe(3);
    expect(dashboard.body.myMemosByStatus).toEqual({
      draft: 1,
      submitted: 1,
      changes_requested: 0,
      approved: 1,
      rejected: 0,
    });
  });

  it('recentActivity includes actions performed BY this user or on memos authored BY this user, and excludes unrelated activity', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    // The memo this test cares about: authored by the org admin, two
    // participants, first one approves.
    const { memoId, referenceNumber, participants } = await createSubmittedWorkflow(
      app,
      organizationId,
      authorToken,
      2,
      { subject: 'Relevant memo' }
    );

    await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ comment: 'Approved by P1' });

    // An entirely unrelated memo: different author, different participant —
    // must never show up for the author or P1 above.
    const { user: outsiderAuthorUser, password: outsiderAuthorPassword } = await createEmployee(organizationId, {
      name: 'Outsider Author',
    });
    const outsiderAuthorToken = await loginAs(app, outsiderAuthorUser.email, outsiderAuthorPassword);
    const outsiderWorkflow = await createSubmittedWorkflow(app, organizationId, outsiderAuthorToken, 1, {
      subject: 'Unrelated memo',
    });
    await request(app)
      .post(`/api/memos/${outsiderWorkflow.memoId}/reject`)
      .set('Authorization', `Bearer ${outsiderWorkflow.participants[0].token}`)
      .send({ comment: 'Rejected by outsider participant' });

    // Author's dashboard: sees the approval on their own memo.
    const authorDashboard = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${authorToken}`);
    expect(authorDashboard.body.recentActivity).toHaveLength(1);
    expect(authorDashboard.body.recentActivity[0]).toMatchObject({
      referenceNumber,
      subject: 'Relevant memo',
      action: 'approved',
      actorName: 'Participant 1',
    });

    // P1's dashboard: sees the action they personally performed.
    const p1Dashboard = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${participants[0].token}`);
    expect(p1Dashboard.body.recentActivity).toHaveLength(1);
    expect(p1Dashboard.body.recentActivity[0]).toMatchObject({
      referenceNumber,
      action: 'approved',
      actorName: 'Participant 1',
    });

    // P2 neither performed the action nor authored the memo — nothing to show.
    const p2Dashboard = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${participants[1].token}`);
    expect(p2Dashboard.body.recentActivity).toHaveLength(0);
  });
});

describe('Admin dashboard: GET /api/dashboard/organization', () => {
  it('rejects a non-admin with 403', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const { user, password } = await createEmployee(organizationId, { name: 'Regular Employee' });
    const employeeToken = await loginAs(app, user.email, password);

    const response = await request(app)
      .get('/api/dashboard/organization')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(response.status).toBe(403);
  });

  it('returns correct org-wide totals for an admin, verified against known seeded data', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const adminToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    // 2 departments.
    await request(app).post('/api/departments').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Engineering' });
    await request(app).post('/api/departments').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Finance' });

    // 1 extra user, deactivated, so activeUsers < totalUsers.
    const { user: inactiveUser } = await createEmployee(organizationId, { name: 'Inactive Person' });
    await request(app)
      .patch(`/api/users/${inactiveUser._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'inactive' });

    // 5 memos, one per status: draft, submitted, changes_requested, approved, rejected.
    await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subject: 'Draft memo', body: 'Body' });

    await createSubmittedWorkflow(app, organizationId, adminToken, 1, { subject: 'Submitted memo' });

    const changesRequestedFlow = await createSubmittedWorkflow(app, organizationId, adminToken, 1, {
      subject: 'Changes requested memo',
    });
    await request(app)
      .post(`/api/memos/${changesRequestedFlow.memoId}/request-changes`)
      .set('Authorization', `Bearer ${changesRequestedFlow.participants[0].token}`)
      .send({ comment: 'Fix this' });

    const approvedFlow = await createSubmittedWorkflow(app, organizationId, adminToken, 1, {
      subject: 'Approved memo',
    });
    await request(app)
      .post(`/api/memos/${approvedFlow.memoId}/approve`)
      .set('Authorization', `Bearer ${approvedFlow.participants[0].token}`)
      .send({});

    const rejectedFlow = await createSubmittedWorkflow(app, organizationId, adminToken, 1, {
      subject: 'Rejected memo',
    });
    await request(app)
      .post(`/api/memos/${rejectedFlow.memoId}/reject`)
      .set('Authorization', `Bearer ${rejectedFlow.participants[0].token}`)
      .send({ comment: 'No good' });

    // Users so far: admin + inactiveUser + 4 auto-created workflow participants = 6.
    const response = await request(app)
      .get('/api/dashboard/organization')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.totalUsers).toBe(6);
    expect(response.body.activeUsers).toBe(5);
    expect(response.body.totalDepartments).toBe(2);
    expect(response.body.totalMemos).toBe(5);
    expect(response.body.memosByStatus).toEqual({
      draft: 1,
      submitted: 1,
      changes_requested: 1,
      approved: 1,
      rejected: 1,
    });
    expect(response.body.pendingWorkflows).toBe(2);
  });

  it("excludes another organization's users, departments, and memos from the totals", async () => {
    const orgA = await createOrganizationWithAdmin(app, { name: 'Organization A' });
    const adminTokenA = await loginAs(app, orgA.payload.adminEmail, orgA.payload.adminPassword);

    const orgB = await createOrganizationWithAdmin(app, { name: 'Organization B' });
    const organizationIdB = orgB.response.body.organization._id;
    const adminTokenB = await loginAs(app, orgB.payload.adminEmail, orgB.payload.adminPassword);

    await request(app).post('/api/departments').set('Authorization', `Bearer ${adminTokenB}`).send({ name: 'Only in B' });
    await createEmployee(organizationIdB, { name: 'Only in B' });
    await createSubmittedWorkflow(app, organizationIdB, adminTokenB, 1, { subject: 'Only in B memo' });

    const dashboardA = await request(app)
      .get('/api/dashboard/organization')
      .set('Authorization', `Bearer ${adminTokenA}`);

    expect(dashboardA.status).toBe(200);
    expect(dashboardA.body.totalUsers).toBe(1);
    expect(dashboardA.body.totalDepartments).toBe(0);
    expect(dashboardA.body.totalMemos).toBe(0);
  });
});
