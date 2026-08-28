// A minimal in-memory fake for the slice of the Supabase Storage client
// surface attachment.service.js actually uses (upload/download/remove on
// one bucket) — enough to exercise real upload -> download byte round
// trips and delete behavior in tests without any real network call, per
// Stage 8b's explicit requirement that the suite stay mockable/offline.
// Jest-mocked in place of src/config/supabaseClient.js (see attachments.test.js).
const objects = new Map(); // key: `${bucket}::${path}` -> Buffer

const upload = jest.fn(async (bucket, storagePath, buffer) => {
  objects.set(`${bucket}::${storagePath}`, Buffer.from(buffer));
  return { data: { path: storagePath }, error: null };
});

const download = jest.fn(async (bucket, storagePath) => {
  const buffer = objects.get(`${bucket}::${storagePath}`);
  if (!buffer) {
    return { data: null, error: { message: 'Object not found' } };
  }
  // supabase-js's real download() resolves a Blob; attachment.service.js
  // only ever calls .arrayBuffer() on the result, so that's all this fake
  // needs to provide.
  return { data: { arrayBuffer: async () => buffer }, error: null };
});

const remove = jest.fn(async (bucket, storagePaths) => {
  storagePaths.forEach((storagePath) => objects.delete(`${bucket}::${storagePath}`));
  return { data: storagePaths.map((storagePath) => ({ name: storagePath })), error: null };
});

const client = {
  storage: {
    from: (bucket) => ({
      upload: (storagePath, buffer) => upload(bucket, storagePath, buffer),
      download: (storagePath) => download(bucket, storagePath),
      remove: (storagePaths) => remove(bucket, storagePaths),
    }),
  },
};

const reset = () => {
  objects.clear();
  upload.mockClear();
  download.mockClear();
  remove.mockClear();
};

module.exports = { client, upload, download, remove, reset, objects };
