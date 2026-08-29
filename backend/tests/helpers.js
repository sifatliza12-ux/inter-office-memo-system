const request = require('supertest');

const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createOrganizationWithAdmin = async (app, overrides = {}) => {
  const suffix = uniqueSuffix();

  const payload = {
    name: 'Acme Corp',
    identifier: `acme-${suffix}`,
    subscriptionTier: 'premium',
    adminName: 'Jane Admin',
    adminEmail: `jane-${suffix}@acme.test`,
    adminPassword: 'SuperSecret123!',
    ...overrides,
  };

  const response = await request(app).post('/api/organizations').send(payload);
  return { response, payload };
};

module.exports = { createOrganizationWithAdmin };
