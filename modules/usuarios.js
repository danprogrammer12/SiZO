import db              from '../db.js'
import { get }         from '../store.js'
import modal           from '../components/modal.js'
import toast           from '../components/toast.js'
import { esc }         from '../escape.js'
import { errorUsuario } from '../errores.js'

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
        <button class="btn btn-secondary" id="btn-invitar-info">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Crear usuarios
        </button>
      </div>
    </div>

    <div class="alert alert-info" style="margin-bottom:var(--space-4)">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span>Crear nuevos usuarios requiere el <strong>script de provisión</strong> (service role).
      Aquí puedes ver y editar el perfil de los usuarios existentes.</span>
    </div>

    <div id="usuarios-tabla-wrap">
      <div style="text-align:center;padding:var(--space-12)">
        <div class="spinner spinner-lg"></div>
      </div>
    </div>
  `

  document.getElementById('btn-invitar-info').addEventListener('click', mostrarInfoCreacion)
  await cargarUsuarios()
}

let _usuarios = []

async function cargarUsuarios() {
  const user = get('user')
  const wrap = document.getElementById('usuarios-tabla-wrap')
  if (!wrap) return

  try {
    _usuarios = await db.list('usuarios', { order: 'nombre' })
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
        <p class="text-muted">Crea el primer usuario desde Supabase → Authentication</p>
      </div>`
    return
  }

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
            <th>Último acceso</th>
            <th style="width:80px">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${lista.map(u => {
            const estado = u.activo
              ? '<span class="badge badge-success">Activo</span>'
              : '<span class="badge badge-neutral">Inactivo</span>'
            const acceso = u.ultimoAcceso
              ? new Date(u.ultimoAcceso).toLocaleDateString('es-CO')
              : '—'
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
                <td class="text-sm">
                  ${u.rol === 'ADMIN'
                    ? '<span class="text-muted">Todas</span>'
                    : u.empresasIds?.length
                      ? `${u.empresasIds.length} empresa${u.empresasIds.length !== 1 ? 's' : ''}`
                      : '<span class="text-muted">Sin asignar</span>'}
                </td>
                <td>${estado}</td>
                <td class="text-sm">${acceso}</td>
                <td>
                  <button class="btn btn-ghost btn-sm btn-editar-usuario" data-uid="${esc(u.uid)}" title="Editar">
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
      const u = _usuarios.find(u => u.uid === btn.dataset.uid)
      if (u) abrirFormularioEdicion(u)
    })
  })
}

// ── Edición de datos del perfil (sin cambiar rol/Claims — eso requiere CF) ──
function abrirFormularioEdicion(usuario) {
  const content = `
    <form id="form-usuario" novalidate>
      <div class="alert alert-info" style="margin-bottom:var(--space-4)">
        <span>Cambiar rol o empresas asignadas requiere el script de provisión
        (actualiza el app_metadata del JWT). Aquí puedes editar los datos de perfil.</span>
      </div>

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
        <label>Rol actual</label>
        <input value="${esc(ROL_LABELS[usuario.rol] || usuario.rol)}" disabled style="opacity:.6;cursor:not-allowed" />
        <p class="form-hint">Cambiar rol requiere el script de provisión (service role)</p>
      </div>

      <div id="form-usuario-error" class="form-error hidden"></div>
    </form>
  `

  modal.open({
    title:   `Editar — ${usuario.nombre || usuario.email}`,
    content,
    footer: `
      <button class="btn btn-secondary" id="btn-cancelar-usr">Cancelar</button>
      <button class="btn btn-primary"   id="btn-guardar-usr">Guardar cambios</button>
    `,
    size: 'md',
  })

  document.getElementById('btn-cancelar-usr').addEventListener('click', () => modal.close())
  document.getElementById('btn-guardar-usr').addEventListener('click', () => guardarUsuario(usuario))
}

async function guardarUsuario(usuario) {
  const user  = get('user')
  const form  = document.getElementById('form-usuario')
  const errEl = document.getElementById('form-usuario-error')
  const btn   = document.getElementById('btn-guardar-usr')

  const data = Object.fromEntries(new FormData(form).entries())

  btn.disabled    = true
  btn.textContent = 'Guardando...'

  try {
    await db.update('usuarios', usuario.uid, {
      nombre:    data.nombre?.trim() || usuario.nombre,
      tel:       data.tel?.trim() || null,
      ciudad:    data.ciudad?.trim() || null,
      bday:      data.bday || null,
      linkedin:  data.linkedin?.trim() || null,
    })
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

function mostrarInfoCreacion() {
  modal.open({
    title: 'Crear nuevos usuarios',
    size:  'md',
    content: `
      <p style="margin-bottom:var(--space-4)">
        Crear usuarios requiere privilegios de <strong>service role</strong>, por lo que se hace
        mediante el script de provisión (no desde el navegador, por seguridad).
      </p>
      <p style="margin-bottom:var(--space-4)">
        <strong>Pasos:</strong>
      </p>
      <ol style="padding-left:var(--space-5);display:flex;flex-direction:column;gap:var(--space-3)">
        <li class="text-sm">
          Ve a <strong>Supabase → Authentication → Users → Invite user</strong>
          e invita al usuario por correo.
        </li>
        <li class="text-sm">
          El usuario acepta la invitación y define su contraseña.
        </li>
        <li class="text-sm">
          Ejecuta el script de provisión para asignarle <code>tenant_id</code>, <code>role</code>
          y <code>empresas_ids</code> en su <strong>app_metadata</strong> y crear su fila en
          la tabla <code>usuarios</code>.
        </li>
        <li class="text-sm">
          El usuario cierra y reabre sesión para que el JWT recoja los nuevos datos.
        </li>
      </ol>
      <div class="alert alert-info" style="margin-top:var(--space-5)">
        Más adelante esto se automatiza con una <strong>Edge Function</strong>
        (<code>supabase/functions/crear-tenant</code>) invocada desde un panel de administración.
      </div>
    `,
    footer: '<button class="btn btn-primary" id="btn-cerrar-info">Entendido</button>',
  })
  document.getElementById('btn-cerrar-info').addEventListener('click', () => modal.close())
}

export { render }
