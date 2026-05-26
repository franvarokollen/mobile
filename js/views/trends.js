// ─── TRENDS VIEW ───────────────────────────────────────────

function setTrendPeriod(p) {
  trendPeriod = p;
  ['today', 'week', 'month', 'all'].forEach(function(x) {
    var btn = document.getElementById('trendPeriod' + x.charAt(0).toUpperCase() + x.slice(1));
    if (btn) btn.classList.toggle('active', x === p);
  });
  renderTrendContent();
}

function getTrendDates() {
  var logs = loadLogs();
  var allDates = Object.keys(logs).sort();
  if (trendPeriod === 'today') return [todayKey()];
  if (trendPeriod === 'week') {
    var week = [];
    for (var i = 6; i >= 0; i--) { var d = new Date(); d.setDate(d.getDate() - i); week.push(d.toISOString().slice(0, 10)); }
    return week;
  }
  if (trendPeriod === 'month') {
    var month = [];
    for (var i = 29; i >= 0; i--) { var d = new Date(); d.setDate(d.getDate() - i); month.push(d.toISOString().slice(0, 10)); }
    return month;
  }
  return allDates; // all time
}

function renderTrends() {
  const bar = document.getElementById('trendClassSelect');
  if (!bar) return;
  bar.innerHTML = '';
  ['ALL', ...CLASSES].forEach(c => {
    const b = document.createElement('button');
    b.className = 'tab' + (c === trendClass ? ' active' : '');
    b.textContent = c;
    b.onclick = () => { trendClass = c; renderTrendContent(); };
    bar.appendChild(b);
  });
  renderTrendContent();
}

