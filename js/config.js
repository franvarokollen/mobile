// ─── CONFIG ────────────────────────────────────────────────
// Auth is handled by SSO (Supabase). PIN system removed.

const STORAGE_KEYS = {
  students: 'phc_students',
  logs: 'phc_logs',
  guardians: 'phc_guardians',
  extra: 'phc_extra',
  nameMap: 'phc_namemap',
  barcodes: 'phc_barcodes'
};

// Dynamic class list derived from loaded students — sorted F,1,2,...,9 then by section
function getClasses(studentsObj) {
  const set = new Set();
  Object.values(studentsObj || {}).forEach(s => { if (s.cls) set.add(s.cls); });
  const YEAR_ORDER = ['F','1','2','3','4','5','6','7','8','9'];
  return [...set].sort((a, b) => {
    const yearA = a.match(/^([F\d]+)/)?.[1] || a;
    const yearB = b.match(/^([F\d]+)/)?.[1] || b;
    const ia = YEAR_ORDER.indexOf(yearA), ib = YEAR_ORDER.indexOf(yearB);
    if (ia !== ib) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.localeCompare(b);
  });
}

// CLASSES is kept as a live computed property so all modules can use it
// It is refreshed after any student load. Modules should call getClasses(loadStudents())
// for a fresh list, or use the CLASSES array which is updated on each renderDash/renderStudentList.
// For backwards compatibility, seed with an empty array; app.js will populate it.
var CLASSES = [];
