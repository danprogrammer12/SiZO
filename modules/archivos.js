import db from '../db.js'
import { get } from '../store.js'
import { supabase } from '../supabase.js'
import modal from '../components/modal.js'
import toast from '../components/toast.js'
import { esc } from '../escape.js'
import { errorUsuario } from '../errores.js'

// ── Estado del módulo ─────────────────────────────────────────
let _lista = []
let _empresas = []
let _padActivo = null
let _imagenFirmaFile = null
let _pdfBytesCache = null
let _totalPaginasCache = null

// ── Carga dinámica de librerías no-ESM ───────────────────────
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

// ── Render principal ──────────────────────────────────────────
async function render(container) {
  const user = get('user')

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Archivos</h1>
        <p class="page-subtitle" style="color:var(--color-text-secondary);margin-top:2px;font-size:var(--font-size-sm)">
          Gestión de documentos PDF — firma y notas
        </p>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost btn-icon" id="btn-ayuda-archivos" title="¿Cómo usar el gestor de archivos?">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </button>
        ${user.rol !== 'CONSULTA' ? `
          <button class="btn btn-primary" id="btn-subir-pdf">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Subir PDF
          </button>` : ''}
      </div>
    </div>
    <div id="archivos-wrap">
      <div style="padding:40px;text-align:center"><div class="spinner spinner-lg"></div></div>
    </div>
  `

  document.getElementById('btn-ayuda-archivos').addEventListener('click', abrirTutorial)
  if (user.rol !== 'CONSULTA') {
    document.getElementById('btn-subir-pdf').addEventListener('click', abrirSubir)
  }

  await cargarArchivos()
  agregarEstilos()
}

// ── Lista ─────────────────────────────────────────────────────
async function cargarArchivos() {
  const wrap = document.getElementById('archivos-wrap')
  try {
    const [lista, empresas] = await Promise.all([
      db.list('archivos', { eq: { activo: true }, order: 'creadoEn', ascending: false }),
      db.list('empresas', { order: 'nombre' }),
    ])
    _lista = lista
    _empresas = empresas
    renderTabla(lista, empresas)
  } catch (err) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <p>${esc(errorUsuario(err, 'cargar archivos'))}</p>
      </div>`
  }
}

