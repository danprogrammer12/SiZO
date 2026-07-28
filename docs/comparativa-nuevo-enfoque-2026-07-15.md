# Comparativa estratégica: SIZO actual vs. nuevo enfoque (3 pilares)

Fecha: 2026-07-15

## Nuevo enfoque de SIZO

1. **Gestor Documental** (núcleo del producto) — repositorio central donde consultoras y empresas suben, organizan y acceden a todos sus documentos SST de forma segura, trazable y ordenada.
2. **Módulos Operativos** (registro + trazabilidad) — registro de novedades operativas (accidentes, ausentismo, capacitaciones, inspecciones, etc.) reflejado automáticamente en dashboards y tablas de datos.
3. **Módulo Normativo** (diferenciador clave, nuevo) — biblioteca legal del SG-SST colombiano con actualización automática diaria.

---

## 1. Inventario actual

| Módulo | Archivo | Estado |
|---|---|---|
| Dashboard | `dashboard.js` | Funcional |
| Seguimiento (indicadores SG-SST) | `seguimiento.js` | Funcional |
| Empresas | `empresas.js` | Funcional |
| Usuarios | `usuarios.js` | Funcional (14 tests E2E) |
| Matriz de Riesgos (GTC 45) | `matriz-riesgos.js` | Funcional |
| Matriz de EPP | `matriz-epp.js` | Funcional |
| Entrega de EPP | `entrega-epp.js` | Funcional |
| Documentación SST | `documentos-sst.js` | Funcional (parcial como gestor documental: solo política/objetivos/matriz legal/manual) |
| Actas de Comités | `actas.js` | Funcional |
| Accidentes | `accidentes.js` | Funcional |
| Ausentismo | `ausentismo.js` | Funcional |
| Acciones | `acciones.js` | Funcional |
| Inspecciones | `inspecciones.js` | Funcional |
| Capacitación | `capacitacion.js` | Funcional |
| Plan | `plan.js` | Funcional (sin notas de estado — asumir funcional básico, revisar) |
| Auditoría | `auditoria.js` | Funcional (implementado 2026-07-11; `evaluaciones` jsonb vacío en v1) |
| Casos médicos | `casos.js` | Funcional (solo ADMIN) |
| Indicadores | `indicadores.js` | Funcional |
| Maestro (catálogo KPIs) | `maestro.js` | Funcional (21 KPIs) |
| Perfil | `perfil.js` | Funcional |
| Archivos (repositorio PDFs) | `archivos.js` | Funcional — subir/previsualizar/firmar/descargar/soft-delete |
| **Módulo Normativo** | — | **No existe** |

No hay módulos "vacíos" hoy — los dos últimos stubs (Auditoría, Casos médicos) ya se completaron el 2026-07-11. Todo lo listado está funcional en algún grado.

---

## 2. Comparativa por pilar

### Pilar 1 — Gestor Documental (núcleo nuevo)

| Módulo actual | Encaja | Ajuste necesario | Prioridad |
|---|---|---|---|
| **Archivos** | Sí — es la base técnica más cercana (subida, firma, storage, trazabilidad) | Rediseño de alcance: hoy es "repositorio de PDFs firmados" genérico, no un gestor documental estructurado por categoría/vigencia/empresa como pide el nuevo enfoque. Falta taxonomía, versionado, búsqueda, control de vigencia como *feature central* (hoy el badge de vigencia vive solo en `documentos-sst.js`) | **Sube a máxima prioridad** — pasa de módulo secundario a núcleo del producto |
| **Documentación SST** | Sí, parcialmente — ya maneja vigencia y documentos legales tipados | Debería fusionarse conceptualmente con Archivos: hoy son dos sistemas de documentos separados (uno con metadatos/vigencia, otro con storage/firma). El nuevo gestor documental necesita ser un único módulo que combine ambos | Sube de prioridad, pendiente de fusión |
| Matriz de EPP, Entrega de EPP, Actas, Casos, Auditoría (exportables a plantilla) | Indirectamente — generan documentos que deberían vivir en el gestor documental | Ninguno funcional; sí hay que decidir si sus exportaciones (Excel/PDF) se archivan automáticamente en el gestor documental o siguen siendo descargas sueltas | Sin cambio de prioridad individual, pero quedan "alimentando" al pilar 1 |

### Pilar 2 — Módulos Operativos (registro + trazabilidad)

