// ─── MODALS ────────────────────────────────────────────────

function openLateDrill() {
  const students = loadStudents();
  const dl = getDayLogs(currentDate);
  const extra = loadExtra();
  const lateList = Object.values(students).filter(s => {
    if (!s.active || !inScope(s.cls)) return false;
    if (currentClass !== 'ALL' && s.cls !== currentClass) return false;
    return dl[s.id] === 'late';
  }).sort((a, b) => {
    const slotA = extra[a.id] && extra[a.id].slot ? extra[a.id].slot : 999;
    const slotB = extra[b.id] && extra[b.id].slot ? extra[b.id].slot : 999;
    if (slotA !== slotB) return slotA - slotB;
    return a.cls.localeCompare(b.cls) || (a.name.localeCompare(b.name, 'sv'));
  });

  const byClass = {};
  lateList.forEach(s => {
    const c = s.cls.split(':')[0].trim();
    if (!byClass[c]) byClass[c] = 0;
    byClass[c]++;
  });

  let html = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
    <div style="font-size:16px;font-weight:700">${t('drill.late_title', { date: currentDate })}</div>
    <button onclick="closeDrillModal()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text3)">×</button>
  </div>`;

  if (!lateList.length) {
    html += `<div style="font-size:13px;color:var(--text3);padding:1rem 0">${t('drill.no_late')}</div>`;
  } else {
    html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:6px;margin-bottom:1rem">`;
    Object.entries(byClass).forEach(([c, n]) => {
      html += `<div style="background:var(--amber-bg);border:0.5px solid var(--amber-border);border-radius:8px;padding:8px 10px;text-align:center">
        <div style="font-size:15px;font-weight:700;color:var(--amber-text)">${n}</div>
        <div style="font-size:11px;color:var(--amber-text);font-weight:500">${c}</div>
      </div>`;
    });
    html += `</div>`;

    html += `<div style="font-size:12px;color:var(--text2);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px">${t('drill.students', { n: lateList.length })}</div>`;
    lateList.forEach(s => {
      const ex = extra[s.id] || {};
      const slot = ex.slot ? `<span style="background:var(--amber-border);color:#fff;border-radius:10px;padding:1px 7px;font-size:11px;font-weight:600;margin-left:6px">${t('drill.slot', { n: ex.slot })}</span>` : '';
      html += `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:0.5px solid var(--border);cursor:pointer" onclick="closeDrillModal();openDrill('${s.id}')">
        <div style="flex:1">
          <span style="font-size:13px;font-weight:500">${s.name}</span>${slot}
          <span style="font-size:11px;color:var(--text3);margin-left:6px">${s.cls}</span>
        </div>
        <i class="ti ti-chevron-right" style="color:var(--text3);font-size:14px"></i>
      </div>`;
    });
  }

  document.getElementById('drillContent').innerHTML = html;
  document.getElementById('drillOverlay').classList.add('open');
}

