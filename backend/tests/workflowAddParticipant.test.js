const request = require('supertest');

const app = require('../src/app');
const AuditLog = require('../src/models/AuditLog');
const WorkflowStep = require('../src/models/WorkflowStep');
const { createOrganizationWithAdmin } = require('./helpers');
const { loginAs, createEmployee, createSubmittedWorkflow } = require('./workflowHelpers');

describe('Workflow: add participant', () => {
  it('lets a PAST participant add a new one, inserted right after the CURRENT step, and the full chain resolves correctly', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 3);
    const [p1, p2, p3] = participants;

    // P1 approves -> current becomes P2. P1 is now a PAST participant.
    await request(app).post(`/api/memos/${memoId}/approve`).set('Authorization', `Bearer ${p1.token}`).send({});

    const { user: extra, password: extraPassword } = await createEmployee(organizationId, {
      name: 'Extra Participant',
    });

    const addResponse = await request(app)
      .post(`/api/memos/${memoId}/workflow/add-participant`)
      .set('Authorization', `Bearer ${p1.token}`)
      .send({ userId: extra._id.toString(), reason: 'Needs finance sign-off' });

    expect(addResponse.status).toBe(201);
    // Midpoint of the current step (P2, 20) and the next one (P3, 30) — not
    // adjacent to P1's own (already-used) step at 10.
    expect(addResponse.body.workflowStep.stepOrder).toBe(25);
    expect(addResponse.body.workflowStep.userId).toBe(extra._id.toString());
    // Adding a participant never changes whose turn it currently is.
    expect(addResponse.body.memo.currentApproverId).toBe(p2.user._id.toString());

    const extraToken = await loginAs(app, extra.email, extraPassword);

    const approveP2 = await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${p2.token}`)
      .send({});
    expect(approveP2.body.memo.currentApproverId).toBe(extra._id.toString());

    const approveExtra = await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${extraToken}`)
      .send({});
    expect(approveExtra.body.memo.currentApproverId).toBe(p3.user._id.toString());

    const approveP3 = await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${p3.token}`)
      .send({});
    expect(approveP3.body.memo.status).toBe('approved');
    expect(approveP3.body.memo.finalApproverId).toBe(p3.user._id.toString());
  });

  it("lets a FUTURE participant add a new one, inserted right after the CURRENT step (not adjacent to the requester's own step), and the full chain resolves correctly", async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 3);
    const [p1, p2, p3] = participants;

    // P1 is current (step 10). P3 is a FUTURE participant (step 30, not reached).
    const { user: extra, password: extraPassword } = await createEmployee(organizationId, {
      name: 'Extra Participant',
    });

    const addResponse = await request(app)
      .post(`/api/memos/${memoId}/workflow/add-participant`)
      .set('Authorization', `Bearer ${p3.token}`)
      .send({ userId: extra._id.toString(), reason: 'Needs legal review' });

    expect(addResponse.status).toBe(201);
    // Midpoint of the CURRENT step (P1, 10) and the next one (P2, 20) — not
    // adjacent to P3's own future step at 30.
    expect(addResponse.body.workflowStep.stepOrder).toBe(15);
    expect(addResponse.body.memo.currentApproverId).toBe(p1.user._id.toString());

    const extraToken = await loginAs(app, extra.email, extraPassword);

    const approveP1 = await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${p1.token}`)
      .send({});
    expect(approveP1.body.memo.currentApproverId).toBe(extra._id.toString());

    const approveExtra = await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${extraToken}`)
      .send({});
    expect(approveExtra.body.memo.currentApproverId).toBe(p2.user._id.toString());

    const approveP2 = await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${p2.token}`)
      .send({});
    expect(approveP2.body.memo.currentApproverId).toBe(p3.user._id.toString());

    const approveP3 = await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${p3.token}`)
      .send({});
    expect(approveP3.body.memo.status).toBe('approved');
  });

  it('rejects a same-org user with no WorkflowStep at all, and rejects the author when the author is not separately a participant', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId } = await createSubmittedWorkflow(app, organizationId, authorToken, 2);

    const { user: bystander, password: bystanderPassword } = await createEmployee(organizationId, {
      name: 'Uninvolved Bystander',
    });
    const bystanderToken = await loginAs(app, bystander.email, bystanderPassword);

    const { user: candidate } = await createEmployee(organizationId, { name: 'Candidate' });

    const bystanderAttempt = await request(app)
      .post(`/api/memos/${memoId}/workflow/add-participant`)
      .set('Authorization', `Bearer ${bystanderToken}`)
      .send({ userId: candidate._id.toString(), reason: 'Why not' });
    expect(bystanderAttempt.status).toBe(403);

    // The org admin created the memo as its author but is not listed as a
    // workflow participant themself, so this action is still 403 for them.
    const authorAttempt = await request(app)
      .post(`/api/memos/${memoId}/workflow/add-participant`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ userId: candidate._id.toString(), reason: 'Why not' });
    expect(authorAttempt.status).toBe(403);
  });

  it('rejects a userId from another organization, and a userId already present in the workflow', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 2);

    const otherOrg = await createOrganizationWithAdmin(app, { name: 'Other Org' });
    const outsiderId = otherOrg.response.body.user._id;

    const crossOrgAttempt = await request(app)
      .post(`/api/memos/${memoId}/workflow/add-participant`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ userId: outsiderId, reason: 'Cross-org' });
    expect(crossOrgAttempt.status).toBe(400);

    const alreadyParticipantAttempt = await request(app)
      .post(`/api/memos/${memoId}/workflow/add-participant`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ userId: participants[1].user._id.toString(), reason: 'Already here' });
    expect(alreadyParticipantAttempt.status).toBe(400);
  });

  it('creates exactly one AuditLog document attributing the addition to the actual requester, even a non-current one', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 3);
    const [p1, , p3] = participants;

    // P1 approves so P3 (a FUTURE, non-current participant) makes the request.
    await request(app).post(`/api/memos/${memoId}/approve`).set('Authorization', `Bearer ${p1.token}`).send({});

    const { user: candidate } = await createEmployee(organizationId, { name: 'Candidate' });

    const response = await request(app)
      .post(`/api/memos/${memoId}/workflow/add-participant`)
      .set('Authorization', `Bearer ${p3.token}`)
      .send({ userId: candidate._id.toString(), reason: 'Needs compliance review' });
    expect(response.status).toBe(201);

    const auditLogs = await AuditLog.find({ organizationId, eventType: 'WORKFLOW_PARTICIPANT_ADDED' });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].userId.toString()).toBe(p3.user._id.toString());
    expect(auditLogs[0].organizationId.toString()).toBe(organizationId);
    expect(auditLogs[0].description).toContain('Candidate');
    expect(auditLogs[0].description).toContain('Needs compliance review');
  });

  it('falls back to renumbering when no integer gap remains, producing a correct, still-ordered result', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 2);

    // Directly engineer the exact condition the renumbering fallback exists
    // for: shrink the gap between the current step (10) and the next one
    // (originally 20) down to 1, leaving no integer midpoint available.
    await WorkflowStep.findOneAndUpdate(
      { memoId, userId: participants[1].user._id },
      { stepOrder: 11 }
    );

    const { user: candidate } = await createEmployee(organizationId, { name: 'Squeezed In' });

    const response = await request(app)
      .post(`/api/memos/${memoId}/workflow/add-participant`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ userId: candidate._id.toString(), reason: 'Tight fit' });

    expect(response.status).toBe(201);

    const stepsInDb = await WorkflowStep.find({ memoId }).sort({ stepOrder: 1 });

    // The squeezed step (participants[1], originally forced to 11) was
    // renumbered to 20 (current + 10); the new participant was then inserted
    // at the midpoint of 10 and 20 — a correct, still strictly-ascending
    // result rather than a collision or corrupted order.
    expect(stepsInDb.map((step) => step.stepOrder)).toEqual([10, 15, 20]);
    expect(stepsInDb[0].userId.toString()).toBe(participants[0].user._id.toString());
    expect(stepsInDb[1].userId.toString()).toBe(candidate._id.toString());
    expect(stepsInDb[1].status).toBe('pending');
    expect(stepsInDb[2].userId.toString()).toBe(participants[1].user._id.toString());
    expect(stepsInDb[2].status).toBe('pending');
  });

  it('does not change currentStepSince — adding a participant never changes whose turn it currently is', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 2);

    const before = await request(app).get(`/api/memos/${memoId}`).set('Authorization', `Bearer ${authorToken}`);
    expect(before.body.memo.currentStepSince).toEqual(expect.any(String));

    const { user: extra } = await createEmployee(organizationId, { name: 'Extra Participant' });

    const addResponse = await request(app)
      .post(`/api/memos/${memoId}/workflow/add-participant`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ userId: extra._id.toString(), reason: 'Needs an extra pair of eyes' });

    expect(addResponse.status).toBe(201);
    // currentApproverId is unchanged (add-participant inserts after the
    // current step, never at it), so currentStepSince — which only ever
    // moves when currentApproverId does — must be the exact same value too,
    // not just "close in time".
    expect(addResponse.body.memo.currentApproverId).toBe(participants[0].user._id.toString());
    expect(addResponse.body.memo.currentStepSince).toBe(before.body.memo.currentStepSince);
  });
});
