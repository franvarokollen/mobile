const { supabase } = require('../_lib/supabase');

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const [studentsRes, settingsRes, logsRes, metaRes] = await Promise.all([
      supabase.from('students').select('school_id, id, data'),
      supabase.from('settings').select('school_id, data'),
      supabase.from('status_logs').select('school_id, date').order('date', { ascending: false }),
      supabase.from('admin_school_meta').select('*'),
    ]);

    const map = {};

    const ensure = id => {
      if (!map[id]) map[id] = { school_id: id, activeStudents: 0, totalStudents: 0, settings: {}, lastActive: null, meta: null };
    };

    (studentsRes.data || []).forEach(row => {
      ensure(row.school_id);
      map[row.school_id].totalStudents++;
      if (row.data?.active !== false) map[row.school_id].activeStudents++;
    });

    (settingsRes.data || []).forEach(row => {
      ensure(row.school_id);
      map[row.school_id].settings = row.data || {};
    });

    const seenLog = new Set();
    (logsRes.data || []).forEach(row => {
      if (!seenLog.has(row.school_id)) {
        seenLog.add(row.school_id);
        ensure(row.school_id);
        map[row.school_id].lastActive = row.date;
      }
    });

    (metaRes.data || []).forEach(row => {
      ensure(row.school_id);
      map[row.school_id].meta = row;
    });

    const schools = Object.values(map).sort((a, b) => {
      const na = a.meta?.display_name || a.settings?.schoolName || a.school_id;
      const nb = b.meta?.display_name || b.settings?.schoolName || b.school_id;
      return na.localeCompare(nb, 'sv');
    });

    return res.status(200).json(schools);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
