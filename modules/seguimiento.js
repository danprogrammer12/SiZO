// SIZO — Seguimiento Mensual (Fase 2)
import { get } from '../store.js'

async function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Seguimiento Mensual</h2>
        <p class="page-subtitle">Registro de datos operativos SG-SST por período</p>
      </div>
    </div>
    <div class="empty-state">
      <div class="empty-state-icon">📋</div>
      <h3 class="empty-state-title">Módulo en construcción</h3>
      <p class="text-muted">Disponible en Fase 2 — Core SG-SST</p>
    </div>
  `
}

export { render }
