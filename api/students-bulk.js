const { supabase } = require('./_lib/supabase');
const { requireAuth } = require('./_lib/auth');

// POST /api/students-bulk  body: { id: studentObj, ... }
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const auth = await requireAuth(req, res); if (!auth) return;
  if (req.method !== 'POST') return res.status(405).end();

  const incoming = req.body;
  if (!incoming || typeof incoming !== 'object') return res.status(400).json({ error: 'object required' });

  const rows = Object.entries(incoming).map(([id, s]) => ({
    school_id: auth.schoolId, id, data: s,
  }));

  const { data: existing, error: fetchErr } = await supabase
    .from('students')
    .select('id')
    .eq('school_id', auth.schoolId)
    .in('id', Object.keys(incoming));
  if (fetchErr) return res.status(500).json({ error: fetchErr.message });

  const existingIds = new Set((existing || []).map(r => r.id));
  let added = 0, updated = 0;
  rows.forEach(r => { if (existingIds.has(r.id)) updated++; else added++; });

  const { error } = await supabase
    .from('students')
    .upsert(rows, { onConflict: 'school_id,id' });
  if (error) return res.status(500).json({ error: error.message });

  return res.json({ ok: true, added, updated });
};
