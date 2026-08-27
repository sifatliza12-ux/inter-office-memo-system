const request = require('supertest');
const bcrypt = require('bcrypt');

const app = require('../src/app');
const User = require('../src/models/User');
const { createOrganizationWithAdmin } = require('./helpers');

const loginAs = async (email, password) => {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  return response.body.token;
};

describe('User administration', () => {
  it('lets an admin create, list, get, update, and toggle a user in their own org', async () => {
    const org = await createOrganizationWithAdmin(app);
    const token = await loginAs(org.payload.adminEmail, org.payload.adminPassword);

    const createResponse = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'New Hire',
        email: `newhire-${Date.now()}@acme.test`,
        password: 'NewHirePass123',
        role: 'employee',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.user.password).toBeUndefined();
    const userId = createResponse.body.user._id;

    const listResponse = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.users.length).toBeGreaterThanOrEqual(2);

    const getResponse = await request(app).get(`/api/users/${userId}`).set('Authorization', `Bearer ${token}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.user.password).toBeUndefined();

    const updateResponse = await request(app)
      .patch(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ designation: 'Junior Engineer', role: 'manager' });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.user.designation).toBe('Junior Engineer');
    expect(updateResponse.body.user.role).toBe('manager');

    const deactivateResponse = await request(app)
      .patch(`/api/users/${userId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'inactive' });
    expect(deactivateResponse.status).toBe(200);
    expect(deactivateResponse.body.user.status).toBe('inactive');
  });

  it('filters the user list by status, departmentId, and role', async () => {
    const org = await createOrganizationWithAdmin(app);
    const token = await loginAs(org.payload.adminEmail, org.payload.adminPassword);

    const dept = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Sales' });
    const departmentId = dept.body.department._id;

    const employee = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Sales Rep',
        email: `sales-${Date.now()}@acme.test`,
        password: 'SalesPass123',
        role: 'employee',
        departmentId,
      });

    const byDepartment = await request(app)
      .get(`/api/users?departmentId=${departmentId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(byDepartment.body.users).toHaveLength(1);
    expect(byDepartment.body.users[0]._id).toBe(employee.body.user._id);

    const byRole = await request(app).get('/api/users?role=admin').set('Authorization', `Bearer ${token}`);
    expect(byRole.body.users.every((user) => user.role === 'admin')).toBe(true);

    const byStatus = await request(app).get('/api/users?status=active').set('Authorization', `Bearer ${token}`);
    expect(byStatus.body.users.every((user) => user.status === 'active')).toBe(true);
  });

  it('rejects creating a user with an email that already exists (409)', async () => {
    const org = await createOrganizationWithAdmin(app);
    const token = await loginAs(org.payload.adminEmail, org.payload.adminPassword);

    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Duplicate', email: org.payload.adminEmail, password: 'DuplicatePass123' });

    expect(response.status).toBe(409);
  });

  it('does not allow an admin to deactivate their own account', async () => {
    const org = await createOrganizationWithAdmin(app);
    const token = await loginAs(org.payload.adminEmail, org.payload.adminPassword);
    const adminId = org.response.body.user._id;

    const response = await request(app)
      .patch(`/api/users/${adminId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'inactive' });

    expect(response.status).toBe(400);

    const stillActive = await User.findById(adminId);
    expect(stillActive.status).toBe('active');
  });

  it('rejects assigning a user to a department from a different organization (create and update)', async () => {
    const orgA = await createOrganizationWithAdmin(app, { name: 'Org A' });
    const orgB = await createOrganizationWithAdmin(app, { name: 'Org B' });
    const tokenA = await loginAs(orgA.payload.adminEmail, orgA.payload.adminPassword);
    const tokenB = await loginAs(orgB.payload.adminEmail, orgB.payload.adminPassword);

    const deptB = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Org B Dept' });
    const deptBId = deptB.body.department._id;

    const createAttempt = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Cross Org',
        email: `crossorg-${Date.now()}@acme.test`,
        password: 'CrossOrgPass123',
        departmentId: deptBId,
      });
    expect(createAttempt.status).toBe(400);

    const validUser = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Valid User', email: `validuser-${Date.now()}@acme.test`, password: 'ValidUserPass123' });

    const updateAttempt = await request(app)
      .patch(`/api/users/${validUser.body.user._id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ departmentId: deptBId });
    expect(updateAttempt.status).toBe(400);
  });

  it("prevents an admin from viewing, editing, or deactivating another organization's user", async () => {
    const orgA = await createOrganizationWithAdmin(app, { name: 'Org A' });
    const orgB = await createOrganizationWithAdmin(app, { name: 'Org B' });
    const tokenA = await loginAs(orgA.payload.adminEmail, orgA.payload.adminPassword);

    const userBId = orgB.response.body.user._id;

    const getAttempt = await request(app).get(`/api/users/${userBId}`).set('Authorization', `Bearer ${tokenA}`);
    expect(getAttempt.status).toBe(404);

    const updateAttempt = await request(app)
      .patch(`/api/users/${userBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Hijacked' });
    expect(updateAttempt.status).toBe(404);

    const statusAttempt = await request(app)
      .patch(`/api/users/${userBId}/status`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'inactive' });
    expect(statusAttempt.status).toBe(404);
  });

  it('rejects a non-admin from every user management endpoint', async () => {
    const org = await createOrganizationWithAdmin(app);
    const adminToken = await loginAs(org.payload.adminEmail, org.payload.adminPassword);

    const employeePassword = 'EmployeePass123';
    const employee = await User.create({
      organizationId: org.response.body.organization._id,
      name: 'Regular Employee',
      email: `employee-${Date.now()}@acme.test`,
      password: await bcrypt.hash(employeePassword, 10),
      role: 'employee',
    });
    const employeeToken = await loginAs(employee.email, employeePassword);

    const attempts = await Promise.all([
      request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ name: 'X', email: `x-${Date.now()}@acme.test`, password: 'XPassword123' }),
      request(app).get('/api/users').set('Authorization', `Bearer ${employeeToken}`),
      request(app).get(`/api/users/${employee._id}`).set('Authorization', `Bearer ${employeeToken}`),
      request(app)
        .patch(`/api/users/${employee._id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ name: 'Y' }),
      request(app)
        .patch(`/api/users/${employee._id}/status`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ status: 'inactive' }),
    ]);

    attempts.forEach((response) => expect(response.status).toBe(403));
  });
});
