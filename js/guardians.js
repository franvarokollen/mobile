// ─── GUARDIANS ─────────────────────────────────────────────

async function handleGuardianUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const isXML = file.name.toLowerCase().endsWith('.xml');
  const text = await file.text();
  const guardians = {};

  if (isXML) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');
    const parents = doc.querySelectorAll('parent');
    parents.forEach(p => {
      const getText = tag => (p.querySelector(tag)?.textContent || '').trim();
      const sidRaw = getText('studentid');
      if (!sidRaw) return;
      const entry = { fname1: getText('fname1'), lname1: getText('lname1'), mobile1: getText('mobile1'), workphone1: getText('workphone1'), homephone: getText('homephone') };
      sidRaw.split(',').forEach(sid => { const s = sid.trim(); if (!s) return; if (!guardians[s]) guardians[s] = []; guardians[s].push(entry); });
    });
  } else {
    const lines = text.trim().split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim());
    const headers = lines[0].split('\t').map(h => h.trim().toLowerCase());
    const sidIdx = headers.indexOf('studentid');
    const fn1Idx = headers.indexOf('fname1'), ln1Idx = headers.indexOf('lname1');
    const mob1Idx = headers.indexOf('mobile1'), work1Idx = headers.indexOf('workphone1'), home1Idx = headers.indexOf('homephone');
    if (sidIdx < 0) { showToast(t('toast.guardian_column_error')); return; }
    lines.slice(1).forEach(line => {
      const cols = line.split('\t');
      const sidRaw = (cols[sidIdx] || '').trim();
      if (!sidRaw) return;
      const entry = { fname1: (cols[fn1Idx] || '').trim(), lname1: (cols[ln1Idx] || '').trim(), mobile1: (cols[mob1Idx] || '').trim(), workphone1: (cols[work1Idx] || '').trim(), homephone: (cols[home1Idx] || '').trim() };
      sidRaw.split(',').forEach(sid => { const s = sid.trim(); if (!s) return; if (!guardians[s]) guardians[s] = []; guardians[s].push(entry); });
    });
  }

  const count = Object.keys(guardians).length;
  if (count === 0) { showToast(t('toast.no_guardians_found')); return; }
  saveGuardians(guardians);
  await saveGuardiansToServer(guardians);
  showToast(t('toast.guardians_loaded', { n: count }));
  input.value = '';
}

function guardianBlock(logId, students, guardians, barcodeMap) {
  var s = resolveStudent(logId, students, barcodeMap);
  if (!s) return `<div style="font-size:12px;color:var(--text3);margin-top:6px">${t('report.no_guardian_inline')}</div>`;
  var arr = guardians[s.id];
  if (!arr || !arr.length) return `<div style="font-size:12px;color:var(--text3);margin-top:6px">${t('report.no_guardian_inline')}</div>`;
  return arr.map(function(g) {
    var name = ((g.fname || g.fname1 || '') + ' ' + (g.lname || g.lname1 || '')).trim();
    var phones = [];
    if (g.mobile || g.mobile1) phones.push('<i class="ti ti-device-mobile" style="font-size:11px"></i>' + (g.mobile || g.mobile1));
    if (g.workphone || g.workphone1) phones.push('<i class="ti ti-phone" style="font-size:11px"></i>' + (g.workphone || g.workphone1));
    if (g.homephone) phones.push('<i class="ti ti-home" style="font-size:11px"></i>' + g.homephone);
    return '<div style="margin-top:5px;padding-top:5px;border-top:1px solid var(--border);font-size:12px">'
      + '<span style="font-weight:500;color:var(--text)">' + (name || '—') + '</span>'
      + (phones.length ? ' <span style="color:var(--text2);margin-left:6px">' + phones.join(' &nbsp; ') + '</span>' : '')
      + '</div>';
  }).join('');
}
