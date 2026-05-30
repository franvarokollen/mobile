// GET  /api/admin/billing?year=YYYY&month=M  → list records for period
// POST /api/admin/billing                    → generate/snapshot period for all active schools
// PATCH /api/admin/billing                   → update a single record (status, fees, notes)

const { supabase } = require('../_lib/supabase');

function checkToken(req, res) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token || token !== process.env.ADMIN_TOKEN) {
    res.status(401).json({ error: 'unauthorized' }); return false;
  }
  return true;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!checkToken(req, res)) return;

  // ── GET: list billing records for a month/year ───────────────
  if (req.method === 'GET') {
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);

    const { data: records, error } = await supabase
      .from('billing_records')
      .select('*')
      .eq('year', year)
      .eq('month', month)
      .order('school_id');
    if (error) return res.status(500).json({ error: error.message });

    // Join with school names
    const { data: schools } = await supabase
      .from('schools')
      .select('id, name, slug, meta');

    const schoolMap = {};
    (schools || []).forEach(s => { schoolMap[s.id] = s; });

    const result = (records || []).map(r => ({
      ...r,
      school_name: schoolMap[r.school_id]?.meta?.display_name
                || schoolMap[r.school_id]?.name
                || r.school_id,
      school_slug: schoolMap[r.school_id]?.slug,
      total: parseFloat(r.fee_setup||0) + parseFloat(r.fee_additional_onetime||0)
           + parseFloat(r.fee_monthly||0)
           + parseFloat(r.fee_per_student||0) * (r.student_count||0)
           + parseFloat(r.fee_support||0) + parseFloat(r.fee_additional||0),
    }));

    return res.json(result);
  }

  // ── POST: generate billing records for a period ───────────────
  if (req.method === 'POST') {
    const { year, month } = req.body || {};
    if (!year || !month) return res.status(400).json({ error: 'year and month required' });

    // Get all active schools (not churned/suspended)
    const { data: schools } = await supabase
      .from('schools')
      .select('id, name, meta');

    const activeSchools = (schools || []).filter(s =>
      !['churned','suspended'].includes(s.meta?.status)
    );

    const results = { created: 0, skipped: 0 };

    for (const school of activeSchools) {
      const meta = school.meta || {};

      // Count active students
      const { data: students } = await supabase
        .from('students')
        .select('id, data')
        .eq('school_id', school.id);
      const studentCount = (students || []).filter(s => s.data?.active !== false).length;

      // Upsert — skip if record already exists (don't overwrite paid records)
      const { data: existing } = await supabase
        .from('billing_records')
        .select('id, status')
        .eq('school_id', school.id)
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();

      if (existing) { results.skipped++; continue; }

      const { error } = await supabase.from('billing_records').insert({
        school_id:              school.id,
        year,
        month,
        student_count:          studentCount,
        fee_setup:              0, // always 0 at generation — admin adds manually
        fee_additional_onetime: 0, // always 0 at generation — admin adds manually
        fee_monthly:            parseFloat(meta.fee_monthly)     || 0,
        fee_per_student:        parseFloat(meta.fee_per_student) || 0,
        fee_support:            parseFloat(meta.fee_support)     || 0,
        fee_additional:         parseFloat(meta.fee_additional)  || 0,
        status:                 'draft',
      });

      if (!error) results.created++;
    }

    return res.json({ ok: true, ...results });
  }

  // ── PATCH: update a billing record ───────────────────────────
  if (req.method === 'PATCH') {
    const { id, ...patch } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });

    // Map allowed fields
    const allowed = ['fee_setup','fee_additional_onetime','fee_monthly','fee_per_student',
                     'fee_support','fee_additional','student_count','notes','status','sent_at','paid_at'];
    const update = {};
    allowed.forEach(k => { if (patch[k] !== undefined) update[k] = patch[k]; });

    // Auto-set timestamps on status change
    if (patch.status === 'sent'  && !update.sent_at)  update.sent_at  = new Date().toISOString();
    if (patch.status === 'paid'  && !update.paid_at)  update.paid_at  = new Date().toISOString();
    if (patch.status === 'draft') { update.sent_at = null; update.paid_at = null; }

    const { error } = await supabase.from('billing_records').update(update).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.status(405).end();
};
