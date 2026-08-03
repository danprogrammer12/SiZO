# SIZO — Contexto del proyecto para Claude

## Qué es

SIZO (`SIZ◉`) es un ERP SaaS de Seguridad y Salud en el Trabajo (SG-SST) para el mercado colombiano. Producto propio de Webcore Solutions. **No es para un cliente externo.**

- **URL producción:** https://danprogrammer12.github.io/SiZO
- **Repositorio:** https://github.com/danprogrammer12/SiZO
- **Supabase project ref:** `zfdiloozznodysbsrqhv` (el proyecto original `ifqzdrqzjgsdhjbqkbba` fue eliminado por inactividad y reconstruido desde cero el 2026-07-27/28 — ver `docs/estado-sizo-2026-07-28.md`)
- **Tenant ADMIN de pruebas:** `danias12.dpa@gmail.com` / tenant_id `e2816d5d-1d6e-499f-b272-bb04cd22ac8b`

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML / CSS / JavaScript vanilla — SPA sin framework, ES modules |
| Auth | Supabase Auth — JWT con `app_metadata`: `tenant_id`, `role`, `empresas_ids` |
| Base de datos | Supabase PostgreSQL + RLS multitenant |
| Storage | Supabase Storage — bucket `documentos` (PDFs firmados) |
| PDF client-side | pdf-lib UMD + signature-pad UMD en `vendor/` |
| Deploy | GitHub Pages — push a `main` despliega automáticamente |

---

## Arquitectura clave

- **SPA hash-based:** `router.js` carga módulos ES dinámicamente por `window.location.hash`. `hashchange` maneja navegación normal; `popstate` maneja el botón Atrás del navegador (especialmente el retorno a dashboard consolidado).
- **Store reactivo:** `store.js` — `get / set / subscribe`, sin dependencias. Los módulos se suscriben a `empresa` y `periodo` para re-renderizar.
- **Multitenancy por RLS:** toda la seguridad real está en Supabase. El gating en el router es solo UX. Los helpers RLS (`tenant_id()`, `is_admin()`, `user_role()`, `can_read_empresa()`, `can_write_empresa()`) están definidos en `001_schema_inicial.sql`. Usar `(select tenant_id())` — no `tenant_id()` directo — para evitar evaluación por fila (InitPlan).
- **Creación de usuarios:** Edge Function `supabase/functions/crear-usuario/index.ts` (necesita service_role para escribir `app_metadata`).
- **Vendor:** archivos UMD en `vendor/` — se publican con el deploy. Cargar con `new URL('../vendor/archivo.js', import.meta.url).href` para compatibilidad con GitHub Pages (base `/SiZO/`).
- **Migraciones:** se aplican manualmente en Supabase Dashboard → SQL Editor. No hay psql local ni credenciales de DB directas.

---

## Roles

Jerarquía (2026-08-03): `ROOT → ADMIN → ASESOR → CONSULTA`.

| Rol | Pertenece a tenant | Permisos |
|-----|---------------------|----------|
| `ROOT` | **No** — es de plataforma (Webcore Solutions) | Administra toda la plataforma SIZO: crea tenants y sus ADMIN, lectura global de todas las tablas (soporte/auditoría), gestiona planes/billing, suspende/reactiva/elimina cualquier usuario, ve auditoría global (`plataforma_auditoria`). **Nunca opera datos SG-SST de un cliente** (sin insert/update en tablas operativas). No tiene fila en `usuarios` (esa tabla exige `tenant_id not null`) — vive solo en Supabase Auth, `app_metadata = { "role": "ROOT" }` sin `tenant_id`. |
| `ADMIN` | Sí | Acceso total a todas las empresas de su propio tenant. Puede crear/editar ASESOR, CONSULTA y **también ADMIN** dentro de su tenant (decisión 2026-08-03: se relajó la restricción original de "solo ROOT asigna ADMIN" para no depender de soporte de Webcore ante continuidad operativa). No puede crear tenants ni asignar rol ROOT. |
| `ASESOR` | Sí | Solo sus empresas asignadas (`empresas_ids` en JWT) — puede escribir |
| `CONSULTA` | Sí | Solo lectura de sus empresas asignadas — no puede crear/editar/eliminar |

