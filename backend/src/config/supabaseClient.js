const { createClient } = require('@supabase/supabase-js');

let client;

// Lazily created and memoized, unlike db.js's connectDB (which the whole
// app needs at boot and so connects eagerly) — attachment storage is only
// needed per-request, and this module is required transitively at app
// startup via routes -> controllers -> attachment.service.js, so creating
// the client eagerly here would force SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY
// to be set just to start the server or run unrelated tests. The test suite
// mocks this whole module (jest.mock) and so never actually calls this
// function at all.
const getSupabaseClient = () => {
  if (!client) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to use attachment storage');
    }

    // Service role key: full read/write access to the bucket, bypassing
    // Row Level Security. Used server-side only, never sent to the
    // frontend. The trust boundary is this app's own authorization checks
    // (assertCanAccessAttachments/assertCanDeleteAttachment in
    // attachment.service.js), run before any storage call is ever made —
    // not RLS policies on the bucket, which this key ignores entirely.
    client = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });
  }

  return client;
};

// No hardcoded fallback (e.g. 'memo-attachments') — same reasoning as
// SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY above: a silently-wrong default
// bucket name in production is worse than a clear failure right at the
// point of use. Called lazily by attachment.service.js alongside
// getSupabaseClient(), not read once at module load, for the same
// "don't force this to be set just to start the server" reason.
const getSupabaseBucket = () => {
  const bucket = process.env.SUPABASE_BUCKET;
  if (!bucket) {
    throw new Error('SUPABASE_BUCKET must be set to use attachment storage');
  }
  return bucket;
};

module.exports = { getSupabaseClient, getSupabaseBucket };
