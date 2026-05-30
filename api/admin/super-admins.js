// GET    /api/admin/super-admins      → list all super admins
// POST   /api/admin/super-admins      → add a super admin  { email, name }
// DELETE /api/admin/super-admins?email=x → remove a super admin

const { supabase } = require('../_lib/supabase');

function checkToken(req, res) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token || token !== process.env.ADMIN_TOKEN) {
    res.status(401).json({ error: 'unauthorized' }); return false;
  }
  return true;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!checkToken(req, res)) return;

  // ── GET: list all super admins ────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('super_admins')
      .select('id, email, name, created_at, created_by')
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  }

  // ── POST: add a super admin ───────────────────────────────────
  if (req.method === 'POST') {
    const { email, name, created_by } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });

    const clean = email.toLowerCase().trim();
    const { error } = await supabase
      .from('super_admins')
      .insert({ email: clean, name: name || null, created_by: created_by || null });
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Already exists' });
      return res.status(500).json({ error: error.message });
    }
    return res.json({ ok: true });
  }

  // ── DELETE: remove a super admin ─────────────────────────────
  if (req.method === 'DELETE') {
    const email = (req.query.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'email required' });

    const { error } = await supabase
      .from('super_admins')
      .delete()
      .eq('email', email);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.status(405).end();
};
