const request = require('supertest');

const app = require('../src/app');
const Memo = require('../src/models/Memo');
const WorkflowStep = require('../src/models/WorkflowStep');
const WorkflowAction = require('../src/models/WorkflowAction');
const Notification = require('../src/models/Notification');
const { createOrganizationWithAdmin } = require('./helpers');
const { loginAs, createEmployee, createSubmittedWorkflow } = require('./workflowHelpers');

describe('Stage 13c: redirect', () => {
  it('rejects a non-current caller and an invalid target, then correctly redirects: WorkflowStep inserted at the midpoint, currentApproverId moves, the skipped participant remains pending history, and exactly one REDIRECTED action (no APPROVED) is recorded', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 3);
    const [current, next, future] = participants;

    const { user: nabeel, password: nabeelPassword } = await createEmployee(organizationId, { name: 'Nabeel' });

    // Only the current step holder may redirect.
    const unauthorizedAttempt = await request(app)
      .post(`/api/memos/${memoId}/redirect`)
      .set('Authorization', `Bearer ${next.token}`)
      .send({ userId: nabeel._id.toString(), comment: 'Not my turn' });
    expect(unauthorizedAttempt.status).toBe(403);

    // Target must belong to the same organization.
    const otherOrg = await createOrganizationWithAdmin(app, { name: 'Other Org Redirect' });
    const outsiderId = otherOrg.response.body.user._id;
    const crossOrgAttempt = await request(app)
      .post(`/api/memos/${memoId}/redirect`)
      .set('Authorization', `Bearer ${current.token}`)
      .send({ userId: outsiderId, comment: 'Cross-org' });
    expect(crossOrgAttempt.status).toBe(400);

    // Comment is required.
    const missingCommentAttempt = await request(app)
      .post(`/api/memos/${memoId}/redirect`)
      .set('Authorization', `Bearer ${current.token}`)
      .send({ userId: nabeel._id.toString() });
    expect(missingCommentAttempt.status).toBe(400);

    // Target already in the live route is rejected.
    const alreadyParticipantAttempt = await request(app)
      .post(`/api/memos/${memoId}/redirect`)
      .set('Authorization', `Bearer ${current.token}`)
      .send({ userId: next.user._id.toString(), comment: 'Already in the route' });
    expect(alreadyParticipantAttempt.status).toBe(400);

    // The real redirect.
    const redirectResponse = await request(app)
      .post(`/api/memos/${memoId}/redirect`)
      .set('Authorization', `Bearer ${current.token}`)
      .send({ userId: nabeel._id.toString(), comment: 'Nabeel knows this area better' });

    expect(redirectResponse.status).toBe(200);
    expect(redirectResponse.body.memo.status).toBe('submitted');
    expect(redirectResponse.body.memo.currentApproverId).toBe(nabeel._id.toString());
    // Midpoint of current (10) and next (20) is 15.
    expect(redirectResponse.body.memo.currentStepOrder).toBe(15);
    expect(redirectResponse.body.workflowStep.stepOrder).toBe(15);
    expect(redirectResponse.body.workflowStep.userId).toBe(nabeel._id.toString());

    const steps = await WorkflowStep.find({ memoId }).sort({ stepOrder: 1 });
    expect(steps.map((step) => step.stepOrder)).toEqual([10, 15, 20, 30]);

    expect(steps[0].userId.toString()).toBe(current.user._id.toString());
    expect(steps[0].status).toBe('approved');

    expect(steps[1].userId.toString()).toBe(nabeel._id.toString());
    expect(steps[1].status).toBe('pending');

    // The originally-next participant's step is untouched: still pending,
    // still in history, just no longer the reachable current step.
    expect(steps[2].userId.toString()).toBe(next.user._id.toString());
    expect(steps[2].status).toBe('pending');

    expect(steps[3].userId.toString()).toBe(future.user._id.toString());
    expect(steps[3].status).toBe('pending');

    const actions = await WorkflowAction.find({ memoId });
    const redirected = actions.filter((entry) => entry.action === 'REDIRECTED');
    expect(redirected).toHaveLength(1);
    expect(redirected[0].actor.toString()).toBe(current.user._id.toString());
    expect(redirected[0].recipient.toString()).toBe(nabeel._id.toString());
    expect(redirected[0].comment).toBe('Nabeel knows this area better');
    expect(redirected[0].versionNumber).toBe(1);

    // Critical rule: no separate APPROVED action for the same operation.
    expect(actions.filter((entry) => entry.action === 'APPROVED')).toHaveLength(0);

    const notifications = await Notification.find({ userId: nabeel._id, memoId });
    expect(notifications).toHaveLength(1);

    // The redirect target must be added to the LIVE workflowParticipants —
    // otherwise getMemoById's view-authorization (author or a listed
    // workflowParticipants entry) would 403 the target on every read
    // endpoint (GET memo, GET workflow, GET actions, GET versions, comments,
    // attachments), even though they can already act on it directly.
    // originalWorkflowParticipants (Stage 13a) must stay untouched.
    const memoAfterRedirect = await Memo.findById(memoId);
    expect(memoAfterRedirect.workflowParticipants.map(String)).toContain(nabeel._id.toString());
    expect(memoAfterRedirect.originalWorkflowParticipants.map(String)).not.toContain(nabeel._id.toString());

    const nabeelToken = await loginAs(app, nabeel.email, nabeelPassword);
    const nabeelViewsMemo = await request(app).get(`/api/memos/${memoId}`).set('Authorization', `Bearer ${nabeelToken}`);
    expect(nabeelViewsMemo.status).toBe(200);
  });
});

