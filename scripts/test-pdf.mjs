import { chromium } from 'playwright'
import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import os from 'os'

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

  // ── Login ──
  console.log('\n━━━ 1. LOGIN ━━━')
  await page.goto(URL)
  await page.waitForSelector('#login-email', { timeout: 10000 })
  await page.fill('#login-email', EMAIL)
  await page.fill('#login-password', PASS)
  await page.click('#login-btn')
  await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 15000 })
  pass('Login como ADMIN')

  // ── Seleccionar una empresa con datos ──
  console.log('\n━━━ 2. SELECCIONAR EMPRESA CON DATOS ━━━')
  await page.click('[data-route="dashboard"]')
  await page.waitForSelector('.dash-tabla-cartera, .empty-state', { timeout: 10000 })

  // Buscar primera empresa con estado distinto a "Sin datos"
  const filasConDatos = page.locator('.dash-row-empresa').filter({ hasText: /Bien|Atención|Crítico/ })
  const contFilas = await filasConDatos.count()

  if (contFilas > 0) {
    await filasConDatos.first().click()
    pass('Empresa con datos seleccionada')
  } else {
    // Si no hay empresa con datos, seleccionar cualquiera
    const filas = await page.$$('.dash-row-empresa')
    if (filas.length > 0) {
      await filas[0].click()
      pass('Empresa seleccionada (sin datos de seguimiento)')
    } else {
      error('No hay empresas disponibles')
      await browser.close()
      process.exit(1)
    }
  }

  await page.waitForSelector('#dash-body', { timeout: 8000 })
  pass('Vista individual cargada')

  // ── Verificar botón PDF ──
  console.log('\n━━━ 3. BOTÓN DESCARGAR PDF ━━━')
  const btnPDF = page.locator('#btn-pdf')
  await btnPDF.waitFor({ timeout: 5000 })
  const btnVisible = await btnPDF.isVisible()
  btnVisible ? pass('Botón "Descargar PDF" visible') : error('Botón no encontrado')

  // ── Descargar PDF ──
  console.log('\n━━━ 4. GENERAR Y DESCARGAR PDF ━━━')
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    btnPDF.click(),
  ])

  const nombreArchivo = download.suggestedFilename()
  pass(`Descarga iniciada: ${nombreArchivo}`)

  // Guardar y verificar
  const destino = join('scripts', nombreArchivo)
  await download.saveAs(destino)

  if (existsSync(destino)) {
    const { size } = (await import('fs')).statSync(destino)
    size > 10000
      ? pass(`PDF guardado (${Math.round(size / 1024)} KB) — ${destino}`)
      : error(`PDF muy pequeño (${size} bytes) — posible error`)
  } else {
    error('PDF no encontrado en disco tras la descarga')
  }

  await page.screenshot({ path: 'scripts/ss-pdf-btn.png' })
  pass('Screenshot con botón PDF guardado')

  // ── Logout ──
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
