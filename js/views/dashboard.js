// ─── DASHBOARD VIEW ────────────────────────────────────────

function renderDash() {
  if (!document.getElementById('statsRow') || !document.getElementById('studentGrid')) return;
  renderStats(); renderTabs(); renderGrid();
}

function setStatusFilter(f) {
  statusFilter = f;
  const bar = document.getElementById('statusFilterBar');
  const lbl = document.getElementById('statusFilterLabel');
  if (bar && lbl) {
    if (f === 'ALL') {
      bar.style.display = 'none';
    } else {
      const labels = { out: 'Showing: Not handed in only', unreported: 'Showing: Unreported absent only', late: 'Showing: Late / Reception only', ok: 'Showing: Handed in / OK only' };
      const colors = { out: 'var(--red-text)', unreported: '#ef4444', late: 'var(--amber-text)', ok: 'var(--green-text)' };
      lbl.textContent = labels[f] || f;
      lbl.style.color = colors[f] || 'var(--text)';
      bar.style.display = 'flex';
    }
  }
  renderStats();
  renderGrid();
}

function renderStats() {
  const students = loadStudents();
  const dl = getDayLogs(currentDate);
  const list = Object.values(students).filter(s => s.active && inScope(s.cls) && (currentClass === 'ALL' || s.cls === currentClass));
  const total = list.length;
  const out = list.filter(s => dl[s.id] === 'out').length;
  const late = list.filter(s => dl[s.id] === 'late').length;
  const unreported = list.filter(s => dl[s.id + '_unreported']).length;
  const ok = total - out - late;
  const sr = document.getElementById('statsRow'); if (!sr) return;
  const statStyle = 'cursor:pointer;transition:box-shadow 0.15s;';
  const activeStyle = 'box-shadow:0 0 0 2px var(--text);';
  sr.innerHTML = `
    <div class="stat" style="${statStyle}${statusFilter === 'ALL' ? activeStyle : ''}" onclick="setStatusFilter('ALL')"><div class="stat-label">Total</div><div class="stat-val">${total}</div></div>
    <div class="stat" style="${statStyle}${statusFilter === 'out' ? activeStyle : ''}" onclick="setStatusFilter('out')"><div class="stat-label">Not handed in</div><div class="stat-val" style="color:var(--red-text)">${out}</div></div>
    <div class="stat" style="${statStyle}${statusFilter === 'unreported' ? activeStyle : ''}" onclick="setStatusFilter('unreported')"><div class="stat-label">Unreported</div><div class="stat-val" style="color:#ef4444">${unreported}</div></div>
    <div class="stat" style="${statStyle}${statusFilter === 'late' ? activeStyle : ''}" onclick="setStatusFilter('late');if(late>0)openLateDrill()"><div class="stat-label">Late / Reception</div><div class="stat-val" style="color:var(--amber-text)">${late}</div></div>
    <div class="stat" style="${statStyle}${statusFilter === 'ok' ? activeStyle : ''}" onclick="setStatusFilter('ok')"><div class="stat-label">Handed in / OK</div><div class="stat-val" style="color:var(--green-text)">${ok}</div></div>
  `;
}

function renderTabs() {
  const bar = document.getElementById('classTabs') || document.getElementById('tabBar');
  if (!bar) return;
  bar.innerHTML = '';
  ['ALL', ...CLASSES].forEach(c => {
    const b = document.createElement('button');
    b.className = 'tab' + (c === currentClass ? ' active' : '');
    b.textContent = c;
    b.onclick = () => { currentClass = c; renderDash(); };
    bar.appendChild(b);
  });
}

