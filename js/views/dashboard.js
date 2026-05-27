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
      const st = getStatuses().find(s => s.key === f);
      if (st) {
        lbl.textContent = t('dash.filter_showing', { label: st.label });
        lbl.style.color = st.color;
      } else if (f === 'ok') {
        lbl.textContent = t('dash.filter_ok');
        lbl.style.color = 'var(--text)';
      } else {
        lbl.textContent = f;
        lbl.style.color = 'var(--text)';
      }
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
  const statuses = getStatuses();
  const statusCounts = {};
  statuses.forEach(st => { statusCounts[st.key] = list.filter(s => dl[s.id] === st.key).length; });
  const totalWithStatus = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const ok = total - totalWithStatus;

  const statStyle = 'cursor:pointer;transition:box-shadow 0.15s;';
  const activeStyle = 'box-shadow:0 0 0 2px var(--text);';
  const sr = document.getElementById('statsRow'); if (!sr) return;

  let html = `<div class="stat" style="${statStyle}${statusFilter==='ALL'?activeStyle:''}" onclick="setStatusFilter('ALL')"><div class="stat-label">${t('dash.total')}</div><div class="stat-val">${total}</div></div>`;
  statuses.forEach(st => {
    html += `<div class="stat" style="${statStyle}${statusFilter===st.key?activeStyle:''}" onclick="setStatusFilter('${st.key}')">
      <div class="stat-label">${st.label}</div>
      <div class="stat-val" style="color:${st.color}">${statusCounts[st.key]}</div>
    </div>`;
  });
  html += `<div class="stat" style="${statStyle}${statusFilter==='ok'?activeStyle:''}" onclick="setStatusFilter('ok')"><div class="stat-label">${t('dash.handed_in')}</div><div class="stat-val" style="color:var(--green-text)">${ok}</div></div>`;
  sr.innerHTML = html;
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
  const exemptBtn = document.getElementById('exemptClassBtn');
  if (exemptBtn) exemptBtn.style.display = currentClass !== 'ALL' ? '' : 'none';
}

function renderGrid() {
  const students = loadStudents();
  const dl = getDayLogs(currentDate);
  const q = document.getElementById('scanInput').value.trim().toLowerCase();
  const grid = document.getElementById('studentGrid');

  if (!Object.values(students).some(s => s.active)) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem 1rem">
      <i class="ti ti-users-off" style="font-size:36px;color:var(--text3);display:block;margin-bottom:12px"></i>
      <div style="font-size:15px;font-weight:500;margin-bottom:6px">${t('dash.no_students')}</div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:1.25rem">${t('dash.no_students_sub')}</div>
      <button class="btn" onclick="switchView('students')"><i class="ti ti-arrow-right"></i>${t('dash.go_to_students')}</button>
    </div>`;
    return;
  }

  let list = Object.values(students).filter(s => s.active && inScope(s.cls) && (currentClass === 'ALL' || s.cls === currentClass));
  if (q) list = list.filter(s => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
  // Apply status filter — supports any custom status key
  if (statusFilter === 'ok') {
    list = list.filter(s => (!dl[s.id] || dl[s.id] === 'in') && !getExtra(s.id).keepphone);
  } else if (statusFilter !== 'ALL') {
    list = list.filter(s => dl[s.id] === statusFilter);
  }
  list.sort((a, b) => a.name.localeCompare(b.name, 'sv'));
  grid.innerHTML = '';
  const statuses = getStatuses();
  const flags = getFlags();

  list.forEach(s => {
    const st = dl[s.id] || 'in';
    const ex = getExtra(s.id);

    const statusConfig = statuses.find(x => x.key === st);
    const d = document.createElement('div');

    if (statusConfig) {
      d.className = 'chip';
      d.style.background = statusConfig.color + '18';
      d.style.borderColor = statusConfig.color + '60';
    } else if (ex.keepphone && st === 'in') {
      d.className = 'chip s-prep';
    } else {
      d.className = 'chip s-' + st;
    }
    d.title = t('dash.click_cycle');

    const flagIcons = flags.map(fl => {
      const isActive = ex[fl.key] || false;
      const color = isActive ? fl.activeColor : 'var(--text3)';
      const shortLabel = fl.label.length > 8 ? fl.label.slice(0, 7) + '…' : fl.label;
      return `<button class="chip-icon${isActive ? ' active' : ''}" onclick="(function(e){e.stopPropagation();toggleFlag(e,'${s.id}','${fl.key}');})(event)" title="${fl.label}" style="flex-direction:column;align-items:center">
        <span style="font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${fl.emoji}</span>
        <span style="font-size:8px;font-weight:600;color:${color};line-height:1.2;font-family:DM Sans,sans-serif;margin-top:2px">${shortLabel}</span>
      </button>`;
    }).join('');

    const badge = statusConfig ? `<div style="flex-shrink:0"><div class="chip-badge" style="background:${statusConfig.color}20;color:${statusConfig.color};border-color:${statusConfig.color}40">${statusConfig.label}</div></div>` : '';

    const secondStatus = statuses[1];
    const slotOrQuick = secondStatus && st !== secondStatus.key
      ? `<button class="chip-icon" onclick="(function(e){e.stopPropagation();setStatus('${s.id}','${secondStatus.key}');})(event)" title="${secondStatus.label}" style="flex-shrink:0;padding:2px 6px;font-size:11px;border-radius:6px;border:0.5px solid var(--border2);background:var(--surface2);color:var(--text2);cursor:pointer">${secondStatus.label}</button>`
      : (st === (secondStatus?.key) ? renderSlot(s.id) : '');

    const fname = s.fname || s.name.split(' ')[0];
    const lname = s.lname || s.name.split(' ').slice(1).join(' ');
    const noteHtml = ex.note ? `<div class="chip-meta" style="margin-top:3px">${escHtml(ex.note).slice(0, 40)}</div>` : '';
    d.innerHTML = `
      <div class="chip-inner">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px">
          <div>
            <div style="display:flex;align-items:baseline;gap:7px">
              <div class="chip-fname">${fname}</div>
              <span style="font-size:13px;font-weight:700;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:0.02em;flex-shrink:0">${s.cls}</span>
            </div>
            <div class="chip-lname">${lname}</div>
            ${noteHtml}
          </div>
          ${badge}${slotOrQuick}
        </div>
        <div class="chip-icon-row">${flagIcons}</div>
      </div>`;
    d.onclick = () => cycleStatus(s.id);
    grid.appendChild(d);
  });
}

function showUploadScreen() {
  document.getElementById('uploadScreen').style.display = 'flex';
}

function hideUploadScreen() {
  document.getElementById('uploadScreen').style.display = 'none';
}
