// ─── APP INIT & WIRING ─────────────────────────────────────

// ── View switching ──────────────────────────────────────────
function switchView(v) {
  // Teachers cannot access Settings
  if (v === 'settings' && getMyRole() !== 'admin') { v = 'dash'; }
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
(async () => {
  // Apply translations immediately so the login screen renders correctly
  applyI18n();

  // Sync sidebar lang buttons
  const _sv = document.getElementById('langBtnSV');
  const _en = document.getElementById('langBtnEN');
  if (_sv) _sv.classList.toggle('active', currentLang === 'sv');
  if (_en) _en.classList.toggle('active', currentLang === 'en');

  // Gate everything behind authentication
  const session = await initAuth();
  if (!session) return; // login overlay is visible; page will reload after OAuth redirect

  if (SERVER) {
    // Show loading spinner in grid while fetches run
    const _grid = document.getElementById('studentGrid');
    if (_grid) _grid.innerHTML = `
      <div style="grid-column:1/-1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3rem 1rem;gap:12px;color:var(--text3)">
        <i class="ti ti-loader-2 spin" style="font-size:28px"></i>
        <div style="font-size:13px">${t('loading.students')}</div>
      </div>`;

    // Single /api/init call — one cold start, one round trip, all data in parallel on the server
    const init = await authFetch(`${API}/init?date=${currentDate}`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null);

    let serverStudentCount = 0;

    if (init) {
      // Settings
      if (init.settings && typeof init.settings === 'object') {
        _settings = init.settings;
        applySettings();
      }
      // Students
      if (init.students && typeof init.students === 'object') {
        serverStudentCount = Object.keys(init.students).length;
        if (serverStudentCount > 0) {
          saveStudents(init.students);
          CLASSES = getClasses(init.students) || CLASSES;
        }
      }
      // Extra (starred, flags, notes, slot)
      if (init.extra && typeof init.extra === 'object') {
        saveExtra(init.extra);
      }
      // Per-day flags (explained, unreported etc.) — merge into logs
      if (init.flags && typeof init.flags === 'object') {
        const logs = loadLogs();
        Object.entries(init.flags).forEach(([d, flagData]) => {
          if (!logs[d]) logs[d] = {};
          Object.assign(logs[d], flagData);
        });
        saveLogs(logs);
      }
      // Today's status log
      if (init.daylog && typeof init.daylog === 'object') {
        const logs = loadLogs();
        logs[currentDate] = init.daylog;
        saveLogs(logs);
      }
      // DPA status
      window._dpaSigned = !!(init.dpa && init.dpa.signed);
      // User count (for onboarding "Invite teachers" step)
      window._schoolUserCount = init.userCount || 0;
    }

    CLASSES = getClasses(loadStudents()) || CLASSES;
    // Show Settings nav only for admins (hidden by default in HTML)
    if (getMyRole() === 'admin') {
      const navSettings = document.getElementById('navSettings');
      if (navSettings) navSettings.style.display = '';
    }
    startPolling();
    updateDateDisplay();
    renderDash();

    // Background sync of ALL historical status logs so Trends is correct on any device.
    // Runs after renderDash so it never delays the initial screen.
    (async () => {
      try {
        const r = await authFetch(`${API}/logs`);
        if (!r.ok) return;
        const remoteLogs = await r.json();
        if (remoteLogs && typeof remoteLogs === 'object' && Object.keys(remoteLogs).length > 0) {
          const local = loadLogs();
          // Remote is authoritative per date; preserve any local flag keys (e.g. _explained)
          Object.entries(remoteLogs).forEach(([d, dayData]) => {
            local[d] = Object.assign({}, local[d] || {}, dayData);
          });
          saveLogs(local);
          if (currentView === 'trends') renderTrends();
        }
      } catch(e) {}
    })();
    // Show upload screen only if server confirmed there are no students.
    // Never show it when init failed (null) — that's a network/auth issue, not a missing-data issue.
    // Also check localStorage as fallback for the case init was skipped.
    if (init !== null ? serverStudentCount === 0 : !hasStudents()) showUploadScreen();
  } else {
    setServerIndicator(false);
    if (!hasStudents()) showUploadScreen();
  }

  // Feature startup (runs only after successful login)
  checkPrivacyNotice();
  purgeOldLogs();
  checkEndOfDay();
  setInterval(checkEndOfDay, 60000);
})();
