const fs = require('fs');
const path = require('path');

// Set at module top level — setupFilesAfterEnv modules run before the test
// file itself is required, so this is in place before anything requires
// ../src/app (and transitively attachment.service.js) for the first time.
// Points the test suite at its own throwaway directory, isolated from the
// real backend/uploads/ a dev server might be concurrently writing to —
// without this, this file's own afterAll cleanup below would delete that
// shared directory out from under a running dev server (this happened in
// practice: a persistent local dev server started earlier in the session
// hit ENOENT after a later `npm test` run silently removed uploads/ from
// underneath it).
process.env.UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads-test');

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
  // this, every test run leaves orphaned files behind. Only ever removes
  // the isolated UPLOADS_DIR set above — never the real backend/uploads/.
  fs.rmSync(process.env.UPLOADS_DIR, { recursive: true, force: true });
});
