const { supabase, SCHOOL_ID } = require('./_lib/supabase');
const { requireAuth } = require('./_lib/auth');

// GET /api/logs → { "YYYY-MM-DD": { studentId: status, ... }, ... }
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const user = await requireAuth(req, res); if (!user) return;
  if (req.method !== 'GET') return res.status(405).end();

  const { data, error } = await supabase
    .from('status_logs')
    .select('date, student_id, status')
    .eq('school_id', SCHOOL_ID);
  if (error) return res.status(500).json({ error: error.message });

  const result = {};
  (data || []).forEach(r => {
    const dk = r.date;
    if (!result[dk]) result[dk] = {};
    result[dk][r.student_id] = r.status;
  });
  return res.json(result);
};
