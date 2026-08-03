import { supabase } from '../supabase.js'
import { esc }      from '../escape.js'
import toast        from '../components/toast.js'
import modal        from '../components/modal.js'

const FUNCTIONS_URL = 'https://zfdiloozznodysbsrqhv.supabase.co/functions/v1'

const PLANES = {
  starter: { label: 'Starter', limite: 3,  precio: '$49.000/mes' },
  pro:     { label: 'Pro',     limite: 10, precio: '$89.000/mes' },
  agencia: { label: 'Agencia', limite: 25, precio: '$149.000/mes' },
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

async function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Panel de Plataforma</h2>
        <p class="page-subtitle">Administración de SIZO como SaaS — Webcore Solutions (rol ROOT)</p>
      </div>
      <div style="display:flex;gap:var(--space-2)">
        <button class="btn btn-primary" id="btn-sa-nuevo-tenant">Nuevo tenant</button>
        <button class="btn btn-secondary" id="btn-sa-refresh">Actualizar</button>
      </div>
    </div>
    <div id="sa-wrap">
      <div style="text-align:center;padding:var(--space-12)">
        <div class="spinner spinner-lg"></div>
      </div>
    </div>
    <div class="page-header" style="margin-top:var(--space-8)">
      <h3 class="page-title" style="font-size:var(--font-size-lg)">Usuarios de la plataforma</h3>
    </div>
    <div id="sa-usuarios-wrap"></div>
    <div class="page-header" style="margin-top:var(--space-8)">
      <h3 class="page-title" style="font-size:var(--font-size-lg)">Auditoría reciente</h3>
    </div>
    <div id="sa-auditoria-wrap"></div>
  `
  document.getElementById('btn-sa-refresh').addEventListener('click', cargarTodo)
  document.getElementById('btn-sa-nuevo-tenant').addEventListener('click', abrirFormularioTenant)
  await cargarTodo()
}

async function cargarTodo() {
  await Promise.all([cargar(), cargarUsuarios(), cargarAuditoria()])
}

function abrirFormularioTenant() {
  modal.open({
    title:   'Nuevo tenant',
    size:    'md',
    content: `
      <form id="form-crear-tenant" novalidate>
        <div class="form-group">
          <label class="form-label">Nombre del tenant *</label>
          <input type="text" name="tenant_nombre" class="form-input" required>
        </div>
        <div class="form-group">
          <label class="form-label">Tipo</label>
          <select name="tenant_tipo" class="form-input">
            <option value="consultora">Consultora</option>
            <option value="empresa">Empresa</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Plan</label>
          <select name="tenant_plan" class="form-input">
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="agencia">Agencia</option>
          </select>
        </div>
        <hr>
        <div class="form-group">
          <label class="form-label">Nombre del ADMIN inicial *</label>
          <input type="text" name="admin_nombre" class="form-input" required>
        </div>
        <div class="form-group">
          <label class="form-label">Correo del ADMIN inicial *</label>
          <input type="email" name="admin_email" class="form-input" required>
        </div>
        <p class="text-xs text-muted">Se le enviará un enlace para establecer su contraseña.</p>
        <div id="form-tenant-error"></div>
      </form>
    `,
    footer: `
      <button class="btn btn-secondary" data-modal-close>Cancelar</button>
      <button class="btn btn-primary" id="btn-guardar-tenant">Crear tenant</button>
    `,
  })
  document.getElementById('btn-guardar-tenant').addEventListener('click', guardarTenant)
}

async function guardarTenant() {
  const form  = document.getElementById('form-crear-tenant')
  const errEl = document.getElementById('form-tenant-error')
  const btn   = document.getElementById('btn-guardar-tenant')
  const data  = Object.fromEntries(new FormData(form).entries())

  if (!data.tenant_nombre?.trim() || !data.admin_nombre?.trim() || !data.admin_email?.trim()) {
    errEl.innerHTML = `<div class="alert alert-danger">Completa los campos requeridos</div>`
    return
  }

  btn.disabled = true
  btn.textContent = 'Creando...'
  try {
    await llamarEdgeFunction('crear-tenant', {
      tenant_nombre: data.tenant_nombre.trim(),
      tenant_tipo:   data.tenant_tipo,
      tenant_plan:   data.tenant_plan,
      admin_nombre:  data.admin_nombre.trim(),
      admin_email:   data.admin_email.trim(),
    })
    toast.success('Tenant creado — se envió invitación al ADMIN')
    modal.close()
    await cargarTodo()
  } catch (err) {
    errEl.innerHTML = `<div class="alert alert-danger">${esc(err.message)}</div>`
  } finally {
    btn.disabled = false
    btn.textContent = 'Crear tenant'
  }
}

async function cargarUsuarios() {
  const wrap = document.getElementById('sa-usuarios-wrap')
  if (!wrap) return
  try {
    // Política "root lee todo" en `usuarios` da acceso cross-tenant vía RLS.
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select('id, nombre, email, rol, tenant_id, activo')
      .order('creado_en', { ascending: false })
      .limit(500)
    if (error) throw error

    if (!usuarios || usuarios.length === 0) {
      wrap.innerHTML = `<p class="text-muted text-sm">Sin usuarios registrados.</p>`
      return
    }

    wrap.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Tenant</th><th>Estado</th><th style="width:160px">Acciones</th></tr></thead>
          <tbody>
            ${usuarios.map(u => `
              <tr>
                <td>${esc(u.nombre)}</td>
                <td>${esc(u.email)}</td>
                <td><span class="badge badge-info">${esc(u.rol)}</span></td>
                <td class="text-xs" style="font-family:monospace">${esc(u.tenant_id)}</td>
                <td><span class="badge ${u.activo ? 'badge-success' : 'badge-danger'}">${u.activo ? 'Activo' : 'Suspendido'}</span></td>
                <td>
                  <button class="btn btn-xs ${u.activo ? 'btn-danger' : 'btn-primary'} sa-usr-toggle" data-id="${esc(u.id)}" data-activo="${u.activo}">
                    ${u.activo ? 'Suspender' : 'Reactivar'}
                  </button>
                  <button class="btn btn-xs btn-ghost sa-usr-eliminar" data-id="${esc(u.id)}">Eliminar</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`

    wrap.querySelectorAll('.sa-usr-toggle').forEach(btn => {
      btn.addEventListener('click', () => accionUsuario(btn.dataset.id, btn.dataset.activo === 'true' ? 'suspender' : 'reactivar'))
    })
    wrap.querySelectorAll('.sa-usr-eliminar').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('¿Eliminar este usuario definitivamente de Auth? Esta acción no se puede deshacer.')) return
        accionUsuario(btn.dataset.id, 'eliminar')
      })
    })
  } catch (err) {
    wrap.innerHTML = `<div class="alert alert-danger">Error: ${esc(err.message)}</div>`
  }
}

async function accionUsuario(uid, accion) {
  try {
    await llamarEdgeFunction('gestionar-usuario-root', { uid, accion })
    toast.success(`Usuario ${accion === 'suspender' ? 'suspendido' : accion === 'reactivar' ? 'reactivado' : 'eliminado'}`)
    await cargarUsuarios()
  } catch (err) {
    toast.error(err.message)
  }
}

async function cargarAuditoria() {
  const wrap = document.getElementById('sa-auditoria-wrap')
  if (!wrap) return
  try {
    const { data: eventos, error } = await supabase
      .from('plataforma_auditoria')
      .select('*')
      .order('creado_en', { ascending: false })
      .limit(100)
    if (error) throw error

    if (!eventos || eventos.length === 0) {
      wrap.innerHTML = `<p class="text-muted text-sm">Sin eventos registrados.</p>`
      return
    }

    wrap.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>Fecha</th><th>Actor</th><th>Acción</th><th>Detalle</th></tr></thead>
          <tbody>
            ${eventos.map(e => `
              <tr>
                <td class="text-xs">${new Date(e.creado_en).toLocaleString('es-CO')}</td>
                <td class="text-xs">${esc(e.actor_email)}</td>
                <td><span class="badge badge-neutral">${esc(e.accion)}</span></td>
                <td class="text-xs" style="font-family:monospace">${esc(JSON.stringify(e.detalle))}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`
  } catch (err) {
    wrap.innerHTML = `<div class="alert alert-danger">Error: ${esc(err.message)}</div>`
  }
}

async function cargar() {
  const wrap = document.getElementById('sa-wrap')
  if (!wrap) return

  try {
    const [{ data: tenants, error: tErr }, { data: empresas, error: eErr }] = await Promise.all([
      supabase.from('tenants').select('*').order('creado_en', { ascending: false }),
      supabase.from('empresas').select('tenant_id').eq('activa', true).is('deleted_at', null).limit(5000),
    ])
    if (tErr) throw tErr
    if (eErr) throw eErr

    const conteos = {}
    for (const e of (empresas || [])) {
      conteos[e.tenant_id] = (conteos[e.tenant_id] || 0) + 1
    }

    renderTabla(wrap, tenants || [], conteos)
  } catch (err) {
    wrap.innerHTML = `<div class="alert alert-danger">Error: ${esc(err.message)}</div>`
  }
}

function renderTabla(wrap, tenants, conteos) {
  if (tenants.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🏗️</div>
        <h3 class="empty-state-title">Sin tenants</h3>
        <p class="text-muted">No hay tenants registrados aún</p>
      </div>`
    return
  }

  const hoy = new Date()

  wrap.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Plan</th>
            <th>Estado</th>
            <th>Trial vence</th>
            <th>Empresas</th>
            <th>Creado</th>
            <th style="width:180px">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${tenants.map(t => {
            const count = conteos[t.id] || 0
            const trialVence = t.trial_ends ? new Date(t.trial_ends) : null
            const trialVencido = trialVence && trialVence < hoy
            const colEstado = { activo: 'badge-success', trial: 'badge-brand', suspendido: 'badge-danger' }[t.estado] || 'badge-neutral'

            return `
              <tr>
                <td>
                  <div style="font-weight:600">${esc(t.nombre)}</div>
                  <div class="text-xs text-muted">${esc(t.email)}</div>
                  <div class="text-xs text-muted" style="font-family:monospace">${esc(t.id)}</div>
                </td>
                <td>
                  <select class="sa-plan-select" data-id="${esc(t.id)}" style="font-size:var(--font-size-xs);padding:4px 6px">
                    ${Object.entries(PLANES).map(([k, v]) =>
                      `<option value="${k}" ${t.plan === k ? 'selected' : ''}>${v.label} (${v.precio})</option>`
                    ).join('')}
                  </select>
                </td>
                <td><span class="badge ${colEstado}">${esc(t.estado)}</span></td>
                <td class="text-sm ${trialVencido ? 'text-danger font-weight-600' : ''}">
                  ${trialVence ? trialVence.toLocaleDateString('es-CO') : '—'}
                  ${trialVencido ? '<br><span class="text-xs">VENCIDO</span>' : ''}
                </td>
                <td class="text-center text-sm">
                  <span class="${count >= t.empresas_limite ? 'text-danger' : ''}" style="font-weight:600">${count}</span>
                  <span class="text-muted"> / ${t.empresas_limite}</span>
                </td>
                <td class="text-xs text-muted">${new Date(t.creado_en).toLocaleDateString('es-CO')}</td>
                <td>
                  <div style="display:flex;flex-direction:column;gap:4px">
                    <button class="btn btn-xs ${t.estado === 'suspendido' ? 'btn-primary' : 'btn-danger'} sa-toggle-estado"
                      data-id="${esc(t.id)}" data-estado="${esc(t.estado)}">
                      ${t.estado === 'suspendido' ? 'Reactivar' : 'Suspender'}
                    </button>
                    ${t.estado !== 'activo' ? `
                      <button class="btn btn-xs btn-secondary sa-activar-plan" data-id="${esc(t.id)}">
                        Marcar pagado
                      </button>` : ''}
                    ${t.estado === 'trial' ? `
                      <button class="btn btn-xs btn-ghost sa-extender-trial" data-id="${esc(t.id)}">
                        +14 días trial
                      </button>` : ''}
                  </div>
                </td>
              </tr>`
          }).join('')}
        </tbody>
      </table>
    </div>
    <p class="text-xs text-muted" style="margin-top:var(--space-2);text-align:right">
      ${tenants.length} tenant${tenants.length !== 1 ? 's' : ''}
    </p>
  `

  wrap.querySelectorAll('.sa-plan-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const id = sel.dataset.id
      const plan = sel.value
      const { error } = await supabase.from('tenants')
        .update({ plan, empresas_limite: PLANES[plan].limite })
        .eq('id', id)
      if (error) {
        toast.error('Error al cambiar plan')
        await cargar()
      } else {
        toast.success(`Plan actualizado a ${PLANES[plan].label}`)
      }
    })
  })

  wrap.querySelectorAll('.sa-toggle-estado').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id
      const nuevoEstado = btn.dataset.estado === 'suspendido' ? 'activo' : 'suspendido'
      const { error } = await supabase.from('tenants')
        .update({ estado: nuevoEstado })
        .eq('id', id)
      if (error) { toast.error('Error: ' + error.message); return }
      toast.success(`Tenant ${nuevoEstado === 'activo' ? 'reactivado' : 'suspendido'}`)
      await cargar()
    })
  })

  wrap.querySelectorAll('.sa-activar-plan').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { error } = await supabase.from('tenants')
        .update({ estado: 'activo', trial_ends: null })
        .eq('id', btn.dataset.id)
      if (error) { toast.error('Error: ' + error.message); return }
      toast.success('Plan activado (pago confirmado)')
      await cargar()
    })
  })

  wrap.querySelectorAll('.sa-extender-trial').forEach(btn => {
    btn.addEventListener('click', async () => {
      const nuevaFecha = new Date(Date.now() + 14 * 864e5).toISOString()
      const { error } = await supabase.from('tenants')
        .update({ trial_ends: nuevaFecha })
        .eq('id', btn.dataset.id)
      if (error) { toast.error('Error: ' + error.message); return }
      toast.success('Trial extendido 14 días')
      await cargar()
    })
  })
}

export { render }
