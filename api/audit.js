// GET /api/audit  — returns recent audit log entries (admin only)
// Query params: ?date=YYYY-MM-DD  &q=searchterm  &limit=200
//
// DELETE /api/audit?purge=1  — purge entries older than auditRetainDays setting

const { supabase } = require('./_lib/supabase');
const { requireAuth } = require('./_lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireAuth(req, res);
  if (!auth) return;
  if (auth.role !== 'admin') return res.status(403).json({ error: 'admin_only' });

  // ── GET — list log entries ─────────────────────────────────
  if (req.method === 'GET') {
    const { date, q } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);

    let query = supabase
      .from('audit_logs')
      .select('id, date, student_id, old_status, new_status, changed_by, changed_at')
      .eq('school_id', auth.schoolId)
      .order('changed_at', { ascending: false })
      .limit(limit);

    if (date) query = query.eq('date', date);
    if (q)    query = query.or(`student_id.ilike.%${q}%,changed_by.ilike.%${q}%`);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  }

  // ── DELETE ?purge=1 — purge old entries per school setting ──
  if (req.method === 'DELETE' && req.query.purge) {
    const { data: settingsRow } = await supabase
      .from('settings').select('data')
      .eq('school_id', auth.schoolId).maybeSingle();
    const retainDays = settingsRow?.data?.auditRetainDays ?? 2;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retainDays);
    const { error } = await supabase
      .from('audit_logs').delete()
      .eq('school_id', auth.schoolId)
      .lt('changed_at', cutoff.toISOString());
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, purgedBefore: cutoff.toISOString() });
  }

  res.status(405).end();
};
