import { chromium } from 'playwright'
import { existsSync, statSync } from 'fs'

const URL   = 'http://localhost:5000'
const EMAIL = 'danias12.dpa@gmail.com'
const PASS  = 'mjvc0212DM@'

let ok = 0, fail = 0
const pass  = msg => { console.log(`  ✓ ${msg}`); ok++ }
const error = msg => { console.error(`  ✗ ${msg}`); fail++ }

;(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 400 })
  const ctx     = await browser.newContext({ acceptDownloads: true })
  const page    = await ctx.newPage()
  page.on('console', m => { if (m.type() === 'error') console.error('  [browser]', m.text()) })

  console.log('\n━━━ 1. LOGIN ━━━')
  await page.goto(URL)
  await page.waitForSelector('#login-email', { timeout: 10000 })
  await page.fill('#login-email', EMAIL)
  await page.fill('#login-password', PASS)
  await page.click('#login-btn')
  await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 15000 })
  pass('Login como ADMIN')

  console.log('\n━━━ 2. NAVEGAR AL DASHBOARD ━━━')
  await page.click('[data-route="dashboard"]')
  await page.waitForSelector('.dash-tabla-cartera, .empty-state', { timeout: 10000 })

  const filas = await page.$$('.dash-row-empresa')
  if (filas.length === 0) {
    error('No hay empresas disponibles para probar')
    await browser.close()
    process.exit(1)
  }
  pass(`Vista consolidada con ${filas.length} empresa(s)`)

  await filas[0].click()
  await page.waitForSelector('#dash-body', { timeout: 8000 })
  pass('Vista individual cargada')

  console.log('\n━━━ 3. BOTÓN EXPORTAR EXCEL ━━━')
  const btnExcel = page.locator('#btn-excel')
  await btnExcel.waitFor({ timeout: 5000 })
  const visible = await btnExcel.isVisible()
  visible ? pass('Botón "Exportar Excel" visible') : error('Botón no encontrado')

  console.log('\n━━━ 4. GENERAR Y DESCARGAR XLSX ━━━')
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    btnExcel.click(),
  ])

  const nombre = download.suggestedFilename()
  pass(`Descarga iniciada: ${nombre}`)
  nombre.endsWith('.xlsx') ? pass('Extensión .xlsx correcta') : error(`Extensión inesperada: ${nombre}`)

  const destino = `scripts/${nombre}`
  await download.saveAs(destino)

  if (existsSync(destino)) {
    const { size } = statSync(destino)
    size > 5000
      ? pass(`Archivo guardado (${Math.round(size / 1024)} KB) — ${destino}`)
      : error(`Archivo muy pequeño (${size} bytes) — posible error`)
  } else {
    error('Archivo no encontrado en disco tras la descarga')
  }

  await page.screenshot({ path: 'scripts/ss-excel-btn.png' })
  pass('Screenshot guardado')

  console.log('\n━━━ 5. LOGOUT ━━━')
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
