const { createClient } = require('@supabase/supabase-js');

// Uses the SERVICE ROLE key — never exposed to the browser
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = { supabase };