**Helpers RLS relevantes:** `is_root()` (nuevo en `014_rol_root.sql`) — cada tabla tiene una policy SELECT adicional `"<tabla>: root lee todo" using ((select is_root()))`, sumada (OR) a las políticas existentes sin tocarlas. `is_superadmin()` se redefine para aceptar tanto el flag legado `app_metadata.superadmin` como `is_root()` — transición, no romper cuentas viejas.

**Edge Functions de gestión de usuarios/tenants** (`supabase/functions/`):
- `crear-usuario` — ADMIN crea ASESOR/CONSULTA/ADMIN en su propio tenant; ROOT crea en cualquier tenant (requiere `tenantId` en el body) o crea otra cuenta ROOT.
- `actualizar-usuario` — mismo patrón; ROOT puede editar cualquier usuario de cualquier tenant. Ninguno de los dos permite promover un usuario existente a ROOT (ROOT se crea como cuenta nueva vía `crear-usuario`, nunca por promoción — evita el conflicto de que `usuarios.tenant_id` es `not null`).
- `gestionar-usuario-root` — nueva, exclusiva ROOT: suspender/reactivar/eliminar cualquier usuario (`ban_duration` en Auth + `activo`/`deleted_at` en `usuarios`).
- `crear-tenant` — reescrita 2026-08-03: antes solo se invocaba con `service_role` desde script y asumía que el ADMIN ya existía en Auth; ahora la invoca ROOT desde el front, crea el usuario ADMIN desde cero (igual que `registrar-tenant`) y hace rollback si falla cualquier paso.
- Todas registran en `plataforma_auditoria` cuando el actor es ROOT.

**Frontend:** `router.js` redirige a ROOT de `dashboard` a `superadmin` (ROOT no tiene `tenant_id`/`empresa`, las rutas operativas no le sirven). `components/sidebar.js` oculta todos los ítems de tenant para ROOT y solo muestra la sección "Plataforma" (`modules/superadmin.js`, ahora con gestión de tenants, usuarios cross-tenant y auditoría, además del billing que ya tenía).

**Pendiente de ejecutar en producción:** la primera cuenta ROOT (separada de tu cuenta ADMIN de Webcore, que sigue intacta) aún no existe — `crear-usuario` exige que quien llama YA sea ROOT, así que la primera cuenta no puede crearse desde el front. Usar `SIZO_ROOT_EMAIL=... node scripts/provision-root.mjs` (mismo patrón que `provision-admin.mjs`, con `service_role`) una sola vez.

---

## Módulos en producción

