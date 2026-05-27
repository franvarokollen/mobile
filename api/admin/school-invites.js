// GET    /api/admin/school-invites?school_id=X → list invites for school
// POST   /api/admin/school-invites             → create invite { school_id, email?, expiryDays? }
// DELETE /api/admin/school-invites?id=X        → delete invite

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

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!checkToken(req, res)) return;

  // ── GET: list invites for school ─────────────────────────────
  if (req.method === 'GET') {
    const { school_id } = req.query;
    if (!school_id) return res.status(400).json({ error: 'school_id required' });

    const { data, error } = await supabase
      .from('invites')
      .select('id, code, email, used_by, used_at, expires_at, created_at')
      .eq('school_id', school_id)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  }

  // ── POST: create invite ──────────────────────────────────────
  if (req.method === 'POST') {
    const { school_id, email = null, expiryDays = 7 } = req.body || {};
    if (!school_id) return res.status(400).json({ error: 'school_id required' });

    const code = generateCode();
    const expires_at = new Date(Date.now() + expiryDays * 86400000).toISOString();

    const { data, error } = await supabase
      .from('invites')
      .insert({ school_id, code, email: email || null, expires_at })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, code: data.code, expiresAt: data.expires_at });
  }

  // ── DELETE: remove invite ────────────────────────────────────
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });

    const { error } = await supabase
      .from('invites')
      .delete()
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.status(405).end();
};
