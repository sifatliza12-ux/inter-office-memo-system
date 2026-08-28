const request = require('supertest');

const app = require('../src/app');
const Memo = require('../src/models/Memo');
const WorkflowStep = require('../src/models/WorkflowStep');
const WorkflowAction = require('../src/models/WorkflowAction');
const MemoVersion = require('../src/models/MemoVersion');
const Notification = require('../src/models/Notification');
const { createOrganizationWithAdmin } = require('./helpers');
const { loginAs, createEmployee, createSubmittedWorkflow } = require('./workflowHelpers');

const rolePath = (memoId) => `/api/memos/${memoId}/workflow/role`;

describe('PATCH /api/memos/:id/workflow/role', () => {
  it('lets an authenticated participant set their own label, trimming leading/trailing whitespace', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    const response = await request(app)
      .patch(rolePath(memoId))
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ roleLabel: '  Legal Advisor  ' });

    expect(response.status).toBe(200);
    expect(response.body.workflowStep.roleLabel).toBe('Legal Advisor');

    const stepInDb = await WorkflowStep.findOne({ memoId, userId: participants[0].user._id });
    expect(stepInDb.roleLabel).toBe('Legal Advisor');
  });

  it('lets a future, a past, and the current participant each set their own label, independent of the others', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 3);
    const [p1, p2, p3] = participants;

    // p1 approves -> p1 becomes PAST, p2 becomes CURRENT, p3 stays FUTURE.
    await request(app).post(`/api/memos/${memoId}/approve`).set('Authorization', `Bearer ${p1.token}`).send({});

    const pastResponse = await request(app)
      .patch(rolePath(memoId))
      .set('Authorization', `Bearer ${p1.token}`)
      .send({ roleLabel: 'Past Reviewer' });
    expect(pastResponse.status).toBe(200);
    expect(pastResponse.body.workflowStep.roleLabel).toBe('Past Reviewer');

    const currentResponse = await request(app)
      .patch(rolePath(memoId))
      .set('Authorization', `Bearer ${p2.token}`)
      .send({ roleLabel: 'Current Approver' });
    expect(currentResponse.status).toBe(200);
    expect(currentResponse.body.workflowStep.roleLabel).toBe('Current Approver');

    const futureResponse = await request(app)
      .patch(rolePath(memoId))
      .set('Authorization', `Bearer ${p3.token}`)
      .send({ roleLabel: 'Future Signer' });
    expect(futureResponse.status).toBe(200);
    expect(futureResponse.body.workflowStep.roleLabel).toBe('Future Signer');

    const steps = await WorkflowStep.find({ memoId }).sort({ stepOrder: 1 });
    expect(steps.map((step) => step.roleLabel)).toEqual(['Past Reviewer', 'Current Approver', 'Future Signer']);
  });

  it('returns 401 for an unauthenticated request, before any workflow lookup', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    const response = await request(app).patch(rolePath(memoId)).send({ roleLabel: 'X' });
    expect(response.status).toBe(401);
  });

  it('returns 404 when the authenticated user is a same-org, non-participant', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    const { user: bystander, password: bystanderPassword } = await createEmployee(organizationId, {
      name: 'Bystander',
    });
    const bystanderToken = await loginAs(app, bystander.email, bystanderPassword);

    const response = await request(app)
      .patch(rolePath(memoId))
      .set('Authorization', `Bearer ${bystanderToken}`)
      .send({ roleLabel: 'X' });
    expect(response.status).toBe(404);
  });

  it('returns 403 and leaves both steps untouched when the body attempts to target another participant via userId, participantId, or workflowStepId', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 2);
    const [p1, p2] = participants;

    const targetStepBefore = await WorkflowStep.findOne({ memoId, userId: p2.user._id });

    const attemptViaUserId = await request(app)
      .patch(rolePath(memoId))
      .set('Authorization', `Bearer ${p1.token}`)
      .send({ userId: p2.user._id.toString(), roleLabel: 'Hijacked' });
    expect(attemptViaUserId.status).toBe(403);

    const attemptViaParticipantId = await request(app)
      .patch(rolePath(memoId))
      .set('Authorization', `Bearer ${p1.token}`)
      .send({ participantId: p2.user._id.toString(), roleLabel: 'Hijacked' });
    expect(attemptViaParticipantId.status).toBe(403);

    const attemptViaWorkflowStepId = await request(app)
      .patch(rolePath(memoId))
      .set('Authorization', `Bearer ${p1.token}`)
      .send({ workflowStepId: targetStepBefore._id.toString(), roleLabel: 'Hijacked' });
    expect(attemptViaWorkflowStepId.status).toBe(403);

    const targetStepAfter = await WorkflowStep.findOne({ memoId, userId: p2.user._id });
    expect(targetStepAfter.roleLabel).toBe(targetStepBefore.roleLabel);
    expect(targetStepAfter.roleLabel).toBeFalsy();

    const ownStepAfter = await WorkflowStep.findOne({ memoId, userId: p1.user._id });
    expect(ownStepAfter.roleLabel).toBeFalsy();
  });

  it('returns 404 for cross-tenant access, matching the established convention for other workflow endpoints', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    const otherOrg = await createOrganizationWithAdmin(app, { name: 'Other Org Role Label' });
    const otherOrgToken = await loginAs(app, otherOrg.payload.adminEmail, otherOrg.payload.adminPassword);

    const response = await request(app)
      .patch(rolePath(memoId))
      .set('Authorization', `Bearer ${otherOrgToken}`)
      .send({ roleLabel: 'X' });
    expect(response.status).toBe(404);
  });

  it('returns 400 for an invalid memo identifier, without an unhandled exception', async () => {
    const org = await createOrganizationWithAdmin(app);
    const adminToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const response = await request(app)
      .patch(rolePath('not-a-valid-object-id'))
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleLabel: 'X' });
    expect(response.status).toBe(400);
  });

  it('returns 400 for malformed JSON and for syntactically-valid JSON that is not an object', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    const malformed = await request(app)
      .patch(rolePath(memoId))
      .set('Authorization', `Bearer ${participants[0].token}`)
      .set('Content-Type', 'application/json')
      .send('{"roleLabel": "Legal Advisor"');
    expect(malformed.status).toBe(400);

    const nonObjectArray = await request(app)
      .patch(rolePath(memoId))
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send([]);
    expect(nonObjectArray.status).toBe(400);

    const nonObjectString = await request(app)
      .patch(rolePath(memoId))
      .set('Authorization', `Bearer ${participants[0].token}`)
      .set('Content-Type', 'application/json')
      .send('"just a string"');
    expect(nonObjectString.status).toBe(400);
  });

  it('returns 400 for a non-string roleLabel: number, boolean, array, or object', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);
    const token = participants[0].token;

    const numberAttempt = await request(app).patch(rolePath(memoId)).set('Authorization', `Bearer ${token}`).send({ roleLabel: 123 });
    expect(numberAttempt.status).toBe(400);

    const boolAttempt = await request(app).patch(rolePath(memoId)).set('Authorization', `Bearer ${token}`).send({ roleLabel: true });
    expect(boolAttempt.status).toBe(400);

    const arrayAttempt = await request(app).patch(rolePath(memoId)).set('Authorization', `Bearer ${token}`).send({ roleLabel: [] });
    expect(arrayAttempt.status).toBe(400);

    const objectAttempt = await request(app).patch(rolePath(memoId)).set('Authorization', `Bearer ${token}`).send({ roleLabel: {} });
    expect(objectAttempt.status).toBe(400);
  });

  it('returns 400 (not a silent truncation) when roleLabel exceeds 100 characters after trimming', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    const tooLong = `  ${'a'.repeat(101)}  `;
    const response = await request(app)
      .patch(rolePath(memoId))
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ roleLabel: tooLong });
    expect(response.status).toBe(400);

    const stepInDb = await WorkflowStep.findOne({ memoId, userId: participants[0].user._id });
    expect(stepInDb.roleLabel).toBeFalsy();

    // Exactly 100 (after trim) is accepted — confirms the boundary is ">100
    // rejected", not "off-by-one on the accepted side".
    const exactly100 = 'b'.repeat(100);
    const okResponse = await request(app)
      .patch(rolePath(memoId))
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ roleLabel: exactly100 });
    expect(okResponse.status).toBe(200);
    expect(okResponse.body.workflowStep.roleLabel).toBe(exactly100);
  });

  it('clears the label for an empty string, an omitted field, and a whitespace-only string', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);
    const token = participants[0].token;

    await request(app).patch(rolePath(memoId)).set('Authorization', `Bearer ${token}`).send({ roleLabel: 'Something' });

    const emptyString = await request(app).patch(rolePath(memoId)).set('Authorization', `Bearer ${token}`).send({ roleLabel: '' });
    expect(emptyString.status).toBe(200);
    expect(emptyString.body.workflowStep.roleLabel).toBeNull();

    await request(app).patch(rolePath(memoId)).set('Authorization', `Bearer ${token}`).send({ roleLabel: 'Something Again' });

    const omitted = await request(app).patch(rolePath(memoId)).set('Authorization', `Bearer ${token}`).send({});
    expect(omitted.status).toBe(200);
    expect(omitted.body.workflowStep.roleLabel).toBeNull();

    await request(app).patch(rolePath(memoId)).set('Authorization', `Bearer ${token}`).send({ roleLabel: 'Yet Again' });

    const whitespaceOnly = await request(app)
      .patch(rolePath(memoId))
      .set('Authorization', `Bearer ${token}`)
      .send({ roleLabel: '   ' });
    expect(whitespaceOnly.status).toBe(200);
    expect(whitespaceOnly.body.workflowStep.roleLabel).toBeNull();

    const stepInDb = await WorkflowStep.findOne({ memoId, userId: participants[0].user._id });
    expect(stepInDb.roleLabel).toBeFalsy();
  });

  it('is included in GET /api/memos/:id/workflow for the matching participant', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 2);

    await request(app)
      .patch(rolePath(memoId))
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ roleLabel: 'Legal Advisor' });

    const response = await request(app).get(`/api/memos/${memoId}/workflow`).set('Authorization', `Bearer ${authorToken}`);
    expect(response.status).toBe(200);
    const stepForP1 = response.body.workflowSteps.find(
      (step) => (step.userId?._id || step.userId) === participants[0].user._id.toString()
    );
    expect(stepForP1.roleLabel).toBe('Legal Advisor');
    const stepForP2 = response.body.workflowSteps.find(
      (step) => (step.userId?._id || step.userId) === participants[1].user._id.toString()
    );
    expect(stepForP2.roleLabel).toBeFalsy();
  });

  it('does not appear in GET /api/memos/:id, since that response never populates workflow-step data (documents current behavior, not a regression)', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    await request(app)
      .patch(rolePath(memoId))
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ roleLabel: 'Legal Advisor' });

    const response = await request(app).get(`/api/memos/${memoId}`).set('Authorization', `Bearer ${authorToken}`);
    expect(response.status).toBe(200);
    expect(response.body.memo).not.toHaveProperty('workflowSteps');
    expect(response.body.memo).not.toHaveProperty('roleLabel');
  });

  it('has no workflow side effects: no WorkflowAction, no notification, memo.status/currentApproverId/stepOrder/originalWorkflowParticipants unchanged, no MemoVersion created', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 2);

    const memoBefore = await Memo.findById(memoId);
    const stepsBefore = await WorkflowStep.find({ memoId }).sort({ stepOrder: 1 });
    const actionCountBefore = await WorkflowAction.countDocuments({ memoId });
    const notificationCountBefore = await Notification.countDocuments({ memoId });
    const versionCountBefore = await MemoVersion.countDocuments({ memoId });

    const response = await request(app)
      .patch(rolePath(memoId))
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ roleLabel: 'Legal Advisor' });
    expect(response.status).toBe(200);

    const memoAfter = await Memo.findById(memoId);
    expect(memoAfter.status).toBe(memoBefore.status);
    expect(String(memoAfter.currentApproverId)).toBe(String(memoBefore.currentApproverId));
    expect(memoAfter.currentStepOrder).toBe(memoBefore.currentStepOrder);
    expect(memoAfter.currentVersionNumber).toBe(memoBefore.currentVersionNumber);
    expect(memoAfter.originalWorkflowParticipants.map(String)).toEqual(memoBefore.originalWorkflowParticipants.map(String));
    expect(memoAfter.workflowParticipants.map(String)).toEqual(memoBefore.workflowParticipants.map(String));

    const stepsAfter = await WorkflowStep.find({ memoId }).sort({ stepOrder: 1 });
    expect(stepsAfter.map((step) => step.stepOrder)).toEqual(stepsBefore.map((step) => step.stepOrder));
    expect(stepsAfter.map((step) => step.status)).toEqual(stepsBefore.map((step) => step.status));

    expect(await WorkflowAction.countDocuments({ memoId })).toBe(actionCountBefore);
    expect(await Notification.countDocuments({ memoId })).toBe(notificationCountBefore);
    expect(await MemoVersion.countDocuments({ memoId })).toBe(versionCountBefore);
  });
});
