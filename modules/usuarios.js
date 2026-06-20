import db              from '../db.js'
import { get }         from '../store.js'
import modal           from '../components/modal.js'
import toast           from '../components/toast.js'
import { esc }         from '../escape.js'
import { errorUsuario } from '../errores.js'
import { supabase }    from '../supabase.js'

const FUNCTIONS_URL = 'https://ifqzdrqzjgsdhjbqkbba.supabase.co/functions/v1'

const ROL_LABELS = { ADMIN: 'Administrador', ASESOR: 'Asesor SST', CONSULTA: 'Consulta' }
const ROL_BADGE  = { ADMIN: 'badge-danger', ASESOR: 'badge-brand', CONSULTA: 'badge-neutral' }

async function render(container) {
  const user = get('user')
  if (!user) return

  if (user.rol !== 'ADMIN') {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔒</div>
        <h3 class="empty-state-title">Acceso restringido</h3>
        <p class="text-muted">Solo el Administrador puede gestionar usuarios</p>
      </div>`
    return
  }

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Usuarios</h2>
        <p class="page-subtitle">Gestión de usuarios y permisos del tenant</p>
      </div>
      <div style="display:flex;gap:var(--space-2)">
        <button class="btn btn-primary" id="btn-crear-usuario">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
          </svg>
          Nuevo usuario
        </button>
      </div>
    </div>
    <div id="usuarios-tabla-wrap">
      <div style="text-align:center;padding:var(--space-12)">
        <div class="spinner spinner-lg"></div>
      </div>
    </div>
  `

  document.getElementById('btn-crear-usuario').addEventListener('click', abrirFormularioCreacion)
  await cargarUsuarios()
}

let _usuarios  = []
let _empresas  = []

async function cargarTodo() {
  const [usuarios, empresas] = await Promise.all([
    db.list('usuarios',  { order: 'nombre' }),
    db.list('empresas',  { order: 'nombre' }),
  ])
  _usuarios = usuarios
  _empresas = empresas
}

async function cargarUsuarios() {
  const wrap = document.getElementById('usuarios-tabla-wrap')
  if (!wrap) return
  try {
    await cargarTodo()
    renderTabla(_usuarios)
  } catch (err) {
    wrap.innerHTML = `<div class="alert alert-danger">${errorUsuario(err, 'cargar usuarios')}</div>`
  }
}

function renderTabla(lista) {
  const wrap = document.getElementById('usuarios-tabla-wrap')
  if (!wrap) return

  if (lista.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <h3 class="empty-state-title">Sin usuarios</h3>
        <p class="text-muted">Crea el primer usuario con el botón "Nuevo usuario"</p>
      </div>`
    return
  }

  // Mapa id → nombre para resolver empresas
  const empMap = Object.fromEntries(_empresas.map(e => [e.id, e.nombre]))

  wrap.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Correo</th>
            <th>Rol</th>
            <th>Empresas asignadas</th>
            <th>Estado</th>
            <th style="width:80px">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${lista.map(u => {
            const estado = u.activo
              ? '<span class="badge badge-success">Activo</span>'
              : '<span class="badge badge-neutral">Inactivo</span>'

            let empresasCell
            if (u.rol === 'ADMIN') {
              empresasCell = '<span class="text-muted">Todas</span>'
            } else if (u.empresasIds?.length) {
              const nombres = u.empresasIds
                .map(id => esc(empMap[id] || id))
                .join(', ')
              empresasCell = `<span title="${nombres}" style="max-width:200px;display:inline-block;
                overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${nombres}</span>`
            } else {
              empresasCell = '<span class="badge badge-warning">Sin asignar</span>'
            }

            return `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:var(--space-2)">
                    <div style="width:32px;height:32px;border-radius:50%;background:var(--color-brand);
                      color:#fff;display:flex;align-items:center;justify-content:center;
                      font-weight:700;font-size:var(--font-size-sm);flex-shrink:0">
                      ${esc((u.nombre || u.email || '?')[0].toUpperCase())}
                    </div>
                    <span style="font-weight:500">${esc(u.nombre || '—')}</span>
                  </div>
                </td>
                <td class="text-sm">${esc(u.email)}</td>
                <td><span class="badge ${ROL_BADGE[u.rol] || 'badge-neutral'}">${esc(ROL_LABELS[u.rol] || u.rol)}</span></td>
                <td class="text-sm">${empresasCell}</td>
                <td>${estado}</td>
                <td>
                  <button class="btn btn-ghost btn-sm btn-editar-usuario" data-uid="${esc(u.id)}" title="Editar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                </td>
              </tr>`
          }).join('')}
        </tbody>
      </table>
    </div>
    <p class="text-xs text-muted" style="margin-top:var(--space-2);text-align:right">
      ${lista.length} usuario${lista.length !== 1 ? 's' : ''}
    </p>
  `

  wrap.querySelectorAll('.btn-editar-usuario').forEach(btn => {
    btn.addEventListener('click', () => {
      const u = _usuarios.find(u => u.id === btn.dataset.uid)
      if (u) abrirFormularioEdicion(u)
    })
  })
}

// ── Helpers UI ───────────────────────────────────────────────────────────────

function checkboxEmpresas(seleccionadas = [], disabled = false) {
  if (_empresas.length === 0) {
    return `<p class="text-sm text-muted">No hay empresas creadas aún.</p>`
  }
  return `
    <div style="display:flex;flex-direction:column;gap:var(--space-2);
      max-height:180px;overflow-y:auto;padding:var(--space-2);
      border:1px solid var(--color-border);border-radius:var(--radius-md)">
      ${_empresas.map(e => `
        <label style="display:flex;align-items:center;gap:var(--space-2);cursor:${disabled ? 'default' : 'pointer'}">
          <input type="checkbox" name="empresa_ids" value="${esc(e.id)}"
            ${seleccionadas.includes(e.id) ? 'checked' : ''}
            ${disabled ? 'disabled' : ''}>
          <span class="text-sm">${esc(e.nombre)}</span>
        </label>`).join('')}
    </div>`
}

function leerEmpresasSeleccionadas() {
  return [...document.querySelectorAll('input[name="empresa_ids"]:checked')]
    .map(cb => cb.value)
}

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sin sesión activa')
  return session.access_token
}

async function llamarEdgeFunction(endpoint, body) {
  const token = await getToken()
  const res = await fetch(`${FUNCTIONS_URL}/${endpoint}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body:    JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || `Error ${res.status}`)
  return json
}

// ── Formulario de creación ───────────────────────────────────────────────────

function abrirFormularioCreacion() {
  modal.open({
    title:   'Nuevo usuario',
    size:    'md',
    content: `
      <form id="form-crear-usuario" novalidate>
        <div class="form-row">
          <div class="form-group">
            <label>Nombre completo <span class="text-danger">*</span></label>
            <input id="nuevo-nombre" name="nombre" placeholder="Ej: María García" autocomplete="off" />
          </div>
          <div class="form-group">
            <label>Correo electrónico <span class="text-danger">*</span></label>
            <input id="nuevo-email" name="email" type="email" placeholder="usuario@empresa.com" autocomplete="off" />
          </div>
        </div>
        <div class="form-group">
          <label>Rol <span class="text-danger">*</span></label>
          <select id="nuevo-rol" name="rol">
            <option value="">— Seleccionar —</option>
            <option value="ADMIN">Administrador</option>
            <option value="ASESOR">Asesor SST</option>
            <option value="CONSULTA">Consulta</option>
          </select>
        </div>
        <div id="nuevo-empresas-wrap" class="form-group hidden">
          <label>Empresas asignadas</label>
          ${checkboxEmpresas()}
          <p class="form-hint">El ASESOR y CONSULTA solo ven datos de las empresas asignadas.</p>
        </div>
        <div class="alert alert-info" style="margin-top:var(--space-3)">
          El usuario recibirá un correo para establecer su contraseña.
        </div>
        <div id="form-crear-error" class="form-error hidden"></div>
      </form>
    `,
    footer: `
      <button class="btn btn-secondary" id="btn-cancelar-crear">Cancelar</button>
      <button class="btn btn-primary"   id="btn-guardar-crear">Crear usuario</button>
    `,
  })

  // Mostrar/ocultar selector de empresas según rol
  document.getElementById('nuevo-rol').addEventListener('change', e => {
    const wrap = document.getElementById('nuevo-empresas-wrap')
    wrap.classList.toggle('hidden', e.target.value === 'ADMIN' || e.target.value === '')
  })

  document.getElementById('btn-cancelar-crear').addEventListener('click', () => modal.close())
  document.getElementById('btn-guardar-crear').addEventListener('click', ejecutarCrearUsuario)
}

async function ejecutarCrearUsuario() {
  const nombre     = document.getElementById('nuevo-nombre')?.value.trim()
  const email      = document.getElementById('nuevo-email')?.value.trim()
  const rol        = document.getElementById('nuevo-rol')?.value
  const empresasIds = rol !== 'ADMIN' ? leerEmpresasSeleccionadas() : []
  const errEl      = document.getElementById('form-crear-error')
  const btn        = document.getElementById('btn-guardar-crear')

  errEl.classList.add('hidden')

  if (!nombre || !email || !rol) {
    errEl.textContent = 'Completa todos los campos requeridos.'
    errEl.classList.remove('hidden')
    return
  }

  btn.disabled    = true
  btn.textContent = 'Creando...'

  try {
    await llamarEdgeFunction('crear-usuario', { nombre, email, rol, empresasIds })
    toast.success(`Usuario ${esc(nombre)} creado. Se envió un enlace de acceso al correo.`)
    modal.close()
    await cargarUsuarios()
  } catch (err) {
    errEl.textContent = errorUsuario(err, 'crear usuario')
    errEl.classList.remove('hidden')
    btn.disabled    = false
    btn.textContent = 'Crear usuario'
  }
}

// ── Formulario de edición ────────────────────────────────────────────────────

function abrirFormularioEdicion(usuario) {
  const esAdmin = usuario.rol === 'ADMIN'

  modal.open({
    title:   `Editar — ${esc(usuario.nombre || usuario.email)}`,
    size:    'md',
    content: `
      <form id="form-usuario" novalidate>
        <div class="form-row">
          <div class="form-group">
            <label>Nombre completo</label>
            <input name="nombre" value="${esc(usuario.nombre || '')}" />
          </div>
          <div class="form-group">
            <label>Teléfono</label>
            <input name="tel" value="${esc(usuario.tel || '')}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Ciudad</label>
            <input name="ciudad" value="${esc(usuario.ciudad || '')}" />
          </div>
          <div class="form-group">
            <label>Fecha de nacimiento</label>
            <input name="bday" type="date" value="${esc(usuario.bday || '')}" />
          </div>
        </div>
        <div class="form-group">
          <label>LinkedIn</label>
          <input name="linkedin" value="${esc(usuario.linkedin || '')}" placeholder="https://linkedin.com/in/..." />
        </div>

        <div class="divider"></div>

        <div class="form-group">
          <label>Rol</label>
          <select id="edit-rol" name="rol">
            <option value="ADMIN"   ${usuario.rol === 'ADMIN'   ? 'selected' : ''}>Administrador</option>
            <option value="ASESOR"  ${usuario.rol === 'ASESOR'  ? 'selected' : ''}>Asesor SST</option>
            <option value="CONSULTA"${usuario.rol === 'CONSULTA'? 'selected' : ''}>Consulta</option>
          </select>
        </div>

        <div id="edit-empresas-wrap" class="form-group ${esAdmin ? 'hidden' : ''}">
          <label>Empresas asignadas</label>
          ${checkboxEmpresas(usuario.empresasIds || [])}
          <p class="form-hint">El ASESOR y CONSULTA solo ven datos de las empresas seleccionadas.</p>
        </div>

        <div id="form-usuario-error" class="form-error hidden"></div>
      </form>
    `,
    footer: `
      <button class="btn btn-secondary" id="btn-cancelar-usr">Cancelar</button>
      <button class="btn btn-primary"   id="btn-guardar-usr">Guardar cambios</button>
    `,
  })

  document.getElementById('edit-rol').addEventListener('change', e => {
    const wrap = document.getElementById('edit-empresas-wrap')
    wrap.classList.toggle('hidden', e.target.value === 'ADMIN')
  })

  document.getElementById('btn-cancelar-usr').addEventListener('click', () => modal.close())
  document.getElementById('btn-guardar-usr').addEventListener('click', () => guardarUsuario(usuario))
}

async function guardarUsuario(usuario) {
  const form   = document.getElementById('form-usuario')
  const errEl  = document.getElementById('form-usuario-error')
  const btn    = document.getElementById('btn-guardar-usr')
  const nuevoRol  = document.getElementById('edit-rol').value
  const empresasIds = nuevoRol !== 'ADMIN' ? leerEmpresasSeleccionadas() : []

  const data = Object.fromEntries(new FormData(form).entries())

  btn.disabled    = true
  btn.textContent = 'Guardando...'

  try {
    // Actualizar perfil en tabla usuarios (datos de perfil — no requiere service role)
    await db.update('usuarios', usuario.id, {
      nombre:   data.nombre?.trim() || usuario.nombre,
      tel:      data.tel?.trim()    || null,
      ciudad:   data.ciudad?.trim() || null,
      bday:     data.bday           || null,
      linkedin: data.linkedin?.trim()|| null,
    })

    // Actualizar rol y empresas en app_metadata (requiere Edge Function)
    const rolCambio      = nuevoRol !== usuario.rol
    const empresasCambio = JSON.stringify(empresasIds.sort()) !== JSON.stringify((usuario.empresasIds || []).sort())

    if (rolCambio || empresasCambio) {
      await llamarEdgeFunction('actualizar-usuario', {
        uid:       usuario.id,
        rol:       nuevoRol,
        empresasIds,
      })
    }

    toast.success('Usuario actualizado')
    modal.close()
    await cargarUsuarios()
  } catch (err) {
    errEl.textContent = errorUsuario(err, 'guardar usuario')
    errEl.classList.remove('hidden')
    btn.disabled    = false
    btn.textContent = 'Guardar cambios'
  }
}

export { render }
