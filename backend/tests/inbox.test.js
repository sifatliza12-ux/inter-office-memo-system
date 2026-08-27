const request = require('supertest');

const app = require('../src/app');
const { createOrganizationWithAdmin } = require('./helpers');
const { loginAs, createEmployee, createSubmittedWorkflow } = require('./workflowHelpers');

describe('Inbox: GET /api/memos/inbox', () => {
  it('includes the memo only for the current approver, excluding past and future participants', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 3);

    const inboxes = await Promise.all(
      participants.map((participant) =>
        request(app).get('/api/memos/inbox').set('Authorization', `Bearer ${participant.token}`)
      )
    );

    expect(inboxes[0].status).toBe(200);
    expect(inboxes[0].body.memos.map((memo) => memo._id)).toEqual([memoId]);

    // Future participants: not yet their turn, so the memo must not appear.
    expect(inboxes[1].body.memos).toHaveLength(0);
    expect(inboxes[2].body.memos).toHaveLength(0);
  });

  it('returns author name, department, priority, status, submittedAt, and an age field', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const { participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1, {
      subject: 'Budget approval',
    });

    const response = await request(app)
      .get('/api/memos/inbox')
      .set('Authorization', `Bearer ${participants[0].token}`);

    expect(response.status).toBe(200);
    expect(response.body.memos).toHaveLength(1);

    const [item] = response.body.memos;
    expect(item.referenceNumber).toEqual(expect.any(String));
    expect(item.subject).toBe('Budget approval');
    expect(item.authorId.name).toBe('Jane Admin');
    expect(item.priority).toBe('normal');
    expect(item.status).toBe('submitted');
    expect(item.submittedAt).toEqual(expect.any(String));
    expect(typeof item.ageMs).toBe('number');
    expect(item.ageMs).toBeGreaterThanOrEqual(0);
  });

  it('moves the memo out of the old approver inbox and into the new approver inbox after an approval', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 2);

    const beforeFirst = await request(app)
      .get('/api/memos/inbox')
      .set('Authorization', `Bearer ${participants[0].token}`);
    expect(beforeFirst.body.memos.map((memo) => memo._id)).toEqual([memoId]);

    const beforeSecond = await request(app)
      .get('/api/memos/inbox')
      .set('Authorization', `Bearer ${participants[1].token}`);
    expect(beforeSecond.body.memos).toHaveLength(0);

    await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({});

    const afterFirst = await request(app)
      .get('/api/memos/inbox')
      .set('Authorization', `Bearer ${participants[0].token}`);
    expect(afterFirst.body.memos).toHaveLength(0);

    const afterSecond = await request(app)
      .get('/api/memos/inbox')
      .set('Authorization', `Bearer ${participants[1].token}`);
    expect(afterSecond.body.memos.map((memo) => memo._id)).toEqual([memoId]);
  });

  it("excludes memos belonging to another organization, even for a user of the same role", async () => {
    const orgA = await createOrganizationWithAdmin(app, { name: 'Organization A' });
    const organizationIdA = orgA.response.body.organization._id;
    const authorTokenA = await loginAs(app, orgA.payload.adminEmail, orgA.payload.adminPassword);
    const { memoId } = await createSubmittedWorkflow(app, organizationIdA, authorTokenA, 1);

    const orgB = await createOrganizationWithAdmin(app, { name: 'Organization B' });
    const organizationIdB = orgB.response.body.organization._id;
    const { user: userB, password: passwordB } = await createEmployee(organizationIdB, { name: 'Participant 1' });
    const tokenB = await loginAs(app, userB.email, passwordB);

    const inboxB = await request(app).get('/api/memos/inbox').set('Authorization', `Bearer ${tokenB}`);

    expect(inboxB.status).toBe(200);
    expect(inboxB.body.memos).toHaveLength(0);
    expect(inboxB.body.memos.some((memo) => memo._id === memoId)).toBe(false);
  });

  it('supports filtering by status, category, and priority', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const { participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    const matching = await request(app)
      .get('/api/memos/inbox?status=submitted&priority=normal')
      .set('Authorization', `Bearer ${participants[0].token}`);
    expect(matching.body.memos).toHaveLength(1);

    const nonMatching = await request(app)
      .get('/api/memos/inbox?status=approved')
      .set('Authorization', `Bearer ${participants[0].token}`);
    expect(nonMatching.body.memos).toHaveLength(0);

    const wrongCategory = await request(app)
      .get('/api/memos/inbox?category=Financial')
      .set('Authorization', `Bearer ${participants[0].token}`);
    expect(wrongCategory.body.memos).toHaveLength(0);
  });
});

describe("GET /api/memos/mine includes currentApproverId/finalApproverId names", () => {
  it('populates currentApproverId with the pending approver\'s name for a submitted memo', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const { participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 2);

    const mine = await request(app).get('/api/memos/mine').set('Authorization', `Bearer ${authorToken}`);

    expect(mine.status).toBe(200);
    expect(mine.body.memos).toHaveLength(1);
    expect(mine.body.memos[0].currentApproverId).toMatchObject({
      _id: participants[0].user._id.toString(),
      name: 'Participant 1',
    });
  });

  it('populates finalApproverId with a name once the memo is fully approved', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({});

    const mine = await request(app).get('/api/memos/mine').set('Authorization', `Bearer ${authorToken}`);

    expect(mine.body.memos[0].status).toBe('approved');
    expect(mine.body.memos[0].finalApproverId).toMatchObject({
      _id: participants[0].user._id.toString(),
      name: 'Participant 1',
    });
    expect(mine.body.memos[0].currentApproverId).toBeUndefined();
  });
});
