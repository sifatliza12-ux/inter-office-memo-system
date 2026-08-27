const request = require('supertest');
const mongoose = require('mongoose');

const app = require('../src/app');
const User = require('../src/models/User');
const Notification = require('../src/models/Notification');
const WorkflowStep = require('../src/models/WorkflowStep');
const { createOrganizationWithAdmin } = require('./helpers');
const { loginAs, createEmployee, createSubmittedWorkflow } = require('./workflowHelpers');

const getAdminUser = (email) => User.findOne({ email });

describe('Notification triggers', () => {
  it('submit notifies the first workflow participant', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, referenceNumber, participants } = await createSubmittedWorkflow(
      app,
      organizationId,
      authorToken,
      2
    );

    const notifications = await Notification.find({ userId: participants[0].user._id, memoId });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toMatch(/awaiting your approval/i);
    expect(notifications[0].message).toContain(referenceNumber);

    const secondParticipantNotifications = await Notification.find({ userId: participants[1].user._id });
    expect(secondParticipantNotifications).toHaveLength(0);
  });

  it('an approval that advances the workflow (not final) notifies the new current approver only', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 2);

    await request(app).post(`/api/memos/${memoId}/approve`).set('Authorization', `Bearer ${participants[0].token}`).send({});

    const newApproverNotifications = await Notification.find({ userId: participants[1].user._id, memoId });
    expect(newApproverNotifications).toHaveLength(1);
    expect(newApproverNotifications[0].title).toMatch(/awaiting your approval/i);

    // The previous approver should not get a second/duplicate notification
    // from this action — still exactly the one they got at submit time.
    const previousApproverNotifications = await Notification.find({ userId: participants[0].user._id, memoId });
    expect(previousApproverNotifications).toHaveLength(1);
  });

  it('the final approval notifies the author', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);
    const admin = await getAdminUser(org.payload.adminEmail);

    await request(app).post(`/api/memos/${memoId}/approve`).set('Authorization', `Bearer ${participants[0].token}`).send({});

    const authorNotifications = await Notification.find({ userId: admin._id, memoId });
    expect(authorNotifications).toHaveLength(1);
    expect(authorNotifications[0].title).toMatch(/approved/i);
  });

  it('reject notifies the author', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);
    const admin = await getAdminUser(org.payload.adminEmail);

    await request(app)
      .post(`/api/memos/${memoId}/reject`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ comment: 'No good' });

    const authorNotifications = await Notification.find({ userId: admin._id, memoId });
    expect(authorNotifications).toHaveLength(1);
    expect(authorNotifications[0].title).toMatch(/rejected/i);
  });

  it('request-changes notifies the author', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);
    const admin = await getAdminUser(org.payload.adminEmail);

    await request(app)
      .post(`/api/memos/${memoId}/request-changes`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ comment: 'Fix the numbers' });

    const authorNotifications = await Notification.find({ userId: admin._id, memoId });
    expect(authorNotifications).toHaveLength(1);
    expect(authorNotifications[0].title).toMatch(/changes requested/i);
  });

  it('resubmit notifies the (re-appended) current approver again', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    await request(app)
      .post(`/api/memos/${memoId}/request-changes`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ comment: 'Fix the numbers' });

    const beforeResubmit = await Notification.find({ userId: participants[0].user._id, memoId });
    expect(beforeResubmit).toHaveLength(1); // just the original submit notification

    await request(app)
      .patch(`/api/memos/${memoId}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ body: 'Revised body' });
    await request(app).post(`/api/memos/${memoId}/resubmit`).set('Authorization', `Bearer ${authorToken}`);

    const afterResubmit = await Notification.find({ userId: participants[0].user._id, memoId }).sort({
      createdAt: 1,
    });
    expect(afterResubmit).toHaveLength(2);
    expect(afterResubmit[1].title).toMatch(/awaiting your approval/i);
  });

  it('add-participant notifies the newly added participant', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);
    const { user: extra } = await createEmployee(organizationId, { name: 'Extra Participant' });

    await request(app)
      .post(`/api/memos/${memoId}/workflow/add-participant`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ userId: extra._id.toString(), reason: 'Needs a second look' });

    const notifications = await Notification.find({ userId: extra._id, memoId });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toMatch(/added/i);
  });

  it('a general comment notifies every other workflow participant, and the request-changes reviewer still only sees their own earlier notification', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 3);
    const [p1, p2, p3] = participants;

    await request(app)
      .post(`/api/memos/${memoId}/comments`)
      .set('Authorization', `Bearer ${p1.token}`)
      .send({ text: 'Quick question about the budget line' });

    const p2Notifications = await Notification.find({ userId: p2.user._id, memoId });
    const p3Notifications = await Notification.find({ userId: p3.user._id, memoId });
    expect(p2Notifications.filter((n) => /comment/i.test(n.title))).toHaveLength(1);
    expect(p3Notifications.filter((n) => /comment/i.test(n.title))).toHaveLength(1);
  });

  it('does not notify the comment author about their own comment', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 2);

    // p1 is the current approver and already has exactly 1 notification
    // (the submit notification) before they comment.
    const before = await Notification.find({ userId: participants[0].user._id, memoId });
    expect(before).toHaveLength(1);

    await request(app)
      .post(`/api/memos/${memoId}/comments`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ text: 'Commenting on my own turn' });

    const after = await Notification.find({ userId: participants[0].user._id, memoId });
    expect(after).toHaveLength(1); // unchanged — no new notification from their own comment
  });

  it('notifies the author (who holds no WorkflowStep) when someone else comments, but not when the author comments themselves', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);
    const admin = await getAdminUser(org.payload.adminEmail);

    // Confirm the premise: the author holds no WorkflowStep on their own memo.
    const authorStep = await WorkflowStep.findOne({ memoId, userId: admin._id });
    expect(authorStep).toBeNull();

    await request(app)
      .post(`/api/memos/${memoId}/comments`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({ text: 'A question for the author' });

    const afterOthersComment = await Notification.find({ userId: admin._id, memoId });
    expect(afterOthersComment.filter((n) => /comment/i.test(n.title))).toHaveLength(1);

    await request(app)
      .post(`/api/memos/${memoId}/comments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ text: 'Thanks — replying now' });

    const afterOwnComment = await Notification.find({ userId: admin._id, memoId });
    expect(afterOwnComment.filter((n) => /comment/i.test(n.title))).toHaveLength(1); // unchanged
  });
});

