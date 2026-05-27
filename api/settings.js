const { supabase, SCHOOL_ID } = require('./_lib/supabase');
const { requireAuth } = require('./_lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const user = await requireAuth(req, res); if (!user) return;

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('settings')
      .select('data')
      .eq('school_id', SCHOOL_ID)
      .single();
    if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
    return res.status(200).json(data ? data.data : {});
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { error } = await supabase
      .from('settings')
      .upsert({ school_id: SCHOOL_ID, data: body }, { onConflict: 'school_id' });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
};
