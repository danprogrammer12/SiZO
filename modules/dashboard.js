// SIZO — Dashboard Ejecutivo (Fase 2)
import { get } from '../store.js'

async function render(container) {
  const empresa = get('empresa')
  const periodo = get('periodo')

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Dashboard Ejecutivo</h2>
        <p class="page-subtitle">Vista consolidada del cumplimiento SG-SST</p>
      </div>
    </div>
    <div class="empty-state">
      <div class="empty-state-icon">📊</div>
      <h3 class="empty-state-title">Módulo en construcción</h3>
      <p class="text-muted">Disponible en Fase 2 — Core SG-SST</p>
    </div>
  `
}

export { render }
