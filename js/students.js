// ─── STUDENTS (domain) ─────────────────────────────────────

function openEditStudent(id) {
  const students = loadStudents();
  const s = students[id];
  if (!s) return;
  // Populate class dropdown dynamically from current student data
  const sel = document.getElementById('editStudentClass');
  sel.innerHTML = '';
  getClasses(students).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    sel.appendChild(opt);
  });
  document.getElementById('editStudentId').value = id;
  document.getElementById('editStudentName').value = s.name;
  document.getElementById('editStudentClass').value = s.cls;
  document.getElementById('editStudentSsid').value = id;
  // Find barcode for this student from barcodeMap
  var bm = loadBarcodeMap();
  var existingBarcode = Object.keys(bm).find(function(k) { return bm[k] === id; }) || '';
  document.getElementById('editStudentBarcode').value = existingBarcode;
  document.getElementById('editStudentModal').style.display = 'flex';
}

function saveEditStudent() {
  const oldId = document.getElementById('editStudentId').value;
  const newName = document.getElementById('editStudentName').value.trim();
  const newCls = document.getElementById('editStudentClass').value;
  const newBarcode = document.getElementById('editStudentBarcode').value.trim().toUpperCase();
  if (!newName) { showToast('Name required'); return; }
  const students = loadStudents();
  if (!students[oldId]) { showToast('Student not found'); return; }
  const s = students[oldId];
  s.name = newName;
  s.cls = newCls;
  students[oldId] = s;
  saveStudents(students);
  // Update barcode map - remove old barcode for this student, add new one
  const bm = loadBarcodeMap();
  // Remove any existing barcode pointing to this student
  Object.keys(bm).forEach(function(k) { if (bm[k] === oldId) delete bm[k]; });
  // Add new barcode if provided
  if (newBarcode) bm[newBarcode] = oldId;
  saveBarcodeMap(bm);
  if (SERVER) fetch(SERVER + '/students/' + oldId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) }).catch(() => {});
  document.getElementById('editStudentModal').style.display = 'none';
  renderStudentList();
  showToast('Student updated');
}

async function addStudent() {
  const id = document.getElementById('newId').value.trim();
  const name = document.getElementById('newName').value.trim();
  const cls = document.getElementById('newClass').value;
  if (!id || !name) { showToast('Enter ID and name'); return; }
  const students = loadStudents();
  if (students[id]) { showToast('ID already exists'); return; }
  const s = { id, name, cls, active: true };
  students[id] = s;
  saveStudents(students);
  await saveStudentToServer(s);
  document.getElementById('newId').value = '';
  document.getElementById('newName').value = '';
  document.getElementById('addPanel').classList.remove('open');
  showToast(name + ' added to ' + cls);
  renderDash();
  renderStudentList();
}

async function removeStudent(id) {
  const students = loadStudents();
  if (!students[id]) return;
  if (!confirm('Remove ' + students[id].name + '? Their history will be kept.')) return;
  students[id].active = false;
  saveStudents(students);
  await patchStudentOnServer(id, { active: false });
  showToast('Student removed');
  renderDash();
  renderStudentList();
  closeDrillModal();
}

async function reactivateStudent(id) {
  const students = loadStudents();
  if (!students[id]) return;
  students[id].active = true;
  saveStudents(students);
  await patchStudentOnServer(id, { active: true });
  showToast('Student reactivated');
  renderStudentList();
}

function hasStudents() {
  const s = loadStudents();
  return Object.values(s).some(x => x.active);
}

function addStudentBarcode() {
  // Placeholder — barcode assignment is handled via openEditStudent / saveEditStudent
  showToast('Use Edit Student to assign a barcode');
}
