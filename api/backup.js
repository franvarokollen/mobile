const { supabase } = require('./_lib/supabase');
const { requireAuth } = require('./_lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const auth = await requireAuth(req, res); if (!auth) return;

  const path = req.query.action;

  // GET /api/backup → list of backups
  if (req.method === 'GET' && !path) {
    const { data, error } = await supabase
      .from('backups')
      .select('name, created_at')
      .eq('school_id', auth.schoolId)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json((data || []).map(r => ({ name: r.name, time: r.created_at })));
  }

  // GET /api/backup?action=get&name=xxx → backup data
  if (req.method === 'GET' && path === 'get') {
    const { name } = req.query;
    const { data, error } = await supabase
      .from('backups')
      .select('data')
      .eq('school_id', auth.schoolId)
      .eq('name', name)
      .single();
    if (error || !data) return res.status(404).json({ error: 'not found' });
    return res.json(data.data);
  }

  // POST /api/backup?action=manual → create manual backup
  if (req.method === 'POST' && path === 'manual') {
    const snapshot = await buildSnapshot(auth.schoolId);
    const name = `manual-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
    const { error } = await supabase
      .from('backups')
      .upsert({ school_id: auth.schoolId, name, data: snapshot }, { onConflict: 'school_id,name' });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, name });
  }

  // POST /api/backup?action=restore&name=xxx → restore from backup
  if (req.method === 'POST' && path === 'restore') {
    const { name } = req.query;
    const { data, error } = await supabase
      .from('backups')
      .select('data')
      .eq('school_id', auth.schoolId)
      .eq('name', name)
      .single();
    if (error || !data) return res.status(404).json({ error: 'not found' });
    const snap = data.data;
    await restoreSnapshot(snap, auth.schoolId);
    return res.json({ ok: true, restoredFrom: name });
  }

  res.status(405).end();
};

async function buildSnapshot(sid) {
  const { supabase: sb } = require('./_lib/supabase');
  const [students, statusLogs, guardians, extra, flags] = await Promise.all([
    sb.from('students').select('id,data').eq('school_id', sid),
    sb.from('status_logs').select('date,student_id,status').eq('school_id', sid),
    sb.from('guardians').select('student_id,data').eq('school_id', sid),
    sb.from('extra').select('student_id,data').eq('school_id', sid),
    sb.from('flags').select('date,data').eq('school_id', sid),
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
  return { students: studentsObj, status: statusObj, guardians: guardiansObj, extra: extraObj, flags: flagsObj, backedUpAt: new Date().toISOString() };
}

async function restoreSnapshot(snap, sid) {
  const { supabase: sb } = require('./_lib/supabase');
  if (snap.students) {
    await sb.from('students').delete().eq('school_id', sid);
    const rows = Object.entries(snap.students).map(([id, data]) => ({ school_id: sid, id, data }));
    if (rows.length) await sb.from('students').insert(rows);
  }
  if (snap.status) {
    await sb.from('status_logs').delete().eq('school_id', sid);
    const rows = [];
    Object.entries(snap.status).forEach(([date, day]) => {
      Object.entries(day).forEach(([student_id, status]) => rows.push({ school_id: sid, date, student_id, status }));
    });
    if (rows.length) await sb.from('status_logs').insert(rows);
  }
  if (snap.guardians) {
    await sb.from('guardians').delete().eq('school_id', sid);
    const rows = Object.entries(snap.guardians).map(([student_id, data]) => ({ school_id: sid, student_id, data }));
    if (rows.length) await sb.from('guardians').insert(rows);
  }
}
