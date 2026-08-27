const request = require('supertest');

const app = require('../src/app');
const Memo = require('../src/models/Memo');
const WorkflowStep = require('../src/models/WorkflowStep');
const { createOrganizationWithAdmin } = require('./helpers');
const { loginAs, createSubmittedWorkflow } = require('./workflowHelpers');

describe('Workflow: approve', () => {
  it('lets the current participant approve and advances currentApproverId to the next step', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 3);

    const approveResponse = await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ comment: 'Looks good' });

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.memo.status).toBe('submitted');
    expect(approveResponse.body.memo.currentApproverId).toBe(participants[1].user._id.toString());

    const stepsInDb = await WorkflowStep.find({ memoId }).sort({ stepOrder: 1 });
    expect(stepsInDb[0].status).toBe('approved');
    expect(stepsInDb[0].comment).toBe('Looks good');
    expect(stepsInDb[0].actionDate).toBeInstanceOf(Date);
    expect(stepsInDb[1].status).toBe('pending');

    const memoInDb = await Memo.findById(memoId);
    expect(memoInDb.currentApproverId.toString()).toBe(participants[1].user._id.toString());
    expect(memoInDb.currentStepOrder).toBe(stepsInDb[1].stepOrder);
  });

  it('rejects a future participant attempting to approve out of turn', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 3);

    const response = await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${participants[2].token}`)
      .send({});

    expect(response.status).toBe(403);

    const memoInDb = await Memo.findById(memoId);
    expect(memoInDb.status).toBe('submitted');
  });

  it('rejects a past participant attempting to approve again', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 3);

    await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({});

    const secondAttempt = await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({});

    expect(secondAttempt.status).toBe(403);
  });

  it('sets status to approved, records finalApproverId/finalApprovedAt, and clears currentApproverId on the last step', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 2);

    await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({});

    const finalResponse = await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${participants[1].token}`)
      .send({});

    expect(finalResponse.status).toBe(200);
    expect(finalResponse.body.memo.status).toBe('approved');
    expect(finalResponse.body.memo.finalApproverId).toBe(participants[1].user._id.toString());
    expect(finalResponse.body.memo.finalApprovedAt).toEqual(expect.any(String));
    expect(finalResponse.body.memo.currentApproverId).toBeUndefined();
    expect(finalResponse.body.memo.currentStepOrder).toBeUndefined();

    const memoInDb = await Memo.findById(memoId);
    expect(memoInDb.status).toBe('approved');
    expect(memoInDb.currentApproverId).toBeUndefined();
    expect(memoInDb.currentStepOrder).toBeUndefined();
    expect(memoInDb.finalApprovedAt).toBeInstanceOf(Date);
  });
});
