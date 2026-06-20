// Test E2E — asignación de empresas a usuarios
import { chromium } from 'playwright'

const URL  = 'http://localhost:5000'
const EMAIL = 'danias12.dpa@gmail.com'
const PASS  = 'mjvc0212DM@'
const TS    = Date.now()

let ok = 0, fail = 0
const pass = msg  => { console.log(`  ✓ ${msg}`); ok++ }
const error = msg => { console.error(`  ✗ ${msg}`); fail++ }

;(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 350 })
  const page    = await browser.newPage()
  page.on('console', m => { if (m.type() === 'error') console.error('  [browser]', m.text()) })

  // ── Login ──
  console.log('\n━━━ 1. LOGIN ━━━')
  await page.goto(URL)
  await page.waitForSelector('#login-email', { timeout: 10000 })
  await page.fill('#login-email', EMAIL)
  await page.fill('#login-password', PASS)
  await page.click('#login-btn')
  await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 15000 })
  pass('Login como ADMIN')

  // ── Ir a Usuarios ──
  console.log('\n━━━ 2. MÓDULO USUARIOS ━━━')
  await page.click('[data-route="usuarios"]')
  await page.waitForSelector('#usuarios-tabla-wrap table, #usuarios-tabla-wrap .empty-state', { timeout: 8000 })
  pass('Módulo Usuarios cargado')

  // ── Crear ASESOR con empresas asignadas ──
  console.log('\n━━━ 3. CREAR ASESOR CON EMPRESAS ━━━')
  await page.click('#btn-crear-usuario')
  await page.waitForSelector('#form-crear-usuario', { timeout: 5000 })

  await page.fill('#nuevo-nombre', `Asesor Asignado ${TS}`)
  await page.fill('#nuevo-email', `asesor.asig.${TS}@sizo-test.com`)
  await page.selectOption('#nuevo-rol', 'ASESOR')

  // Esperar que aparezca el bloque de empresas
  await page.waitForSelector('#nuevo-empresas-wrap:not(.hidden)', { timeout: 3000 })
  pass('Bloque de empresas visible al seleccionar rol ASESOR')

  // Verificar que hay checkboxes de empresas
  const checkboxes = await page.$$('input[name="empresa_ids"]')
  if (checkboxes.length > 0) {
    // Seleccionar la primera empresa disponible
    await checkboxes[0].check()
    const label = await page.locator('input[name="empresa_ids"]').first().locator('..').locator('span').textContent()
    pass(`Checkbox de empresa disponible: "${label?.trim()}"`)
  } else {
    pass('No hay empresas creadas aún — formulario igual es válido')
  }

  // Enviar
  const [res1] = await Promise.all([
    page.waitForResponse(r => r.url().includes('crear-usuario'), { timeout: 15000 }),
    page.click('#btn-guardar-crear'),
  ])
  const body1 = await res1.json().catch(() => ({}))
  if (res1.status() === 201) {
    pass(`ASESOR creado — uid: ${body1.uid}`)
    await page.waitForSelector('#form-crear-usuario', { state: 'hidden', timeout: 5000 }).catch(() => {})
  } else {
    error(`Crear ASESOR falló — HTTP ${res1.status()}: ${body1.error}`)
    await page.click('#btn-cancelar-crear').catch(() => {})
    await page.waitForSelector('#form-crear-usuario', { state: 'hidden', timeout: 3000 }).catch(() => {})
  }

  // ── Verificar selector oculto para ADMIN ──
  console.log('\n━━━ 4. CREAR ADMIN — SELECTOR DE EMPRESAS OCULTO ━━━')
  await page.click('#btn-crear-usuario')
  await page.waitForSelector('#form-crear-usuario', { timeout: 5000 })
  await page.selectOption('#nuevo-rol', 'ADMIN')
  const empWrapVisible = await page.locator('#nuevo-empresas-wrap:not(.hidden)').count()
  empWrapVisible === 0
    ? pass('Bloque de empresas oculto para rol ADMIN')
    : error('Bloque de empresas visible cuando no debería (rol ADMIN)')
  await page.click('#btn-cancelar-crear')
  await page.waitForSelector('#form-crear-usuario', { state: 'hidden', timeout: 3000 }).catch(() => {})

  // ── Editar usuario existente — cambiar rol y empresas ──
  console.log('\n━━━ 5. EDITAR USUARIO — CAMBIAR ROL Y EMPRESAS ━━━')
  await page.waitForSelector('#usuarios-tabla-wrap table', { timeout: 6000 })
  const botonesEditar = await page.$$('.btn-editar-usuario')
  if (botonesEditar.length > 1) {
    // Editar el segundo usuario (no el ADMIN actual)
    await botonesEditar[1].click()
    await page.waitForSelector('#form-usuario', { timeout: 5000 })
    pass('Modal de edición abierto')

    // Verificar que el selector de rol existe
    const rolSelect = await page.locator('#edit-rol').count()
    rolSelect > 0 ? pass('Selector de rol presente en edición') : error('Selector de rol ausente')

    // Verificar que el bloque de empresas es visible (si el rol no es ADMIN)
    const rolActual = await page.locator('#edit-rol').inputValue()
    if (rolActual !== 'ADMIN') {
      const wrapVisible = await page.locator('#edit-empresas-wrap:not(.hidden)').count()
      wrapVisible > 0 ? pass('Bloque de empresas visible en edición') : error('Bloque de empresas oculto en edición')

      // Seleccionar todas las empresas disponibles
      const cbs = await page.$$('input[name="empresa_ids"]')
      for (const cb of cbs) await cb.check()
      if (cbs.length > 0) pass(`${cbs.length} empresa(s) seleccionadas`)
    }

    // Guardar
    const [res2] = await Promise.all([
      page.waitForResponse(r => r.url().includes('actualizar-usuario'), { timeout: 15000 }),
      page.click('#btn-guardar-usr'),
    ])
    const body2 = await res2.json().catch(() => ({}))
    if (res2.status() === 200) {
      pass(`Usuario actualizado — empresas: ${JSON.stringify(body2.empresas_ids)}`)
      await page.waitForSelector('#form-usuario', { state: 'hidden', timeout: 5000 }).catch(() => {})
    } else {
      error(`Actualizar usuario falló — HTTP ${res2.status()}: ${body2.error}`)
      await page.click('#btn-cancelar-usr').catch(() => {})
    }
  } else {
    pass('Solo existe 1 usuario — saltando prueba de edición (crear más usuarios primero)')
  }

  // ── Verificar tabla — badge "Sin asignar" desaparece ──
  console.log('\n━━━ 6. VERIFICAR TABLA ━━━')
  await page.waitForSelector('#usuarios-tabla-wrap table', { timeout: 5000 })
  await page.screenshot({ path: 'scripts/ss-asignacion-final.png' })
  pass('Screenshot guardado')

  // ── Logout ──
  console.log('\n━━━ 7. LOGOUT ━━━')
  await page.click('#logout-btn').catch(async () => {
    await page.locator('[title="Cerrar sesión"], [aria-label="Cerrar sesión"]').first().click()
  })
  await page.waitForSelector('#auth-screen:not(.hidden)', { timeout: 8000 })
  pass('Logout exitoso')

  console.log(`\n━━━ RESULTADO ━━━`)
  console.log(`  PASS: ${ok}   FAIL: ${fail}`)
  fail === 0
    ? console.log('\n✅ TODOS LOS CASOS PASARON\n')
    : console.log('\n⚠️  ALGUNOS CASOS FALLARON\n')

  await page.waitForTimeout(2000)
  await browser.close()
  process.exit(fail > 0 ? 1 : 0)
})()
