const request = require('supertest');

const app = require('../src/app');
const { createOrganizationWithAdmin } = require('./helpers');

const loginAs = async (email, password) => {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  return response.body.token;
};

describe('Multi-tenant isolation', () => {
  it("each admin's authenticated context reflects their own organization", async () => {
    const orgA = await createOrganizationWithAdmin(app, { name: 'Organization A' });
    const orgB = await createOrganizationWithAdmin(app, { name: 'Organization B' });

    const tokenA = await loginAs(orgA.payload.adminEmail, orgA.payload.adminPassword);
    const tokenB = await loginAs(orgB.payload.adminEmail, orgB.payload.adminPassword);

    const meA = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenA}`);
    const meB = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenB}`);

    expect(meA.body.user.organizationId.identifier).toBe(orgA.payload.identifier);
    expect(meB.body.user.organizationId.identifier).toBe(orgB.payload.identifier);
    expect(meA.body.user.organizationId.identifier).not.toBe(meB.body.user.organizationId.identifier);
  });

  it("a user from organization A cannot read organization B's resource", async () => {
    const orgA = await createOrganizationWithAdmin(app, { name: 'Organization A' });
    const orgB = await createOrganizationWithAdmin(app, { name: 'Organization B' });

    const tokenA = await loginAs(orgA.payload.adminEmail, orgA.payload.adminPassword);
    const orgBId = orgB.response.body.organization._id;

    const crossAccessAttempt = await request(app)
      .get(`/api/organizations/${orgBId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(crossAccessAttempt.status).toBe(403);
  });

  it('a user can read their own organization', async () => {
    const orgA = await createOrganizationWithAdmin(app, { name: 'Organization A' });
    const tokenA = await loginAs(orgA.payload.adminEmail, orgA.payload.adminPassword);
    const orgAId = orgA.response.body.organization._id;

    const ownAccess = await request(app)
      .get(`/api/organizations/${orgAId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(ownAccess.status).toBe(200);
    expect(ownAccess.body.organization.identifier).toBe(orgA.payload.identifier);
  });
});
