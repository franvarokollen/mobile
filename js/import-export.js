// ─── IMPORT / EXPORT ───────────────────────────────────────

// Normalizes field names from any importer into the canonical student object shape.
// All code expects: { id, fname, lname, name, cls, active }
function normalizeStudentObj(obj) {
  // class → cls (reserved word in old code)
  if (obj.class !== undefined && !obj.cls) { obj.cls = obj.class; }
  delete obj.class;
  // firstName/lastName → fname/lname
  if (obj.firstName) { obj.fname = obj.firstName; delete obj.firstName; }
  if (obj.lastName)  { obj.lname = obj.lastName;  delete obj.lastName; }
  // Build full name if missing
  if (!obj.name && (obj.fname || obj.lname)) obj.name = ((obj.fname || '') + ' ' + (obj.lname || '')).trim();
  // Split full name into fname/lname if only name provided
  if (obj.name && !obj.fname) {
    const parts = obj.name.trim().split(/\s+/);
    obj.fname = parts[0] || '';
    obj.lname = parts.slice(1).join(' ') || '';
  }
  if (obj.active === undefined) obj.active = true;
}

function openImportModal() {
  document.getElementById('importModal').style.display = 'flex';
}

function handleStudentsXML(input) {
  var file = input.files[0]; if (!file) return;
  var reader = new FileReader();
  reader.onload = async function(e) {
    try {
      var parser = new DOMParser(), xml = parser.parseFromString(e.target.result, 'text/xml');
      var nodes = xml.querySelectorAll('student');
      if (!nodes.length) { showToast(t('toast.no_students_xml')); return; }
      var students = {}, nameMap = {};
      nodes.forEach(function(node) {
        var get = function(tag) { var el = node.querySelector(tag); return el ? el.textContent.trim() : ''; };
        var schoolId = get('id'), fname = get('fname'), lname = get('lname'), cls = get('class'), active = get('active');
        if (!schoolId || !fname || !lname || active === '0') return;
        var name = fname + ' ' + lname;
        students[schoolId] = { id: schoolId, name: name, fname: fname, lname: lname, cls: cls, active: true };
        if (cls) nameMap[name.toLowerCase() + '|' + cls.toUpperCase()] = schoolId;
      });
      saveStudents(students); saveNameMap(nameMap);
      var result = await bulkUploadToServer(Object.values(students));
      await fetchStudentsFromServer();
      hideUploadScreen();
      showToast(t('toast.imported', { added: result.added, updated: result.updated }));
      renderDash(); renderStudentList();
    } catch(err) { showToast(t('toast.xml_error', { msg: err.message })); }
    input.value = '';
  };
  reader.readAsText(file, 'ISO-8859-1');
}

function handleParentsXML(input) {
  var file = input.files[0]; if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var text = e.target.result;
      var parser = new DOMParser(), xml = parser.parseFromString(text, 'text/xml');
      // Try multiple possible tag names from SchoolSoft XML
      var nodes = xml.querySelectorAll('parent');
      if (!nodes.length) nodes = xml.querySelectorAll('Parent');
      if (!nodes.length) nodes = xml.querySelectorAll('guardian');
      if (!nodes.length) nodes = xml.querySelectorAll('Guardian');
      if (!nodes.length) {
        // Show what tags ARE in the file to help debug
        var rootTag = xml.documentElement ? xml.documentElement.tagName : 'unknown';
        var firstChild = xml.documentElement && xml.documentElement.firstElementChild ? xml.documentElement.firstElementChild.tagName : 'none';
        showToast(t('toast.no_parents_xml', { root: rootTag, child: firstChild }));
        return;
      }
      var guardians = {};
      nodes.forEach(function(node) {
        var get = function(tag) { var el = node.querySelector(tag); return el ? el.textContent.trim() : ''; };
        var sidRaw = get('studentid'); if (!sidRaw) return;
        var entry = { fname: get('fname1'), lname: get('lname1'), mobile: get('mobile1'), workphone: get('workphone1'), homephone: get('homephone'), email: get('email1') };
        sidRaw.split(',').forEach(function(sid) {
          sid = sid.trim(); if (!sid) return;
          if (!guardians[sid]) guardians[sid] = [];
          var exists = guardians[sid].find(function(g) { return g.fname === entry.fname && g.lname === entry.lname; });
          if (!exists) guardians[sid].push(entry);
        });
      });
      saveGuardians(guardians);
      if (SERVER) saveGuardiansToServer(guardians);
      var total = Object.values(guardians).reduce(function(n, arr) { return n + arr.length; }, 0);
      var statusEl = document.getElementById('guardianUploadStatus');
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--green-text)">' + t('report.guardians_from_xml', { n: total }) + '</span>';
      showToast(t('toast.guardians_loaded', { n: total }));
      if (document.getElementById('viewReport').classList.contains('active')) renderReport();
    } catch(err) { showToast(t('toast.xml_error', { msg: err.message })); }
    input.value = '';
  };
  // Try to detect encoding from file - default ISO-8859-1 for SchoolSoft XML
  reader.readAsText(file, 'ISO-8859-1');
  // If characters look wrong after parse, the XML may be UTF-8 already
}

