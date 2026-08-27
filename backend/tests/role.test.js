const request = require('supertest');
const bcrypt = require('bcrypt');

const app = require('../src/app');
const User = require('../src/models/User');
const { createOrganizationWithAdmin } = require('./helpers');

const loginAs = async (email, password) => {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  return response.body.token;
};

describe('Role-based authorization', () => {
  it('allows an admin to access an admin-only route', async () => {
    const org = await createOrganizationWithAdmin(app);
    const adminToken = await loginAs(org.payload.adminEmail, org.payload.adminPassword);
    const orgId = org.response.body.organization._id;

    const response = await request(app)
      .get(`/api/organizations/${orgId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
  });

  it('rejects a non-admin user from an admin-only route in their own organization', async () => {
    const org = await createOrganizationWithAdmin(app);
    const orgId = org.response.body.organization._id;

    const employeePassword = 'EmployeePass123';
    const employee = await User.create({
      organizationId: orgId,
      name: 'Regular Employee',
      email: `employee-${Date.now()}@acme.test`,
      password: await bcrypt.hash(employeePassword, 10),
      role: 'employee',
    });

    const employeeToken = await loginAs(employee.email, employeePassword);

    const response = await request(app)
      .get(`/api/organizations/${orgId}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(response.status).toBe(403);
  });
});
