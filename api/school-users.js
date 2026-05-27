// GET  /api/school-users        → list users in school
// DELETE /api/school-users?userId=xxx → remove user from school

const { supabase } = require('./_lib/supabase');
const { requireAuth } = require('./_lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireAuth(req, res);
  if (!auth) return;
  if (auth.role !== 'admin') return res.status(403).json({ error: 'admin_required' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('school_users')
      .select('user_id, role, created_at')
      .eq('school_id', auth.schoolId)
      .order('created_at');
    if (error) return res.status(500).json({ error: error.message });

    // Fetch emails from auth.users via admin API
    const userIds = (data || []).map(r => r.user_id);
    const userMap = {};
    await Promise.all(userIds.map(async id => {
      const { data: u } = await supabase.auth.admin.getUserById(id);
      if (u?.user) userMap[id] = { email: u.user.email, name: u.user.user_metadata?.full_name || '' };
    }));

    return res.json((data || []).map(r => ({
      userId: r.user_id,
      role: r.role,
      joinedAt: r.created_at,
      email: userMap[r.user_id]?.email || '',
      name: userMap[r.user_id]?.name || '',
    })));
  }

  if (req.method === 'DELETE') {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (userId === auth.user.id) return res.status(400).json({ error: 'cannot_remove_self' });
    const { error } = await supabase
      .from('school_users')
      .delete()
      .eq('school_id', auth.schoolId)
      .eq('user_id', userId);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.status(405).end();
};