| Módulo | Archivo | Notas |
|--------|---------|-------|
| Dashboard | `modules/dashboard.js` | Vista consolidada + individual por empresa. Click en fila → `history.pushState` + `set('empresa')`. Contenedor individual: `#dash-body`. |
| Seguimiento | `modules/seguimiento.js` | Indicadores SG-SST por empresa/periodo |
| Empresas | `modules/empresas.js` | CRUD + asignación asesores. Carga `usuarios` en paralelo para resolver nombres. |
| Usuarios | `modules/usuarios.js` | CRUD + creación vía Edge Function. Tests E2E: 14 PASS. |
| Matriz de Riesgos | `modules/matriz-riesgos.js` | IPVR/GTC 45. Motor de cálculo puro en `modules/calcular-riesgo-gtc45.js` (ND×NE=probabilidad, probabilidad×NC=nivel de riesgo → zona I-IV + aceptabilidad). Los niveles se calculan en `antesDeGuardar` y se persisten ya resueltos, no en vivo dentro del modal. |
| Matriz de EPP | `modules/matriz-epp.js` | Cruza cargo con EPP requerido; `peligro_id` referencia opcionalmente `matriz_riesgos.id`. |
| Entrega de EPP | `modules/entrega-epp.js` | Evidencia de entrega individual firmada (Dec. 1072 Art. 2.2.4.6.24). |
| **Gestor Documental** | `modules/gestor-documental.js` | Núcleo del producto (2026-07-15). Fusiona los antiguos `archivos.js` + `documentos-sst.js` sobre la tabla `documentos`: repositorio central con categoría, empresa, vigencia (Vigente/Por vencer 30d/Vencido), historial de versiones (`raizId`/`versionAnteriorId`/`esActual`), firma pdf-lib, previsualización, descarga, soft-delete. Tablas viejas `archivos`/`documentos_sst` no se eliminaron (respaldo histórico), ver `supabase/migrations/008_gestor_documental.sql`. |
| Actas de Comités | `modules/actas.js` | COPASST y Comité de Convivencia Laboral en una sola tabla (`actas.tipo`). |
| Accidentes | `modules/accidentes.js` | |
| Ausentismo | `modules/ausentismo.js` | |
| Acciones | `modules/acciones.js` | |
| Inspecciones | `modules/inspecciones.js` | |
| Capacitación | `modules/capacitacion.js` | |
| Plan | `modules/plan.js` | |
| Auditoría | `modules/auditoria.js` | Implementado 2026-07-11 (era un stub "en construcción" pese a que la tabla `auditorias` ya existía). `evaluaciones` (jsonb por estándar Res. 0312) queda vacío en v1. |
| Casos médicos | `modules/casos.js` | Solo ADMIN — política RLS `for all`. Implementado 2026-07-11 (era un stub "en construcción" pese a que la tabla `casos_medicos` ya existía). |
| Indicadores | `modules/indicadores.js` | Motor extraído en `modules/calcular-indicadores.js` (puro, sin DOM). Base HHT = trab × diasTrab × 8; escala 240.000 (Dec. 1072 Art. 2.2.4.1.7) para IFA/IFM/ISA. `incidenciaEl` usa escala 100.000 (Res. 0312/2019) — no confundir las dos escalas. |
| Maestro | `modules/maestro.js` | 21 KPIs en catálogo |
| Perfil | `modules/perfil.js` | |
| **Panel de Plataforma** | `modules/superadmin.js` | Exclusivo ROOT (`sidebar.js` lo oculta a cualquier otro rol). Ampliado 2026-08-03: además de billing (planes/estado de tenants, ya existía), ahora crea tenants+ADMIN inicial (`crear-tenant`), lista y suspende/reactiva/elimina usuarios de cualquier tenant (`gestionar-usuario-root`, tabla `usuarios` vía policy `root lee todo`), y muestra auditoría global (`plataforma_auditoria`). Es el destino por defecto de ROOT en `router.js` (no `dashboard`, porque ROOT no tiene tenant). |

**Descarga de plantillas SGSST:** `components/exportar-plantilla.js` centraliza la exportación a Excel (SheetJS) y PDF (jsPDF+autoTable) de cualquier módulo tabular. `botonesDescarga({ tabla, titulo, columnas, nombreBase, urlOficial })` genera los botones "Excel"/"PDF" (releen la tabla en cada click, no dependen del estado interno del CRUD) y, si se pasa `urlOficial`, un botón "Formato oficial" que enlaza a la fuente pública (ARL/universidad) del formato en blanco — no se redistribuye la GTC 45 de ICONTEC (es de pago) sino recreaciones libres equivalentes. Cableado en: matriz-riesgos, matriz-epp, entrega-epp, actas, casos, auditoria (el Gestor Documental no usa este componente — es la vista completa del repositorio, no un listado exportable). **Cuidado:** el título pasado a `exportarExcel` se usa como nombre de hoja — Excel prohíbe `: \ / ? * [ ]`, ya saneado en la función pero no uses esos caracteres en `titulo` de otros módulos sin pasar por `botonesDescarga`.

---

## APIs internas importantes

```js
// Toast — NOT toast.show()
import { success, error, warning, info } from './toast.js'
toast.success('msg') / toast.error('msg')

// DB
import { list, insert, update, softDelete } from './db.js'
// list() aplica .limit(500) por defecto

// Store
import { get, set, subscribe } from './store.js'

// Escape (SIEMPRE usar en interpolación de datos en HTML)
import { esc } from './escape.js'
```

---

## Convenciones

- Sin punto y coma, comillas simples, 2 espacios de indentación
- camelCase en variables/funciones, kebab-case en nombres de archivo
- Commits en español, imperativo (`Agrega`, `Corrige`, `Limpia`)
- Comentarios solo cuando el WHY no es obvio — nunca comentarios descriptivos
- Variables sensibles en `.env` — nunca en el repo

---

## Tests

```bash
npm test                # 3 suites (unit + mecánica + seguridad)
npm run test:unit       # Round-trip JSONB — puro, sin red
npm run test:mecanica   # CRUD vía service_role — NO valida RLS
npm run test:seguridad  # RLS autenticada por rol — crea/limpia usuarios *.sizo.test
```

