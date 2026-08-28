const request = require('supertest');

const app = require('../src/app');
const WorkflowAction = require('../src/models/WorkflowAction');
const { createOrganizationWithAdmin } = require('./helpers');
const { loginAs, createEmployee, createSubmittedWorkflow } = require('./workflowHelpers');

describe('Stage 13b: workflow action log', () => {
  it('records a correct WorkflowAction for submit, approve, add-participant, request-changes, resubmit, and a second approve — in chronological order, with versionNumber tracking the resubmit', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 3);
    const [p1, p2, p3] = participants;

    // 1. MEMO_SUBMITTED (already happened inside createSubmittedWorkflow).

    // 2. p1 approves -> current becomes p2.
    const approve1 = await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${p1.token}`)
      .send({ comment: 'Looks fine to me' });
    expect(approve1.status).toBe(200);

    // 3. p1 (past participant) adds p4 while status is still 'submitted'.
    const { user: p4, password: p4Password } = await createEmployee(organizationId, { name: 'Participant 4' });
    const addResponse = await request(app)
      .post(`/api/memos/${memoId}/workflow/add-participant`)
      .set('Authorization', `Bearer ${p1.token}`)
      .send({ userId: p4._id.toString(), reason: 'Needs finance sign-off' });
    expect(addResponse.status).toBe(201);

    // 4. p2 (current) requests changes.
    const requestChangesResponse = await request(app)
      .post(`/api/memos/${memoId}/request-changes`)
      .set('Authorization', `Bearer ${p2.token}`)
      .send({ comment: 'Please revise section 2' });
    expect(requestChangesResponse.status).toBe(200);

    // 5. Author edits, then resubmits -> version 2. Re-inserts p2.
    await request(app)
      .patch(`/api/memos/${memoId}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ body: 'Revised body' });
    const resubmitResponse = await request(app)
      .post(`/api/memos/${memoId}/resubmit`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(resubmitResponse.status).toBe(200);
    expect(resubmitResponse.body.memo.currentVersionNumber).toBe(2);

    // 6. p2 approves again (the new post-resubmit step) -> current becomes p4.
    const p4Token = await loginAs(app, p4.email, p4Password);
    const approve2 = await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${p2.token}`)
      .send({});
    expect(approve2.status).toBe(200);
    expect(approve2.body.memo.currentApproverId).toBe(p4._id.toString());

    // 7. p4 approves -> current becomes p3.
    const approve3 = await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${p4Token}`)
      .send({});
    expect(approve3.status).toBe(200);
    expect(approve3.body.memo.currentApproverId).toBe(p3.user._id.toString());

    // 8. p3 approves -> final approval, no recipient.
    const approve4 = await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${p3.token}`)
      .send({});
    expect(approve4.status).toBe(200);
    expect(approve4.body.memo.status).toBe('approved');

    const actionsResponse = await request(app)
      .get(`/api/memos/${memoId}/actions`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(actionsResponse.status).toBe(200);

    const actions = actionsResponse.body.actions;
    expect(actions).toHaveLength(8);

    // Chronological order, matching the sequence performed above exactly.
    expect(actions.map((entry) => entry.action)).toEqual([
      'MEMO_SUBMITTED',
      'APPROVED',
      'PARTICIPANT_ADDED',
      'CHANGES_REQUESTED',
      'RESUBMITTED',
      'APPROVED',
      'APPROVED',
      'APPROVED',
    ]);

    // 1. MEMO_SUBMITTED
    expect(actions[0].actor.name).toBeTruthy();
    expect(actions[0].recipient._id).toBe(p1.user._id.toString());
    expect(actions[0].versionNumber).toBe(1);

    // 2. APPROVED (p1 -> p2), still version 1, comment carried through.
    expect(actions[1].actor._id).toBe(p1.user._id.toString());
    expect(actions[1].recipient._id).toBe(p2.user._id.toString());
    expect(actions[1].comment).toBe('Looks fine to me');
    expect(actions[1].versionNumber).toBe(1);

    // 3. PARTICIPANT_ADDED (p1 adds p4), comment is the reason, version 1.
    expect(actions[2].actor._id).toBe(p1.user._id.toString());
    expect(actions[2].recipient._id).toBe(p4._id.toString());
    expect(actions[2].comment).toBe('Needs finance sign-off');
    expect(actions[2].versionNumber).toBe(1);

    // 4. CHANGES_REQUESTED (p2), no recipient, version 1.
    expect(actions[3].actor._id).toBe(p2.user._id.toString());
    expect(actions[3].recipient).toBeUndefined();
    expect(actions[3].comment).toBe('Please revise section 2');
    expect(actions[3].versionNumber).toBe(1);

    // 5. RESUBMITTED (author), recipient is p2 again, NEW version (2).
    expect(actions[4].actor._id).toBe(org.response.body.user._id);
    expect(actions[4].recipient._id).toBe(p2.user._id.toString());
    expect(actions[4].versionNumber).toBe(2);

    // 6-8. APPROVED chain after resubmit, all version 2.
    expect(actions[5].actor._id).toBe(p2.user._id.toString());
    expect(actions[5].recipient._id).toBe(p4._id.toString());
    expect(actions[5].versionNumber).toBe(2);

    expect(actions[6].actor._id).toBe(p4._id.toString());
    expect(actions[6].recipient._id).toBe(p3.user._id.toString());
    expect(actions[6].versionNumber).toBe(2);

    // Final approval: no recipient.
    expect(actions[7].actor._id).toBe(p3.user._id.toString());
    expect(actions[7].recipient).toBeUndefined();
    expect(actions[7].versionNumber).toBe(2);
  });

  it('records a DECLINED action with the required comment and no recipient', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    const rejectResponse = await request(app)
      .post(`/api/memos/${memoId}/reject`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ comment: 'Not approved, does not meet policy' });
    expect(rejectResponse.status).toBe(200);

    const actions = await WorkflowAction.find({ memoId });
    const declined = actions.find((entry) => entry.action === 'DECLINED');
    expect(declined).toBeTruthy();
    expect(declined.actor.toString()).toBe(participants[0].user._id.toString());
    expect(declined.comment).toBe('Not approved, does not meet policy');
    expect(declined.recipient).toBeUndefined();
    expect(declined.versionNumber).toBe(1);
  });

  it('does not fail the triggering action when WorkflowAction.create throws (resilience)', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const participant = await createEmployee(organizationId);

    const createResponse = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ subject: 'Resilience Test Memo', body: 'Body', workflowParticipants: [participant.user._id.toString()] });
    const memoId = createResponse.body.memo._id;

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const createSpy = jest.spyOn(WorkflowAction, 'create').mockRejectedValueOnce(new Error('Simulated failure'));

    const submitResponse = await request(app)
      .post(`/api/memos/${memoId}/submit`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(submitResponse.status).toBe(200);
    expect(submitResponse.body.memo.status).toBe('submitted');
    expect(consoleErrorSpy).toHaveBeenCalled();

    const actions = await WorkflowAction.find({ memoId });
    expect(actions).toHaveLength(0);

    createSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('GET /api/memos/:id/actions: author and participants can view, an uninvolved same-org user gets 403, another org gets 404', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    const { user: bystander, password: bystanderPassword } = await createEmployee(organizationId, {
      name: 'Uninvolved Bystander',
    });
    const bystanderToken = await loginAs(app, bystander.email, bystanderPassword);

    const otherOrg = await createOrganizationWithAdmin(app, { name: 'Other Org' });
    const otherOrgToken = await loginAs(app, otherOrg.payload.adminEmail, otherOrg.payload.adminPassword);

    const authorView = await request(app)
      .get(`/api/memos/${memoId}/actions`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(authorView.status).toBe(200);
    expect(authorView.body.actions.length).toBeGreaterThan(0);

    const participantView = await request(app)
      .get(`/api/memos/${memoId}/actions`)
      .set('Authorization', `Bearer ${participants[0].token}`);
    expect(participantView.status).toBe(200);

    const bystanderView = await request(app)
      .get(`/api/memos/${memoId}/actions`)
      .set('Authorization', `Bearer ${bystanderToken}`);
    expect(bystanderView.status).toBe(403);

    const otherOrgView = await request(app)
      .get(`/api/memos/${memoId}/actions`)
      .set('Authorization', `Bearer ${otherOrgToken}`);
    expect(otherOrgView.status).toBe(404);
  });

  it('has no PATCH or DELETE route for workflow actions — a guessed one 404s for an authenticated, authorized user, not 403', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    const actionsResponse = await request(app)
      .get(`/api/memos/${memoId}/actions`)
      .set('Authorization', `Bearer ${authorToken}`);
    const actionId = actionsResponse.body.actions[0]._id;

    const patchResponse = await request(app)
      .patch(`/api/memos/${memoId}/actions/${actionId}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ comment: 'tampered' });
    expect(patchResponse.status).toBe(404);

    const deleteResponse = await request(app)
      .delete(`/api/memos/${memoId}/actions/${actionId}`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(deleteResponse.status).toBe(404);
  });
});
