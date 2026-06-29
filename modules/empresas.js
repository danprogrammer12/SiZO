import db              from '../db.js'
import { supabase }    from '../supabase.js'
import { get }         from '../store.js'
import modal           from '../components/modal.js'
import toast           from '../components/toast.js'
import { esc }         from '../escape.js'
import { errorUsuario } from '../errores.js'

// ── Nivel Res. 0312 calculado (no se almacena) ────────────────
function nivelRes0312(trab, nivelRiesgo) {
  if (trab <= 10)  return 'I'
  if (trab <= 50)  return nivelRiesgo <= 'III' ? 'II' : 'III'
  if (trab <= 200) return 'III'
  return 'IV'
}

// ── Render principal ─────────────────────────────────────────
async function render(container) {
  const user = get('user')
  if (!user) return

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Empresas</h2>
        <p class="page-subtitle">Gestión de empresas cliente del tenant</p>
      </div>
      ${user.rol === 'ADMIN' ? `
        <button class="btn btn-primary" id="btn-nueva-empresa">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nueva empresa
        </button>` : ''}
    </div>

    <div class="card" style="margin-bottom:var(--space-4)">
      <div style="display:flex;gap:var(--space-3);flex-wrap:wrap;align-items:center">
        <input type="search" id="empresa-buscar" placeholder="Buscar empresa..." style="max-width:260px" />
        <select id="empresa-filtro-nivel" class="topbar-select">
          <option value="">Todos los niveles Res. 0312</option>
          <option value="I">Nivel I</option>
          <option value="II">Nivel II</option>
          <option value="III">Nivel III</option>
          <option value="IV">Nivel IV</option>
        </select>
      </div>
    </div>

    <div id="empresas-tabla-wrap">
      <div style="text-align:center;padding:var(--space-12)">
        <div class="spinner spinner-lg"></div>
      </div>
    </div>
  `

  if (user.rol === 'ADMIN') {
    document.getElementById('btn-nueva-empresa').addEventListener('click', () => abrirFormulario())
  }

  document.getElementById('empresa-buscar').addEventListener('input', () => filtrar())
  document.getElementById('empresa-filtro-nivel').addEventListener('change', () => filtrar())

  await cargarEmpresas()
}

let _empresas = []
let _asesores = {}  // { [uuid]: nombre } para resolver asesor_id → nombre

async function cargarEmpresas() {
  const wrap = document.getElementById('empresas-tabla-wrap')
  if (!wrap) return

  try {
    const [empresas, usuarios] = await Promise.all([
      db.list('empresas', { eq: { activa: true }, order: 'nombre' }),
      db.list('usuarios', { eq: { activo: true } }),
    ])
    _asesores = Object.fromEntries(usuarios.map(u => [u.id, u.nombre]))
    _empresas = empresas
    renderTabla(_empresas)
  } catch (err) {
    wrap.innerHTML = `<div class="alert alert-danger">${errorUsuario(err, 'cargar empresas')}</div>`
  }
}

function filtrar() {
  const buscar = (document.getElementById('empresa-buscar')?.value || '').toLowerCase()
  const nivel  = document.getElementById('empresa-filtro-nivel')?.value || ''
  const filtradas = _empresas.filter(em => {
    const matchNombre = em.nombre.toLowerCase().includes(buscar) ||
                        (em.nombreCom || '').toLowerCase().includes(buscar) ||
                        (em.nit || '').includes(buscar)
    const matchNivel  = !nivel || nivelRes0312(em.trab, em.nivelRiesgo) === nivel
    return matchNombre && matchNivel
  })
  renderTabla(filtradas)
}

function renderTabla(lista) {
  const user = get('user')
  const wrap = document.getElementById('empresas-tabla-wrap')
  if (!wrap) return

  if (lista.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🏢</div>
        <h3 class="empty-state-title">Sin empresas</h3>
        <p class="text-muted">No hay empresas que coincidan con el filtro</p>
      </div>`
    return
  }

  wrap.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Empresa</th>
            <th>NIT</th>
            <th>Ciudad</th>
            <th>Trabajadores</th>
            <th>Nivel Res. 0312</th>
            <th>ARL</th>
            <th>Asesor asignado</th>
            <th>Contrato vence</th>
            ${user.rol === 'ADMIN' ? '<th style="width:80px">Acciones</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${lista.map(em => {
            const nivel = nivelRes0312(em.trab, em.nivelRiesgo)
            const colNivel = { I:'badge-success', II:'badge-brand', III:'badge-warning', IV:'badge-danger' }[nivel] || 'badge-neutral'
            const hoy = new Date().toISOString().slice(0,10)
            const venceProx = em.contratoFin && em.contratoFin <= new Date(Date.now() + 30*864e5).toISOString().slice(0,10)
            return `
              <tr data-id="${esc(em.id)}">
                <td>
                  <div style="font-weight:600">${esc(em.nombre)}</div>
                  ${em.nombreCom ? `<div class="text-muted text-xs">${esc(em.nombreCom)}</div>` : ''}
                </td>
                <td class="text-sm">${esc(em.nit || '—')}</td>
                <td class="text-sm">${esc(em.ciudad || '—')}</td>
                <td class="text-sm text-center">${esc(em.trab || 0)}</td>
                <td><span class="badge ${colNivel}">Nivel ${nivel}</span></td>
                <td class="text-sm">${esc(em.arl || '—')}</td>
                <td class="text-sm">${esc(_asesores[em.asesorId] || '—')}</td>
                <td class="text-sm ${venceProx ? 'text-warning' : ''}">
                  ${esc(em.contratoFin || '—')}${venceProx ? ' ⚠️' : ''}
                </td>
                ${user.rol === 'ADMIN' ? `
                  <td>
                    <button class="btn btn-ghost btn-sm btn-editar" data-id="${esc(em.id)}" title="Editar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  </td>` : ''}
              </tr>`
          }).join('')}
        </tbody>
      </table>
    </div>
    <p class="text-xs text-muted" style="margin-top:var(--space-2);text-align:right">
      ${lista.length} empresa${lista.length !== 1 ? 's' : ''}
    </p>
  `

  wrap.querySelectorAll('.btn-editar').forEach(btn => {
    btn.addEventListener('click', () => {
      const em = _empresas.find(e => e.id === btn.dataset.id)
      if (em) abrirFormulario(em)
    })
  })
}

