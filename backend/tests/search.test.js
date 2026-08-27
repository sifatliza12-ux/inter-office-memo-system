const request = require('supertest');

const app = require('../src/app');
const { createOrganizationWithAdmin } = require('./helpers');
const { loginAs, createEmployee, createSubmittedWorkflow } = require('./workflowHelpers');

describe('Search: GET /api/memos/search', () => {
  it('matches by subject, body, and referenceNumber independently', async () => {
    const org = await createOrganizationWithAdmin(app);
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const memoRes = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ subject: 'Quarterly Budget Review', body: 'Discussion of fiscal projections for Q3' });
    const memoId = memoRes.body.memo._id;
    const { referenceNumber } = memoRes.body.memo;

    const bySubject = await request(app)
      .get('/api/memos/search?q=Budget')
      .set('Authorization', `Bearer ${authorToken}`);
    expect(bySubject.body.memos.map((m) => m._id)).toContain(memoId);

    const byBody = await request(app)
      .get('/api/memos/search?q=fiscal projections')
      .set('Authorization', `Bearer ${authorToken}`);
    expect(byBody.body.memos.map((m) => m._id)).toContain(memoId);

    const byReference = await request(app)
      .get(`/api/memos/search?q=${referenceNumber}`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(byReference.body.memos.map((m) => m._id)).toContain(memoId);

    const noMatch = await request(app)
      .get('/api/memos/search?q=CompletelyUnrelatedTerm')
      .set('Authorization', `Bearer ${authorToken}`);
    expect(noMatch.body.memos.map((m) => m._id)).not.toContain(memoId);
  });

  it('never returns a memo matching q that the searching user is not authorized to view, even in the same org', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const memoRes = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ subject: 'Confidential Merger Discussion', body: 'Sensitive content' });
    const memoId = memoRes.body.memo._id;

    const { user: bystander, password: bystanderPassword } = await createEmployee(organizationId, {
      name: 'Bystander',
    });
    const bystanderToken = await loginAs(app, bystander.email, bystanderPassword);

    // Sanity check: the bystander genuinely cannot open it directly either —
    // search must not leak anything GET /memos/:id itself wouldn't.
    const directAccess = await request(app)
      .get(`/api/memos/${memoId}`)
      .set('Authorization', `Bearer ${bystanderToken}`);
    expect(directAccess.status).toBe(403);

    const searchAsBystander = await request(app)
      .get('/api/memos/search?q=Merger')
      .set('Authorization', `Bearer ${bystanderToken}`);
    expect(searchAsBystander.status).toBe(200);
    expect(searchAsBystander.body.memos.map((m) => m._id)).not.toContain(memoId);

    const searchAsAuthor = await request(app)
      .get('/api/memos/search?q=Merger')
      .set('Authorization', `Bearer ${authorToken}`);
    expect(searchAsAuthor.body.memos.map((m) => m._id)).toContain(memoId);
  });

  it('a workflow participant (not the author) can find a memo via search', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1, {
      subject: 'Participant Findable Memo',
    });

    const response = await request(app)
      .get('/api/memos/search?q=Findable')
      .set('Authorization', `Bearer ${participants[0].token}`);
    expect(response.body.memos.map((m) => m._id)).toContain(memoId);
  });

  it('filters by status/category/priority/department individually and combined', async () => {
    const org = await createOrganizationWithAdmin(app);
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const deptRes = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ name: 'Engineering' });
    const departmentId = deptRes.body.department._id;

    const memoA = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ subject: 'Memo A', body: 'body', category: 'Financial', priority: 'high', departmentId });
    const memoB = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ subject: 'Memo B', body: 'body', category: 'HR', priority: 'low' });

    const byCategory = await request(app)
      .get('/api/memos/search?category=Financial')
      .set('Authorization', `Bearer ${authorToken}`);
    expect(byCategory.body.memos.map((m) => m._id)).toEqual([memoA.body.memo._id]);

    const byPriority = await request(app)
      .get('/api/memos/search?priority=low')
      .set('Authorization', `Bearer ${authorToken}`);
    expect(byPriority.body.memos.map((m) => m._id)).toEqual([memoB.body.memo._id]);

    const byStatus = await request(app)
      .get('/api/memos/search?status=draft')
      .set('Authorization', `Bearer ${authorToken}`);
    expect(byStatus.body.memos.map((m) => m._id).sort()).toEqual(
      [memoA.body.memo._id, memoB.body.memo._id].sort()
    );

    const byDepartment = await request(app)
      .get(`/api/memos/search?department=${departmentId}`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(byDepartment.body.memos.map((m) => m._id)).toEqual([memoA.body.memo._id]);

    const combined = await request(app)
      .get('/api/memos/search?category=Financial&priority=high&status=draft')
      .set('Authorization', `Bearer ${authorToken}`);
    expect(combined.body.memos.map((m) => m._id)).toEqual([memoA.body.memo._id]);

    const combinedNoMatch = await request(app)
      .get('/api/memos/search?category=Financial&priority=low')
      .set('Authorization', `Bearer ${authorToken}`);
    expect(combinedNoMatch.body.memos).toHaveLength(0);
  });

  it('filters by date range', async () => {
    const org = await createOrganizationWithAdmin(app);
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const memoRes = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ subject: 'Dated Memo', body: 'body' });
    const memoId = memoRes.body.memo._id;

    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const inRange = await request(app)
      .get(`/api/memos/search?dateFrom=${past}&dateTo=${future}`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(inRange.body.memos.map((m) => m._id)).toContain(memoId);

    const outOfRange = await request(app)
      .get(`/api/memos/search?dateFrom=${future}`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(outOfRange.body.memos.map((m) => m._id)).not.toContain(memoId);
  });

  it('paginates correctly and returns an accurate total', async () => {
    const org = await createOrganizationWithAdmin(app);
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        request(app)
          .post('/api/memos')
          .set('Authorization', `Bearer ${authorToken}`)
          .send({ subject: `Paginated Memo ${index}`, body: 'body' })
      )
    );

    const pageOne = await request(app)
      .get('/api/memos/search?limit=2&page=1')
      .set('Authorization', `Bearer ${authorToken}`);
    expect(pageOne.body.memos).toHaveLength(2);
    expect(pageOne.body.total).toBe(5);
    expect(pageOne.body.page).toBe(1);
    expect(pageOne.body.limit).toBe(2);

    const pageTwo = await request(app)
      .get('/api/memos/search?limit=2&page=2')
      .set('Authorization', `Bearer ${authorToken}`);
    expect(pageTwo.body.memos).toHaveLength(2);

    const pageThree = await request(app)
      .get('/api/memos/search?limit=2&page=3')
      .set('Authorization', `Bearer ${authorToken}`);
    expect(pageThree.body.memos).toHaveLength(1);

    const allIds = [...pageOne.body.memos, ...pageTwo.body.memos, ...pageThree.body.memos].map((m) => m._id);
    expect(new Set(allIds).size).toBe(5); // no duplicates/overlap across pages
  });

  it('excludes memos from another organization even if the query text would otherwise match', async () => {
    const orgA = await createOrganizationWithAdmin(app, { name: 'Organization A' });
    const tokenA = await loginAs(app, orgA.payload.adminEmail, orgA.payload.adminPassword);
    await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ subject: 'UniqueSearchTermXYZ', body: 'body' });

    const orgB = await createOrganizationWithAdmin(app, { name: 'Organization B' });
    const tokenB = await loginAs(app, orgB.payload.adminEmail, orgB.payload.adminPassword);

    const response = await request(app)
      .get('/api/memos/search?q=UniqueSearchTermXYZ')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(response.body.memos).toHaveLength(0);
  });
});
