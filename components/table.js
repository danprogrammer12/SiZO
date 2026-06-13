// ─────────────────────────────────────────────────────────────
// SIZO — Data table component
// Uso: table.render(container, { columns, rows, onAction })
// ─────────────────────────────────────────────────────────────

function render(container, { columns = [], rows = [], emptyMsg = 'Sin registros', onAction } = {}) {
  if (!container) return

  if (rows.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <p class="empty-state-title">${emptyMsg}</p>
      </div>`
    return
  }

  container.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            ${columns.map(col => `
              <th style="${col.width ? `width:${col.width}` : ''}">${col.label}</th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, rowIdx) => `
            <tr data-idx="${rowIdx}">
              ${columns.map(col => `
                <td>${renderCell(col, row, rowIdx)}</td>
              `).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `

  if (typeof onAction === 'function') {
    container.querySelector('tbody').addEventListener('click', e => {
      const btn = e.target.closest('[data-action]')
      if (!btn) return
      const rowIdx = parseInt(btn.closest('tr').dataset.idx)
      onAction(btn.dataset.action, rows[rowIdx], rowIdx)
    })
  }
}

function renderCell(col, row, rowIdx) {
  const value = col.key ? row[col.key] : ''

  if (col.render) return col.render(value, row, rowIdx)

  if (col.type === 'semaforo') {
    const clase = semaforo(parseFloat(value))
    return `<span class="semaforo-pill ${clase}">${value ?? '—'}%</span>`
  }

  if (col.type === 'badge') {
    return `<span class="badge badge-${col.color || 'neutral'}">${value ?? '—'}</span>`
  }

  if (col.type === 'progress') {
    const pct   = Math.min(100, Math.max(0, parseFloat(value) || 0))
    const clase = semaforo(pct)
    return `
      <div style="display:flex;align-items:center;gap:8px">
        <div class="progress-bar" style="flex:1">
          <div class="progress-bar-fill ${clase}" style="width:${pct}%"></div>
        </div>
        <span style="font-size:12px;font-weight:600;color:var(--color-text-secondary);white-space:nowrap">${pct}%</span>
      </div>`
  }

  if (col.type === 'actions') {
    return (col.actions || []).map(a => `
      <button class="btn btn-ghost btn-sm" data-action="${a.action}" title="${a.label}">
        ${a.icon || a.label}
      </button>`).join('')
  }

  return value ?? '—'
}

function semaforo(pct) {
  if (pct >= 85) return 'verde'
  if (pct >= 61) return 'amarillo'
  if (pct >= 41) return 'naranja'
  return 'rojo'
}

export default { render }
