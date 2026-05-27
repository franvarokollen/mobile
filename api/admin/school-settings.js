const { supabase } = require('../_lib/supabase');

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { school_id, settings } = body || {};

  if (!school_id || typeof settings !== 'object') {
    return res.status(400).json({ error: 'school_id and settings required' });
  }

  const { error } = await supabase
    .from('settings')
    .upsert({ school_id, data: settings }, { onConflict: 'school_id' });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
};
