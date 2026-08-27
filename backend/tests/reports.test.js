const request = require('supertest');

const app = require('../src/app');
const Memo = require('../src/models/Memo');
const { createOrganizationWithAdmin } = require('./helpers');
const { loginAs, createEmployee, createSubmittedWorkflow } = require('./workflowHelpers');

describe('GET /api/reports', () => {
  it('rejects a non-admin user with 403; returns 200 for an admin', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const adminToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { user: employee, password } = await createEmployee(organizationId, { name: 'Regular Employee' });
    const employeeToken = await loginAs(app, employee.email, password);

    const employeeResponse = await request(app).get('/api/reports').set('Authorization', `Bearer ${employeeToken}`);
    expect(employeeResponse.status).toBe(403);

    const adminResponse = await request(app).get('/api/reports').set('Authorization', `Bearer ${adminToken}`);
    expect(adminResponse.status).toBe(200);
  });

  it('returns correct org-wide totals for an unfiltered request against known seeded data', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const adminToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const engineering = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Engineering' });
    const departmentId = engineering.body.department._id;

    // 3 drafts: Financial (Engineering dept), General, urgent HR
    await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subject: 'Draft A', body: 'b', category: 'Financial', priority: 'normal', departmentId });
    await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subject: 'Draft B', body: 'b', category: 'General', priority: 'low' });
    await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subject: 'Urgent HR Memo', body: 'b', category: 'HR', priority: 'urgent' });

    // A rejected memo (default category 'General', no department)
    const rejectFixture = await createSubmittedWorkflow(app, organizationId, adminToken, 1, {
      subject: 'To Be Rejected',
    });
    await request(app)
      .post(`/api/memos/${rejectFixture.memoId}/reject`)
      .set('Authorization', `Bearer ${rejectFixture.participants[0].token}`)
      .send({ comment: 'no' });

    // A still-pending submitted memo (default category 'General', no department)
    await createSubmittedWorkflow(app, organizationId, adminToken, 1, { subject: 'Still Pending' });

    const response = await request(app).get('/api/reports').set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    const report = response.body;

    expect(report.memosByStatus).toMatchObject({
      draft: 3,
      submitted: 1,
      changes_requested: 0,
      approved: 0,
      rejected: 1,
    });
    expect(report.memosByCategory).toMatchObject({
      Financial: 1,
      General: 3,
      HR: 1,
      Administrative: 0,
      Procurement: 0,
      Academic: 0,
      Technical: 0,
    });

    const departmentCounts = Object.fromEntries(report.memosByDepartment.map((row) => [row.department, row.count]));
    expect(departmentCounts).toEqual({ Engineering: 1, Unassigned: 4 });

    expect(report.urgentMemoCount).toBe(1);
    expect(report.pendingApprovalsCount).toBe(1);
    expect(report.rejectedCount).toBe(1);
    expect(report.changeRequestCount).toBe(0);
    expect(report.averageWorkflowCompletionTime).toBeNull();
  });

  it('each filter individually changes results correctly, and combined filters apply AND logic', async () => {
    const org = await createOrganizationWithAdmin(app);
    const adminToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const engineering = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Engineering' });
    const engineeringId = engineering.body.department._id;
    const sales = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Sales' });
    const salesId = sales.body.department._id;

    await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subject: 'Eng Financial Memo', body: 'b', category: 'Financial', departmentId: engineeringId });

    const midpoint = new Date();

    await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subject: 'Sales HR Memo', body: 'b', category: 'HR', departmentId: salesId });

    const unfiltered = await request(app).get('/api/reports').set('Authorization', `Bearer ${adminToken}`);
    expect(unfiltered.body.memosByStatus.draft).toBe(2);

    const byDateFrom = await request(app)
      .get(`/api/reports?dateFrom=${midpoint.toISOString()}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(byDateFrom.body.memosByStatus.draft).toBe(1);
    expect(byDateFrom.body.memosByCategory.HR).toBe(1);
    expect(byDateFrom.body.memosByCategory.Financial).toBe(0);

    // dateTo=midpoint is the mirror image of dateFrom=midpoint above: it
    // should include only the memo created BEFORE the midpoint (Financial),
    // excluding the one created after (HR) — the opposite selection from
    // the dateFrom check, proving dateTo is actually wired in, not just
    // silently ignored while dateFrom happens to do all the work.
    const byDateTo = await request(app)
      .get(`/api/reports?dateTo=${midpoint.toISOString()}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(byDateTo.body.memosByStatus.draft).toBe(1);
    expect(byDateTo.body.memosByCategory.Financial).toBe(1);
    expect(byDateTo.body.memosByCategory.HR).toBe(0);

    const byDepartment = await request(app)
      .get(`/api/reports?department=${engineeringId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(byDepartment.body.memosByStatus.draft).toBe(1);
    expect(byDepartment.body.memosByCategory.Financial).toBe(1);
    expect(byDepartment.body.memosByCategory.HR).toBe(0);

    const byCategory = await request(app)
      .get('/api/reports?category=HR')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(byCategory.body.memosByStatus.draft).toBe(1);
    expect(byCategory.body.memosByDepartment).toEqual([{ department: 'Sales', count: 1 }]);

    const combinedNoMatch = await request(app)
      .get(`/api/reports?department=${engineeringId}&category=HR`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(combinedNoMatch.body.memosByStatus.draft).toBe(0);

    const combinedMatch = await request(app)
      .get(`/api/reports?department=${salesId}&category=HR`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(combinedMatch.body.memosByStatus.draft).toBe(1);

    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const excludeAll = await request(app)
      .get(`/api/reports?dateFrom=${future}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(excludeAll.status).toBe(200);
    expect(excludeAll.body.memosByStatus.draft).toBe(0);
    expect(excludeAll.body.urgentMemoCount).toBe(0);
    expect(excludeAll.body.averageWorkflowCompletionTime).toBeNull();
  });

  it('changeRequestCount counts multiple change-request cycles on the same memo as separate occurrences', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const adminToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, adminToken, 1);

    await request(app)
      .post(`/api/memos/${memoId}/request-changes`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ comment: 'Fix this' });
    await request(app).post(`/api/memos/${memoId}/resubmit`).set('Authorization', `Bearer ${adminToken}`);

    await request(app)
      .post(`/api/memos/${memoId}/request-changes`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ comment: 'Fix this again' });

    const response = await request(app).get('/api/reports').set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(response.body.changeRequestCount).toBe(2);
    // The snapshot view still shows one memo currently sitting in that
    // status — a different signal from the cumulative count above.
    expect(response.body.memosByStatus.changes_requested).toBe(1);
  });

  it('computes averageWorkflowCompletionTime correctly from known submittedAt/finalApprovedAt pairs, and returns null when none match the filter', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const adminToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const fixtureA = await createSubmittedWorkflow(app, organizationId, adminToken, 1);
    await request(app)
      .post(`/api/memos/${fixtureA.memoId}/approve`)
      .set('Authorization', `Bearer ${fixtureA.participants[0].token}`)
      .send({});

    const fixtureB = await createSubmittedWorkflow(app, organizationId, adminToken, 1);
    await request(app)
      .post(`/api/memos/${fixtureB.memoId}/approve`)
      .set('Authorization', `Bearer ${fixtureB.participants[0].token}`)
      .send({});

    const baseTime = new Date('2026-01-01T00:00:00.000Z');
    await Memo.updateOne(
      { _id: fixtureA.memoId },
      { $set: { submittedAt: baseTime, finalApprovedAt: new Date(baseTime.getTime() + 2 * 60 * 60 * 1000) } }
    );
    await Memo.updateOne(
      { _id: fixtureB.memoId },
      { $set: { submittedAt: baseTime, finalApprovedAt: new Date(baseTime.getTime() + 4 * 60 * 60 * 1000) } }
    );

    const response = await request(app).get('/api/reports').set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(response.body.averageWorkflowCompletionTime).toBeCloseTo(3, 5); // (2h + 4h) / 2

    const noMatch = await request(app)
      .get('/api/reports?category=Procurement')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(noMatch.status).toBe(200);
    expect(noMatch.body.averageWorkflowCompletionTime).toBeNull();
  });

  it("never returns another organization's data in any report field, even with matching filters", async () => {
    const orgA = await createOrganizationWithAdmin(app, { name: 'Report Org A' });
    const orgATokenAdmin = await loginAs(app, orgA.payload.adminEmail, orgA.payload.adminPassword);

    const orgB = await createOrganizationWithAdmin(app, { name: 'Report Org B' });
    const orgBTokenAdmin = await loginAs(app, orgB.payload.adminEmail, orgB.payload.adminPassword);

    await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${orgBTokenAdmin}`)
      .send({ subject: 'Org B Memo', body: 'b', category: 'HR', priority: 'urgent' });

    const responseAsA = await request(app)
      .get('/api/reports?category=HR')
      .set('Authorization', `Bearer ${orgATokenAdmin}`);
    expect(responseAsA.status).toBe(200);
    expect(responseAsA.body.memosByStatus.draft).toBe(0);
    expect(responseAsA.body.memosByCategory.HR).toBe(0);
    expect(responseAsA.body.urgentMemoCount).toBe(0);
    expect(responseAsA.body.memosByDepartment).toEqual([]);

    const responseAsB = await request(app)
      .get('/api/reports?category=HR')
      .set('Authorization', `Bearer ${orgBTokenAdmin}`);
    expect(responseAsB.body.memosByStatus.draft).toBe(1);
    expect(responseAsB.body.memosByCategory.HR).toBe(1);
    expect(responseAsB.body.urgentMemoCount).toBe(1);
  });
});
