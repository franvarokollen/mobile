// Backup API — replaces api/backup.js (which used the singular /api/backup route)
// Handles: list, manual create, restore, download, delete
// URL pattern: /api/backups  +  ?action=manual|restore|download|delete  &name=xxx

const { supabase } = require('./_lib/supabase');
const { requireAuth } = require('./_lib/auth');

const MAX_BACKUPS = 30; // per school

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const action = req.query.action;

  // ── GET /api/backups → list backups ──────────────────────────
  if (req.method === 'GET' && !action) {
    const { data, error } = await supabase
      .from('backups')
      .select('name, created_at, data')
      .eq('school_id', auth.schoolId)
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

  // ── GET /api/backups?action=download&name=xxx → file download ─
  if (req.method === 'GET' && action === 'download') {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'name required' });
    const { data, error } = await supabase
      .from('backups').select('data')
      .eq('school_id', auth.schoolId).eq('name', name).single();
    if (error || !data) return res.status(404).json({ error: 'not found' });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="lurkollen-backup-${name}.json"`);
    return res.send(JSON.stringify(data.data, null, 2));
  }

  // ── POST /api/backups?action=manual → create manual backup ───
  if (req.method === 'POST' && (!action || action === 'manual')) {
    const snapshot = await buildSnapshot(auth.schoolId);
    const name = `manual-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
    const { error } = await supabase.from('backups')
      .upsert({ school_id: auth.schoolId, name, data: snapshot }, { onConflict: 'school_id,name' });
    if (error) return res.status(500).json({ error: error.message });
    await trimBackups(auth.schoolId);
    return res.json({ ok: true, name });
  }

  // ── POST /api/backups?action=restore&name=xxx → restore ──────
  if (req.method === 'POST' && action === 'restore') {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'name required' });
    const { data, error } = await supabase.from('backups').select('data')
      .eq('school_id', auth.schoolId).eq('name', name).single();
    if (error || !data) return res.status(404).json({ error: 'not found' });
    await restoreSnapshot(data.data, auth.schoolId);
    return res.json({ ok: true, restoredFrom: name });
  }

  // ── DELETE /api/backups?name=xxx → delete one backup ─────────
  if (req.method === 'DELETE') {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'name required' });
    const { error } = await supabase.from('backups').delete()
      .eq('school_id', auth.schoolId).eq('name', name);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.status(405).end();
};

// ── Helpers ───────────────────────────────────────────────────

async function trimBackups(schoolId) {
  const { data } = await supabase.from('backups').select('name')
    .eq('school_id', schoolId).order('created_at', { ascending: false });
  if (!data || data.length <= MAX_BACKUPS) return;
  const toDelete = data.slice(MAX_BACKUPS).map(r => r.name);
  await supabase.from('backups').delete().eq('school_id', schoolId).in('name', toDelete);
}

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

async function restoreSnapshot(snap, sid) {
  if (snap.students) {
    await supabase.from('students').delete().eq('school_id', sid);
    const rows = Object.entries(snap.students).map(([id, data]) => ({ school_id: sid, id, data }));
    if (rows.length) await supabase.from('students').insert(rows);
  }
  if (snap.status) {
    await supabase.from('status_logs').delete().eq('school_id', sid);
    const rows = [];
    Object.entries(snap.status).forEach(([date, day]) => {
      Object.entries(day).forEach(([student_id, status]) =>
        rows.push({ school_id: sid, date, student_id, status }));
    });
    if (rows.length) await supabase.from('status_logs').insert(rows);
  }
  if (snap.guardians) {
    await supabase.from('guardians').delete().eq('school_id', sid);
    const rows = Object.entries(snap.guardians)
      .map(([student_id, data]) => ({ school_id: sid, student_id, data }));
    if (rows.length) await supabase.from('guardians').insert(rows);
  }
  // ── Previously missing: extra, flags, settings ───────────────
  if (snap.extra) {
    await supabase.from('extra').delete().eq('school_id', sid);
    const rows = Object.entries(snap.extra)
      .map(([student_id, data]) => ({ school_id: sid, student_id, data }));
    if (rows.length) await supabase.from('extra').insert(rows);
  }
  if (snap.flags) {
    await supabase.from('flags').delete().eq('school_id', sid);
    const rows = Object.entries(snap.flags).map(([date, data]) => ({ school_id: sid, date, data }));
    if (rows.length) await supabase.from('flags').insert(rows);
  }
  if (snap.settings) {
    await supabase.from('settings')
      .upsert({ school_id: sid, data: snap.settings }, { onConflict: 'school_id' });
  }
}
