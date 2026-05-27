// GET    /api/admin/school-domains?school_id=X  → list domains for school
// POST   /api/admin/school-domains              → add { school_id, domain }
// DELETE /api/admin/school-domains?id=X         → remove domain

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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!checkToken(req, res)) return;

  // ── GET: list domains for school ─────────────────────────────
  if (req.method === 'GET') {
    const { school_id } = req.query;
    if (!school_id) return res.status(400).json({ error: 'school_id required' });

    const { data, error } = await supabase
      .from('school_domains')
      .select('id, domain, created_at')
      .eq('school_id', school_id)
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  }

  // ── POST: add domain ─────────────────────────────────────────
  if (req.method === 'POST') {
    const { school_id, domain } = req.body || {};
    if (!school_id || !domain) return res.status(400).json({ error: 'school_id and domain required' });

    const clean = domain.toLowerCase().replace(/^@/, '').trim();
    if (!clean || !clean.includes('.')) return res.status(400).json({ error: 'invalid domain' });

    const { data, error } = await supabase
      .from('school_domains')
      .insert({ school_id, domain: clean })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'domain_already_registered' });
      return res.status(500).json({ error: error.message });
    }
    return res.json({ ok: true, id: data.id, domain: data.domain });
  }

  // ── DELETE: remove domain ────────────────────────────────────
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });

    const { error } = await supabase
      .from('school_domains')
      .delete()
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.status(405).end();
};
