// ─── STUDENTS (domain) ─────────────────────────────────────

function openEditStudent(id) {
  const students = loadStudents();
  const s = students[id];
  if (!s) return;
  const dl = document.getElementById('classOptions');
  if (dl) {
    dl.innerHTML = '';
    CLASSES.forEach(c => { const o = document.createElement('option'); o.value = c; dl.appendChild(o); });
  }
  document.getElementById('editStudentId').value = id;
  document.getElementById('editStudentName').value = s.name;
  document.getElementById('editStudentClass').value = s.cls || '';
  document.getElementById('editStudentSsid').value = id;
  var bm = loadBarcodeMap();
  var existingBarcode = Object.keys(bm).find(function(k) { return bm[k] === id; }) || '';
  document.getElementById('editStudentBarcode').value = existingBarcode;
  const ex = getExtra(id);
  document.getElementById('editStudentNote').value = ex.note || '';
  // Number field — label updates to match school setting
  const cfg = typeof getSettings === 'function' ? getSettings() : {};
  const numLabelEl = document.getElementById('editNumLabel');
  if (numLabelEl) numLabelEl.textContent = cfg.studentNumLabel || 'Nummer';
  document.getElementById('editStudentNum').value = s.num != null ? s.num : '';
  document.getElementById('editStudentModal').style.display = 'flex';
}

function saveEditStudent() {
  const oldId = document.getElementById('editStudentId').value;
  const newName = document.getElementById('editStudentName').value.trim();
  const newCls = document.getElementById('editStudentClass').value.trim();
  const newBarcode = document.getElementById('editStudentBarcode').value.trim().toUpperCase();
  if (!newName) { showToast(t('toast.name_required')); return; }
  const students = loadStudents();
  if (!students[oldId]) { showToast(t('toast.student_not_found')); return; }
  const s = students[oldId];
  s.name = newName;
  s.cls = newCls;
  const rawNum = document.getElementById('editStudentNum')?.value.trim();
  s.num = rawNum !== '' && rawNum != null ? parseInt(rawNum) || rawNum : null;
  if (s.num === null) delete s.num;
  students[oldId] = s;
  saveStudents(students);
  const bm = loadBarcodeMap();
  Object.keys(bm).forEach(function(k) { if (bm[k] === oldId) delete bm[k]; });
  if (newBarcode) bm[newBarcode] = oldId;
  saveBarcodeMap(bm);
  if (SERVER) patchStudentOnServer(oldId, s);
  const newNote = document.getElementById('editStudentNote').value.trim();
  setExtra(oldId, { note: newNote || null });
  document.getElementById('editStudentModal').style.display = 'none';
  renderStudentList();
  renderGrid();
  showToast(t('toast.student_updated'));
}

async function addStudent() {
  const id = document.getElementById('newId').value.trim();
  const name = document.getElementById('newName').value.trim();
  const cls = document.getElementById('newClass').value;
  if (!id || !name) { showToast(t('toast.id_required')); return; }
  const students = loadStudents();
  if (students[id]) { showToast(t('toast.id_exists')); return; }
  const parts = name.trim().split(/\s+/);
  const fname = parts[0] || '';
  const lname = parts.slice(1).join(' ') || '';
  const s = { id, name, fname, lname, cls, active: true };
  students[id] = s;
  saveStudents(students);
  await saveStudentToServer(s);
  document.getElementById('newId').value = '';
  document.getElementById('newName').value = '';
  document.getElementById('newClass').value = '';
  document.getElementById('addPanel').classList.remove('open');
  const clsSuffix = cls ? t('toast.added_cls', { cls }) : '';
  showToast(t('toast.added', { name, cls: clsSuffix }));
  CLASSES = getClasses(loadStudents());
  renderDash();
  renderStudentList();
}

async function removeStudent(id) {
  const students = loadStudents();
  if (!students[id]) return;
  if (!confirm(t('confirm.remove', { name: students[id].name }))) return;
  students[id].active = false;
  saveStudents(students);
  await patchStudentOnServer(id, { active: false });
  showToast(t('toast.student_updated'));
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
  showToast(t('toast.student_updated'));
  renderStudentList();
}

function setStudentNum(id, raw) {
  const students = loadStudents();
  if (!students[id]) return;
  const trimmed = String(raw || '').trim();
  const n = trimmed === '' ? null : (parseInt(trimmed) || trimmed);
  if (n === null) delete students[id].num;
  else students[id].num = n;
  saveStudents(students);
  if (SERVER) patchStudentOnServer(id, students[id]);
}

function hasStudents() {
  const s = loadStudents();
  return Object.values(s).some(x => x.active);
}

function addStudentBarcode() {
  showToast(t('toast.barcode_hint'));
}
