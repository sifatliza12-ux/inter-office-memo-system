const request = require('supertest');

const app = require('../src/app');
const { createOrganizationWithAdmin } = require('./helpers');
const { loginAs, createEmployee, createSubmittedWorkflow } = require('./workflowHelpers');

describe('Comments: POST/GET /api/memos/:id/comments', () => {
  it('allows the author, and any past/current/future participant, to comment; rejects an uninvolved same-org user', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 3);
    const [p1, p2, p3] = participants;

    // p1 approves so they become a PAST participant; p2 is CURRENT; p3 is FUTURE.
    await request(app).post(`/api/memos/${memoId}/approve`).set('Authorization', `Bearer ${p1.token}`).send({});

    const authorComment = await request(app)
      .post(`/api/memos/${memoId}/comments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ text: 'Author comment' });
    expect(authorComment.status).toBe(201);

    const pastComment = await request(app)
      .post(`/api/memos/${memoId}/comments`)
      .set('Authorization', `Bearer ${p1.token}`)
      .send({ text: 'Past participant comment' });
    expect(pastComment.status).toBe(201);

    const currentComment = await request(app)
      .post(`/api/memos/${memoId}/comments`)
      .set('Authorization', `Bearer ${p2.token}`)
      .send({ text: 'Current participant comment' });
    expect(currentComment.status).toBe(201);

    const futureComment = await request(app)
      .post(`/api/memos/${memoId}/comments`)
      .set('Authorization', `Bearer ${p3.token}`)
      .send({ text: 'Future participant comment' });
    expect(futureComment.status).toBe(201);

    const { user: bystander, password: bystanderPassword } = await createEmployee(organizationId, {
      name: 'Bystander',
    });
    const bystanderToken = await loginAs(app, bystander.email, bystanderPassword);

    const bystanderPost = await request(app)
      .post(`/api/memos/${memoId}/comments`)
      .set('Authorization', `Bearer ${bystanderToken}`)
      .send({ text: 'Should not be allowed' });
    expect(bystanderPost.status).toBe(403);

    const bystanderGet = await request(app)
      .get(`/api/memos/${memoId}/comments`)
      .set('Authorization', `Bearer ${bystanderToken}`);
    expect(bystanderGet.status).toBe(403);
  });

  it('rejects empty or whitespace-only comment text', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    const empty = await request(app)
      .post(`/api/memos/${memoId}/comments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ text: '' });
    expect(empty.status).toBe(400);

    const whitespace = await request(app)
      .post(`/api/memos/${memoId}/comments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ text: '   ' });
    expect(whitespace.status).toBe(400);

    const missing = await request(app)
      .post(`/api/memos/${memoId}/comments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({});
    expect(missing.status).toBe(400);

    const tooLong = await request(app)
      .post(`/api/memos/${memoId}/comments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ text: 'x'.repeat(5001) });
    expect(tooLong.status).toBe(400);
  });

  it('returns comments in chronological order with correct author names', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    await request(app)
      .post(`/api/memos/${memoId}/comments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ text: 'first' });
    await request(app)
      .post(`/api/memos/${memoId}/comments`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ text: 'second' });
    await request(app)
      .post(`/api/memos/${memoId}/comments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ text: 'third' });

    const response = await request(app)
      .get(`/api/memos/${memoId}/comments`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(response.status).toBe(200);
    expect(response.body.comments.map((comment) => comment.text)).toEqual(['first', 'second', 'third']);
    expect(response.body.comments[0].authorId.name).toBe('Jane Admin');
    expect(response.body.comments[1].authorId.name).toBe('Participant 1');
    expect(response.body.comments.every((comment) => typeof comment.createdAt === 'string')).toBe(true);
  });

  it('never mixes general comments with Stage 5 workflow-action comments, in either endpoint', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    await request(app)
      .post(`/api/memos/${memoId}/request-changes`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ comment: 'Workflow comment: fix the numbers' });

    await request(app)
      .post(`/api/memos/${memoId}/comments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ text: 'General comment: thanks for the review' });

    const commentsResponse = await request(app)
      .get(`/api/memos/${memoId}/comments`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(commentsResponse.body.comments).toHaveLength(1);
    expect(commentsResponse.body.comments[0].text).toBe('General comment: thanks for the review');
    expect(JSON.stringify(commentsResponse.body)).not.toContain('Workflow comment');

    const workflowResponse = await request(app)
      .get(`/api/memos/${memoId}/workflow`)
      .set('Authorization', `Bearer ${authorToken}`);
    const stepWithComment = workflowResponse.body.workflowSteps.find((step) => step.comment);
    expect(stepWithComment.comment).toBe('Workflow comment: fix the numbers');
    expect(JSON.stringify(workflowResponse.body)).not.toContain('General comment');
  });

  it("excludes memos belonging to another organization (404, tenant scoping)", async () => {
    const orgA = await createOrganizationWithAdmin(app, { name: 'Organization A' });
    const organizationIdA = orgA.response.body.organization._id;
    const authorTokenA = await loginAs(app, orgA.payload.adminEmail, orgA.payload.adminPassword);
    const { memoId } = await createSubmittedWorkflow(app, organizationIdA, authorTokenA, 1);

    const orgB = await createOrganizationWithAdmin(app, { name: 'Organization B' });
    const tokenB = await loginAs(app, orgB.payload.adminEmail, orgB.payload.adminPassword);

    const response = await request(app)
      .post(`/api/memos/${memoId}/comments`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ text: 'Should not reach org A' });

    expect(response.status).toBe(404);
  });
});
