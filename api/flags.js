const { supabase } = require('./_lib/supabase');
const { requireAuth } = require('./_lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const auth = await requireAuth(req, res); if (!auth) return;

  // GET /api/flags → { "YYYY-MM-DD": { ... flags ... }, ... }
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('flags')
      .select('date, data')
      .eq('school_id', auth.schoolId);
    if (error) return res.status(500).json({ error: error.message });
    const result = {};
    (data || []).forEach(r => { result[r.date] = r.data; });
    return res.json(result);
  }

  // POST /api/flags  body: { date, flags }
  if (req.method === 'POST') {
    const { date, flags } = req.body;
    if (!date || !flags) return res.status(400).json({ error: 'date and flags required' });
    const { error } = await supabase
      .from('flags')
      .upsert({ school_id: auth.schoolId, date, data: flags }, { onConflict: 'school_id,date' });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  // DELETE /api/flags?date=YYYY-MM-DD
  if (req.method === 'DELETE') {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date required' });
    const { error } = await supabase
      .from('flags')
      .delete()
      .eq('school_id', auth.schoolId)
      .eq('date', date);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.status(405).end();
};