Resultado actual: **24 PASS · 0 FAIL** (unit + mecánica) · **7 PASS · 0 FAIL** (seguridad)

---

## Migraciones aplicadas

| Archivo | Contenido | Estado |
|---------|-----------|--------|
| `001_schema_inicial.sql` | Schema base + helpers RLS | ✅ |
| `002_h3_proteger_usuarios.sql` | Trigger `usuarios_proteger_columnas` | ✅ |
| `003_h10_optimizar_rls.sql` | InitPlan en 35 políticas RLS / 14 tablas | ✅ aplicada 2026-06-20 |
| `004_archivos.sql` | Tabla `archivos` + bucket `documentos` | ✅ |
| `005_billing.sql` | Billing multitenant: estado/límite en `tenants`, `is_superadmin()` | ✅ |
| `006_matriz_riesgos.sql` | Tabla `matriz_riesgos` (IPVR/GTC 45) | ✅ aplicada 2026-07-11 |
| `007_epp_documentos_actas.sql` | Tablas `matriz_epp`, `entrega_epp`, `documentos_sst`, `actas` | ✅ aplicada 2026-07-11 |
| `008_gestor_documental.sql` | Tabla `documentos` (fusión de `archivos` + `documentos_sst`, con versionado). Copia datos existentes, no elimina las tablas viejas. | ✅ aplicada 2026-07-15 |
| `009_fix_documentos_rls.sql` | Intento 1 de fix del soft-delete de `documentos` (WITH CHECK explícito). No resolvió — la causa real era otra (ver 011). | ✅ aplicada 2026-07-16, superada por 011 |
| `010_simplificar_rls_documentos.sql` | Intento 2 (quita subquery innecesaria en `can_write_empresa`). Tampoco resolvió. | ⏳ no aplicada — saltar directo a 011 |
| `011_fix_cache_rls_documentos.sql` | Intento 3 (envuelve `is_admin()`/`tenant_id()`/`user_role()` en `(select ...)`, mismo motivo que H10). Tampoco resolvió — probado con `check=true` confirmado en transacción atómica justo antes del UPDATE fallido. | ✅ aplicada 2026-07-16, no resolvió |
| `012_rpc_soft_delete_documento.sql` | Workaround real: función `soft_delete_documento(uuid)` `SECURITY DEFINER` — valida permisos en PL/pgSQL y actualiza como dueño de tabla, evitando el UPDATE directo vía RLS que queda sin explicación (ver notas 2026-07-16 abajo). `gestor-documental.js` usa `supabase.rpc('soft_delete_documento', ...)` en vez de `db.softDelete`. | ✅ aplicada — verificada 2026-08-03 vía llamada RPC directa (devolvió el error esperado "Documento no encontrado", confirmando que la función existe en la base) |
| `013_rpc_soft_delete_general.sql` | Replica el patrón de 012 para `matriz_riesgos` y `actas` (`soft_delete_matriz_riesgos`, `soft_delete_acta`), mismo bloqueo RLS sin explicación raíz en esas tablas. | ✅ aplicada — verificada 2026-08-03 vía llamada RPC directa a ambas funciones |
| `014_rol_root.sql` | Incorpora el rol `ROOT` (plataforma, sin tenant): helper `is_root()`, `is_superadmin()` acepta también `is_root()` (transición), `usuarios.rol` admite `'ROOT'` (aunque hoy no se inserta ninguna fila con ese rol), policy `tenants: root crea`, una policy SELECT `"<tabla>: root lee todo"` por cada una de las ~18 tablas del esquema, y tabla nueva `plataforma_auditoria` (solo legible por ROOT, solo se escribe desde Edge Functions con `service_role`). | ⏳ pendiente de aplicar |

---

## Auditoría de seguridad (2026-06-15) — H1-H15

Todos resueltos. Informe: `testing/QA/INFORME-AUDITORIA-2026-06-15.md`

