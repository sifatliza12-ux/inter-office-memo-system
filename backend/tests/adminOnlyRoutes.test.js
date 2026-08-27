const request = require('supertest');
const bcrypt = require('bcrypt');

const app = require('../src/app');
const User = require('../src/models/User');
const { createOrganizationWithAdmin } = require('./helpers');

const loginAs = async (email, password) => {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  return response.body.token;
};

// The exact, and only, message middleware/role.js's authorize() throws.
// Unlike a bare 403 status — which tenantIsolation.js and auth.service.js's
// inactive-account check can also produce, for unrelated reasons — this
// string is unique to the admin-role check, so asserting on it (not just the
// status code) pins each rejection below specifically to that layer.
const ROLE_REJECTION_MESSAGE = 'You do not have permission to perform this action';

describe('Admin-only route authorization (Stage 3: department + user administration)', () => {
  it('rejects an authenticated employee, in their own organization, from all 10 admin routes via the role layer specifically', async () => {
    const org = await createOrganizationWithAdmin(app);
    const adminToken = await loginAs(org.payload.adminEmail, org.payload.adminPassword);
    const organizationId = org.response.body.organization._id;

    // A real, valid, same-organization department for the employee to target.
    // If the role check were bypassed, this GET/PATCH would succeed (200),
    // not fail for an unrelated reason — so a 403 here can't be tenant
    // isolation or a missing resource in disguise.
    const department = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Engineering' });
    expect(department.status).toBe(201);
    const departmentId = department.body.department._id;

    // A real, valid, same-organization user — distinct from the employee who
    // will be making the requests below, so PATCH .../status can't
    // coincidentally trip the separate "cannot deactivate your own account"
    // business rule instead of the role check.
    const targetUser = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Target User', email: `target-${Date.now()}@acme.test`, password: 'TargetPass123' });
    expect(targetUser.status).toBe(201);
    const targetUserId = targetUser.body.user._id;

    // The requesting principal: a genuine employee in the same organization,
    // authenticated through the real login flow (a real, valid JWT — not a
    // hand-crafted token), so authentication itself is not in question.
    const employeePassword = 'EmployeePass123';
    const employee = await User.create({
      organizationId,
      name: 'Regular Employee',
      email: `employee-${Date.now()}@acme.test`,
      password: await bcrypt.hash(employeePassword, 10),
      role: 'employee',
    });
    const employeeToken = await loginAs(employee.email, employeePassword);
    expect(employeeToken).toEqual(expect.any(String));

    // All 10 admin routes added in this stage, each called with valid,
    // well-formed data against a resource that genuinely belongs to the
    // employee's own organization — so if role authorization were removed,
    // every one of these would succeed instead of failing for some other
    // reason (validation, a missing resource, or tenant isolation).
    const requests = [
      ['post', '/api/departments', { name: 'Should Not Be Created' }],
      ['get', '/api/departments', undefined],
      ['get', `/api/departments/${departmentId}`, undefined],
      ['patch', `/api/departments/${departmentId}`, { description: 'Should not be updated' }],
      ['patch', `/api/departments/${departmentId}/status`, { status: 'inactive' }],
      [
        'post',
        '/api/users',
        { name: 'Should Not Be Created', email: `blocked-${Date.now()}@acme.test`, password: 'BlockedPass123' },
      ],
      ['get', '/api/users', undefined],
      ['get', `/api/users/${targetUserId}`, undefined],
      ['patch', `/api/users/${targetUserId}`, { designation: 'Should not be updated' }],
      ['patch', `/api/users/${targetUserId}/status`, { status: 'inactive' }],
    ];

    const responses = await Promise.all(
      requests.map(([method, path, body]) => {
        const pendingRequest = request(app)[method](path).set('Authorization', `Bearer ${employeeToken}`);
        return body ? pendingRequest.send(body) : pendingRequest;
      })
    );

    requests.forEach(([method, path], index) => {
      const response = responses[index];
      expect({ method, path, status: response.status, message: response.body.message }).toEqual({
        method,
        path,
        status: 403,
        message: ROLE_REJECTION_MESSAGE,
      });
    });

    expect(responses).toHaveLength(10);
  });
});