function handlePatronPDF(input) {
  var file = input.files[0]; if (!file) return;
  showToast(t('toast.reading_pdf'));
  var url = URL.createObjectURL(file);
  var script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  script.onload = async function() {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    try {
      var pdf = await window.pdfjsLib.getDocument(url).promise;
      var fullText = '';
      for (var i = 1; i <= pdf.numPages; i++) {
        var page = await pdf.getPage(i);
        var content = await page.getTextContent();
        fullText += content.items.map(function(item) { return item.str; }).join('\n') + '\n---PAGE---\n';
      }
      processPDFText(fullText);
    } catch(err) { showToast(t('toast.pdf_error', { msg: err.message })); }
    URL.revokeObjectURL(url);
  };
  script.onerror = function() { showToast(t('toast.pdf_load_error')); };
  document.head.appendChild(script);
  input.value = '';
}

function processPDFText(text) {
  var nameMap = loadNameMap(), barcodeMap = loadBarcodeMap();
  var lines = text.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l; });
  var barcodeRe = /^C\d{7,10}$/i, classRe = /^(\d[A-Z])$/;
  var currentCls = '', pendingName = '', mapped = 0, unmatched = [];
  lines.forEach(function(line) {
    if (line === '---PAGE---') { pendingName = ''; return; }
    if (classRe.test(line)) { currentCls = line.toUpperCase(); pendingName = ''; return; }
    if (barcodeRe.test(line)) {
      var barcode = line.toUpperCase();
      if (pendingName && currentCls) {
        var key = pendingName.toLowerCase() + '|' + currentCls;
        var schoolId = nameMap[key];
        if (schoolId) { barcodeMap[barcode] = schoolId; mapped++; }
        else unmatched.push(pendingName + ' (' + currentCls + ')');
      }
      pendingName = '';
    } else { pendingName = line; }
  });
  saveBarcodeMap(barcodeMap);
  const unmatchedStr = unmatched.length ? t('toast.barcodes_unmatched', { n: unmatched.length }) : '';
  showToast(t('toast.barcodes_mapped', { n: mapped, unmatched: unmatchedStr }));
}

function handleCSVUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(e) {
    const text = e.target.result;
    const lines = text.trim().replace(/\r/g, '').split("\n");
    const students = {};
    lines.forEach((line, i) => {
      if (i === 0 && line.toLowerCase().startsWith('id')) return;
      const parts = [];
      let cur = ''; let inQ = false;
      for (let c of line) {
        if (c === '"') { inQ = !inQ; }
        else if (c === ',' && !inQ) { parts.push(cur.trim()); cur = ''; }
        else cur += c;
      }
      parts.push(cur.trim());
      if (parts.length < 3) return;
      const id = parts[0].replace(/^"|"$/g, '').trim();
      const cls = parts[parts.length - 1].replace(/^"|"$/g, '').trim();
      const name = parts.slice(1, parts.length - 1).join(' ').replace(/^"|"$/g, '').trim();
      if (!id || !name || !cls) return;
      students[id] = { id, name, cls, active: true };
    });
    const count = Object.keys(students).length;
    if (count === 0) { showToast(t('toast.no_valid_rows')); return; }
    // send to server (merges on server side), then refresh local cache
    const arr = Object.values(students);
    showToast(t('toast.uploading', { n: arr.length }));
    const result = await bulkUploadToServer(arr);
    await fetchStudentsFromServer();
    await fetchGuardiansFromServer();
    await fetchExtraFromServer();
    await loadFlagsFromServer();
    hideUploadScreen();
    showToast(t('toast.imported', { added: result.added, updated: result.updated }));
    renderDash();
    renderStudentList();
    input.value = '';
  };
  reader.readAsText(file);
}

