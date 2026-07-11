# SIZO — Contexto del proyecto para Claude

## Qué es

SIZO (`SIZ◉`) es un ERP SaaS de Seguridad y Salud en el Trabajo (SG-SST) para el mercado colombiano. Producto propio de Webcore Solutions. **No es para un cliente externo.**

- **URL producción:** https://danprogrammer12.github.io/SiZO
- **Repositorio:** https://github.com/danprogrammer12/SiZO
- **Supabase project ref:** `ifqzdrqzjgsdhjbqkbba`
- **Tenant ADMIN de pruebas:** `danias12.dpa@gmail.com` / tenant_id `33cca128-a52e-49c8-a1b7-1fa123a6fd5a`

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

| Rol | Permisos |
|-----|----------|
| `ADMIN` | Acceso total a todas las empresas del tenant |
| `ASESOR` | Solo sus empresas asignadas (`empresas_ids` en JWT) — puede escribir |
| `CONSULTA` | Solo lectura de sus empresas asignadas — no puede crear/editar/eliminar |

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
| Documentación SST | `modules/documentos-sst.js` | Política, objetivos, matriz de requisitos legales, manual del SG-SST. Badge de vigencia calculado en el listado (no persistido). |
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
| Archivos | `modules/archivos.js` | PDFs: subir, previsualizar (modal 2 columnas con `<object>`), firmar (pdf-lib: firma dibujada o imagen + notas incrustadas), descargar, soft-delete. Tutorial 6 pasos. |

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
