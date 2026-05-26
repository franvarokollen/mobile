// ─── CONFIG ────────────────────────────────────────────────
const PIN_STAFF = '202601';
const PIN_GUARDIAN = '202609';
const INACTIVITY_MS = 4.5 * 60 * 1000; // 4.5 min then show 30s warning
const WARNING_S = 30;

const STORAGE_KEYS = {
  students: 'phc_students',
  logs: 'phc_logs',
  guardians: 'phc_guardians',
  extra: 'phc_extra',
  nameMap: 'phc_namemap',
  barcodes: 'phc_barcodes'
};

// Dynamic class list derived from loaded students
function getClasses(studentsObj) {
  const set = new Set();
  Object.values(studentsObj || {}).forEach(s => { if (s.cls) set.add(s.cls); });
  return [...set].sort();
}

// CLASSES is kept as a live computed property so all modules can use it
// It is refreshed after any student load. Modules should call getClasses(loadStudents())
// for a fresh list, or use the CLASSES array which is updated on each renderDash/renderStudentList.
// For backwards compatibility, seed with an empty array; app.js will populate it.
var CLASSES = [];
