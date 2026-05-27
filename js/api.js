// ─── API ────────────────────────────────────────────────────
// All server calls go through /api/* (Vercel serverless functions)

const API = '/api';

/**
 * Wrapper around fetch() that automatically attaches the current user's
 * Bearer token so every API request is authenticated.
 */
async function authFetch(url, opts = {}) {
  const token = typeof getAuthToken === 'function' ? getAuthToken() : null;
  if (token) {
    opts = { ...opts, headers: { ...(opts.headers || {}), 'Authorization': `Bearer ${token}` } };
  }
  return fetch(url, opts);
}

function setServerIndicator(online, networkUrl) {
  serverOnline = online;
  const el = document.getElementById('serverIndicator');
  if (!el) return;
  if (online) {
    el.textContent = t('topbar.online');
    el.style.color = 'var(--green-text)';
  } else {
    el.textContent = t('topbar.offline');
    el.style.color = 'var(--text3)';
  }
}

async function fetchNetworkUrl() {
  try {
    const r = await authFetch(`${API}/ping`);
    if (r.ok) setServerIndicator(true);
  } catch(e) {
    setServerIndicator(false);
  }
}

async function serverGet(date) {
  try {
    const r = await authFetch(`${API}/status?date=${date}`);
    if (!r.ok) return null;
    return await r.json();
  } catch(e) { return null; }
}

async function serverSet(date, id, status) {
  try {
    await authFetch(`${API}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, id, status }),
    });
  } catch(e) {}
}

async function serverGetAllLogs() {
  try {
    const r = await authFetch(`${API}/logs`);
    if (!r.ok) return null;
    return await r.json();
  } catch(e) { return null; }
}

async function pollServer() {
  pollCount++;
  try {
    const remote = await serverGet(currentDate);
    if (remote !== null) {
      const logs = loadLogs();
      logs[currentDate] = remote;
      saveLogs(logs);
      if (currentView === 'dash') renderDash();
    }
    setServerIndicator(true);
  } catch(e) {
    setServerIndicator(false);
  }
}

function startPolling() {
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(pollServer, 15000); // every 15s
}

async function fetchStudentsFromServer() {
  try {
    const r = await authFetch(`${API}/students`);
    if (!r.ok) return;
    const data = await r.json();
    // Only overwrite local cache if Supabase returned at least one student.
    // An empty object means the table is empty or the fetch failed silently —
    // either way, don't wipe a valid local cache.
    if (data && typeof data === 'object' && Object.keys(data).length > 0) {
      saveStudents(data);
      CLASSES = getClasses(data) || CLASSES;
    }
  } catch(e) {}
}

async function saveStudentToServer(s) {
  try {
    await authFetch(`${API}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s),
    });
  } catch(e) {}
}

async function patchStudentOnServer(id, patch) {
  try {
    const students = loadStudents();
    const merged = { ...(students[id] || {}), ...patch };
    await authFetch(`${API}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged),
    });
  } catch(e) {}
}

async function bulkUploadToServer(arr) {
  try {
    const obj = {};
    arr.forEach(s => { obj[s.id] = s; });
    const r = await authFetch(`${API}/students-bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(obj),
    });
    if (!r.ok) return { added: 0, updated: 0 };
    return await r.json();
  } catch(e) { return { added: 0, updated: 0 }; }
}

async function saveFlagsToServer(logs, dates) {
  for (const date of dates) {
    const flags = {};
    if (logs[date]) {
      Object.entries(logs[date]).forEach(([k, v]) => {
        if (k.endsWith('_explained') || k.endsWith('_unreported')) flags[k] = v;
      });
    }
    try {
      await authFetch(`${API}/flags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, flags }),
      });
    } catch(e) {}
  }
}

async function loadFlagsFromServer() {
  try {
    const r = await authFetch(`${API}/flags`);
    if (!r.ok) return;
    const data = await r.json();
    if (!data) return;
    const logs = loadLogs();
    Object.entries(data).forEach(([date, flags]) => {
      if (!logs[date]) logs[date] = {};
      Object.assign(logs[date], flags);
    });
    saveLogs(logs);
  } catch(e) {}
}

async function fetchExtraFromServer() {
  if (Date.now() < _extraDirtyUntil) return;
  try {
    const r = await authFetch(`${API}/extra`);
    if (!r.ok) return;
    const data = await r.json();
    if (data && typeof data === 'object') saveExtra(data);
  } catch(e) {}
}

async function fetchGuardiansFromServer() {
  try {
    const r = await authFetch(`${API}/guardians`);
    if (!r.ok) return;
    const data = await r.json();
    if (data && typeof data === 'object') saveGuardians(data);
  } catch(e) {}
}

async function saveGuardiansToServer(d) {
  try {
    await authFetch(`${API}/guardians`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(d),
    });
  } catch(e) {}
}
