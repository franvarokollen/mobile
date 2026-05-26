// ─── AUTH ──────────────────────────────────────────────────

function resetInactivityTimer() {
  if (!currentRole || currentRole === 'view') return;
  if (warningActive) return; // don't reset if warning is showing — only cancelWarning() does that
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(showInactivityWarning, INACTIVITY_MS);
}

function showInactivityWarning() {
  warningActive = true;
  let secs = WARNING_S;
  const el = document.getElementById('inactivityWarning');
  const num = document.getElementById('countdownNum');
  if (!el || !num) return;
  el.style.display = 'flex';
  num.textContent = secs;
  countdownInterval = setInterval(() => {
    secs--;
    num.textContent = secs;
    if (secs <= 0) { clearInterval(countdownInterval); logout(); }
  }, 1000);
}

function cancelWarning() {
  warningActive = false;
  clearInterval(countdownInterval);
  const _iw = document.getElementById('inactivityWarning');
  if (_iw) _iw.style.display = 'none';
  resetInactivityTimer();
}

function logout(msg) {
  warningActive = false;
  currentRole = null;
  clearTimeout(inactivityTimer);
  clearInterval(countdownInterval);
  const _iw2 = document.getElementById('inactivityWarning');
  if (_iw2) _iw2.style.display = 'none';
  showLoginScreen();
}

function showLoginScreen() {
  pinBuf = ''; pinMode = null;
  document.getElementById('pinScreen').style.display = 'flex';
  document.getElementById('roleButtons').style.display = 'flex';
  document.getElementById('pinEntry').style.display = 'none';
  document.getElementById('pinError').textContent = '';
  document.querySelectorAll('.dot').forEach(d => d.classList.remove('filled'));
}

function enterViewOnly() {
  currentRole = 'view';
  document.getElementById('pinScreen').style.display = 'none';
  const _appv = document.querySelector('.app');
  if (_appv) _appv.style.display = 'block';
  updateUIForRole();
  updateDateDisplay();
  renderDash();
}

function startPin(mode) {
  pinMode = mode;
  pinBuf = '';
  document.getElementById('roleButtons').style.display = 'none';
  document.getElementById('pinEntry').style.display = 'block';
  document.getElementById('pinModeLabel').textContent = mode === 'staff' ? 'Admin' : 'Guardians';
  document.getElementById('pinError').textContent = '';
  document.querySelectorAll('.dot').forEach(d => d.classList.remove('filled'));
}

function requireGuardianPin() {
  if (currentRole === 'guardian') { switchView('report'); return; }
  // Show pin screen and jump straight to guardian pin entry
  document.getElementById('pinScreen').style.display = 'flex';
  document.getElementById('roleButtons').style.display = 'none';
  document.getElementById('pinEntry').style.display = 'block';
  document.getElementById('pinModeLabel').textContent = 'Guardians';
  document.getElementById('pinError').textContent = '';
  document.querySelectorAll('.dot').forEach(d => d.classList.remove('filled'));
  pinBuf = '';
  pinMode = 'guardian';
}

function backToRoles() {
  document.getElementById('roleButtons').style.display = 'flex';
  document.getElementById('pinEntry').style.display = 'none';
  document.getElementById('pinError').textContent = '';
  document.querySelectorAll('.dot').forEach(d => d.classList.remove('filled'));
}

function pinPress(v) {
  const err = document.getElementById('pinError');
  err.textContent = '';
  if (v === 'back') { pinBuf = pinBuf.slice(0, -1); }
  else if (v === 'enter') { checkPin(); }
  else if (pinBuf.length < 6) { pinBuf += v; }
  document.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('filled', i < pinBuf.length));
  if (pinBuf.length === 6) setTimeout(checkPin, 120);
}

function checkPin() {
  const correctPin = pinMode === 'staff' ? PIN_STAFF : PIN_GUARDIAN;
  if (pinBuf === correctPin) {
    currentRole = pinMode === 'staff' ? 'staff' : 'guardian';
    document.getElementById('pinScreen').style.display = 'none';
    const _app = document.querySelector('.app');
    if (_app) _app.style.display = 'block';
    updateUIForRole();
    updateDateDisplay();
    resetInactivityTimer();
    if (currentRole === 'guardian') {
      switchView('report');
    } else {
      renderDash();
    }
  } else {
    document.getElementById('pinError').textContent = 'Incorrect PIN';
    pinBuf = '';
    document.querySelectorAll('.dot').forEach(d => d.classList.remove('filled'));
  }
}

function updateUIForRole() {
  const isView = currentRole === 'view';
  const isGuardian = currentRole === 'guardian';
  // hide/show nav items based on role
  const navStudents = document.getElementById('navStudents');
  const navTrends = document.getElementById('navTrends');
  const importBtn = document.getElementById('importBtn');
  const exportBtn = document.getElementById('exportBtn');
  const addStudentBtn = document.getElementById('addStudentBtn');
  if (navStudents) navStudents.style.display = isView ? 'none' : '';
  if (navTrends) navTrends.style.display = isView ? 'none' : '';
  const navReport = document.getElementById('navReport');
  if (navReport) navReport.style.display = (isView) ? 'none' : '';
  if (importBtn) importBtn.style.display = isView ? 'none' : '';
  if (exportBtn) exportBtn.style.display = isView ? 'none' : '';
  if (addStudentBtn) addStudentBtn.style.display = isView ? 'none' : '';
  // add logout button to topbar
  let lb = document.getElementById('logoutBtn');
  if (!lb) {
    lb = document.createElement('button');
    lb.id = 'logoutBtn';
    lb.className = 'nav-btn';
    lb.innerHTML = '<i class="ti ti-logout"></i>Log out';
    lb.onclick = () => logout();
    if (document.getElementById('topbarRow1')) document.getElementById('topbarRow1').appendChild(lb);
  }
  lb.style.display = isView ? 'none' : '';
  // add/show a discreet login button for view-only users
  let vl = document.getElementById('viewLoginBtn');
  if (!vl) {
    vl = document.createElement('button');
    vl.id = 'viewLoginBtn';
    vl.className = 'nav-btn';
    vl.innerHTML = '<i class="ti ti-lock"></i>Log in';
    vl.onclick = () => logout();
    if (document.getElementById('topbarRow1')) document.getElementById('topbarRow1').appendChild(vl);
  }
  vl.style.display = isView ? '' : 'none';
}
