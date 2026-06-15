# testing/QA — Auditoría y pruebas de calidad/seguridad de SIZO

Carpeta de QA y auditoría técnica. No contiene código de producción.

## Contenido

| Archivo | Qué es | Cómo correr |
|---------|--------|-------------|
| [`INFORME-AUDITORIA-2026-06-15.md`](./INFORME-AUDITORIA-2026-06-15.md) | Informe integral (arquitectura, seguridad, BD, código, pruebas) con 15 hallazgos clasificados por severidad | — (lectura) |
| [`poc-xss.mjs`](./poc-xss.mjs) | PoC **H1** — Stored XSS. Reproduce localmente los 3 sinks reales (celda de tabla, `<textarea>`, `err.message`). Sin red ni infraestructura. | `node testing/QA/poc-xss.mjs` |
| [`poc-rls-roles.mjs`](./poc-rls-roles.mjs) | PoC **H2/H3** — suite RLS **autenticada por rol** (CONSULTA, ASESOR). Demuestra que las pruebas actuales (service_role) no validan autorización. | `node testing/QA/poc-rls-roles.mjs` |
| [`poc-cleanup.mjs`](./poc-cleanup.mjs) | Limpieza de los artefactos creados por `poc-rls-roles.mjs` (usuarios `*.sizo.test` y empresas `[QA-RLS]`). | `node testing/QA/poc-cleanup.mjs` |

## Severidades

🔴 Crítico · 🟠 Grave · 🟡 Medio · 🟢 Menor

## Advertencia sobre `poc-rls-roles.mjs`

Tiene **efectos secundarios** sobre el proyecto Supabase real: crea/reutiliza usuarios
`consulta@sizo.test` y `asesor@sizo.test` y empresas `[QA-RLS]`. Requiere `.env` con
`SUPABASE_SERVICE_ROLE_KEY`. Revisa Auth → Users y borra los artefactos si no los necesitas.

## Estado

Hallazgos **pendientes de aprobación**. No se han autorizado ni aplicado correcciones de código.