describe('Stage 13c: decline-and-redirect', () => {
  it('rejects a non-current caller and an invalid target, then correctly declines-and-redirects: current step becomes rejected, memo stays submitted, target step created at current+10, and exactly one DECLINED_REDIRECTED action (no DECLINED) is recorded', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    // A single participant, so current-stepOrder + 10 cannot collide with
    // any pre-existing step.
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);
    const [current] = participants;

    const { user: bystander, password: bystanderPassword } = await createEmployee(organizationId, {
      name: 'Bystander',
    });
    const bystanderToken = await loginAs(app, bystander.email, bystanderPassword);

    const { user: target, password: targetPassword } = await createEmployee(organizationId, {
      name: 'Decline Target',
    });

    const unauthorizedAttempt = await request(app)
      .post(`/api/memos/${memoId}/decline-redirect`)
      .set('Authorization', `Bearer ${bystanderToken}`)
      .send({ userId: target._id.toString(), comment: 'Not my turn' });
    expect(unauthorizedAttempt.status).toBe(403);

    const otherOrg = await createOrganizationWithAdmin(app, { name: 'Other Org Decline' });
    const outsiderId = otherOrg.response.body.user._id;
    const crossOrgAttempt = await request(app)
      .post(`/api/memos/${memoId}/decline-redirect`)
      .set('Authorization', `Bearer ${current.token}`)
      .send({ userId: outsiderId, comment: 'Cross-org' });
    expect(crossOrgAttempt.status).toBe(400);

    const missingCommentAttempt = await request(app)
      .post(`/api/memos/${memoId}/decline-redirect`)
      .set('Authorization', `Bearer ${current.token}`)
      .send({ userId: target._id.toString() });
    expect(missingCommentAttempt.status).toBe(400);

    const response = await request(app)
      .post(`/api/memos/${memoId}/decline-redirect`)
      .set('Authorization', `Bearer ${current.token}`)
      .send({ userId: target._id.toString(), comment: 'Not my area of expertise' });

    expect(response.status).toBe(200);
    expect(response.body.memo.status).toBe('submitted');
    expect(response.body.memo.currentApproverId).toBe(target._id.toString());
    expect(response.body.memo.currentStepOrder).toBe(20);

    const steps = await WorkflowStep.find({ memoId }).sort({ stepOrder: 1 });
    const currentStepInDb = steps.find((step) => step.userId.toString() === current.user._id.toString());
    expect(currentStepInDb.status).toBe('rejected');
    expect(currentStepInDb.comment).toBe('Not my area of expertise');

    const targetStepInDb = steps.find((step) => step.userId.toString() === target._id.toString());
    expect(targetStepInDb.status).toBe('pending');
    expect(targetStepInDb.stepOrder).toBe(20);

    const actions = await WorkflowAction.find({ memoId });
    const declinedRedirected = actions.filter((entry) => entry.action === 'DECLINED_REDIRECTED');
    expect(declinedRedirected).toHaveLength(1);
    expect(declinedRedirected[0].actor.toString()).toBe(current.user._id.toString());
    expect(declinedRedirected[0].recipient.toString()).toBe(target._id.toString());
    expect(declinedRedirected[0].comment).toBe('Not my area of expertise');

    // Critical rule: no separate DECLINED action for the same operation.
    expect(actions.filter((entry) => entry.action === 'DECLINED')).toHaveLength(0);

    const notifications = await Notification.find({ userId: target._id, memoId });
    expect(notifications).toHaveLength(1);

    // Same live-list requirement as redirect — the target must be able to
    // actually view the memo they now hold.
    const memoAfterDecline = await Memo.findById(memoId);
    expect(memoAfterDecline.workflowParticipants.map(String)).toContain(target._id.toString());
    expect(memoAfterDecline.originalWorkflowParticipants.map(String)).not.toContain(target._id.toString());

    const targetToken = await loginAs(app, target.email, targetPassword);
    const targetViewsMemo = await request(app).get(`/api/memos/${memoId}`).set('Authorization', `Bearer ${targetToken}`);
    expect(targetViewsMemo.status).toBe(200);
  });

  it('bug fix: succeeds (200) instead of a 409 duplicate-key error when current-stepOrder + 10 would collide with an existing (even removed) WorkflowStep, by using insertStepAfter\'s midpoint logic instead of a fixed offset', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    // A, B, C, D at stepOrders 10, 20, 30, 40.
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 4);
    const [a, b, c, d] = participants;

    await request(app).post(`/api/memos/${memoId}/approve`).set('Authorization', `Bearer ${a.token}`).send({});
    await request(app).post(`/api/memos/${memoId}/approve`).set('Authorization', `Bearer ${b.token}`).send({});
    // C is now current (stepOrder 30).

    // Remove D (future, pending, stepOrder 40) — its WorkflowStep row is
    // never deleted, only status-flipped to 'removed', and stays at
    // stepOrder 40. Under the old fixed-offset code, C's decline-redirect
    // below would compute 30 + 10 = 40 and collide with this exact row.
    const removeResponse = await request(app)
      .post(`/api/memos/${memoId}/workflow/remove-participant`)
      .set('Authorization', `Bearer ${c.token}`)
      .send({ userId: d.user._id.toString(), reason: 'No longer needed' });
    expect(removeResponse.status).toBe(200);

    const { user: farah } = await createEmployee(organizationId, { name: 'Farah' });
    const declineResponse = await request(app)
      .post(`/api/memos/${memoId}/decline-redirect`)
      .set('Authorization', `Bearer ${c.token}`)
      .send({ userId: farah._id.toString(), comment: 'Not my area of expertise' });

    expect(declineResponse.status).toBe(200);
    expect(declineResponse.body.memo.currentApproverId).toBe(farah._id.toString());
    // Midpoint of C's stepOrder (30) and D's still-existing row (40) is 35 —
    // strictly between the two, so it cannot collide with D's row at 40.
    expect(declineResponse.body.memo.currentStepOrder).toBe(35);
    expect(declineResponse.body.workflowStep.stepOrder).toBe(35);

    const steps = await WorkflowStep.find({ memoId }).sort({ stepOrder: 1 });
    expect(steps.map((step) => ({ stepOrder: step.stepOrder, status: step.status }))).toEqual([
      { stepOrder: 10, status: 'approved' },
      { stepOrder: 20, status: 'approved' },
      { stepOrder: 30, status: 'rejected' },
      { stepOrder: 35, status: 'pending' },
      { stepOrder: 40, status: 'removed' },
    ]);

    const declinedRedirected = await WorkflowAction.findOne({ memoId, action: 'DECLINED_REDIRECTED' });
    expect(declinedRedirected.recipient.toString()).toBe(farah._id.toString());
    expect(declinedRedirected.comment).toBe('Not my area of expertise');
  });
});

