// ─── EXTRA (guardian star + slot) ─────────────────────────

function getExtra(id) { return loadExtra()[id] || {}; }

function setExtra(id, patch) {
  const all = loadExtra();
  all[id] = Object.assign(all[id] || {}, patch);
  // clean up null/falsy values locally too
  Object.keys(all[id]).forEach(k => { if (!all[id][k]) delete all[id][k]; });
  if (Object.keys(all[id]).length === 0) delete all[id];
  saveExtra(all);
  _extraDirtyUntil = Date.now() + 10000; // block overwrite for 10s after any change
  if (SERVER) fetch(SERVER + '/extra', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) }).catch(() => {});
}

function renderStar(id) {
  const ex = getExtra(id);
  const starred = ex.starred;
  return `<button class="star-btn" onclick="toggleStar(event,'${id}')" title="Guardian notified">${starred ? '<span style="color:#22c55e;font-size:20px">★ Guardian notified</span>' : '<span style="color:var(--text3);font-size:18px">☆ Mark guardian notified</span>'}</button>`;
}

function renderSlot(id) {
  const ex = getExtra(id);
  return `<div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px">
    <span style="font-size:10px;font-weight:600;background:var(--amber-border);color:#fff;padding:2px 6px;border-radius:10px;line-height:1.4">Late</span>
    <input class="slot-input" type="number" min="1" max="30" value="${ex.slot || ''}" placeholder="##" onclick="event.stopPropagation()" onchange="setSlot(event,'${id}')">
  </div>`;
}

function toggleStar(e, id) {
  e.stopPropagation();
  if (currentRole === 'view') { showToast('View only — log in to make changes'); return; }
  const ex = getExtra(id);
  const cur = ex.starred || null;
  const next = cur === null ? 'reported' : cur === 'reported' ? 'unreported' : null;
  setExtra(id, { starred: next });
  renderGrid();
}

function setSlot(e, id) {
  e.stopPropagation();
  setExtra(id, { slot: parseInt(e.target.value) || null });
}
