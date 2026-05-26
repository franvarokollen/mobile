// ─── STUDENTS VIEW ─────────────────────────────────────────

function renderStudentList() {
  // Build class chips if not yet built
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
      <div style="font-size:15px;font-weight:500;margin-bottom:6px">No students loaded</div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:1.25rem">Upload a CSV to get started</div>
      <label class="btn" style="cursor:pointer;display:inline-flex"><i class="ti ti-upload"></i>Upload students CSV<input type="file" accept=".csv" style="display:none" onchange="handleCSVUpload(this)"></label>
    </div>`;
    return;
  }

  const q = document.getElementById('studentSearch').value.trim().toLowerCase();
  const cls = currentStudentClass || 'ALL';
  let list = Object.values(students).filter(s => (cls === 'ALL' || s.cls === cls) && (s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)));
  list.sort((a, b) => a.name.localeCompare(b.name, 'sv'));
  const logs = loadLogs();

  const visibleActive = list.filter(s => s.active);
  const visibleInactive = list.filter(s => !s.active);

  let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px">';
  visibleActive.forEach(s => {
    const incidents = Object.values(logs).filter(dl => dl[s.id]).length;
    html += `<div style="background:var(--surface);border:0.5px solid var(--border);border-radius:var(--radius-lg);padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:8px">
      <div style="flex:1;min-width:0;cursor:pointer" onclick="openDrill('${s.id}')">
        <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.name}</div>
        <div style="font-size:11px;color:var(--text3);font-family:'DM Mono',monospace">${s.id} · ${s.cls}</div>
        ${incidents > 0 ? `<div style="font-size:11px;color:var(--red-text);margin-top:3px">${incidents} incident${incidents > 1 ? 's' : ''}</div>` : ''}
      </div>
      <div style="display:flex;gap:5px;flex-shrink:0">
        <button class="btn" style="height:28px;padding:0 8px;font-size:12px" title="Edit student" onclick="openEditStudent('${s.id}')"><i class="ti ti-edit"></i></button>
        <button class="btn" style="height:28px;padding:0 8px;font-size:12px" onclick="openDrill('${s.id}')"><i class="ti ti-chart-line"></i></button>
        <button class="btn danger" style="height:28px;padding:0 8px;font-size:12px" onclick="removeStudent('${s.id}')"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
  });
  html += '</div>';

  if (visibleInactive.length) {
    html += `<div style="margin-top:1.5rem;margin-bottom:0.5rem;font-size:12px;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em">Removed students</div>`;
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px">';
    visibleInactive.forEach(s => {
      html += `<div style="background:var(--surface2);border:0.5px solid var(--border);border-radius:var(--radius-lg);padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:8px;opacity:0.6">
        <div>
          <div style="font-size:13px;font-weight:500;text-decoration:line-through">${s.name}</div>
          <div style="font-size:11px;color:var(--text3);font-family:'DM Mono',monospace">${s.id} · ${s.cls}</div>
        </div>
        <button class="btn" style="height:28px;padding:0 8px;font-size:12px" onclick="reactivateStudent('${s.id}')">Restore</button>
      </div>`;
    });
    html += '</div>';
  }
  content.innerHTML = html;
}