// ── Formulario crear / editar ─────────────────────────────────
function abrirFormulario(empresa = null) {
  const esEdicion = !!empresa
  const em = empresa || {}

  const content = `
    <form id="form-empresa" novalidate>
      <p class="text-sm text-muted" style="margin-bottom:var(--space-5)">
        Los campos marcados con * son obligatorios.
      </p>

      <h4 style="margin-bottom:var(--space-4);font-size:var(--font-size-sm);text-transform:uppercase;letter-spacing:.05em;color:var(--color-text-muted)">
        Información básica
      </h4>
      <div class="form-row">
        <div class="form-group">
          <label>Razón social *</label>
          <input name="nombre" value="${esc(em.nombre || '')}" required />
        </div>
        <div class="form-group">
          <label>Nombre comercial</label>
          <input name="nombreCom" value="${esc(em.nombreCom || '')}" />
        </div>
      </div>
      <div class="form-row col-3">
        <div class="form-group">
          <label>NIT</label>
          <input name="nit" value="${esc(em.nit || '')}" />
        </div>
        <div class="form-group">
          <label>Ciudad *</label>
          <input name="ciudad" value="${esc(em.ciudad || '')}" required />
        </div>
        <div class="form-group">
          <label>Departamento</label>
          <input name="dpto" value="${esc(em.dpto || '')}" />
        </div>
      </div>
      <div class="form-group">
        <label>Dirección</label>
        <input name="direccion" value="${esc(em.direccion || '')}" />
      </div>

      <div class="divider"></div>
      <h4 style="margin-bottom:var(--space-4);font-size:var(--font-size-sm);text-transform:uppercase;letter-spacing:.05em;color:var(--color-text-muted)">
        Clasificación SST
      </h4>
      <div class="form-row col-3">
        <div class="form-group">
          <label>N° trabajadores *</label>
          <input name="trab" type="number" min="1" value="${esc(em.trab || '')}" required />
        </div>
        <div class="form-group">
          <label>Nivel de riesgo *</label>
          <select name="nivelRiesgo" required>
            ${['I','II','III','IV','V'].map(n =>
              `<option value="${n}" ${em.nivelRiesgo === n ? 'selected' : ''}>${n}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Clase ARL</label>
          <select name="claseRiesgo">
            <option value="">—</option>
            ${['I','II','III','IV','V'].map(n =>
              `<option value="${n}" ${em.claseRiesgo === n ? 'selected' : ''}>${n}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>ARL</label>
          <select name="arl">
            <option value="">—</option>
            ${['Positiva','SURA','Bolívar','Colmena','Equidad','Liberty','Mapfre','Seguros del Estado'].map(a =>
              `<option value="${a}" ${em.arl === a ? 'selected' : ''}>${a}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>COPASST / Vigía</label>
          <select name="copasst">
            <option value="">—</option>
            <option value="copasst" ${em.copasst === 'copasst' ? 'selected' : ''}>COPASST</option>
            <option value="vigia"   ${em.copasst === 'vigia'   ? 'selected' : ''}>Vigía</option>
          </select>
        </div>
      </div>

      <div class="divider"></div>
      <h4 style="margin-bottom:var(--space-4);font-size:var(--font-size-sm);text-transform:uppercase;letter-spacing:.05em;color:var(--color-text-muted)">
        Contrato
      </h4>
      <div class="form-row col-3">
        <div class="form-group">
          <label>Tipo de contrato</label>
          <select name="tipoContrato">
            <option value="">—</option>
            ${['mensual','trimestral','semestral','anual','proyecto','indefinido'].map(t =>
              `<option value="${t}" ${em.tipoContrato === t ? 'selected' : ''}>${t}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Inicio contrato</label>
          <input name="contratoInicio" type="date" value="${esc(em.contratoInicio || '')}" />
        </div>
        <div class="form-group">
          <label>Fin contrato</label>
          <input name="contratoFin" type="date" value="${esc(em.contratoFin || '')}" />
        </div>
      </div>

      <div class="divider"></div>
      <h4 style="margin-bottom:var(--space-4);font-size:var(--font-size-sm);text-transform:uppercase;letter-spacing:.05em;color:var(--color-text-muted)">
        Responsables
      </h4>
      <div class="form-row">
        <div class="form-group">
          <label>Representante legal</label>
          <input name="repLegal" value="${esc(em.repLegal || '')}" />
        </div>
        <div class="form-group">
          <label>Responsable SST</label>
          <input name="respSst" value="${esc(em.respSst || '')}" />
        </div>
      </div>
      <div class="form-group">
        <label>Observaciones</label>
        <textarea name="obs" rows="2">${esc(em.obs || '')}</textarea>
      </div>

      <div id="form-empresa-error" class="form-error hidden"></div>
    </form>
  `

  const footer = `
    <button class="btn btn-secondary" id="btn-cancelar-empresa">Cancelar</button>
    <button class="btn btn-primary" id="btn-guardar-empresa">
      ${esEdicion ? 'Guardar cambios' : 'Crear empresa'}
    </button>
  `

  modal.open({
    title:   esEdicion ? `Editar — ${em.nombre}` : 'Nueva empresa',
    content,
    footer,
    size:    'lg',
  })

  document.getElementById('btn-cancelar-empresa').addEventListener('click', () => modal.close())
  document.getElementById('btn-guardar-empresa').addEventListener('click', () => guardar(empresa))
}

async function guardar(empresaActual) {
  const user  = get('user')
  const form  = document.getElementById('form-empresa')
  const errEl = document.getElementById('form-empresa-error')
  const btn   = document.getElementById('btn-guardar-empresa')

  const data = Object.fromEntries(new FormData(form).entries())

  // Validación básica
  if (!data.nombre?.trim()) {
    errEl.textContent = 'La razón social es obligatoria'
    errEl.classList.remove('hidden')
    return
  }
  if (!data.ciudad?.trim()) {
    errEl.textContent = 'La ciudad es obligatoria'
    errEl.classList.remove('hidden')
    return
  }
  if (!data.trab || parseInt(data.trab) < 1) {
    errEl.textContent = 'El número de trabajadores debe ser mayor a 0'
    errEl.classList.remove('hidden')
    return
  }

  // Verificar billing solo al crear empresa nueva
  if (!empresaActual) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('estado, empresas_limite, trial_ends')
      .eq('id', user.tenantId)
      .single()

    if (tenant) {
      if (tenant.estado === 'suspendido') {
        errEl.textContent = 'Tu cuenta está suspendida. Contacta al soporte para reactivarla.'
        errEl.classList.remove('hidden')
        return
      }
      if (tenant.estado === 'trial' && tenant.trial_ends && new Date(tenant.trial_ends) < new Date()) {
        errEl.textContent = 'Tu período de prueba ha vencido. Contacta al soporte para activar tu plan.'
        errEl.classList.remove('hidden')
        return
      }
      const { count } = await supabase
        .from('empresas')
        .select('*', { count: 'exact', head: true })
        .eq('activa', true)
        .is('deleted_at', null)
      if (count !== null && count >= tenant.empresas_limite) {
        errEl.textContent = `Alcanzaste el límite de tu plan (${tenant.empresas_limite} empresa${tenant.empresas_limite !== 1 ? 's' : ''}). Escríbenos para ampliar tu plan.`
        errEl.classList.remove('hidden')
        return
      }
    }
  }

  errEl.classList.add('hidden')
  btn.disabled = true
  btn.textContent = 'Guardando...'

  const payload = {
    nombre:         data.nombre.trim(),
    nombreCom:      data.nombreCom?.trim() || null,
    nit:            data.nit?.trim() || null,
    ciudad:         data.ciudad.trim(),
    dpto:           data.dpto?.trim() || null,
    direccion:      data.direccion?.trim() || null,
    trab:           parseInt(data.trab),
    nivelRiesgo:    data.nivelRiesgo || 'I',
    claseRiesgo:    data.claseRiesgo || null,
    arl:            data.arl || null,
    copasst:        data.copasst || null,
    tipoContrato:   data.tipoContrato || null,
    contratoInicio: data.contratoInicio || null,
    contratoFin:    data.contratoFin || null,
    repLegal:       data.repLegal?.trim() || null,
    respSst:        data.respSst?.trim() || null,
    obs:            data.obs?.trim() || null,
  }

  try {
    if (empresaActual) {
      await db.update('empresas', empresaActual.id, payload)
      toast.success(`Empresa "${payload.nombre}" actualizada`)
    } else {
      await db.insert('empresas', { ...payload, activa: true, centros: [] })
      toast.success(`Empresa "${payload.nombre}" creada`)
    }

    modal.close()
    await cargarEmpresas()
  } catch (err) {
    errEl.textContent = errorUsuario(err, 'guardar empresa')
    errEl.classList.remove('hidden')
    btn.disabled = false
    btn.textContent = empresaActual ? 'Guardar cambios' : 'Crear empresa'
  }
}

export { render }
