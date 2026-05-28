// ─── TRENDS VIEW ────────────────────────────────────────────

function setTrendPeriod(p) {
  trendPeriod = p;
  ['today','week','month','all'].forEach(x => {
    const btn = document.getElementById('trendPeriod' + x.charAt(0).toUpperCase() + x.slice(1));
    if (btn) btn.classList.toggle('active', x === p);
  });
  renderTrendContent();
}

function getTrendDates() {
  const logs = loadLogs();
  const allDates = Object.keys(logs).sort();
  if (trendPeriod === 'today') return [todayKey()];
  if (trendPeriod === 'week') {
    return Array.from({length:7}, (_,i) => {
      const d = new Date(); d.setDate(d.getDate() - 6 + i);
      return d.toISOString().slice(0,10);
    });
  }
  if (trendPeriod === 'month') {
    return Array.from({length:30}, (_,i) => {
      const d = new Date(); d.setDate(d.getDate() - 29 + i);
      return d.toISOString().slice(0,10);
    });
  }
  return allDates;
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
  const container = document.getElementById('trendsContent');
  if (!container) return;

  const students  = loadStudents();
  const logs      = loadLogs();
  const dates     = getTrendDates();
  const statuses  = getStatuses();

  const scoped = Object.values(students).filter(s =>
    s.active && inScope(s.cls) && (trendClass === 'ALL' || s.cls === trendClass)
  );

  if (!scoped.length) {
    container.innerHTML = `<div style="text-align:center;padding:4rem 1rem;color:var(--text3);font-size:13px">${t('trends.no_data')}</div>`;
    return;
  }

  // ── Daily rollup ──────────────────────────────────────────
  const daily = dates.map(date => {
    const dl = logs[date] || {};
    const row = { date, total: 0 };
    statuses.forEach(st => {
      row[st.key] = scoped.filter(s => dl[s.id] === st.key).length;
      row.total += row[st.key];
    });
    return row;
  });

  const activeDays = daily.filter(d => d.total > 0);
  const totalIncidents = daily.reduce((n, d) => n + d.total, 0);

  // Compliance
  const possible = scoped.length * Math.max(1, activeDays.length);
  const compliance = (possible > 0 && activeDays.length > 0)
    ? Math.round((1 - totalIncidents / possible) * 100)
    : 100;

  // Per-student
  const stuMap = {};
  dates.forEach(date => {
    const dl = logs[date] || {};
    scoped.forEach(s => {
      const status = dl[s.id];
      if (!status) return;
      if (!stuMap[s.id]) { stuMap[s.id] = { student: s, total: 0 }; statuses.forEach(st => { stuMap[s.id][st.key] = 0; }); }
      stuMap[s.id].total++;
      if (stuMap[s.id][status] !== undefined) stuMap[s.id][status]++;
    });
  });
  const stuList = Object.values(stuMap).sort((a, b) => b.total - a.total);

  // Day-of-week
  const dow = [0,0,0,0,0,0,0];
  daily.forEach(d => { dow[new Date(d.date + 'T12:00:00').getDay()] += d.total; });
  const dowMax = Math.max(1, ...dow.slice(1,6));

  // ── Layout ────────────────────────────────────────────────
  let html = '';

  // ① KPI cards
  html += _kpiRow(scoped, statuses, daily, dates, logs, compliance, activeDays, stuList, totalIncidents);

  // ② Area chart
  if (dates.length > 1) {
    html += `<div style="background:var(--surface);border:0.5px solid var(--border);border-radius:var(--radius-lg);padding:20px 20px 14px;margin-bottom:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <span style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em">${t('trends.daily_overview') || 'Daglig översikt'}</span>
        <div style="display:flex;gap:14px">${statuses.map(st =>
          `<span style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--text3)">
            <span style="width:20px;height:2px;background:${st.color};border-radius:2px;display:inline-block"></span>${st.label}
          </span>`).join('')}</div>
      </div>
      ${_areaChart(daily, statuses)}
    </div>`;
  }

  // ③ Donut + class bars
  const showDonut = totalIncidents > 0 && statuses.length >= 2;
  const showClass = trendClass === 'ALL' && CLASSES.length > 1;
  if (showDonut || showClass) {
    const cols = showDonut && showClass ? '220px 1fr' : '1fr';
    html += `<div style="display:grid;grid-template-columns:${cols};gap:10px;margin-bottom:10px">`;
    if (showDonut) {
      html += `<div style="background:var(--surface);border:0.5px solid var(--border);border-radius:var(--radius-lg);padding:20px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:14px">${t('trends.breakdown') || 'Fördelning'}</div>
        ${_donut(statuses, daily, totalIncidents)}
      </div>`;
    }
    if (showClass) {
      html += `<div style="background:var(--surface);border:0.5px solid var(--border);border-radius:var(--radius-lg);padding:20px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:14px">${t('trends.by_class') || 'Per klass'}</div>
        ${_classBars(students, logs, dates, statuses)}
      </div>`;
    }
    html += `</div>`;
  }

  // ④ Weekday + heatmap
  const showDow     = activeDays.length > 3;
  const showHeatmap = dates.length > 6;
  if (showDow || showHeatmap) {
    const cols2 = showDow && showHeatmap ? '180px 1fr' : '1fr';
    html += `<div style="display:grid;grid-template-columns:${cols2};gap:10px;margin-bottom:10px">`;
    if (showDow) {
      html += `<div style="background:var(--surface);border:0.5px solid var(--border);border-radius:var(--radius-lg);padding:20px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:14px">${t('trends.by_weekday') || 'Per veckodag'}</div>
        ${_dowBars(dow, dowMax)}
      </div>`;
    }
    if (showHeatmap) {
      html += `<div style="background:var(--surface);border:0.5px solid var(--border);border-radius:var(--radius-lg);padding:20px;overflow:hidden">
        <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:14px">${t('trends.heatmap') || 'Aktivitetskarta'}</div>
        ${_heatmap(daily, statuses)}
      </div>`;
    }
    html += `</div>`;
  }

  // ⑤ Student leaderboard
  if (stuList.length) {
    html += `<div style="background:var(--surface);border:0.5px solid var(--border);border-radius:var(--radius-lg);padding:20px">
      <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px">${t('trends.offenders')}</div>
      ${_stuTable(stuList, dates, logs, statuses)}
    </div>`;
  }

  container.innerHTML = html;
}

