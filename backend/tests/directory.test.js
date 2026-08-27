const request = require('supertest');
const bcrypt = require('bcrypt');

const app = require('../src/app');
const User = require('../src/models/User');
const { createOrganizationWithAdmin } = require('./helpers');

const loginAs = async (email, password) => {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  return response.body.token;
};

describe('GET /api/directory', () => {
  it('lets any authenticated user (not just admins) list their own organization directory', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;

    const employeePassword = 'EmployeePass123';
    const employee = await User.create({
      organizationId,
      name: 'Regular Employee',
      email: `employee-${Date.now()}@acme.test`,
      password: await bcrypt.hash(employeePassword, 10),
      role: 'employee',
    });
    const employeeToken = await loginAs(employee.email, employeePassword);

    const deptResponse = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${await loginAs(org.payload.adminEmail, org.payload.adminPassword)}`)
      .send({ name: 'Engineering' });

    const response = await request(app).get('/api/directory').set('Authorization', `Bearer ${employeeToken}`);

    expect(response.status).toBe(200);
    const emails = response.body.users.map((user) => user.email);
    expect(emails).toEqual(expect.arrayContaining([org.payload.adminEmail.toLowerCase(), employee.email]));
    expect(response.body.users.every((user) => user.password === undefined)).toBe(true);

    const departmentNames = response.body.departments.map((department) => department.name);
    expect(departmentNames).toContain('Engineering');
    expect(deptResponse.status).toBe(201);
  });

  it('excludes inactive users/departments and never returns another organization\'s data', async () => {
    const orgA = await createOrganizationWithAdmin(app, { name: 'Org A' });
    const orgB = await createOrganizationWithAdmin(app, { name: 'Org B' });
    const tokenA = await loginAs(orgA.payload.adminEmail, orgA.payload.adminPassword);
    const tokenB = await loginAs(orgB.payload.adminEmail, orgB.payload.adminPassword);

    const inactiveUser = await User.create({
      organizationId: orgA.response.body.organization._id,
      name: 'Inactive Person',
      email: `inactive-${Date.now()}@acme.test`,
      password: await bcrypt.hash('InactivePass123', 10),
      role: 'employee',
      status: 'inactive',
    });

    const inactiveDept = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Retired Department' });
    await request(app)
      .patch(`/api/departments/${inactiveDept.body.department._id}/status`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'inactive' });

    await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Org B Department' });

    const response = await request(app).get('/api/directory').set('Authorization', `Bearer ${tokenA}`);
    const emails = response.body.users.map((user) => user.email);
    const departmentNames = response.body.departments.map((department) => department.name);

    expect(emails).not.toContain(inactiveUser.email);
    expect(emails).not.toContain(orgB.payload.adminEmail.toLowerCase());
    expect(departmentNames).not.toContain('Retired Department');
    expect(departmentNames).not.toContain('Org B Department');
  });

  it('rejects a request with no token', async () => {
    const response = await request(app).get('/api/directory');
    expect(response.status).toBe(401);
  });
});
