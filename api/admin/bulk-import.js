// POST /api/admin/bulk-import
// Body: { school_id, emails: ['a@b.com', ...], role: 'teacher' }
//
// For each email:
//   - If Supabase auth account found → add directly to school_users
//   - If no account yet → create email-specific invite (auto-redeems on first sign-in)
//
// Returns: { added: [...], invited: [...], already: [...], failed: [...] }

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

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkToken(req, res)) return;

  const { school_id, emails, role = 'teacher' } = req.body || {};
  if (!school_id || !Array.isArray(emails) || !emails.length) {
    return res.status(400).json({ error: 'school_id and emails array required' });
  }

  // Deduplicate and normalise
  const unique = [...new Set(emails.map(e => e.trim().toLowerCase()).filter(e => e.includes('@')))];
  if (!unique.length) return res.status(400).json({ error: 'no valid emails provided' });

  // Fetch all Supabase auth users in one call
  const { data: { users: allUsers }, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) return res.status(500).json({ error: listErr.message });

  const authMap = new Map((allUsers || []).map(u => [u.email?.toLowerCase(), u.id]));

  // Fetch existing school_users to detect duplicates
  const { data: existingRows } = await supabase
    .from('school_users')
    .select('user_id')
    .eq('school_id', school_id);
  const existingUserIds = new Set((existingRows || []).map(r => r.user_id));

  // Invite expiry: 30 days from now
  const expires_at = new Date(Date.now() + 30 * 86400000).toISOString();

  const added   = [];
  const invited = [];
  const already = [];
  const failed  = [];

  for (const email of unique) {
    try {
      const userId = authMap.get(email);

      if (userId) {
        // User has a Supabase account
        if (existingUserIds.has(userId)) {
          already.push(email);
          continue;
        }
        const { error } = await supabase
          .from('school_users')
          .insert({ school_id, user_id: userId, role });
        if (error) { failed.push(email); continue; }
        added.push(email);
      } else {
        // No account yet — create email-specific invite
        const code = generateCode();
        const { error } = await supabase
          .from('invites')
          .insert({ school_id, code, email, expires_at });
        if (error) { failed.push(email); continue; }
        invited.push({ email, code });
      }
    } catch(e) {
      failed.push(email);
    }
  }

  return res.json({ ok: true, added, invited, already, failed });
};
