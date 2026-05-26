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
  if (currentRole === 'view') { showToast('View only — log in to make changes'); return; }
  const dl = getDayLogs(currentDate);
  const cur = dl[id] || 'in';
  const next = cur === 'in' ? 'out' : cur === 'out' ? 'late' : 'in';
  setDayLog(currentDate, id, next);
  renderDash();
  const labels = { out: 'Not handed in', late: 'Late / Reception', in: 'Handed in ✓' };
  showToast(labels[next]);
  if (SERVER) serverSet(currentDate, id, next);
}

async function setLate(id) {
  if (currentRole === 'view') { showToast('View only — log in to make changes'); return; }
  const dl = getDayLogs(currentDate);
  const cur = dl[id] || 'in';
  const next = cur === 'late' ? 'in' : 'late';
  setDayLog(currentDate, id, next);
  renderDash();
  showToast(next === 'late' ? 'Late / Reception' : 'Handed in ✓');
  if (SERVER) serverSet(currentDate, id, next);
}

function toggleAtHome(e, id) {
  e.stopPropagation();
  if (currentRole === 'view') { showToast('View only — log in to make changes'); return; }
  const ex = getExtra(id);
  setExtra(id, { athome: !ex.athome });
  renderGrid();
}

function togglePhone(e, id) {
  e.stopPropagation();
  if (currentRole === 'view') { showToast('View only — log in to make changes'); return; }
  const ex = getExtra(id);
  setExtra(id, { keepphone: !ex.keepphone });
  renderGrid();
}

