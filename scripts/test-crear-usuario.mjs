import { chromium } from 'playwright'

const URL   = 'http://localhost:5000'
const EMAIL = 'danias12.dpa@gmail.com'
const PASS  = 'mjvc0212DM@'

const NUEVO_EMAIL  = `test.asesor.${Date.now()}@sizo-test.com`
const NUEVO_NOMBRE = 'Asesor de Prueba'
const NUEVO_ROL    = 'ASESOR'

;(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 400 })
  const page    = await browser.newPage()

  page.on('console', m => console.log(`[browser:${m.type()}]`, m.text()))
  page.on('response', r => { if (!r.ok() && r.url().includes('supabase')) console.log('[red]', r.status(), r.url()) })

  console.log('▶ Abriendo app...')
  await page.goto(URL)
  await page.waitForSelector('#login-email', { timeout: 10000 })

  await page.fill('#login-email',    EMAIL)
  await page.fill('#login-password', PASS)
  await page.click('#login-btn')

  // Esperar más tiempo y capturar estado
  await page.waitForTimeout(5000)
  await page.screenshot({ path: 'scripts/screenshot-login.png', fullPage: true })
  console.log('📸 Screenshot guardado en scripts/screenshot-login.png')

  const appVisible = await page.locator('#app-shell:not(.hidden)').count()
  const errVisible = await page.locator('#login-error:not(.hidden)').count()

  if (errVisible > 0) {
    const errMsg = await page.locator('#login-error').textContent()
    console.error('✗ Error de login visible:', errMsg)
    await browser.close()
    process.exit(1)
  }

  if (appVisible === 0) {
    console.error('✗ App no cargó tras login')
    await browser.close()
    process.exit(1)
  }

  console.log('✓ Login exitoso')

  // ── Navegar a Usuarios ──
  await page.click('[data-route="usuarios"]')
  await page.waitForSelector('#usuarios-tabla-wrap table, #usuarios-tabla-wrap .empty-state', { timeout: 8000 })
  console.log('✓ Módulo Usuarios cargado')

  // ── Abrir modal de creación ──
  await page.click('#btn-crear-usuario')
  await page.waitForSelector('#form-crear-usuario', { timeout: 5000 })
  console.log('✓ Modal de creación abierto')

  // ── Llenar formulario ──
  await page.fill('#nuevo-nombre', NUEVO_NOMBRE)
  await page.fill('#nuevo-email',  NUEVO_EMAIL)
  await page.selectOption('#nuevo-rol', NUEVO_ROL)
  console.log(`✓ Formulario llenado`)

  // ── Enviar ──
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().includes('crear-usuario'), { timeout: 15000 }),
    page.click('#btn-guardar-crear'),
  ])

  const status = response.status()
  const body   = await response.json().catch(() => ({}))
  console.log(`Edge Function → HTTP ${status}`, JSON.stringify(body))

  await page.screenshot({ path: 'scripts/screenshot-resultado.png', fullPage: true })
  console.log('📸 Screenshot guardado en scripts/screenshot-resultado.png')

  if (status === 201) {
    await page.waitForSelector('#usuarios-tabla-wrap table', { timeout: 8000 })
    const filas = await page.$$('#usuarios-tabla-wrap tbody tr')
    console.log(`✓ Tabla con ${filas.length} usuario(s)`)
    console.log('\n✅ PRUEBA EXITOSA')
  } else {
    console.error(`\n✗ PRUEBA FALLIDA — HTTP ${status}:`, body)
  }

  await page.waitForTimeout(2000)
  await browser.close()
})()