// ─── ① KPI row ────────────────────────────────────────────────
function _kpiRow(scoped, statuses, daily, dates, logs, compliance, activeDays, stuList, totalIncidents) {
  const compColor = compliance >= 85 ? '#16a34a' : compliance >= 65 ? '#f59e0b' : '#ef4444';
  const circ = +(2 * Math.PI * 22).toFixed(1);
  const filled = +((circ * compliance / 100)).toFixed(1);

  let html = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:10px">`;

  // Compliance ring card
  html += `<div class="stat" style="padding:14px 16px">
    <div style="display:flex;align-items:center;gap:12px">
      <svg width="48" height="48" style="flex-shrink:0;transform:rotate(-90deg)">
        <circle cx="24" cy="24" r="22" fill="none" stroke="var(--surface3)" stroke-width="5"/>
        <circle cx="24" cy="24" r="22" fill="none" stroke="${compColor}" stroke-width="5"
          stroke-dasharray="${filled} ${circ}" stroke-linecap="round"/>
      </svg>
      <div>
        <div class="stat-label">${t('trends.compliance') || 'Efterlevnad'}</div>
        <div class="stat-val" style="color:${compColor}">${compliance}%</div>
        <div style="font-size:10px;color:var(--text3);margin-top:1px">${activeDays.length} ${t('trends.active_days') || 'dagar'}</div>
      </div>
    </div>
  </div>`;

  // Per-status cards
  statuses.forEach(st => {
    const count  = daily.reduce((n, d) => n + (d[st.key] || 0), 0);
    const unique = new Set(dates.flatMap(date => {
      const dl = logs[date] || {};
      return scoped.filter(s => dl[s.id] === st.key).map(s => s.id);
    })).size;
    html += `<div class="stat" style="padding:14px 16px">
      <div class="stat-label">${st.label}</div>
      <div class="stat-val" style="color:${st.color}">${count}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:1px">${unique} ${t('trends.unique_stu') || 'unika elever'}</div>
    </div>`;
  });

  // Students affected
  html += `<div class="stat" style="padding:14px 16px">
    <div class="stat-label">${t('trends.students_affected') || 'Elever berörda'}</div>
    <div class="stat-val">${stuList.length}</div>
    <div style="font-size:10px;color:var(--text3);margin-top:1px">${t('trends.of') || 'av'} ${scoped.length} ${t('trends.total') || 'totalt'}</div>
  </div>`;

  html += `</div>`;
  return html;
}

