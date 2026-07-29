// SIZO — E2E: flujo base ESTABLE del Gestor Documental
// ─────────────────────────────────────────────────────────────────────
// La firma digital (dibujo/imagen/posicionamiento) está en ajuste activo
// (ver docs/estado-sizo-2026-07-28.md) — a propósito NO se prueba aquí,
// para que este spec no se rompa por cambios en esa área todavía
// inestable. Cubre únicamente lo que ya es estable en producción:
// subir documento → categorizar → badge de vigencia correcto → previsualizar.
//
// Corre contra el server local real (webServer en playwright.config.js
// levanta "npm run serve" si no está corriendo) y contra el backend
// Supabase real de .env — no hay mocks de Auth/Storage/DB.
//
// Efectos secundarios: crea un usuario ADMIN de prueba y una empresa
// `[QA-PW E2E]`, y sube documentos reales al bucket `documentos`. Todo
// se limpia en afterAll (fila de `documentos`, archivo en Storage,
// empresa y usuario).

import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { adminClient, getTenantId, ensureUser, TEST_PASSWORD, deleteTestUser } from '../helpers/supabase-test-context.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PDF_FIXTURE = path.join(__dirname, '../fixtures/qa-documento.pdf')

const EMAIL_ADMIN = 'qa-admin-gd-e2e@sizo.test'
const EMPRESA_NOMBRE = '[QA-PW E2E] Gestor Documental'

const admin = adminClient()
let tenantId, adminUid, empresaId
const storagePathsSubidos = []

test.beforeAll(async () => {
  ;({ tenantId, adminUid } = await getTenantId(admin))
  await ensureUser(admin, { email: EMAIL_ADMIN, rol: 'ADMIN', tenantId, empresasIds: [] })

  const { data: existing } = await admin.from('empresas').select('id')
    .eq('tenant_id', tenantId).eq('nombre', EMPRESA_NOMBRE).maybeSingle()
  if (existing) {
    empresaId = existing.id
  } else {
    const { data, error } = await admin.from('empresas').insert({
      tenant_id: tenantId, nombre: EMPRESA_NOMBRE, ciudad: 'QA', trab: 1, activa: true,
      creado_por: adminUid, updated_by: adminUid,
    }).select('id').single()
    if (error) throw new Error(`crear empresa fixture: ${error.message}`)
    empresaId = data.id
  }
})

test.afterAll(async () => {
  const { data: docs } = await admin.from('documentos').select('id, storage_path').eq('empresa_id', empresaId)
  for (const d of docs || []) {
    if (d.storage_path) await admin.storage.from('documentos').remove([d.storage_path])
  }
  for (const p of storagePathsSubidos) {
    await admin.storage.from('documentos').remove([p]).catch(() => {})
  }
  if (empresaId) {
    await admin.from('documentos').delete().eq('empresa_id', empresaId)
    await admin.from('empresas').delete().eq('id', empresaId)
  }
  await deleteTestUser(admin, EMAIL_ADMIN)
})

async function login(page) {
  await page.goto('/')
  await page.fill('#login-email', EMAIL_ADMIN)
  await page.fill('#login-password', TEST_PASSWORD)
  await page.click('#login-btn')
  await expect(page.locator('#app-shell')).toBeVisible({ timeout: 10_000 })
}

async function irAGestorDocumental(page) {
  await page.click('[data-route="gestor-documental"]')
  await expect(page.locator('.page-title')).toHaveText('Gestor Documental')
  // cargarDocumentos() puebla #gd-f-empresa de forma asíncrona (Promise.all con
  // db.list('empresas')) — sin esto, "Subir documento" puede abrirse antes de
  // que la empresa de prueba aparezca en el <select>, y selectOption por label falla.
  await expect(page.locator(`#gd-f-empresa option:has-text("${EMPRESA_NOMBRE}")`)).toBeAttached({ timeout: 10_000 })
}

async function subirDocumento(page, { nombre, categoriaLabel, fechaVigencia }) {
  await page.click('#btn-subir-doc')
  await page.setInputFiles('#subir-file', PDF_FIXTURE)
  await page.selectOption('#subir-categoria', { label: categoriaLabel })
  await page.fill('#subir-nombre', nombre)
  await page.selectOption('#subir-empresa', { label: EMPRESA_NOMBRE })
  if (fechaVigencia) await page.fill('#subir-fecha-vigencia', fechaVigencia)
  await page.click('#btn-confirmar-subir')
  await expect(page.locator('.toast-message')).toContainText(/subido correctamente/i, { timeout: 10_000 })
}

function fechaEnDias(dias) {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

test.describe('Gestor Documental — flujo base estable', () => {
  test('login como ADMIN y navegar al Gestor Documental', async ({ page }) => {
    await login(page)
    await irAGestorDocumental(page)
    await expect(page.locator('#btn-subir-doc')).toBeVisible()
  })

  test('subir un documento, categorizarlo y verlo en la tabla', async ({ page }) => {
    await login(page)
    await irAGestorDocumental(page)

    const nombre = `QA E2E Documento ${Date.now()}`
    await subirDocumento(page, { nombre, categoriaLabel: 'Manual del SG-SST', fechaVigencia: fechaEnDias(120) })

    const fila = page.locator('tr', { hasText: nombre })
    await expect(fila).toBeVisible()
    await expect(fila.locator('td').nth(2)).toHaveText('Manual del SG-SST')
  })

  test('vigencia futura (>30 días) muestra badge "Vigente"', async ({ page }) => {
    await login(page)
    await irAGestorDocumental(page)

    const nombre = `QA E2E Vigente ${Date.now()}`
    await subirDocumento(page, { nombre, categoriaLabel: 'Otros', fechaVigencia: fechaEnDias(120) })

    const fila = page.locator('tr', { hasText: nombre })
    await expect(fila.locator('td').nth(3)).toContainText('Vigente')
  })

  test('vigencia dentro de 30 días muestra badge "Por vencer"', async ({ page }) => {
    await login(page)
    await irAGestorDocumental(page)

    const nombre = `QA E2E Por Vencer ${Date.now()}`
    await subirDocumento(page, { nombre, categoriaLabel: 'Otros', fechaVigencia: fechaEnDias(10) })

    const fila = page.locator('tr', { hasText: nombre })
    await expect(fila.locator('td').nth(3)).toContainText('Por vencer')
  })

  test('vigencia pasada muestra badge "Vencido"', async ({ page }) => {
    await login(page)
    await irAGestorDocumental(page)

    const nombre = `QA E2E Vencido ${Date.now()}`
    await subirDocumento(page, { nombre, categoriaLabel: 'Otros', fechaVigencia: fechaEnDias(-5) })

    const fila = page.locator('tr', { hasText: nombre })
    await expect(fila.locator('td').nth(3)).toContainText('Vencido')
  })

  test('previsualizar un documento abre el modal con el PDF', async ({ page }) => {
    await login(page)
    await irAGestorDocumental(page)

    const nombre = `QA E2E Preview ${Date.now()}`
    await subirDocumento(page, { nombre, categoriaLabel: 'Otros' })

    const fila = page.locator('tr', { hasText: nombre })
    await fila.locator('[data-accion="previsualizar"]').first().click()

    await expect(page.locator('.modal-title')).toContainText('Vista previa', { timeout: 10_000 })
    await expect(page.locator('object[type="application/pdf"]')).toBeVisible()
  })
})