function openDrill(id) {
  const students = loadStudents();
  const s = students[id];
  if (!s) return;
  const logs = loadLogs();
  document.getElementById('drillName').textContent = s.name;
  document.getElementById('drillMeta').textContent = `${s.id} · ${t('drill.class_label')} ${s.cls}`;

  const entries = [];
  Object.entries(logs).forEach(([date, dl]) => { if (dl[id]) entries.push({ date, status: dl[id] }); });
  entries.sort((a, b) => b.date.localeCompare(a.date));

  const outCount  = entries.filter(e => e.status === 'out').length;
  const lateCount = entries.filter(e => e.status === 'late').length;

  const last7 = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); last7.push(d.toISOString().slice(0, 10)); }

  let html = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:1.25rem">
      <div class="stat"><div class="stat-label">${t('drill.not_in')}</div><div class="stat-val" style="color:var(--red-text)">${outCount}</div></div>
      <div class="stat"><div class="stat-label">${t('drill.late')}</div><div class="stat-val" style="color:var(--amber-text)">${lateCount}</div></div>
      <div class="stat"><div class="stat-label">${t('drill.total')}</div><div class="stat-val">${outCount + lateCount}</div></div>
    </div>
    <div style="margin-bottom:1.25rem">
      <div style="font-size:12px;color:var(--text2);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px">${t('drill.last7')}</div>
      <div style="display:flex;gap:5px">`;
  last7.forEach(date => {
    const st = logs[date] ? logs[date][id] || 'ok' : '–';
    const label = date.slice(5);
    const bg     = st === 'out' ? 'var(--red-bg)'    : st === 'late' ? 'var(--amber-bg)'    : 'var(--surface2)';
    const border = st === 'out' ? 'var(--red-border)' : st === 'late' ? 'var(--amber-border)' : 'var(--border)';
    const tc     = st === 'out' ? 'var(--red-text)'  : st === 'late' ? 'var(--amber-text)'  : 'var(--text3)';
    const stLabel = st === 'out' ? 'OUT' : st === 'late' ? 'LATE' : st === 'ok' ? 'OK' : '–';
    html += `<div style="flex:1;text-align:center;padding:6px 4px;border-radius:8px;background:${bg};border:0.5px solid ${border}">
      <div style="font-size:10px;color:${tc};font-family:'DM Mono',monospace">${label}</div>
      <div style="font-size:11px;font-weight:500;color:${tc};margin-top:2px">${stLabel}</div>
    </div>`;
  });
  html += `</div></div>`;

  if (entries.length) {
    html += `<div style="font-size:12px;color:var(--text2);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px">${t('drill.history')}</div>`;
    entries.forEach(e => {
      const badge = e.status === 'out'
        ? `<span class="badge badge-out">${t('drill.badge_out')}</span>`
        : `<span class="badge badge-late">${t('drill.badge_late')}</span>`;
      html += `<div class="log-entry"><span class="log-date">${e.date}</span>${badge}</div>`;
    });
  } else {
    html += `<div style="font-size:13px;color:var(--text3);padding:1rem 0">${t('drill.no_history')}</div>`;
  }

  document.getElementById('drillContent').innerHTML = html;
  document.getElementById('drillOverlay').classList.add('open');
}

function closeDrillModal() { document.getElementById('drillOverlay').classList.remove('open'); }
function closeDrill(e) { if (e.target === document.getElementById('drillOverlay')) closeDrillModal(); }

async function showBackups() {
  if (!SERVER) { showToast(t('backup.failed')); return; }
  document.getElementById('backupModal').style.display = 'flex';
  const list = document.getElementById('backupList');
  list.innerHTML = `<div style="color:var(--text2);font-size:13px">${t('loading.students')}</div>`;
  try {
    const r = await authFetch(`${API}/backups`);
    const files = await r.json();
    if (!files.length) { list.innerHTML = `<div style="color:var(--text2);font-size:13px">${t('backup.hint')}</div>`; return; }
    list.innerHTML = '';
    files.forEach(function(f) {
      const d = new Date(f.time);
      const label = d.toLocaleDateString('sv-SE') + ' ' + d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
      const kb = Math.round((f.size || 0) / 1024 * 10) / 10;
      const isAuto = f.type === 'auto' || f.name.startsWith('daily-');
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--surface2);border-radius:8px;font-size:13px;border-left:3px solid ' + (isAuto ? '#16a34a' : 'var(--border)');
      const info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0';
      info.innerHTML = '<div style="font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + label +
        (isAuto ? ' <span style="font-size:10px;background:#16a34a;color:#fff;padding:2px 6px;border-radius:4px">' + t('backup.auto_badge') + '</span>' : '') +
        '</div><div style="color:var(--text3);font-size:11px">' + kb + ' KB</div>';
      const btns = document.createElement('div');
      btns.style.cssText = 'display:flex;gap:5px;flex-shrink:0';
      const dlBtn = document.createElement('button');
      dlBtn.title = t('backup.download');
      dlBtn.innerHTML = '<i class="ti ti-download"></i>';
      dlBtn.style.cssText = 'padding:5px 8px;background:var(--surface);border:0.5px solid var(--border2);border-radius:6px;cursor:pointer;font-size:13px;color:var(--text2);line-height:1';
      dlBtn.onclick = function() { downloadBackup(f.name); };
      const restoreBtn = document.createElement('button');
      restoreBtn.textContent = t('students.restore');
      restoreBtn.style.cssText = 'padding:5px 12px;background:#8b5cf6;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600';
      restoreBtn.onclick = function() { restoreBackup(f.name); };
      btns.appendChild(dlBtn); btns.appendChild(restoreBtn);
      row.appendChild(info); row.appendChild(btns);
      list.appendChild(row);
    });
  } catch(e) { list.innerHTML = `<div style="color:var(--red-text);font-size:13px">${t('backup.failed')}</div>`; }
}

async function downloadBackup(name) {
  try {
    const r = await authFetch(`${API}/backups?action=download&name=${encodeURIComponent(name)}`);
    if (!r.ok) { showToast(t('backup.failed')); return; }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `lurkollen-backup-${name}.json`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  } catch(e) { showToast(t('backup.failed')); }
}

async function restoreBackup(name) {
  if (!confirm(t('backup.restore_confirm') + '\n' + name)) return;
  try {
    const r = await authFetch(`${API}/backups?action=restore&name=${encodeURIComponent(name)}`, { method: 'POST' });
    const d = await r.json();
    if (d.ok) {
      showToast('✓ ' + name.slice(7, 19));
      document.getElementById('backupModal').style.display = 'none';
      await fetchStudentsFromServer();
      await fetchGuardiansFromServer();
      await fetchExtraFromServer();
      const remote = await serverGet(currentDate);
      if (remote) { const logs = loadLogs(); logs[currentDate] = remote; saveLogs(logs); }
      renderDash(); renderGrid();
    } else { showToast(t('backup.failed')); }
  } catch(e) { showToast(t('backup.failed')); }
}
