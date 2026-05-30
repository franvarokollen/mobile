// GET  /api/admin/schools  → list all schools with live stats
// POST /api/admin/schools  → create a new school

const { supabase } = require('../_lib/supabase');

function checkToken(req, res) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token || token !== process.env.ADMIN_TOKEN) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!checkToken(req, res)) return;

  // ── GET: list all schools with stats ────────────────────────
  if (req.method === 'GET') {
    const { data: schools, error } = await supabase
      .from('schools')
      .select('id, name, slug, meta, created_at')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const results = await Promise.all((schools || []).map(async school => {
      // Active student count
      const { data: studs } = await supabase
        .from('students')
        .select('data')
        .eq('school_id', school.id);
      const activeStudents = (studs || []).filter(s => s.data?.active !== false).length;

      // Most recent log date
      const { data: lastLog } = await supabase
        .from('status_logs')
        .select('date')
        .eq('school_id', school.id)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

      // School settings
      const { data: settingsRow } = await supabase
        .from('settings')
        .select('data')
        .eq('school_id', school.id)
        .maybeSingle();

      // User counts
      const { data: usersData } = await supabase
        .from('school_users')
        .select('role')
        .eq('school_id', school.id);
      const userCount  = (usersData || []).length;
      const adminCount = (usersData || []).filter(u => u.role === 'admin').length;

      // Service agreement signed
      let saSigned = false, saSignedAt = null, saSignerName = null, saSignerTitle = null;
      try {
        const { data: saRow } = await supabase
          .from('service_agreements').select('signed_at, signer_name, signer_title')
          .eq('school_id', school.id).eq('agreement_version', 'v1.0').maybeSingle();
        if (saRow) { saSigned = true; saSignedAt = saRow.signed_at; saSignerName = saRow.signer_name; saSignerTitle = saRow.signer_title; }
      } catch(e) {}

      // DPA signed
      let dpaSigned = false, dpaSignedAt = null, dpaSignerName = null;
      try {
        const { data: dpaRow } = await supabase
          .from('dpa_signatures').select('signed_at, signer_name')
          .eq('school_id', school.id).eq('agreement_version', 'v1.0').maybeSingle();
        if (dpaRow) { dpaSigned = true; dpaSignedAt = dpaRow.signed_at; dpaSignerName = dpaRow.signer_name; }
      } catch(e) {}

      // Latest backup
      const { data: backupRow } = await supabase
        .from('backups').select('created_at')
        .eq('school_id', school.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();

      // Pending (un-redeemed) invites
      const { data: pendingInvites } = await supabase
        .from('invites').select('code, email')
        .eq('school_id', school.id).is('used_by', null)
        .gt('expires_at', new Date().toISOString());

      return {
        school_id:      school.id,
        name:           school.name,
        slug:           school.slug,
        meta:           school.meta   || {},
        settings:       settingsRow?.data || {},
        activeStudents,
        lastActive:     lastLog?.date   || null,
        userCount,
        adminCount,
        saSigned, saSignedAt, saSignerName, saSignerTitle,
        dpaSigned, dpaSignedAt, dpaSignerName,
        lastBackup:     backupRow?.created_at || null,
        pendingInvites: (pendingInvites || []).length,
        createdAt:      school.created_at,
      };
    }));

    return res.json(results);
  }

  // ── POST: create a new school ────────────────────────────────
  if (req.method === 'POST') {
    const { name, slug, ...metaFields } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });

    const cleanSlug = (slug || name)
      .toLowerCase()
      .replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 60) || 'school';

    const meta = { status: 'trial', ...metaFields };

    const { data, error } = await supabase
      .from('schools')
      .insert({ name, slug: cleanSlug, meta })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, school_id: data.id, slug: data.slug });
  }

  // ── PATCH: update school name and/or slug ────────────────────
  if (req.method === 'PATCH') {
    const { school_id, name, slug } = req.body || {};
    if (!school_id) return res.status(400).json({ error: 'school_id required' });

    const patch = {};
    if (name !== undefined) patch.name = name;
    if (slug !== undefined) patch.slug = slug;
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing to update' });

    const { error } = await supabase
      .from('schools')
      .update(patch)
      .eq('id', school_id);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  // ── DELETE: delete school and all related data ───────────────
  if (req.method === 'DELETE') {
    const { school_id } = req.query;
    if (!school_id) return res.status(400).json({ error: 'school_id required' });

    const tables = ['students', 'status_logs', 'extra', 'guardians', 'flags', 'settings', 'backups', 'school_users', 'invites'];
    for (const table of tables) {
      const { error } = await supabase.from(table).delete().eq('school_id', school_id);
      if (error) return res.status(500).json({ error: `Failed deleting from ${table}: ${error.message}` });
    }

    const { error } = await supabase.from('schools').delete().eq('id', school_id);
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ ok: true });
  }

  res.status(405).end();
};
