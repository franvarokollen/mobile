// GET    /api/invites          → list invites for school
// POST   /api/invites          → create invite { expiryDays?, email? }
// DELETE /api/invites?id=xxx   → delete invite

const { supabase } = require('./_lib/supabase');
const { requireAuth } = require('./_lib/auth');

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

  const auth = await requireAuth(req, res);
  if (!auth) return;
  if (auth.role !== 'admin') return res.status(403).json({ error: 'admin_required' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('invites')
      .select('id, code, email, used_by, used_at, expires_at, email_sent_at, created_at')
      .eq('school_id', auth.schoolId)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  }

  if (req.method === 'POST') {
    const { expiryDays = 7, email = null } = req.body || {};
    const code = generateCode();
    const expires_at = new Date(Date.now() + expiryDays * 86400000).toISOString();
    const { data, error } = await supabase
      .from('invites')
      .insert({ school_id: auth.schoolId, code, email: email || null, expires_at })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, code: data.code, expiresAt: data.expires_at });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await supabase
      .from('invites')
      .delete()
      .eq('school_id', auth.schoolId)
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.status(405).end();
};
