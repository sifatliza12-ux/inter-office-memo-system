const request = require('supertest');
const bcrypt = require('bcrypt');

const app = require('../src/app');
const User = require('../src/models/User');
const Memo = require('../src/models/Memo');
const { createOrganizationWithAdmin } = require('./helpers');

const loginAs = async (email, password) => {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  return response.body.token;
};

const createEmployee = async (organizationId, overrides = {}) => {
  const password = overrides.password || 'EmployeePass123';
  const email = overrides.email || `employee-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@acme.test`;
  const user = await User.create({
    organizationId,
    name: overrides.name || 'Regular Employee',
    email,
    password: await bcrypt.hash(password, 10),
    role: overrides.role || 'employee',
  });
  return { user, password };
};

describe('Memo CRUD and authorization', () => {
  it('lets the author create, view, edit, and delete their own draft', async () => {
    const org = await createOrganizationWithAdmin(app);
    const token = await loginAs(org.payload.adminEmail, org.payload.adminPassword);

    const createResponse = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'Test Memo', body: 'Body text', category: 'General', priority: 'normal' });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.memo.status).toBe('draft');
    expect(createResponse.body.memo.referenceNumber).toEqual(expect.any(String));
    const memoId = createResponse.body.memo._id;

    const getResponse = await request(app).get(`/api/memos/${memoId}`).set('Authorization', `Bearer ${token}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.memo.subject).toBe('Test Memo');

    const updateResponse = await request(app)
      .patch(`/api/memos/${memoId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'Updated Subject' });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.memo.subject).toBe('Updated Subject');

    const deleteResponse = await request(app).delete(`/api/memos/${memoId}`).set('Authorization', `Bearer ${token}`);
    expect(deleteResponse.status).toBe(204);

    const afterDelete = await Memo.findById(memoId);
    expect(afterDelete).toBeNull();
  });

  it('does not allow editing or deleting a submitted memo', async () => {
    const org = await createOrganizationWithAdmin(app);
    const token = await loginAs(org.payload.adminEmail, org.payload.adminPassword);
    const { user: participant } = await createEmployee(org.response.body.organization._id);

    const createResponse = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'Submit Me', body: 'Body', workflowParticipants: [participant._id.toString()] });
    const memoId = createResponse.body.memo._id;

    const submitResponse = await request(app)
      .post(`/api/memos/${memoId}/submit`)
      .set('Authorization', `Bearer ${token}`);
    expect(submitResponse.status).toBe(200);
    expect(submitResponse.body.memo.status).toBe('submitted');

    const editAttempt = await request(app)
      .patch(`/api/memos/${memoId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'Should not work' });
    expect(editAttempt.status).toBe(400);

    const deleteAttempt = await request(app).delete(`/api/memos/${memoId}`).set('Authorization', `Bearer ${token}`);
    expect(deleteAttempt.status).toBe(400);
  });

  it('rejects another same-org user from viewing, editing, or deleting a draft (403)', async () => {
    const org = await createOrganizationWithAdmin(app);
    const authorToken = await loginAs(org.payload.adminEmail, org.payload.adminPassword);
    const organizationId = org.response.body.organization._id;

    const createResponse = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ subject: 'Private Draft', body: 'Body' });
    const memoId = createResponse.body.memo._id;

    const { user: otherUser, password: otherPassword } = await createEmployee(organizationId);
    const otherToken = await loginAs(otherUser.email, otherPassword);

    const viewAttempt = await request(app).get(`/api/memos/${memoId}`).set('Authorization', `Bearer ${otherToken}`);
    expect(viewAttempt.status).toBe(403);

    const editAttempt = await request(app)
      .patch(`/api/memos/${memoId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ subject: 'Hijacked' });
    expect(editAttempt.status).toBe(403);

    const deleteAttempt = await request(app)
      .delete(`/api/memos/${memoId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(deleteAttempt.status).toBe(403);
  });

  it('restricts viewing a submitted memo to its author and its workflow participants', async () => {
    const org = await createOrganizationWithAdmin(app);
    const authorToken = await loginAs(org.payload.adminEmail, org.payload.adminPassword);
    const organizationId = org.response.body.organization._id;

    const { user: participant, password: participantPassword } = await createEmployee(organizationId, {
      name: 'Workflow Participant',
    });
    const { user: bystander, password: bystanderPassword } = await createEmployee(organizationId, {
      name: 'Uninvolved Bystander',
    });

    const createResponse = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        subject: 'Submitted memo with participants',
        body: 'Body',
        workflowParticipants: [participant._id.toString()],
      });
    const memoId = createResponse.body.memo._id;

    const submitResponse = await request(app)
      .post(`/api/memos/${memoId}/submit`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(submitResponse.status).toBe(200);

    const participantToken = await loginAs(participant.email, participantPassword);
    const participantView = await request(app)
      .get(`/api/memos/${memoId}`)
      .set('Authorization', `Bearer ${participantToken}`);
    expect(participantView.status).toBe(200);
    expect(participantView.body.memo._id).toBe(memoId);

    const bystanderToken = await loginAs(bystander.email, bystanderPassword);
    const bystanderView = await request(app)
      .get(`/api/memos/${memoId}`)
      .set('Authorization', `Bearer ${bystanderToken}`);
    expect(bystanderView.status).toBe(403);
  });

  it('rejects a user from another organization from viewing the memo (404)', async () => {
    const orgA = await createOrganizationWithAdmin(app, { name: 'Org A' });
    const orgB = await createOrganizationWithAdmin(app, { name: 'Org B' });
    const tokenA = await loginAs(orgA.payload.adminEmail, orgA.payload.adminPassword);
    const tokenB = await loginAs(orgB.payload.adminEmail, orgB.payload.adminPassword);

    const createResponse = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ subject: 'Org A memo', body: 'Body' });
    const memoId = createResponse.body.memo._id;

    const crossOrgAttempt = await request(app).get(`/api/memos/${memoId}`).set('Authorization', `Bearer ${tokenB}`);
    expect(crossOrgAttempt.status).toBe(404);
  });

  it('rejects creating or editing a memo with a department from another organization', async () => {
    const orgA = await createOrganizationWithAdmin(app, { name: 'Org A' });
    const orgB = await createOrganizationWithAdmin(app, { name: 'Org B' });
    const tokenA = await loginAs(orgA.payload.adminEmail, orgA.payload.adminPassword);
    const tokenB = await loginAs(orgB.payload.adminEmail, orgB.payload.adminPassword);

    const deptB = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Org B Dept' });
    const deptBId = deptB.body.department._id;

    const createAttempt = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ subject: 'Cross-org dept', body: 'Body', departmentId: deptBId });
    expect(createAttempt.status).toBe(400);

    const validMemo = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ subject: 'Valid memo', body: 'Body' });

    const editAttempt = await request(app)
      .patch(`/api/memos/${validMemo.body.memo._id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ departmentId: deptBId });
    expect(editAttempt.status).toBe(400);
  });

  it('rejects creating or editing a memo with a workflow participant from another organization', async () => {
    const orgA = await createOrganizationWithAdmin(app, { name: 'Org A' });
    const orgB = await createOrganizationWithAdmin(app, { name: 'Org B' });
    const tokenA = await loginAs(orgA.payload.adminEmail, orgA.payload.adminPassword);

    const outsiderId = orgB.response.body.user._id;

    const createAttempt = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ subject: 'Cross-org participant', body: 'Body', workflowParticipants: [outsiderId] });
    expect(createAttempt.status).toBe(400);

    const validMemo = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ subject: 'Valid memo', body: 'Body' });

    const editAttempt = await request(app)
      .patch(`/api/memos/${validMemo.body.memo._id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ workflowParticipants: [outsiderId] });
    expect(editAttempt.status).toBe(400);
  });

  it('rejects submitting a draft with no workflow participants', async () => {
    const org = await createOrganizationWithAdmin(app);
    const token = await loginAs(org.payload.adminEmail, org.payload.adminPassword);

    const createResponse = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'No participants', body: 'Body' });

    const submitResponse = await request(app)
      .post(`/api/memos/${createResponse.body.memo._id}/submit`)
      .set('Authorization', `Bearer ${token}`);

    expect(submitResponse.status).toBe(400);
  });

  it("defaults departmentId to the author's own department when not supplied", async () => {
    const org = await createOrganizationWithAdmin(app);
    const token = await loginAs(org.payload.adminEmail, org.payload.adminPassword);

    const dept = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Engineering' });
    const departmentId = dept.body.department._id;

    // Assign the admin to that department directly (no self-service endpoint
    // for this yet), then re-login so the JWT carries the departmentId.
    await User.findByIdAndUpdate(org.response.body.user._id, { departmentId });
    const reloggedToken = await loginAs(org.payload.adminEmail, org.payload.adminPassword);

    const createResponse = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${reloggedToken}`)
      .send({ subject: 'Defaulted department', body: 'Body' });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.memo.departmentId).toBe(departmentId);
  });

  it('supports filtering /api/memos/mine by status, category, and priority', async () => {
    const org = await createOrganizationWithAdmin(app);
    const token = await loginAs(org.payload.adminEmail, org.payload.adminPassword);

    await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'General normal', body: 'Body', category: 'General', priority: 'normal' });
    await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'Financial urgent', body: 'Body', category: 'Financial', priority: 'urgent' });

    const byCategory = await request(app)
      .get('/api/memos/mine?category=Financial')
      .set('Authorization', `Bearer ${token}`);
    expect(byCategory.body.memos).toHaveLength(1);
    expect(byCategory.body.memos[0].category).toBe('Financial');

    const byPriority = await request(app)
      .get('/api/memos/mine?priority=urgent')
      .set('Authorization', `Bearer ${token}`);
    expect(byPriority.body.memos).toHaveLength(1);

    const byStatus = await request(app).get('/api/memos/mine?status=draft').set('Authorization', `Bearer ${token}`);
    expect(byStatus.body.memos).toHaveLength(2);
  });

  it('only lists memos authored by the current user on /api/memos/mine', async () => {
    const org = await createOrganizationWithAdmin(app);
    const adminToken = await loginAs(org.payload.adminEmail, org.payload.adminPassword);
    const organizationId = org.response.body.organization._id;

    await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subject: 'Admin memo', body: 'Body' });

    const { user: otherUser, password: otherPassword } = await createEmployee(organizationId);
    const otherToken = await loginAs(otherUser.email, otherPassword);

    const mine = await request(app).get('/api/memos/mine').set('Authorization', `Bearer ${otherToken}`);
    expect(mine.status).toBe(200);
    expect(mine.body.memos).toHaveLength(0);
  });
});
