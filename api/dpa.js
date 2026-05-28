// DPA (PUB-avtal) signing
// GET  /api/dpa  → { signed, signedAt, signerName, version }
// POST /api/dpa  → sign the agreement (admin only)

const { supabase } = require('./_lib/supabase');
const { requireAuth } = require('./_lib/auth');

const CURRENT_VERSION = 'v1.0';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const auth = await requireAuth(req, res);
  if (!auth) return;

  // ── GET — check signature status for this school ─────────────
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('dpa_signatures')
      .select('signed_at, signer_name, agreement_version')
      .eq('school_id', auth.schoolId)
      .eq('agreement_version', CURRENT_VERSION)
      .maybeSingle();
    if (error) return res.json({ signed: false }); // table may not exist yet
    return res.json({
      signed:      !!data,
      signedAt:    data?.signed_at    || null,
      signerName:  data?.signer_name  || null,
      version:     data?.agreement_version || null,
    });
  }

  // ── POST — record signature ───────────────────────────────────
  if (req.method === 'POST') {
    if (auth.role !== 'admin') return res.status(403).json({ error: 'only admins can sign' });

    const { signerName } = req.body || {};
    if (!signerName?.trim()) return res.status(400).json({ error: 'signer_name required' });

    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
               || req.socket?.remoteAddress
               || null;
    const ua = req.headers['user-agent'] || null;

    const { error } = await supabase.from('dpa_signatures').upsert({
      school_id:         auth.schoolId,
      user_id:           auth.user.id,
      signer_name:       signerName.trim(),
      signed_at:         new Date().toISOString(),
      agreement_version: CURRENT_VERSION,
      ip_address:        ip,
      user_agent:        ua,
    }, { onConflict: 'school_id,agreement_version' });

    if (error) return res.status(500).json({ error: error.message });

    // Auto-tick gdpr_signed in school meta so admin checklist updates
    const { data: schoolRow } = await supabase
      .from('schools').select('meta').eq('id', auth.schoolId).single();
    const meta = schoolRow?.meta || {};
    await supabase.from('schools')
      .update({ meta: { ...meta, gdpr_signed: true } })
      .eq('id', auth.schoolId);

    return res.json({ ok: true });
  }

  res.status(405).end();
};
