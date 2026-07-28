// SIZO — Gestor Documental (núcleo del producto)
// Fusiona archivos.js (storage/firma) y documentos-sst.js (taxonomía/vigencia)
// en un repositorio central único con historial de versiones.
import db from '../db.js'
import { get } from '../store.js'
import { supabase } from '../supabase.js'
import modal from '../components/modal.js'
import toast from '../components/toast.js'
import { esc } from '../escape.js'
import { errorUsuario } from '../errores.js'

// ── Estado del módulo ─────────────────────────────────────────
let _lista = []      // solo documentos esActual = true (repositorio)
let _empresas = []
let _filtros = { empresa: '', categoria: '', vigencia: '', desde: '', hasta: '' }
let _padActivo = null
let _imagenFirmaFile = null
let _firmaGeneradaDataUrl = null // firma predeterminada (generada a partir de un texto) seleccionada
let _posicionLibre = { xFrac: 0.60, yFrac: 0.76 } // posición del recuadro arrastrable, fracción del preview (origen arriba-izq.)
let _pdfBytesCache = null
let _totalPaginasCache = null
let _docReemplazo = null // documento que se está reemplazando (subir nueva versión)

const ESTILOS_FIRMA = [
  { font: "italic 46px 'Brush Script MT', cursive" },
  { font: "italic 42px 'Lucida Handwriting', 'Segoe Script', cursive" },
  { font: "italic bold 40px Georgia, 'Times New Roman', serif" },
]

const CATEGORIAS = [
  { value: 'politica',           label: 'Política SST' },
  { value: 'objetivos',          label: 'Objetivos del SG-SST' },
  { value: 'requisitos_legales', label: 'Matriz de requisitos legales' },
  { value: 'manual_sgsst',       label: 'Manual del SG-SST' },
  { value: 'matriz',             label: 'Matrices' },
  { value: 'acta',               label: 'Actas' },
  { value: 'registro',           label: 'Registros' },
  { value: 'certificado',        label: 'Certificados' },
  { value: 'informe',            label: 'Informes' },
  { value: 'otro',               label: 'Otros' },
]
const catLabel = v => CATEGORIAS.find(c => c.value === v)?.label || v

// ── Carga dinámica de librerías no-ESM (firma) ────────────────
function cargarScript(src) {
  return new Promise((resolve, reject) => {
    if ([...document.querySelectorAll('script')].some(s => s.getAttribute('src') === src)) {
      resolve(); return
    }
    const s = document.createElement('script')
    s.src = src
    s.onload = resolve
    s.onerror = () => reject(new Error(`No se pudo cargar ${src}`))
    document.head.appendChild(s)
  })
}
async function cargarLibs() {
  await cargarScript(new URL('../vendor/pdf-lib.min.js', import.meta.url).href)
  await cargarScript(new URL('../vendor/signature-pad.min.js', import.meta.url).href)
}

// ── Utilidades ────────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}
function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}
function generarFirmaPreset(nombre, font) {
  const canvas = document.createElement('canvas')
  canvas.width = 400
  canvas.height = 120
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.font = font
  ctx.fillStyle = '#1a1a2e'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(nombre, canvas.width / 2, canvas.height / 2)
  return canvas.toDataURL('image/png')
}

// Convierte una posición arrastrada en el preview (fracción 0..1, origen
// arriba-izquierda, como CSS) a coordenadas del PDF (puntos, origen
// abajo-izquierda, como pdf-lib). Se deja mover a cualquier parte de la
// página — solo se recorta para que la imagen no quede fuera del lienzo.
function fraccionAPosicionPdf(xFrac, yFrac, pw, ph, imgW, imgH) {
  const x = Math.min(Math.max(xFrac * pw, 0), Math.max(pw - imgW, 0))
  const y = Math.min(Math.max(ph - (yFrac * ph) - imgH, 0), Math.max(ph - imgH, 0))
  return { x, y }
}

function partirTexto(texto, maxLen) {
  const palabras = texto.replace(/\n/g, ' \n ').split(' ')
  const lineas = []
  let linea = ''
  for (const p of palabras) {
    if (p === '\n') { lineas.push(linea); linea = ''; continue }
    if ((linea + ' ' + p).trim().length > maxLen) {
      if (linea) lineas.push(linea)
      linea = p
    } else {
      linea = (linea + ' ' + p).trim()
    }
  }
  if (linea) lineas.push(linea)
  return lineas.slice(0, 30)
}

// ── Vigencia ──────────────────────────────────────────────────
function estadoVigencia(fechaVigencia) {
  if (!fechaVigencia) return { label: 'Sin definir', cls: 'badge-neutral', dias: null }
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const venc = new Date(fechaVigencia)
  const dias = Math.ceil((venc - hoy) / 86400000)
  if (dias < 0)  return { label: 'Vencido',    cls: 'badge-danger',  dias }
  if (dias <= 30) return { label: 'Por vencer', cls: 'badge-warning', dias }
  return { label: 'Vigente', cls: 'badge-success', dias }
}
function badgeVigencia(fechaVigencia) {
  const { label, cls } = estadoVigencia(fechaVigencia)
  return `<span class="badge ${cls}">${esc(label)}</span>`
}

