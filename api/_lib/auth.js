// ─── API AUTH HELPER ────────────────────────────────────────
// Verifies a Supabase JWT and resolves the user's school_id
// from the school_users table. Returns { user, schoolId } or null.

const { supabase } = require('./supabase');

async function requireAuth(req, res) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) {
    res.status(401).json({ error: 'auth_required' });
    return null;
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: 'invalid_token' });
    return null;
  }

  // Look up which school this user belongs to
  const { data: membership, error: memberErr } = await supabase
    .from('school_users')
    .select('school_id, role')
    .eq('user_id', user.id)
    .single();

  if (memberErr || !membership) {
    res.status(403).json({ error: 'no_school_assigned' });
    return null;
  }

  return { user, schoolId: membership.school_id, role: membership.role };
}

module.exports = { requireAuth };
