// SIZO — Factory de módulos CRUD operativos (Fase 3)
// Genera un módulo completo (tabla + modal + alta/edición + soft delete)
// a partir de una configuración declarativa. Todo va scopeado a la empresa
// activa del store y respeta las RLS de Supabase vía db.js.
import db                  from '../db.js'
import { get, subscribe }  from '../store.js'
import modal               from '../components/modal.js'
import toast               from '../components/toast.js'
import { esc }             from '../escape.js'
import { errorUsuario }    from '../errores.js'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export function fmtFecha(v) {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d) ? v : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function badge(valor, mapa) {
  const cls = mapa?.[valor] || 'badge-neutral'
  return `<span class="badge ${cls}">${esc(valor ?? '—')}</span>`
}

// ── Construye el módulo ───────────────────────────────────────
export function crearModulo(cfg) {
  let _items = []
  let _unsub = []

  async function render(container) {
    _unsub.forEach(fn => fn()); _unsub = []
    container.innerHTML = `<div id="crud-root"></div>`
    const pintar = () => montar(document.getElementById('crud-root'))
    if (cfg.requiereEmpresa !== false) {
      _unsub.push(subscribe('empresa', pintar))
    } else {
      pintar()
    }
  }

  async function montar(root) {
    if (!root) return
    const user    = get('user')
    const empresa = get('empresa')
    const puedeEscribir = user && user.rol !== 'CONSULTA'

    if (cfg.requiereEmpresa !== false && !empresa) {
      root.innerHTML = `
        <div class="page-header"><div>
          <h2 class="page-title">${cfg.titulo}</h2>
          <p class="page-subtitle">${cfg.subtitulo}</p>
        </div></div>
        <div class="empty-state">
          <div class="empty-state-icon">${cfg.icono || '📋'}</div>
          <h3 class="empty-state-title">Selecciona una empresa</h3>
          <p class="text-muted">Usa el selector de empresa en la barra superior</p>
        </div>`
      return
    }

    root.innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">${cfg.titulo}</h2>
          <p class="page-subtitle">${empresa ? empresa.nombre : cfg.subtitulo}</p>
        </div>
        <div style="display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap">
          ${(cfg.botones || []).map((b, i) => `<button class="btn ${b.clase || 'btn-secondary'}" id="crud-extra-${i}">${b.label}</button>`).join('')}
          ${puedeEscribir ? `<button class="btn btn-primary" id="crud-nuevo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg> ${cfg.labelNuevo || 'Nuevo'}
          </button>` : ''}
        </div>
      </div>
      <div id="crud-tabla"><div style="text-align:center;padding:var(--space-12)"><div class="spinner spinner-lg"></div></div></div>
    `

    if (puedeEscribir)
      document.getElementById('crud-nuevo').addEventListener('click', () => abrirForm(null))
    ;(cfg.botones || []).forEach((b, i) =>
      document.getElementById(`crud-extra-${i}`)?.addEventListener('click', b.onClick))

    await cargar()
  }

  async function cargar() {
    const wrap    = document.getElementById('crud-tabla')
    const empresa = get('empresa')
    if (!wrap) return
    try {
      const eq = { activo: true }
      if (cfg.requiereEmpresa !== false && empresa) eq.empresaId = empresa.id
      _items = await db.list(cfg.tabla, { eq, order: cfg.ordenPor || 'creadoEn', ascending: false })
      pintarTabla()
    } catch (err) {
      wrap.innerHTML = `<div class="alert alert-danger">${errorUsuario(err, `cargar ${cfg.tabla}`)}</div>`
    }
  }

  function pintarTabla() {
    const wrap = document.getElementById('crud-tabla')
    const user = get('user')
    const puedeEscribir = user && user.rol !== 'CONSULTA'
    if (!wrap) return

    if (!_items.length) {
      wrap.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">${cfg.icono || '📋'}</div>
          <h3 class="empty-state-title">Sin registros</h3>
          <p class="text-muted">Aún no hay ${cfg.titulo.toLowerCase()} registrados</p>
        </div>`
      return
    }

    wrap.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr>
            ${cfg.columnas.map(c => `<th>${c.label}</th>`).join('')}
            ${puedeEscribir ? '<th style="width:90px">Acciones</th>' : ''}
          </tr></thead>
          <tbody>
            ${_items.map(item => `
              <tr>
                ${cfg.columnas.map(c => `<td class="text-sm">${c.format ? c.format(item[c.key], item) : esc(item[c.key] ?? '—')}</td>`).join('')}
                ${puedeEscribir ? `<td>
                  <button class="btn btn-ghost btn-sm crud-editar" data-id="${item.id}" title="Editar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="btn btn-ghost btn-sm crud-borrar" data-id="${item.id}" title="Eliminar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </td>` : ''}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p class="text-xs text-muted" style="margin-top:var(--space-2);text-align:right">
        ${_items.length} registro${_items.length !== 1 ? 's' : ''}
      </p>
    `

    wrap.querySelectorAll('.crud-editar').forEach(b =>
      b.addEventListener('click', () => abrirForm(_items.find(i => i.id === b.dataset.id))))
    wrap.querySelectorAll('.crud-borrar').forEach(b =>
      b.addEventListener('click', () => borrar(_items.find(i => i.id === b.dataset.id))))
  }

  // ── Formulario ──────────────────────────────────────────────
  function abrirForm(item) {
    const esEdicion = !!item
    const d = item || {}

    const campoHTML = f => {
      const val = d[f.key] ?? f.default ?? ''
      const req = f.required ? 'required' : ''
      if (f.type === 'select') {
        return `<select name="${f.key}" ${req}>
          ${!f.required ? '<option value="">—</option>' : ''}
          ${f.options.map(o => {
            const v = typeof o === 'string' ? o : o.value
            const l = typeof o === 'string' ? o : o.label
            return `<option value="${v}" ${String(val) === String(v) ? 'selected' : ''}>${l}</option>`
          }).join('')}
        </select>`
      }
      if (f.type === 'textarea')
        return `<textarea name="${f.key}" rows="2">${esc(val)}</textarea>`
      if (f.type === 'checkbox')
        return `<label class="crud-check"><input type="checkbox" name="${f.key}" ${d[f.key] ? 'checked' : ''}/> ${f.checkLabel || 'Sí'}</label>`
      if (f.type === 'date')
        return `<input type="date" name="${f.key}" value="${esc(val ? String(val).slice(0,10) : '')}" ${req}/>`
      if (f.type === 'number')
        return `<input type="number" name="${f.key}" value="${esc(val)}" ${f.min != null ? `min="${f.min}"` : ''} ${f.step ? `step="${f.step}"` : ''} ${req}/>`
      return `<input type="text" name="${f.key}" value="${esc(val)}" ${req}/>`
    }

    const content = `
      <form id="crud-form" novalidate>
        <div class="crud-form-grid">
          ${cfg.campos.map(f => `
            <div class="form-group ${f.ancho === 'full' ? 'crud-full' : ''}">
              <label>${f.label}${f.required ? ' *' : ''}</label>
              ${campoHTML(f)}
            </div>`).join('')}
        </div>
        <div id="crud-form-error" class="form-error hidden"></div>
      </form>
    `

    modal.open({
      title: esEdicion ? `Editar — ${cfg.titulo}` : cfg.labelNuevo || `Nuevo registro`,
      content,
      footer: `
        <button class="btn btn-secondary" id="crud-cancelar">Cancelar</button>
        <button class="btn btn-primary" id="crud-guardar">${esEdicion ? 'Guardar' : 'Crear'}</button>`,
      size: 'lg',
    })
    addStyles()

    document.getElementById('crud-cancelar').addEventListener('click', () => modal.close())
    document.getElementById('crud-guardar').addEventListener('click', () => guardar(item))
  }

  async function guardar(item) {
    const form  = document.getElementById('crud-form')
    const errEl = document.getElementById('crud-form-error')
    const btn   = document.getElementById('crud-guardar')
    const fd    = new FormData(form)

    const payload = {}
    for (const f of cfg.campos) {
      if (f.type === 'checkbox') { payload[f.key] = fd.get(f.key) === 'on'; continue }
      let v = fd.get(f.key)
      if (f.type === 'number') {
        payload[f.key] = v === '' || v == null ? (f.required ? 0 : null) : Number(v)
      } else if (f.type === 'date') {
        payload[f.key] = v || null
      } else {
        v = (v || '').trim()
        payload[f.key] = v || (f.required ? v : null)
      }
    }

    // Validación de requeridos
    const faltante = cfg.campos.find(f => f.required && (payload[f.key] === '' || payload[f.key] == null))
    if (faltante) {
      errEl.textContent = `El campo "${faltante.label}" es obligatorio`
      errEl.classList.remove('hidden')
      return
    }

    // Hook de transformación (ej. calcular días, fecha de cierre)
    if (cfg.antesDeGuardar) cfg.antesDeGuardar(payload, item)

    const empresa = get('empresa')
    if (cfg.requiereEmpresa !== false && empresa) payload.empresaId = empresa.id

    btn.disabled = true
    btn.textContent = 'Guardando...'
    try {
      if (item) await db.update(cfg.tabla, item.id, payload)
      else      await db.insert(cfg.tabla, payload)
      toast.success(item ? 'Registro actualizado' : 'Registro creado')
      modal.close()
      await cargar()
    } catch (err) {
      errEl.textContent = errorUsuario(err, `guardar ${cfg.tabla}`)
      errEl.classList.remove('hidden')
      btn.disabled = false
      btn.textContent = item ? 'Guardar' : 'Crear'
    }
  }

  async function borrar(item) {
    if (!item) return
    modal.open({
      title: 'Confirmar eliminación',
      content: `<p>¿Eliminar este registro? Se marcará como inactivo (baja lógica).</p>`,
      footer: `
        <button class="btn btn-secondary" id="del-cancelar">Cancelar</button>
        <button class="btn btn-danger" id="del-confirmar">Eliminar</button>`,
      size: 'sm',
    })
    document.getElementById('del-cancelar').addEventListener('click', () => modal.close())
    document.getElementById('del-confirmar').addEventListener('click', async () => {
      try {
        await db.softDelete(cfg.tabla, item.id)
        toast.success('Registro eliminado')
        modal.close()
        await cargar()
      } catch (err) {
        toast.error(errorUsuario(err, `eliminar ${cfg.tabla}`))
      }
    })
  }

  return { render }
}

export { MESES }

function addStyles() {
  if (document.getElementById('crud-styles')) return
  const s = document.createElement('style')
  s.id = 'crud-styles'
  s.textContent = `
    .crud-form-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3) var(--space-4);
    }
    .crud-form-grid .crud-full { grid-column: 1 / -1; }
    .crud-form-grid .form-group label {
      display: block; font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-1);
    }
    .crud-form-grid input, .crud-form-grid select, .crud-form-grid textarea {
      width: 100%; padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-border); border-radius: var(--radius-md);
      background: var(--color-surface); color: var(--color-text-primary); font-size: var(--font-size-sm);
    }
    .crud-form-grid input:focus, .crud-form-grid select:focus, .crud-form-grid textarea:focus {
      border-color: var(--color-brand); outline: none;
    }
    .crud-check { display: flex; align-items: center; gap: var(--space-2); cursor: pointer; padding-top: var(--space-2); }
    .crud-check input { width: auto !important; }
    @media (max-width: 600px) { .crud-form-grid { grid-template-columns: 1fr; } }
  `
  document.head.appendChild(s)
}