function renderGrid() {
  const students = loadStudents();
  const dl = getDayLogs(currentDate);
  const q = document.getElementById('scanInput').value.trim().toLowerCase();
  const grid = document.getElementById('studentGrid');

  if (!Object.values(students).some(s => s.active)) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem 1rem">
      <i class="ti ti-users-off" style="font-size:36px;color:var(--text3);display:block;margin-bottom:12px"></i>
      <div style="font-size:15px;font-weight:500;margin-bottom:6px">No students loaded</div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:1.25rem">Go to the Students tab to upload your CSV</div>
      <button class="btn" onclick="switchView('students')"><i class="ti ti-arrow-right"></i>Go to Students</button>
    </div>`;
    return;
  }

  let list = Object.values(students).filter(s => s.active && inScope(s.cls) && (currentClass === 'ALL' || s.cls === currentClass));
  if (q) list = list.filter(s => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
  // Apply status filter
  if (statusFilter === 'out') list = list.filter(s => dl[s.id] === 'out');
  else if (statusFilter === 'unreported') list = list.filter(s => dl[s.id + '_unreported']);
  else if (statusFilter === 'late') list = list.filter(s => dl[s.id] === 'late');
  else if (statusFilter === 'ok') list = list.filter(s => (!dl[s.id] || dl[s.id] === 'in') && !getExtra(s.id).keepphone);
  list.sort((a, b) => a.name.localeCompare(b.name, 'sv'));
  grid.innerHTML = '';
  const statusLabel = { out: 'Not handed in', late: 'Late / Reception' };
  list.forEach(s => {
    const st = dl[s.id] || 'in';
    const ex = getExtra(s.id);
    const starred = dl[s.id + '_reported'] ? 'reported' : (ex.starred === 'reported' ? null : ex.starred || null);  // _reported per-day only; ignore legacy global 'reported'
    const athome = ex.athome;
    const keepphone = ex.keepphone;
    const d = document.createElement('div');
    // starred overrides chip colour to green; athome adds indigo tint when in
    const unreported = dl[s.id + '_unreported'] || ex.starred === 'unreported' || false;
    d.className = 'chip s-' + (keepphone && st === 'in' ? 'prep' : st);
    d.title = 'Click to toggle not-handed-in';

    // unreported (from paste/day log) takes priority over starred (from extra)
    const effectiveStar = unreported ? 'unreported' : starred;
    const starLabel = effectiveStar === 'reported' ? 'Reported' : effectiveStar === 'unreported' ? 'Unrptd' : '';
    const starEmoji = effectiveStar === 'reported' ? '⭐' : effectiveStar === 'unreported' ? '🔴' : '☆';
    const starColor = effectiveStar === 'reported' ? '#f59e0b' : effectiveStar === 'unreported' ? '#ef4444' : 'var(--text3)';
    const starActive = effectiveStar ? 'active' : '';
    const starIcon = `<button class="chip-icon icon-star${starActive ? ' ' + starActive : ''}" onclick="toggleStar(event,'${s.id}')" title="Reported / Absent" style="display:flex;flex-direction:column;align-items:center;gap:1px">${starEmoji}<span style="font-size:8px;font-weight:600;color:${starColor};line-height:1.2;font-family:DM Sans,sans-serif;margin-top:2px">${starLabel}</span></button>`;
    const houseIcon = `<button class="chip-icon icon-house${athome ? ' active' : ''}" onclick="toggleAtHome(event,'${s.id}')" title="Phone left at home" style="flex-direction:column;align-items:center"><span style="font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">🏠</span><span style="font-size:8px;font-weight:600;color:${athome ? '#6366f1' : 'var(--text3)'};line-height:1.2;font-family:DM Sans,sans-serif;margin-top:2px">At Home</span></button>`;
    const phoneIcon = `<button class="chip-icon icon-phone${keepphone ? ' active' : ''}" onclick="togglePhone(event,'${s.id}')" title="PASS - allowed to keep phone" style="flex-direction:column;align-items:center"><span style="font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif;line-height:1">📱️</span><span style="font-size:8px;font-weight:600;color:${keepphone ? '#0ea5e9' : 'var(--text3)'};line-height:1.2;font-family:DM Sans,sans-serif;margin-top:2px">PASS</span></button>`;
    const clockIcon = `<button class="chip-icon icon-clock${st === 'late' ? ' active' : ''}" onclick="(function(e){e.stopPropagation();setLate('${s.id}');})(event)" title="Late / Reception" style="flex-direction:column;align-items:center"><span style="font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${st === 'late' ? '⏰' : '⏱'}</span><span style="font-size:8px;font-weight:600;color:${st === 'late' ? '#f59e0b' : 'var(--text3)'};line-height:1.2;font-family:DM Sans,sans-serif;margin-top:2px">Late</span></button>`;

    const fname = s.fname || s.name.split(' ')[0];
    const lname = s.lname || s.name.split(' ').slice(1).join(' ');
    d.innerHTML = `
      <div class="chip-inner">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px">
          <div>
            <div style="display:flex;align-items:baseline;gap:7px">
              <div class="chip-fname">${fname}</div>
              <span style="font-size:13px;font-weight:700;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:0.02em;flex-shrink:0">${s.cls}</span>
            </div>
            <div class="chip-lname">${lname}</div>
          </div>
          ${st === 'late' ? renderSlot(s.id) : ''}
          ${st === 'out' ? `<div style="flex-shrink:0"><div class="chip-badge">${statusLabel[st]}</div></div>` : ''}
        </div>
        <div class="chip-icon-row">
          ${starIcon}${houseIcon}${phoneIcon}${clockIcon}
        </div>
      </div>
    `;
    d.onclick = () => cycleStatus(s.id);
    grid.appendChild(d);
  });
}

function showUploadScreen() {
  if (!currentRole) return; // don't show before PIN
  document.getElementById('uploadScreen').style.display = 'flex';
}

function hideUploadScreen() {
  document.getElementById('uploadScreen').style.display = 'none';
}
