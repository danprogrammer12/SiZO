// SIZO — Configuración de Playwright Test
// Suite formal de regresión (QA), separada de los scripts ad-hoc en scripts/
// y testing/QA/ (que se mantienen como están — no se tocan aquí).
//
// Proyectos:
//   - api: pruebas de integración contra Supabase (RLS, RPC, Edge Functions).
//     No usan navegador — corren como Node puro contra el backend real.
//   - unit: motores de cálculo puros (GTC 45, indicadores Dec. 1072). Sin red.
//   - e2e: flujos de UI reales sobre el SPA (requiere el server local, ver webServer).
//
// Uso:
//   npx playwright test --project=unit    (rápido, sin red, corre siempre)
//   npx playwright test --project=api      (requiere .env con credenciales Supabase)
//   npx playwright test --project=e2e      (levanta "npm run serve" automáticamente)

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false, // los tests de api/e2e comparten tenant y usuarios de prueba
  retries: 0,
  reporter: [['list']],

  projects: [
    {
      name: 'unit',
      testMatch: 'unit/**/*.spec.js',
    },
    {
      name: 'api',
      testMatch: 'api/**/*.spec.js',
    },
    {
      name: 'e2e',
      testMatch: 'e2e/**/*.spec.js',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5000/',
      },
    },
  ],

  webServer: {
    command: 'npm run serve',
    url: 'http://localhost:5000',
    reuseExistingServer: true,
    timeout: 15_000,
  },
})
