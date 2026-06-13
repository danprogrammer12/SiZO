// ─────────────────────────────────────────────────────────────
// SIZO — Toast notifications
// Uso: toast.success('Mensaje') | toast.error('...') | toast.warning('...')
// ─────────────────────────────────────────────────────────────

const DURACION = 4000

function show(message, type = 'info') {
  const container = document.getElementById('toast-container')

  const iconMap = {
    success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
    error:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  }

  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`
  toast.innerHTML = `
    <span class="toast-icon">${iconMap[type] || iconMap.info}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" aria-label="Cerrar">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `

  toast.querySelector('.toast-close').addEventListener('click', () => remove(toast))
  container.appendChild(toast)

  // Entrada animada
  requestAnimationFrame(() => toast.classList.add('toast-visible'))

  const timer = setTimeout(() => remove(toast), DURACION)
  toast._timer = timer

  return toast
}

function remove(toast) {
  if (!toast || !toast.parentNode) return
  clearTimeout(toast._timer)
  toast.classList.remove('toast-visible')
  setTimeout(() => toast.remove(), 200)
}

function success(msg) { return show(msg, 'success') }
function error(msg)   { return show(msg, 'error')   }
function warning(msg) { return show(msg, 'warning')  }
function info(msg)    { return show(msg, 'info')     }

// Estilos
;(function addStyles() {
  if (document.getElementById('toast-styles')) return
  const style = document.createElement('style')
  style.id = 'toast-styles'
  style.textContent = `
    #toast-container {
      position: fixed;
      bottom: var(--space-6);
      right: var(--space-6);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      z-index: var(--z-toast);
      pointer-events: none;
    }
    .toast {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      max-width: 360px;
      pointer-events: all;
      transform: translateX(calc(100% + var(--space-6)));
      transition: transform var(--transition-base), opacity var(--transition-base);
      opacity: 0;
    }
    .toast.toast-visible {
      transform: translateX(0);
      opacity: 1;
    }
    .toast-success { background: #14532D; color: #86EFAC; border: 1px solid #166534; }
    .toast-error   { background: #450A0A; color: #FCA5A5; border: 1px solid #7F1D1D; }
    .toast-warning { background: #451A03; color: #FCD34D; border: 1px solid #78350F; }
    .toast-info    { background: #083344; color: #67E8F9; border: 1px solid #0E7490; }

    .dark .toast-success { background: #14532D; }
    .dark .toast-error   { background: #450A0A; }

    .toast-icon { flex-shrink: 0; }
    .toast-message { flex: 1; line-height: 1.4; }
    .toast-close {
      flex-shrink: 0;
      opacity: 0.7;
      cursor: pointer;
      border: none;
      background: none;
      color: inherit;
      padding: 0;
      display: flex;
    }
    .toast-close:hover { opacity: 1; }

    @media (max-width: 480px) {
      #toast-container { bottom: var(--space-4); right: var(--space-4); left: var(--space-4); }
      .toast { max-width: 100%; }
    }
  `
  document.head.appendChild(style)
})()

export default { success, error, warning, info }
