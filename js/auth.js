// ─── AUTH (Google via Supabase) ─────────────────────────────

let _supabaseClient  = null;
let _currentSession  = null;
let _meInfo          = null;   // { user, school } from /api/me
let _schoolChannel   = null;   // single Realtime channel: presence + broadcast

// ── Presence helpers ─────────────────────────────────────────
const _PRESENCE_COLORS = ['#e8e6df','#e8e6df','#e8e6df','#e8e6df','#e8e6df','#e8e6df','#e8e6df','#e8e6df'];

function _presenceColor(uid) {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = uid.charCodeAt(i) + ((h << 5) - h);
  return _PRESENCE_COLORS[Math.abs(h) % _PRESENCE_COLORS.length];
}

function _initials(name, email) {
  if (name && name !== email) {
    const p = name.trim().split(/\s+/);
    return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  }
  return (email || '??').slice(0, 2).toUpperCase();
}

function renderPresenceAvatars(presences, myId) {
  const container = document.getElementById('presenceAvatars');
  if (!container) return;
  const others = presences.filter(p => p.user_id !== myId);
  if (!others.length) { container.innerHTML = ''; return; }
  const shown = others.slice(0, 6);
  const extra = others.length - shown.length;
  container.innerHTML = shown.map(p =>
    `<div class="presence-avatar" style="background:${_presenceColor(p.user_id || p.email)}" title="${p.name || p.email}">${_initials(p.name, p.email)}</div>`
  ).join('') + (extra > 0 ? `<div class="presence-avatar" style="background:rgba(255,255,255,0.15)" title="${extra} more">+${extra}</div>` : '');
}

// ── Single school channel: presence + broadcast in one WebSocket ──
async function startSchoolChannel(schoolId, user) {
  if (_schoolChannel) { try { await _supabaseClient.removeChannel(_schoolChannel); } catch(e){} }

  const meta = user.user_metadata || {};
  const name = meta.full_name || meta.name || user.email;

  _schoolChannel = _supabaseClient.channel(`school:${schoolId}`, {
    config: {
      presence:  { key: user.id },
      broadcast: { self: false }   // don't echo our own broadcasts back to us
    }
  });

  // ── Presence ──────────────────────────────────────────────
  _schoolChannel.on('presence', { event: 'sync' }, () => {
    const presences = Object.values(_schoolChannel.presenceState()).flat();
    renderPresenceAvatars(presences, user.id);
  });

  // ── Status broadcast (another user tapped a student) ──────
  _schoolChannel.on('broadcast', { event: 'status' }, ({ payload }) => {
    const { date, id, status } = payload || {};
    if (!date || !id || !status) return;
    const logs = loadLogs();
    if (!logs[date]) logs[date] = {};
    logs[date][id] = status;
    saveLogs(logs);
    if (typeof renderDash === 'function' && currentView === 'dash') renderDash();
  });

  // ── Extra broadcast (star / house / note changed) ─────────
  _schoolChannel.on('broadcast', { event: 'extra' }, () => {
    if (Date.now() < _extraDirtyUntil) return;
    fetchExtraFromServer().then(() => {
      if (typeof renderDash === 'function' && currentView === 'dash') renderDash();
    });
  });

  await _schoolChannel.subscribe(async status => {
    if (status === 'SUBSCRIBED') {
      await _schoolChannel.track({ user_id: user.id, name, email: user.email });
    }
  });
}

async function stopSchoolChannel() {
  if (_schoolChannel && _supabaseClient) {
    try { await _supabaseClient.removeChannel(_schoolChannel); } catch(e) {}
    _schoolChannel = null;
  }
  renderPresenceAvatars([], null);
}

/** Push a status change to every other connected user instantly */
function broadcastStatus(date, id, status) {
  if (!_schoolChannel) return;
  _schoolChannel.send({ type: 'broadcast', event: 'status', payload: { date, id, status } });
}

/** Signal peers to refresh their extra data */
function broadcastExtra() {
  if (!_schoolChannel) return;
  _schoolChannel.send({ type: 'broadcast', event: 'extra', payload: {} });
}

// Legacy aliases kept so nothing else breaks
function startPresence(schoolId, user) { return startSchoolChannel(schoolId, user); }
function stopPresence()                { return stopSchoolChannel(); }
function startSync()                   {}
function stopSync()                    {}

