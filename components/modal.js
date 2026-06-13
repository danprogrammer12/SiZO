// ─────────────────────────────────────────────────────────────
// SIZO — Modal component
// Uso: modal.open({ title, content, footer, size, onClose })
// ─────────────────────────────────────────────────────────────

let activeModal = null

function open({ title = '', content = '', footer = '', size = 'md', onClose } = {}) {
  close()

  const sizeMap = { sm: '480px', md: '600px', lg: '800px', xl: '1000px' }

  const el = document.createElement('div')
  el.className = 'modal-overlay'
  el.innerHTML = `
    <div class="modal-box" style="max-width:${sizeMap[size] || sizeMap.md}" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="btn-ghost btn-icon modal-close" id="modal-close-btn" aria-label="Cerrar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="modal-content">${content}</div>
      ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
    </div>
  `

  el.addEventListener('click', e => {
    if (e.target === el) close()
  })

  el.querySelector('#modal-close-btn').addEventListener('click', close)

  document.getElementById('modal-root').appendChild(el)
  activeModal = { el, onClose }

  // Cierra con Escape
  document.addEventListener('keydown', handleEscape)

  // Foco dentro del modal
  requestAnimationFrame(() => {
    const first = el.querySelector('input, select, textarea, button')
    if (first) first.focus()
  })
}

function close() {
  if (!activeModal) return
  const { el, onClose } = activeModal
  el.remove()
  activeModal = null
  document.removeEventListener('keydown', handleEscape)
  if (typeof onClose === 'function') onClose()
}

function handleEscape(e) {
  if (e.key === 'Escape') close()
}

// Inyectar estilos una sola vez
;(function addStyles() {
  if (document.getElementById('modal-styles')) return
  const style = document.createElement('style')
  style.id = 'modal-styles'
  style.textContent = `
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgb(0 0 0 / 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: var(--z-modal);
      padding: var(--space-4);
      animation: modal-fade-in 150ms ease;
    }
    @keyframes modal-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .modal-box {
      width: 100%;
      background-color: var(--color-surface);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-xl);
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      animation: modal-slide-in 150ms ease;
    }
    @keyframes modal-slide-in {
      from { transform: translateY(-16px); opacity: 0; }
      to   { transform: translateY(0); opacity: 1; }
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-5) var(--space-6);
      border-bottom: 1px solid var(--color-border);
      flex-shrink: 0;
    }
    .modal-title {
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
    }
    .modal-content {
      padding: var(--space-6);
      overflow-y: auto;
      flex: 1;
    }
    .modal-footer {
      padding: var(--space-4) var(--space-6);
      border-top: 1px solid var(--color-border);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-3);
      flex-shrink: 0;
    }
    @media (max-width: 480px) {
      .modal-overlay { padding: 0; align-items: flex-end; }
      .modal-box { border-radius: var(--radius-xl) var(--radius-xl) 0 0; max-height: 95vh; }
    }
  `
  document.head.appendChild(style)
})()

export default { open, close }