function exportCSV() {
  const students = loadStudents();
  const dl = getDayLogs(currentDate);
  const marked = Object.entries(dl).map(([id, status]) => {
    const s = students[id];
    if (!s || !s.active) return null;
    const parts = s.name.trim().split(' ');
    const fname = parts[0];
    const lname = parts.slice(1).join(' ');
    const statusConfig = getStatuses().find(x => x.key === status);
    const statusLabel = statusConfig ? statusConfig.label : status;
    return [currentDate, fname, lname, s.cls, statusLabel];
  }).filter(Boolean);
  if (!marked.length) { showToast(t('toast.no_export')); return; }
  const header = [t('export.date'), t('export.first_name'), t('export.last_name'), t('export.class'), t('export.status')].map(h => `"${h}"`).join(',');
  const rows = marked.map(r => r.map(v => `"${v}"`).join(','));
  const csv = [header, ...rows].join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `phone-checkin-${currentDate}.csv`;
  a.click();
  showToast(t(marked.length > 1 ? 'toast.exported_pl' : 'toast.exported', { n: marked.length }));
}

function exportGuardianXLSX(mode) {
  var students = loadStudents();
  var guardians = loadGuardians();
  var barcodeMap = loadBarcodeMap();
  var dl = getDayLogs(currentDate);
  var extra = loadExtra();

  function guardianRows(s, status) {
    var arr = guardians[s.id];
    if (!arr || !arr.length) return [{ student: s.name, cls: s.cls, status: status, guardian: t('export.no_guardian'), mobile: '', workphone: '', homephone: '' }];
    return arr.map(function(g) {
      var gname = ((g.fname || g.fname1 || '') + ' ' + (g.lname || g.lname1 || '')).trim();
      return { student: s.name, cls: s.cls, status: status, guardian: gname || '', mobile: g.mobile || g.mobile1 || '', workphone: g.workphone || g.workphone1 || '', homephone: g.homephone || '' };
    });
  }

  var data = [];
  if (mode === 'nothandedin') {
    var absentIds = Object.keys(extra).filter(function(k) { return extra[k]?.starred === 'absent'; });
    var absentStudents = absentIds.map(function(id) { return resolveStudent(id, students, barcodeMap); }).filter(function(s) { return s && s.active; });
    absentStudents.sort(function(a, b) { return a.cls.localeCompare(b.cls) || a.name.localeCompare(b.name, 'sv'); });
    var redIds = Object.entries(dl).filter(function(e) { return e[1] === 'out' && !extra[e[0]]?.starred && !extra[e[0]]?.athome && !extra[e[0]]?.keepphone; }).map(function(e) { return e[0]; });
    var redStudents = redIds.map(function(id) { return resolveStudent(id, students, barcodeMap); }).filter(function(s) { return s && s.active; });
    redStudents.sort(function(a, b) { return a.cls.localeCompare(b.cls) || a.name.localeCompare(b.name, 'sv'); });
    absentStudents.forEach(function(s) { guardianRows(s, t('export.absent')).forEach(function(r) { data.push(r); }); });
    redStudents.forEach(function(s) { guardianRows(s, t('export.nhi')).forEach(function(r) { data.push(r); }); });
  }

  // Build XLSX using XML SpreadsheetML — no library needed
  var xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
  xml += '<Worksheet ss:Name="Guardians"><Table>';
  // Header row
  var headers = [t('export.student'), t('export.class'), t('export.status'), t('export.guardian'), t('export.mobile'), t('export.workphone'), t('export.homephone')];
  xml += '<Row>';
  headers.forEach(function(h) { xml += '<Cell><Data ss:Type="String">' + h + '</Data></Cell>'; });
  xml += '</Row>';
  // Data rows
  data.forEach(function(r) {
    xml += '<Row>';
    [r.student, r.cls, r.status, r.guardian, r.mobile, r.workphone, r.homephone].forEach(function(v) {
      xml += '<Cell><Data ss:Type="String">' + (v || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</Data></Cell>';
    });
    xml += '</Row>';
  });
  xml += '</Table></Worksheet></Workbook>';

  var blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'guardians-' + currentDate + '-not-handed-in.xls';
  a.click();
}

function downloadTemplate() {
  const rows = [
    'ID,First Name,Last Name,Class',
    'S100001,Anna,Andersson,7A',
    'S100002,Erik,Lindqvist,7A',
    'S100003,Maja,Söderström,7B',
    'S100004,Liam,Berg,7B',
    'S100005,Sofia,Karlsson,8A',
    'S100006,Oscar,Nilsson,8A',
    'S100007,Ella,Johansson,8B',
    'S100008,Noah,Petersson,9A',
  ];
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.join('\n'));
  a.download = 'students-template.csv';
  a.click();
}

