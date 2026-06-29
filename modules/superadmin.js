import { supabase } from '../supabase.js'
import { esc }      from '../escape.js'
import toast        from '../components/toast.js'

const PLANES = {
  starter: { label: 'Starter', limite: 3,  precio: '$49.000/mes' },
  pro:     { label: 'Pro',     limite: 10, precio: '$89.000/mes' },
  agencia: { label: 'Agencia', limite: 25, precio: '$149.000/mes' },
}

async function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Panel SUPERADMIN</h2>
        <p class="page-subtitle">Gestión de tenants y planes de billing</p>
      </div>
      <button class="btn btn-secondary" id="btn-sa-refresh">Actualizar</button>
    </div>
    <div id="sa-wrap">
      <div style="text-align:center;padding:var(--space-12)">
        <div class="spinner spinner-lg"></div>
      </div>
    </div>
  `
  document.getElementById('btn-sa-refresh').addEventListener('click', cargar)
  await cargar()
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