function renderTrendContent() {
  const students = loadStudents();
  const logs = loadLogs();
  const trendDates = getTrendDates();

  // per-class summary
  const classStats = {};
  CLASSES.forEach(c => { classStats[c] = { out: 0, late: 0, days: new Set() }; });
  trendDates.forEach(date => {
    const dl = logs[date] || {};
    Object.entries(dl).forEach(([id, st]) => {
      const s = students[id];
      if (!s || !s.active) return;
      if (!classStats[s.cls]) return;
      classStats[s.cls][st] = (classStats[s.cls][st] || 0) + 1;
      classStats[s.cls].days.add(date);
    });
  });

  // top offenders for selected period
  const studentTotals = Object.values(students).filter(s => s.active && (trendClass === 'ALL' || s.cls === trendClass)).map(s => {
    const total = trendDates.filter(date => logs[date] && logs[date][s.id]).length;
    const out = trendDates.filter(date => logs[date] && logs[date][s.id] === 'out').length;
    const late = trendDates.filter(date => logs[date] && logs[date][s.id] === 'late').length;
    return { ...s, total, out, late };
  }).filter(s => s.total > 0).sort((a, b) => b.total - a.total).slice(0, 20);

  const maxTotal = studentTotals.length ? studentTotals[0].total : 1;

  // Period totals
  const periodStudents = Object.values(students).filter(s => s.active && inScope(s.cls) && (trendClass === 'ALL' || s.cls === trendClass));
  const totalOut = trendDates.reduce((n, date) => { const dl = logs[date] || {}; return n + periodStudents.filter(s => dl[s.id] === 'out').length; }, 0);
  const totalLate = trendDates.reduce((n, date) => { const dl = logs[date] || {}; return n + periodStudents.filter(s => dl[s.id] === 'late').length; }, 0);
  const uniqueOut = new Set(trendDates.flatMap(date => { const dl = logs[date] || {}; return periodStudents.filter(s => dl[s.id] === 'out').map(s => s.id); })).size;
  const uniqueLate = new Set(trendDates.flatMap(date => { const dl = logs[date] || {}; return periodStudents.filter(s => dl[s.id] === 'late').map(s => s.id); })).size;
  const periodLabel = trendPeriod === 'today' ? 'Today' : trendPeriod === 'week' ? 'This week' : trendPeriod === 'month' ? 'Last 30 days' : 'All time';

  let html = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:1.25rem">
    <div class="stat"><div class="stat-label">Not handed in</div><div class="stat-val" style="color:var(--red-text)">${totalOut}</div><div style="font-size:11px;color:var(--text3);margin-top:4px">${uniqueOut} unique students</div></div>
    <div class="stat"><div class="stat-label">Late / Reception</div><div class="stat-val" style="color:var(--amber-text)">${totalLate}</div><div style="font-size:11px;color:var(--text3);margin-top:4px">${uniqueLate} unique students</div></div>
    <div class="stat"><div class="stat-label">Total incidents</div><div class="stat-val">${totalOut + totalLate}</div><div style="font-size:11px;color:var(--text3);margin-top:4px">${periodLabel}</div></div>
  </div>`;

  // daily trend for selected period
  const dailyCounts = trendDates.map(date => {
    const dl = logs[date] || {};
    const entries = Object.entries(dl).filter(([id]) => {
      const s = students[id];
      return s && s.active && (trendClass === 'ALL' || s.cls === trendClass);
    });
    return { date, out: entries.filter(([, st]) => st === 'out').length, late: entries.filter(([, st]) => st === 'late').length };
  });
  const maxDay = Math.max(1, ...dailyCounts.map(d => d.out + d.late));

  // class overview cards (only on ALL)
  if (trendClass === 'ALL') {
    html += `<div style="font-size:12px;color:var(--text2);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:10px">Class overview · ${trendPeriod === "today" ? "Today" : trendPeriod === "week" ? "This week" : trendPeriod === "month" ? "Last 30 days" : "All time"}</div>`;
    html += `<div class="class-grid">`;
    CLASSES.forEach(c => {
      const cs = classStats[c];
      const total = (cs.out || 0) + (cs.late || 0);
      html += `<div class="class-card" onclick="trendClass='${c}';renderTrends()">
        <div class="class-card-name">${c}</div>
        <div class="class-mini-stats">
          <span class="mini-badge" style="background:var(--red-bg);color:var(--red-text)">${cs.out || 0} out</span>
          <span class="mini-badge" style="background:var(--amber-bg);color:var(--amber-text)">${cs.late || 0} late</span>
        </div>
      </div>`;
    });
    html += `</div>`;
  }

  // daily trend bars — only show if more than 1 day
  if (trendDates.length > 1) {
    const periodLabel = trendPeriod === 'week' ? 'This week' : trendPeriod === 'month' ? 'Last 30 days' : 'All time';
    html += `<div style="font-size:12px;color:var(--text2);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:10px;margin-top:1.25rem">Daily incidents · ${periodLabel}${trendClass !== 'ALL' ? ' · ' + trendClass : ''}</div>`;
    html += `<div style="display:flex;align-items:flex-end;gap:3px;height:80px;margin-bottom:1.5rem">`;
    dailyCounts.forEach(d => {
      const h = maxDay > 0 ? Math.round(((d.out + d.late) / maxDay) * 70) : 0;
      const hOut = maxDay > 0 ? Math.round((d.out / maxDay) * 70) : 0;
      const hLate = h - hOut;
      const label = trendDates.length <= 14 ? d.date.slice(5) : '';
      html += `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px" title="${d.date}: ${d.out} not in, ${d.late} late">
        <div style="width:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:70px;gap:1px">
          ${hOut > 0 ? `<div style="width:100%;height:${hOut}px;background:var(--red-border);border-radius:3px 3px 0 0"></div>` : ''}
          ${hLate > 0 ? `<div style="width:100%;height:${hLate}px;background:var(--amber-border);border-radius:${hOut > 0 ? '0' : '3px 3px 0 0'} 0 0"></div>` : ''}
          ${h === 0 ? `<div style="width:100%;height:3px;background:var(--surface3);border-radius:3px"></div>` : ''}
        </div>
        ${label ? `<div style="font-size:9px;color:var(--text3);font-family:'DM Mono',monospace;white-space:nowrap">${label}</div>` : ''}
      </div>`;
    });
    html += `</div>`;
  }

  // repeat offenders
  if (studentTotals.length) {
    html += `<div style="font-size:12px;color:var(--text2);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:10px">Top repeat offenders${trendClass !== 'ALL' ? ' · ' + trendClass : ''}</div>`;
    studentTotals.forEach(s => {
      const pct = Math.round((s.total / maxTotal) * 100);
      html += `<div class="trend-row" style="cursor:pointer" onclick="openDrill('${s.id}')">
        <div class="trend-name">${s.name} <span style="font-size:11px;color:var(--text3)">${s.cls}</span></div>
        <div style="display:flex;gap:5px;margin-right:6px">
          <span class="badge badge-out">${s.out}</span>
          <span class="badge badge-late">${s.late}</span>
        </div>
        <div class="trend-bar-wrap"><div class="trend-bar" style="width:${pct}%"></div></div>
        <div class="trend-count">${s.total}</div>
      </div>`;
    });
  } else {
    html += `<div style="font-size:13px;color:var(--text3);padding:1rem 0">No incidents recorded yet.</div>`;
  }

  // Late / Reception section
  const lateTotals = Object.values(students).filter(s => s.active && (trendClass === 'ALL' || s.cls === trendClass)).map(s => {
    const late = trendDates.filter(date => logs[date] && logs[date][s.id] === 'late').length;
    return { ...s, late };
  }).filter(s => s.late > 0).sort((a, b) => b.late - a.late);

  if (lateTotals.length) {
    const maxLate = lateTotals[0].late;
    html += `<div style="font-size:12px;color:var(--text2);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:10px;margin-top:1.5rem">Late / Reception${trendClass !== 'ALL' ? ' · ' + trendClass : ''}</div>`;
    lateTotals.forEach(s => {
      const pct = Math.round((s.late / maxLate) * 100);
      html += `<div class="trend-row" style="cursor:pointer" onclick="openDrill('${s.id}')">
        <div class="trend-name">${s.name} <span style="font-size:11px;color:var(--text3)">${s.cls}</span></div>
        <div style="margin-right:6px">
          <span class="badge badge-late">${s.late}×</span>
        </div>
        <div class="trend-bar-wrap"><div class="trend-bar" style="width:${pct}%;background:var(--amber-border)"></div></div>
        <div class="trend-count">${s.late}</div>
      </div>`;
    });
  }

  document.getElementById('trendsContent').innerHTML = html;
}
