// GET /api/me → { user: { id, email }, school: { id, name, role } | null }
// Used by the frontend to determine if the logged-in user has a school assigned.
// If no direct school_users row, checks school_domains for email-domain auto-join.

const { supabase } = require('./_lib/supabase');
const { requireAuthBasic } = require('./_lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = await requireAuthBasic(req, res);
  if (!user) return;

  // Look up explicit school membership
  const { data: membership } = await supabase
    .from('school_users')
    .select('school_id, role, schools(name)')
    .eq('user_id', user.id)
    .maybeSingle();

  if (membership) {
    return res.json({
      user:   { id: user.id, email: user.email },
      school: { id: membership.school_id, name: membership.schools?.name, role: membership.role }
    });
  }

  // No membership — check domain auto-join
  const emailDomain = (user.email || '').split('@')[1]?.toLowerCase();
  if (emailDomain) {
    const { data: domainRow } = await supabase
      .from('school_domains')
      .select('school_id, schools(name)')
      .eq('domain', emailDomain)
      .maybeSingle();

    if (domainRow) {
      // Auto-enrol into the matched school as teacher
      const { error: joinErr } = await supabase
        .from('school_users')
        .insert({ school_id: domainRow.school_id, user_id: user.id, role: 'teacher' });

      if (!joinErr) {
        return res.json({
          user:   { id: user.id, email: user.email },
          school: { id: domainRow.school_id, name: domainRow.schools?.name, role: 'teacher' }
        });
      }
    }
  }

  return res.json({
    user:   { id: user.id, email: user.email },
    school: null
  });
};
