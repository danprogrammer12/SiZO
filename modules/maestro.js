// SIZO — Maestro de Indicadores (Fase 2)
// Catálogo de fichas técnicas: fórmula, meta, periodicidad y normativa de cada KPI.
import { CATALOGO } from '../catalogo.js'

const TIPO_BADGE = { Resultado: 'badge-danger', Proceso: 'badge-brand', Base: 'badge-neutral' }

async function render(container) {
  const fichas = Object.entries(CATALOGO)

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Maestro de Indicadores</h2>
        <p class="page-subtitle">Fichas técnicas y metas de los ${fichas.length} KPIs SG-SST</p>
      </div>
    </div>

    <div class="maestro-grid">
      ${fichas.map(([key, f]) => `
        <div class="card maestro-card">
          <div class="maestro-head">
            <h4 class="maestro-nom">${f.nom}</h4>
            <span class="badge ${TIPO_BADGE[f.tipo] || 'badge-neutral'}">${f.tipo}</span>
          </div>
          <div class="maestro-formula">${f.formula}</div>
          <dl class="maestro-meta">
            <div><dt>Meta</dt><dd>${f.meta != null ? f.meta + (f.u === '%' ? '%' : ` ${f.u}`) : '—'} ${f.inv ? '<span class="text-muted">(menor mejor)</span>' : ''}</dd></div>
            <div><dt>Periodicidad</dt><dd>${f.periodicidad}</dd></div>
            <div><dt>Unidad</dt><dd>${f.u}</dd></div>
            <div><dt>Normativa</dt><dd>${f.normativa}</dd></div>
          </dl>
        </div>`).join('')}
    </div>
  `
  addStyles()
}

function addStyles() {
  if (document.getElementById('maestro-styles')) return
  const s = document.createElement('style')
  s.id = 'maestro-styles'
  s.textContent = `
    .maestro-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: var(--space-4);
    }
    .maestro-card { padding: var(--space-4); }
    .maestro-head {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: var(--space-2); margin-bottom: var(--space-3);
    }
    .maestro-nom { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); }
    .maestro-formula {
      font-family: var(--font-mono, monospace); font-size: var(--font-size-xs);
      background: var(--color-surface-2); border-radius: var(--radius-md);
      padding: var(--space-2) var(--space-3); color: var(--color-text-secondary);
      margin-bottom: var(--space-3);
    }
    .maestro-meta { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); }
    .maestro-meta dt { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: var(--color-text-muted); }
    .maestro-meta dd { font-size: var(--font-size-sm); color: var(--color-text-primary); font-weight: var(--font-weight-medium); }
  `
  document.head.appendChild(s)
}

export { render }