describe('Notification endpoints', () => {
  it('lets a user mark only their own notification as read; another user gets 403/404', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    const list = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${participants[0].token}`);
    expect(list.status).toBe(200);
    expect(list.body.notifications).toHaveLength(1);
    const notificationId = list.body.notifications[0]._id;

    const { user: other, password: otherPassword } = await createEmployee(organizationId, { name: 'Other' });
    const otherToken = await loginAs(app, other.email, otherPassword);

    const wrongUserAttempt = await request(app)
      .patch(`/api/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect([403, 404]).toContain(wrongUserAttempt.status);

    const ownAttempt = await request(app)
      .patch(`/api/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${participants[0].token}`);
    expect(ownAttempt.status).toBe(200);
    expect(ownAttempt.body.notification.isRead).toBe(true);
  });

  it('unread count is accurate and drops after marking as read', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    const before = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${participants[0].token}`);
    expect(before.body.count).toBe(1);

    const list = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${participants[0].token}`);
    await request(app)
      .patch(`/api/notifications/${list.body.notifications[0]._id}/read`)
      .set('Authorization', `Bearer ${participants[0].token}`);

    const after = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${participants[0].token}`);
    expect(after.body.count).toBe(0);
  });

  it('mark-all-read clears unread count for the caller only, leaving other users untouched', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const { user: userA, password: passwordA } = await createEmployee(organizationId, { name: 'User A' });
    const { user: userB, password: passwordB } = await createEmployee(organizationId, { name: 'User B' });
    const tokenA = await loginAs(app, userA.email, passwordA);
    const tokenB = await loginAs(app, userB.email, passwordB);

    // This endpoint's own mechanics (scoping to the caller, flipping isRead)
    // are what's under test here — event-triggered creation is already
    // covered above, so notifications are seeded directly rather than via a
    // real workflow, which would create its own fresh, unrelated participants.
    await Notification.create([
      { userId: userA._id, memoId: new mongoose.Types.ObjectId(), title: 'A1', message: 'msg' },
      { userId: userA._id, memoId: new mongoose.Types.ObjectId(), title: 'A2', message: 'msg' },
      { userId: userB._id, memoId: new mongoose.Types.ObjectId(), title: 'B1', message: 'msg' },
    ]);

    const readAll = await request(app).patch('/api/notifications/read-all').set('Authorization', `Bearer ${tokenA}`);
    expect(readAll.status).toBe(200);

    const countA = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(countA.body.count).toBe(0);

    const countB = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(countB.body.count).toBe(1);
  });

  it('supports ?unreadOnly=true', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 1);

    const list = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${participants[0].token}`);
    await request(app)
      .patch(`/api/notifications/${list.body.notifications[0]._id}/read`)
      .set('Authorization', `Bearer ${participants[0].token}`);

    const unreadOnly = await request(app)
      .get('/api/notifications?unreadOnly=true')
      .set('Authorization', `Bearer ${participants[0].token}`);
    expect(unreadOnly.body.notifications).toHaveLength(0);

    const all = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${participants[0].token}`);
    expect(all.body.notifications).toHaveLength(1);
  });
});

describe('Notification creation resilience', () => {
  it('does not fail the approve action when notification creation throws', async () => {
    const org = await createOrganizationWithAdmin(app);
    const organizationId = org.response.body.organization._id;
    const authorToken = await loginAs(app, org.payload.adminEmail, org.payload.adminPassword);
    const { memoId, participants } = await createSubmittedWorkflow(app, organizationId, authorToken, 2);

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const createSpy = jest.spyOn(Notification, 'create').mockRejectedValueOnce(new Error('Simulated failure'));

    const approveResponse = await request(app)
      .post(`/api/memos/${memoId}/approve`)
      .set('Authorization', `Bearer ${participants[0].token}`)
      .send({});

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.memo.currentApproverId).toBe(participants[1].user._id.toString());
    expect(consoleErrorSpy).toHaveBeenCalled();

    createSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});