describe('Stage 13c: remove participant', () => {
  it('lets a past, a current, and a future participant each remove a different future participant, updates the live list, leaves the original route untouched, and records PARTICIPANT_REMOVED with no recipient', async () => {
    // Case 1: a PAST participant removes a FUTURE one.
    {
      const org = await createOrganizationWithAdmin(app);
      const organizationId = org.response.body.organization._id;
      const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
      const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 3);
      const [p1, p2, p3] = participants;

      await request(app).post(`/api/memos/${memoId}/approve`).set('Authorization', `Bearer ${p1.token}`).send({});

      const response = await request(app)
        .post(`/api/memos/${memoId}/workflow/remove-participant`)
        .set('Authorization', `Bearer ${p1.token}`)
        .send({ userId: p3.user._id.toString(), reason: 'No longer needed' });
      expect(response.status).toBe(200);

      const removedStep = await WorkflowStep.findOne({ memoId, userId: p3.user._id });
      expect(removedStep.status).toBe('removed');

      const memoInDb = await Memo.findById(memoId);
      expect(memoInDb.currentApproverId.toString()).toBe(p2.user._id.toString());
      expect(memoInDb.workflowParticipants.map(String)).not.toContain(p3.user._id.toString());
      expect(memoInDb.originalWorkflowParticipants.map(String)).toEqual([
        p1.user._id.toString(),
        p2.user._id.toString(),
        p3.user._id.toString(),
      ]);

      const action = await WorkflowAction.findOne({ memoId, action: 'PARTICIPANT_REMOVED' });
      expect(action.actor.toString()).toBe(p1.user._id.toString());
      expect(action.recipient).toBeUndefined();
      expect(action.comment).toBe('No longer needed');
    }

    // Case 2: the CURRENT participant removes a FUTURE one.
    {
      const org = await createOrganizationWithAdmin(app);
      const organizationId = org.response.body.organization._id;
      const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
      const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 3);
      const [q1, , q3] = participants;

      const response = await request(app)
        .post(`/api/memos/${memoId}/workflow/remove-participant`)
        .set('Authorization', `Bearer ${q1.token}`)
        .send({ userId: q3.user._id.toString(), reason: 'Reassigned elsewhere' });
      expect(response.status).toBe(200);

      const removedStep = await WorkflowStep.findOne({ memoId, userId: q3.user._id });
      expect(removedStep.status).toBe('removed');

      const memoInDb = await Memo.findById(memoId);
      // Removing a future participant must not move the current holder.
      expect(memoInDb.currentApproverId.toString()).toBe(q1.user._id.toString());
    }

    // Case 3: a FUTURE participant removes ANOTHER future participant.
    {
      const org = await createOrganizationWithAdmin(app);
      const organizationId = org.response.body.organization._id;
      const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
      const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 3);
      const [r1, r2, r3] = participants;

      const response = await request(app)
        .post(`/api/memos/${memoId}/workflow/remove-participant`)
        .set('Authorization', `Bearer ${r2.token}`)
        .send({ userId: r3.user._id.toString(), reason: 'Duplicate reviewer' });
      expect(response.status).toBe(200);

      const removedStep = await WorkflowStep.findOne({ memoId, userId: r3.user._id });
      expect(removedStep.status).toBe('removed');

      const memoInDb = await Memo.findById(memoId);
      expect(memoInDb.currentApproverId.toString()).toBe(r1.user._id.toString());
    }
  });

  it('rejects removing an already-acted participant, the current holder, a target with no WorkflowStep, and rejects a caller with no WorkflowStep at all', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 2);
    const [s1, s2] = participants;

    // s1 approves -> s1's step is now 'approved', s2 is current.
    await request(app).post(`/api/memos/${memoId}/approve`).set('Authorization', `Bearer ${s1.token}`).send({});

    // Cannot remove an already-acted participant.
    const alreadyActedAttempt = await request(app)
      .post(`/api/memos/${memoId}/workflow/remove-participant`)
      .set('Authorization', `Bearer ${s2.token}`)
      .send({ userId: s1.user._id.toString(), reason: 'Trying anyway' });
    expect(alreadyActedAttempt.status).toBe(400);

    // Cannot remove the current holder.
    const currentHolderAttempt = await request(app)
      .post(`/api/memos/${memoId}/workflow/remove-participant`)
      .set('Authorization', `Bearer ${s1.token}`)
      .send({ userId: s2.user._id.toString(), reason: 'Trying anyway' });
    expect(currentHolderAttempt.status).toBe(400);

    // A caller with no WorkflowStep on this memo at all gets 403.
    const { user: bystander, password: bystanderPassword } = await createEmployee(organizationId, {
      name: 'No-step Bystander',
    });
    const bystanderToken = await loginAs(app, bystander.email, bystanderPassword);
    const noStepCallerAttempt = await request(app)
      .post(`/api/memos/${memoId}/workflow/remove-participant`)
      .set('Authorization', `Bearer ${bystanderToken}`)
      .send({ userId: s2.user._id.toString(), reason: 'Trying anyway' });
    expect(noStepCallerAttempt.status).toBe(403);

    // A target with no WorkflowStep at all on this memo gets 400.
    const { user: outsider } = await createEmployee(organizationId, { name: 'No-step Target' });
    const noStepTargetAttempt = await request(app)
      .post(`/api/memos/${memoId}/workflow/remove-participant`)
      .set('Authorization', `Bearer ${s2.token}`)
      .send({ userId: outsider._id.toString(), reason: 'Trying anyway' });
    expect(noStepTargetAttempt.status).toBe(400);
  });
});

