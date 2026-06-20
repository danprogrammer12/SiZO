// Test E2E completo — módulo Usuarios
// Cubre: login, creación de los 3 roles, validaciones de formulario, duplicado
import { chromium } from 'playwright'

const URL   = 'http://localhost:5000'
const EMAIL = 'danias12.dpa@gmail.com'
const PASS  = 'mjvc0212DM@'
const TS    = Date.now()

const USUARIOS_NUEVOS = [
  { nombre: 'Admin Secundario',  email: `admin2.${TS}@sizo-test.com`,   rol: 'ADMIN'    },
  { nombre: 'Asesor SST Test',   email: `asesor.${TS}@sizo-test.com`,   rol: 'ASESOR'   },
  { nombre: 'Consulta Test',     email: `consulta.${TS}@sizo-test.com`, rol: 'CONSULTA' },
]

let ok = 0, fail = 0
function pass(msg) { console.log(`  ✓ ${msg}`); ok++ }
function error(msg) { console.error(`  ✗ ${msg}`); fail++ }

async function crearUsuario(page, { nombre, email, rol }) {
  await page.click('#btn-crear-usuario')
  await page.waitForSelector('#form-crear-usuario', { timeout: 5000 })

  await page.fill('#nuevo-nombre', nombre)
  await page.fill('#nuevo-email',  email)
  await page.selectOption('#nuevo-rol', rol)

  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().includes('crear-usuario'), { timeout: 15000 }),
    page.click('#btn-guardar-crear'),
  ])

  const status = response.status()
  const body   = await response.json().catch(() => ({}))
  return { status, body }
}

