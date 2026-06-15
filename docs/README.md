# Documentación de SIZO

Índice de la documentación del proyecto. El código fuente vive en la raíz
(`index.html`, `*.js`, `components/`, `modules/`, `styles/`, `reports/`),
los scripts en `scripts/`, el backend en `supabase/` y las pruebas/QA en `testing/`.

## Estructura

| Carpeta | Contenido |
|---------|-----------|
| [`producto/`](./producto) | PRD y mapa de conocimiento del producto |
| [`fases/`](./fases) | Documentación de cada fase de implementación y pruebas de regresión |
| [`operacion/`](./operacion) | Runbooks y procedimientos operativos (Supabase) |
| [`historico/`](./historico) | Material obsoleto: era Firebase y prototipo original. Solo referencia histórica — **no refleja la arquitectura actual (Supabase)** |

## Vigente

- **`producto/PRD-SIZO-V1.md`** — Product Requirements Document.
- **`producto/SIZO-INDICE.md`** — mapa de conocimiento (nota: algunas rutas internas
  apuntan a la ubicación previa de los archivos; ver este índice para las actuales).
- **`fases/FASE-2-CORE-SGSST.md`**, **`fases/FASE-3-MODULOS-OPERATIVOS.md`** — fases implementadas.
- **`fases/PRUEBAS-REGRESION.md`** — documentación de la suite de regresión.
- **`operacion/RUNBOOK-SUPABASE.md`** — setup y operación de Supabase.

## Histórico (obsoleto)

`historico/` conserva el diseño Firestore/Firebase previo a la migración a Supabase,
el análisis de ingeniería inversa, los contextos de sesión antiguos, los prototipos
(`SGSST_ERP_Final.html`, `dashboard.html`) y las Cloud Functions de Firebase
(`functions/`, reemplazadas por `supabase/functions/`). No usar como referencia técnica actual.

## Auditoría y QA

La auditoría técnica y las pruebas de seguridad están en
[`../testing/QA/`](../testing/QA) (informe + PoCs).
