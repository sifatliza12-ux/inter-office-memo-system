const request = require('supertest');

const app = require('../src/app');
const Memo = require('../src/models/Memo');
const WorkflowStep = require('../src/models/WorkflowStep');
const { createOrganizationWithAdmin } = require('./helpers');
const { loginAs, createSubmittedWorkflow } = require('./workflowHelpers');

describe('Workflow: resubmit', () => {
  it('rejects resubmit from a non-author, and from a memo that is not changes_requested', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 2);

    // Still 'submitted', not 'changes_requested' yet.
    const wrongStateAttempt = await request(app)
      .post(`/api/memos/${memoId}/resubmit`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(wrongStateAttempt.status).toBe(400);

    await request(app)
      .post(`/api/memos/${memoId}/request-changes`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ comment: 'Fix it' });

    const nonAuthorAttempt = await request(app)
      .post(`/api/memos/${memoId}/resubmit`)
      .set('Authorization', `Bearer ${participants[0].token}`);
    expect(nonAuthorAttempt.status).toBe(403);
  });

  it('matches the worked example exactly: A(10)/B(20) approved, C(30) requests changes, resubmit inserts C at 35, D(40) untouched', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 4);
    const [participantA, participantB, participantC, participantD] = participants;

    // A(10) approves.
    const approveA = await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${participantA.token}`)
      .send({});
    expect(approveA.status).toBe(200);

    // B(20) approves.
    const approveB = await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${participantB.token}`)
      .send({});
    expect(approveB.status).toBe(200);

    // C(30) requests changes.
    const requestChangesC = await request(app)
      .post(`/api/memos/${memoId}/request-changes`)
      .set('Authorization', `Bearer ${participantC.token}`)
      .send({ comment: 'Please revise section 3' });
    expect(requestChangesC.status).toBe(200);
    expect(requestChangesC.body.memo.status).toBe('changes_requested');

    const stepsBeforeResubmit = await WorkflowStep.find({ memoId }).sort({ stepOrder: 1 });
    expect(stepsBeforeResubmit.map((step) => step.stepOrder)).toEqual([10, 20, 30, 40]);
    expect(stepsBeforeResubmit[2].status).toBe('changes_requested');
    expect(stepsBeforeResubmit[2].comment).toBe('Please revise section 3');

    // Author edits, then resubmits.
    await request(app)
      .patch(`/api/memos/${memoId}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ body: 'Revised section 3' });

    const resubmitResponse = await request(app)
      .post(`/api/memos/${memoId}/resubmit`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(resubmitResponse.status).toBe(200);
    expect(resubmitResponse.body.memo.status).toBe('submitted');
    expect(resubmitResponse.body.memo.currentApproverId).toBe(participantC.user._id.toString());
    expect(resubmitResponse.body.memo.currentStepOrder).toBe(35);

    const stepsAfterResubmit = await WorkflowStep.find({ memoId }).sort({ stepOrder: 1 });
    expect(stepsAfterResubmit).toHaveLength(5);
    expect(stepsAfterResubmit.map((step) => step.stepOrder)).toEqual([10, 20, 30, 35, 40]);

    // The old stepOrder-30 changes_requested record is untouched, permanent history.
    const oldStepC = stepsAfterResubmit.find((step) => step.stepOrder === 30);
    expect(oldStepC.status).toBe('changes_requested');
    expect(oldStepC.comment).toBe('Please revise section 3');
    expect(oldStepC.userId.toString()).toBe(participantC.user._id.toString());

    // The new stepOrder-35 step is a fresh pending step for the same participant C.
    const newStepC = stepsAfterResubmit.find((step) => step.stepOrder === 35);
    expect(newStepC.status).toBe('pending');
    expect(newStepC.userId.toString()).toBe(participantC.user._id.toString());
    expect(newStepC.comment).toBeUndefined();

    // D's original step (40) is untouched.
    const stepD = stepsAfterResubmit.find((step) => step.stepOrder === 40);
    expect(stepD.status).toBe('pending');
    expect(stepD.userId.toString()).toBe(participantD.user._id.toString());

    const memoInDb = await Memo.findById(memoId);
    expect(memoInDb.currentStepOrder).toBe(35);
    expect(memoInDb.currentApproverId.toString()).toBe(participantC.user._id.toString());
  });

  it('uses reference + 10 when the changes-requested step was the last one', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 2);

    await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({});

    await request(app)
      .post(`/api/memos/${memoId}/request-changes`)
      .set('Authorization', `Bearer ${participants[1].token}`)
      .send({ comment: 'One more pass' });

    const resubmitResponse = await request(app)
      .post(`/api/memos/${memoId}/resubmit`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(resubmitResponse.status).toBe(200);
    expect(resubmitResponse.body.memo.currentStepOrder).toBe(30);

    const steps = await WorkflowStep.find({ memoId }).sort({ stepOrder: 1 });
    expect(steps.map((step) => step.stepOrder)).toEqual([10, 20, 30]);
    expect(steps[2].status).toBe('pending');
    expect(steps[2].userId.toString()).toBe(participants[1].user._id.toString());
  });
});
