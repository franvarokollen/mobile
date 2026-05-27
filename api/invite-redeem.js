// POST /api/invite-redeem  body: { code }
// Validates an invite code and adds the user to the school.

const { supabase } = require('./_lib/supabase');
const { requireAuthBasic } = require('./_lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const user = await requireAuthBasic(req, res);
  if (!user) return;

  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'code required' });

  // Find the invite
  const { data: invite, error: invErr } = await supabase
    .from('invites')
    .select('id, school_id, email, used_by, expires_at')
    .eq('code', code.trim().toUpperCase())
    .single();

  if (invErr || !invite) return res.status(404).json({ error: 'invalid_code' });
  if (invite.used_by)    return res.status(409).json({ error: 'code_already_used' });
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return res.status(410).json({ error: 'code_expired' });
  }
  if (invite.email && invite.email.toLowerCase() !== (user.email || '').toLowerCase()) {
    return res.status(403).json({ error: 'code_not_for_this_email' });
  }

  // Check not already in school
  const { data: existing } = await supabase
    .from('school_users')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (existing) return res.status(409).json({ error: 'already_in_school' });

  // Add to school
  const { error: insertErr } = await supabase
    .from('school_users')
    .insert({ school_id: invite.school_id, user_id: user.id, role: 'teacher' });
  if (insertErr) return res.status(500).json({ error: insertErr.message });

  // Mark invite as used
  await supabase
    .from('invites')
    .update({ used_by: user.id, used_at: new Date().toISOString() })
    .eq('id', invite.id);

  return res.json({ ok: true });
};
