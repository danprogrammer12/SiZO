# SIZO — Runbook de migración a Supabase

**Fecha:** 2026-06-13
**Reemplaza:** Firebase (Auth + Firestore + Functions) → Supabase (Auth + PostgreSQL + Edge Functions)
**Motivo:** Supabase cubre Auth con roles, DB, Storage y funciones de servidor en el tier gratuito.

---

## PASO 1 — Crear el proyecto Supabase *(tú — 2 minutos)*

1. Ve a https://supabase.com → **Start your project**
2. **New project** → nombre: `sizo` → genera contraseña fuerte → región: **South America (São Paulo)**
3. Espera que el proyecto aprovisione (~1 min)
4. Ve a **Project Settings → API** y copia:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` → `SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (⚠ nunca al repo)

---

## PASO 2 — Crear el archivo .env *(tú)*

```
Copy-Item .env.example .env
```

Edita `.env` con los valores del paso 1.

---

## PASO 3 — Ejecutar el schema SQL *(tú — SQL Editor)*

1. Supabase Dashboard → **SQL Editor** → **New query**
2. Copia el contenido de `supabase/migrations/001_schema_inicial.sql`
3. **Run** → debe terminar sin errores

---

## PASO 4 — Configurar el cliente web *(Claude lo hace una vez tengas la URL)*

En `supabase.js` reemplazar los placeholders:
```
__SUPABASE_URL__      → tu Project URL
__SUPABASE_ANON_KEY__ → tu anon public key
```

O pásame los valores y lo hago yo.

---

## PASO 5 — Crear el usuario ADMIN en Supabase Auth *(tú)*

1. Supabase Dashboard → **Authentication → Users → Invite user**
2. Ingresa tu email → **Send invite**
3. Revisa tu correo y acepta la invitación (esto crea tu cuenta en Auth)

---

## PASO 6 — Provisionar tenant y app_metadata *(Claude o tú)*

```
npm install
npm run provision:admin
```

Esto:
- Crea la fila en `tenants`
- Setea `app_metadata = { tenant_id, role: "ADMIN", empresas_ids: [] }` en tu usuario
- Crea la fila en `usuarios`

---

## PASO 7 — Validar el login *(tú)*

```
npm run serve
```

Abre http://localhost:5000 → inicia sesión con tu email.
En la consola NO debe aparecer ningún error de `app_metadata`.

---

## Qué quedó obsoleto (Firebase)

Los siguientes archivos ya no se usan pero se conservan como referencia
hasta que la migración esté validada:

| Archivo | Estado |
|---|---|
| `firebase.js` | ❌ Reemplazado por `supabase.js` |
| `auth.js` (versión Firebase) | ❌ Reescrito para Supabase |
| `functions/` | ⏸ Reemplazado por `supabase/functions/` |
| `firestore.rules` | ⏸ Reemplazado por RLS en el schema SQL |
| `firestore.indexes.json` | ⏸ Reemplazado por índices en el schema SQL |
| `firebase.json` / `.firebaserc` | ⏸ Se mantiene para el Hosting (opcional) |

---

## Arquitectura de roles en Supabase

Los roles y el `tenant_id` viajan en el **JWT** dentro de `app_metadata`.
Las RLS policies leen `app_metadata` directamente del token — sin consultas extra a la DB.

```
Supabase Auth JWT
  ├── sub           → uid del usuario
  └── app_metadata
        ├── tenant_id    → "uuid-del-tenant"
        ├── role         → "ADMIN" | "ASESOR" | "CONSULTA"
        └── empresas_ids → ["uuid1", "uuid2", ...]
```

Solo el `service_role_key` (servidor) puede escribir `app_metadata`.
Desde el cliente nunca se puede modificar.
