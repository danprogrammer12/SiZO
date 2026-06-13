# SIZO — Pruebas de Regresión

**Fecha:** 2026-06-13
**Ejecución:** `node scripts/test-regresion.mjs`
**Resultado:** ✅ **11 PASS · 0 FAIL**

Pruebas automatizadas contra el backend Supabase real que verifican los pilares
de las Fases 0-3. El script es repetible y autolimpiante (no deja datos residuales).

---

## Test 1 — Aislamiento multitenant (RLS)

**Qué valida:** que las Row Level Security policies estén activas y aíslen los datos.

| Aserción | Resultado | Detalle |
|---|---|---|
| Cliente anónimo (sin sesión) NO lee `empresas` | ✅ PASS | RLS devuelve 0 filas |
| Service role (backend) SÍ lee | ✅ PASS | 2 empresas visibles |

**Importancia:** confirma que NO quedaron reglas permisivas (el riesgo que existía
en la etapa Firebase con `allow read: if true`). Sin sesión válida, los datos del
tenant son invisibles.

---

## Test 2 — Seguimiento: upsert idempotente + motor de indicadores

**Qué valida:** el patrón de ID compuesto `{empresaId}_{year}_{mes}` y la exactitud
del motor de cálculo.

| Aserción | Resultado | Detalle |
|---|---|---|
| Upsert dos veces con el mismo ID no duplica | ✅ PASS | 1 fila (esperado 1) |
| El segundo upsert actualiza, no inserta | ✅ PASS | `act_ejec` 8 → 9 |
| Indicador Plan = ejecutadas/programadas × 100 | ✅ PASS | 9/10 → 90% |
| Indicador Ausentismo = días/(trab×díasTrab) × 100 | ✅ PASS | 22/880 → 2.5% |
| Indicador IFA = AT/trabajadores × 100 | ✅ PASS | 2/40 → 5 |

**Importancia:** garantiza que registrar el mismo período varias veces no genera
documentos duplicados (idempotencia) y que los KPIs del dashboard reflejan los
valores correctos.

---

## Test 3 — Ciclo CRUD y soft delete (módulos Fase 3)

**Qué valida:** el ciclo de vida completo de un registro operativo (acciones ACPM).

| Aserción | Resultado | Detalle |
|---|---|---|
| Crear acción | ✅ PASS | Registro creado con ID |
| Actualizar estado → cerrada | ✅ PASS | Transición de estado OK |
| Soft delete excluye de listados (`activo=true`) | ✅ PASS | 0 filas activas |
| Registro conservado para auditoría | ✅ PASS | `activo=false`, sin borrado físico |

**Importancia:** confirma que la baja lógica funciona — los registros eliminados
desaparecen de la app pero se conservan en la base para trazabilidad legal SG-SST.

---

## Novedades y observaciones

Hallazgos registrados durante la construcción y verificación de las fases:

1. **Migración Firebase → Supabase dejó 3 módulos rotos.** `topbar.js`,
   `empresas.js` y `usuarios.js` seguían usando el SDK de Firestore. Se portaron
   a Supabase vía `db.js`. *(Resuelto en Fase 2.)*

2. **Provisión inicial falló en el primer intento.** El script `provision-admin`
   se corrió antes de que el usuario existiera en Supabase Auth, dejando el
   `app_metadata` sin `tenant_id`. Al reejecutarlo tras crear el usuario, quedó
   correcto. El script es idempotente. *(Resuelto.)*

3. **Caché de módulos ES en el navegador.** Tras editar módulos, el navegador
   puede servir versiones viejas. Mitigación: recargar con `Ctrl+Shift+R` o
   activar "Disable cache" en DevTools.

4. **`hallazgos` de inspecciones simplificado en v1.** El schema modela
   `hallazgos` como `jsonb[]` de objetos; el formulario v1 captura los hallazgos
   como texto en `obs` y guarda `hallazgos: []`. El detalle estructurado por
   hallazgo queda para una iteración posterior.

5. **Edge Function `crear-tenant` aún no desplegada.** El alta de usuarios/tenants
   se hace por scripts con service role. La automatización vía Edge Function
   (panel de administración) queda pendiente.

6. **Plan Firebase Blaze descartado.** El proyecto opera 100% en el tier gratuito
   de Supabase. No hay dependencia de servicios de pago.

---

## Cómo reejecutar

```
node scripts/test-regresion.mjs
```

Requiere `.env` con `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
y `SIZO_ADMIN_EMAIL`. El script limpia todos los datos de prueba que crea.
