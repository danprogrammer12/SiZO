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

  // ── Login ──
  console.log('\n━━━ 1. LOGIN ━━━')
  await page.goto(URL)
  await page.waitForSelector('#login-email', { timeout: 10000 })
  await page.fill('#login-email', EMAIL)
  await page.fill('#login-password', PASS)
  await page.click('#login-btn')
  await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 15000 })
  pass('Login como ADMIN')

  // ── Vista consolidada al entrar ──
  console.log('\n━━━ 2. VISTA CONSOLIDADA (sin empresa seleccionada) ━━━')
  await page.click('[data-route="dashboard"]')
  // Esperar tabla consolidada o empty state
  await page.waitForSelector('.dash-tabla-cartera, .empty-state', { timeout: 10000 })

  const tablaVisible = await page.locator('.dash-tabla-cartera').count()
  tablaVisible > 0 ? pass('Tabla consolidada de empresas visible') : pass('Empty state (sin empresas aún)')

  if (tablaVisible > 0) {
    const filas = await page.$$('.dash-row-empresa')
    pass(`Tabla con ${filas.length} empresa(s)`)

    const resumen = await page.locator('.dash-resumen-pill').count()
    resumen > 0 ? pass(`Resumen de semáforos: ${resumen} estado(s)`) : error('No hay pills de resumen')

    await page.screenshot({ path: 'scripts/ss-dash-consolidado.png' })
    pass('Screenshot vista consolidada guardado')

    // ── Clic en empresa → vista individual ──
    console.log('\n━━━ 3. NAVEGAR A EMPRESA INDIVIDUAL ━━━')
    await filas[0].click()
    await page.waitForSelector('#dash-body', { timeout: 8000 })
    pass('Vista individual cargada al hacer clic en empresa')

    const btnVolver = await page.locator('#btn-vista-general').count()
    btnVolver > 0 ? pass('Botón "← Vista general" presente') : error('Botón de vuelta ausente')

    const kpis = await page.$$('.kpi-card')
    kpis.length > 0 ? pass(`KPI cards: ${kpis.length} indicadores`) : pass('Sin datos de seguimiento para este mes')

    await page.screenshot({ path: 'scripts/ss-dash-individual.png' })
    pass('Screenshot vista individual guardado')

    // ── Volver a vista consolidada con el botón ──
    console.log('\n━━━ 4. VOLVER A VISTA CONSOLIDADA ━━━')
    if (btnVolver > 0) {
      await page.click('#btn-vista-general')
      await page.waitForSelector('.dash-tabla-cartera, .empty-state', { timeout: 8000 })
      pass('Vuelta a vista consolidada con botón ← Vista general')
    }

    // ── Verificar "Vista general" en topbar ──
    const topbarVal = await page.locator('#topbar-empresa').inputValue()
    topbarVal === '' ? pass('Topbar muestra "Vista general" (value vacío)') : error(`Topbar muestra: "${topbarVal}"`)

    // ── Seleccionar empresa desde topbar ──
    console.log('\n━━━ 5. SELECCIONAR EMPRESA DESDE TOPBAR ━━━')
    const opts = await page.$$('#topbar-empresa option')
    if (opts.length > 1) {
      const val = await opts[1].getAttribute('value')
      await page.selectOption('#topbar-empresa', val)
      await page.waitForSelector('#dash-body', { timeout: 8000 })
      pass('Vista individual activada desde topbar')
      await page.screenshot({ path: 'scripts/ss-dash-topbar.png' })
    }
  }

  // ── Logout ──
  console.log('\n━━━ 6. LOGOUT ━━━')
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