function openExplainedModal() {
  const today = new Date();
  const tmp = new Date(today); tmp.setHours(0, 0, 0, 0); tmp.setDate(tmp.getDate() + 3 - (tmp.getDay() + 6) % 7);
  const w1 = new Date(tmp.getFullYear(), 0, 4);
  const wk = 1 + Math.round(((tmp.getTime() - w1.getTime()) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
  const inp = document.getElementById('explainedWeekNum');
  if (inp && !inp.value) inp.value = wk;
  document.getElementById('explainedModal').style.display = 'flex';
  document.getElementById('explainedResult').innerHTML = '';
}

function processExplained() {
  var text = document.getElementById('explainedPaste').value.trim();
  if (!text) { showToast('Paste the page source first'); return; }

  var students = loadStudents();

  // Extract week number from HTML or title
  var weekMatch = text.match(/week\s*(\d+)/i) || text.match(/w(\d+)/i);
  var weekNum = weekMatch ? parseInt(weekMatch[1]) : (parseInt(document.getElementById('explainedWeekNum').value) || 0);
  if (weekNum) document.getElementById('explainedWeekNum').value = weekNum;

  var year = new Date().getFullYear();
  var mondayDate = weekToMonday(year, weekNum);
  var weekDates = [];
  for (var i = 0; i < 5; i++) {
    var dd = new Date(mondayDate.getTime() + i * 86400000);
    weekDates.push(dd.getFullYear() + '-' + String(dd.getMonth() + 1).padStart(2, '0') + '-' + String(dd.getDate()).padStart(2, '0'));
  }

  var matched = 0, unmatched = [], dayTotals = [0, 0, 0, 0, 0];
  var logs = loadLogs();
  var day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  // Check if HTML source (contains <tr) or plain text
  var isHTML = text.indexOf('<tr') > -1 || text.indexOf('<TR') > -1;

  if (isHTML) {
    // Parse HTML rows
    var trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    var tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    var trMatch;
    while ((trMatch = trPattern.exec(text)) !== null) {
      var rowHTML = trMatch[1];
      // Extract all TDs
      var tds = [];
      var tdMatch;
      var tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      while ((tdMatch = tdRe.exec(rowHTML)) !== null) tds.push(tdMatch[1]);
      if (tds.length < 8) continue;

      var cls = tds[0].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      var surname = tds[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      var firstname = tds[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      if (!cls || !surname || !/^\d/.test(cls)) continue;

      // Determine which days have a cross or Explained absence
      var absentDays = [];
      for (var d = 0; d < 5; d++) {
        var cell = tds[3 + d] || '';
        if (cell.indexOf('cross_small') > -1 || cell.indexOf('Explained absence') > -1) {
          absentDays.push(d);
        }
      }
      if (!absentDays.length) continue;

      // Match student
      var parts = [surname, firstname].join(' ').split(/\s+/).filter(function(p) { return p.length > 1; });
      var foundS = null;
      Object.values(students).forEach(function(s) {
        if (foundS || !s.active) return;
        var normCls = function(c) { return c.trim().toUpperCase().replace(/[:\s].*/, ''); };
        if (normCls(s.cls) !== normCls(cls)) return;
        var sn = norm(s.name);
        if (parts.every(function(p) { return sn.indexOf(norm(p)) > -1; })) foundS = s;
      });

      if (!foundS) { unmatched.push(cls + ' ' + surname + ' ' + firstname); continue; }

      // Mark as reported per day in logs
      absentDays.forEach(function(d) {
        var dt = weekDates[d]; if (!dt) return;
        if (!logs[dt]) logs[dt] = {};
        logs[dt][foundS.id + '_unreported'] = false; // clear unreported flag
        logs[dt][foundS.id + '_reported'] = true;    // set reported flag for this day
        dayTotals[d]++;
      });
      matched++;
    }
  } else {
    // Plain text fallback - mark whole week
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var cols = lines[i].split('\t');
      if (cols.length < 4) continue;
      var cls2 = (cols[0] || '').trim();
      var surname2 = (cols[1] || '').trim();
      var firstname2 = (cols[2] || '').trim();
      if (!cls2 || !surname2 || !/^\d/.test(cls2)) continue;
      var parts2 = [surname2, firstname2].join(' ').split(/\s+/).filter(function(p) { return p.length > 1; });
      var foundS2 = null;
      Object.values(students).forEach(function(s) {
        if (foundS2 || !s.active) return;
        if (s.cls.trim().toUpperCase() !== cls2.trim().toUpperCase()) return;
        var sn = norm(s.name);
        if (parts2.every(function(p) { return sn.indexOf(norm(p)) > -1; })) foundS2 = s;
      });
      if (!foundS2) { unmatched.push(cls2 + ' ' + surname2 + ' ' + firstname2); continue; }
      // plain text: mark all 5 days as reported
      weekDates.forEach(function(dt) {
        if (!logs[dt]) logs[dt] = {};
        logs[dt][foundS2.id + '_reported'] = true;
      });
      matched++;
    }
  }

  saveLogs(logs);
  if (SERVER) saveFlagsToServer(logs, weekDates);
  renderGrid(); renderDash();

  var res = document.getElementById('explainedResult');
  var summary = '';
  if (isHTML) {
    summary = day_names.map(function(n, d) {
      return dayTotals[d] > 0
        ? '<span style="color:#16a34a;display:block">' + n + ' ' + weekDates[d] + ': ' + dayTotals[d] + ' students ⭐</span>'
        : '<span style="color:var(--text3);display:block">' + n + ': none</span>';
    }).join('');
  }
  var html2 = '<div style="font-size:11px;line-height:1.8;margin-bottom:4px">' + summary + '</div>';
  html2 += '<span style="font-size:11px;color:#16a34a">✓ ' + matched + ' students marked as Reported</span>';
  if (unmatched.length) html2 += '<div style="margin-top:6px;font-size:11px;color:#f59e0b">Not found (' + unmatched.length + '): ' + unmatched.slice(0, 5).join(', ') + (unmatched.length > 5 ? ' …' : '') + '</div>';
  res.innerHTML = html2;
}

function clearTodayExplained() {
  var dt = currentDate;
  var logs = loadLogs();
  var extra = loadExtra();
  if (logs[dt]) Object.keys(logs[dt]).forEach(function(k) {
    if (k.endsWith('_unreported') || k.endsWith('_reported') || logs[dt][k] === false) delete logs[dt][k];
  });
  saveLogs(logs);
  if (SERVER) saveFlagsToServer(logs, [dt]);
  renderGrid(); renderDash();
  document.getElementById('explainedResult').textContent = 'Cleared explained absences for ' + dt;
}

function clearWeekExplained() {
  var weekNumInput = parseInt(document.getElementById('explainedWeekNum').value);
  if (!weekNumInput) { showToast('Enter a week number first'); return; }
  var year = new Date().getFullYear();
  var mondayDate = weekToMonday(year, weekNumInput);
  var logs = loadLogs();
  var extra = loadExtra();
  var weekDates = [];
  for (var i = 0; i < 5; i++) {
    var dd = new Date(mondayDate.getTime() + i * 86400000);
    var dt = dd.getFullYear() + '-' + String(dd.getMonth() + 1).padStart(2, '0') + '-' + String(dd.getDate()).padStart(2, '0');
    weekDates.push(dt);
    if (logs[dt]) Object.keys(logs[dt]).forEach(function(k) { if (k.endsWith('_unreported') || k.endsWith('_reported')) delete logs[dt][k]; });
    // Also wipe any false values from old format
    if (logs[dt]) Object.keys(logs[dt]).forEach(function(k) { if (logs[dt][k] === false) delete logs[dt][k]; });
  }
  saveLogs(logs);
  if (SERVER) saveFlagsToServer(logs, weekDates);
  renderGrid(); renderDash();
  document.getElementById('explainedResult').textContent = 'Cleared week ' + weekNumInput;
}

function openUnreportedModal() {
  const today = new Date();
  const currentWeek = getISOWeek(today);
  const inp = document.getElementById('unreportedWeekNum');
  if (inp && !inp.value) inp.value = currentWeek;
  document.getElementById('unreportedModal').style.display = 'flex';
  document.getElementById('unreportedResult').innerHTML = '';
  var markBtn = document.getElementById('markUnreportedBtn');
  if (markBtn) { markBtn.textContent = 'Mark Unreported'; markBtn.onclick = processUnreported; }
}

function processUnreported() {
  var text = document.getElementById('unreportedPaste').value;
  var students = loadStudents();
  var matched = [], unmatched = [];
  var dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  // Week number - paste takes priority
  var weekMatch = text.match(/week\s*(\d+)/i);
  var weekNum = weekMatch ? parseInt(weekMatch[1]) : (function() {
    var d = new Date(), jan4 = new Date(d.getFullYear(), 0, 4);
    var startW1 = new Date(jan4); startW1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
    return Math.ceil((d - startW1) / 604800000) + 1;
  })();
  if (weekMatch) {
    weekNum = parseInt(weekMatch[1]);
    document.getElementById('unreportedWeekNum').value = weekNum;
  } else {
    var fieldVal = parseInt(document.getElementById('unreportedWeekNum').value);
    if (fieldVal) weekNum = fieldVal;
  }
  var year = new Date().getFullYear();
  var mondayDate = weekToMonday(year, weekNum);

  // Build weekDates
  var weekDates = [];
  for (var i = 0; i < 5; i++) {
    var dd = new Date(mondayDate.getTime() + i * 86400000);
    var y2 = dd.getFullYear();
    var mo = String(dd.getMonth() + 1).padStart(2, '0');
    var d2 = String(dd.getDate()).padStart(2, '0');
    weekDates.push(y2 + '-' + mo + '-' + d2);
  }
  document.getElementById('unreportedWeekLabel').textContent = 'Week ' + weekNum;

  // Normalize line endings
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Find header to get dayColIndex
  var dayColIndex = [1, 2, 3, 4, 5];
  var allLines = text.split('\n');
  for (var li = 0; li < Math.min(100, allLines.length); li++) {
    var hline = allLines[li];
    if (hline.indexOf('Monday') > -1 && hline.indexOf('Tuesday') > -1) {
      var hcols = hline.split('\t');
      dayColIndex = [
        hcols.indexOf('Monday'), hcols.indexOf('Tuesday'),
        hcols.indexOf('Wednesday'), hcols.indexOf('Thursday'), hcols.indexOf('Friday')
      ];
      break;
    }
  }

  // Formula: clipboard_col for day d = 2*dayColIndex[d]-1
  // Range for day d: [2*dayColIndex[d]-1, 2*dayColIndex[d+1]-1)
  function getDay(ci) {
    for (var d = 0; d < 5; d++) {
      var lo = 2 * dayColIndex[d] - 1;
      var hi = d < 4 ? (2 * dayColIndex[d + 1] - 1) : 999;
      if (ci >= lo && ci < hi) return d;
    }
    return -1;
  }

  var classPattern = /^([6-9][A-Z][A-Z]?(?::\s*\S+)?)\s+(.+?)(?:\t|$)/;
  var timePattern = /^\d+:\d+-\d+:\d+/;
  var matchedPerDay = {};
  weekDates.forEach(function(dt) { matchedPerDay[dt] = []; });

  var blocks = text.split(/\n\s*\n/);

  blocks.forEach(function(block) {
    var blines = block.split('\n');
    var first = blines[0] || '';
    var m = first.match(classPattern);
    if (!m) return;
    var cls = m[1].split(':')[0].trim();
    var rawName = first.split('\t')[0].slice(m[1].length).trim();
    // Strip leading support code e.g. "MH Högberg Meja" -> "Högberg Meja"
    rawName = rawName.replace(/^[A-Z]{1,3}\s+/, '').trim();
    if (!rawName || rawName.length < 2) return;

    // Find day subjects using 2x formula
    var nameCols = first.split('\t');
    var daySubjects = [];
    for (var ci = 1; ci < nameCols.length; ci++) {
      var cell = (nameCols[ci] || '').trim();
      if (!cell) continue;
      var day = getDay(ci);
      if (day >= 0) daySubjects.push({ day: day, subj: cell });
    }

    // Overflow: next-day subjects appear in time row col 1
    for (var tli = 1; tli < blines.length; tli++) {
      if (!timePattern.test(blines[tli])) continue;
      var tparts = blines[tli].split('\t');
      for (var ti = 1; ti < tparts.length; ti++) {
        var tcell = (tparts[ti] || '').trim();
        if (!tcell) continue;
        if (daySubjects.length > 0) {
          var prevDay = daySubjects[daySubjects.length - 1].day;
          if (prevDay < 4) daySubjects.push({ day: prevDay + 1, subj: tcell });
        }
        break;
      }
    }

    if (!daySubjects.length) return;

    // Get time rows
    var timeRows = [];
    for (var tli2 = 1; tli2 < blines.length; tli2++) {
      if (timePattern.test(blines[tli2])) timeRows.push(blines[tli2].split('\t')[0].trim());
    }

    // Check which days have SMS/email
    var absentDays = [];
    for (var si = 0; si < daySubjects.length; si++) {
      var timeStr = timeRows[si] || '';
      if (timeStr && (timeStr.indexOf('SMS') > -1 || timeStr.toLowerCase().indexOf('mail') > -1)) {
        absentDays.push(daySubjects[si].day);
      }
    }
    if (!absentDays.length) return;

    // Match student
    var parts = rawName.split(/\s+/);
    var found = false;
    Object.values(students).forEach(function(s) {
      if (!s.active || found) return;
      if (!/^[6-9]/.test(s.cls)) return;
      var normCls2 = function(c) { return c.trim().toUpperCase().replace(/[:\s].*/, ''); };
      if (normCls2(s.cls) !== normCls2(cls)) return;
      var sn = norm(s.name);
      var ok = parts.every(function(p) { return norm(p).length > 1 && sn.indexOf(norm(p)) > -1; });
      if (ok) {
        var logs = loadLogs();
        absentDays.forEach(function(dayIdx) {
          var dt = weekDates[dayIdx]; if (!dt) return;
          if (!logs[dt]) logs[dt] = {};
          logs[dt][s.id + '_unreported'] = true;
          if (matchedPerDay[dt]) matchedPerDay[dt].push(s.name);
        });
        saveLogs(logs);
        matched.push(cls + ' ' + s.name);
        found = true;
      }
    });
    if (!found) unmatched.push(cls + ' ' + rawName);
  });

  // Summary
  var res = document.getElementById('unreportedResult');
  var summaryLines = weekDates.map(function(dt, i) {
    var n = (matchedPerDay[dt] || []).length;
    return n > 0
      ? '<span style="color:#16a34a;display:block">' + dayNames[i] + ' ' + dt + ': ' + n + ' students</span>'
      : '<span style="color:var(--text3);display:block">' + dayNames[i] + ': none</span>';
  });
  var html2 = '<div style="font-size:11px;line-height:1.8;margin-bottom:4px">' + summaryLines.join('') + '</div>';
  if (matched.length) html2 += '<span style="font-size:11px;color:#16a34a">✓ ' + matched.length + ' students stored</span>';
  if (unmatched.length) {
    html2 += '<div style="margin-top:8px;background:var(--surface2);border:1px solid var(--amber-border);border-radius:8px;padding:8px">'
      + '<div style="font-size:11px;font-weight:600;color:#f59e0b;margin-bottom:6px">⚠ Not found: ' + unmatched.length + '</div>'
      + '<div id="unmatchedList" style="font-size:12px;font-family:monospace;color:var(--text);line-height:1.8;white-space:pre-wrap">' + unmatched.join('\n') + '</div>'
      + '<button onclick="copyUnmatched()" style="margin-top:8px;padding:4px 10px;font-size:11px;background:var(--surface);border:0.5px solid var(--border);border-radius:6px;cursor:pointer;color:var(--text)">📋 Copy list</button>'
      + '</div>';
  }
  res.innerHTML = html2;

  // Restore button
  var markBtn = document.getElementById('markUnreportedBtn');
  if (markBtn) { markBtn.textContent = 'Mark Unreported'; markBtn.onclick = processUnreported; }

  // Push unreported flags to server
  if (SERVER) { var logsNow = loadLogs(); saveFlagsToServer(logsNow, weekDates); }
  renderGrid(); renderDash();
}

function setUnreported(id, val) {
  var logs = loadLogs();
  if (!logs[currentDate]) logs[currentDate] = {};
  if (val) logs[currentDate][id + '_unreported'] = true;
  else delete logs[currentDate][id + '_unreported'];
  saveLogs(logs);
  if (SERVER) saveFlagsToServer(logs, [currentDate]);
}

function clearUnreported() {
  var logs = loadLogs();
  if (!logs[currentDate]) return;
  Object.keys(logs[currentDate]).forEach(function(k) {
    if (k.endsWith('_unreported')) delete logs[currentDate][k];
  });
  saveLogs(logs);
  renderGrid(); renderDash();
  document.getElementById('unreportedResult').innerHTML = '<span style="color:#16a34a">✓ Cleared for today</span>';
}

function clearWeekUnreported() {
  var weekNumInput = parseInt(document.getElementById('unreportedWeekNum').value);
  if (!weekNumInput) return;
  var year = new Date().getFullYear();
  var mondayDate = weekToMonday(year, weekNumInput);
  var logs = loadLogs();
  for (var i = 0; i < 5; i++) {
    var dd = new Date(mondayDate.getTime() + i * 86400000);
    var y = dd.getFullYear();
    var m = String(dd.getMonth() + 1).padStart(2, '0');
    var d2 = String(dd.getDate()).padStart(2, '0');
    var dt = y + '-' + m + '-' + d2;
    if (logs[dt]) Object.keys(logs[dt]).forEach(function(k) { if (k.endsWith('_unreported')) delete logs[dt][k]; });
  }
  saveLogs(logs);
  renderGrid(); renderDash();
  document.getElementById('unreportedResult').innerHTML = '<span style="color:#16a34a">✓ Cleared all days for week ' + weekNumInput + '</span>';
}

// Alias so HTML onclick="clearTodayUnreported()" works
function clearTodayUnreported() { clearUnreported(); }

function norm(s) { return s.toLowerCase().replace(/[^a-z]/g, ''); }
