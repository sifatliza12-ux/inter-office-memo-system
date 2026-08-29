const request = require('supertest');

const app = require('../src/app');
const { createOrganizationWithAdmin } = require('./helpers');
const { loginAs, createEmployee } = require('./workflowHelpers');

const samplePositions = [{ roleLabel: 'Line Manager' }, { roleLabel: 'HR' }];

describe('Workflow template administration (Stage 15)', () => {
  it('lets an admin create a template with server-assigned, gapped order values', async () => {
    const org = await createOrganizationWithAdmin(app);
    const token = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const response = await request(app)
      .post('/api/workflow-templates')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Standard Approval', positions: samplePositions });

    expect(response.status).toBe(201);
    expect(response.body.workflowTemplate.name).toBe('Standard Approval');
    expect(response.body.workflowTemplate.status).toBe('active');
    expect(response.body.workflowTemplate.positions).toEqual([
      { order: 10, roleLabel: 'Line Manager' },
      { order: 20, roleLabel: 'HR' },
    ]);
  });

  it('rejects a template with no positions and a position with no roleLabel', async () => {
    const org = await createOrganizationWithAdmin(app);
    const token = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const noPositions = await request(app)
      .post('/api/workflow-templates')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Empty', positions: [] });
    expect(noPositions.status).toBe(400);

    const blankLabel = await request(app)
      .post('/api/workflow-templates')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Blank', positions: [{ roleLabel: '   ' }] });
    expect(blankLabel.status).toBe(400);
  });

  it('lets an admin update name/positions on an active template, re-sequencing order from the new array', async () => {
    const org = await createOrganizationWithAdmin(app);
    const token = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const created = await request(app)
      .post('/api/workflow-templates')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Standard Approval', positions: samplePositions });
    const templateId = created.body.workflowTemplate._id;

    const updated = await request(app)
      .patch(`/api/workflow-templates/${templateId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Fast Track', positions: [{ roleLabel: 'Director' }] });

    expect(updated.status).toBe(200);
    expect(updated.body.workflowTemplate.name).toBe('Fast Track');
    expect(updated.body.workflowTemplate.positions).toEqual([{ order: 10, roleLabel: 'Director' }]);
  });

  it('deactivates a template one-way: no hard delete, no reactivate, and rejects further updates', async () => {
    const org = await createOrganizationWithAdmin(app);
    const token = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const created = await request(app)
      .post('/api/workflow-templates')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Standard Approval', positions: samplePositions });
    const templateId = created.body.workflowTemplate._id;

    const deactivated = await request(app)
      .patch(`/api/workflow-templates/${templateId}/deactivate`)
      .set('Authorization', `Bearer ${token}`);
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.workflowTemplate.status).toBe('inactive');

    // No hard delete: still fetchable via the admin includeInactive list.
    const adminList = await request(app)
      .get('/api/workflow-templates?includeInactive=true')
      .set('Authorization', `Bearer ${token}`);
    expect(adminList.body.workflowTemplates.map((t) => t._id)).toContain(templateId);

    // No reactivate endpoint this stage.
    const reactivateAttempt = await request(app)
      .patch(`/api/workflow-templates/${templateId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'active' });
    expect(reactivateAttempt.status).toBe(400);

    // Further edits to an inactive template are rejected too.
    const editAttempt = await request(app)
      .patch(`/api/workflow-templates/${templateId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Should not apply' });
    expect(editAttempt.status).toBe(400);
  });

  it('rejects a non-admin from create/update/deactivate but allows them to list active templates', async () => {
    const org = await createOrganizationWithAdmin(app);
    const adminToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const organizationId = org.response.body.organization._id;

    const created = await request(app)
      .post('/api/workflow-templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Standard Approval', positions: samplePositions });
    const templateId = created.body.workflowTemplate._id;

    const { user: employee, password } = await createEmployee(organizationId, { name: 'Regular Employee' });
    const employeeToken = await loginAs(app, employee.email, password);

    const attempts = await Promise.all([
      request(app)
        .post('/api/workflow-templates')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ name: 'Should not be created', positions: samplePositions }),
      request(app)
        .patch(`/api/workflow-templates/${templateId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ name: 'Should not update' }),
      request(app)
        .patch(`/api/workflow-templates/${templateId}/deactivate`)
        .set('Authorization', `Bearer ${employeeToken}`),
    ]);
    attempts.forEach((response) => expect(response.status).toBe(403));

    // But GET (list) works for a regular authenticated user.
    const listResponse = await request(app)
      .get('/api/workflow-templates')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.workflowTemplates.map((t) => t._id)).toContain(templateId);
  });

  it('a regular user only ever receives active templates, even passing includeInactive=true', async () => {
    const org = await createOrganizationWithAdmin(app);
    const adminToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const organizationId = org.response.body.organization._id;

    const active = await request(app)
      .post('/api/workflow-templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Active Template', positions: samplePositions });
    const inactive = await request(app)
      .post('/api/workflow-templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Inactive Template', positions: samplePositions });
    await request(app)
      .patch(`/api/workflow-templates/${inactive.body.workflowTemplate._id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);

    const { user: employee, password } = await createEmployee(organizationId, { name: 'Regular Employee' });
    const employeeToken = await loginAs(app, employee.email, password);

    const employeeList = await request(app)
      .get('/api/workflow-templates?includeInactive=true')
      .set('Authorization', `Bearer ${employeeToken}`);
    const ids = employeeList.body.workflowTemplates.map((t) => t._id);
    expect(ids).toContain(active.body.workflowTemplate._id);
    expect(ids).not.toContain(inactive.body.workflowTemplate._id);

    // Admin without includeInactive also only sees active ones, by default.
    const adminDefaultList = await request(app)
      .get('/api/workflow-templates')
      .set('Authorization', `Bearer ${adminToken}`);
    const adminDefaultIds = adminDefaultList.body.workflowTemplates.map((t) => t._id);
    expect(adminDefaultIds).toContain(active.body.workflowTemplate._id);
    expect(adminDefaultIds).not.toContain(inactive.body.workflowTemplate._id);

    // Admin WITH includeInactive sees both.
    const adminFullList = await request(app)
      .get('/api/workflow-templates?includeInactive=true')
      .set('Authorization', `Bearer ${adminToken}`);
    const adminFullIds = adminFullList.body.workflowTemplates.map((t) => t._id);
    expect(adminFullIds).toContain(active.body.workflowTemplate._id);
    expect(adminFullIds).toContain(inactive.body.workflowTemplate._id);
  });

  it("prevents an admin from updating, deactivating, or listing another organization's template", async () => {
    const orgA = await createOrganizationWithAdmin(app, { name: 'Org A' });
    const orgB = await createOrganizationWithAdmin(app, { name: 'Org B' });
    const tokenA = await loginAs(app, orgA.payload.adminEmail, orgA.payload.adminPassword);
    const tokenB = await loginAs(app, orgB.payload.adminEmail, orgB.payload.adminPassword);

    const templateB = await request(app)
      .post('/api/workflow-templates')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Org B Template', positions: samplePositions });
    const templateBId = templateB.body.workflowTemplate._id;

    const updateAttempt = await request(app)
      .patch(`/api/workflow-templates/${templateBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Hijacked' });
    expect(updateAttempt.status).toBe(404);

    const deactivateAttempt = await request(app)
      .patch(`/api/workflow-templates/${templateBId}/deactivate`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(deactivateAttempt.status).toBe(404);

    const listAttempt = await request(app).get('/api/workflow-templates').set('Authorization', `Bearer ${tokenA}`);
    expect(listAttempt.status).toBe(200);
    expect(listAttempt.body.workflowTemplates.map((t) => t._id)).not.toContain(templateBId);
  });
});
