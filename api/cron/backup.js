// Daily backup cron job — called by Vercel Cron at 02:00 UTC
// Vercel automatically sends Authorization: Bearer ${CRON_SECRET} with cron requests
// Configure CRON_SECRET in Vercel → Project → Settings → Environment Variables

const { supabase } = require('../_lib/supabase');

const MAX_BACKUPS = 30;

module.exports = async (req, res) => {
  // Vercel cron protection
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  if (req.method !== 'GET') return res.status(405).end();

  // Fetch all school IDs
  const { data: schools, error: schoolsErr } = await supabase
    .from('schools').select('id');
  if (schoolsErr) return res.status(500).json({ error: schoolsErr.message });

  const results = { ok: [], failed: [] };

  for (const school of (schools || [])) {
    try {
      const snapshot = await buildSnapshot(school.id);
      const name = `auto-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
      const { error } = await supabase.from('backups')
        .upsert({ school_id: school.id, name, data: snapshot }, { onConflict: 'school_id,name' });
      if (error) throw error;
      await trimBackups(school.id);
      results.ok.push(school.id);
    } catch (e) {
      results.failed.push({ id: school.id, error: e.message });
    }
  }

  console.log(`[cron/backup] ${results.ok.length} ok, ${results.failed.length} failed`);
  return res.json(results);
};

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
    students:   studentsObj,
    status:     statusObj,
    guardians:  guardiansObj,
    extra:      extraObj,
    flags:      flagsObj,
    settings:   settingsRow.data?.data || null,
  };
}