// ─── ② Area chart ─────────────────────────────────────────────
function _areaChart(daily, statuses) {
  const W = 900, H = 120, pL = 28, pR = 8, pT = 6, pB = 22;
  const cW = W - pL - pR, cH = H - pT - pB;
  const n = daily.length;
  const maxY = Math.max(1, ...daily.map(d => d.total));

  const xp = i => pL + (n < 2 ? cW / 2 : (i / (n - 1)) * cW);
  const yp = v => pT + cH - (v / maxY) * cH;

  // Smooth curve via monotone cubic control points
  const smooth = pts => {
    if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : '';
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i-1], q = pts[i];
      const cpx = (p[0] + q[0]) / 2;
      d += ` C${cpx.toFixed(1)},${p[1].toFixed(1)} ${cpx.toFixed(1)},${q[1].toFixed(1)} ${q[0].toFixed(1)},${q[1].toFixed(1)}`;
    }
    return d;
  };

  let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block"><defs>`;
  statuses.forEach((st, i) => {
    svg += `<linearGradient id="_ag${i}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${st.color}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${st.color}" stop-opacity="0.02"/>
    </linearGradient>`;
  });
  svg += `</defs>`;

  // Grid lines
  [0, Math.ceil(maxY / 2), maxY].forEach(v => {
    const gy = yp(v).toFixed(1);
    svg += `<line x1="${pL}" y1="${gy}" x2="${W-pR}" y2="${gy}" stroke="currentColor" stroke-opacity="0.08" stroke-width="0.5"/>`;
    svg += `<text x="${pL-4}" y="${+gy+3}" text-anchor="end" font-size="8" fill="currentColor" fill-opacity="0.35" font-family="DM Mono,monospace">${v}</text>`;
  });

  // Stacked areas — accumulate baselines
  const baseline = daily.map(() => yp(0));
  statuses.forEach((st, si) => {
    const tops = daily.map((d, i) => [xp(i), baseline[i] - ((d[st.key] || 0) / maxY) * cH]);
    const line = smooth(tops);
    const area = line + (tops.length
      ? ` L${tops[tops.length-1][0].toFixed(1)},${baseline[tops.length-1].toFixed(1)} L${tops[0][0].toFixed(1)},${baseline[0].toFixed(1)} Z`
      : '');
    svg += `<path d="${area}" fill="url(#_ag${si})"/>`;
    svg += `<path d="${line}" fill="none" stroke="${st.color}" stroke-width="1.5" stroke-linecap="round"/>`;
    // Dots only when few points
    if (n <= 14) {
      tops.forEach((p, i) => {
        if (daily[i][st.key] > 0) svg += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.5" fill="${st.color}" stroke="var(--surface)" stroke-width="1.5"/>`;
      });
    }
    tops.forEach((p, i) => { baseline[i] = p[1]; });
  });

  // Zero line
  svg += `<line x1="${pL}" y1="${yp(0).toFixed(1)}" x2="${W-pR}" y2="${yp(0).toFixed(1)}" stroke="currentColor" stroke-opacity="0.12" stroke-width="1"/>`;

  // X labels
  const step = n <= 7 ? 1 : n <= 14 ? 2 : n <= 31 ? 7 : Math.max(1, Math.ceil(n / 9));
  daily.forEach((d, i) => {
    if (i % step === 0 || i === n - 1) {
      svg += `<text x="${xp(i).toFixed(1)}" y="${H-4}" text-anchor="middle" font-size="8" fill="currentColor" fill-opacity="0.4" font-family="DM Mono,monospace">${d.date.slice(5)}</text>`;
    }
  });

  svg += `</svg>`;
  return svg;
}