| ID | Resumen | Resolución |
|----|---------|-----------|
| H1 | XSS | `escape.js` + `esc()` en toda interpolación |
| H2 | Tests sin RLS | Suite autenticada `test-seguridad-rls.mjs` |
| H3 | Self-update rol/tenant | Trigger `usuarios_proteger_columnas` |
| H4 | Conversión de claves | `case-convert.js` shallow, preserva JSONB |
| H5 | `err.message` expuesto | `errores.js` — mensaje genérico al usuario |
| H6 | supabase-js desde CDN | Vendorizado en `vendor/supabase-js@2.108.1.js` |
| H7 | Sin CSP | `<meta>` CSP en `index.html`. Headers HTTP pendientes en Cloudflare. |
| H8 | Queries sin límite | `db.js list()` con `.limit(500)` |
| H9 | JWT sin refresh al volver al foco | `visibilitychange` → `refreshSession()` en `auth.js` |
| H10 | RLS sin InitPlan | `(select fn())` en todas las políticas |
| H11 | Motor indicadores mezclado con DOM | `calcular-indicadores.js` extraído |
| H12 | HHT incorrecto en IFA/IFM/ISA | Base 240.000 según Dec. 1072 |
| H13 | Sin recuperación de contraseña | `#forgot-form` / `#reset-form` + evento `PASSWORD_RECOVERY` |
| H14 | Store desactualizado | `_empresas` declarado; comentarios corregidos |
| H15 | Nombres asesores no resueltos | `empresas.js` carga usuarios en paralelo |

---

## Pendientes

| Item | Detalle |
|------|---------|
| Headers Cloudflare (H7) | `X-Frame-Options`, `X-Content-Type-Options`, `HSTS` — requiere dominio personalizado |
| Dominio personalizado | Sin definir aún |

---

## Notas adicionales (2026-06-22)

- **CSP tiene dos fuentes de verdad — mantenerlas sincronizadas.** El `<meta>` CSP en `index.html` (usado en producción/GitHub Pages) y el header HTTP `Content-Security-Policy` en `serve.json` (usado solo por `npm run serve` en local) son **independientes**. Si se cambia uno sin el otro, el comportamiento en local no coincidirá con producción (o viceversa) y el navegador aplica la política más restrictiva de ambas. Al tocar CSP, editar ambos archivos.
- **Bug corregido:** `object-src 'none'` en ambos (meta + `serve.json`) bloqueaba por completo el `<object type="application/pdf">` usado para previsualizar PDFs en `modules/archivos.js`. Se cambió a `object-src 'self' https://ifqzdrqzjgsdhjbqkbba.supabase.co` en los dos lugares.
- **Previsualización de PDF independiente de firmar:** se agregó `data-accion="previsualizar"` (botón de ojo + click en el nombre del archivo) en `modules/archivos.js`, que abre un modal de solo lectura (`abrirPrevisualizar`) sin pasar por el flujo de firma. El modal de "Firmar / Notas" (`abrirFirmar`) sigue teniendo su propia vista previa para ese contexto.
- Tras reiniciar `npm run serve`, el server no relee `serve.json` en caliente — hay que matar y volver a levantar el proceso para que los headers HTTP nuevos tomen efecto.

## Notas adicionales (2026-07-16)

- **Bug sin explicación raíz — UPDATE bloqueado por RLS en `documentos` pese a política correcta.** El soft-delete (`activo=false`) en la tabla `documentos` era rechazado con `42501 new row violates row-level security policy` para un usuario ADMIN, pese a probarse exhaustivamente que la política era correcta: se descartaron tabla duplicada, trigger custom, `pg_rules`, FK autorreferenciada (`raiz_id`/`version_anterior_id`), triggers internos de FK (`session_replication_role=replica`), interacción con `RETURNING`, y caché de plan genérico (wrapping `(select fn())` por H10). Prueba definitiva: dentro de la MISMA transacción/rol, un `SELECT` con la expresión exacta del `WITH CHECK` justo antes del `UPDATE` fallido devolvía `true`, y aun así el `UPDATE` era rechazado. Workaround aplicado (migración `012_rpc_soft_delete_documento.sql`): función `SECURITY DEFINER` que valida permisos en PL/pgSQL y hace el `UPDATE` como dueño de tabla, evitando el `UPDATE` directo vía RLS. **Si este mismo síntoma aparece en otra tabla** (soft-delete de `matriz_riesgos`, `actas`, etc. vía `_crud.js`/`db.softDelete`), replicar el mismo patrón RPC en vez de seguir depurando la policy — ya se agotó el espacio razonable de diagnóstico por SQL directo.