// ── Render principal ──────────────────────────────────────────
async function render(container) {
  const user = get('user')

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Gestor Documental</h1>
        <p class="page-subtitle" style="color:var(--color-text-secondary);margin-top:2px;font-size:var(--font-size-sm)">
          Repositorio central de documentos SST — seguros, organizados y trazables
        </p>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost btn-icon" id="btn-ayuda-gd" title="¿Cómo usar el Gestor Documental?">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </button>
        ${user.rol !== 'CONSULTA' ? `
          <button class="btn btn-primary" id="btn-subir-doc">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Subir documento
          </button>` : ''}
      </div>
    </div>
    <div id="gd-stats"></div>
    <div id="gd-filtros"></div>
    <div id="gd-wrap">
      <div style="padding:40px;text-align:center"><div class="spinner spinner-lg"></div></div>
    </div>
  `

  document.getElementById('btn-ayuda-gd').addEventListener('click', abrirTutorial)
  if (user.rol !== 'CONSULTA') {
    document.getElementById('btn-subir-doc').addEventListener('click', () => abrirSubir())
  }

  await cargarDocumentos()
  agregarEstilos()
}

// ── Lista ─────────────────────────────────────────────────────
async function cargarDocumentos() {
  const wrap = document.getElementById('gd-wrap')
  try {
    const [lista, empresas] = await Promise.all([
      db.list('documentos', { eq: { activo: true, esActual: true }, order: 'updatedAt', ascending: false }),
      db.list('empresas', { order: 'nombre' }),
    ])
    _lista = lista
    _empresas = empresas
    renderStats(lista)
    renderFiltros(empresas)
    renderTabla(aplicarFiltros(lista))
  } catch (err) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <p>${esc(errorUsuario(err, 'cargar documentos'))}</p>
      </div>`
  }
}

function renderStats(lista) {
  const el = document.getElementById('gd-stats')
  const porVencer = lista.filter(d => estadoVigencia(d.fechaVigencia).label === 'Por vencer').length
  const vencidos  = lista.filter(d => estadoVigencia(d.fechaVigencia).label === 'Vencido').length
  el.innerHTML = `
    <div class="gd-stats-row">
      <div class="gd-stat-tile">
        <span class="gd-stat-num">${lista.length}</span>
        <span class="gd-stat-label">Documentos</span>
      </div>
      <div class="gd-stat-tile ${porVencer ? 'gd-stat-warning' : ''}">
        <span class="gd-stat-num">${porVencer}</span>
        <span class="gd-stat-label">Por vencer (30 días)</span>
      </div>
      <div class="gd-stat-tile ${vencidos ? 'gd-stat-danger' : ''}">
        <span class="gd-stat-num">${vencidos}</span>
        <span class="gd-stat-label">Vencidos</span>
      </div>
    </div>
  `
}

