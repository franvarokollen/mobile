const { createClient } = require('@supabase/supabase-js');

// Uses the SERVICE ROLE key — never exposed to the browser
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// School identifier — set per-deployment in env vars.
// When SSO is added this will come from the authenticated user's JWT instead.
const SCHOOL_ID = process.env.SCHOOL_ID || 'default';

module.exports = { supabase, SCHOOL_ID };