function clearStudentData() {
  if (!confirm(t('confirm.clear_data'))) return;
  localStorage.removeItem('phc_students');
  localStorage.removeItem('phc_logs');
  showToast(t('toast.data_cleared'));
  showUploadScreen();
}

function copyUnmatched() {
  const el = document.getElementById('unmatchedList');
  if (el) navigator.clipboard.writeText(el.textContent).then(() => showToast(t('toast.copied')));
}

// ─── UNIVERSAL SMART IMPORT ────────────────────────────────

// Universal field detector — maps any column header to a known field
function detectField(header) {
  const h = (header || '').toLowerCase().trim();
  const rules = [
    { field: 'id',        kw: ['personnr','personnummer','id','barcode','streckkod','elev-id','student id','elev id','pid'] },
    { field: 'firstName', kw: ['förnamn','first name','firstname','fname','given name','förn','givenname'] },
    { field: 'lastName',  kw: ['efternamn','last name','lastname','lname','surname','family name','eftern','familyname'] },
    { field: 'name',      kw: ['name','namn','helnamn','full name','full_name','student name','elev'] },
    { field: 'class',     kw: ['klass','class','homeroom','grupp','group','year group','form','grade','kl'] },
    { field: 'phone',     kw: ['telefon','phone','mobil','mobile','tel','cell','contact','phonenumber','phone number'] },
    { field: 'email',     kw: ['email','e-post','epost','mail','e-mail','emailaddress'] },
    { field: 'guardian',  kw: ['målsman','vårdnadshavare','guardian','parent','contact name','förälder','guardian name','parent name'] },
  ];
  for (const r of rules) {
    if (r.kw.some(k => h.includes(k) || h === k)) return r.field;
  }
  return null;
}

// Parse CSV handling comma, semicolon, or tab delimiters + quoted fields
function parseCSVUniversal(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return { headers: [], rows: [] };
  const delim = [',', ';', '\t'].reduce((best, d) => {
    const count = (lines[0].match(new RegExp('\\' + d, 'g')) || []).length;
    return count > best.count ? { d, count } : best;
  }, { d: ',', count: -1 }).d;
  const parseRow = row => {
    const result = []; let cur = ''; let inQ = false;
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === delim && !inQ) { result.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    result.push(cur.trim());
    return result;
  };
  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).filter(l => l.trim()).map(parseRow);
  return { headers, rows };
}

// Show a column-mapping UI so user can confirm auto-detected fields
function showMappingUI(headers, rows, onConfirm) {
  const fieldOptions = ['(skip)', 'id', 'firstName', 'lastName', 'name', 'class', 'phone', 'email', 'guardian'];
  const mappings = headers.map(h => detectField(h) || '(skip)');
  const preview = rows.slice(0, 3);
  let html = `<div style="margin-bottom:1rem;font-size:13px;color:var(--text2)">${t('map.hint')}</div>`;
  html += `<table style="width:100%;border-collapse:collapse;font-size:13px">`;
  html += `<tr><th style="text-align:left;padding:4px 8px;border-bottom:1px solid var(--border)">${t('map.col')}</th><th style="text-align:left;padding:4px 8px;border-bottom:1px solid var(--border)">${t('map.maps_to')}</th><th style="text-align:left;padding:4px 8px;border-bottom:1px solid var(--border)">${t('map.preview')}</th></tr>`;
  headers.forEach((h, i) => {
    const opts = fieldOptions.map(f => `<option value="${f}" ${mappings[i] === f ? 'selected' : ''}>${f}</option>`).join('');
    const previewVals = preview.map(r => r[i] || '').filter(Boolean).slice(0, 2).join(', ');
    html += `<tr><td style="padding:4px 8px;border-bottom:0.5px solid var(--border)">${h}</td><td style="padding:4px 8px;border-bottom:0.5px solid var(--border)"><select id="map_${i}" style="height:28px;font-size:12px">${opts}</select></td><td style="padding:4px 8px;border-bottom:0.5px solid var(--border);color:var(--text3);font-size:12px">${previewVals}</td></tr>`;
  });
  html += `</table>`;
  html += `<div style="margin-top:1rem;display:flex;gap:8px;justify-content:flex-end"><button class="btn" onclick="confirmMapping(${JSON.stringify(headers)},${JSON.stringify(rows)})">${t('map.import_btn')}</button></div>`;
  document.getElementById('importModalBody').innerHTML = html;
  document.getElementById('importModal').classList.add('open');
  window._pendingImportRows = rows;
  window._pendingImportHeaders = headers;
}

