const request = require('supertest');

const app = require('../src/app');
const Memo = require('../src/models/Memo');
const MemoVersion = require('../src/models/MemoVersion');
const { createOrganizationWithAdmin } = require('./helpers');
const { loginAs, createEmployee, createSubmittedWorkflow } = require('./workflowHelpers');

describe('Stage 13a: memo version history', () => {
  it('submitting a memo creates exactly one MemoVersion (v1) matching the memo content, and sets originalWorkflowParticipants from the participants at that moment', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants, submitResponse } = await createSubmittedWorkflow(
      app,
      organizationId,
      authorToken,
      2,
      { subject: 'Original subject', body: 'Original body' }
    );

    expect(submitResponse.status).toBe(200);
    expect(submitResponse.body.memo.currentVersionNumber).toBe(1);

    const versions = await MemoVersion.find({ memoId });
    expect(versions).toHaveLength(1);
    expect(versions[0].versionNumber).toBe(1);
    expect(versions[0].subject).toBe('Original subject');
    expect(versions[0].body).toBe('Original body');
    expect(versions[0].memoId.toString()).toBe(memoId);
    expect(versions[0].organizationId.toString()).toBe(organizationId);

    const memoInDb = await Memo.findById(memoId);
    expect(memoInDb.currentVersionNumber).toBe(1);
    expect(memoInDb.originalWorkflowParticipants.map(String)).toEqual(
      participants.map((participant) => participant.user._id.toString())
    );
  });

  it('resubmitting after edits during changes_requested creates version 2 with the NEW content, leaves version 1 untouched with the OLD content, and never touches originalWorkflowParticipants even after an add-participant in between', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 2, {
      subject: 'Version 1 subject',
      body: 'Version 1 body',
    });
    const [p1, p2] = participants;

    const originalParticipantIds = [p1.user._id.toString(), p2.user._id.toString()];

    // p1 (current) adds a third participant while the memo is still
    // 'submitted' — the live workflowParticipants list grows, but this must
    // never leak into originalWorkflowParticipants.
    const { user: extra } = await createEmployee(organizationId, { name: 'Extra Participant' });
    const addResponse = await request(app)
      .post(`/api/memos/${memoId}/workflow/add-participant`)
      .set('Authorization', `Bearer ${p1.token}`)
      .send({ userId: extra._id.toString(), reason: 'Needs an extra pair of eyes' });
    expect(addResponse.status).toBe(201);

    // p1 is still current (add-participant never changes whose turn it is);
    // p1 requests changes.
    const requestChangesResponse = await request(app)
      .post(`/api/memos/${memoId}/request-changes`)
      .set('Authorization', `Bearer ${p1.token}`)
      .send({ comment: 'Please revise' });
    expect(requestChangesResponse.status).toBe(200);
    expect(requestChangesResponse.body.memo.status).toBe('changes_requested');

    await request(app)
      .patch(`/api/memos/${memoId}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ subject: 'Version 2 subject', body: 'Version 2 body' });

    const resubmitResponse = await request(app)
      .post(`/api/memos/${memoId}/resubmit`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(resubmitResponse.status).toBe(200);
    expect(resubmitResponse.body.memo.currentVersionNumber).toBe(2);

    const versions = await MemoVersion.find({ memoId }).sort({ versionNumber: 1 });
    expect(versions).toHaveLength(2);
    expect(versions[0].versionNumber).toBe(1);
    expect(versions[0].subject).toBe('Version 1 subject');
    expect(versions[0].body).toBe('Version 1 body');
    expect(versions[1].versionNumber).toBe(2);
    expect(versions[1].subject).toBe('Version 2 subject');
    expect(versions[1].body).toBe('Version 2 body');

    const memoInDb = await Memo.findById(memoId);
    expect(memoInDb.currentVersionNumber).toBe(2);
    // Live list now has 3 participants (the add-participant addition)...
    expect(memoInDb.workflowParticipants).toHaveLength(3);
    // ...but the original historical record still shows only the original 2.
    expect(memoInDb.originalWorkflowParticipants.map(String)).toEqual(originalParticipantIds);
  });

  it('increments currentVersionNumber correctly across two resubmit cycles, producing three distinct versions', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1, {
      subject: 'Subject v1',
      body: 'Body v1',
    });
    const [p1] = participants;

    // Cycle 1: changes requested -> edit -> resubmit (version 2).
    await request(app)
      .post(`/api/memos/${memoId}/request-changes`)
      .set('Authorization', `Bearer ${p1.token}`)
      .send({ comment: 'Round 1 feedback' });
    await request(app)
      .patch(`/api/memos/${memoId}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ subject: 'Subject v2', body: 'Body v2' });
    const firstResubmit = await request(app)
      .post(`/api/memos/${memoId}/resubmit`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(firstResubmit.status).toBe(200);
    expect(firstResubmit.body.memo.currentVersionNumber).toBe(2);

    // Cycle 2: changes requested again -> edit again -> resubmit (version 3).
    await request(app)
      .post(`/api/memos/${memoId}/request-changes`)
      .set('Authorization', `Bearer ${p1.token}`)
      .send({ comment: 'Round 2 feedback' });
    await request(app)
      .patch(`/api/memos/${memoId}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ subject: 'Subject v3', body: 'Body v3' });
    const secondResubmit = await request(app)
      .post(`/api/memos/${memoId}/resubmit`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(secondResubmit.status).toBe(200);
    expect(secondResubmit.body.memo.currentVersionNumber).toBe(3);

    const versions = await MemoVersion.find({ memoId }).sort({ versionNumber: 1 });
    expect(versions).toHaveLength(3);
    expect(versions.map((version) => version.versionNumber)).toEqual([1, 2, 3]);
    expect(versions.map((version) => version.subject)).toEqual(['Subject v1', 'Subject v2', 'Subject v3']);
    expect(versions.map((version) => version.body)).toEqual(['Body v1', 'Body v2', 'Body v3']);

    const memoInDb = await Memo.findById(memoId);
    expect(memoInDb.currentVersionNumber).toBe(3);
  });

  it('GET /api/memos/:id/versions: author and participants can view, an uninvolved same-org user gets 403, another org gets 404', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);
    const [p1] = participants;

    const { user: bystander, password: bystanderPassword } = await createEmployee(organizationId, {
      name: 'Uninvolved Bystander',
    });
    const bystanderToken = await loginAs(app, bystander.email, bystanderPassword);

    const otherOrg = await createOrganizationWithAdmin(app, { name: 'Other Org' });
    const otherOrgToken = await loginAs(app, otherOrg.payload.adminEmail, otherOrg.payload.adminPassword);

    const authorView = await request(app)
      .get(`/api/memos/${memoId}/versions`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(authorView.status).toBe(200);
    expect(authorView.body.versions).toHaveLength(1);
    expect(authorView.body.versions[0].versionNumber).toBe(1);
    expect(authorView.body.versions[0].createdBy.name).toEqual(expect.any(String));

    const participantView = await request(app)
      .get(`/api/memos/${memoId}/versions`)
      .set('Authorization', `Bearer ${p1.token}`);
    expect(participantView.status).toBe(200);
    expect(participantView.body.versions).toHaveLength(1);

    const bystanderView = await request(app)
      .get(`/api/memos/${memoId}/versions`)
      .set('Authorization', `Bearer ${bystanderToken}`);
    expect(bystanderView.status).toBe(403);

    const otherOrgView = await request(app)
      .get(`/api/memos/${memoId}/versions`)
      .set('Authorization', `Bearer ${otherOrgToken}`);
    expect(otherOrgView.status).toBe(404);
  });

  it('has no PATCH or DELETE route for memo versions — a guessed one 404s for an authenticated, authorized user, not 403', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    const versionsResponse = await request(app)
      .get(`/api/memos/${memoId}/versions`)
      .set('Authorization', `Bearer ${authorToken}`);
    const versionId = versionsResponse.body.versions[0]._id;

    const patchResponse = await request(app)
      .patch(`/api/memos/${memoId}/versions/${versionId}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ subject: 'tampered' });
    expect(patchResponse.status).toBe(404);

    const deleteResponse = await request(app)
      .delete(`/api/memos/${memoId}/versions/${versionId}`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(deleteResponse.status).toBe(404);
  });
});
