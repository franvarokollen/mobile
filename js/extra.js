// ─── EXTRA (flags, slot, note) ──────────────────────────────

function getExtra(id) { return loadExtra()[id] || {}; }

function setExtra(id, patch) {
  const all = loadExtra();
  all[id] = Object.assign(all[id] || {}, patch);
  Object.keys(all[id]).forEach(k => { if (!all[id][k] && all[id][k] !== 0) delete all[id][k]; });
  if (Object.keys(all[id]).length === 0) delete all[id];
  saveExtra(all);
  _extraDirtyUntil = Date.now() + 10000;
  if (SERVER) authFetch(`${API}/extra`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...patch })
  }).then(() => {
    // Tell peers to refresh their extra data
    if (typeof broadcastExtra === 'function') broadcastExtra();
  }).catch(() => {});
}

function renderSlot(id) {
  const ex = getExtra(id);
  return `<div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px">
    <span style="font-size:10px;font-weight:600;background:var(--amber-border);color:#fff;padding:2px 6px;border-radius:10px;line-height:1.4">${t('default.status.late')}</span>
    <input class="slot-input" type="number" min="1" max="30" value="${ex.slot || ''}" placeholder="##" onclick="event.stopPropagation()" onchange="setSlot(event,'${id}')">
  </div>`;
}

function toggleFlag(e, id, key) {
  e.stopPropagation();
  const ex = getExtra(id);
  setExtra(id, { [key]: !ex[key] || null });
  renderGrid();
}

function setSlot(e, id) {
  e.stopPropagation();
  setExtra(id, { slot: parseInt(e.target.value) || null });
}
