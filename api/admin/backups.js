// Admin backup visibility
// GET  /api/admin/backups                                        → summary per school
// GET  /api/admin/backups?school_id=xxx                         → list for one school
// GET  /api/admin/backups?action=download&school_id=xxx&name=xxx → download
// POST /api/admin/backups?school_id=xxx                          → create backup (admin-initiated)
// DELETE /api/admin/backups?school_id=xxx&name=xxx               → delete

const { supabase } = require('../_lib/supabase');

function checkToken(req, res) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token || token !== process.env.ADMIN_TOKEN) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!checkToken(req, res)) return;

  const { school_id, name, action } = req.query;

  // ── GET overview: map of school_id → { count, latest } ──────
  if (req.method === 'GET' && !school_id && !action) {
    const { data, error } = await supabase
      .from('backups')
      .select('school_id, name, created_at')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const bySchool = {};
    (data || []).forEach(r => {
      if (!bySchool[r.school_id]) {
        bySchool[r.school_id] = { count: 0, latest: r.created_at };
      }
      bySchool[r.school_id].count++;
    });
    return res.json(bySchool);
  }

  // ── GET list for one school ───────────────────────────────────
  if (req.method === 'GET' && school_id && !action) {
    const { data, error } = await supabase
      .from('backups')
      .select('name, created_at, data')
      .eq('school_id', school_id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return res.status(500).json({ error: error.message });
    return res.json((data || []).map(r => ({
      name: r.name,
      time: r.created_at,
      size: JSON.stringify(r.data).length,
      type: (r.name.startsWith('auto-') || r.name.startsWith('daily-')) ? 'auto' : 'manual',
    })));
  }

  // ── GET download ─────────────────────────────────────────────
  if (req.method === 'GET' && action === 'download') {
    if (!school_id || !name) return res.status(400).json({ error: 'school_id and name required' });
    const { data, error } = await supabase
      .from('backups').select('data')
      .eq('school_id', school_id).eq('name', name).single();
    if (error || !data) return res.status(404).json({ error: 'not found' });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="lurkollen-backup-${name}.json"`);
    return res.send(JSON.stringify(data.data, null, 2));
  }

  // ── POST create backup for school ────────────────────────────
  if (req.method === 'POST') {
    if (!school_id) return res.status(400).json({ error: 'school_id required' });
    const snapshot = await buildSnapshot(school_id);
    const bname = `manual-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
    const { error } = await supabase.from('backups')
      .upsert({ school_id, name: bname, data: snapshot }, { onConflict: 'school_id,name' });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, name: bname });
  }

  // ── DELETE ───────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    if (!school_id || !name) return res.status(400).json({ error: 'school_id and name required' });
    const { error } = await supabase.from('backups').delete()
      .eq('school_id', school_id).eq('name', name);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.status(405).end();
};

async function buildSnapshot(sid) {
  const [students, statusLogs, guardians, extra, flags, settingsRow] = await Promise.all([
    supabase.from('students').select('id,data').eq('school_id', sid),
    supabase.from('status_logs').select('date,student_id,status').eq('school_id', sid),
    supabase.from('guardians').select('student_id,data').eq('school_id', sid),
    supabase.from('extra').select('student_id,data').eq('school_id', sid),
    supabase.from('flags').select('date,data').eq('school_id', sid),
    supabase.from('settings').select('data').eq('school_id', sid).maybeSingle(),
  ]);
  const studentsObj = {};
  (students.data || []).forEach(r => { studentsObj[r.id] = r.data; });
  const statusObj = {};
  (statusLogs.data || []).forEach(r => {
    if (!statusObj[r.date]) statusObj[r.date] = {};
    statusObj[r.date][r.student_id] = r.status;
  });
  const guardiansObj = {};
  (guardians.data || []).forEach(r => { guardiansObj[r.student_id] = r.data; });
  const extraObj = {};
  (extra.data || []).forEach(r => { extraObj[r.student_id] = r.data; });
  const flagsObj = {};
  (flags.data || []).forEach(r => { flagsObj[r.date] = r.data; });
  return {
    backedUpAt: new Date().toISOString(),
    students:  studentsObj,
    status:    statusObj,
    guardians: guardiansObj,
    extra:     extraObj,
    flags:     flagsObj,
    settings:  settingsRow.data?.data || null,
  };
}
