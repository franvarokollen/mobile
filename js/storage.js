// ─── STORAGE ───────────────────────────────────────────────

function loadStudents() {
  const s = localStorage.getItem('phc_students');
  return s ? JSON.parse(s) : {};
}
function saveStudents(d) { localStorage.setItem('phc_students', JSON.stringify(d)); }

function loadLogs() { const s = localStorage.getItem('phc_logs'); return s ? JSON.parse(s) : {}; }
function saveLogs(d) { localStorage.setItem('phc_logs', JSON.stringify(d)); }

function loadGuardians() { const s = localStorage.getItem('phc_guardians'); return s ? JSON.parse(s) : {}; }
function saveGuardians(d) { localStorage.setItem('phc_guardians', JSON.stringify(d)); }

function loadExtra() { const s = localStorage.getItem('phc_extra'); return s ? JSON.parse(s) : {}; }
function saveExtra(d) { localStorage.setItem('phc_extra', JSON.stringify(d)); }

function loadNameMap() { var s = localStorage.getItem('phc_namemap'); return s ? JSON.parse(s) : {}; }
function saveNameMap(d) { localStorage.setItem('phc_namemap', JSON.stringify(d)); }

function loadBarcodeMap() { var s = localStorage.getItem('phc_barcodes'); return s ? JSON.parse(s) : {}; }
function saveBarcodeMap(d) { localStorage.setItem('phc_barcodes', JSON.stringify(d)); }