| Módulo actual | Encaja | Ajuste necesario | Prioridad |
|---|---|---|---|
| Accidentes, Ausentismo, Inspecciones, Capacitación, Acciones, Casos médicos | Sí, directamente — es literalmente la descripción del pilar | Verificar que todos alimenten Dashboard/Indicadores en tiempo real; no está confirmado que Casos/Auditoría (nuevos) estén conectados al recálculo automático de indicadores | Se mantiene, sin cambio de prioridad — ya está bien ubicado |
| Matriz de Riesgos, Matriz de EPP, Entrega de EPP | Parcialmente — son más "gestión documental normativa" que registro operativo puro | Podrían quedar repartidos entre Pilar 1 (documento resultante) y Pilar 2 (proceso de registro) | Revisar clasificación, no urgente |
| Auditoría | Sí, pero v1 incompleta (`evaluaciones` vacío) | Completar evaluaciones por estándar Res. 0312 para que la trazabilidad sea real, no solo un registro | Sube de prioridad si Auditoría es un entregable clave frente a clientes |
| Plan | Sí | Sin info suficiente para evaluar estado real — revisar antes de decidir | Pendiente de auditoría de código |
| Dashboard / Seguimiento / Indicadores | Es la capa de consumo de este pilar, no el registro en sí | Ninguno funcional aparente | Se mantiene — es la pieza que "hace real" la trazabilidad, correcto tal como está |

### Módulos de soporte (no son un pilar en sí)

| Módulo | Rol frente al nuevo enfoque |
|---|---|
| Empresas, Usuarios, Perfil, Maestro | Infraestructura multitenant/administrativa — necesarios para que los 3 pilares funcionen, no cambian de prioridad ni requieren rediseño por este pivote |

---

## 3. Lo que falta

1. **Módulo Normativo completo** — no existe absolutamente nada hoy:
   - Biblioteca legal estructurada (leyes, decretos, resoluciones SG-SST colombiano)
   - Contenido explicativo en lenguaje claro por norma
   - Mecanismo de "actualización automática diaria" — implica una fuente de datos externa (scraping/API de diario oficial o similar) + pipeline de ingesta + notificación a usuarios cuando hay cambios normativos. Es la pieza técnicamente más nueva y de mayor riesgo de todo el pivote.
   - Vinculación entre norma y módulos existentes (ej. qué documentos/matrices exige cada norma) — hoy `documentos-sst.js` ya tiene una "matriz de requisitos legales" que podría ser el punto de partida, pero está pensada como checklist, no como biblioteca consultable.

2. **Gestor documental unificado** — hoy la lógica documental está fragmentada en al menos tres lugares (`archivos.js`, `documentos-sst.js`, y las exportaciones de `exportar-plantilla.js`). El nuevo enfoque pide un repositorio central único.

3. **Alertas de vigencia/cambio normativo proactivas** — hoy el badge de vigencia en `documentos-sst.js` es pasivo (se calcula al listar). El nuevo enfoque implica notificaciones activas (documento por vencer, norma actualizada).

4. **Trazabilidad cruzada explícita** — vincular un registro operativo (ej. un accidente) con el documento normativo/legal que lo regula y con el documento generado (informe) no existe como relación de datos hoy.

---

## 4. Recomendación

**Conservar tal como está:**
Empresas, Usuarios, Perfil, Maestro, Dashboard, Seguimiento, Indicadores, y los módulos operativos puros (Accidentes, Ausentismo, Inspecciones, Capacitación, Acciones) — encajan directamente en Pilar 2 sin fricción.

**Modificar / rediseñar:**
- Fusionar `archivos.js` + `documentos-sst.js` en un único gestor documental (Pilar 1), con taxonomía por tipo de documento, empresa, vigencia y trazabilidad de versiones. Es la pieza de mayor esfuerzo de refactor pero de mayor apalancamiento, porque ya existe la base técnica (Supabase Storage + pdf-lib).
- Completar Auditoría v1 (evaluaciones por estándar) y revisar el estado real de `plan.js` antes de decidir su prioridad.
- Revisar si Matriz de Riesgos/EPP/Entrega EPP quedan clasificadas como Pilar 1 o Pilar 2 — hoy están a caballo entre ambos.

**Eliminar / fusionar:**
No hay candidatos claros a eliminación — no hay módulos vacíos ni redundantes hoy (los dos únicos stubs pendientes ya se cerraron el 11 de julio). El único "fusionar" es Archivos + Documentación SST.

**Construir desde cero:**
El Módulo Normativo completo — biblioteca legal, contenido explicativo, y sobre todo el pipeline de actualización automática diaria. Recomiendo tratarlo como un proyecto aparte dentro de SIZO (probablemente el de mayor riesgo técnico: requiere fuente de datos normativos confiable, no solo desarrollo interno) y no subestimar el "diaria" — antes de comprometerse a esa cadencia conviene validar qué fuente oficial permite consulta automatizada.
