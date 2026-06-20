import { chromium } from 'playwright'

const URL   = 'http://localhost:5000'
const EMAIL = 'danias12.dpa@gmail.com'
const PASS  = 'mjvc0212DM@'

let ok = 0, fail = 0
const pass  = msg => { console.log(`  ✓ ${msg}`); ok++ }
const error = msg => { console.error(`  ✗ ${msg}`); fail++ }

async function testViewport(browser, label, width, height) {
  console.log(`\n━━━ ${label} (${width}×${height}) ━━━`)
  const page = await browser.newPage()
  await page.setViewportSize({ width, height })
  page.on('console', m => { if (m.type() === 'error') console.error(`  [${label}]`, m.text()) })

  await page.goto(URL)
  await page.waitForSelector('#login-email', { timeout: 10000 })
  await page.fill('#login-email', EMAIL)
  await page.fill('#login-password', PASS)
  await page.click('#login-btn')
  await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 15000 })
  pass(`${label}: login OK`)

  // Sidebar oculto en mobile
  if (width <= 768) {
    const sidebar = page.locator('.sidebar')
    const transform = await sidebar.evaluate(el => getComputedStyle(el).transform)
    const oculto = transform.includes('-') || transform === 'matrix(1, 0, 0, 1, -240, 0)'
    oculto ? pass(`${label}: sidebar oculto (drawer)`)
           : error(`${label}: sidebar debería estar oculto — transform: ${transform}`)

    // Botón hamburguesa visible
    const menuBtn = page.locator('#topbar-menu')
    const menuVisible = await menuBtn.isVisible()
    menuVisible ? pass(`${label}: botón hamburguesa visible`) : error(`${label}: hamburguesa no visible`)

    // Abrir sidebar
    await menuBtn.click()
    await page.waitForTimeout(400)
    const overlayVisible = await page.locator('#sidebar-overlay').evaluate(el => el.classList.contains('visible'))
    overlayVisible ? pass(`${label}: overlay visible al abrir sidebar`) : error(`${label}: overlay no apareció`)

    // Cerrar con overlay
    await page.click('#sidebar-overlay')
    await page.waitForTimeout(400)
    const overlayClosed = await page.locator('#sidebar-overlay').evaluate(el => !el.classList.contains('visible'))
    overlayClosed ? pass(`${label}: overlay cerrado al hacer clic`) : error(`${label}: overlay no se cerró`)
  }

  // En mobile, abrir sidebar para poder navegar
  if (width <= 768) {
    await page.click('#topbar-menu')
    await page.waitForTimeout(400)
  }

  // Contenido visible sin desbordamiento
  await page.click('[data-route="dashboard"]')
  await page.waitForSelector('#dash-root', { timeout: 8000 })
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
  bodyWidth <= width + 5
    ? pass(`${label}: sin desbordamiento horizontal (scroll: ${bodyWidth}px)`)
    : error(`${label}: desbordamiento horizontal — body: ${bodyWidth}px > viewport: ${width}px`)

  await page.screenshot({ path: `scripts/ss-resp-${width}.png` })
  pass(`${label}: screenshot guardado`)

  await page.close()
}

;(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 })

  await testViewport(browser, 'Desktop', 1440, 900)
  await testViewport(browser, 'Tablet',   768, 1024)
  await testViewport(browser, 'Mobile',   390,  844)

  await browser.close()

  console.log(`\n━━━ RESULTADO ━━━`)
  console.log(`  PASS: ${ok}   FAIL: ${fail}`)
  fail === 0 ? console.log('\n✅ TODOS LOS CASOS PASARON\n') : console.log('\n⚠️  ALGUNOS CASOS FALLARON\n')
  process.exit(fail > 0 ? 1 : 0)
})()
