# SIZO — Suite de regresión (Playwright Test)

Suite formal de QA, separada de los scripts ad-hoc en `scripts/` y `testing/QA/`
(esos se mantienen tal cual — son PoCs de la auditoría 2026-06-15 y la suite de
humo original; no se tocan aquí).

## Estructura

```
tests/
  helpers/
    env.js                      — carga .env (sin dependencia dotenv nueva)
    supabase-test-context.js    — usuarios/clientes de prueba reutilizables
  unit/    — motores de cálculo puros, sin red (GTC 45, indicadores Dec. 1072)
  api/     — integración contra Supabase real (RLS, RPC, Edge Functions)
  e2e/     — flujos de UI sobre el SPA real (Playwright + navegador)
```

## Cómo correr

```bash
npm install                 # trae @playwright/test
npx playwright install      # descarga los navegadores (solo necesario para e2e)

npm run test:qa:unit        # rápido, sin red — corre siempre
npm run test:qa:api         # requiere .env con credenciales Supabase reales
npm run test:qa:e2e         # levanta "npm run serve" automáticamente
npm run test:qa             # los tres proyectos
```

## Efectos secundarios de `api/`

Los tests de `api/` crean usuarios `*.sizo.test` y empresas `[QA-PW] ...` en el
tenant del ADMIN configurado en `.env` (mismo patrón que `scripts/test-seguridad-rls.mjs`).
Se limpian solos en `afterAll`, incluso si algún test falla.

## Cobertura actual

| # | Área | Estado |
|---|------|--------|
| 1 | Seguridad y roles multitenant (RLS: CONSULTA/ASESOR) | pendiente |
| 2 | Regresión soft-delete vía RPC (`documentos`/`matriz_riesgos`/`actas`) | ✅ `api/soft-delete-rpc.spec.js` |
| 3 | Motores de cálculo puros (GTC 45, indicadores Dec. 1072) | pendiente |
| 4 | Edge Functions críticas (`registrar-tenant`, `crear-usuario`) | pendiente |
| 5 | Gestor Documental — flujo base estable (subir/categorizar/vigencia/previsualizar) | pendiente |
