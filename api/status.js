const { supabase, SCHOOL_ID } = require('./_lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET /api/status?date=YYYY-MM-DD → { studentId: 'out'|'late', ... }
  if (req.method === 'GET') {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date required' });
    const { data, error } = await supabase
      .from('status_logs')
      .select('student_id, status')
      .eq('school_id', SCHOOL_ID)
      .eq('date', date);
    if (error) return res.status(500).json({ error: error.message });
    const result = {};
    (data || []).forEach(r => { result[r.student_id] = r.status; });
    return res.json(result);
  }

  // POST /api/status  body: { date, id, status }
  // status='in' deletes the row (student handed in / no issue)
  if (req.method === 'POST') {
    const { date, id, status } = req.body;
    if (!date || !id || !status) return res.status(400).json({ error: 'date, id, status required' });

    if (status === 'in') {
      const { error } = await supabase
        .from('status_logs')
        .delete()
        .eq('school_id', SCHOOL_ID)
        .eq('date', date)
        .eq('student_id', id);
      if (error) return res.status(500).json({ error: error.message });
    } else {
      const { error } = await supabase
        .from('status_logs')
        .upsert({ school_id: SCHOOL_ID, date, student_id: id, status }, { onConflict: 'school_id,date,student_id' });
      if (error) return res.status(500).json({ error: error.message });
    }

    // Purge logs older than 90 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    await supabase.from('status_logs').delete().eq('school_id', SCHOOL_ID).lt('date', cutoff.toISOString().slice(0, 10));

    return res.json({ ok: true });
  }

  res.status(405).end();
};
