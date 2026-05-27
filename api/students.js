const { supabase, SCHOOL_ID } = require('./_lib/supabase');
const { requireAuth } = require('./_lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const user = await requireAuth(req, res); if (!user) return;

  // GET /api/students → { id: studentObj, ... }
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('students')
      .select('id, data')
      .eq('school_id', SCHOOL_ID);
    if (error) return res.status(500).json({ error: error.message });
    const result = {};
    (data || []).forEach(row => { result[row.id] = row.data; });
    return res.json(result);
  }

  // POST /api/students  body: studentObj (must have .id)
  if (req.method === 'POST') {
    const s = req.body;
    if (!s || !s.id) return res.status(400).json({ error: 'id required' });
    const { error } = await supabase
      .from('students')
      .upsert({ school_id: SCHOOL_ID, id: s.id, data: s }, { onConflict: 'school_id,id' });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  // DELETE /api/students?id=xxx
  if (req.method === 'DELETE') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('school_id', SCHOOL_ID)
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.status(405).end();
};
