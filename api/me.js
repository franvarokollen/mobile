// GET /api/me → { user: { id, email }, school: { id, name, role } | null }
// Used by the frontend to determine if the logged-in user has a school assigned.

const { supabase } = require('./_lib/supabase');
const { requireAuthBasic } = require('./_lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = await requireAuthBasic(req, res);
  if (!user) return;

  // Look up school membership
  const { data: membership } = await supabase
    .from('school_users')
    .select('school_id, role, schools(name)')
    .eq('user_id', user.id)
    .single();

  return res.json({
    user: { id: user.id, email: user.email },
    school: membership
      ? { id: membership.school_id, name: membership.schools?.name, role: membership.role }
      : null
  });
};
