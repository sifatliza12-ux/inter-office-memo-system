const request = require('supertest');
const bcrypt = require('bcrypt');

const app = require('../src/app');
const User = require('../src/models/User');
const Memo = require('../src/models/Memo');
const { createOrganizationWithAdmin } = require('./helpers');
const { loginAs, createEmployee } = require('./workflowHelpers');

const createTemplate = async (token, positions) => {
  const response = await request(app)
    .post('/api/workflow-templates')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Standard Approval', positions });
  return response.body.workflowTemplate;
};

describe('Memo creation from a workflow template (Stage 15)', () => {
  it('produces WorkflowStep records with the correct order, userId, and roleLabel seeded from the template', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const adminToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const { user: manager, password: managerPassword } = await createEmployee(organizationId, { name: 'Manager' });
    const { user: hr } = await createEmployee(organizationId, { name: 'HR Rep' });

    const template = await createTemplate(adminToken, [{ roleLabel: 'Line Manager' }, { roleLabel: 'HR' }]);

    const createResponse = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subject: 'Template Memo',
        body: 'Body',
        templateId: template._id,
        templateAssignments: [
          { order: 10, userId: manager._id.toString() },
          { order: 20, userId: hr._id.toString() },
        ],
      });
    expect(createResponse.status).toBe(201);
    const memoId = createResponse.body.memo._id;
    expect(createResponse.body.memo.workflowParticipants).toEqual([manager._id.toString(), hr._id.toString()]);

    const submitResponse = await request(app)
      .post(`/api/memos/${memoId}/submit`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(submitResponse.status).toBe(200);

    const steps = submitResponse.body.workflowSteps;
    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({ userId: manager._id.toString(), stepOrder: 10, roleLabel: 'Line Manager' });
    expect(steps[1]).toMatchObject({ userId: hr._id.toString(), stepOrder: 20, roleLabel: 'HR' });

    // roleLabel is a starting value only — still editable via the existing,
    // unchanged PATCH /:id/workflow/role endpoint.
    const managerToken = await loginAs(app, manager.email, managerPassword);
    const roleEdit = await request(app)
      .patch(`/api/memos/${memoId}/workflow/role`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ roleLabel: 'Direct Supervisor' });
    expect(roleEdit.status).toBe(200);
    expect(roleEdit.body.workflowStep.roleLabel).toBe('Direct Supervisor');
  });

  it('rejects the whole creation with 422 when a template position is assigned to a DEACTIVATED user', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const adminToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const { user: manager } = await createEmployee(organizationId, { name: 'Manager' });
    const inactiveUser = await User.create({
      organizationId,
      name: 'Inactive User',
      email: `inactive-${Date.now()}@acme.test`,
      password: await bcrypt.hash('InactivePass123', 10),
      role: 'employee',
      status: 'inactive',
    });

    const template = await createTemplate(adminToken, [{ roleLabel: 'Line Manager' }, { roleLabel: 'HR' }]);

    const createResponse = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subject: 'Should not be created',
        body: 'Body',
        templateId: template._id,
        templateAssignments: [
          { order: 10, userId: manager._id.toString() },
          { order: 20, userId: inactiveUser._id.toString() },
        ],
      });

    expect(createResponse.status).toBe(422);

    const memoCount = await Memo.countDocuments({ organizationId });
    expect(memoCount).toBe(0);
  });

  it('rejects the whole creation with 422 when a template position is assigned to a user outside the organization', async () => {
    const orgA = await createOrganizationWithAdmin(app, { name: 'Org A' });
    const orgB = await createOrganizationWithAdmin(app, { name: 'Org B' });
    const tokenA = await loginAs(app, orgA.payload.adminEmail, orgA.payload.adminPassword);

    const { user: outsider } = await createEmployee(orgB.response.body.organization._id, { name: 'Outsider' });
    const { user: insider } = await createEmployee(orgA.response.body.organization._id, { name: 'Insider' });

    const template = await createTemplate(tokenA, [{ roleLabel: 'Line Manager' }, { roleLabel: 'HR' }]);

    const createResponse = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        subject: 'Should not be created',
        body: 'Body',
        templateId: template._id,
        templateAssignments: [
          { order: 10, userId: insider._id.toString() },
          { order: 20, userId: outsider._id.toString() },
        ],
      });

    expect(createResponse.status).toBe(422);
  });

  it('rejects the whole creation with 422 when an assignment is missing for a position (incomplete, bypassing the frontend)', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const adminToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const { user: manager } = await createEmployee(organizationId, { name: 'Manager' });
    const template = await createTemplate(adminToken, [{ roleLabel: 'Line Manager' }, { roleLabel: 'HR' }]);

    const createResponse = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subject: 'Should not be created',
        body: 'Body',
        templateId: template._id,
        // Only position order 10 assigned — order 20 (HR) is missing entirely.
        templateAssignments: [{ order: 10, userId: manager._id.toString() }],
      });

    expect(createResponse.status).toBe(422);
  });

  it('rejects creation with 400 when templateId is inactive or belongs to another organization', async () => {
    const orgA = await createOrganizationWithAdmin(app, { name: 'Org A' });
    const orgB = await createOrganizationWithAdmin(app, { name: 'Org B' });
    const tokenA = await loginAs(app, orgA.payload.adminEmail, orgA.payload.adminPassword);
    const tokenB = await loginAs(app, orgB.payload.adminEmail, orgB.payload.adminPassword);
    const { user: insider } = await createEmployee(orgA.response.body.organization._id, { name: 'Insider' });

    const templateB = await createTemplate(tokenB, [{ roleLabel: 'Line Manager' }]);
    const crossOrgAttempt = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        subject: 'Should not be created',
        body: 'Body',
        templateId: templateB._id,
        templateAssignments: [{ order: 10, userId: insider._id.toString() }],
      });
    expect(crossOrgAttempt.status).toBe(400);

    const templateA = await createTemplate(tokenA, [{ roleLabel: 'Line Manager' }]);
    await request(app)
      .patch(`/api/workflow-templates/${templateA._id}/deactivate`)
      .set('Authorization', `Bearer ${tokenA}`);

    const inactiveTemplateAttempt = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        subject: 'Should not be created',
        body: 'Body',
        templateId: templateA._id,
        templateAssignments: [{ order: 10, userId: insider._id.toString() }],
      });
    expect(inactiveTemplateAttempt.status).toBe(400);
  });

  it('populates originalWorkflowParticipants identically for a template-built memo and a manually-built memo with the same participants', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const adminToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const { user: manager } = await createEmployee(organizationId, { name: 'Manager' });
    const { user: hr } = await createEmployee(organizationId, { name: 'HR Rep' });
    const participantIds = [manager._id.toString(), hr._id.toString()];

    const template = await createTemplate(adminToken, [{ roleLabel: 'Line Manager' }, { roleLabel: 'HR' }]);

    const templateMemo = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subject: 'Template Built',
        body: 'Body',
        templateId: template._id,
        templateAssignments: [
          { order: 10, userId: manager._id.toString() },
          { order: 20, userId: hr._id.toString() },
        ],
      });
    const templateSubmit = await request(app)
      .post(`/api/memos/${templateMemo.body.memo._id}/submit`)
      .set('Authorization', `Bearer ${adminToken}`);

    const manualMemo = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subject: 'Manually Built', body: 'Body', workflowParticipants: participantIds });
    const manualSubmit = await request(app)
      .post(`/api/memos/${manualMemo.body.memo._id}/submit`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(templateSubmit.body.memo.originalWorkflowParticipants).toEqual(participantIds);
    expect(manualSubmit.body.memo.originalWorkflowParticipants).toEqual(participantIds);
    expect(templateSubmit.body.memo.originalWorkflowParticipants).toEqual(
      manualSubmit.body.memo.originalWorkflowParticipants
    );
  });

  it('leaves manual (non-template) memo creation completely unaffected', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const adminToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { user: participant } = await createEmployee(organizationId, { name: 'Participant' });

    const createResponse = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subject: 'Manual Memo', body: 'Body', workflowParticipants: [participant._id.toString()] });
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.memo.workflowTemplateId).toBeUndefined();

    const submitResponse = await request(app)
      .post(`/api/memos/${createResponse.body.memo._id}/submit`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(submitResponse.status).toBe(200);
    expect(submitResponse.body.workflowSteps[0].roleLabel).toBeUndefined();
  });

  it('editing one position of a template-built draft clears only that position\'s seeded label, not the whole list', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const adminToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const { user: userA } = await createEmployee(organizationId, { name: 'User A' });
    const { user: userB } = await createEmployee(organizationId, { name: 'User B' });
    const { user: userC } = await createEmployee(organizationId, { name: 'User C' });
    const { user: userD } = await createEmployee(organizationId, { name: 'User D' });

    const template = await createTemplate(adminToken, [
      { roleLabel: 'Pos1' },
      { roleLabel: 'Pos2' },
      { roleLabel: 'Pos3' },
    ]);

    const createResponse = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subject: 'Draft From Template',
        body: 'Body',
        templateId: template._id,
        templateAssignments: [
          { order: 10, userId: userA._id.toString() },
          { order: 20, userId: userB._id.toString() },
          { order: 30, userId: userC._id.toString() },
        ],
      });
    expect(createResponse.body.memo.templateRoleLabels).toEqual(['Pos1', 'Pos2', 'Pos3']);
    const memoId = createResponse.body.memo._id;

    // Only the middle position's user changes (B -> D); positions 1 and 3
    // (A and C) stay exactly where they were.
    const updateResponse = await request(app)
      .patch(`/api/memos/${memoId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        workflowParticipants: [userA._id.toString(), userD._id.toString(), userC._id.toString()],
      });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.memo.templateRoleLabels[0]).toBe('Pos1');
    expect(updateResponse.body.memo.templateRoleLabels[1]).toBeFalsy();
    expect(updateResponse.body.memo.templateRoleLabels[2]).toBe('Pos3');

    const submitResponse = await request(app)
      .post(`/api/memos/${memoId}/submit`)
      .set('Authorization', `Bearer ${adminToken}`);
    const steps = submitResponse.body.workflowSteps;
    expect(steps[0]).toMatchObject({ userId: userA._id.toString(), roleLabel: 'Pos1' });
    expect(steps[1].userId).toBe(userD._id.toString());
    expect(steps[1].roleLabel).toBeUndefined();
    expect(steps[2]).toMatchObject({ userId: userC._id.toString(), roleLabel: 'Pos3' });
  });

  it('never touches an already-customized WorkflowStep.roleLabel, even when the same edit changes workflowParticipants', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const adminToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);

    const { user: manager, password: managerPassword } = await createEmployee(organizationId, { name: 'Manager' });
    const { user: hr, password: hrPassword } = await createEmployee(organizationId, { name: 'HR Rep' });
    const { user: substituteManager } = await createEmployee(organizationId, { name: 'Substitute Manager' });

    const template = await createTemplate(adminToken, [{ roleLabel: 'Line Manager' }, { roleLabel: 'HR' }]);

    const createResponse = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subject: 'Template Memo',
        body: 'Body',
        templateId: template._id,
        templateAssignments: [
          { order: 10, userId: manager._id.toString() },
          { order: 20, userId: hr._id.toString() },
        ],
      });
    const memoId = createResponse.body.memo._id;
    await request(app).post(`/api/memos/${memoId}/submit`).set('Authorization', `Bearer ${adminToken}`);

    // HR is not yet the current approver, but any participant (past/
    // current/future) may set their own label at any time — this is the
    // existing, unchanged setMyRoleLabel contract.
    const hrToken = await loginAs(app, hr.email, hrPassword);
    const roleEdit = await request(app)
      .patch(`/api/memos/${memoId}/workflow/role`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ roleLabel: 'Human Resources Lead' });
    expect(roleEdit.status).toBe(200);
    expect(roleEdit.body.workflowStep.roleLabel).toBe('Human Resources Lead');

    // Manager (the current approver) sends it back for changes.
    const managerToken = await loginAs(app, manager.email, managerPassword);
    const requestChangesResponse = await request(app)
      .post(`/api/memos/${memoId}/request-changes`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ comment: 'Please revise the wording' });
    expect(requestChangesResponse.body.memo.status).toBe('changes_requested');

    // Author edits the memo, swapping the FIRST position's user — HR (the
    // second position) is left exactly where it was.
    const updateResponse = await request(app)
      .patch(`/api/memos/${memoId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ workflowParticipants: [substituteManager._id.toString(), hr._id.toString()] });
    expect(updateResponse.status).toBe(200);

    const workflowHistory = await request(app)
      .get(`/api/memos/${memoId}/workflow`)
      .set('Authorization', `Bearer ${adminToken}`);
    const hrStep = workflowHistory.body.workflowSteps.find((step) => (step.userId?._id || step.userId) === hr._id.toString());
    expect(hrStep.roleLabel).toBe('Human Resources Lead');
  });

  it('deactivating a template afterward does not affect a memo already built from it', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const adminToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { user: manager, password: managerPassword } = await createEmployee(organizationId, { name: 'Manager' });

    const template = await createTemplate(adminToken, [{ roleLabel: 'Line Manager' }]);

    const createResponse = await request(app)
      .post('/api/memos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subject: 'Template Memo',
        body: 'Body',
        templateId: template._id,
        templateAssignments: [{ order: 10, userId: manager._id.toString() }],
      });
    const memoId = createResponse.body.memo._id;
    await request(app).post(`/api/memos/${memoId}/submit`).set('Authorization', `Bearer ${adminToken}`);

    await request(app)
      .patch(`/api/workflow-templates/${template._id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);

    const managerToken = await loginAs(app, manager.email, managerPassword);
    const approveResponse = await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ comment: 'Looks good' });

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.memo.status).toBe('approved');
  });
});
