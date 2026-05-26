const { supabase, SCHOOL_ID } = require('./_lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET /api/flags → { "YYYY-MM-DD": { ... flags ... }, ... }
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('flags')
      .select('date, data')
      .eq('school_id', SCHOOL_ID);
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
      .upsert({ school_id: SCHOOL_ID, date, data: flags }, { onConflict: 'school_id,date' });
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
      .eq('school_id', SCHOOL_ID)
      .eq('date', date);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.status(405).end();
};
