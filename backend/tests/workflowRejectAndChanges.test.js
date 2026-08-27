const request = require('supertest');

const app = require('../src/app');
const Memo = require('../src/models/Memo');
const WorkflowStep = require('../src/models/WorkflowStep');
const { createOrganizationWithAdmin } = require('./helpers');
const { loginAs, createSubmittedWorkflow } = require('./workflowHelpers');

describe('Workflow: reject', () => {
  it('requires a comment (400 when missing or empty)', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 2);

    const missing = await request(app)
      .post(`/api/memos/${memoId}/reject`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({});
    expect(missing.status).toBe(400);

    const empty = await request(app)
      .post(`/api/memos/${memoId}/reject`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ comment: '   ' });
    expect(empty.status).toBe(400);
  });

  it("sets memo status to 'rejected' and terminates the workflow — no further action succeeds", async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 2);

    const rejectResponse = await request(app)
      .post(`/api/memos/${memoId}/reject`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ comment: 'Not acceptable' });

    expect(rejectResponse.status).toBe(200);
    expect(rejectResponse.body.memo.status).toBe('rejected');
    expect(rejectResponse.body.memo.currentApproverId).toBeUndefined();

    const stepInDb = await WorkflowStep.findOne({ memoId, userId: participants[0].user._id });
    expect(stepInDb.status).toBe('rejected');
    expect(stepInDb.comment).toBe('Not acceptable');

    const approveAttempt = await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${participants[1].token}`)
      .send({});
    expect(approveAttempt.status).toBe(400);

    const rejectAgainAttempt = await request(app)
      .post(`/api/memos/${memoId}/reject`)
      .set('Authorization', `Bearer ${participants[1].token}`)
      .send({ comment: 'Too late' });
    expect(rejectAgainAttempt.status).toBe(400);

    const requestChangesAttempt = await request(app)
      .post(`/api/memos/${memoId}/request-changes`)
      .set('Authorization', `Bearer ${participants[1].token}`)
      .send({ comment: 'Too late' });
    expect(requestChangesAttempt.status).toBe(400);

    const addParticipantAttempt = await request(app)
      .post(`/api/memos/${memoId}/workflow/add-participant`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ userId: participants[1].user._id.toString(), reason: 'Too late' });
    expect(addParticipantAttempt.status).toBe(400);
  });
});

describe('Workflow: request changes', () => {
  it('requires a comment (400 when missing)', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 2);

    const response = await request(app)
      .post(`/api/memos/${memoId}/request-changes`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({});
    expect(response.status).toBe(400);
  });

  it("sets memo status to 'changes_requested' and clears currentApproverId", async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 3);

    const response = await request(app)
      .post(`/api/memos/${memoId}/request-changes`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ comment: 'Please revise the budget section' });

    expect(response.status).toBe(200);
    expect(response.body.memo.status).toBe('changes_requested');
    expect(response.body.memo.currentApproverId).toBeUndefined();

    const stepInDb = await WorkflowStep.findOne({ memoId, userId: participants[0].user._id });
    expect(stepInDb.status).toBe('changes_requested');
    expect(stepInDb.comment).toBe('Please revise the budget section');
  });
});

describe('Editing while changes_requested', () => {
  it('lets the author edit while status is changes_requested, but not a non-author', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 2);

    await request(app)
      .post(`/api/memos/${memoId}/request-changes`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ comment: 'Fix the numbers' });

    const authorEdit = await request(app)
      .patch(`/api/memos/${memoId}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ body: 'Revised body addressing the feedback' });
    expect(authorEdit.status).toBe(200);
    expect(authorEdit.body.memo.body).toBe('Revised body addressing the feedback');
    expect(authorEdit.body.memo.status).toBe('changes_requested');

    const nonAuthorEdit = await request(app)
      .patch(`/api/memos/${memoId}`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ body: 'Should not be allowed' });
    expect(nonAuthorEdit.status).toBe(403);
  });
});