function renderTabla(lista, empresas) {
  const wrap = document.getElementById('archivos-wrap')
  const user = get('user')
  const empMap = Object.fromEntries(empresas.map(e => [e.id, e.nombre]))

  if (!lista.length) {
    const puedeSubir = user?.rol !== 'CONSULTA'
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📄</div>
        <h3 class="empty-state-title">Sin archivos</h3>
        <p class="empty-state-desc">Sube tu primer PDF para comenzar.</p>
        ${puedeSubir ? '<button class="btn btn-primary btn-empty-cta" id="btn-empty-subir">Subir PDF</button>' : ''}
      </div>`
    if (puedeSubir) {
      document.getElementById('btn-empty-subir').addEventListener('click', abrirSubir)
    }
    return
  }

  wrap.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Empresa</th>
            <th>Descripción</th>
            <th>Tamaño</th>
            <th>Estado</th>
            <th>Fecha</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${lista.map(a => `
            <tr>
              <td>
                <span class="archivo-nombre" data-accion="previsualizar" data-id="${esc(a.id)}" style="cursor:pointer">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;color:var(--color-brand)">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  ${esc(a.nombre)}
                </span>
              </td>
              <td>${esc(empMap[a.empresaId] || '—')}</td>
              <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(a.descripcion || '')}">${esc(a.descripcion || '—')}</td>
              <td style="white-space:nowrap">${formatBytes(a.tamanio)}</td>
              <td>
                ${a.firmado
                  ? `<span class="badge badge-success">✓ Firmado</span>`
                  : `<span class="badge badge-neutral">Sin firmar</span>`}
              </td>
              <td style="white-space:nowrap">${formatFecha(a.creadoEn)}</td>
              <td>
                <div style="display:flex;gap:4px;flex-wrap:nowrap">
                  <button class="btn btn-sm btn-outline" data-accion="previsualizar" data-id="${esc(a.id)}" title="Previsualizar PDF">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                  <button class="btn btn-sm btn-outline" data-accion="descargar" data-id="${esc(a.id)}" title="Descargar PDF">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </button>
                  ${user.rol !== 'CONSULTA' ? `
                    <button class="btn btn-sm btn-outline" data-accion="firmar" data-id="${esc(a.id)}" title="Firmar / Agregar notas">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                      </svg>
                    </button>
                  ` : ''}
                  ${user.rol === 'ADMIN' ? `
                    <button class="btn btn-sm" style="color:var(--color-danger);border:1px solid var(--color-danger)" data-accion="eliminar" data-id="${esc(a.id)}" title="Eliminar">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4h6v2"/>
                      </svg>
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
      const archivo = _lista.find(a => a.id === id)
      if (!archivo) return
      if (accion === 'previsualizar') abrirPrevisualizar(archivo)
      if (accion === 'descargar')     descargarArchivo(archivo)
      if (accion === 'firmar')        abrirFirmar(archivo)
      if (accion === 'eliminar')      eliminarArchivo(archivo)
    })
  })
}

// ── Subir PDF ─────────────────────────────────────────────────
function abrirSubir() {
  const user = get('user')
  const empresas = _empresas

  modal.open({
    title: 'Subir PDF',
    size: 'md',
    content: `
      <div class="form-group">
        <label class="form-label">Archivo PDF <span style="color:var(--color-danger)">*</span></label>
        <input type="file" id="subir-file" accept=".pdf,application/pdf" class="form-input" style="padding:6px">
      </div>
      <div class="form-group">
        <label class="form-label">Empresa${user.rol !== 'ADMIN' ? ' <span style="color:var(--color-danger)">*</span>' : ''}</label>
        <select id="subir-empresa" class="form-select">
          ${user.rol === 'ADMIN' ? '<option value="">— Sin empresa (general) —</option>' : ''}
          ${empresas.map(e => `<option value="${esc(e.id)}">${esc(e.nombre)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Descripción</label>
        <input type="text" id="subir-descripcion" class="form-input" placeholder="Ej: Política SST 2025">
      </div>
    `,
    footer: `
      <button class="btn btn-ghost" id="btn-cancelar-subir">Cancelar</button>
      <button class="btn btn-primary" id="btn-confirmar-subir">Subir</button>
    `,
  })

  document.getElementById('btn-cancelar-subir').addEventListener('click', () => modal.close())
  document.getElementById('btn-confirmar-subir').addEventListener('click', async () => {
    const fileInput = document.getElementById('subir-file')
    const file = fileInput.files[0]
    if (!file) { toast.error('Selecciona un archivo PDF'); return }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Solo se permiten archivos PDF'); return
    }

    const empresaId = document.getElementById('subir-empresa').value || null
    if (user.rol !== 'ADMIN' && !empresaId) {
      toast.error('Selecciona una empresa'); return
    }

    const descripcion = document.getElementById('subir-descripcion').value.trim() || null
    const btn = document.getElementById('btn-confirmar-subir')
    btn.disabled = true
    btn.textContent = 'Subiendo...'

    try {
      await subirArchivo(file, empresaId, descripcion)
      modal.close()
      toast.success('PDF subido correctamente')
      await cargarArchivos()
    } catch (err) {
      toast.error(errorUsuario(err, 'subir archivo'))
      btn.disabled = false
      btn.textContent = 'Subir'
    }
  })
}

async function subirArchivo(file, empresaId, descripcion) {
  const user = get('user')
  const uuid = crypto.randomUUID()
  const carpeta = empresaId || 'general'
  const storagePath = `${user.tenantId}/${carpeta}/${uuid}.pdf`

  const { error: storageErr } = await supabase.storage
    .from('documentos')
    .upload(storagePath, file, { contentType: 'application/pdf' })

  if (storageErr) throw new Error(storageErr.message)

  await db.insert('archivos', {
    empresaId: empresaId || null,
    nombre: file.name,
    descripcion,
    storagePath,
    tipoMime: 'application/pdf',
    tamanio: file.size,
    firmado: false,
  })
}