;(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 })
  const page    = await browser.newPage()
  page.on('console', m => { if (m.type() === 'error') console.error('  [browser]', m.text()) })

  // ════════════════════════════════════════════════════
  console.log('\n━━━ 1. LOGIN ━━━')
  // ════════════════════════════════════════════════════
  await page.goto(URL)
  await page.waitForSelector('#login-email', { timeout: 10000 })
  await page.fill('#login-email',    EMAIL)
  await page.fill('#login-password', PASS)
  await page.click('#login-btn')
  await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 15000 })
  pass('Login como ADMIN exitoso')
  await page.screenshot({ path: 'scripts/ss-01-login.png' })

  // ════════════════════════════════════════════════════
  console.log('\n━━━ 2. NAVEGAR AL MÓDULO USUARIOS ━━━')
  // ════════════════════════════════════════════════════
  await page.click('[data-route="usuarios"]')
  await page.waitForSelector('#usuarios-tabla-wrap table, #usuarios-tabla-wrap .empty-state', { timeout: 8000 })
  pass('Módulo Usuarios cargado')

  const botonVisible = await page.locator('#btn-crear-usuario').isVisible()
  botonVisible ? pass('Botón "Nuevo usuario" visible para ADMIN') : error('Botón "Nuevo usuario" no encontrado')
  await page.screenshot({ path: 'scripts/ss-02-modulo-usuarios.png' })

  // ════════════════════════════════════════════════════
  console.log('\n━━━ 3. VALIDACIÓN — CAMPOS VACÍOS ━━━')
  // ════════════════════════════════════════════════════
  await page.click('#btn-crear-usuario')
  await page.waitForSelector('#form-crear-usuario', { timeout: 5000 })
  await page.click('#btn-guardar-crear')
  await page.waitForTimeout(500)
  const errVacio = await page.locator('#form-crear-error:not(.hidden)').count()
  errVacio > 0 ? pass('Validación de campos vacíos funciona') : error('No mostró error con campos vacíos')
  await page.click('#btn-cancelar-crear')
  await page.waitForSelector('#form-crear-usuario', { state: 'hidden', timeout: 3000 })
  pass('Modal se cierra con Cancelar')

  // ════════════════════════════════════════════════════
  console.log('\n━━━ 4. CREAR USUARIOS — 3 ROLES ━━━')
  // ════════════════════════════════════════════════════
  for (const u of USUARIOS_NUEVOS) {
    console.log(`\n  → Creando ${u.rol}: ${u.nombre}`)
    const { status, body } = await crearUsuario(page, u)

    if (status === 201) {
      pass(`HTTP 201 — uid: ${body.uid}`)
      // Esperar que modal cierre y tabla recargue
      await page.waitForSelector('#form-crear-usuario', { state: 'hidden', timeout: 5000 }).catch(() => {})
      await page.waitForSelector('#usuarios-tabla-wrap table', { timeout: 6000 })
      const enTabla = await page.locator(`text=${u.nombre}`).count()
      enTabla > 0 ? pass(`"${u.nombre}" aparece en la tabla`) : error(`"${u.nombre}" no aparece en la tabla`)
    } else {
      error(`HTTP ${status}: ${body.error || JSON.stringify(body)}`)
      // Cerrar modal si sigue abierto
      await page.click('#btn-cancelar-crear').catch(() => {})
      await page.waitForSelector('#form-crear-usuario', { state: 'hidden', timeout: 3000 }).catch(() => {})
    }
  }

  await page.screenshot({ path: 'scripts/ss-03-tabla-con-usuarios.png' })

  // ════════════════════════════════════════════════════
  console.log('\n━━━ 5. VALIDACIÓN — EMAIL DUPLICADO ━━━')
  // ════════════════════════════════════════════════════
  const { status: stDup, body: bodyDup } = await crearUsuario(page, {
    nombre: 'Duplicado Test',
    email:  USUARIOS_NUEVOS[1].email,  // mismo email del ASESOR ya creado
    rol:    'ASESOR',
  })
  if (stDup === 409) {
    pass(`Error 409 al duplicar correo — mensaje: "${bodyDup.error}"`)
    // El error se muestra en el modal — cerrar
    await page.click('#btn-cancelar-crear').catch(() => {})
  } else {
    error(`Se esperaba 409, se recibió ${stDup}`)
    await page.click('#btn-cancelar-crear').catch(() => {})
  }
  await page.waitForSelector('#form-crear-usuario', { state: 'hidden', timeout: 3000 }).catch(() => {})

  // ════════════════════════════════════════════════════
  console.log('\n━━━ 6. CONTEO FINAL EN TABLA ━━━')
  // ════════════════════════════════════════════════════
  await page.waitForSelector('#usuarios-tabla-wrap table', { timeout: 5000 })
  const filas = await page.$$('#usuarios-tabla-wrap tbody tr')
  // Admin original + 3 nuevos = 4 mínimo
  filas.length >= 4
    ? pass(`Tabla muestra ${filas.length} usuarios (esperado ≥ 4)`)
    : error(`Tabla muestra solo ${filas.length} usuarios`)
  await page.screenshot({ path: 'scripts/ss-04-resultado-final.png' })

  // ════════════════════════════════════════════════════
  console.log('\n━━━ 7. LOGOUT ━━━')
  // ════════════════════════════════════════════════════
  await page.click('#logout-btn').catch(async () => {
    // Algunos temas tienen el logout en un menú
    await page.locator('[title="Cerrar sesión"], [aria-label="Cerrar sesión"]').first().click()
  })
  await page.waitForSelector('#auth-screen:not(.hidden)', { timeout: 8000 })
  pass('Logout exitoso — pantalla de login visible')
  await page.screenshot({ path: 'scripts/ss-05-logout.png' })

  // ════════════════════════════════════════════════════
  console.log('\n━━━ RESULTADO FINAL ━━━')
  console.log(`  PASS: ${ok}   FAIL: ${fail}`)
  fail === 0
    ? console.log('\n✅ TODOS LOS CASOS PASARON\n')
    : console.log('\n⚠️  ALGUNOS CASOS FALLARON — revisa los ✗ arriba\n')
  // ════════════════════════════════════════════════════

  await page.waitForTimeout(2000)
  await browser.close()
  process.exit(fail > 0 ? 1 : 0)
})()
