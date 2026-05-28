// POST /api/admin/send-invites
// Body: { school_id, invites: [{email, code}], baseUrl? }
// Sends invite emails via Resend using the school's email template settings.

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

// ── Default template ────────────────────────────────────────────
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
  if (!checkToken(req, res)) return;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'RESEND_API_KEY not configured on server' });

  const { school_id, invites, baseUrl } = req.body || {};
  if (!school_id || !Array.isArray(invites) || !invites.length) {
    return res.status(400).json({ error: 'school_id and invites array required' });
  }

  // Fetch school settings for template + school name
  const { data: settingsRow } = await supabase
    .from('settings').select('data').eq('school_id', school_id).maybeSingle();
  const s = settingsRow?.data || {};

  const schoolName   = s.schoolName   || 'Lurkollen';
  const subject      = s.emailSubject || DEFAULT_SUBJECT;
  const body         = s.emailBody    || DEFAULT_BODY;
  const fromName     = s.emailFromName    || 'Lurkollen';
  const fromAddress  = s.emailFromAddress || 'noreply@lurkollen.com';
  const from         = `${fromName} <${fromAddress}>`;
  const origin       = baseUrl || 'https://lurkollen.vercel.app';

  // Batch-fetch invite IDs and expiry dates so we can track email_sent_at and format dates
  const codes = invites.map(i => i.code).filter(Boolean);
  const { data: inviteRows } = await supabase
    .from('invites')
    .select('id, code, expires_at')
    .eq('school_id', school_id)
    .in('code', codes);
  const inviteMap = Object.fromEntries((inviteRows || []).map(r => [r.code, r]));

  const sent   = [];
  const failed = [];

  for (const inv of invites) {
    if (!inv.email || !inv.code) continue;
    const inviteRow = inviteMap[inv.code];
    try {
      const vars = {
        schoolName,
        inviteLink: `${origin}/?join=${inv.code}`,
        code: inv.code,
        expiresAt: inviteRow?.expires_at
          ? new Date(inviteRow.expires_at).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })
          : '',
      };
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          from,
          to:      [inv.email],
          subject: render(subject, vars),
          html:    render(body, vars),
        }),
      });
      if (r.ok) {
        sent.push(inv.email);
        if (inviteRow?.id) {
          await supabase.from('invites').update({ email_sent_at: new Date().toISOString() }).eq('id', inviteRow.id);
        }
      } else {
        const e = await r.json().catch(() => ({}));
        failed.push({ email: inv.email, error: e?.message || `HTTP ${r.status}` });
      }
    } catch(e) {
      failed.push({ email: inv.email, error: e.message });
    }
  }

  return res.json({ ok: true, sent, failed });
};
