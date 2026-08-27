const fs = require('fs');
const path = require('path');
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

  // attachment.service.js writes real files to disk (deliberately not
  // mocked, so upload/download tests exercise the real filesystem path) —
  // the in-memory Mongo teardown above has no effect on those. Without
  // this, every test run leaves orphaned files in uploads/ behind.
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  fs.rmSync(uploadsDir, { recursive: true, force: true });
});