async function confirmMapping(headers, rows) {
  const mapping = {};
  headers.forEach((h, i) => {
    const sel = document.getElementById(`map_${i}`);
    if (sel && sel.value !== '(skip)') mapping[i] = sel.value;
  });
  const students = loadStudents();
  let added = 0, updated = 0;
  rows.forEach(row => {
    const obj = {};
    Object.entries(mapping).forEach(([i, field]) => { obj[field] = row[i] || ''; });
    normalizeStudentObj(obj);
    if (!obj.fname && !obj.lname && !obj.name) return;
    if (!obj.id) obj.id = ((obj.fname || '') + '_' + (obj.lname || '') + '_' + (obj.cls || '')).trim();
    obj.id = obj.id.trim();
    if (!obj.id) return;
    if (students[obj.id]) updated++; else added++;
    students[obj.id] = { ...students[obj.id], ...obj };
  });
  saveStudents(students);
  document.getElementById('importModal').style.display = 'none';
  showToast(t('toast.uploading', { n: added + updated }));
  await bulkUploadToServer(Object.values(students));
  await fetchStudentsFromServer();
  hideUploadScreen();
  showToast(t('toast.imported', { added, updated }));
  renderDash();
  renderStudentList();
}

function handleSmartImport(input) {
  const file = input.files[0];
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  const reader = new FileReader();
  if (ext === 'xml') {
    reader.onload = e => {
      const text = e.target.result;
      if (text.includes('<Students>') || text.includes('<Student>')) handleStudentsXML(input);
      else if (text.includes('<Parents>') || text.includes('<Parent>') || text.includes('<Guardian>')) handleParentsXML(input);
      else showToast(t('toast.unknown_xml'));
    };
    reader.readAsText(file);
  } else if (ext === 'pdf') {
    handlePatronPDF(input);
  } else if (ext === 'csv' || ext === 'txt' || ext === 'tsv') {
    reader.onload = e => {
      const { headers, rows } = parseCSVUniversal(e.target.result);
      if (headers.length < 2) { showToast(t('toast.parse_error')); return; }
      // Check confidence: if all headers auto-detected with high confidence, skip mapping UI
      const mapped = headers.map(h => detectField(h));
      const allMapped = mapped.every(m => m !== null);
      if (allMapped) {
        confirmMappingAuto(headers, rows, mapped);
      } else {
        showMappingUI(headers, rows, confirmMapping);
      }
    };
    reader.readAsText(file, 'UTF-8');
  } else if (ext === 'xlsx' || ext === 'xls') {
    showToast(t('toast.excel_csv'));
  } else if (ext === 'json') {
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (Array.isArray(data)) {
          const headers = Object.keys(data[0] || {});
          const rows = data.map(row => headers.map(h => row[h] || ''));
          showMappingUI(headers, rows, confirmMapping);
        } else {
          showToast(t('toast.json_array'));
        }
      } catch(err) { showToast(t('toast.invalid_json')); }
    };
    reader.readAsText(file);
  } else {
    showToast(t('toast.unsupported_type', { ext }));
  }
  input.value = '';
}

async function confirmMappingAuto(headers, rows, mappings) {
  const mapping = {};
  headers.forEach((h, i) => { if (mappings[i]) mapping[i] = mappings[i]; });
  const students = loadStudents();
  let added = 0, updated = 0;
  rows.forEach(row => {
    const obj = {};
    Object.entries(mapping).forEach(([i, field]) => { obj[field] = row[i] || ''; });
    normalizeStudentObj(obj);
    if (!obj.fname && !obj.lname && !obj.name) return;
    if (!obj.id) obj.id = ((obj.fname || '') + '_' + (obj.lname || '') + '_' + (obj.cls || '')).trim();
    if (!obj.id) return;
    if (students[obj.id]) updated++; else added++;
    students[obj.id] = { ...students[obj.id], ...obj };
  });
  saveStudents(students);
  showToast(t('toast.uploading', { n: added + updated }));
  await bulkUploadToServer(Object.values(students));
  await fetchStudentsFromServer();
  hideUploadScreen();
  showToast(t('toast.imported', { added, updated }));
  renderDash();
  renderStudentList();
}
