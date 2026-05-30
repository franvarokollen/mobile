// GET /api/init?date=YYYY-MM-DD
//
// Single-request startup bundle — replaces 6 individual fetch calls.
// Runs all Supabase queries in parallel inside one serverless function so
// the browser pays one cold-start cost and one network round-trip instead of six.
//
// Returns: { settings, students, extra, flags, daylog, dpa }

const { supabase } = require('./_lib/supabase');
const { requireAuth } = require('./_lib/auth');

const DPA_VERSION = 'v1.0';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const auth = await requireAuth(req, res);
  if (!auth) return;

  const { schoolId } = auth;
  const date = req.query.date || new Date().toISOString().slice(0, 10);

  // ── All queries in parallel ───────────────────────────────
  const [settingsR, studentsR, extraR, flagsR, daylogR, usersR, saR, dpaR] = await Promise.all([
    supabase.from('settings')
      .select('data')
      .eq('school_id', schoolId)
      .maybeSingle(),

    supabase.from('students')
      .select('id, data')
      .eq('school_id', schoolId),

    supabase.from('extra')
      .select('student_id, data')
      .eq('school_id', schoolId),

    supabase.from('flags')
      .select('date, data')
      .eq('school_id', schoolId),

    supabase.from('status_logs')
      .select('student_id, status')
      .eq('school_id', schoolId)
      .eq('date', date),

    // User count for this school
    supabase.from('school_users').select('user_id', { count: 'exact', head: true }).eq('school_id', schoolId),

    // Service agreement — errors handled below (table may not exist)
    supabase.from('service_agreements')
      .select('signed_at, signer_name, signer_title')
      .eq('school_id', schoolId)
      .eq('agreement_version', 'v1.0')
      .maybeSingle(),

    // DPA — errors handled in response shaping below (table may not exist)
    supabase.from('dpa_signatures')
      .select('signed_at, signer_name, agreement_version')
      .eq('school_id', schoolId)
      .eq('agreement_version', DPA_VERSION)
      .maybeSingle(),
  ]);

  // ── Shape responses ───────────────────────────────────────
  const extra = {};
  (extraR.data || []).forEach(r => {
    const d = { ...r.data };
    if (d.starred === 'reported') delete d.starred;
    if (Object.keys(d).length > 0) extra[r.student_id] = d;
  });

  const flags = {};
  (flagsR.data || []).forEach(r => { flags[r.date] = r.data; });

  const daylog = {};
  (daylogR.data || []).forEach(r => { daylog[r.student_id] = r.status; });

  const dpa = (!dpaR.error && dpaR.data)
    ? { signed: true, signedAt: dpaR.data.signed_at, signerName: dpaR.data.signer_name, version: dpaR.data.agreement_version }
    : { signed: false };

  const students = {};
  (studentsR.data || []).forEach(r => { students[r.id] = r.data; });

  const sa = (!saR.error && saR.data)
    ? { signed: true, signedAt: saR.data.signed_at, signerName: saR.data.signer_name, signerTitle: saR.data.signer_title }
    : { signed: false };

  return res.json({
    settings:   settingsR.data?.data || {},
    students,
    extra,
    flags,
    daylog,
    dpa,
    sa,
    userCount:  usersR.count || 0,
  });
};
