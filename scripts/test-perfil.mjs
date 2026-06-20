import { chromium } from 'playwright'

const URL   = 'http://localhost:5000'
const EMAIL = 'danias12.dpa@gmail.com'
const PASS  = 'mjvc0212DM@'

let ok = 0, fail = 0
const pass  = msg => { console.log(`  ✓ ${msg}`); ok++ }
const error = msg => { console.error(`  ✗ ${msg}`); fail++ }

;(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 400 })
  const page    = await browser.newPage()
  page.on('console', m => { if (m.type() === 'error') console.error('  [browser]', m.text()) })

  console.log('\n━━━ 1. LOGIN ━━━')
  await page.goto(URL)
  await page.waitForSelector('#login-email', { timeout: 10000 })
  await page.fill('#login-email', EMAIL)
  await page.fill('#login-password', PASS)
  await page.click('#login-btn')
  await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 15000 })
  pass('Login como ADMIN')

  console.log('\n━━━ 2. NAVEGAR AL PERFIL (clic en usuario sidebar) ━━━')
  await page.click('#sidebar-user')
  await page.waitForSelector('.page-title', { timeout: 8000 })
  const titulo = await page.locator('.page-title').textContent()
  titulo?.includes('perfil') ? pass('Módulo perfil cargado') : error(`Título inesperado: ${titulo}`)

  console.log('\n━━━ 3. VERIFICAR CAMPOS ━━━')
  const nombre = await page.locator('#perfil-nombre').inputValue()
  nombre ? pass(`Campo nombre tiene valor: "${nombre}"`) : error('Campo nombre vacío')

  const email = await page.locator('input[type="email"][disabled]').inputValue()
  email ? pass(`Campo email (solo lectura): "${email}"`) : error('Campo email vacío')

  const badge = await page.locator('.badge-info').textContent()
  badge ? pass(`Badge rol: "${badge.trim()}"`) : error('Badge de rol no encontrado')

  console.log('\n━━━ 4. EDITAR NOMBRE ━━━')
  const nombreOriginal = nombre
  const nombreNuevo = nombre + ' (test)'
  await page.fill('#perfil-nombre', nombreNuevo)
  await page.click('#perfil-save-btn')
  await page.waitForSelector('.alert-success', { timeout: 10000 })
  pass('Nombre guardado — mensaje de éxito visible')

  // Restaurar nombre original
  await page.fill('#perfil-nombre', nombreOriginal)
  await page.click('#perfil-save-btn')
  await page.waitForSelector('.alert-success', { timeout: 10000 })
  pass('Nombre restaurado')

  console.log('\n━━━ 5. VALIDACIÓN CONTRASEÑA — mismatch ━━━')
  await page.fill('#pass-nueva', 'clave1234')
  await page.fill('#pass-confirmar', 'clave5678')
  await page.click('#pass-save-btn')
  await page.waitForSelector('#pass-msg:not(.hidden)', { timeout: 5000 })
  const passMsg = await page.locator('#pass-msg').textContent()
  passMsg?.includes('coinciden') ? pass('Validación mismatch correcta') : error(`Msg inesperado: ${passMsg}`)

  console.log('\n━━━ 6. SCREENSHOT ━━━')
  await page.screenshot({ path: 'scripts/ss-perfil.png' })
  pass('Screenshot guardado')

  console.log('\n━━━ 7. VOLVER AL DASHBOARD ━━━')
  await page.click('[data-route="dashboard"]')
  await page.waitForSelector('#dash-root', { timeout: 8000 })
  pass('Navegación de vuelta al dashboard')

  console.log('\n━━━ 8. LOGOUT ━━━')
  await page.click('#logout-btn').catch(async () => {
    await page.locator('[title="Cerrar sesión"], [aria-label="Cerrar sesión"]').first().click()
  })
  await page.waitForSelector('#auth-screen:not(.hidden)', { timeout: 8000 })
  pass('Logout exitoso')

  console.log(`\n━━━ RESULTADO ━━━`)
  console.log(`  PASS: ${ok}   FAIL: ${fail}`)
  fail === 0 ? console.log('\n✅ TODOS LOS CASOS PASARON\n') : console.log('\n⚠️  ALGUNOS CASOS FALLARON\n')

  await page.waitForTimeout(2000)
  await browser.close()
  process.exit(fail > 0 ? 1 : 0)
})()
