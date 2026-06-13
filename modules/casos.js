// SIZO — Casos Médicos (Fase 4 — ADMIN only)
import { get } from '../store.js'

async function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Casos Médicos</h2>
        <p class="page-subtitle">Seguimiento de casos AT, EL y EG — acceso restringido ADMIN</p>
      </div>
    </div>
    <div class="empty-state">
      <div class="empty-state-icon">🩺</div>
      <h3 class="empty-state-title">Módulo en construcción</h3>
      <p class="text-muted">Disponible en Fase 4 — Módulos Complementarios</p>
    </div>
  `
}

export { render }