// ─── ③a Donut ─────────────────────────────────────────────────
function _donut(statuses, daily, total) {
  if (!total) return '';
  const slices = statuses.map(st => ({
    label: st.label, color: st.color,
    value: daily.reduce((n, d) => n + (d[st.key] || 0), 0)
  })).filter(s => s.value > 0);
  if (!slices.length) return '';

  const R = 56, r = 37, cx = 90, cy = 82, W = 180, H = 164;
  const TWO_PI = Math.PI * 2;
  const sum = slices.reduce((n, s) => n + s.value, 0);
  let angle = -Math.PI / 2;
  let paths = '';

  slices.forEach(sl => {
    const sweep = (sl.value / sum) * TWO_PI;
    const x1 = cx + R * Math.cos(angle),          y1 = cy + R * Math.sin(angle);
    const x2 = cx + R * Math.cos(angle + sweep),   y2 = cy + R * Math.sin(angle + sweep);
    const ix1= cx + r * Math.cos(angle + sweep),  iy1= cy + r * Math.sin(angle + sweep);
    const ix2= cx + r * Math.cos(angle),           iy2= cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    paths += `<path d="M${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} L${ix1.toFixed(2)},${iy1.toFixed(2)} A${r},${r} 0 ${large} 0 ${ix2.toFixed(2)},${iy2.toFixed(2)} Z" fill="${sl.color}" opacity="0.9"/>`;
    angle += sweep;
  });

  let html = `<div style="display:flex;flex-direction:column;align-items:center;gap:14px">
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      ${paths}
      <text x="${cx}" y="${cy - 7}" text-anchor="middle" font-size="24" font-weight="700" fill="currentColor" font-family="DM Sans,sans-serif">${sum}</text>
      <text x="${cx}" y="${cy + 13}" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.45" font-family="DM Sans,sans-serif">incidenter</text>
    </svg>
    <div style="width:100%;display:flex;flex-direction:column;gap:8px">`;

  slices.forEach(sl => {
    const pct = Math.round((sl.value / sum) * 100);
    html += `<div style="display:flex;align-items:center;gap:8px">
      <div style="width:9px;height:9px;border-radius:2px;background:${sl.color};flex-shrink:0"></div>
      <div style="flex:1;font-size:12px;color:var(--text2)">${sl.label}</div>
      <div style="font-size:13px;font-weight:700;color:var(--text)">${sl.value}</div>
      <div style="font-size:10px;color:var(--text3);min-width:28px;text-align:right">${pct}%</div>
    </div>`;
  });

  html += `</div></div>`;
  return html;
}

// ─── ③b Class bars ────────────────────────────────────────────
function _classBars(students, logs, dates, statuses) {
  const data = CLASSES.map(cls => {
    const cs = Object.values(students).filter(s => s.active && s.cls === cls && inScope(s.cls));
    const totals = {};
    statuses.forEach(st => { totals[st.key] = 0; });
    dates.forEach(date => {
      const dl = logs[date] || {};
      cs.forEach(s => { const st = dl[s.id]; if (st && totals[st] !== undefined) totals[st]++; });
    });
    const total = Object.values(totals).reduce((a, b) => a + b, 0);
    const activeDays = dates.filter(d => { const dl = logs[d] || {}; return cs.some(s => dl[s.id]); }).length;
    const poss = cs.length * Math.max(1, activeDays);
    const ok = poss > 0 ? Math.round((1 - total / poss) * 100) : 100;
    return { cls, totals, total, count: cs.length, ok };
  });

  const maxTotal = Math.max(1, ...data.map(d => d.total));

  let html = `<div style="display:flex;flex-direction:column;gap:14px">`;
  data.forEach(d => {
    const okColor = d.ok >= 85 ? '#16a34a' : d.ok >= 65 ? '#f59e0b' : '#ef4444';
    html += `<div style="cursor:pointer" onclick="trendClass='${d.cls}';renderTrends()">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:13px;font-weight:700;color:var(--text)">${d.cls}</span>
          <span style="font-size:10px;color:var(--text3)">${d.count} elever</span>
        </div>
        <div style="display:flex;gap:10px;align-items:center">
          ${statuses.map(st => `<span style="font-size:11px;font-weight:600;color:${st.color}">${d.totals[st.key]} ${st.label.slice(0,3).toLowerCase()}</span>`).join('')}
          <span style="font-size:10px;font-weight:600;color:${okColor}">${d.ok}% ok</span>
        </div>
      </div>
      <div style="height:8px;background:var(--surface2);border-radius:4px;overflow:hidden;display:flex">
        ${statuses.map(st => {
          const w = ((d.totals[st.key] / maxTotal) * 100).toFixed(1);
          return +w > 0 ? `<div style="width:${w}%;background:${st.color};height:100%" title="${st.label}: ${d.totals[st.key]}"></div>` : '';
        }).join('')}
      </div>
    </div>`;
  });
  html += `</div>`;
  return html;
}

