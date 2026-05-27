// ─── API AUTH HELPER ────────────────────────────────────────
// Verifies a Supabase JWT from the Authorization header.
// Optional env vars:
//   ALLOWED_DOMAIN  – e.g. "skola.se"  → only that email domain allowed
//   ALLOWED_EMAILS  – e.g. "a@b.se,c@d.se" → exact whitelist

const { supabase } = require('./supabase');

const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN || null;
const ALLOWED_EMAILS = process.env.ALLOWED_EMAILS
  ? process.env.ALLOWED_EMAILS.split(',').map(e => e.trim().toLowerCase())
  : null;

async function requireAuth(req, res) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) {
    res.status(401).json({ error: 'auth_required' });
    return null;
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    res.status(401).json({ error: 'invalid_token' });
    return null;
  }

  const email = (user.email || '').toLowerCase();

  if (ALLOWED_EMAILS && !ALLOWED_EMAILS.includes(email)) {
    res.status(403).json({ error: 'email_not_authorized' });
    return null;
  }

  if (ALLOWED_DOMAIN) {
    const domain = email.split('@')[1] || '';
    if (domain !== ALLOWED_DOMAIN) {
      res.status(403).json({ error: 'domain_not_authorized' });
      return null;
    }
  }

  return user;
}

module.exports = { requireAuth };