describe('Stage 13c: full end-to-end scenario', () => {
  it('A -> B -> C -> D: B redirects to Nabeel (live: A -> B -> Nabeel -> C -> D), Nabeel approves normally, D is removed before being reached, and the memo completes correctly via the remaining live route — the original route stays A -> B -> C -> D throughout', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 4, {
      subject: 'Stage 13c end-to-end memo',
      body: 'Body',
    });
    const [A, B, C, D] = participants;

    const approveA = await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${A.token}`)
      .send({});
    expect(approveA.status).toBe(200);
    expect(approveA.body.memo.currentApproverId).toBe(B.user._id.toString());

    const { user: nabeel, password: nabeelPassword } = await createEmployee(organizationId, { name: 'Nabeel' });
    const redirectResponse = await request(app)
      .post(`/api/memos/${memoId}/redirect`)
      .set('Authorization', `Bearer ${B.token}`)
      .send({ userId: nabeel._id.toString(), comment: 'Nabeel should handle this one' });
    expect(redirectResponse.status).toBe(200);
    expect(redirectResponse.body.memo.currentApproverId).toBe(nabeel._id.toString());

    const stepsAfterRedirect = await WorkflowStep.find({ memoId }).sort({ stepOrder: 1 });
    expect(stepsAfterRedirect.map((step) => step.userId.toString())).toEqual([
      A.user._id.toString(),
      B.user._id.toString(),
      nabeel._id.toString(),
      C.user._id.toString(),
      D.user._id.toString(),
    ]);
    expect(stepsAfterRedirect.map((step) => step.status)).toEqual([
      'approved',
      'approved',
      'pending',
      'pending',
      'pending',
    ]);

    const nabeelToken = await loginAs(app, nabeel.email, nabeelPassword);
    const approveNabeel = await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${nabeelToken}`)
      .send({});
    expect(approveNabeel.status).toBe(200);
    expect(approveNabeel.body.memo.currentApproverId).toBe(C.user._id.toString());

    const nabeelAction = await WorkflowAction.findOne({ memoId, action: 'APPROVED', actor: nabeel._id });
    expect(nabeelAction).toBeTruthy();
    expect(nabeelAction.recipient.toString()).toBe(C.user._id.toString());

    // Remove D before it's ever reached — C is current, D is still pending/future.
    const removeResponse = await request(app)
      .post(`/api/memos/${memoId}/workflow/remove-participant`)
      .set('Authorization', `Bearer ${C.token}`)
      .send({ userId: D.user._id.toString(), reason: 'No longer needed' });
    expect(removeResponse.status).toBe(200);

    const dStep = await WorkflowStep.findOne({ memoId, userId: D.user._id });
    expect(dStep.status).toBe('removed');

    const memoAfterRemoval = await Memo.findById(memoId);
    expect(memoAfterRemoval.currentApproverId.toString()).toBe(C.user._id.toString());
    expect(memoAfterRemoval.workflowParticipants.map(String)).not.toContain(D.user._id.toString());
    // The original route is permanently preserved — unaffected by either
    // the redirect (Nabeel was never part of it) or the removal.
    expect(memoAfterRemoval.originalWorkflowParticipants.map(String)).toEqual([
      A.user._id.toString(),
      B.user._id.toString(),
      C.user._id.toString(),
      D.user._id.toString(),
    ]);

    // C approves -> D was removed, not pending, so this is the final approval.
    const approveC = await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${C.token}`)
      .send({});
    expect(approveC.status).toBe(200);
    expect(approveC.body.memo.status).toBe('approved');
    expect(approveC.body.memo.finalApproverId).toBe(C.user._id.toString());
  });
});