/**
 * Fetch runtime config, initialise the Supabase browser client, restore any
 * existing session, and return it (or null if the user must log in).
 */
async function initAuth() {
  // Load the public Supabase URL + anon key from the server at runtime
  let sbUrl, sbKey;
  try {
    const r = await fetch('/api/config');
    if (r.ok) { const cfg = await r.json(); sbUrl = cfg.supabaseUrl; sbKey = cfg.supabaseAnonKey; }
  } catch(e) {}

  if (!sbUrl || !sbKey) {
    _showLoginMessage('Kunde inte ansluta till servern. Försök igen senare.');
    showLoginOverlay();
    return null;
  }

  // Supabase JS UMD bundle exposes window.supabase
  _supabaseClient = window.supabase.createClient(sbUrl, sbKey);

  // getSession() handles OAuth callback codes automatically on redirect return
  const { data: { session } } = await _supabaseClient.auth.getSession();
  _currentSession = session;

  // Keep _currentSession fresh (token refresh, sign-out in another tab, etc.)
  _supabaseClient.auth.onAuthStateChange((_event, sess) => {
    _currentSession = sess;
    if (!sess) { _meInfo = null; showLoginOverlay(); }
  });

  if (!session) {
    // Preserve any ?join=CODE across the OAuth redirect
    const urlCode = new URLSearchParams(window.location.search).get('join');
    if (urlCode) localStorage.setItem('pendingJoinCode', urlCode.trim().toUpperCase());
    showLoginOverlay();
    return null;
  }

  // Verify the user belongs to a school
  try {
    const r = await authFetch('/api/me');
    if (r.ok) _meInfo = await r.json();
  } catch(e) {}

  if (!_meInfo?.school) {
    hideLoginOverlay();
    // Check for ?join=CODE URL param (shareable invite link)
    const urlCode = new URLSearchParams(window.location.search).get('join');
    if (urlCode) localStorage.setItem('pendingJoinCode', urlCode.trim().toUpperCase());
    const pendingCode = localStorage.getItem('pendingJoinCode');
    showInviteOverlay();
    if (pendingCode) {
      localStorage.removeItem('pendingJoinCode');
      const input = document.getElementById('inviteCodeInput');
      if (input) input.value = pendingCode;
      // Small delay so the overlay renders before we try to read it
      setTimeout(() => redeemInvite(), 80);
    }
    return null;
  }

  hideLoginOverlay();
  hideInviteOverlay();
  _updateUserDisplay(session.user);
  startSchoolChannel(_meInfo.school.id, session.user);
  return session;
}

/** Return the current access token to attach as a Bearer header, or null. */
function getAuthToken() {
  return _currentSession?.access_token || null;
}

/** Return the current user's role in their school ('admin' | 'teacher' | null). */
function getMyRole()   { return _meInfo?.school?.role || null; }

/** Return the current user's Supabase auth UUID. */
function getMyUserId() { return _meInfo?.user?.id || null; }

/** Kick off Google OAuth redirect via Supabase. */
async function signInWithGoogle() {
  if (!_supabaseClient) return;
  const btn = document.getElementById('googleSignInBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Omdirigerar…'; }
  const { error } = await _supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname }
  });
  if (error) {
    _showLoginMessage(error.message);
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/><path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg> Logga in med Google'; }
  }
}

/** Send a magic link to the given email address. */
async function signInWithMagicLink() {
  const input = document.getElementById('magicLinkEmail');
  const btn   = document.getElementById('magicLinkBtn');
  const email = (input?.value || '').trim();

  if (!email || !email.includes('@')) {
    _showLoginMessage('Ange en giltig e-postadress');
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = '…'; }

  // Preserve any ?join=CODE across the magic link redirect
  const urlCode = new URLSearchParams(window.location.search).get('join');
  if (urlCode) localStorage.setItem('pendingJoinCode', urlCode.trim().toUpperCase());

  const { error } = await _supabaseClient.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname }
  });

  if (error) {
    _showLoginMessage(error.message);
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-send" style="font-size:15px"></i>Skicka inloggningslänk'; }
    return;
  }

  // Show confirmation state
  const form = document.getElementById('loginForm');
  const sent = document.getElementById('loginSent');
  const sentTo = document.getElementById('magicLinkSentTo');
  if (form) form.style.display = 'none';
  if (sent) sent.style.display = 'flex';
  if (sentTo) sentTo.textContent = email;
}

