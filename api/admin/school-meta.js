// POST /api/admin/school-meta  body: { school_id, ...meta_fields }
// Merges meta_fields into the schools.meta JSONB column.

const { supabase } = require('../_lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { school_id, ...patch } = req.body || {};
  if (!school_id) return res.status(400).json({ error: 'school_id required' });

  // Read existing meta and merge
  const { data: existing, error: fetchErr } = await supabase
    .from('schools')
    .select('meta')
    .eq('id', school_id)
    .single();

  if (fetchErr) return res.status(404).json({ error: 'school not found' });

  const newMeta = { ...(existing.meta || {}), ...patch };

  const { error } = await supabase
    .from('schools')
    .update({ meta: newMeta })
    .eq('id', school_id);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
};
