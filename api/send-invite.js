// POST /api/send-invite
// Body: { inviteId }
// School admin sends a welcome email for a specific pending invite using the school's template.

const { supabase } = require('./_lib/supabase');
const { requireAuth } = require('./_lib/auth');

const DEFAULT_SUBJECT = 'Du har bjudits in till {{schoolName}}';
const DEFAULT_BODY = `
<div style="font-family:'DM Sans',Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f5f4f0;border-radius:12px">
  <div style="margin-bottom:24px">
    <span style="font-size:22px;font-weight:700;color:#1a1a18;letter-spacing:-0.02em">Lurkollen</span>
  </div>
  <div style="background:#ffffff;border-radius:10px;padding:28px;border:0.5px solid rgba(0,0,0,0.1)">
    <h2 style="font-size:18px;font-weight:600;color:#1a1a18;margin:0 0 12px">Du har bjudits in till {{schoolName}}</h2>
    <p style="font-size:14px;color:#5a5a56;line-height:1.6;margin:0 0 20px">Du har bjudits in att gå med i <strong>{{schoolName}}</strong> i Lurkollen — ett system för insamling av mobiltelefoner i skolan.</p>
    <a href="{{inviteLink}}" style="display:inline-block;padding:12px 24px;background:#1a1a18;color:#f5f4f0;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-bottom:20px">Gå med nu →</a>
    <p style="font-size:12px;color:#9a9a94;margin:0">Eller ange koden manuellt: <strong style="font-family:monospace;color:#1a1a18;letter-spacing:0.08em">{{code}}</strong></p>
    <p style="font-size:12px;color:#9a9a94;margin:8px 0 0">Länken är giltig till {{expiresAt}}. Vid frågor, kontakta din skoladministratör.</p>
  </div>
  <p style="font-size:11px;color:#9a9a94;text-align:center;margin:16px 0 0">Skickat via Lurkollen · {{schoolName}}</p>
</div>`.trim();

function render(tmpl, vars) {
  return Object.entries(vars).reduce((t, [k, v]) => t.split(`{{${k}}}`).join(v), tmpl);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const auth = await requireAuth(req, res);
  if (!auth) return;
  if (auth.role !== 'admin') return res.status(403).json({ error: 'admin_required' });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'email_not_configured' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { inviteId } = body || {};
  if (!inviteId) return res.status(400).json({ error: 'inviteId required' });

  // Fetch invite — must belong to this school
  const { data: invite, error: invErr } = await supabase
    .from('invites')
    .select('id, code, email, used_by, expires_at')
    .eq('id', inviteId)
    .eq('school_id', auth.schoolId)
    .single();

  if (invErr || !invite) return res.status(404).json({ error: 'invite_not_found' });
  if (!invite.email)    return res.status(400).json({ error: 'invite_has_no_email' });
  if (invite.used_by)   return res.status(400).json({ error: 'already_used' });

  // Fetch school settings
  const { data: settingsRow } = await supabase
    .from('settings').select('data').eq('school_id', auth.schoolId).maybeSingle();
  const s = settingsRow?.data || {};

  const schoolName  = s.schoolName      || 'Lurkollen';
  const subject     = s.emailSubject    || DEFAULT_SUBJECT;
  const emailBody   = s.emailBody       || DEFAULT_BODY;
  const fromName    = s.emailFromName    || 'Lurkollen';
  const fromAddress = s.emailFromAddress || 'noreply@lurkollen.com';
  const from        = `${fromName} <${fromAddress}>`;
  const origin      = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}`;

  const vars = {
    schoolName,
    inviteLink: `${origin}/?join=${invite.code}`,
    code: invite.code,
    expiresAt: invite.expires_at
      ? new Date(invite.expires_at).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })
      : '',
  };

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from,
        to:      [invite.email],
        subject: render(subject, vars),
        html:    render(emailBody, vars),
      }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      return res.status(502).json({ error: e?.message || `Resend error ${r.status}` });
    }
    // Track that the email was sent
    await supabase.from('invites').update({ email_sent_at: new Date().toISOString() }).eq('id', invite.id);
    return res.json({ ok: true });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
