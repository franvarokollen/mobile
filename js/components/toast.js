// ─── TOAST ─────────────────────────────────────────────────

let _toastUndoFn = null;

function showToast(msg, onUndo) {
  const el = document.getElementById('toast');
  _toastUndoFn = onUndo || null;

  if (onUndo) {
    el.innerHTML =
      `<span style="flex:1;overflow:hidden;text-overflow:ellipsis">${msg}</span>` +
      `<button class="toast-undo-btn" onclick="
        clearTimeout(toastTimer);
        document.getElementById('toast').classList.remove('has-undo','show');
        if(_toastUndoFn){_toastUndoFn();_toastUndoFn=null;}
      ">${t('toast.undo')}</button>`;
    el.classList.add('has-undo');
  } else {
    el.classList.remove('has-undo');
    el.textContent = msg;
  }

  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show', 'has-undo');
    _toastUndoFn = null;
  }, onUndo ? 20000 : 2200);
}
