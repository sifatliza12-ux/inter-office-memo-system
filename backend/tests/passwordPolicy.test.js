const request = require('supertest');

const app = require('../src/app');
const User = require('../src/models/User');
const { isValidPassword } = require('../src/utils/passwordPolicy');
const { createOrganizationWithAdmin } = require('./helpers');

const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const registerWithPassword = (password) => {
  const suffix = uniqueSuffix();
  return request(app)
    .post('/api/organizations')
    .send({
      name: 'Password Policy Test Org',
      identifier: `pwpolicy-${suffix}`,
      adminName: 'Policy Tester',
      adminEmail: `policy-${suffix}@acme.test`,
      adminPassword: password,
    });
};

const createUserWithPassword = async (adminToken, password) => {
  const suffix = uniqueSuffix();
  return request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Policy Target User', email: `policy-target-${suffix}@acme.test`, password });
};

describe('Password policy — unit', () => {
  it('accepts passwords meeting every requirement', () => {
    expect(isValidPassword('ForgeFlow1!')).toBe(true);
    expect(isValidPassword('SecurePass9@')).toBe(true);
    expect(isValidPassword('A1!aaaaaaaaaaaaaaaaaaaaa')).toBe(true); // longer valid password
  });

  it('rejects passwords missing one or more requirements', () => {
    expect(isValidPassword('12345678')).toBe(false); // no letters, no special char
    expect(isValidPassword('password')).toBe(false); // no upper, no number, no special
    expect(isValidPassword('Password1')).toBe(false); // no special char
    expect(isValidPassword('password!')).toBe(false); // no upper, no number
    expect(isValidPassword('PASSWORD1!')).toBe(false); // no lowercase
    expect(isValidPassword('Password!')).toBe(false); // no number
    expect(isValidPassword('Pw1!')).toBe(false); // too short (< 8)
    expect(isValidPassword('')).toBe(false); // empty
    expect(isValidPassword('        ')).toBe(false); // whitespace-only
    expect(isValidPassword(undefined)).toBe(false);
    expect(isValidPassword(null)).toBe(false);
  });
});

describe('Password policy — registration API (POST /api/organizations)', () => {
  it('accepts a valid password', async () => {
    const response = await registerWithPassword('ForgeFlow1!');
    expect(response.status).toBe(201);
  });

  it('accepts a longer valid password', async () => {
    const response = await registerWithPassword('AVeryLongAndSecurePassphrase9!');
    expect(response.status).toBe(201);
  });

  it.each([
    ['too short', 'Ab1!'],
    ['no uppercase', 'lowercase1!'],
    ['no lowercase', 'UPPERCASE1!'],
    ['no number', 'NoNumberHere!'],
    ['no special character', 'NoSpecialChar1'],
    ['empty password', ''],
    ['whitespace-only password', '        '],
  ])('rejects: %s', async (_label, password) => {
    const response = await registerWithPassword(password);
    expect(response.status).toBe(400);
    expect(response.body.message).toEqual(expect.any(String));
    // Error response must never echo the rejected password back.
    if (password) {
      expect(JSON.stringify(response.body)).not.toContain(password);
    }
  });

  it('rejects an invalid password even when every other field is well-formed (bypassing any client-side check)', async () => {
    const response = await registerWithPassword('nocaps1!');
    expect(response.status).toBe(400);
    // Nothing was persisted for the rejected attempt.
    const created = await User.findOne({ email: /policy-/ }).sort({ createdAt: -1 });
    if (created) {
      const isMatch = await require('bcrypt').compare('nocaps1!', created.password ?? '');
      expect(isMatch).toBe(false);
    }
  });
});

describe('Password policy — user creation API (POST /api/users), same policy as registration', () => {
  let adminToken;

  beforeEach(async () => {
    const org = await createOrganizationWithAdmin(app);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: org.payload.adminEmail, password: org.payload.adminPassword });
    adminToken = login.body.token;
  });

  it('accepts a valid password', async () => {
    const response = await createUserWithPassword(adminToken, 'SecurePass9@');
    expect(response.status).toBe(201);
    expect(response.body.user.password).toBeUndefined();
  });

  it.each([
    ['too short', 'Ab1!'],
    ['no uppercase', 'lowercase1!'],
    ['no lowercase', 'UPPERCASE1!'],
    ['no number', 'NoNumberHere!'],
    ['no special character', 'NoSpecialChar1'],
    ['empty password', ''],
    ['whitespace-only password', '        '],
  ])('rejects: %s — identical policy to registration', async (_label, password) => {
    const response = await createUserWithPassword(adminToken, password);
    expect(response.status).toBe(400);
  });
});

describe('Password policy does not disturb existing authentication', () => {
  it('a user created with a compliant password can still log in normally', async () => {
    const org = await createOrganizationWithAdmin(app);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: org.payload.adminEmail, password: org.payload.adminPassword });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.token).toEqual(expect.any(String));
    expect(loginResponse.body.user.password).toBeUndefined();
  });

  it('the stored password is still bcrypt-hashed, never stored or returned in plaintext', async () => {
    const suffix = uniqueSuffix();
    const plainPassword = 'ForgeFlow1!';
    const response = await request(app)
      .post('/api/organizations')
      .send({
        name: 'Hash Check Org',
        identifier: `hashcheck-${suffix}`,
        adminName: 'Hash Check Admin',
        adminEmail: `hashcheck-${suffix}@acme.test`,
        adminPassword: plainPassword,
      });

    expect(response.status).toBe(201);
    expect(JSON.stringify(response.body)).not.toContain(plainPassword);

    const stored = await User.findOne({ email: `hashcheck-${suffix}@acme.test` }).select('+password');
    expect(stored.password).not.toBe(plainPassword);
    expect(stored.password.startsWith('$2')).toBe(true); // bcrypt hash prefix
  });
});
