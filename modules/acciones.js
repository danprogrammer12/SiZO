// SIZO — Acciones ACPM (Fase 3)
import { get } from '../store.js'

async function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Acciones ACPM</h2>
        <p class="page-subtitle">Acciones correctivas, preventivas y de mejora</p>
      </div>
    </div>
    <div class="empty-state">
      <div class="empty-state-icon">⚡</div>
      <h3 class="empty-state-title">Módulo en construcción</h3>
      <p class="text-muted">Disponible en Fase 3 — Módulos Operativos</p>
    </div>
  `
}

export { render }