// ─── ④a Day-of-week bars ──────────────────────────────────────
function _dowBars(dow, dowMax) {
  const labels = ['','Mån','Tis','Ons','Tor','Fre',''];
  let html = `<div style="display:flex;flex-direction:column;gap:10px">`;
  [1,2,3,4,5].forEach(d => {
    const pct = dowMax > 0 ? (dow[d] / dowMax) * 100 : 0;
    const col = pct > 66 ? '#ef4444' : pct > 33 ? '#f59e0b' : '#6366f1';
    html += `<div style="display:flex;align-items:center;gap:10px">
      <div style="width:26px;font-size:11px;font-weight:600;color:var(--text3);flex-shrink:0">${labels[d]}</div>
      <div style="flex:1;height:18px;background:var(--surface2);border-radius:4px;overflow:hidden;position:relative">
        <div style="height:100%;width:${pct.toFixed(1)}%;background:${col};opacity:0.75;border-radius:4px;transition:width 0.5s"></div>
      </div>
      <div style="width:22px;text-align:right;font-size:12px;font-weight:700;color:var(--text2)">${dow[d]}</div>
    </div>`;
  });
  html += `</div>`;
  return html;
}

// ─── ④b Calendar heatmap ──────────────────────────────────────
function _heatmap(daily, statuses) {
  const baseColor = statuses[0]?.color || '#ef4444';
  const maxVal = Math.max(1, ...daily.map(d => d.total));

  // Split into ISO weeks (Mon-start)
  const weeks = [];
  let week = new Array(7).fill(null);
  let started = false;

  daily.forEach(d => {
    const dow = new Date(d.date + 'T12:00:00').getDay(); // 0=Sun
    const mon = dow === 0 ? 6 : dow - 1; // convert to Mon=0
    if (!started) {
      // Pad first week
      for (let i = 0; i < mon; i++) week[i] = null;
      started = true;
    }
    if (mon === 0 && week.some(x => x !== null)) {
      weeks.push(week);
      week = new Array(7).fill(null);
    }
    week[mon] = d;
  });
  if (week.some(x => x !== null)) weeks.push(week);

  const CELL = 13, GAP = 3;
  const rowLabels = ['M','T','O','T','F'];

  let html = `<div style="display:flex;gap:${GAP}px;overflow-x:auto;padding-bottom:4px">
    <div style="display:flex;flex-direction:column;gap:${GAP}px;padding-top:20px;flex-shrink:0">
      ${rowLabels.map(l => `<div style="width:10px;height:${CELL}px;font-size:8px;color:var(--text3);font-family:DM Mono,monospace;display:flex;align-items:center;justify-content:flex-end">${l}</div>`).join('')}
    </div>`;

  let lastMonth = -1;
  weeks.forEach((wk, wi) => {
    const firstDay = wk.find(x => x);
    const mo = firstDay ? new Date(firstDay.date + 'T12:00:00').getMonth() : -1;
    const moLabels = ['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];
    const moLbl = (mo !== -1 && mo !== lastMonth) ? moLabels[mo] : '';
    if (mo !== -1) lastMonth = mo;

    html += `<div style="display:flex;flex-direction:column;gap:${GAP}px;flex-shrink:0">
      <div style="height:16px;font-size:8px;color:var(--text3);font-family:DM Mono,monospace;text-align:center;line-height:16px">${moLbl}</div>`;

    for (let row = 0; row < 5; row++) {
      const d = wk[row];
      let bg = 'var(--surface2)';
      let title = '';
      if (d) {
        title = `${d.date}: ${d.total} incident${d.total !== 1 ? 'er' : ''}`;
        if (d.total > 0) {
          const intensity = d.total / maxVal;
          bg = _rgba(baseColor, 0.12 + intensity * 0.78);
        }
      }
      html += `<div style="width:${CELL}px;height:${CELL}px;border-radius:3px;background:${bg}" title="${title}"></div>`;
    }
    html += `</div>`;
  });

  html += `</div>`;

  // Legend
  const steps = [0.12, 0.3, 0.5, 0.7, 0.9];
  html += `<div style="display:flex;align-items:center;gap:4px;margin-top:10px">
    <span style="font-size:9px;color:var(--text3);margin-right:2px">Färre</span>
    ${steps.map(op => `<div style="width:${CELL}px;height:${CELL}px;border-radius:3px;background:${_rgba(baseColor, op)}"></div>`).join('')}
    <span style="font-size:9px;color:var(--text3);margin-left:2px">Fler</span>
  </div>`;

  return html;
}

// ─── ⑤ Student leaderboard ────────────────────────────────────
function _stuTable(stuList, dates, logs, statuses) {
  const INITIAL = 3;
  const top = stuList.slice(0, 20);
  if (!top.length) return `<div style="color:var(--text3);font-size:13px;padding:1rem 0">${t('trends.no_data')}</div>`;

  const maxTotal = top[0].total;
  const recentDates = dates.slice(-28);
  const gtc = `1fr ${statuses.map(() => '40px').join(' ')} 120px 32px`;
  const extra = top.length - INITIAL;

  const renderRow = entry => {
    const s = entry.student;
    const fname = s.fname || s.name.split(' ')[0] || '';
    const lname = s.lname || s.name.split(' ').slice(1).join(' ') || '';
    const initials = ((fname[0] || '') + (lname[0] || '')).toUpperCase() || s.name.slice(0,2).toUpperCase();

    const dots = recentDates.map(date => {
      const status = (logs[date] || {})[s.id];
      if (!status) return `<span style="width:6px;height:6px;border-radius:50%;background:var(--surface3);display:inline-block;flex-shrink:0"></span>`;
      const color = statuses.find(st => st.key === status)?.color || '#ef4444';
      return `<span style="width:6px;height:6px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0" title="${date}"></span>`;
    }).join('');

    return `<div onclick="openDrill('${s.id}')"
      style="display:grid;grid-template-columns:${gtc};gap:8px;align-items:center;padding:6px 8px;border-radius:var(--radius);cursor:pointer;transition:background 0.1s"
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
      <div style="display:flex;align-items:center;gap:8px;min-width:0">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--text2);flex-shrink:0">${initials}</div>
        <div style="min-width:0">
          <div style="font-size:13px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.name}</div>
          <div style="font-size:10px;color:var(--text3)">${s.cls}</div>
        </div>
      </div>
      ${statuses.map(st => `<div style="font-size:13px;font-weight:700;color:${st.color};text-align:right">${entry[st.key] || 0}</div>`).join('')}
      <div style="display:flex;gap:2px;align-items:center;flex-wrap:nowrap;overflow:hidden">${dots}</div>
      <div style="font-size:14px;font-weight:700;color:var(--text);text-align:right">${entry.total}</div>
    </div>`;
  };

  let html = `<div style="display:flex;flex-direction:column;gap:1px">
    <div style="display:grid;grid-template-columns:${gtc};gap:8px;padding:0 8px 8px;border-bottom:0.5px solid var(--border);margin-bottom:2px">
      <span style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em">Elev</span>
      ${statuses.map(st => `<span style="font-size:10px;font-weight:700;color:${st.color};text-align:right;text-transform:uppercase;letter-spacing:0.05em">${st.label.slice(0,3)}</span>`).join('')}
      <span></span>
      <span style="font-size:10px;font-weight:700;color:var(--text3);text-align:right;text-transform:uppercase;letter-spacing:0.05em">Tot</span>
    </div>`;

  // First INITIAL rows always visible
  top.slice(0, INITIAL).forEach(entry => { html += renderRow(entry); });

  // Remaining rows — hidden by default
  if (extra > 0) {
    html += `<div id="stuExtraRows" style="display:none;flex-direction:column;gap:1px">`;
    top.slice(INITIAL).forEach(entry => { html += renderRow(entry); });
    html += `</div>`;

    html += `<button id="stuToggleBtn" onclick="
      var el=document.getElementById('stuExtraRows');
      var btn=document.getElementById('stuToggleBtn');
      var open=el.style.display==='flex';
      el.style.display=open?'none':'flex';
      btn.innerHTML=open
        ? '＋ ${extra} fler'
        : '－ Visa färre';
    " style="margin-top:8px;background:none;border:0.5px solid var(--border2);border-radius:var(--radius);color:var(--text2);font-size:12px;font-weight:600;padding:6px 14px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background 0.15s;align-self:flex-start"
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
      ＋ ${extra} fler
    </button>`;
  }

  html += `</div>`;
  return html;
}

// ─── Utility ──────────────────────────────────────────────────
function _rgba(hex, alpha) {
  if (!hex || hex[0] !== '#') return hex;
  const full = hex.length === 4
    ? '#' + hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3]
    : hex;
  const r = parseInt(full.slice(1,3), 16);
  const g = parseInt(full.slice(3,5), 16);
  const b = parseInt(full.slice(5,7), 16);
  if (isNaN(r)) return hex;
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
}
