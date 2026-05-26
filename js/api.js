// ─── API ────────────────────────────────────────────────────
// All server calls go through /api/* (Vercel serverless functions)

const API = '/api';

function setServerIndicator(online, networkUrl) {
  serverOnline = online;
  const el = document.getElementById('serverIndicator');
  if (!el) return;
  if (online) {
    el.textContent = '● Online';
    el.style.color = 'var(--green-text)';
  } else {
    el.textContent = '○ Offline';
    el.style.color = 'var(--text3)';
  }
}

async function fetchNetworkUrl() {
  try {
    const r = await fetch(`${API}/ping`);
    if (r.ok) setServerIndicator(true);
  } catch(e) {
    setServerIndicator(false);
  }
}

async function serverGet(date) {
  try {
    const r = await fetch(`${API}/status?date=${date}`);
    if (!r.ok) return null;
    return await r.json();
  } catch(e) { return null; }
}

async function serverSet(date, id, status) {
  try {
    await fetch(`${API}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, id, status }),
    });
  } catch(e) {}
}

async function serverGetAllLogs() {
  try {
    const r = await fetch(`${API}/logs`);
    if (!r.ok) return null;
    return await r.json();
  } catch(e) { return null; }
}

let pollCount = 0;

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
    const r = await fetch(`${API}/students`);
    if (!r.ok) return;
    const data = await r.json();
    if (data && typeof data === 'object') {
      saveStudents(data);
      CLASSES = getClasses(data) || CLASSES;
    }
  } catch(e) {}
}

async function saveStudentToServer(s) {
  try {
    await fetch(`${API}/students`, {
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
    await fetch(`${API}/students`, {
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
    const r = await fetch(`${API}/students-bulk`, {
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
      await fetch(`${API}/flags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, flags }),
      });
    } catch(e) {}
  }
}

async function loadFlagsFromServer() {
  try {
    const r = await fetch(`${API}/flags`);
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
    const r = await fetch(`${API}/extra`);
    if (!r.ok) return;
    const data = await r.json();
    if (data && typeof data === 'object') saveExtra(data);
  } catch(e) {}
}

async function fetchGuardiansFromServer() {
  try {
    const r = await fetch(`${API}/guardians`);
    if (!r.ok) return;
    const data = await r.json();
    if (data && typeof data === 'object') saveGuardians(data);
  } catch(e) {}
}

async function saveGuardiansToServer(d) {
  try {
    await fetch(`${API}/guardians`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(d),
    });
  } catch(e) {}
}
