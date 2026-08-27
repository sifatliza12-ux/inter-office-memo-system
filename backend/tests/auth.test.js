const request = require('supertest');
const jwt = require('jsonwebtoken');

const app = require('../src/app');
const User = require('../src/models/User');
const { createOrganizationWithAdmin } = require('./helpers');

describe('Organization + admin creation', () => {
  it('creates an organization together with its initial admin user', async () => {
    const { response, payload } = await createOrganizationWithAdmin(app);

    expect(response.status).toBe(201);
    expect(response.body.organization.identifier).toBe(payload.identifier);
    expect(response.body.user.email).toBe(payload.adminEmail.toLowerCase());
    expect(response.body.user.role).toBe('admin');
    expect(response.body.user.password).toBeUndefined();
  });

  it('rejects a duplicate organization identifier', async () => {
    const { payload } = await createOrganizationWithAdmin(app);

    const duplicate = await request(app)
      .post('/api/organizations')
      .send({ ...payload, adminEmail: `other-${Date.now()}@acme.test` });

    expect(duplicate.status).toBe(409);
  });

  it('rejects a duplicate admin email even across two different organizations', async () => {
    const first = await createOrganizationWithAdmin(app, { name: 'First Organization' });

    const { response: secondResponse } = await createOrganizationWithAdmin(app, {
      name: 'A Completely Different Organization',
      adminEmail: first.payload.adminEmail,
    });

    expect(secondResponse.status).toBe(409);

    const usersWithThatEmail = await User.find({ email: first.payload.adminEmail.toLowerCase() });
    expect(usersWithThatEmail).toHaveLength(1);
    expect(usersWithThatEmail[0].organizationId.toString()).toBe(first.response.body.organization._id);
  });

  it('rejects missing required fields', async () => {
    const response = await request(app).post('/api/organizations').send({ name: 'Incomplete Org' });
    expect(response.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('succeeds with valid credentials and never returns the password', async () => {
    const { payload } = await createOrganizationWithAdmin(app);

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: payload.adminEmail, password: payload.adminPassword });

    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user.email).toBe(payload.adminEmail.toLowerCase());
    expect(response.body.user.password).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toMatch(/SuperSecret123/);
  });

  it('rejects an incorrect password', async () => {
    const { payload } = await createOrganizationWithAdmin(app);

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: payload.adminEmail, password: 'WrongPassword1' });

    expect(response.status).toBe(401);
  });

  it('rejects a non-existent email', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@nowhere.test', password: 'WhateverPassword1' });

    expect(response.status).toBe(401);
  });

  it('rejects missing credentials', async () => {
    const response = await request(app).post('/api/auth/login').send({});
    expect(response.status).toBe(400);
  });

  it('returns 403 for an inactive account when the password is correct', async () => {
    const { payload, response: createResponse } = await createOrganizationWithAdmin(app);
    await User.findByIdAndUpdate(createResponse.body.user._id, { status: 'inactive' });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: payload.adminEmail, password: payload.adminPassword });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('This account is not active');
  });

  it('returns the same generic 401 for an inactive account when the password is wrong', async () => {
    const { payload, response: createResponse } = await createOrganizationWithAdmin(app);
    await User.findByIdAndUpdate(createResponse.body.user._id, { status: 'inactive' });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: payload.adminEmail, password: 'TotallyWrongPassword1' });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid email or password');
  });
});

describe('GET /api/auth/me', () => {
  const login = async (email, password) => {
    const response = await request(app).post('/api/auth/login').send({ email, password });
    return response.body.token;
  };

  it('returns the authenticated user and organization context for a valid token', async () => {
    const { payload } = await createOrganizationWithAdmin(app);
    const token = await login(payload.adminEmail, payload.adminPassword);

    const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(payload.adminEmail.toLowerCase());
    expect(response.body.user.organizationId.identifier).toBe(payload.identifier);
    expect(response.body.user.password).toBeUndefined();
  });

  it('rejects a request with no token', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(401);
  });

  it('rejects a request with an invalid token', async () => {
    const response = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');
    expect(response.status).toBe(401);
  });

  it('rejects a request with an expired token', async () => {
    const { payload, response: createResponse } = await createOrganizationWithAdmin(app);
    const expiredToken = jwt.sign(
      { id: createResponse.body.user._id, organizationId: createResponse.body.organization._id, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: -10 }
    );

    const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
    expect(payload.adminEmail).toEqual(expect.any(String));
  });
});
