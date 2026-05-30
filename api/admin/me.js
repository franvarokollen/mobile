// GET /api/admin/me
// Verifies the caller's Supabase JWT and checks they are in super_admins.
// If authorized, returns { ok: true, email, name, token: ADMIN_TOKEN }
// The token is used for all subsequent admin API calls.

const { supabase } = require('../_lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const jwt = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!jwt) return res.status(401).json({ error: 'No token' });

  // Verify the JWT via Supabase
  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

  const email = user.email?.toLowerCase();
  if (!email) return res.status(401).json({ error: 'No email on token' });

  // Check super_admins whitelist
  const { data: row } = await supabase
    .from('super_admins')
    .select('email, name')
    .eq('email', email)
    .maybeSingle();

  if (!row) {
    return res.status(403).json({ error: 'Not authorized as super admin' });
  }

  return res.json({
    ok:    true,
    email: row.email,
    name:  row.name || email,
    token: process.env.ADMIN_TOKEN,
  });
};