function renderFiltros(empresas) {
  const el = document.getElementById('gd-filtros')
  el.innerHTML = `
    <div class="gd-filtros-row">
      <select id="gd-f-empresa" class="form-select">
        <option value="">Todas las empresas</option>
        ${empresas.map(e => `<option value="${esc(e.id)}" ${_filtros.empresa === e.id ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}
      </select>
      <select id="gd-f-categoria" class="form-select">
        <option value="">Todas las categorías</option>
        ${CATEGORIAS.map(c => `<option value="${c.value}" ${_filtros.categoria === c.value ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}
      </select>
      <select id="gd-f-vigencia" class="form-select">
        <option value="">Cualquier estado</option>
        <option value="Vigente" ${_filtros.vigencia === 'Vigente' ? 'selected' : ''}>Vigente</option>
        <option value="Por vencer" ${_filtros.vigencia === 'Por vencer' ? 'selected' : ''}>Por vencer</option>
        <option value="Vencido" ${_filtros.vigencia === 'Vencido' ? 'selected' : ''}>Vencido</option>
        <option value="Sin definir" ${_filtros.vigencia === 'Sin definir' ? 'selected' : ''}>Sin definir</option>
      </select>
      <input type="date" id="gd-f-desde" class="form-input" value="${esc(_filtros.desde)}" title="Vigente desde">
      <input type="date" id="gd-f-hasta" class="form-input" value="${esc(_filtros.hasta)}" title="Vigente hasta">
      <button class="btn btn-sm btn-ghost" id="gd-f-limpiar">Limpiar</button>
    </div>
  `

  el.querySelectorAll('select, input').forEach(input => {
    input.addEventListener('change', () => {
      _filtros = {
        empresa:   document.getElementById('gd-f-empresa').value,
        categoria: document.getElementById('gd-f-categoria').value,
        vigencia:  document.getElementById('gd-f-vigencia').value,
        desde:     document.getElementById('gd-f-desde').value,
        hasta:     document.getElementById('gd-f-hasta').value,
      }
      renderTabla(aplicarFiltros(_lista))
    })
  })
  document.getElementById('gd-f-limpiar').addEventListener('click', () => {
    _filtros = { empresa: '', categoria: '', vigencia: '', desde: '', hasta: '' }
    renderFiltros(_empresas)
    renderTabla(aplicarFiltros(_lista))
  })
}

function aplicarFiltros(lista) {
  return lista.filter(d => {
    if (_filtros.empresa && d.empresaId !== _filtros.empresa) return false
    if (_filtros.categoria && d.categoria !== _filtros.categoria) return false
    if (_filtros.vigencia && estadoVigencia(d.fechaVigencia).label !== _filtros.vigencia) return false
    if (_filtros.desde && (!d.fechaVigencia || d.fechaVigencia < _filtros.desde)) return false
    if (_filtros.hasta && (!d.fechaVigencia || d.fechaVigencia > _filtros.hasta)) return false
    return true
  })
}

function renderTabla(lista) {
  const wrap = document.getElementById('gd-wrap')
  const user = get('user')
  const empMap = Object.fromEntries(_empresas.map(e => [e.id, e.nombre]))

  if (!lista.length) {
    const puedeSubir = user?.rol !== 'CONSULTA'
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📁</div>
        <h3 class="empty-state-title">Sin documentos</h3>
        <p class="empty-state-desc">${_lista.length ? 'Ningún documento coincide con los filtros.' : 'Sube tu primer documento para comenzar.'}</p>
        ${puedeSubir && !_lista.length ? '<button class="btn btn-primary btn-empty-cta" id="btn-empty-subir">Subir documento</button>' : ''}
      </div>`
    if (puedeSubir && !_lista.length) {
      document.getElementById('btn-empty-subir').addEventListener('click', () => abrirSubir())
    }
    return
  }

  wrap.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Documento</th>
            <th>Empresa</th>
            <th>Categoría</th>
            <th>Vigencia</th>
            <th>Firmado</th>
            <th>Actualizado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${lista.map(d => `
            <tr>
              <td>
                <span class="gd-nombre" data-accion="previsualizar" data-id="${esc(d.id)}" style="${d.storagePath ? 'cursor:pointer' : ''}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;color:var(--color-brand)">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  ${esc(d.nombre)}
                  ${d.version > 1 ? `<span class="badge badge-neutral" title="Versión ${d.version}">v${d.version}</span>` : ''}
                </span>
                ${d.descripcion ? `<div class="gd-subtexto" title="${esc(d.descripcion)}">${esc(d.descripcion)}</div>` : ''}
              </td>
              <td>${esc(empMap[d.empresaId] || 'General')}</td>
              <td>${esc(catLabel(d.categoria))}</td>
              <td>${badgeVigencia(d.fechaVigencia)}</td>
              <td>
                ${d.firmado
                  ? `<span class="badge badge-success">✓ Firmado</span>`
                  : `<span class="badge badge-neutral">Sin firmar</span>`}
              </td>
              <td style="white-space:nowrap">${formatFecha(d.updatedAt || d.creadoEn)}</td>
              <td>
                <div style="display:flex;gap:4px;flex-wrap:nowrap">
                  ${d.storagePath ? `
                    <button class="btn btn-sm btn-outline" data-accion="previsualizar" data-id="${esc(d.id)}" title="Previsualizar">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    <button class="btn btn-sm btn-outline" data-accion="descargar" data-id="${esc(d.id)}" title="Descargar">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                  ` : ''}
                  ${user.rol !== 'CONSULTA' ? `
                    ${d.storagePath ? `
                      <button class="btn btn-sm btn-outline" data-accion="firmar" data-id="${esc(d.id)}" title="Firmar / Agregar notas">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      </button>
                    ` : ''}
                    <button class="btn btn-sm btn-outline" data-accion="reemplazar" data-id="${esc(d.id)}" title="Reemplazar versión">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                    </button>
                  ` : ''}
                  ${d.version > 1 || d.versionAnteriorId ? `
                    <button class="btn btn-sm btn-outline" data-accion="historial" data-id="${esc(d.id)}" title="Ver historial de versiones">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </button>
                  ` : ''}
                  ${user.rol === 'ADMIN' ? `
                    <button class="btn btn-sm" style="color:var(--color-danger);border:1px solid var(--color-danger)" data-accion="eliminar" data-id="${esc(d.id)}" title="Eliminar">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `

  wrap.querySelectorAll('[data-accion]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { accion, id } = btn.dataset
      const doc = _lista.find(d => d.id === id)
      if (!doc) return
      if (accion === 'previsualizar') { if (doc.storagePath) abrirPrevisualizar(doc) }
      if (accion === 'descargar')     descargarDocumento(doc)
      if (accion === 'firmar')        abrirFirmar(doc)
      if (accion === 'reemplazar')    abrirSubir(doc)
      if (accion === 'historial')     abrirHistorial(doc)
      if (accion === 'eliminar')      eliminarDocumento(doc)
    })
  })
}

// ── Subir documento nuevo / reemplazar versión ────────────────
function abrirSubir(docOrigen = null) {
  const user = get('user')
  const empresas = _empresas
  const esReemplazo = !!docOrigen
  _docReemplazo = docOrigen

  modal.open({
    title: esReemplazo ? `Reemplazar versión — ${esc(docOrigen.nombre)}` : 'Subir documento',
    size: 'md',
    content: `
      <div class="form-group">
        <label class="form-label">Archivo PDF <span style="color:var(--color-danger)">*</span></label>
        <input type="file" id="subir-file" accept=".pdf,application/pdf" class="form-input" style="padding:6px">
      </div>
      <div class="form-group">
        <label class="form-label">Categoría <span style="color:var(--color-danger)">*</span></label>
        <select id="subir-categoria" class="form-select">
          ${CATEGORIAS.map(c => `<option value="${c.value}" ${esReemplazo && docOrigen.categoria === c.value ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Nombre del documento <span style="color:var(--color-danger)">*</span></label>
        <input type="text" id="subir-nombre" class="form-input" value="${esc(docOrigen?.nombre || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Empresa${user.rol !== 'ADMIN' ? ' <span style="color:var(--color-danger)">*</span>' : ''}</label>
        <select id="subir-empresa" class="form-select" ${esReemplazo ? 'disabled' : ''}>
          ${user.rol === 'ADMIN' ? `<option value="">— Sin empresa (general) —</option>` : ''}
          ${empresas.map(e => `<option value="${esc(e.id)}" ${docOrigen?.empresaId === e.id ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Descripción</label>
        <input type="text" id="subir-descripcion" class="form-input" value="${esc(docOrigen?.descripcion || '')}" placeholder="Ej: Política SST 2026">
      </div>
      <div class="form-group">
        <label class="form-label">Responsable</label>
        <input type="text" id="subir-responsable" class="form-input" value="${esc(docOrigen?.responsable || '')}">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Fecha de aprobación</label>
          <input type="date" id="subir-fecha-aprobacion" class="form-input" value="${esc(docOrigen?.fechaAprobacion || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Vigente hasta</label>
          <input type="date" id="subir-fecha-vigencia" class="form-input" value="${esc(docOrigen?.fechaVigencia || '')}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Contenido / resumen</label>
        <textarea id="subir-contenido" class="form-input" rows="3">${esc(docOrigen?.contenido || '')}</textarea>
      </div>
    `,
    footer: `
      <button class="btn btn-ghost" id="btn-cancelar-subir">Cancelar</button>
      <button class="btn btn-primary" id="btn-confirmar-subir">${esReemplazo ? 'Reemplazar' : 'Subir'}</button>
    `,
  })

  document.getElementById('btn-cancelar-subir').addEventListener('click', () => modal.close())
  document.getElementById('btn-confirmar-subir').addEventListener('click', async () => {
    const file = document.getElementById('subir-file').files[0]
    if (!file) { toast.error('Selecciona un archivo PDF'); return }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Solo se permiten archivos PDF'); return
    }

    const nombre = document.getElementById('subir-nombre').value.trim()
    if (!nombre) { toast.error('Ingresa el nombre del documento'); return }

    const empresaId = esReemplazo
      ? (docOrigen.empresaId || null)
      : (document.getElementById('subir-empresa').value || null)
    if (!esReemplazo && user.rol !== 'ADMIN' && !empresaId) {
      toast.error('Selecciona una empresa'); return
    }

    const datos = {
      categoria:        document.getElementById('subir-categoria').value,
      nombre,
      descripcion:       document.getElementById('subir-descripcion').value.trim() || null,
      responsable:       document.getElementById('subir-responsable').value.trim() || null,
      fechaAprobacion:   document.getElementById('subir-fecha-aprobacion').value || null,
      fechaVigencia:     document.getElementById('subir-fecha-vigencia').value || null,
      contenido:         document.getElementById('subir-contenido').value.trim() || null,
    }

    const btn = document.getElementById('btn-confirmar-subir')
    btn.disabled = true
    btn.textContent = 'Guardando...'

    try {
      if (esReemplazo) {
        await reemplazarVersion(docOrigen, file, empresaId, datos)
        toast.success('Nueva versión creada correctamente')
      } else {
        await subirDocumento(file, empresaId, datos)
        toast.success('Documento subido correctamente')
      }
      modal.close()
      await cargarDocumentos()
    } catch (err) {
      toast.error(errorUsuario(err, esReemplazo ? 'reemplazar documento' : 'subir documento'))
      btn.disabled = false
      btn.textContent = esReemplazo ? 'Reemplazar' : 'Subir'
    }
  })
}

async function subirArchivoStorage(file, empresaId) {
  const user = get('user')
  const uuid = crypto.randomUUID()
  const carpeta = empresaId || 'general'
  const storagePath = `${user.tenantId}/${carpeta}/${uuid}.pdf`

  const { error: storageErr } = await supabase.storage
    .from('documentos')
    .upload(storagePath, file, { contentType: 'application/pdf' })
  if (storageErr) throw new Error(storageErr.message)

  return { storagePath, tipoMime: 'application/pdf', tamanio: file.size }
}

async function subirDocumento(file, empresaId, datos) {
  const storageInfo = await subirArchivoStorage(file, empresaId)
  const nuevo = await db.insert('documentos', {
    empresaId,
    ...datos,
    ...storageInfo,
    firmado: false,
    version: 1,
    esActual: true,
  })
  // raizId apunta a sí mismo — se conoce el id solo tras el insert.
  await db.update('documentos', nuevo.id, { raizId: nuevo.id })
}

async function reemplazarVersion(docOrigen, file, empresaId, datos) {
  const storageInfo = await subirArchivoStorage(file, empresaId)
  const nuevo = await db.insert('documentos', {
    empresaId,
    ...datos,
    ...storageInfo,
    firmado: false,
    version: (docOrigen.version || 1) + 1,
    versionAnteriorId: docOrigen.id,
    raizId: docOrigen.raizId || docOrigen.id,
    esActual: true,
  })
  await db.update('documentos', docOrigen.id, { esActual: false })
  return nuevo
}

// ── Historial de versiones ─────────────────────────────────────
async function abrirHistorial(doc) {
  try {
    const raizId = doc.raizId || doc.id
    const historial = await db.list('documentos', { eq: { activo: true, raizId }, order: 'version', ascending: false })

    modal.open({
      title: `Historial — ${esc(doc.nombre)}`,
      size: 'md',
      content: `
        <div style="display:flex;flex-direction:column;gap:0">
          ${historial.map((h, i) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;${i < historial.length - 1 ? 'border-bottom:1px solid var(--color-border)' : ''}">
              <div>
                <div style="font-weight:600;font-size:var(--font-size-sm)">
                  v${h.version} ${h.esActual ? '<span class="badge badge-success" style="font-size:10px">Actual</span>' : '<span class="badge badge-neutral" style="font-size:10px">Archivada</span>'}
                </div>
                <div style="font-size:12px;color:var(--color-text-secondary)">${formatFecha(h.creadoEn)}</div>
              </div>
              ${h.storagePath ? `<button class="btn btn-sm btn-outline" data-hist-id="${esc(h.id)}">Ver</button>` : ''}
            </div>
          `).join('')}
        </div>
      `,
      footer: `<button class="btn btn-ghost" id="btn-cerrar-historial">Cerrar</button>`,
    })

    document.querySelectorAll('[data-hist-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const h = historial.find(x => x.id === btn.dataset.histId)
        if (h) abrirPrevisualizar(h)
      })
    })
    document.getElementById('btn-cerrar-historial').addEventListener('click', () => modal.close())
  } catch (err) {
    toast.error(errorUsuario(err, 'cargar historial'))
  }
}

// ── Previsualizar (solo lectura, sin firma) ──────────────────
async function abrirPrevisualizar(doc) {
  const { data: signed } = await supabase.storage.from('documentos').createSignedUrl(doc.storagePath, 300)
  const previewUrl = signed?.signedUrl || ''

  modal.open({
    title: `Vista previa — ${esc(doc.nombre)}`,
    size: 'lg',
    content: `
      ${previewUrl
        ? `<object data="${previewUrl}#toolbar=0&navpanes=0" type="application/pdf"
            style="width:100%;height:600px;border:1px solid var(--color-border);border-radius:var(--radius-md);background:#f8fafc">
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:600px;gap:12px;color:var(--color-text-secondary);border:1px solid var(--color-border);border-radius:var(--radius-md)">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span style="font-size:13px">Tu navegador no puede previsualizar PDFs</span>
              <a href="${previewUrl}" target="_blank" class="btn btn-sm btn-outline">Abrir en nueva pestaña</a>
            </div>
          </object>`
        : `<div style="display:flex;align-items:center;justify-content:center;height:600px;border:1px solid var(--color-border);border-radius:var(--radius-md);color:var(--color-text-secondary);font-size:13px">
            No se pudo cargar la vista previa
          </div>`}
    `,
    footer: `<button class="btn btn-ghost" id="btn-cerrar-previsualizar">Cerrar</button>`,
  })

  document.getElementById('btn-cerrar-previsualizar').addEventListener('click', () => modal.close())
}

// ── Firmar y agregar notas ────────────────────────────────────
async function abrirFirmar(doc) {
  _padActivo = null
  _imagenFirmaFile = null
  _firmaGeneradaDataUrl = null
  _posicionLibre = { xFrac: 0.60, yFrac: 0.76 }
  _pdfBytesCache = null
  _totalPaginasCache = null

  try {
    await cargarLibs()
  } catch (err) {
    toast.error('Error al cargar las librerías de firma. Verifica tu conexión.')
    return
  }

  let previewUrl = ''
  const { data: signed } = await supabase.storage.from('documentos').createSignedUrl(doc.storagePath, 300)
  if (signed?.signedUrl) previewUrl = signed.signedUrl

  const userFirmante = get('user')
  const nombreFirmante = userFirmante.nombre || userFirmante.email || 'Firmante'

  modal.open({
    title: `Firmar / Notas — ${esc(doc.nombre)}`,
    size: 'xl',
    content: `
      <div class="firma-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div>
          <label class="form-label" style="margin-bottom:8px;display:block">
            Vista previa — arrastra el recuadro para ubicar la firma
            ${doc.firmado ? '&nbsp;<span class="badge badge-success" style="font-size:10px">Ya firmado</span>' : ''}
          </label>
          <div id="firma-preview-wrap" style="position:relative;width:100%;height:420px">
            ${previewUrl
              ? `<object data="${previewUrl}#toolbar=0&navpanes=0" type="application/pdf"
                  style="width:100%;height:420px;border:1px solid var(--color-border);border-radius:var(--radius-md);background:#f8fafc">
                  <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:420px;gap:12px;color:var(--color-text-secondary);border:1px solid var(--color-border);border-radius:var(--radius-md)">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span style="font-size:13px">Tu navegador no puede previsualizar PDFs</span>
                    <a href="${previewUrl}" target="_blank" class="btn btn-sm btn-outline">Abrir en nueva pestaña</a>
                  </div>
                </object>`
              : `<div style="display:flex;align-items:center;justify-content:center;height:420px;border:1px solid var(--color-border);border-radius:var(--radius-md);color:var(--color-text-secondary);font-size:13px">
                  No se pudo cargar la vista previa
                </div>`}
            <div id="firma-drag-box" style="position:absolute;width:120px;height:48px;left:60%;top:76%;border:2px dashed var(--color-brand);border-radius:6px;background:rgba(255,255,255,0.6);cursor:move;display:flex;align-items:center;justify-content:center;overflow:hidden;touch-action:none;user-select:none">
              <span id="firma-drag-placeholder" style="font-size:10px;color:var(--color-brand);text-align:center;padding:2px;font-weight:600">Arrastra para posicionar</span>
              <img id="firma-drag-img" style="display:none;max-width:100%;max-height:100%;object-fit:contain;pointer-events:none">
            </div>
          </div>
          <div style="font-size:11px;color:var(--color-text-secondary);margin-top:4px">La posición es aproximada (no todos los visores de PDF renderizan igual).</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Firma dibujada</label>
            <div id="firma-canvas-outer" style="background:#fff;border:1px solid var(--color-border);border-radius:var(--radius-md);overflow:hidden;position:relative">
              <canvas id="firma-canvas" style="display:block;width:100%;height:140px;touch-action:none;cursor:crosshair"></canvas>
              <span id="firma-placeholder" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:13px;pointer-events:none;user-select:none">
                Dibuja tu firma aquí
              </span>
            </div>
            <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap">
              <button class="btn btn-sm btn-ghost" id="btn-limpiar-firma">Limpiar</button>
              <span style="color:var(--color-text-secondary);font-size:12px">— o —</span>
              <label class="btn btn-sm btn-outline" style="cursor:pointer;margin:0;font-weight:normal;font-size:12px">
                Subir imagen
                <input type="file" id="firma-imagen-input" accept="image/png,image/jpeg,image/jpg,image/webp" hidden>
              </label>
              <span id="firma-imagen-nombre" style="font-size:11px;color:var(--color-text-secondary)"></span>
            </div>
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Firma predeterminada <span style="font-weight:400;color:var(--color-text-secondary);font-size:11px">(si no puedes dibujar una firma legible)</span></label>
            <div style="display:flex;gap:6px">
              <input type="text" id="firma-texto-preset" class="form-input" value="${esc(nombreFirmante)}" placeholder="Texto de la firma" maxlength="60">
              <button type="button" class="btn btn-sm btn-outline" id="btn-generar-presets" style="flex-shrink:0">Generar</button>
            </div>
            <div id="firma-presets" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"></div>
          </div>
          <div class="form-group" style="margin-bottom:0;flex:0 0 120px">
            <label class="form-label">Página</label>
            <input type="number" id="firma-pagina" class="form-input" value="1" min="1" max="9999" style="max-width:120px">
            <div style="font-size:11px;color:var(--color-text-secondary);margin-top:4px" id="firma-info-paginas">Cargando…</div>
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Notas</label>
            <textarea id="firma-notas" class="form-input" rows="4"
              placeholder="Notas que se incrustarán en el PDF…"
              style="resize:vertical;font-size:13px">${esc(doc.notas || '')}</textarea>
          </div>
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-ghost" id="btn-cancelar-firma">Cancelar</button>
      <button class="btn btn-primary" id="btn-guardar-firma">Guardar en PDF</button>
    `,
  })

  requestAnimationFrame(() => {
    const canvas = document.getElementById('firma-canvas')
    if (!canvas) return
    canvas.width  = canvas.offsetWidth  || 600
    canvas.height = 180
    _padActivo = new window.SignaturePad(canvas, { penColor: '#1a1a2e' })
    _padActivo.addEventListener('beginStroke', () => {
      const ph = document.getElementById('firma-placeholder')
      if (ph) ph.style.display = 'none'
      _firmaGeneradaDataUrl = null
      document.querySelectorAll('.firma-preset-btn').forEach(b => b.classList.remove('active'))
    })
    _padActivo.addEventListener('endStroke', actualizarVistaDrag)
  })

  // ── Firma predeterminada generada a partir de un texto editable ──
  function generarPresets() {
    const texto = document.getElementById('firma-texto-preset').value.trim() || nombreFirmante
    const presetsWrap = document.getElementById('firma-presets')
    presetsWrap.innerHTML = ''
    ESTILOS_FIRMA.forEach((estilo, i) => {
      const dataUrl = generarFirmaPreset(texto, estilo.font)
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'firma-preset-btn'
      btn.title = `Usar firma predeterminada ${i + 1}`
      btn.innerHTML = `<img src="${dataUrl}" alt="Firma predeterminada ${i + 1}">`
      btn.addEventListener('click', () => {
        _firmaGeneradaDataUrl = dataUrl
        _imagenFirmaFile = null
        if (_padActivo) _padActivo.clear()
        const ph = document.getElementById('firma-placeholder')
        if (ph) ph.style.display = ''
        document.getElementById('firma-imagen-nombre').textContent = ''
        document.querySelectorAll('.firma-preset-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        actualizarVistaDrag()
      })
      presetsWrap.appendChild(btn)
    })
  }
  generarPresets()
  document.getElementById('btn-generar-presets').addEventListener('click', generarPresets)

  // ── Recuadro arrastrable sobre la vista previa ────────────────
  function fuenteFirmaActual() {
    if (_firmaGeneradaDataUrl) return _firmaGeneradaDataUrl
    if (_padActivo && !_padActivo.isEmpty()) return _padActivo.toDataURL('image/png')
    return null
  }

  async function actualizarVistaDrag() {
    const img = document.getElementById('firma-drag-img')
    const placeholder = document.getElementById('firma-drag-placeholder')
    let src = null
    if (_imagenFirmaFile) {
      src = await new Promise(resolve => {
        const reader = new FileReader()
        reader.onload = e => resolve(e.target.result)
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(_imagenFirmaFile)
      })
    } else {
      src = fuenteFirmaActual()
    }
    if (src) {
      img.src = src
      img.style.display = ''
      placeholder.style.display = 'none'
    } else {
      img.style.display = 'none'
      placeholder.style.display = ''
    }
  }

  ;(function inicializarDrag() {
    const wrap = document.getElementById('firma-preview-wrap')
    const box  = document.getElementById('firma-drag-box')
    if (!wrap || !box) return

    let arrastrando = false
    let offsetX = 0
    let offsetY = 0

    box.addEventListener('pointerdown', e => {
      arrastrando = true
      box.setPointerCapture(e.pointerId)
      const rectBox = box.getBoundingClientRect()
      offsetX = e.clientX - rectBox.left
      offsetY = e.clientY - rectBox.top
    })

    box.addEventListener('pointermove', e => {
      if (!arrastrando) return
      const rectWrap = wrap.getBoundingClientRect()
      const boxW = box.offsetWidth
      const boxH = box.offsetHeight
      let left = e.clientX - rectWrap.left - offsetX
      let top  = e.clientY - rectWrap.top  - offsetY
      left = Math.min(Math.max(left, 0), rectWrap.width  - boxW)
      top  = Math.min(Math.max(top,  0), rectWrap.height - boxH)
      _posicionLibre = { xFrac: left / rectWrap.width, yFrac: top / rectWrap.height }
      box.style.left = `${(left / rectWrap.width) * 100}%`
      box.style.top  = `${(top  / rectWrap.height) * 100}%`
    })

    box.addEventListener('pointerup', e => {
      arrastrando = false
      box.releasePointerCapture(e.pointerId)
    })
  })()

  ;(async () => {
    try {
      const { data: blob, error } = await supabase.storage.from('documentos').download(doc.storagePath)
      if (error) throw new Error(error.message)
      _pdfBytesCache = await blob.arrayBuffer()
      const pdfDoc = await window.PDFLib.PDFDocument.load(_pdfBytesCache)
      _totalPaginasCache = pdfDoc.getPageCount()
      const infoEl = document.getElementById('firma-info-paginas')
      const paginaEl = document.getElementById('firma-pagina')
      if (infoEl) infoEl.textContent = `Total: ${_totalPaginasCache} página${_totalPaginasCache !== 1 ? 's' : ''}`
      if (paginaEl) { paginaEl.max = _totalPaginasCache; paginaEl.value = _totalPaginasCache }
    } catch (err) {
      const infoEl = document.getElementById('firma-info-paginas')
      if (infoEl) infoEl.textContent = 'No se pudo precargar el PDF'
    }
  })()

  document.getElementById('btn-limpiar-firma').addEventListener('click', () => {
    if (_padActivo) _padActivo.clear()
    _imagenFirmaFile = null
    _firmaGeneradaDataUrl = null
    const ph = document.getElementById('firma-placeholder')
    if (ph) ph.style.display = ''
    document.getElementById('firma-imagen-nombre').textContent = ''
    document.querySelectorAll('.firma-preset-btn').forEach(b => b.classList.remove('active'))
    actualizarVistaDrag()
  })

  document.getElementById('firma-imagen-input').addEventListener('change', e => {
    _imagenFirmaFile = e.target.files[0] || null
    if (_imagenFirmaFile) {
      if (_padActivo) _padActivo.clear()
      _firmaGeneradaDataUrl = null
      const ph = document.getElementById('firma-placeholder')
      if (ph) ph.style.display = 'none'
      document.getElementById('firma-imagen-nombre').textContent = _imagenFirmaFile.name
      document.querySelectorAll('.firma-preset-btn').forEach(b => b.classList.remove('active'))
      actualizarVistaDrag()
    }
  })

  document.getElementById('btn-cancelar-firma').addEventListener('click', () => modal.close())

  document.getElementById('btn-guardar-firma').addEventListener('click', async () => {
    const notas  = document.getElementById('firma-notas').value.trim()
    const pagina = parseInt(document.getElementById('firma-pagina').value, 10) || 1
    const tieneFirmaCanvas = _padActivo && !_padActivo.isEmpty()

    if (!tieneFirmaCanvas && !_imagenFirmaFile && !notas) {
      toast.error('Agrega una firma, imagen o notas antes de guardar')
      return
    }

    const btn = document.getElementById('btn-guardar-firma')
    btn.disabled = true
    btn.textContent = 'Procesando…'

    try {
      await guardarFirma(doc, notas, pagina)
      modal.close()
      toast.success('PDF actualizado correctamente')
      await cargarDocumentos()
    } catch (err) {
      toast.error(errorUsuario(err, 'guardar firma'))
      btn.disabled = false
      btn.textContent = 'Guardar en PDF'
    }
  })
}

async function guardarFirma(doc, notas, pagina) {
  const { PDFDocument, rgb, StandardFonts } = window.PDFLib

  let arrayBuffer = _pdfBytesCache
  if (!arrayBuffer) {
    const { data: blob, error } = await supabase.storage.from('documentos').download(doc.storagePath)
    if (error) throw new Error(error.message)
    arrayBuffer = await blob.arrayBuffer()
  }

  const pdfDoc = await PDFDocument.load(arrayBuffer)
  const totalPaginas = _totalPaginasCache || pdfDoc.getPageCount()
  const pageIndex    = Math.min(Math.max(pagina - 1, 0), totalPaginas - 1)
  const page         = pdfDoc.getPage(pageIndex)
  const { width: pw, height: ph } = page.getSize()
  const MARGIN = 36

  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const gris     = rgb(0.55, 0.55, 0.55)
  const negro    = rgb(0.1, 0.1, 0.1)

  let firmaDataUrl = null
  if (_imagenFirmaFile) {
    firmaDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = e => resolve(e.target.result)
      reader.onerror = reject
      reader.readAsDataURL(_imagenFirmaFile)
    })
  } else if (_firmaGeneradaDataUrl) {
    firmaDataUrl = _firmaGeneradaDataUrl
  } else if (_padActivo && !_padActivo.isEmpty()) {
    firmaDataUrl = _padActivo.toDataURL('image/png')
  }

  if (firmaDataUrl) {
    const isJpeg = /^data:image\/jpe?g/.test(firmaDataUrl)
    const imgEmbed = isJpeg
      ? await pdfDoc.embedJpg(firmaDataUrl)
      : await pdfDoc.embedPng(firmaDataUrl)

    const maxW = Math.min(180, pw / 3)
    const maxH = 70
    const ratio = Math.min(maxW / imgEmbed.width, maxH / imgEmbed.height)
    const imgW  = imgEmbed.width  * ratio
    const imgH  = imgEmbed.height * ratio

    const { x: imgX, y: imgY } = fraccionAPosicionPdf(_posicionLibre.xFrac, _posicionLibre.yFrac, pw, ph, imgW, imgH)

    page.drawImage(imgEmbed, { x: imgX, y: imgY, width: imgW, height: imgH })

    const user = get('user')
    const lineaY   = imgY - 4
    const lineaAncho = Math.max(imgW, 140)

    page.drawLine({
      start: { x: imgX, y: lineaY },
      end:   { x: imgX + lineaAncho, y: lineaY },
      thickness: 0.5,
      color: gris,
    })

    const nombre   = user.nombre || user.email || 'Firmante'
    const fechaStr = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
    page.drawText(nombre,   { x: imgX, y: lineaY - 12, size: 7, font, color: gris })
    page.drawText(fechaStr, { x: imgX, y: lineaY - 21, size: 7, font, color: gris })
  }

  if (notas) {
    page.drawText('NOTAS:', { x: MARGIN, y: ph - MARGIN - 12, size: 8, font: fontBold, color: negro })
    const lineas = partirTexto(notas, 90)
    lineas.forEach((linea, i) => {
      page.drawText(linea, { x: MARGIN, y: ph - MARGIN - 24 - (i * 12), size: 8, font, color: negro })
    })
  }

  const pdfBytes = await pdfDoc.save()
  const blob     = new Blob([pdfBytes], { type: 'application/pdf' })

  const { error: uploadErr } = await supabase.storage
    .from('documentos')
    .upload(doc.storagePath, blob, { contentType: 'application/pdf', upsert: true })
  if (uploadErr) throw new Error(uploadErr.message)

  const user = get('user')
  await db.update('documentos', doc.id, {
    firmado:    true,
    firmadoPor: user.uid,
    firmadoEn:  new Date().toISOString(),
    ...(notas ? { notas } : {}),
  })
}

// ── Descargar ─────────────────────────────────────────────────
async function descargarDocumento(doc) {
  if (!doc.storagePath) { toast.warning('Este documento no tiene PDF adjunto'); return }
  try {
    const { data, error } = await supabase.storage
      .from('documentos')
      .createSignedUrl(doc.storagePath, 60)
    if (error) throw new Error(error.message)
    const a = document.createElement('a')
    a.href     = data.signedUrl
    a.download = doc.nombre
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } catch (err) {
    toast.error(errorUsuario(err, 'descargar documento'))
  }
}

// ── Eliminar ──────────────────────────────────────────────────
async function eliminarDocumento(doc) {
  if (!confirm(`¿Eliminar "${doc.nombre}"?\nEsta acción no se puede deshacer.`)) return
  try {
    if (doc.storagePath) await supabase.storage.from('documentos').remove([doc.storagePath])
    // RPC en vez de db.softDelete: el UPDATE directo vía PostgREST es
    // rechazado por RLS (42501) para esta tabla por una causa no resuelta
    // a nivel de policy declarativa — ver migración 012.
    const { error } = await supabase.rpc('soft_delete_documento', { p_id: doc.id })
    if (error) throw new Error(error.message)
    toast.success('Documento eliminado')
    await cargarDocumentos()
  } catch (err) {
    toast.error(errorUsuario(err, 'eliminar documento'))
  }
}

// ── Tutorial ──────────────────────────────────────────────────
function abrirTutorial() {
  const user = get('user')
  const pasos = [
    {
      icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
      titulo: 'Subir un documento',
      desc: user.rol === 'CONSULTA'
        ? 'Como CONSULTA puedes ver y descargar documentos, pero no subir nuevos.'
        : 'Haz clic en <strong>Subir documento</strong>, elige la categoría, el PDF, la empresa y opcionalmente la vigencia y el responsable.',
    },
    {
      icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
      titulo: 'Vigencia',
      desc: 'Cada documento con fecha de vigencia muestra un estado: <strong>Vigente</strong>, <strong>Por vencer</strong> (30 días) o <strong>Vencido</strong>. Los contadores arriba de la tabla resumen cuántos documentos necesitan atención.',
    },
    {
      icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
      titulo: 'Reemplazar versión',
      desc: 'Al subir una nueva versión de un documento existente, la anterior queda archivada (no se borra) y puedes consultarla desde <strong>Ver historial</strong>.',
    },
    {
      icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
      titulo: 'Firmar el PDF',
      desc: user.rol === 'CONSULTA'
        ? 'Solo ADMIN y ASESOR pueden firmar documentos.'
        : 'Haz clic en el ícono de <strong>lápiz</strong> en la fila del documento para dibujar una firma, subir una imagen de firma o agregar notas incrustadas en el PDF.',
    },
    {
      icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`,
      titulo: 'Filtros',
      desc: 'Filtra el repositorio por empresa, categoría, estado de vigencia y rango de fechas para encontrar rápido lo que necesitas.',
    },
  ]

  modal.open({
    title: '¿Cómo usar el Gestor Documental?',
    size: 'lg',
    content: `
      <div style="display:flex;flex-direction:column;gap:0">
        ${pasos.map((p, i) => `
          <div style="display:flex;gap:16px;padding:18px 0;${i < pasos.length - 1 ? 'border-bottom:1px solid var(--color-border)' : ''}">
            <div style="flex-shrink:0;width:52px;height:52px;border-radius:var(--radius-lg);background:var(--color-brand);display:flex;align-items:center;justify-content:center;color:#fff">
              ${p.icon}
            </div>
            <div>
              <div style="font-weight:600;color:var(--color-text-primary);margin-bottom:4px;font-size:var(--font-size-sm)">
                ${i + 1}. ${p.titulo}
              </div>
              <div style="font-size:var(--font-size-sm);color:var(--color-text-secondary);line-height:1.5">
                ${p.desc}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `,
    footer: `<button class="btn btn-primary" id="btn-cerrar-tutorial">Entendido</button>`,
  })

  document.getElementById('btn-cerrar-tutorial').addEventListener('click', () => modal.close())
}

// ── Estilos ───────────────────────────────────────────────────
function agregarEstilos() {
  if (document.getElementById('gd-styles')) return
  const style = document.createElement('style')
  style.id = 'gd-styles'
  style.textContent = `
    .gd-nombre {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
    }
    .gd-subtexto {
      font-size: 11px;
      color: var(--color-text-secondary);
      margin-top: 2px;
      max-width: 260px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .gd-stats-row {
      display: flex;
      gap: var(--space-3);
      margin-bottom: var(--space-3);
      flex-wrap: wrap;
    }
    .gd-stat-tile {
      flex: 1;
      min-width: 140px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .gd-stat-tile.gd-stat-warning { border-color: var(--color-warning-muted); }
    .gd-stat-tile.gd-stat-danger  { border-color: var(--color-danger-muted); }
    .gd-stat-num { font-size: 22px; font-weight: 700; color: var(--color-text-primary); }
    .gd-stat-label { font-size: 12px; color: var(--color-text-secondary); }
    .gd-filtros-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: var(--space-3);
    }
    .gd-filtros-row select, .gd-filtros-row input { min-width: 150px; }
    .firma-preset-btn {
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: #fff;
      padding: 4px 8px;
      cursor: pointer;
    }
    .firma-preset-btn img { display: block; height: 28px; width: auto; }
    .firma-preset-btn:hover { border-color: var(--color-brand); }
    .firma-preset-btn.active { border-color: var(--color-brand); border-width: 2px; background: var(--color-surface-2, #f1f5f9); }
    @media (max-width: 700px) {
      .firma-grid { grid-template-columns: 1fr !important; }
    }
  `
  document.head.appendChild(style)
}

export { render }