// ── Previsualizar (solo lectura, sin firma) ──────────────────
async function abrirPrevisualizar(archivo) {
  const { data: signed } = await supabase.storage.from('documentos').createSignedUrl(archivo.storagePath, 300)
  const previewUrl = signed?.signedUrl || ''

  modal.open({
    title: `Vista previa — ${esc(archivo.nombre)}`,
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
async function abrirFirmar(archivo) {
  // Resetear estado de firma
  _padActivo = null
  _imagenFirmaFile = null
  _pdfBytesCache = null
  _totalPaginasCache = null

  try {
    await cargarLibs()
  } catch (err) {
    toast.error('Error al cargar las librerías de firma. Verifica tu conexión.')
    return
  }

  // Generar URL firmada para vista previa (5 minutos)
  let previewUrl = ''
  const { data: signed } = await supabase.storage.from('documentos').createSignedUrl(archivo.storagePath, 300)
  if (signed?.signedUrl) previewUrl = signed.signedUrl

  modal.open({
    title: `Firmar / Notas — ${esc(archivo.nombre)}`,
    size: 'xl',
    content: `
      <div class="firma-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:20px">

        <!-- Vista previa -->
        <div>
          <label class="form-label" style="margin-bottom:8px;display:block">
            Vista previa
            ${archivo.firmado ? '&nbsp;<span class="badge badge-success" style="font-size:10px">Ya firmado</span>' : ''}
          </label>
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
        </div>

        <!-- Panel de firma -->
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
            <label class="form-label">Notas</label>
            <textarea id="firma-notas" class="form-input" rows="4"
              placeholder="Notas que se incrustarán en el PDF…"
              style="resize:vertical;font-size:13px">${esc(archivo.notas || '')}</textarea>
          </div>

          <div style="display:flex;gap:12px;align-items:flex-end">
            <div class="form-group" style="flex:0 0 120px;margin-bottom:0">
              <label class="form-label">Página</label>
              <input type="number" id="firma-pagina" class="form-input" value="1" min="1" max="9999">
            </div>
            <div style="font-size:12px;color:var(--color-text-secondary);padding-bottom:8px" id="firma-info-paginas">Cargando…</div>
          </div>
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-ghost" id="btn-cancelar-firma">Cancelar</button>
      <button class="btn btn-primary" id="btn-guardar-firma">Guardar en PDF</button>
    `,
  })

  // Inicializar canvas con dimensiones reales una vez renderizado
  requestAnimationFrame(() => {
    const canvas = document.getElementById('firma-canvas')
    if (!canvas) return
    canvas.width  = canvas.offsetWidth  || 600
    canvas.height = 180
    _padActivo = new window.SignaturePad(canvas, { penColor: '#1a1a2e' })

    _padActivo.addEventListener('beginStroke', () => {
      const ph = document.getElementById('firma-placeholder')
      if (ph) ph.style.display = 'none'
    })
  })

  // Precargar PDF para conocer número de páginas y evitar doble descarga al guardar
  ;(async () => {
    try {
      const { data: blob, error } = await supabase.storage.from('documentos').download(archivo.storagePath)
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

  // Listeners del modal
  document.getElementById('btn-limpiar-firma').addEventListener('click', () => {
    if (_padActivo) _padActivo.clear()
    _imagenFirmaFile = null
    const ph = document.getElementById('firma-placeholder')
    if (ph) ph.style.display = ''
    document.getElementById('firma-imagen-nombre').textContent = ''
  })

  document.getElementById('firma-imagen-input').addEventListener('change', e => {
    _imagenFirmaFile = e.target.files[0] || null
    if (_imagenFirmaFile) {
      if (_padActivo) _padActivo.clear()
      const ph = document.getElementById('firma-placeholder')
      if (ph) ph.style.display = 'none'
      document.getElementById('firma-imagen-nombre').textContent = _imagenFirmaFile.name
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
      await guardarFirma(archivo, notas, pagina)
      modal.close()
      toast.success('PDF actualizado correctamente')
      await cargarArchivos()
    } catch (err) {
      toast.error(errorUsuario(err, 'guardar firma'))
      btn.disabled = false
      btn.textContent = 'Guardar en PDF'
    }
  })
}

async function guardarFirma(archivo, notas, pagina) {
  const { PDFDocument, rgb, StandardFonts } = window.PDFLib

  // Usar bytes precargados si están disponibles
  let arrayBuffer = _pdfBytesCache
  if (!arrayBuffer) {
    const { data: blob, error } = await supabase.storage.from('documentos').download(archivo.storagePath)
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

  // ── Firma (imagen canvas o archivo subido) ──────────────────
  let firmaDataUrl = null
  if (_imagenFirmaFile) {
    firmaDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = e => resolve(e.target.result)
      reader.onerror = reject
      reader.readAsDataURL(_imagenFirmaFile)
    })
  } else if (_padActivo && !_padActivo.isEmpty()) {
    firmaDataUrl = _padActivo.toDataURL('image/png')
  }

  let alturaFirma = 0

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

    page.drawImage(imgEmbed, {
      x: pw - MARGIN - imgW,
      y: MARGIN + 20,
      width:  imgW,
      height: imgH,
    })
    alturaFirma = imgH + 20
  }

  // Línea y nombre del firmante bajo la imagen
  if (firmaDataUrl) {
    const user = get('user')
    const lineaY = MARGIN + 16

    page.drawLine({
      start: { x: pw - MARGIN - 180, y: lineaY },
      end:   { x: pw - MARGIN, y: lineaY },
      thickness: 0.5,
      color: gris,
    })

    const nombre   = user.nombre || user.email || 'Firmante'
    const fechaStr = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
    page.drawText(`${nombre}`, { x: pw - MARGIN - 180, y: lineaY - 12, size: 7, font, color: gris })
    page.drawText(fechaStr,    { x: pw - MARGIN - 180, y: lineaY - 21, size: 7, font, color: gris })
  }

  // ── Notas en esquina superior izquierda ─────────────────────
  if (notas) {
    page.drawText('NOTAS:', {
      x: MARGIN,
      y: ph - MARGIN - 12,
      size: 8,
      font: fontBold,
      color: negro,
    })

    const lineas = partirTexto(notas, 90)
    lineas.forEach((linea, i) => {
      page.drawText(linea, {
        x: MARGIN,
        y: ph - MARGIN - 24 - (i * 12),
        size: 8,
        font,
        color: negro,
      })
    })
  }

  // ── Guardar y re-subir ──────────────────────────────────────
  const pdfBytes = await pdfDoc.save()
  const blob     = new Blob([pdfBytes], { type: 'application/pdf' })

  const { error: uploadErr } = await supabase.storage
    .from('documentos')
    .upload(archivo.storagePath, blob, { contentType: 'application/pdf', upsert: true })

  if (uploadErr) throw new Error(uploadErr.message)

  const user = get('user')
  await db.update('archivos', archivo.id, {
    firmado:    true,
    firmadoPor: user.uid,
    firmadoEn:  new Date().toISOString(),
    ...(notas ? { notas } : {}),
  })
}

// ── Descargar ─────────────────────────────────────────────────
async function descargarArchivo(archivo) {
  try {
    const { data, error } = await supabase.storage
      .from('documentos')
      .createSignedUrl(archivo.storagePath, 60)
    if (error) throw new Error(error.message)
    const a = document.createElement('a')
    a.href     = data.signedUrl
    a.download = archivo.nombre
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } catch (err) {
    toast.error(errorUsuario(err, 'descargar archivo'))
  }
}

// ── Eliminar ──────────────────────────────────────────────────
async function eliminarArchivo(archivo) {
  if (!confirm(`¿Eliminar "${archivo.nombre}"?\nEsta acción no se puede deshacer.`)) return
  try {
    await supabase.storage.from('documentos').remove([archivo.storagePath])
    await db.softDelete('archivos', archivo.id)
    toast.success('Archivo eliminado')
    await cargarArchivos()
  } catch (err) {
    toast.error(errorUsuario(err, 'eliminar archivo'))
  }
}

// ── Tutorial ──────────────────────────────────────────────────
function abrirTutorial() {
  const user = get('user')
  const pasos = [
    {
      icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
      titulo: 'Subir un PDF',
      desc: user.rol === 'CONSULTA'
        ? 'Como CONSULTA puedes ver y descargar los archivos, pero no subir nuevos.'
        : 'Haz clic en <strong>Subir PDF</strong>, selecciona el archivo, elige la empresa a la que pertenece y agrega una descripción opcional.',
    },
    {
      icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
      titulo: 'Firmar el PDF',
      desc: user.rol === 'CONSULTA'
        ? 'Solo ADMIN y ASESOR pueden firmar documentos.'
        : 'Haz clic en el ícono de <strong>lápiz</strong> en la fila del archivo. Se abrirá el panel de firma con la vista previa del documento a la izquierda.',
    },
    {
      icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`,
      titulo: 'Vista previa',
      desc: 'Antes de firmar puedes ver el PDF completo en el panel izquierdo del modal. Si tu navegador no lo renderiza, usa el botón <strong>Abrir en nueva pestaña</strong>.',
    },
    {
      icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`,
      titulo: 'Dibujar la firma',
      desc: 'En el panel derecho, dibuja tu firma en el recuadro blanco con el mouse o dedo. También puedes subir una <strong>imagen PNG/JPG</strong> de tu firma si prefieres.',
    },
    {
      icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
      titulo: 'Agregar notas',
      desc: 'En el campo <strong>Notas</strong> escribe el texto que quieres incrustar en el PDF. Elige en qué página insertarlo con el selector de página (por defecto la última).',
    },
    {
      icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
      titulo: 'Descargar el PDF firmado',
      desc: 'Haz clic en el ícono de <strong>descarga</strong> para obtener el PDF con la firma y las notas ya incrustadas. El archivo original en el servidor también queda actualizado.',
    },
  ]

  modal.open({
    title: '¿Cómo usar el Gestor de Archivos?',
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
  if (document.getElementById('archivos-styles')) return
  const style = document.createElement('style')
  style.id = 'archivos-styles'
  style.textContent = `
    .archivo-nombre {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
    }
    .badge-success {
      background: #064e3b;
      color: #6ee7b7;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 999px;
      font-weight: 600;
    }
    @media (max-width: 700px) {
      .firma-grid { grid-template-columns: 1fr !important; }
    }
    .badge-neutral {
      background: var(--color-surface-2, #1e293b);
      color: var(--color-text-secondary);
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 999px;
      font-weight: 500;
    }
  `
  document.head.appendChild(style)
}

export { render }
