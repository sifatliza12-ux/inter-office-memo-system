const request = require('supertest');

const app = require('../src/app');
const { createOrganizationWithAdmin } = require('./helpers');
const { loginAs, createEmployee, createSubmittedWorkflow } = require('./workflowHelpers');

describe('GET /api/memos/:id/workflow', () => {
  it('returns steps in stepOrder order with correct status/comment/actionDate and populated participant names', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 2);

    await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ comment: 'First approval' });

    const response = await request(app)
      .get(`/api/memos/${memoId}/workflow`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(response.status).toBe(200);
    const { workflowSteps } = response.body;
    expect(workflowSteps).toHaveLength(2);
    expect(workflowSteps.map((step) => step.stepOrder)).toEqual([10, 20]);
    expect(workflowSteps[0].status).toBe('approved');
    expect(workflowSteps[0].comment).toBe('First approval');
    expect(workflowSteps[0].actionDate).toEqual(expect.any(String));
    expect(workflowSteps[0].userId.name).toBe('Participant 1');
    expect(workflowSteps[1].status).toBe('pending');
  });

  it('enforces the same view-authorization as memo detail: participants can view, an uninvolved same-org user cannot (403), another org gets 404', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 2);

    const participantView = await request(app)
      .get(`/api/memos/${memoId}/workflow`)
      .set('Authorization', `Bearer ${participants[1].token}`);
    expect(participantView.status).toBe(200);

    const { user: bystander, password: bystanderPassword } = await createEmployee(organizationId, {
      name: 'Bystander',
    });
    const bystanderToken = await loginAs(app, bystander.email, bystanderPassword);
    const bystanderView = await request(app)
      .get(`/api/memos/${memoId}/workflow`)
      .set('Authorization', `Bearer ${bystanderToken}`);
    expect(bystanderView.status).toBe(403);

    const otherOrg = await createOrganizationWithAdmin(app, { name: 'Other Org' });
    const otherOrgToken = await loginAs(app, otherOrg.payload.adminEmail, otherOrg.payload.adminPassword);
    const crossOrgView = await request(app)
      .get(`/api/memos/${memoId}/workflow`)
      .set('Authorization', `Bearer ${otherOrgToken}`);
    expect(crossOrgView.status).toBe(404);
  });
});
