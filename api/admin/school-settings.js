// POST /api/admin/school-settings  body: { school_id, settings }
// Upserts the settings row for a school (same table the main app uses).

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

  const { school_id, settings } = req.body || {};
  if (!school_id || typeof settings !== 'object') {
    return res.status(400).json({ error: 'school_id and settings object required' });
  }

  const { error } = await supabase
    .from('settings')
    .upsert({ school_id, data: settings }, { onConflict: 'school_id' });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
};
