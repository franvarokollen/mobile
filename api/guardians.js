const { supabase, SCHOOL_ID } = require('./_lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET /api/guardians → { studentId: guardianObj, ... }
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('guardians')
      .select('student_id, data')
      .eq('school_id', SCHOOL_ID);
    if (error) return res.status(500).json({ error: error.message });
    const result = {};
    (data || []).forEach(r => { result[r.student_id] = r.data; });
    return res.json(result);
  }

  // POST /api/guardians  body: { studentId: guardianObj, ... }  (full replace)
  if (req.method === 'POST') {
    const incoming = req.body;
    if (!incoming || typeof incoming !== 'object') return res.status(400).json({ error: 'object required' });
    const rows = Object.entries(incoming).map(([student_id, data]) => ({
      school_id: SCHOOL_ID, student_id, data,
    }));
    // Delete existing then insert (full replace semantics matching original)
    await supabase.from('guardians').delete().eq('school_id', SCHOOL_ID);
    if (rows.length) {
      const { error } = await supabase.from('guardians').insert(rows);
      if (error) return res.status(500).json({ error: error.message });
    }
    return res.json({ ok: true, count: rows.length });
  }

  res.status(405).end();
};
