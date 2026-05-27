// ─── AUTH & UI MODES ────────────────────────────────────────

function logout() { /* no-op until SSO */ }
function resetInactivityTimer() {}
function showInactivityWarning() {}
function cancelWarning() {}
function updateUIForRole() {
  const lb = document.getElementById('logoutBtn');
  if (lb) lb.style.display = 'none';
}


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
    const r = await fetch(`${API}/backups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'manual-' + new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-') })
    });
    if (r.ok) showToast(t('backup.done'));
    else showToast(t('backup.failed'));
  } catch(e) { showToast(t('backup.failed')); }
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
