const request = require('supertest');
const bcrypt = require('bcrypt');

const User = require('../src/models/User');

const loginAs = async (app, email, password) => {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  return response.body.token;
};

const createEmployee = async (organizationId, overrides = {}) => {
  const password = overrides.password || 'ParticipantPass123';
  const email = overrides.email || `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@acme.test`;
  const user = await User.create({
    organizationId,
    name: overrides.name || 'Participant',
    email,
    password: await bcrypt.hash(password, 10),
    role: overrides.role || 'employee',
  });
  return { user, password };
};

// Creates `participantCount` employees, a draft memo authored via
// `authorToken` listing them as workflowParticipants (in order), and submits
// it. Returns the memo id/reference number, the created WorkflowSteps (as
// returned by the submit response), and each participant with a ready-to-use
// login token, in the same order they appear in the workflow.
const createSubmittedWorkflow = async (app, organizationId, authorToken, participantCount, overrides = {}) => {
  const created = await Promise.all(
    Array.from({ length: participantCount }, (_, index) =>
      createEmployee(organizationId, { name: `Participant ${index + 1}` })
    )
  );

  const participants = await Promise.all(
    created.map(async ({ user, password }) => ({
      user,
      password,
      token: await loginAs(app, user.email, password),
    }))
  );

  const createResponse = await request(app)
    .post('/api/memos')
    .set('Authorization', `Bearer ${authorToken}`)
    .send({
      subject: overrides.subject || 'Workflow Test Memo',
      body: overrides.body || 'Body',
      workflowParticipants: participants.map((participant) => participant.user._id.toString()),
    });

  const memoId = createResponse.body.memo._id;

  const submitResponse = await request(app)
    .post(`/api/memos/${memoId}/submit`)
    .set('Authorization', `Bearer ${authorToken}`);

  return {
    memoId,
    referenceNumber: createResponse.body.memo.referenceNumber,
    participants,
    workflowSteps: submitResponse.body.workflowSteps,
    submitResponse,
  };
};

module.exports = { loginAs, createEmployee, createSubmittedWorkflow };
