const { supabase, SCHOOL_ID } = require('./_lib/supabase');
const { requireAuth } = require('./_lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const user = await requireAuth(req, res); if (!user) return;

  // GET /api/extra → { studentId: { starred, athome, keepphone, slot, ... }, ... }
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('extra')
      .select('student_id, data')
      .eq('school_id', SCHOOL_ID);
    if (error) return res.status(500).json({ error: error.message });
    const result = {};
    (data || []).forEach(r => {
      // Clear stale 'reported' starred flag (matches original server behaviour)
      const d = { ...r.data };
      if (d.starred === 'reported') delete d.starred;
      if (Object.keys(d).length > 0) result[r.student_id] = d;
    });
    return res.json(result);
  }

  // POST /api/extra  body: { id, ...patch }
  if (req.method === 'POST') {
    const { id, ...patch } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });

    // Fetch current
    const { data: existing } = await supabase
      .from('extra')
      .select('data')
      .eq('school_id', SCHOOL_ID)
      .eq('student_id', id)
      .single();

    let merged = { ...(existing?.data || {}), ...patch };
    if (merged.starred === 'reported') delete merged.starred;
    Object.keys(merged).forEach(k => { if (!merged[k]) delete merged[k]; });

    if (Object.keys(merged).length === 0) {
      await supabase.from('extra').delete().eq('school_id', SCHOOL_ID).eq('student_id', id);
    } else {
      await supabase.from('extra').upsert({ school_id: SCHOOL_ID, student_id: id, data: merged }, { onConflict: 'school_id,student_id' });
    }
    return res.json({ ok: true });
  }

  res.status(405).end();
};
