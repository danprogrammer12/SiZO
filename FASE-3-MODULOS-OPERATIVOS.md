# SIZO — Fase 3: Módulos Operativos

**Fecha:** 2026-06-13
**Estado:** ✅ Completada
**Pruebas:** 11/11 PASS (`PRUEBAS-REGRESION.md`)

Implementa los 6 módulos operativos del SG-SST con CRUD completo (alta, edición,
baja lógica), scoping por empresa y control de rol.

---

## Arquitectura: factory CRUD declarativo

En lugar de repetir ~250 líneas por módulo, se creó `modules/_crud.js`, un factory
que genera un módulo completo a partir de una configuración. Cada módulo operativo
quedó en 30-50 líneas.

`crearModulo(config)` provee:
- Tabla con columnas configurables (con formateadores).
- Botón "Nuevo" + modal de formulario generado desde `campos`.
- Tipos de campo: `text`, `number`, `date`, `select`, `textarea`, `checkbox`.
- Alta/edición vía `db.js` (auditoría automática) y baja lógica (`activo:false`).
- Scoping automático por empresa activa y modo solo-lectura para rol `CONSULTA`.
- Hook `antesDeGuardar(payload, item)` para lógica específica.

---

## Módulos implementados

| Módulo | Tabla | Lógica especial |
|---|---|---|
| **Accidentalidad** | `accidentes` | Clasificación leve/grave/mortal, seguimiento de investigación |
| **Ausentismo** | `ausencias` | Cálculo automático de días entre fechas |
| **Acciones ACPM** | `acciones` | Fecha de cierre automática al pasar a estado "cerrada" |
| **Inspecciones** | `inspecciones` | Calificación 0-100, tipo planeada/no planeada |
| **Capacitación** | `capacitaciones` | Modalidad y evaluación de eficacia (nota 0-5) |
| **Plan de Trabajo** | `plan_actividades` | Actividades anuales por componente PHVA |

Todos respetan las RLS de Supabase y filtran por `activo=true` y `empresa_id`.

---

## Cómo probar

1. `npm run serve` → http://localhost:5000
2. Selecciona una empresa **[DEMO]** en la barra superior.
3. Entra a cada módulo operativo del menú lateral y prueba crear/editar/eliminar.
4. Rol `CONSULTA` ve los módulos en solo lectura (sin botones de acción).

---

## Pendiente para fases siguientes

- **Fase 4:** auditoría, casos médicos, evaluación de estructura (E01-E11).
- **Fase 5:** reportes PDF (jsPDF) y Excel (SheetJS).
- Captura estructurada de `hallazgos` en inspecciones (hoy texto en `obs`).
- Vincular acciones a su documento origen (`origen_id`).
