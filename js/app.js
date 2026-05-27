// ─── APP INIT & WIRING ─────────────────────────────────────

// ── View switching ──────────────────────────────────────────
function switchView(v) {
  viewHistory.push(v);
  if (viewHistory.length > 10) viewHistory.shift();
  // show/hide back button
  const bb = document.getElementById('backBtn');
  if (bb) bb.style.display = viewHistory.length > 1 ? 'flex' : 'none';
  currentView = v;
  // Import/Export only on dashboard
  const isDash = v === 'dash';
  const ib = document.getElementById('importBtn');
  const eb = document.getElementById('exportBtn');
  if (ib) ib.style.display = isDash ? '' : 'none';
  if (eb) eb.style.display = isDash ? '' : 'none';
  // Export Not Handed In only on Guardians page
  const exportNHI = document.getElementById('exportNHIBtn');
  if (exportNHI) exportNHI.style.display = v === 'report' ? '' : 'none';
  updateDateDisplay();
  ['dash', 'trends', 'students', 'report', 'settings'].forEach(n => {
    const vEl = document.getElementById('view' + n.charAt(0).toUpperCase() + n.slice(1));
    const nEl = document.getElementById('nav' + n.charAt(0).toUpperCase() + n.slice(1));
    if (vEl) vEl.classList.toggle('active', n === v);
    if (nEl) nEl.classList.toggle('active', n === v);
  });
  if (v === 'trends') renderTrends();
  if (v === 'students') renderStudentList();
  if (v === 'report') renderReport();
  if (v === 'settings') renderSettings();
}

function toggleAdd() {
  document.getElementById('addPanel').classList.toggle('open');
}

//── Activity listeners — resets inactivity timer ───────────
['mousemove', 'keydown', 'click', 'touchstart'].forEach(ev => {
  document.addEventListener(ev, () => {
    if (!currentRole || currentRole === 'view') return;
    if (warningActive) { cancelWarning(); return; }
    resetInactivityTimer();
  }, { passive: true });
});

// ── Date picker wiring ──────────────────────────────────────
const dp = document.getElementById('datePicker');
if (dp) {
  dp.value = currentDate;
  dp.addEventListener('change', () => { currentDate = dp.value; statusFilter = 'ALL'; renderDash(); });
}

// ── Scan input: manual typing filters grid ──────────────────
const si = document.getElementById('scanInput');
if (si) {
  si.addEventListener('input', renderGrid);
  si.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const val = e.target.value.trim();
      const students = loadStudents();
      const match = Object.values(students).find(s => s.id.toLowerCase() === val.toLowerCase());
      if (match) { cycleStatus(match.id); e.target.value = ''; renderGrid(); }
    }
  });
}

// ── Global barcode capture ──────────────────────────────────
// Scanners send characters rapidly then Enter; keyboard typing is slower
document.addEventListener('keydown', e => {
  // ignore if user is typing in any input, select, or textarea
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  // ignore modifier-only keys and non-printable except Enter
  if (e.key === 'Enter') {
    const val = globalBuf.trim();
    globalBuf = '';
    if (val.length < 4) return; // too short to be a barcode
    const students = loadStudents();
    const match = Object.values(students).find(s => s.id.toLowerCase() === val.toLowerCase());
    if (match) {
      cycleStatus(match.id);
    } else {
      // not a direct ID match — put it into the search box as a fallback
      const si = document.getElementById('scanInput');
      si.value = val;
      si.focus();
      renderGrid();
    }
    return;
  }
  if (e.key.length === 1) {
    globalBuf += e.key;
    if (globalTimer) clearTimeout(globalTimer);
    // if no Enter arrives within 100ms, assume it was keyboard typing — clear buffer
    globalTimer = setTimeout(() => { globalBuf = ''; }, 100);
  }
});

// ── Migrate: clear old global starred='reported' from extra ─
(function() {
  var extra = loadExtra();
  var changed = false;
  Object.keys(extra).forEach(function(id) {
    if (extra[id] && extra[id].starred === 'reported') { delete extra[id].starred; changed = true; }
  });
  if (changed) saveExtra(extra);
})();


// ── Bootstrap CLASSES from students (settings will override after load) ─
(function() {
  var derived = getClasses(loadStudents());
  if (derived.length > 0) CLASSES = derived;
})();

// ── Startup ─────────────────────────────────────────────────
if (SERVER) {
  // Show loading state in grid before fetches begin
  const _grid = document.getElementById('studentGrid');
  if (_grid) _grid.innerHTML = `
    <div style="grid-column:1/-1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3rem 1rem;gap:12px;color:var(--text3)">
      <i class="ti ti-loader-2 spin" style="font-size:28px"></i>
      <div style="font-size:13px">${t('loading.students')}</div>
    </div>`;
  (async () => {
    await fetchSettingsFromServer();
    await fetchStudentsFromServer();
    await fetchExtraFromServer();
    await loadFlagsFromServer();
    const remote = await serverGet(currentDate);
    if (remote !== null) {
      const logs = loadLogs();
      logs[currentDate] = remote;
      saveLogs(logs);
    }
    // Refresh CLASSES from newly-fetched students
    CLASSES = getClasses(loadStudents()) || CLASSES;
    startPolling();
    updateDateDisplay();
    renderDash();
    if (!hasStudents()) showUploadScreen();
  })();
} else {
  setServerIndicator(false);
  if (!hasStudents()) showUploadScreen();
}

// ── Feature startup ──────────────────────────────────────────
checkPrivacyNotice();
purgeOldLogs();
checkEndOfDay();
setInterval(checkEndOfDay, 60000);


// Sync sidebar lang buttons on initial load
(function() {
  const sv = document.getElementById('langBtnSV');
  const en = document.getElementById('langBtnEN');
  if (sv) sv.classList.toggle('active', currentLang === 'sv');
  if (en) en.classList.toggle('active', currentLang === 'en');
})();