/** Sign out of Supabase and show the login screen. */
async function signOut() {
  await stopSchoolChannel();
  if (_supabaseClient) await _supabaseClient.auth.signOut();
  _currentSession = null;
  _meInfo = null;
  _updateUserDisplay(null);
  showLoginOverlay();
}

function showLoginOverlay() {
  const el = document.getElementById('loginOverlay');
  if (el) el.style.display = 'flex';
}

function hideLoginOverlay() {
  const el = document.getElementById('loginOverlay');
  if (el) el.style.display = 'none';
}

function _showLoginMessage(msg) {
  const el = document.getElementById('loginMsg');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

// ── Invite overlay ───────────────────────────────────────────
function showInviteOverlay() {
  const el = document.getElementById('inviteOverlay');
  if (el) el.style.display = 'flex';
}

function hideInviteOverlay() {
  const el = document.getElementById('inviteOverlay');
  if (el) el.style.display = 'none';
}

function _showInviteMessage(msg, isError = true) {
  const el = document.getElementById('inviteMsg');
  if (!el) return;
  el.textContent = msg;
  el.style.color      = isError ? 'var(--red-text)' : '#16a34a';
  el.style.background = isError ? 'rgba(226,75,74,0.08)' : 'rgba(22,163,74,0.08)';
  el.style.display    = 'block';
}

async function redeemInvite() {
  const input = document.getElementById('inviteCodeInput');
  const btn   = document.getElementById('redeemBtn');
  const code  = (input?.value || '').trim().toUpperCase();

  if (!code) { _showInviteMessage('Ange din inbjudningskod'); return; }

  if (btn) { btn.disabled = true; btn.textContent = '…'; }

  try {
    const r = await authFetch('/api/invite-redeem', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code })
    });
    const data = await r.json().catch(() => ({}));

    if (r.ok) {
      // Code redeemed — reload to pick up the new school assignment
      window.location.reload();
      return;
    }

    const msgs = {
      'invalid_code':            'Ogiltig kod — kontrollera och försök igen',
      'code_already_used':       'Den här koden har redan använts',
      'code_expired':            'Koden har gått ut',
      'code_not_for_this_email': 'Koden är inte avsedd för den här e-postadressen',
      'already_in_school':       'Du är redan kopplad till en skola',
    };
    _showInviteMessage(msgs[data.error] || 'Något gick fel — försök igen');
  } catch(e) {
    _showInviteMessage('Nätverksfel — försök igen');
  }

  if (btn) { btn.disabled = false; btn.textContent = 'Fortsätt'; }
}

function _updateUserDisplay(user) {
  const emailEl = document.getElementById('sidebarUserEmail');
  const logoutBtn = document.getElementById('logoutBtn');
  if (emailEl) emailEl.textContent = user?.email || '';
  if (logoutBtn) logoutBtn.style.display = user ? 'flex' : 'none';
}

// Kept for compatibility with callers that still reference these names
function logout() { signOut(); }
function resetInactivityTimer() {}
function showInactivityWarning() {}
function cancelWarning() {}
function updateUIForRole() { /* handled by _updateUserDisplay */ }


// ── Whole-class exempt ───────────────────────────────────────
function exemptClass() {
  const cls = currentClass;
  if (cls === 'ALL') return;
  if (!confirm(t('exempt.confirm', { cls }))) return;
  const students = loadStudents();
  const dl = getDayLogs(currentDate);
  const affected = Object.values(students).filter(s => s.active && s.cls === cls && dl[s.id]);
  if (!affected.length) { showToast(t('exempt.none', { cls })); return; }
  affected.forEach(s => {
    setDayLog(currentDate, s.id, 'in');
    if (SERVER) serverSet(currentDate, s.id, 'in');
  });
  showToast(t('exempt.done', { n: affected.length, cls }));
  renderDash();
}

