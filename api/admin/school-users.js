// GET    /api/admin/school-users?school_id=X   → list all users in school
// POST   /api/admin/school-users               → add user { school_id, email, role }
// PATCH  /api/admin/school-users               → update role { school_id, user_id, role }
// DELETE /api/admin/school-users?school_id=X&user_id=Y → remove user

const { supabase } = require('../_lib/supabase');

function checkToken(req, res) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token || token !== process.env.ADMIN_TOKEN) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!checkToken(req, res)) return;

  // ── GET: list all users in school ───────────────────────────
  if (req.method === 'GET') {
    const { school_id } = req.query;
    if (!school_id) return res.status(400).json({ error: 'school_id required' });

    const { data: rows, error } = await supabase
      .from('school_users')
      .select('user_id, role, created_at')
      .eq('school_id', school_id)
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    // Fetch auth user details for each user_id
    const users = await Promise.all((rows || []).map(async row => {
      try {
        const { data: { user }, error: authErr } = await supabase.auth.admin.getUserById(row.user_id);
        if (authErr || !user) {
          return { userId: row.user_id, email: row.user_id, name: null, role: row.role, joinedAt: row.created_at };
        }
        const meta = user.user_metadata || {};
        return {
          userId:   user.id,
          email:    user.email,
          name:     meta.full_name || meta.name || null,
          role:     row.role,
          joinedAt: row.created_at,
        };
      } catch {
        return { userId: row.user_id, email: row.user_id, name: null, role: row.role, joinedAt: row.created_at };
      }
    }));

    return res.json(users);
  }

  // ── POST: add user to school ─────────────────────────────────
  if (req.method === 'POST') {
    const { school_id, email, role = 'teacher' } = req.body || {};
    if (!school_id || !email) return res.status(400).json({ error: 'school_id and email required' });

    // Find user by email via listUsers scan
    const { data: { users: allUsers }, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) return res.status(500).json({ error: listErr.message });

    const found = (allUsers || []).find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!found) return res.json({ not_found: true });

    // Insert into school_users (upsert to avoid duplicate error)
    const { error } = await supabase
      .from('school_users')
      .upsert({ school_id, user_id: found.id, role }, { onConflict: 'school_id,user_id' });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, user_id: found.id });
  }

  // ── PATCH: update role ───────────────────────────────────────
  if (req.method === 'PATCH') {
    const { school_id, user_id, role } = req.body || {};
    if (!school_id || !user_id || !role) return res.status(400).json({ error: 'school_id, user_id and role required' });

    const { error } = await supabase
      .from('school_users')
      .update({ role })
      .eq('school_id', school_id)
      .eq('user_id', user_id);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  // ── DELETE: remove user from school ─────────────────────────
  if (req.method === 'DELETE') {
    const { school_id, user_id } = req.query;
    if (!school_id || !user_id) return res.status(400).json({ error: 'school_id and user_id required' });

    const { error } = await supabase
      .from('school_users')
      .delete()
      .eq('school_id', school_id)
      .eq('user_id', user_id);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.status(405).end();
};
