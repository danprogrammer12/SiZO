import { auth, db }      from '../firebase.js'
import { get }           from '../store.js'
import modal             from '../components/modal.js'
import toast             from '../components/toast.js'
import {
  collection, doc, getDocs, updateDoc,
  query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'

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
      <span>Crear y desactivar usuarios requiere <strong>Cloud Functions (plan Blaze)</strong>.
      Por ahora puedes ver y editar permisos de usuarios existentes.
      Para crear el primer usuario ADMIN, usa la <strong>Consola de Firebase → Authentication</strong>.</span>
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
    const col  = collection(db, 'tenants', user.tenantId, 'usuarios')
    const q    = query(col, orderBy('nombre'))
    const snap = await getDocs(q)
    _usuarios  = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    renderTabla(_usuarios)
  } catch (err) {
    console.error(err)
    wrap.innerHTML = `<div class="alert alert-danger">Error al cargar usuarios: ${err.message}</div>`
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
        <p class="text-muted">Crea el primer usuario desde la Consola de Firebase</p>
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
              ? new Date(u.ultimoAcceso.seconds * 1000).toLocaleDateString('es-CO')
              : '—'
            return `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:var(--space-2)">
                    <div style="width:32px;height:32px;border-radius:50%;background:var(--color-brand);
                      color:#fff;display:flex;align-items:center;justify-content:center;
                      font-weight:700;font-size:var(--font-size-sm);flex-shrink:0">
                      ${(u.nombre || u.email || '?')[0].toUpperCase()}
                    </div>
                    <span style="font-weight:500">${u.nombre || '—'}</span>
                  </div>
                </td>
                <td class="text-sm">${u.email}</td>
                <td><span class="badge ${ROL_BADGE[u.rol] || 'badge-neutral'}">${ROL_LABELS[u.rol] || u.rol}</span></td>
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
                  <button class="btn btn-ghost btn-sm btn-editar-usuario" data-uid="${u.uid}" title="Editar">
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
        <span>Cambiar rol o empresas asignadas requiere Cloud Functions.
        Aquí puedes editar los datos de perfil del usuario.</span>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Nombre completo</label>
          <input name="nombre" value="${usuario.nombre || ''}" />
        </div>
        <div class="form-group">
          <label>Teléfono</label>
          <input name="tel" value="${usuario.tel || ''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Ciudad</label>
          <input name="ciudad" value="${usuario.ciudad || ''}" />
        </div>
        <div class="form-group">
          <label>Fecha de nacimiento</label>
          <input name="bday" type="date" value="${usuario.bday || ''}" />
        </div>
      </div>
      <div class="form-group">
        <label>LinkedIn</label>
        <input name="linkedin" value="${usuario.linkedin || ''}" placeholder="https://linkedin.com/in/..." />
      </div>

      <div class="divider"></div>
      <div class="form-group">
        <label>Rol actual</label>
        <input value="${ROL_LABELS[usuario.rol] || usuario.rol}" disabled style="opacity:.6;cursor:not-allowed" />
        <p class="form-hint">Cambiar rol requiere Cloud Functions (plan Blaze)</p>
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
    const ref = doc(db, 'tenants', user.tenantId, 'usuarios', usuario.uid)
    await updateDoc(ref, {
      nombre:    data.nombre?.trim() || usuario.nombre,
      tel:       data.tel?.trim() || null,
      ciudad:    data.ciudad?.trim() || null,
      bday:      data.bday || null,
      linkedin:  data.linkedin?.trim() || null,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    })
    toast.success('Usuario actualizado')
    modal.close()
    await cargarUsuarios()
  } catch (err) {
    console.error(err)
    errEl.textContent = `Error: ${err.message}`
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
        Crear usuarios requiere <strong>Cloud Functions</strong>, disponibles con el plan Blaze de Firebase.
      </p>
      <p style="margin-bottom:var(--space-4)">
        <strong>Alternativa para desarrollo (plan Spark):</strong>
      </p>
      <ol style="padding-left:var(--space-5);display:flex;flex-direction:column;gap:var(--space-3)">
        <li class="text-sm">
          Ve a <strong>Consola Firebase → Authentication → Users → Add user</strong>
          y crea el usuario con email y contraseña.
        </li>
        <li class="text-sm">
          Copia el UID generado.
        </li>
        <li class="text-sm">
          En <strong>Firestore → tenants → {tenantId} → usuarios</strong>, crea un documento
          con ese UID como ID y los campos: <code>uid, nombre, email, rol, activo: true,
          empresasIds: [], creadoEn, creadoPor, updatedAt, updatedBy, deletedAt: null</code>.
        </li>
        <li class="text-sm">
          Para que el usuario vea sus datos correctos, los <strong>Custom Claims</strong>
          (tenantId, role, empresasIds) deben setearse vía Admin SDK o Cloud Functions.
          Sin ellos, el login tendrá acceso limitado hasta que estén configurados.
        </li>
      </ol>
      <div class="alert alert-warning" style="margin-top:var(--space-5)">
        Al activar el plan Blaze, la función <code>createUser</code> ya está implementada
        en <code>functions/index.js</code> y se desplegará automáticamente.
      </div>
    `,
    footer: '<button class="btn btn-primary" id="btn-cerrar-info">Entendido</button>',
  })
  document.getElementById('btn-cerrar-info').addEventListener('click', () => modal.close())
}

export { render }
