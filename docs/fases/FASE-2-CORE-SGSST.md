# SIZO — Fase 2: Core SG-SST

**Fecha:** 2026-06-13
**Estado:** ✅ Completada
**Stack:** HTML/CSS/JS vanilla + Supabase (Auth + PostgreSQL + RLS)

La Fase 2 implementa el núcleo funcional de SIZO: captura de datos operativos,
cálculo de indicadores y visualización ejecutiva. Toda la lógica corre en el
cliente sobre datos reales en Supabase.

---

## Contexto: migración a Supabase

Antes de la Fase 2, el proyecto migró de Firebase a Supabase (ver
`RUNBOOK-SUPABASE.md`). Esto dejó código de acceso a datos escrito contra el SDK
de Firestore en tres archivos, que fueron portados a Supabase como parte de esta fase.

---

## Componentes construidos

### 1. Capa de acceso a datos — `db.js`

Envoltura única sobre el cliente Supabase. Centraliza:

- **Conversión automática** `camelCase` (app) ↔ `snake_case` (PostgreSQL).
- **Campos de auditoría** inyectados en cada escritura: `tenant_id`,
  `creado_por`, `updated_by`, `updated_at`.
- **Soft delete** (`activo:false` + `deleted_at`).

API:

| Método | Uso |
|---|---|
| `db.list(tabla, { eq, order, ascending })` | Lista con filtros |
| `db.getById(tabla, id)` | Un registro por ID |
| `db.insert(tabla, data)` | Crea (inyecta auditoría) |
| `db.update(tabla, id, data)` | Actualiza |
| `db.upsert(tabla, data)` | Inserta o actualiza (ID compuesto) |
| `db.softDelete(tabla, id)` | Baja lógica |

El aislamiento multitenant lo garantizan las **RLS policies** del schema; `db.js`
solo inyecta los valores. Las policies leen `tenant_id` y `role` desde el
`app_metadata` del JWT.

### 2. Catálogo de indicadores — `catalogo.js`

Define los 20 KPIs SG-SST con sus metas reales (tomadas del prototipo aprobado),
dirección del semáforo (`inv`), tipo, unidad, periodicidad, normativa y fórmula.

- `CATALOGO` — mapa completo de fichas técnicas.
- `DESTACADOS` — los 6 KPIs mostrados como tarjetas en el dashboard.
- `ficha(key)` — acceso seguro a una ficha.

### 3. Seguimiento Mensual — `modules/seguimiento.js`

Fuente única de datos operativos. Formulario con **11 secciones** (~35 campos
numéricos) agrupados: accidentalidad, ausentismo, plan de trabajo, capacitación,
inspecciones, evaluaciones médicas, seguimiento SG-SST, COPASST, COCOLAB,
visitas y emergencias.

- ID compuesto determinístico: `{empresaId}_{year}_{mes}` → upsert idempotente.
- Carga el documento existente del período activo y lo precarga.
- Estado del mes: *Sin registrar / En progreso / Cerrado* (campo `completado`).
- Rol `CONSULTA` ve el formulario en modo solo lectura.
- Reacciona a cambios de empresa y período (selector de la barra superior).

### 4. Dashboard Ejecutivo — `modules/dashboard.js`

Vista consolidada del período activo:

- **6 tarjetas KPI** con semáforo (Óptimo/Aceptable/En riesgo/Crítico) según meta.
- **Gráfica de tendencia anual** (Canvas 2D vanilla): cumplimiento del plan,
  ausentismo y AT por mes.
- **Panel de alertas** derivadas de datos reales: acciones vencidas, AT sin
  investigar, casos médicos abiertos, AT mortales y contratos próximos a vencer.

### 5. Indicadores — `modules/indicadores.js`

Tabla de los 20 KPIs **calculados en vivo** para la empresa y mes seleccionados:
valor, meta, normativa y estado con semáforo. Incluye el motor de cálculo puro
(`calcularIndicadores`, `semaforo`) reutilizado por el dashboard.

### 6. Maestro de Indicadores — `modules/maestro.js`

Catálogo de **fichas técnicas** en formato tarjetas: fórmula, meta, periodicidad,
unidad y normativa de cada KPI. Referencia documental para el equipo SST.

### 7. Módulos portados a Supabase

| Archivo | Cambio |
|---|---|
| `components/topbar.js` | Selector de empresa ahora lee de Supabase |
| `modules/empresas.js` | CRUD de empresas sobre `db.js` |
| `modules/usuarios.js` | Lectura/edición de perfil + mensajería Supabase |

---

## Datos de prueba

`scripts/seed-demo.mjs` crea 2 empresas demo y 6 meses de seguimiento para
pruebas inmediatas:

```
node scripts/seed-demo.mjs
```

- **[DEMO] Hotel Mar Azul S.A.S** — 6 meses (Ene–Jun 2026) con datos variados.
- **[DEMO] Distribuciones Caribe Ltda** — sin seguimiento (para captura manual).

Es idempotente: borra los registros marcados `[DEMO]` antes de reinsertar.

---

## Cómo probar la Fase 2

1. `npm run serve` → http://localhost:5000
2. Selecciona **[DEMO] Hotel Mar Azul** en la barra superior.
3. Ponte en **Marzo 2026** (flechas de período).
4. Recorre **Dashboard → Indicadores → Seguimiento → Maestro**.
5. En **Empresas**, crea una empresa nueva para validar el alta.

---

## Arquitectura de datos (recordatorio)

```
JWT (Supabase Auth)
  └── app_metadata { tenant_id, role, empresas_ids }   ← fuente de verdad de permisos
        │
        ▼
  RLS policies (PostgreSQL)   ← aíslan por tenant y validan rol
        │
        ▼
  db.js  ← conversión camel/snake + auditoría
        │
        ▼
  módulos (seguimiento, dashboard, indicadores, empresas, ...)
```

---

## Pendiente para fases siguientes

- **Fase 3 (módulos operativos):** accidentes, ausencias, acciones ACPM,
  inspecciones, capacitación, plan de trabajo — hoy stubs.
- **Fase 4:** auditoría, casos médicos, evaluación de estructura.
- **Fase 5:** reportes PDF/Excel.
- Edición de metas personalizadas por empresa (tabla `configuracion`).
- Edge Function de alta de usuarios desde un panel de administración.
