// ─── STUDENTS VIEW ─────────────────────────────────────────

let _numTableMode = false;

function toggleNumTable() {
  _numTableMode = !_numTableMode;
  renderStudentList();
}

function renderNumberTable(students) {
  const cfg = getSettings();
  const numLabel = cfg.studentNumLabel || 'Nummer';
  const cls = currentStudentClass || 'ALL';
  const q = document.getElementById('studentSearch').value.trim().toLowerCase();
  let list = Object.values(students).filter(s =>
    s.active &&
    (cls === 'ALL' || s.cls === cls) &&
    (s.name.toLowerCase().includes(q) || s.cls.toLowerCase().includes(q) || String(s.num ?? '').includes(q))
  );
  list.sort((a, b) => a.name.localeCompare(b.name, 'sv'));

  let html = `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="border-bottom:1.5px solid var(--border)">
            <th style="text-align:left;padding:7px 10px;font-weight:600;color:var(--text2);font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Namn</th>
            <th style="text-align:left;padding:7px 10px;font-weight:600;color:var(--text2);font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Klass</th>
            <th style="text-align:left;padding:7px 10px;font-weight:600;color:var(--text2);font-size:11px;text-transform:uppercase;letter-spacing:0.05em">${numLabel}</th>
          </tr>
        </thead>
        <tbody>`;
  list.forEach(s => {
    html += `<tr style="border-bottom:0.5px solid var(--border)">
      <td style="padding:6px 10px;font-weight:500">${s.name}</td>
      <td style="padding:6px 10px;color:var(--text3);font-family:'DM Mono',monospace">${s.cls}</td>
      <td style="padding:6px 10px">
        <input type="number" min="1" max="9999"
          value="${s.num != null ? s.num : ''}"
          placeholder="—"
          onclick="event.stopPropagation()"
          onblur="setStudentNum('${s.id}', this.value)"
          onkeydown="if(event.key==='Enter')this.blur()"
          style="width:72px;height:26px;padding:0 6px;font-size:12px;font-family:'DM Mono',monospace;border:0.5px solid var(--border2);border-radius:5px;background:var(--surface);color:var(--text);text-align:center">
      </td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  return html;
}

function renderStudentList() {
  const tabBar = document.getElementById('studentClassTabs');
  if (tabBar && tabBar.children.length === 0) {
    ['ALL', ...CLASSES].forEach(c => {
      const b = document.createElement('button');
      b.className = 'tab' + (c === currentStudentClass ? ' active' : '');
      b.textContent = c;
      b.onclick = () => { currentStudentClass = c; renderStudentList(); };
      tabBar.appendChild(b);
    });
  } else if (tabBar) {
    Array.from(tabBar.children).forEach(b => b.classList.toggle('active', b.textContent === currentStudentClass));
  }
  const students = loadStudents();
  const active = Object.values(students).filter(s => s.active);
  const content = document.getElementById('studentListContent');

  if (!active.length) {
    content.innerHTML = `<div style="text-align:center;padding:3rem 1rem">
      <i class="ti ti-users-off" style="font-size:36px;color:var(--text3);display:block;margin-bottom:12px"></i>
      <div style="font-size:15px;font-weight:500;margin-bottom:6px">${t('students.no_students')}</div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:1.25rem">${t('students.no_students_sub')}</div>
      <label class="btn" style="cursor:pointer;display:inline-flex"><i class="ti ti-upload"></i>${t('students.upload_btn')}<input type="file" accept=".csv" style="display:none" onchange="handleCSVUpload(this)"></label>
    </div>`;
    return;
  }

  // ── Number-table toggle button (injected into toolbar) ────
  const addBtn = document.getElementById('addStudentBtn');
  if (addBtn && !document.getElementById('numTableToggleBtn')) {
    const tb = document.createElement('button');
    tb.id = 'numTableToggleBtn';
    tb.className = 'btn' + (_numTableMode ? ' active' : '');
    tb.innerHTML = '<i class="ti ti-list-numbers"></i> Nummer';
    tb.onclick = toggleNumTable;
    addBtn.parentNode.insertBefore(tb, addBtn);
  } else if (document.getElementById('numTableToggleBtn')) {
    document.getElementById('numTableToggleBtn').className = 'btn' + (_numTableMode ? ' active' : '');
  }

  // ── Number table mode ─────────────────────────────────────
  if (_numTableMode) {
    content.innerHTML = renderNumberTable(students);
    return;
  }

  const q = document.getElementById('studentSearch').value.trim().toLowerCase();
  const cls = currentStudentClass || 'ALL';
  let list = Object.values(students).filter(s => (cls === 'ALL' || s.cls === cls) && (s.name.toLowerCase().includes(q) || s.cls.toLowerCase().includes(q) || String(s.num ?? '').includes(q)));
  list.sort((a, b) => a.name.localeCompare(b.name, 'sv'));
  const logs = loadLogs();

  const cfg = getSettings();
  const numLabel = cfg.studentNumLabel || 'Nr';

  const visibleActive = list.filter(s => s.active);
  const visibleInactive = list.filter(s => !s.active);

  let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px">';
  visibleActive.forEach(s => {
    const incidents = Object.values(logs).filter(dl => dl[s.id]).length;
    const incidentText = incidents > 0
      ? `<div style="font-size:11px;color:var(--red-text);margin-top:3px">${t(incidents > 1 ? 'students.incidents_pl' : 'students.incidents', { n: incidents })}</div>`
      : '';
    html += `<div style="background:var(--surface);border:0.5px solid var(--border);border-radius:var(--radius-lg);padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:8px">
      <div style="flex:1;min-width:0;cursor:pointer" onclick="openDrill('${s.id}')">
        <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.name}</div>
        <div style="font-size:11px;color:var(--text3);font-family:'DM Mono',monospace">${s.id} · ${s.cls}</div>
        ${incidentText}
      </div>
      <div style="display:flex;align-items:center;gap:5px;flex-shrink:0">
        <input type="number" min="1" max="9999"
          value="${s.num != null ? s.num : ''}"
          placeholder="${numLabel}"
          title="${numLabel}"
          onclick="event.stopPropagation()"
          onblur="setStudentNum('${s.id}', this.value)"
          onkeydown="if(event.key==='Enter')this.blur()"
          style="width:52px;height:26px;padding:0 5px;font-size:11px;font-family:'DM Mono',monospace;border:0.5px solid var(--border2);border-radius:5px;background:var(--surface2);color:var(--text);text-align:center">
        <button class="btn" style="height:28px;padding:0 8px;font-size:12px" title="${t('edit.title')}" onclick="openEditStudent('${s.id}')"><i class="ti ti-edit"></i></button>
        <button class="btn" style="height:28px;padding:0 8px;font-size:12px" onclick="openDrill('${s.id}')"><i class="ti ti-chart-line"></i></button>
        <button class="btn danger" style="height:28px;padding:0 8px;font-size:12px" onclick="removeStudent('${s.id}')"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
  });
  html += '</div>';

  if (visibleInactive.length) {
    html += `<div style="margin-top:1.5rem;margin-bottom:0.5rem;font-size:12px;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em">${t('students.removed')}</div>`;
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px">';
    visibleInactive.forEach(s => {
      html += `<div style="background:var(--surface2);border:0.5px solid var(--border);border-radius:var(--radius-lg);padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:8px;opacity:0.6">
        <div>
          <div style="font-size:13px;font-weight:500;text-decoration:line-through">${s.name}</div>
          <div style="font-size:11px;color:var(--text3);font-family:'DM Mono',monospace">${s.id} · ${s.cls}${s.num != null ? ' · #' + s.num : ''}</div>
        </div>
        <button class="btn" style="height:28px;padding:0 8px;font-size:12px" onclick="reactivateStudent('${s.id}')">${t('students.restore')}</button>
      </div>`;
    });
    html += '</div>';
  }
  content.innerHTML = html;
}
