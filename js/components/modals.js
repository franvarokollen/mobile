// ─── MODALS ────────────────────────────────────────────────

function openLateDrill() {
  const students = loadStudents();
  const dl = getDayLogs(currentDate);
  const extra = loadExtra();
  // Filter to late students in current class filter
  const lateList = Object.values(students).filter(s => {
    if (!s.active || !inScope(s.cls)) return false;
    if (currentClass !== 'ALL' && s.cls !== currentClass) return false;
    return dl[s.id] === 'late';
  }).sort((a, b) => {
    // Sort by slot number first, then class, then name
    const slotA = extra[a.id] && extra[a.id].slot ? extra[a.id].slot : 999;
    const slotB = extra[b.id] && extra[b.id].slot ? extra[b.id].slot : 999;
    if (slotA !== slotB) return slotA - slotB;
    return a.cls.localeCompare(b.cls) || (a.name.localeCompare(b.name, 'sv'));
  });

  // Class breakdown
  const byClass = {};
  lateList.forEach(s => {
    const c = s.cls.split(':')[0].trim();
    if (!byClass[c]) byClass[c] = 0;
    byClass[c]++;
  });

  let html = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
    <div style="font-size:16px;font-weight:700">⏰ Late / Reception — ${currentDate}</div>
    <button onclick="closeDrillModal()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text3)">×</button>
  </div>`;

  if (!lateList.length) {
    html += `<div style="font-size:13px;color:var(--text3);padding:1rem 0">No late students recorded.</div>`;
  } else {
    // Summary stats
    html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:6px;margin-bottom:1rem">`;
    Object.entries(byClass).forEach(([c, n]) => {
      html += `<div style="background:var(--amber-bg);border:0.5px solid var(--amber-border);border-radius:8px;padding:8px 10px;text-align:center">
        <div style="font-size:15px;font-weight:700;color:var(--amber-text)">${n}</div>
        <div style="font-size:11px;color:var(--amber-text);font-weight:500">${c}</div>
      </div>`;
    });
    html += `</div>`;

    // Student list
    html += `<div style="font-size:12px;color:var(--text2);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px">Students (${lateList.length})</div>`;
    lateList.forEach(s => {
      const ex = extra[s.id] || {};
      const slot = ex.slot ? `<span style="background:var(--amber-border);color:#fff;border-radius:10px;padding:1px 7px;font-size:11px;font-weight:600;margin-left:6px">Slot ${ex.slot}</span>` : '';
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
  document.getElementById('drillMeta').textContent = `${s.id} · Class ${s.cls}`;

  // collect all log entries for this student
  const entries = [];
  Object.entries(logs).forEach(([date, dl]) => { if (dl[id]) entries.push({ date, status: dl[id] }); });
  entries.sort((a, b) => b.date.localeCompare(a.date));

  const outCount = entries.filter(e => e.status === 'out').length;
  const lateCount = entries.filter(e => e.status === 'late').length;
  const totalDays = Object.keys(logs).length;

  // last 7 days streak
  const last7 = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); last7.push(d.toISOString().slice(0, 10)); }

  let html = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:1.25rem">
      <div class="stat"><div class="stat-label">Not in</div><div class="stat-val" style="color:var(--red-text)">${outCount}</div></div>
      <div class="stat"><div class="stat-label">Late</div><div class="stat-val" style="color:var(--amber-text)">${lateCount}</div></div>
      <div class="stat"><div class="stat-label">Total incidents</div><div class="stat-val">${outCount + lateCount}</div></div>
    </div>
    <div style="margin-bottom:1.25rem">
      <div style="font-size:12px;color:var(--text2);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px">Last 7 days</div>
      <div style="display:flex;gap:5px">`;
  last7.forEach(date => {
    const st = logs[date] ? logs[date][id] || 'ok' : '–';
    const label = date.slice(5);
    const bg = st === 'out' ? 'var(--red-bg)' : st === 'late' ? 'var(--amber-bg)' : 'var(--surface2)';
    const border = st === 'out' ? 'var(--red-border)' : st === 'late' ? 'var(--amber-border)' : 'var(--border)';
    const tc = st === 'out' ? 'var(--red-text)' : st === 'late' ? 'var(--amber-text)' : 'var(--text3)';
    html += `<div style="flex:1;text-align:center;padding:6px 4px;border-radius:8px;background:${bg};border:0.5px solid ${border}">
      <div style="font-size:10px;color:${tc};font-family:'DM Mono',monospace">${label}</div>
      <div style="font-size:11px;font-weight:500;color:${tc};margin-top:2px">${st === 'out' ? 'OUT' : st === 'late' ? 'LATE' : st === 'ok' ? 'OK' : '–'}</div>
    </div>`;
  });
  html += `</div></div>`;

  if (entries.length) {
    html += `<div style="font-size:12px;color:var(--text2);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px">Full history</div>`;
    entries.forEach(e => {
      const badge = e.status === 'out' ? '<span class="badge badge-out">Not handed in</span>' : '<span class="badge badge-late">Late / Reception</span>';
      html += `<div class="log-entry"><span class="log-date">${e.date}</span>${badge}</div>`;
    });
  } else {
    html += `<div style="font-size:13px;color:var(--text3);padding:1rem 0">No incidents recorded for this student.</div>`;
  }

  document.getElementById('drillContent').innerHTML = html;
  document.getElementById('drillOverlay').classList.add('open');
}

function closeDrillModal() { document.getElementById('drillOverlay').classList.remove('open'); }
function closeDrill(e) { if (e.target === document.getElementById('drillOverlay')) closeDrillModal(); }

async function showBackups() {
  if (!SERVER) { showToast('No server connected'); return; }
  document.getElementById('backupModal').style.display = 'flex';
  const list = document.getElementById('backupList');
  list.innerHTML = '<div style="color:var(--text2);font-size:13px">Loading...</div>';
  try {
    const r = await fetch(SERVER + '/backups');
    const files = await r.json();
    if (!files.length) { list.innerHTML = '<div style="color:var(--text2);font-size:13px">No backups found</div>'; return; }
    list.innerHTML = '';
    files.forEach(function(f) {
      const d = new Date(f.time);
      const label = d.toLocaleDateString('sv-SE') + ' ' + d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
      const kb = Math.round(f.size / 1024 * 10) / 10;
      const isDaily = f.name.startsWith('daily-');
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--surface2);border-radius:8px;font-size:13px;border-left:3px solid ' + (isDaily ? '#16a34a' : 'var(--border)');
      const info = document.createElement('div');
      info.innerHTML = '<div style="font-weight:500;color:var(--text)">' + label + (isDaily ? ' <span style="font-size:10px;background:#16a34a;color:#fff;padding:2px 6px;border-radius:4px">DAILY</span>' : '') + '</div><div style="color:var(--text3);font-size:11px">' + kb + 'KB</div>';
      const btn = document.createElement('button');
      btn.textContent = 'Restore';
      btn.style.cssText = 'padding:5px 12px;background:#8b5cf6;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600';
      btn.onclick = function() { restoreBackup(f.name); };
      row.appendChild(info); row.appendChild(btn);
      list.appendChild(row);
    });
  } catch(e) { list.innerHTML = '<div style="color:var(--red-text);font-size:13px">Failed to load backups</div>'; }
}

async function restoreBackup(name) {
  if (!confirm('Restore backup ' + name + '? This will overwrite all current data.')) return;
  try {
    const r = await fetch(SERVER + '/backups/restore/' + name, { method: 'POST' });
    const d = await r.json();
    if (d.ok) {
      showToast('✓ Restored from ' + name.slice(7, 19));
      document.getElementById('backupModal').style.display = 'none';
      // Reload all local data from server
      await fetchStudentsFromServer();
      await fetchGuardiansFromServer();
      await fetchExtraFromServer();
      const remote = await serverGet(currentDate);
      if (remote) { const logs = loadLogs(); logs[currentDate] = remote; saveLogs(logs); }
      renderDash(); renderGrid();
    }
  } catch(e) { showToast('Restore failed'); }
}
