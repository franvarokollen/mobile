// ─── REPORT VIEW ───────────────────────────────────────────

function resolveStudent(logId, students, barcodeMap) {
  if (students[logId]) return students[logId];
  var sid = barcodeMap[logId] || barcodeMap[(logId || '').toUpperCase()];
  if (sid && students[sid]) return students[sid];
  return null;
}

function inScope(cls) {
  if (!cls) return false;
  return /^[6789]/.test(cls);
}

async function renderReport() {
  await fetchGuardiansFromServer();
  await fetchExtraFromServer();
  var rp = document.getElementById('reportDatePicker');
  if (rp && !rp.value) rp.value = currentDate;
  var date = rp ? rp.value || currentDate : currentDate;
  var logs = loadLogs(), students = loadStudents(), guardians = loadGuardians(), barcodeMap = loadBarcodeMap();
  var extra = loadExtra();
  var dl = logs[date] || {};
  var redCards = Object.entries(dl).filter(function(e) { return e[1] === 'out' && !extra[e[0]]?.starred && !extra[e[0]]?.athome && !extra[e[0]]?.keepphone; }).map(function(e) { return { logId: e[0], s: resolveStudent(e[0], students, barcodeMap) }; }).filter(function(x) { return x.s && x.s.active; });
  var absentCards = Object.keys(extra).filter(function(k) { return extra[k]?.starred === 'absent'; }).concat(Object.keys(dl).filter(function(k) { return k.endsWith('_unreported') && dl[k]; }).map(function(k) { return k.replace('_unreported', ''); })).filter(function(k, i, a) { return a.indexOf(k) === i; }).map(function(k) { return { logId: k, s: resolveStudent(k, students, barcodeMap) }; }).filter(function(x) { return x.s && x.s.active; });
  var gCount = Object.keys(guardians).length;
  document.getElementById('guardianUploadStatus').innerHTML = gCount > 0 ? '<span style="color:var(--green-text)">✓ ' + gCount + ' guardian records loaded</span>' : '<span style="color:var(--amber-text)">⚠ No guardian data — upload Parents.xml above</span>';
  const expBtns = document.getElementById('guardianExportBtns');
  if (expBtns) expBtns.style.display = gCount > 0 ? 'flex' : 'none';
  var html = '';
  if (redCards.length === 0 && absentCards.length === 0) {
    html = '<div style="font-size:14px;color:var(--text2);padding:3rem;text-align:center">No unresolved incidents for ' + date + ' ✓</div>';
  } else {
    if (absentCards.length) {
      html += '<div style="font-size:12px;color:var(--text2);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:10px;margin-top:' + (redCards.length ? '1.5rem' : '0') + '">🟣 Absent — ' + absentCards.length + ' student' + (absentCards.length > 1 ? 's' : '') + '</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px;margin-bottom:1rem">';
      absentCards.sort(function(a, b) { return a.s.cls.localeCompare(b.s.cls) || a.s.name.localeCompare(b.s.name, 'sv'); }).forEach(function(x) {
        html += '<div style="background:var(--surface);border:1px solid #8b5cf6;border-radius:var(--radius-lg);padding:12px;box-shadow:0 2px 8px rgba(139,92,246,0.08)"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span class="badge" style="background:#8b5cf6;color:#fff">Absent</span><span style="font-size:14px;font-weight:600;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + x.s.name + '</span><span style="font-size:11px;color:var(--text3);font-family:monospace;flex-shrink:0">' + x.s.cls + '</span></div>' + guardianBlock(x.logId, students, guardians, barcodeMap) + '</div>';
      });
      html += '</div>';
    }
    if (redCards.length) {
      html += '<div style="font-size:12px;color:var(--text2);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:10px">🔴 Not Handed In — ' + redCards.length + ' student' + (redCards.length > 1 ? 's' : '') + '</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px;margin-bottom:1rem">';
      redCards.sort(function(a, b) { return a.s.cls.localeCompare(b.s.cls) || a.s.name.localeCompare(b.s.name, 'sv'); }).forEach(function(x) {
        html += '<div style="background:var(--surface);border:1px solid var(--red-border);border-radius:var(--radius-lg);padding:12px;box-shadow:0 2px 8px rgba(229,57,58,0.08)"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span class="badge badge-out">Not handed in</span><span style="font-size:14px;font-weight:600;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + x.s.name + '</span><span style="font-size:11px;color:var(--text3);font-family:monospace;flex-shrink:0">' + x.s.cls + '</span></div>' + guardianBlock(x.logId, students, guardians, barcodeMap) + '</div>';
      });
      html += '</div>';
    }
  }
  document.getElementById('reportContent').innerHTML = html;
}
