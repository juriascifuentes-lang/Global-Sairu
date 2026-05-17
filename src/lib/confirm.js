let _show = null

export function registerConfirm(fn) {
  _show = fn
}

export function showConfirm(message, { title = "Confirmar", confirmLabel = "Aceptar", cancelLabel = "Cancelar", danger = false } = {}) {
  if (!_show) return Promise.resolve(window.confirm(message))
  return _show({ message, title, confirmLabel, cancelLabel, danger })
}