// ── End-of-day reset ─────────────────────────────────────────
function checkEndOfDay() {
  const s = getSettings();
  if (!s.eodEnabled || !s.eodTime) return;
  const today = todayKey();
  if (_eodCheckedToday) return;
  const now = new Date();
  const [h, m] = (s.eodTime || '16:00').split(':').map(Number);
  if (isNaN(h)) return;
  if (now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m)) {
    _eodCheckedToday = true;
    localStorage.setItem('phc_eod_checked', today);
    if (s.eodAction === 'clear') {
      _doEodReset(false);
    } else {
      showToast(t('eod.reminder'));
      if (currentView !== 'report') switchView('report');
    }
  }
}

function _doEodReset(manual) {
  const today = todayKey();
  const logs = loadLogs();
  if (logs[today]) {
    const cleaned = {};
    Object.entries(logs[today]).forEach(([k, v]) => {
      if (k.endsWith('_explained') || k.endsWith('_unreported')) cleaned[k] = v;
    });
    logs[today] = Object.keys(cleaned).length ? cleaned : undefined;
    if (!logs[today]) delete logs[today];
    saveLogs(logs);
  }
  renderDash();
  if (manual) showToast(t('eod.done'));
}

function manualEodReset() {
  const today = todayKey();
  if (!confirm(t('eod.manual_confirm', { date: today }))) return;
  _doEodReset(true);
}

// ── Purge old logs from localStorage ────────────────────────
function purgeOldLogs() {
  const days = parseInt(getSettings().dataRetentionDays);
  if (!days || days <= 0) return;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const logs = loadLogs();
  let purged = 0;
  Object.keys(logs).forEach(date => { if (date < cutoffStr) { delete logs[date]; purged++; } });
  if (purged) saveLogs(logs);
}

// ── Create backup ────────────────────────────────────────────
async function createBackup() {
  showToast(t('backup.creating'));
  try {
    const r = await authFetch(`${API}/backups?action=manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (r.ok) showToast(t('backup.done'));
    else showToast(t('backup.failed'));
  } catch(e) { showToast(t('backup.failed')); }
}

// ── DPA signing ──────────────────────────────────────────────
function openDpaModal() {
  const modal = document.getElementById('dpaModal');
  if (!modal) return;
  // Personalise the checkbox label with the school name
  const schoolName = getSettings().schoolName || '';
  const lbl = document.getElementById('dpaCheckboxLabel');
  if (lbl) lbl.textContent = t('dpa.checkbox_label').replace('{school}', schoolName || t('dpa.your_school'));
  // Fill placeholder
  const inp = document.getElementById('dpaSignerName');
  if (inp) inp.placeholder = t('dpa.name_placeholder');
  modal.style.display = 'flex';
}

function closeDpaModal() {
  const modal = document.getElementById('dpaModal');
  if (modal) modal.style.display = 'none';
  document.getElementById('dpaError').textContent = '';
}

async function signDpa() {
  const name = document.getElementById('dpaSignerName')?.value.trim();
  const checked = document.getElementById('dpaCheckbox')?.checked;
  const err = document.getElementById('dpaError');
  if (!name) { if (err) err.textContent = t('dpa.error_name'); return; }
  if (!checked) { if (err) err.textContent = t('dpa.error_checkbox'); return; }
  if (err) err.textContent = '';

  const btn = document.getElementById('dpaSignBtn');
  if (btn) { btn.disabled = true; btn.textContent = t('dpa.signing'); }

  try {
    const r = await authFetch(`${API}/dpa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signerName: name }),
    });
    const d = await r.json();
    if (d.ok) {
      window._dpaSigned = true;
      showToast(t('dpa.signed_ok'));
      closeDpaModal();
      renderOnboarding();
    } else {
      if (err) err.textContent = d.error || t('dpa.error_failed');
    }
  } catch(e) {
    if (err) err.textContent = t('dpa.error_failed');
  }
  if (btn) { btn.disabled = false; btn.textContent = t('dpa.sign_btn'); }
}

// ── Privacy notice ───────────────────────────────────────────
function checkPrivacyNotice() {
  if (!localStorage.getItem('phc_privacy_ok')) {
    const modal = document.getElementById('privacyModal');
    if (modal) modal.style.display = 'flex';
  }
}

function acceptPrivacy() {
  localStorage.setItem('phc_privacy_ok', '1');
  const modal = document.getElementById('privacyModal');
  if (modal) modal.style.display = 'none';
}

function openPrivacyModal() {
  const modal = document.getElementById('privacyModal');
  if (modal) modal.style.display = 'flex';
}
