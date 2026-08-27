const request = require('supertest');
const bcrypt = require('bcrypt');

const app = require('../src/app');
const User = require('../src/models/User');
const Memo = require('../src/models/Memo');
const WorkflowStep = require('../src/models/WorkflowStep');
const { createOrganizationWithAdmin } = require('./helpers');

const loginAs = async (email, password) => {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  return response.body.token;
};

const createEmployee = async (organizationId, overrides = {}) => {
  const password = overrides.password || 'ParticipantPass123';
  const email =
    overrides.email || `participant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@acme.test`;
  return User.create({
    organizationId,
    name: overrides.name || 'Participant',
    email,
    password: await bcrypt.hash(password, 10),
    role: overrides.role || 'employee',
  });
};

describe('Memo submission and workflow step creation', () => {
  it('creates WorkflowSteps in participant order with stepOrder 10/20/30 and flips status + timestamp', async () => {
    const org = await createOrganizationWithAdmin(app);
    const token = await loginAs(org.payload.adminEmail, org.payload.adminPassword);
    const organizationId = org.response.body.organization._id;

    const participantA = await createEmployee(organizationId, { name: 'Participant A' });
    const participantB = await createEmployee(organizationId, { name: 'Participant B' });
    const participantC = await createEmployee(organizationId, { name: 'Participant C' });

    const createResponse = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        subject: 'Three-step memo',
        body: 'Body',
        workflowParticipants: [
          participantA._id.toString(),
          participantB._id.toString(),
          participantC._id.toString(),
        ],
      });
    const memoId = createResponse.body.memo._id;

    const beforeSubmit = await Memo.findById(memoId);
    expect(beforeSubmit.status).toBe('draft');
    expect(beforeSubmit.submittedAt).toBeUndefined();

    const submitResponse = await request(app)
      .post(`/api/memos/${memoId}/submit`)
      .set('Authorization', `Bearer ${token}`);

    expect(submitResponse.status).toBe(200);
    expect(submitResponse.body.memo.status).toBe('submitted');
    expect(submitResponse.body.memo.submittedAt).toEqual(expect.any(String));
    expect(submitResponse.body.memo.referenceNumber).toBe(createResponse.body.memo.referenceNumber);

    const steps = submitResponse.body.workflowSteps;
    expect(steps).toHaveLength(3);
    expect(steps.map((step) => step.stepOrder)).toEqual([10, 20, 30]);
    expect(steps.map((step) => step.userId)).toEqual([
      participantA._id.toString(),
      participantB._id.toString(),
      participantC._id.toString(),
    ]);
    steps.forEach((step) => expect(step.memoId).toBe(memoId));

    const afterSubmit = await Memo.findById(memoId);
    expect(afterSubmit.status).toBe('submitted');
    expect(afterSubmit.submittedAt).toBeInstanceOf(Date);

    const stepsInDb = await WorkflowStep.find({ memoId }).sort({ stepOrder: 1 });
    expect(stepsInDb).toHaveLength(3);
  });

  it('generates a unique, immutable reference number that survives edits and submission', async () => {
    const org = await createOrganizationWithAdmin(app);
    const token = await loginAs(org.payload.adminEmail, org.payload.adminPassword);

    const createResponse = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'Ref number memo', body: 'Body' });

    const referenceNumber = createResponse.body.memo.referenceNumber;
    expect(referenceNumber).toEqual(expect.any(String));
    expect(referenceNumber).toMatch(/^[A-Z0-9-]+-\d{4}-\d{4,}$/);

    const editResponse = await request(app)
      .patch(`/api/memos/${createResponse.body.memo._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'Edited subject' });
    expect(editResponse.body.memo.referenceNumber).toBe(referenceNumber);

    const participant = await createEmployee(org.response.body.organization._id);
    await request(app)
      .patch(`/api/memos/${createResponse.body.memo._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ workflowParticipants: [participant._id.toString()] });

    const submitResponse = await request(app)
      .post(`/api/memos/${createResponse.body.memo._id}/submit`)
      .set('Authorization', `Bearer ${token}`);
    expect(submitResponse.body.memo.referenceNumber).toBe(referenceNumber);
  });

  it('keeps reference numbers unique within an organization and independent across organizations', async () => {
    const orgA = await createOrganizationWithAdmin(app, { name: 'Org A' });
    const orgB = await createOrganizationWithAdmin(app, { name: 'Org B' });
    const tokenA = await loginAs(orgA.payload.adminEmail, orgA.payload.adminPassword);
    const tokenB = await loginAs(orgB.payload.adminEmail, orgB.payload.adminPassword);

    const firstA = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ subject: 'A1', body: 'Body' });
    const secondA = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ subject: 'A2', body: 'Body' });
    const firstB = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ subject: 'B1', body: 'Body' });

    expect(firstA.body.memo.referenceNumber).not.toBe(secondA.body.memo.referenceNumber);

    // Org B's sequence starts independently from Org A's, even though Org A
    // had already created two memos before Org B created its first.
    expect(firstA.body.memo.referenceNumber).toMatch(/-0001$/);
    expect(secondA.body.memo.referenceNumber).toMatch(/-0002$/);
    expect(firstB.body.memo.referenceNumber).toMatch(/-0001$/);

    expect(orgA.payload.identifier).not.toBe(orgB.payload.identifier);
    expect(firstA.body.memo.referenceNumber.startsWith(orgA.payload.identifier.toUpperCase())).toBe(true);
    expect(firstB.body.memo.referenceNumber.startsWith(orgB.payload.identifier.toUpperCase())).toBe(true);
  });

  it('produces no duplicate reference numbers under concurrent creation in the same organization', async () => {
    const org = await createOrganizationWithAdmin(app);
    const token = await loginAs(org.payload.adminEmail, org.payload.adminPassword);

    const CONCURRENT_COUNT = 15;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENT_COUNT }, (_, index) =>
        request(app)
          .post('/api/memos')
          .set('Authorization', `Bearer ${token}`)
          .send({ subject: `Concurrent memo ${index}`, body: 'Body' })
      )
    );

    responses.forEach((response) => expect(response.status).toBe(201));

    const referenceNumbers = responses.map((response) => response.body.memo.referenceNumber);
    expect(new Set(referenceNumbers).size).toBe(CONCURRENT_COUNT);
  });

  it('does not leave a partial state if WorkflowStep creation fails during submission', async () => {
    const org = await createOrganizationWithAdmin(app);
    const token = await loginAs(org.payload.adminEmail, org.payload.adminPassword);
    const participant = await createEmployee(org.response.body.organization._id);

    const createResponse = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'Failure path memo', body: 'Body', workflowParticipants: [participant._id.toString()] });
    const memoId = createResponse.body.memo._id;

    const spy = jest.spyOn(WorkflowStep, 'insertMany').mockRejectedValueOnce(new Error('Simulated DB failure'));

    const submitResponse = await request(app)
      .post(`/api/memos/${memoId}/submit`)
      .set('Authorization', `Bearer ${token}`);

    expect(submitResponse.status).toBe(500);

    const memoAfter = await Memo.findById(memoId);
    expect(memoAfter.status).toBe('draft');
    expect(memoAfter.submittedAt).toBeUndefined();

    const steps = await WorkflowStep.find({ memoId });
    expect(steps).toHaveLength(0);

    spy.mockRestore();
  });
});
