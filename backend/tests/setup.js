// Global for every test file (setupFilesAfterEnv runs before a test file's
// own requires) — any test that ends up exercising attachment.service.js,
// directly or as a side effect of building a fixture (e.g. Stage 11's PDF
// export tests uploading an attachment), gets this mock automatically
// rather than needing to remember to register it per-file. See
// supabaseStorageMock.js for the actual fake; attachments.test.js still
// requires it directly to inspect/reset call history between its own tests.
jest.mock('../src/config/supabaseClient', () => {
  // eslint-disable-next-line global-require
  const mockStorage = require('./supabaseStorageMock');
  return {
    getSupabaseClient: () => mockStorage.client,
    getSupabaseBucket: () => 'test-bucket',
  };
});

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-jest-only';
  process.env.JWT_EXPIRES_IN = '1h';

  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();

  await mongoose.connect(process.env.MONGODB_URI);
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
  // No filesystem cleanup needed as of Stage 8b — attachments now go
  // through a mocked Supabase Storage client (see tests/supabaseStorageMock.js),
  // never the real filesystem, so there's nothing left behind to remove.
});
