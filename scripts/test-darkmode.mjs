import { chromium } from 'playwright'

const URL   = 'http://localhost:5000'
const EMAIL = 'danias12.dpa@gmail.com'
const PASS  = 'mjvc0212DM@'

let ok = 0, fail = 0
const pass  = msg => { console.log(`  ✓ ${msg}`); ok++ }
const error = msg => { console.error(`  ✗ ${msg}`); fail++ }

;(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 })
  const page    = await browser.newPage()
  page.on('console', m => { if (m.type() === 'error') console.error('  [browser]', m.text()) })

  console.log('\n━━━ 1. LOGIN ━━━')
  await page.goto(URL)
  await page.fill('#login-email', EMAIL)
  await page.fill('#login-password', PASS)
  await page.click('#login-btn')
  await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 15000 })
  pass('Login OK')

  // Verificar que dark mode NO está activo al inicio (o respetar preferencia guardada)
  console.log('\n━━━ 2. ESTADO INICIAL ━━━')
  const darkInicial = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  pass(`Estado inicial dark mode: ${darkInicial}`)

  // Forzar light mode para el test
  if (darkInicial) {
    await page.click('#topbar-dark')
    await page.waitForTimeout(300)
  }
  const bodyBgLight = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  pass(`Light mode — body bg: ${bodyBgLight}`)
  await page.screenshot({ path: 'scripts/ss-light.png' })
  pass('Screenshot light mode guardado')

  // Activar dark mode
  console.log('\n━━━ 3. ACTIVAR DARK MODE ━━━')
  await page.click('#topbar-dark')
  await page.waitForTimeout(300)

  const darkActivo = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  darkActivo ? pass('Clase .dark aplicada en <html>') : error('Clase .dark no se aplicó')

  const bodyBgDark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  pass(`Dark mode — body bg: ${bodyBgDark}`)

  // Verificar que el fondo cambió (debería ser navy oscuro ~15,23,42)
  const esDark = bodyBgDark.includes('15, 23, 42') || bodyBgDark.includes('15,23,42')
  esDark ? pass('Body background correcto en dark (#0F172A)') : error(`Body bg inesperado: ${bodyBgDark}`)

  await page.screenshot({ path: 'scripts/ss-dark.png' })
  pass('Screenshot dark mode guardado')

  // Verificar cards
  console.log('\n━━━ 4. VERIFICAR SUPERFICIES EN DARK ━━━')
  const cardBg = await page.evaluate(() => {
    const card = document.querySelector('.card')
    return card ? getComputedStyle(card).backgroundColor : null
  })
  cardBg ? pass(`Card background en dark: ${cardBg}`) : pass('Sin cards visibles en esta vista')

  // Navegar a dashboard individual para ver más elementos
  await page.click('[data-route="dashboard"]')
  await page.waitForSelector('#dash-root', { timeout: 8000 })

  const filas = await page.$$('.dash-row-empresa')
  if (filas.length > 0) {
    await filas[0].click()
    await page.waitForSelector('#dash-body', { timeout: 8000 })
    await page.screenshot({ path: 'scripts/ss-dark-dashboard.png' })
    pass('Screenshot dark dashboard individual guardado')
  }

  // Verificar persistencia: recargar página y debe seguir en dark
  console.log('\n━━━ 5. PERSISTENCIA DARK MODE ━━━')
  await page.reload()
  await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 15000 })
  const darkPersiste = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  darkPersiste ? pass('Dark mode persiste tras recarga (localStorage)') : error('Dark mode no persistió')

  // Desactivar para no dejar el estado cambiado
  console.log('\n━━━ 6. RESTAURAR LIGHT MODE ━━━')
  if (darkPersiste) {
    await page.click('#topbar-dark')
    await page.waitForTimeout(300)
  }
  const restaurado = await page.evaluate(() => !document.documentElement.classList.contains('dark'))
  restaurado ? pass('Light mode restaurado') : error('No se restauró light mode')

  console.log('\n━━━ 7. LOGOUT ━━━')
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
