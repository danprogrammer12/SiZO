# SIZO — Runbook Fase 0 y 1 (Infraestructura + Auth/Tenancy)

**Proyecto Firebase:** `sizo-80446`
**Plan objetivo:** Blaze (pago por uso — habilita Cloud Functions y Storage)
**Última actualización:** 2026-06-13

Este documento contiene los pasos que **requieren tu intervención** (login con tu
cuenta Google, facturación y deploy). Todo lo demás —configuración, scripts,
reglas, índices, functions— ya está listo en el repositorio.

> Comandos para PowerShell en Windows. Ejecútalos desde la carpeta del proyecto:
> `C:\Users\q\Documents\UAC\proyectos_dp\productos\SIZO`

---

## Estado actual (lo que ya está hecho)

| Ítem | Estado |
|---|---|
| Proyecto `sizo-80446` creado | ✅ |
| Auth Email/Password habilitado | ✅ |
| Firestore creado (región nam5) | ✅ |
| Usuario ADMIN en Auth (`WCFrAsUvMXaXpskqxy9H9WXgzA83`) | ✅ |
| Firebase CLI instalado | ✅ |
| `.firebaserc` apuntando a `sizo-80446` | ✅ (corregido) |
| `firestore.rules` V1.2 | ✅ (escrito — falta desplegar) |
| `firestore.indexes.json` (15 índices) | ✅ (escrito — falta desplegar) |
| `functions/index.js` (6 Cloud Functions) | ✅ (escrito — falta desplegar) |
| Scripts de provisión | ✅ (`scripts/provision-admin.mjs`) |
| **Reglas reales desplegadas** | ❌ (corren reglas temporales permisivas) |
| **Plan Blaze activo** | ❌ (requerido para Functions + Claims) |
| **Custom Claims reales en el ADMIN** | ❌ (login usa fallback de desarrollo) |

---

## PASO 1 — Login en Firebase CLI  *(tú)*

En el chat de Claude Code escribe (con el prefijo `!`), o en una terminal nueva:

```
! firebase login
```

Se abrirá el navegador. Autentícate con **danias12.dpa@gmail.com**.

Verifica que quedó conectado al proyecto correcto:

```
! firebase use sizo-80446
! firebase projects:list
```

---

## PASO 2 — Activar plan Blaze  *(tú — consola web)*

1. Abre: https://console.firebase.google.com/project/sizo-80446/usage/details
2. Botón **"Modificar plan"** → selecciona **Blaze (pago por uso)**.
3. Asocia una cuenta de facturación (tarjeta). La cuota gratis mensual de Blaze
   cubre de sobra el uso en esta etapa — el gasto real será ~$0 al inicio.

> Sin Blaze, los pasos 4 (functions) y la provisión de Custom Claims (paso 6)
> no funcionan. Auth seguiría solo en modo desarrollo (fallback Firestore).

---

## PASO 3 — Desplegar reglas e índices  *(Claude puede hacerlo una vez haya login,
## o tú)*

```
! firebase deploy --only firestore:rules,firestore:indexes,storage
```

Esto reemplaza las reglas temporales permisivas por las reales (V1.2) y crea los
15 índices compuestos. La construcción de índices puede tardar unos minutos.

---

## PASO 4 — Desplegar Cloud Functions  *(requiere Blaze)*

```
! cd functions ; npm install ; cd ..
! firebase deploy --only functions
```

Despliega las 6 funciones: `createTenant`, `createUser`, `deactivateUser`,
`updateUserEmpresas`, `scheduledUpdateAccionesVencidas`, `scheduledContratoAlerts`.

---

## PASO 5 — Descargar la service account  *(tú — consola web)*

Necesaria para el script de provisión (paso 6).

1. Abre: https://console.firebase.google.com/project/sizo-80446/settings/serviceaccounts/adminsdk
2. **"Generar nueva clave privada"** → descarga el JSON.
3. Guárdalo en la carpeta del proyecto como `service-account.json`.
   (Ya está en `.gitignore` — nunca se subirá al repo.)
4. Copia `.env.example` a `.env` (los valores por defecto ya son correctos):

```
! Copy-Item .env.example .env
```

---

## PASO 6 — Provisionar tenant + Custom Claims del ADMIN  *(tú)*

```
! npm install
! npm run provision:admin
```

Esto:
- Crea el documento del tenant en `tenants/{tenantId}`.
- Setea Custom Claims `{ tenantId, role: 'ADMIN', empresasIds: [] }` sobre tu
  usuario existente.
- Crea/actualiza tu documento de usuario.

El `tenantId` es determinístico (derivado de tu UID), así que el script es
idempotente: puedes correrlo de nuevo sin duplicar nada.

---

## PASO 7 — Validar el login real  *(tú)*

1. Sirve la app localmente:

```
! firebase serve --only hosting
```

2. Abre http://localhost:5000, **cierra sesión si estabas dentro** y vuelve a
   iniciar con tu correo. Al recoger el token nuevo, `auth.js` tomará el flujo de
   **producción** (Custom Claims) en lugar del fallback de desarrollo.
3. En la consola del navegador NO debe aparecer el mensaje
   `[auth] Claims vacíos — usando fallback Firestore`.

---

## PASO 8 — (Opcional) Desplegar Hosting

```
! firebase deploy --only hosting
```

Publica la app en `https://sizo-80446.web.app`.

---

## Resumen de qué hace quién

| Paso | Responsable | Bloqueante |
|---|---|---|
| 1. `firebase login` | **Tú** (OAuth interactivo) | Sí |
| 2. Activar Blaze | **Tú** (facturación) | Para functions/claims |
| 3. Deploy reglas+índices | Claude o tú | — |
| 4. Deploy functions | Claude o tú | Requiere Blaze |
| 5. Service account | **Tú** (descarga) | Para provisión |
| 6. Provisión | Claude o tú | Requiere paso 5 |
| 7. Validar login | **Tú** (navegador) | — |
| 8. Deploy hosting | Claude o tú | — |

Una vez completados los pasos 1–7, **la Fase 0 y la Fase 1 quedan cerradas** y se
puede arrancar la Fase 2 (Core SG-SST: seguimiento mensual + dashboard).
