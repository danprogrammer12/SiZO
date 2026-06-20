// SIZO — Perfil de usuario autenticado
import { get, set } from '../store.js'
import { supabase } from '../supabase.js'
import { esc }      from '../escape.js'

export async function render(container) {
  const user = get('user')
  container.innerHTML = renderShell(user)
  bindEvents(user)
}

function renderShell(user) {
  const inicial = ((user?.nombre || user?.email || '?')[0]).toUpperCase()
  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">Mi perfil</h2>
        <p class="page-subtitle">Información de tu cuenta</p>
      </div>
    </div>

    <div style="max-width:560px">

      <!-- Avatar + info básica -->
      <div class="card" style="display:flex;align-items:center;gap:var(--space-5);margin-bottom:var(--space-4)">
        <div style="
          width:72px;height:72px;border-radius:50%;
          background:var(--color-brand);color:#fff;
          font-size:2rem;font-weight:700;
          display:flex;align-items:center;justify-content:center;
          flex-shrink:0">
          ${esc(inicial)}
        </div>
        <div>
          <div style="font-size:var(--font-size-lg);font-weight:600;color:var(--text-primary)">
            ${esc(user?.nombre || '—')}
          </div>
          <div style="font-size:var(--font-size-sm);color:var(--text-secondary);margin-top:2px">
            ${esc(user?.email || '—')}
          </div>
          <span class="badge badge-info" style="margin-top:var(--space-2)">${esc(user?.rol || '—')}</span>
        </div>
      </div>

      <!-- Formulario editar nombre -->
      <div class="card" style="margin-bottom:var(--space-4)">
        <h4 style="margin-bottom:var(--space-4);color:var(--text-primary)">Datos personales</h4>
        <form id="perfil-form" novalidate>
          <div class="form-group">
            <label for="perfil-nombre">Nombre completo</label>
            <input type="text" id="perfil-nombre" value="${esc(user?.nombre || '')}"
              placeholder="Tu nombre" autocomplete="name" required />
          </div>
          <div class="form-group">
            <label>Correo electrónico</label>
            <input type="email" value="${esc(user?.email || '')}" disabled
              style="opacity:.6;cursor:not-allowed" />
            <p class="text-xs text-muted" style="margin-top:var(--space-1)">
              El correo no se puede cambiar desde aquí.
            </p>
          </div>
          <div id="perfil-msg" class="hidden" style="margin-bottom:var(--space-3)"></div>
          <button type="submit" class="btn btn-primary" id="perfil-save-btn">
            <span id="perfil-save-text">Guardar cambios</span>
            <span id="perfil-save-spinner" class="spinner hidden"></span>
          </button>
        </form>
      </div>

      <!-- Cambiar contraseña -->
      <div class="card">
        <h4 style="margin-bottom:var(--space-4);color:var(--text-primary)">Cambiar contraseña</h4>
        <form id="pass-form" novalidate>
          <div class="form-group">
            <label for="pass-nueva">Nueva contraseña</label>
            <input type="password" id="pass-nueva" placeholder="Mínimo 8 caracteres"
              autocomplete="new-password" required minlength="8" />
          </div>
          <div class="form-group">
            <label for="pass-confirmar">Confirmar contraseña</label>
            <input type="password" id="pass-confirmar" placeholder="Repite la contraseña"
              autocomplete="new-password" required />
          </div>
          <div id="pass-msg" class="hidden" style="margin-bottom:var(--space-3)"></div>
          <button type="submit" class="btn btn-primary" id="pass-save-btn">
            <span id="pass-save-text">Cambiar contraseña</span>
            <span id="pass-save-spinner" class="spinner hidden"></span>
          </button>
        </form>
      </div>

    </div>`
}

function bindEvents(user) {
  // ── Guardar nombre ──
  document.getElementById('perfil-form').addEventListener('submit', async e => {
    e.preventDefault()
    const nombre = document.getElementById('perfil-nombre').value.trim()
    if (!nombre) return mostrarMsg('perfil-msg', 'error', 'El nombre no puede estar vacío.')

    setLoading('perfil', true)
    try {
      const { error: authErr } = await supabase.auth.updateUser({ data: { nombre } })
      if (authErr) throw authErr

      const { error: dbErr } = await supabase
        .from('usuarios')
        .update({ nombre })
        .eq('id', user.uid)
      if (dbErr) throw dbErr

      set('user', { ...get('user'), nombre })
      mostrarMsg('perfil-msg', 'ok', 'Nombre actualizado correctamente.')
    } catch (err) {
      mostrarMsg('perfil-msg', 'error', err.message || 'Error al guardar.')
    } finally {
      setLoading('perfil', false)
    }
  })

  // ── Cambiar contraseña ──
  document.getElementById('pass-form').addEventListener('submit', async e => {
    e.preventDefault()
    const nueva     = document.getElementById('pass-nueva').value
    const confirmar = document.getElementById('pass-confirmar').value

    if (nueva.length < 8) return mostrarMsg('pass-msg', 'error', 'La contraseña debe tener mínimo 8 caracteres.')
    if (nueva !== confirmar) return mostrarMsg('pass-msg', 'error', 'Las contraseñas no coinciden.')

    setLoading('pass', true)
    try {
      const { error } = await supabase.auth.updateUser({ password: nueva })
      if (error) throw error
      mostrarMsg('pass-msg', 'ok', 'Contraseña actualizada. Úsala en tu próximo inicio de sesión.')
      document.getElementById('pass-form').reset()
    } catch (err) {
      mostrarMsg('pass-msg', 'error', err.message || 'Error al cambiar contraseña.')
    } finally {
      setLoading('pass', false)
    }
  })
}

function setLoading(prefijo, on) {
  const btn  = document.getElementById(`${prefijo}-save-btn`)
  const text = document.getElementById(`${prefijo}-save-text`)
  const spin = document.getElementById(`${prefijo}-save-spinner`)
  if (!btn) return
  btn.disabled = on
  text.classList.toggle('hidden', on)
  spin.classList.toggle('hidden', !on)
}

function mostrarMsg(id, tipo, texto) {
  const el = document.getElementById(id)
  if (!el) return
  el.className = tipo === 'ok' ? 'alert alert-success' : 'alert alert-danger'
  el.textContent = texto
  el.classList.remove('hidden')
  setTimeout(() => el.classList.add('hidden'), 5000)
}
