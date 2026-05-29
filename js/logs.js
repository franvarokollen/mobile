// ─── LOGS ──────────────────────────────────────────────────

function todayKey() { return new Date().toISOString().slice(0, 10); }

function getDayLogs(dk) { const l = loadLogs(); return l[dk] || {}; }

function setDayLog(dk, id, status) {
  const l = loadLogs();
  if (!l[dk]) l[dk] = {};
  if (status === 'in') delete l[dk][id];
  else l[dk][id] = status;
  saveLogs(l);
}

async function cycleStatus(id) {
  const dl = getDayLogs(currentDate);
  const oldStatus = dl[id] || 'in';
  const statuses = getStatuses();
  const keys = statuses.map(s => s.key);
  const idx = keys.indexOf(oldStatus);
  const next = idx === -1 ? keys[0] : (idx >= keys.length - 1 ? 'in' : keys[idx + 1]);
  setDayLog(currentDate, id, next);
  renderDash();

  const label = next === 'in'
    ? (t('dash.handed_in') + ' ✓')
    : (statuses.find(s => s.key === next)?.label || next);

  // Show toast with Undo button (20s window)
  const _date = currentDate; // capture for closure
  showToast(label, () => {
    setDayLog(_date, id, oldStatus);
    renderDash();
    if (SERVER) serverSet(_date, id, oldStatus, next);
    showToast(t('toast.undone'));
  });

  if (SERVER) serverSet(currentDate, id, next, oldStatus);
}

async function setStatus(id, key) {
  const dl = getDayLogs(currentDate);
  const cur = dl[id] || 'in';
  const next = cur === key ? 'in' : key;
  setDayLog(currentDate, id, next);
  renderDash();
  if (SERVER) serverSet(currentDate, id, next);
}

async function setLate(id) {
  const statuses = getStatuses();
  const secondStatus = statuses[1] ? statuses[1].key : 'late';
  setStatus(id, secondStatus);
}

function norm(s) { return s.toLowerCase().replace(/[^a-z]/g, ''); }
