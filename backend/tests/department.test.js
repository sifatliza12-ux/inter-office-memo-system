const request = require('supertest');
const bcrypt = require('bcrypt');

const app = require('../src/app');
const User = require('../src/models/User');
const { createOrganizationWithAdmin } = require('./helpers');

const loginAs = async (email, password) => {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  return response.body.token;
};

describe('Department administration', () => {
  it('lets an admin create, list, get, update, and toggle a department in their own org', async () => {
    const org = await createOrganizationWithAdmin(app);
    const token = await loginAs(org.payload.adminEmail, org.payload.adminPassword);

    const createResponse = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Engineering', description: 'Builds the product' });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.department.status).toBe('active');
    const departmentId = createResponse.body.department._id;

    const listResponse = await request(app).get('/api/departments').set('Authorization', `Bearer ${token}`);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.departments).toHaveLength(1);

    const getResponse = await request(app)
      .get(`/api/departments/${departmentId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.department.name).toBe('Engineering');

    const updateResponse = await request(app)
      .patch(`/api/departments/${departmentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Builds and ships the product' });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.department.description).toBe('Builds and ships the product');

    const deactivateResponse = await request(app)
      .patch(`/api/departments/${departmentId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'inactive' });
    expect(deactivateResponse.status).toBe(200);
    expect(deactivateResponse.body.department.status).toBe('inactive');

    const reactivateResponse = await request(app)
      .patch(`/api/departments/${departmentId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'active' });
    expect(reactivateResponse.status).toBe(200);
    expect(reactivateResponse.body.department.status).toBe('active');
  });

  it('filters the department list by status', async () => {
    const org = await createOrganizationWithAdmin(app);
    const token = await loginAs(org.payload.adminEmail, org.payload.adminPassword);

    const dept1 = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Active Dept' });
    const dept2 = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Inactive Dept' });

    await request(app)
      .patch(`/api/departments/${dept2.body.department._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'inactive' });

    const activeOnly = await request(app)
      .get('/api/departments?status=active')
      .set('Authorization', `Bearer ${token}`);

    expect(activeOnly.body.departments).toHaveLength(1);
    expect(activeOnly.body.departments[0]._id).toBe(dept1.body.department._id);
  });

  it('deactivating a department does not delete it or affect its users', async () => {
    const org = await createOrganizationWithAdmin(app);
    const token = await loginAs(org.payload.adminEmail, org.payload.adminPassword);

    const dept = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Support' });
    const departmentId = dept.body.department._id;

    const userResponse = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Support Person',
        email: `support-${Date.now()}@acme.test`,
        password: 'SupportPass123',
        departmentId,
      });
    expect(userResponse.status).toBe(201);
    const userId = userResponse.body.user._id;

    await request(app)
      .patch(`/api/departments/${departmentId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'inactive' });

    const getDept = await request(app)
      .get(`/api/departments/${departmentId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getDept.status).toBe(200);
    expect(getDept.body.department.status).toBe('inactive');

    const getUser = await request(app).get(`/api/users/${userId}`).set('Authorization', `Bearer ${token}`);
    expect(getUser.status).toBe(200);
    expect(getUser.body.user.departmentId).toBe(departmentId);
    expect(getUser.body.user.status).toBe('active');
  });

  it('rejects a non-admin from every department endpoint', async () => {
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

    const dept = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Ops' });
    const departmentId = dept.body.department._id;

    const attempts = await Promise.all([
      request(app).post('/api/departments').set('Authorization', `Bearer ${employeeToken}`).send({ name: 'X' }),
      request(app).get('/api/departments').set('Authorization', `Bearer ${employeeToken}`),
      request(app).get(`/api/departments/${departmentId}`).set('Authorization', `Bearer ${employeeToken}`),
      request(app)
        .patch(`/api/departments/${departmentId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ name: 'Y' }),
      request(app)
        .patch(`/api/departments/${departmentId}/status`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ status: 'inactive' }),
    ]);

    attempts.forEach((response) => expect(response.status).toBe(403));
  });

  it("prevents an admin from viewing, editing, or deactivating another organization's department", async () => {
    const orgA = await createOrganizationWithAdmin(app, { name: 'Org A' });
    const orgB = await createOrganizationWithAdmin(app, { name: 'Org B' });
    const tokenA = await loginAs(orgA.payload.adminEmail, orgA.payload.adminPassword);
    const tokenB = await loginAs(orgB.payload.adminEmail, orgB.payload.adminPassword);

    const deptB = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Org B Dept' });
    const deptBId = deptB.body.department._id;

    const getAttempt = await request(app)
      .get(`/api/departments/${deptBId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(getAttempt.status).toBe(404);

    const updateAttempt = await request(app)
      .patch(`/api/departments/${deptBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Hijacked' });
    expect(updateAttempt.status).toBe(404);

    const statusAttempt = await request(app)
      .patch(`/api/departments/${deptBId}/status`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'inactive' });
    expect(statusAttempt.status).toBe(404);

    const listAttempt = await request(app).get('/api/departments').set('Authorization', `Bearer ${tokenA}`);
    expect(listAttempt.body.departments.find((department) => department._id === deptBId)).toBeUndefined();
  });
});
