# PRD — SIZO V1
**Product Requirements Document**
**Versión:** 1.0  
**Fecha:** 2026-06-05  
**Estado:** Draft aprobado  
**Propietario:** Webcore Solutions  

---

## Índice

1. [Visión del producto](#1-visión-del-producto)
2. [Problema](#2-problema)
3. [Usuarios y personas](#3-usuarios-y-personas)
4. [Alcance V1](#4-alcance-v1)
5. [Módulos y requerimientos funcionales](#5-módulos-y-requerimientos-funcionales)
6. [Historias de usuario](#6-historias-de-usuario)
7. [Requerimientos no funcionales](#7-requerimientos-no-funcionales)
8. [Arquitectura técnica](#8-arquitectura-técnica)
9. [Modelo de negocio y tenancy](#9-modelo-de-negocio-y-tenancy)
10. [Métricas de éxito](#10-métricas-de-éxito)
11. [Fuera de alcance V1](#11-fuera-de-alcance-v1)
12. [Fases y milestones](#12-fases-y-milestones)
13. [Criterios de aceptación](#13-criterios-de-aceptación)
14. [Glosario](#14-glosario)

---

## 1. Visión del Producto

### 1.1 Declaración de visión

**SIZO** es una plataforma SaaS especializada en la gestión integral del Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST) para Colombia, diseñada para ser utilizada por consultoras SST y empresas que gestionan internamente su cumplimiento normativo.

SIZO transforma la operación del SG-SST — hoy fragmentada entre hojas de cálculo, archivos locales y ERPs genéricos — en una plataforma inteligente, centralizada y con datos accionables, que convierte el cumplimiento normativo en una ventaja operativa.

### 1.2 Propuesta de valor

| Para | El problema | SIZO ofrece |
|---|---|---|
| Consultoras SST | Gestionar múltiples empresas con herramientas dispersas, sin visibilidad consolidada | Un hub centralizado que centraliza toda la operación de la consultora con visibilidad en tiempo real |
| Asesores SST | Registro manual de datos, cálculo de indicadores en Excel, reportes tardíos | Seguimiento mensual estructurado que calcula automáticamente todos los indicadores normalizados |
| Empresas independientes | Cumplir el Dec. 1072/2015 y la Res. 0312/2019 sin saber cómo medirlo | Un sistema guiado que indica qué hacer, cuándo hacerlo y qué tan bien va el SG-SST |
| Gerentes y directivos | No saber el estado real del SG-SST hasta que ocurre un accidente o una sanción | Dashboard ejecutivo con semáforo de cumplimiento y alertas proactivas |

### 1.3 Identidad de marca

- **Nombre:** SIZO
- **Logo:** `SIZ◉` — la O representa Objetivo, Indicador, Monitoreo, Cumplimiento, Punto de control
- **Paleta principal:** `#2563EB` (azul) · `#0F172A` (navy) · `#06B6D4` (teal) · `#F8FAFC` (fondo)
- **Posicionamiento:** El futuro del SG-SST. No un ERP industrial — una plataforma de inteligencia operativa.

---

## 2. Problema

### 2.1 Contexto normativo colombiano

Colombia exige a todas las empresas implementar y mantener un SG-SST conforme al **Decreto 1072 de 2015** y la **Resolución 0312 de 2019**. El incumplimiento genera multas de hasta 500 SMMLV y cierre de establecimientos. Sin embargo:

- Las empresas medianas y pequeñas no tienen personal especializado interno
- Las consultoras SST gestionan en promedio 15–40 empresas cliente con herramientas artesanales
- El seguimiento de indicadores se hace en Excel, sin fórmulas estandarizadas
- Los reportes se generan manualmente, con semanas de retraso
- No existe visibilidad en tiempo real del estado de cumplimiento

### 2.2 Dolor específico del mercado objetivo

**Consultoras SST:**
- Cada empresa cliente requiere un archivo Excel independiente
- No hay vista consolidada de toda la cartera
- Duplicación de trabajo en cada período de seguimiento
- Riesgo de error humano en cálculos de indicadores (IFA, ISA, ausentismo)
- Imposible detectar alertas tempranas en múltiples empresas simultáneamente

**Empresas independientes:**
- Desconocen el estado real de su cumplimiento hasta una auditoría externa
- No saben qué indicadores medir ni cómo interpretarlos
- Las acciones correctivas se gestionan por correo electrónico o WhatsApp
- Las auditorías generan hallazgos que nunca se cierran sistemáticamente

### 2.3 Solución alternativa actual

La competencia directa de SIZO no es otro software — es **Excel + Google Drive + WhatsApp**. Los sistemas SaaS existentes de SG-SST son:
- Demasiado costosos para el segmento de consultoras pequeñas/medianas
- Diseñados para empresas grandes con departamentos de SST
- Con interfaces de los años 2000, sin experiencia de usuario moderna
- Sin adaptación al marco normativo colombiano específico

---

## 3. Usuarios y Personas

### Persona 1 — Administrador de Consultora

**Nombre representativo:** Addy Luna  
**Rol en SIZO:** ADMIN  
**Contexto:** Dueña de consultora SST con 8–25 empresas cliente. Tiene 2–4 asesores a cargo. Necesita vista consolidada de toda la operación sin tener que revisar archivo por archivo.

**Objetivos:**
- Ver el estado de cumplimiento de toda su cartera de un vistazo
- Detectar qué empresas requieren atención urgente
- Asignar y monitorear el trabajo de sus asesores
- Generar reportes para presentar a clientes en reuniones de seguimiento
- Gestionar contratos, fechas de vencimiento y renovaciones

**Frustraciones actuales:**
- Tiene que llamar a cada asesor para saber el estado de una empresa
- Los reportes de indicadores tardan 3–5 días en generarse
- No puede comparar el desempeño entre empresas de su cartera

**Comportamiento esperado en SIZO:**
- Inicia sesión y revisa el Dashboard Ejecutivo cada mañana (5–10 min)
- Genera reportes PDF antes de reuniones con clientes
- Configura alertas de vencimiento de acciones
- Crea usuarios para nuevos asesores y asigna empresas

---

### Persona 2 — Asesor SST

**Nombre representativo:** Carlos Pérez  
**Rol en SIZO:** ASESOR  
**Contexto:** Ingeniero o tecnólogo SST. Maneja 5–15 empresas asignadas. Su trabajo es visitar las empresas, recoger datos operativos y garantizar el cumplimiento del plan de trabajo.

**Objetivos:**
- Registrar datos del seguimiento mensual de cada empresa de forma rápida
- Ver qué indicadores están en alerta para priorizar visitas
- Gestionar acciones correctivas y hacer seguimiento de cierre
- Documentar inspecciones y capacitaciones realizadas
- Generar informes de desempeño para entregar al cliente

**Comportamiento esperado en SIZO:**
- Accede desde tableta o laptop durante o después de cada visita
- Ingresa datos del seguimiento mensual por empresa
- Registra accidentes, ausentismo, inspecciones y capacitaciones
- Consulta el dashboard de cada empresa antes de la reunión mensual

---

### Persona 3 — Gerente del Cliente (vista Consulta)

**Nombre representativo:** Roberto Díaz (Gerente Hotel Mar Azul)  
**Rol en SIZO:** CONSULTA  
**Contexto:** Gerente o responsable administrativo de la empresa cliente. No tiene conocimiento técnico en SST. Quiere saber si su empresa está cumpliendo y qué riesgos tiene.

**Objetivos:**
- Ver el estado de cumplimiento de su empresa sin tecnicismos
- Entender qué indicadores están en rojo y por qué
- Aprobar acciones correctivas propuestas por el asesor
- Tener evidencia del cumplimiento para auditorías externas

**Comportamiento esperado en SIZO:**
- Accede 1–2 veces por mes
- Solo visualiza — no modifica datos
- Descarga reportes para presentar a su junta directiva

---

### Persona 4 — Empresa Independiente (sin consultora)

**Nombre representativo:** Director de RRHH o HSE interno  
**Rol en SIZO:** ADMIN (de su propio tenant)  
**Contexto:** Empresa mediana (50–200 trabajadores) que tiene personal propio para el SG-SST pero sin sistema de gestión digitalizado.

**Objetivos:**
- Gestionar su propio SG-SST sin depender de una consultora
- Medir indicadores de forma automática
- Preparar evidencias para auditorías de la ARL o del Ministerio de Trabajo

---

## 4. Alcance V1

### 4.1 ¿Qué es V1?

V1 es la migración completa del prototipo `SGSST_ERP_Final.html` a Firebase con arquitectura multitenant, más las mejoras de seguridad, experiencia de usuario y reportería que hacen de SIZO un producto comercializable.

### 4.2 Criterio de completitud de V1

V1 está completo cuando:
1. Una consultora puede registrarse, configurar su tenant, crear empresas y usuarios, e ingresar datos de seguimiento mensual
2. Los indicadores se calculan automáticamente y el dashboard muestra el semáforo en tiempo real
3. Las acciones correctivas tienen ciclo de vida completo (creación → seguimiento → cierre)
4. Se puede exportar un reporte PDF de cumplimiento por empresa
5. El sistema funciona correctamente para 3+ asesores operando simultáneamente

### 4.3 Módulos incluidos en V1

| # | Módulo | Prioridad | Fuente |
|---|---|---|---|
| 01 | Autenticación Firebase (login / logout / roles) | P0 | Nuevo |
| 02 | Gestión de tenant (onboarding consultora/empresa) | P0 | Nuevo |
| 03 | Gestión de usuarios y roles | P0 | Prototipo ✓ |
| 04 | Gestión de empresas y centros de trabajo | P0 | Prototipo ✓ |
| 05 | Seguimiento mensual | P0 | Prototipo ✓ |
| 06 | Motor de cálculo de indicadores (26 KPIs) | P0 | Prototipo ✓ |
| 07 | Dashboard ejecutivo | P0 | Prototipo ✓ + Mockup |
| 08 | Maestro de indicadores (fichas + metas) | P1 | Prototipo ✓ |
| 09 | Accidentalidad (registro individual de AT) | P1 | Prototipo ✓ |
| 10 | Ausentismo (registro individual) | P1 | Prototipo ✓ |
| 11 | Plan de trabajo anual | P1 | Prototipo ✓ |
| 12 | Capacitación | P1 | Prototipo ✓ |
| 13 | Inspecciones | P1 | Prototipo ✓ |
| 14 | Matriz de acciones correctivas/preventivas | P1 | Prototipo ✓ |
| 15 | Auditoría y Revisión por la Dirección | P1 | Prototipo ✓ |
| 16 | Casos médicos | P2 | Prototipo ✓ |
| 17 | Evaluación de estructura (estándares) | P2 | Prototipo ✓ |
| 18 | Exportación PDF por empresa | P1 | Nuevo |
| 19 | Exportación Excel (matriz de indicadores) | P2 | Prototipo (SheetJS) |
| 20 | Perfil de usuario | P2 | Prototipo ✗ |

---

## 5. Módulos y Requerimientos Funcionales

### 5.1 Autenticación y Sesión

**RF-AUTH-01:** El sistema debe usar Firebase Authentication con email/password como método principal.

**RF-AUTH-02:** Al autenticarse, el sistema debe inyectar en el Custom Token de Firebase Auth los campos `tenantId`, `role` y `empresasIds` (para asesores).

**RF-AUTH-03:** La sesión debe persistir en la aplicación (Firebase `browserLocalPersistence`).

**RF-AUTH-04:** El sistema debe mostrar un error descriptivo cuando las credenciales son incorrectas, diferenciando "usuario no encontrado" de "contraseña incorrecta".

**RF-AUTH-05:** El logout debe limpiar la sesión de Firebase y redirigir al login.

**RF-AUTH-06:** Cada rol tiene acceso diferenciado:

| Módulo | ADMIN | ASESOR | CONSULTA |
|---|---|---|---|
| Dashboard | ✅ Todas empresas | ✅ Sus empresas | ✅ Sus empresas |
| Usuarios | ✅ CRUD | ❌ | ❌ |
| Empresas | ✅ CRUD | 👁 Solo lectura | 👁 Solo lectura |
| Seguimiento | ✅ | ✅ Sus empresas | ❌ |
| Accidentalidad | ✅ | ✅ Sus empresas | 👁 |
| Ausentismo | ✅ | ✅ Sus empresas | 👁 |
| Casos médicos | ✅ | ❌ | ❌ |
| Plan trabajo | ✅ | ✅ Sus empresas | 👁 |
| Capacitación | ✅ | ✅ Sus empresas | 👁 |
| Inspecciones | ✅ | ✅ Sus empresas | 👁 |
| Acciones | ✅ | ✅ Sus empresas | 👁 |
| Auditorías | ✅ | ✅ Sus empresas | 👁 |
| Indicadores (maestro) | ✅ | 👁 | ❌ |
| Configuración | ✅ | ❌ | ❌ |

---

### 5.2 Gestión de Tenant — Onboarding

**RF-TENANT-01:** Al crear un tenant, el sistema debe solicitar:
- Nombre de la consultora/empresa
- Tipo: `consultora` o `empresa_independiente`
- Plan: starter / pro / enterprise
- Datos del administrador principal (nombre, email, contraseña)
- Logo opcional (Firebase Storage)

**RF-TENANT-02:** El onboarding debe crear automáticamente el documento del tenant en Firestore y el usuario ADMIN en Firebase Auth con Custom Claims.

**RF-TENANT-03:** Un tenant tipo `consultora` puede tener N empresas cliente. Un tenant tipo `empresa_independiente` está restringido a 1 empresa (la propia).

---

### 5.3 Gestión de Usuarios

**RF-USR-01:** El ADMIN puede crear, editar y desactivar usuarios dentro de su tenant.

**RF-USR-02:** Los campos obligatorios de un usuario son: nombre completo, email, rol, estado.

**RF-USR-03:** Los campos opcionales son: teléfonos (principal y secundario), fecha de cumpleaños, LinkedIn, ciudad.

**RF-USR-04:** Al crear un usuario, el sistema debe invocar una Cloud Function que cree el usuario en Firebase Auth y le asigne los Custom Claims (`tenantId`, `role`).

**RF-USR-05:** Un ASESOR solo puede ser asignado a empresas del mismo tenant.

**RF-USR-06:** Desactivar un usuario debe revocar sus tokens activos (Cloud Function: `revokeRefreshTokens`).

**RF-USR-07:** No se puede eliminar un usuario — solo desactivar. El historial debe preservarse.

**RF-USR-08:** El sistema debe mostrar cuándo fue el último acceso de cada usuario.

---

### 5.4 Gestión de Empresas

**RF-EMP-01:** Solo el ADMIN puede crear y editar empresas.

**RF-EMP-02:** Una empresa tiene tres secciones de configuración:
- **Información básica:** razón social, nombre comercial, NIT, CIIU, actividad, ubicación, contacto, responsables
- **Clasificación SST:** trabajadores, nivel de riesgo, clase ARL, COPASST/Vigía, asesor asignado, contrato
- **Centros de trabajo:** lista de centros con su propia clasificación ARL

**RF-EMP-03:** El nivel Res. 0312/2019 debe calcularse automáticamente según la fórmula:
- ≤ 10 trabajadores → Nivel I
- ≤ 50 trabajadores + riesgo I/II/III → Nivel II
- Resto → Nivel III

**RF-EMP-04:** El sistema debe alertar automáticamente cuando:
- El contrato de una empresa vence en ≤ 30 días
- La fecha de cumpleaños del representante legal o responsable SST es en los próximos 7 días

**RF-EMP-05:** El campo `asesorId` debe actualizarse en tiempo real si el asesor es reasignado.

**RF-EMP-06:** Desactivar una empresa no debe eliminar su historial de seguimiento.

---

### 5.5 Seguimiento Mensual

**RF-SEG-01:** El seguimiento mensual es la **fuente única de datos operativos**. Todos los indicadores, el dashboard y los reportes se calculan a partir de él.

**RF-SEG-02:** El formulario de seguimiento se organiza en 12 secciones:
1. Accidentalidad y salud
2. Ausentismo
3. Plan de trabajo SST
4. Capacitación
5. Inspecciones
6. Evaluaciones médicas
7. Seguimiento SG-SST (acciones, requisitos, objetivos)
8. COPASST / Vigía
9. COCOLAB
10. Asesor SST (visitas)
11. Plan de emergencias
12. Observaciones del período

**RF-SEG-03:** El sistema debe mostrar visualmente qué meses tienen datos registrados (indicador de completitud por mes).

**RF-SEG-04:** Los datos del seguimiento deben guardarse con autoguardado cada 30 segundos cuando el formulario tiene cambios pendientes, además del guardado manual.

**RF-SEG-05:** El sistema debe registrar quién hizo la última modificación y cuándo (`updatedBy`, `updatedAt`).

**RF-SEG-06:** Un mes con datos incompletos (campos clave en 0 o vacíos) debe mostrarse con un indicador de advertencia.

**RF-SEG-07:** El ASESOR solo puede ver y editar el seguimiento de sus empresas asignadas.

---

### 5.6 Motor de Cálculo de Indicadores

**RF-IND-01:** El sistema debe calcular automáticamente los 26 indicadores a partir del seguimiento mensual, sin intervención del usuario.

**RF-IND-02:** Los indicadores se calculan en el cliente (JS) a partir de los datos de Firestore — no en Cloud Functions — para respuesta inmediata.

**RF-IND-03:** Cada indicador tiene: clave, nombre, fórmula, tipo (Resultado/Proceso/Base), unidad, meta, dirección (mayor-mejor / menor-mejor), semáforo.

**RF-IND-04:** La semaforización sigue el estándar:
- **Verde:** cumple meta
- **Alerta:** entre 75% y 100% de la meta
- **Crítico:** por debajo del 75% de la meta
- Para indicadores inversos (AT, ausentismo): `0` = verde; `≤ 2` = alerta; `> 2` = crítico

**RF-IND-05:** Las metas son configurables por el ADMIN por tenant. Si no hay personalización, se usan los valores normativos por defecto definidos en el Maestro.

**RF-IND-06:** El sistema debe soportar cálculo anual (acumulado) y mensual (período específico).

**RF-IND-07:** El indicador `diasat` (días sin AT) debe calcularse dinámicamente desde la fecha del último AT registrado en Seguimiento.

**Indicadores implementados en V1:**

| Clave | Indicador | Fórmula | Meta | Dir. | Normativa |
|---|---|---|---|---|---|
| `ifa` | IFA — Frecuencia AT | AT / trabajadores × 100 | 0 | ↓ | Res. 0312 |
| `isa` | ISA — Severidad AT | (días incap + días cargados) / trabajadores × 100 | 0 | ↓ | Res. 0312 |
| `aus` | Ausentismo total | días aus / días trab × 100 | 5% | ↓ | Res. 0312 |
| `aus_at` | Ausentismo por AT | días incap AT / días trab × 100 | 0 | ↓ | Res. 0312 |
| `mort` | AT mortales | mort / AT × 100 | 0 | ↓ | Dec. 1072 |
| `req` | Requisitos legales | cumplidos / aplicables × 100 | 90% | ↑ | Dec. 1072 |
| `obj` | Objetivos SST | cumplidos / definidos × 100 | 100% | ↑ | Dec. 1072 |
| `plan` | Plan de trabajo | ejecutadas / programadas × 100 | 80% | ↑ | Res. 0312 |
| `cap` | Capacitaciones | ejecutadas / programadas × 100 | 80% | ↑ | Res. 0312 |
| `capC` | Cobertura capacitaciones | asistentes / (trabaj × cap ejec) × 100 | 80% | ↑ | Res. 0312 |
| `insp` | Inspecciones | ejecutadas / programadas × 100 | 100% | ↑ | Dec. 1072 |
| `emer` | Plan emergencias | ejecutadas / programadas × 100 | 100% | ↑ | Dec. 1072 |
| `ases` | Visitas técnicas SST | ejecutadas / programadas × 100 | 100% | ↑ | Res. 0312 |
| `cop` | Reuniones COPASST | ejecutadas / programadas × 100 | 100% | ↑ | Dec. 1072 |
| `col` | Reuniones COCOLAB | ejecutadas / programadas × 100 | 100% | ↑ | Dec. 1072 |
| `evmed` | Evaluaciones médicas | realizadas / programadas × 100 | 100% | ↑ | Res. 2346 |
| `acc` | Acciones cerradas | cerradas / generadas × 100 | 80% | ↑ | Dec. 1072 |
| `accAb` | Acciones abiertas | generadas − cerradas | 0 | ↓ | Dec. 1072 |
| `accV` | Acciones vencidas | sin cerrar en fecha límite | 0 | ↓ | Dec. 1072 |
| `iper` | Intervención peligros | controles impl / definidos × 100 | 100% | ↑ | Dec. 1072 |
| `invat` | Investigación AT en plazo | investigados / AT × 100 | 100% | ↑ | Dec. 1072 |
| `casosAb` | Casos médicos abiertos | conteo | 0 | ↓ | Dec. 1072 |
| `diasat` | Días sin AT | días desde último AT | — | info | — |
| `trab_n` | N° trabajadores | promedio mes | — | info | — |
| `at_n` | N° AT en período | conteo | 0 | ↓ | Dec. 1072 |
| `at_inv_n` | N° AT investigados | conteo | — | info | Dec. 1072 |

---

### 5.7 Dashboard Ejecutivo

**RF-DASH-01:** El dashboard debe mostrar, por defecto, la vista consolidada de todas las empresas del tenant (ADMIN) o de las empresas asignadas (ASESOR).

**RF-DASH-02:** El dashboard incluye:
- 6 KPIs superiores con valor actual, tendencia vs mes anterior y estado semáforo
- Gráfico de evolución 12 meses (Cumplimiento, Ausentismo, AT)
- Panel de alertas prioritarias (acciones vencidas, auditorías pendientes, indicadores críticos)
- Tabla de empresas con asesor, nivel, cumplimiento en barra, indicadores resumidos (pips de color), estado

**RF-DASH-03:** El ADMIN puede filtrar el dashboard por empresa individual o ver la vista consolidada.

**RF-DASH-04:** El dashboard debe actualizarse en tiempo real (Firestore `onSnapshot`) cuando un asesor modifica datos del seguimiento.

**RF-DASH-05:** Los gráficos deben renderizarse en Canvas 2D vanilla (sin Chart.js ni librerías externas).

**RF-DASH-06:** El dashboard debe funcionar correctamente en modo oscuro y modo claro.

---

### 5.8 Accidentalidad

**RF-ACC-01:** El módulo de accidentalidad registra accidentes de trabajo individuales con campos:
- Datos del trabajador (nombre, cargo, área)
- Fecha, hora y lugar del accidente
- Tipo y descripción del accidente
- Parte del cuerpo afectada
- Días de incapacidad
- Indicador de grave/mortal
- Estado de investigación y fecha
- Causas inmediatas y causas básicas (modelo causalidad)
- Acciones correctivas derivadas

**RF-ACC-02:** El sistema debe alertar si un AT no ha sido investigado en más de 15 días hábiles (norma: Dec. 1072/2015).

**RF-ACC-03:** Cada AT registrado debe actualizar automáticamente el campo `fechaUltimoAt` en el seguimiento del mes correspondiente.

**RF-ACC-04:** Solo ADMIN puede ver todos los AT de todas las empresas. ASESOR solo ve los de sus empresas.

---

### 5.9 Ausentismo

**RF-AUS-01:** El módulo registra ausencias individuales con: trabajador, cargo, fecha inicio, fecha fin, días, causa (AT / EL / EG / Licencia / Otra), diagnóstico, indicador de certificado.

**RF-AUS-02:** El sistema calcula automáticamente los días de ausencia al seleccionar fecha inicio y fecha fin.

**RF-AUS-03:** Los registros de ausentismo alimentan automáticamente las variables `diasAus` del seguimiento del mes correspondiente.

---

### 5.10 Acciones Correctivas y Preventivas (Matriz ACPM)

**RF-ACPM-01:** Una acción tiene: tipo (Correctiva/Preventiva/Mejora), origen (Inspección/AT/Auditoría/Seguimiento/Otro), referencia al origen, descripción, responsable, fecha límite, estado, fecha de cierre, evidencia.

**RF-ACPM-02:** Los estados posibles son: `Abierta → En progreso → Cerrada`. Las acciones sin cerrar después de la fecha límite cambian automáticamente a `Vencida`.

**RF-ACPM-03:** El sistema debe notificar (badge rojo en sidebar) cuando hay acciones con fecha límite en los próximos 7 días.

**RF-ACPM-04:** Una acción puede originarse desde otros módulos (inspecciones, AT, auditorías) y vincularse automáticamente.

**RF-ACPM-05:** El ADMIN ve todas las acciones. El ASESOR solo ve las de sus empresas. El CONSULTA puede ver pero no crear ni editar.

---

### 5.11 Inspecciones

**RF-INS-01:** Una inspección registra: empresa, fecha, área inspeccionada, inspector, tipo (planeada/no planeada), hallazgos con calificación, observaciones generales.

**RF-INS-02:** Cada hallazgo puede generar automáticamente una acción correctiva.

**RF-INS-03:** La calificación de la inspección debe estar en escala 0–100.

---

### 5.12 Capacitación

**RF-CAP-01:** Una capacitación registra: tema, fecha, duración en horas, instructor, número de asistentes, metodología, indicador de evaluación de eficacia, nota promedio.

**RF-CAP-02:** El total acumulado de capacitaciones alimenta las variables `capEjec` y `capAsist` del seguimiento mensual.

---

### 5.13 Plan de Trabajo Anual

**RF-PLAN-01:** El plan de trabajo anual se estructura por actividades con: descripción, mes programado, responsable, presupuesto, estado, observaciones.

**RF-PLAN-02:** El plan debe mostrar un Gantt simplificado con el estado de cumplimiento mes a mes.

**RF-PLAN-03:** El porcentaje de cumplimiento del plan (`actEjec / actProg`) se refleja automáticamente en el indicador `plan` del seguimiento.

---

### 5.14 Maestro de Indicadores

**RF-MAESTRO-01:** El ADMIN puede personalizar las fichas técnicas de cada indicador: nombre, tipo, normativa, periodicidad, fórmula, meta descriptiva, fuente, umbral, responsable, evidencia, interpretación técnica.

**RF-MAESTRO-02:** El ADMIN puede modificar la meta numérica de cada indicador y la dirección del semáforo (mayor-mejor / menor-mejor).

**RF-MAESTRO-03:** Las fichas personalizadas se almacenan en Firestore a nivel de tenant (afectan a todas las empresas del tenant).

**RF-MAESTRO-04:** El ADMIN puede "restaurar originales" para resetear cualquier personalización.

**RF-MAESTRO-05:** El módulo incluye la Evaluación de Estructura con 11 estándares normativos (Dec. 1072/2015), cada uno con criterios binarios de cumplimiento y un puntaje global porcentual.

---

### 5.15 Auditoría y Revisión por la Dirección

**RF-AUD-01:** El módulo registra auditorías con: tipo (interna/externa), fecha, auditor, alcance, resultados por estándar, puntaje global, hallazgos, acciones derivadas.

**RF-AUD-02:** La Revisión por la Dirección captura: análisis de cumplimiento anual, compromisos de la dirección, recursos asignados, decisiones estratégicas.

**RF-AUD-03:** Una auditoría sin completar después de 12 meses de la última debe generar alerta en el dashboard.

---

### 5.16 Reportes y Exportación

**RF-REP-01:** El sistema debe generar un **Informe de Cumplimiento SG-SST** en PDF por empresa con: portada con logo de la consultora, resumen ejecutivo, tabla de indicadores con semáforo, gráficas de evolución, observaciones del asesor. Generado con `jsPDF` + `autoTable`.

**RF-REP-02:** El sistema debe exportar la **Matriz de Indicadores** en formato XLSX con SheetJS.

**RF-REP-03:** El PDF se genera en el cliente (sin Cloud Function) para respuesta inmediata.

**RF-REP-04:** El informe debe incluir el logo de la consultora o de la empresa, según el contexto.

---

### 5.17 Casos Médicos

**RF-CM-01:** Solo el ADMIN tiene acceso al módulo de casos médicos (información médica confidencial).

**RF-CM-02:** Un caso médico registra: trabajador, cargo, tipo (AT/EL/EG), diagnóstico, fecha apertura, estado, restricciones laborales, observaciones clínicas.

**RF-CM-03:** Los casos abiertos se reflejan en el indicador `casosAb` del seguimiento mensual.

---

## 6. Historias de Usuario

### ADMIN (Consultora)

```
US-01: Como administrador, quiero ver en el dashboard el estado de cumplimiento de todas mis
       empresas en una sola pantalla, para detectar cuáles requieren atención sin revisar
       cada empresa individualmente.

US-02: Como administrador, quiero crear un usuario asesor y asignarle empresas específicas,
       para que solo tenga acceso a los datos de sus empresas asignadas.

US-03: Como administrador, quiero recibir alertas visuales cuando una acción correctiva
       está vencida, para hacer seguimiento proactivo antes de que ocurra una sanción.

US-04: Como administrador, quiero generar un reporte PDF del cumplimiento SG-SST de una
       empresa, para presentarlo en la reunión mensual con el cliente sin preparación adicional.

US-05: Como administrador, quiero personalizar las metas de los indicadores para cada tenant,
       para adaptarlas a compromisos específicos con la ARL de cada empresa.
```

### ASESOR SST

```
US-06: Como asesor, quiero ingresar los datos del seguimiento mensual desde mi tableta
       durante o después de la visita, para evitar el reingreso posterior de información.

US-07: Como asesor, quiero ver automáticamente los indicadores calculados después de
       ingresar el seguimiento, para no tener que hacer cálculos manuales en Excel.

US-08: Como asesor, quiero ver una lista de acciones abiertas por empresa, para planificar
       mis visitas priorizando las empresas con más acciones vencidas.

US-09: Como asesor, quiero registrar un accidente de trabajo con todos sus campos y ver
       la alerta si no ha sido investigado en 15 días, para cumplir con los plazos normativos.

US-10: Como asesor, quiero ver el mapa de calor de meses del seguimiento, para identificar
       rápidamente qué períodos están incompletos.
```

### CONSULTA (Gerente Cliente)

```
US-11: Como gerente de empresa cliente, quiero ver el estado de cumplimiento del SG-SST
       de mi empresa sin necesidad de conocimiento técnico, para tomar decisiones gerenciales
       informadas.

US-12: Como gerente, quiero ver qué indicadores están en rojo y qué significa cada uno,
       para comunicarlo a mi junta directiva.

US-13: Como gerente, quiero descargar un reporte PDF del estado del SG-SST,
       para tenerlo disponible en auditorías externas o reuniones de directivos.
```

---

## 7. Requerimientos No Funcionales

### 7.1 Rendimiento

**RNF-PERF-01:** La carga inicial de la aplicación (shell + dashboard) debe completarse en menos de 3 segundos en conexión de 10 Mbps.

**RNF-PERF-02:** El cálculo de indicadores para un año completo (12 meses) debe completarse en menos de 200 ms en el cliente.

**RNF-PERF-03:** La aplicación debe funcionar offline para consulta de datos ya cargados (Firestore `enableIndexedDbPersistence`).

**RNF-PERF-04:** Los PDFs deben generarse en menos de 5 segundos para reportes estándar (< 20 páginas).

### 7.2 Seguridad

**RNF-SEC-01:** Las contraseñas deben gestionarse exclusivamente por Firebase Authentication. Nunca se almacenan en Firestore.

**RNF-SEC-02:** El acceso a datos de Firestore debe estar protegido por Security Rules que verifiquen el `tenantId` del token en cada operación.

**RNF-SEC-03:** Los Custom Claims de Firebase Auth (`tenantId`, `role`, `empresasIds`) son la fuente de verdad para control de acceso — no el documento del usuario en Firestore.

**RNF-SEC-04:** Toda información de casos médicos debe estar en una colección separada con reglas de acceso exclusivas para ADMIN.

**RNF-SEC-05:** Las Cloud Functions deben usar `admin SDK` exclusivamente — nunca exponer datos entre tenants.

**RNF-SEC-06:** Los archivos en Firebase Storage deben tener rules que restrinjan acceso por `tenantId`.

**RNF-SEC-07:** No se puede eliminar ningún documento de Firestore desde el cliente — solo desactivar (soft delete). Las eliminaciones físicas solo por Cloud Functions autorizadas.

### 7.3 Escalabilidad

**RNF-ESC-01:** La arquitectura debe soportar hasta 500 tenants en V1 sin cambios estructurales.

**RNF-ESC-02:** Un tenant puede tener hasta 100 empresas sin degradación de rendimiento.

**RNF-ESC-03:** Cada empresa puede tener hasta 36 meses de seguimiento histórico en V1.

**RNF-ESC-04:** Las queries de Firestore deben tener índices compuestos para todas las consultas frecuentes (empresa + año, tenant + estado, etc.).

### 7.4 Disponibilidad y Confiabilidad

**RNF-DIS-01:** La plataforma debe tener disponibilidad del 99.5% (Firebase SLA: 99.95%).

**RNF-DIS-02:** Los datos deben estar respaldados automáticamente por Firebase (backup diario habilitado en producción).

**RNF-DIS-03:** El modo offline debe permitir consultar datos del último caché cuando no hay conexión.

### 7.5 Usabilidad

**RNF-UX-01:** La interfaz debe seguir el design system definido: paleta SIZO, tipografía Inter, componentes del mockup aprobado.

**RNF-UX-02:** La aplicación debe ser completamente funcional en desktop (1440px), tablet (1024px) y móvil (390px).

**RNF-UX-03:** Dark mode completo disponible con persistencia de preferencia en localStorage.

**RNF-UX-04:** Toda la interfaz debe estar en español colombiano.

**RNF-UX-05:** Los formularios deben validar en tiempo real con mensajes de error claros.

**RNF-UX-06:** Toda operación de guardado debe mostrar feedback visual inmediato (flash de confirmación o spinner de carga).

---

## 8. Arquitectura Técnica

### 8.1 Stack definitivo

```
Frontend
├── HTML5 semántico
├── CSS3 con variables custom (design tokens)
├── JavaScript ES6+ Vanilla (sin frameworks)
├── Módulos ES6 (import/export) con bundler mínimo o sin bundler
└── Canvas 2D API para gráficas

Backend (Firebase)
├── Firebase Authentication (email/password + Custom Claims)
├── Cloud Firestore (base de datos principal)
├── Firebase Storage (logos, evidencias, PDFs)
├── Firebase Hosting (deployment)
└── Cloud Functions (operaciones privilegiadas: crear usuarios, enviar correos, cálculos batch)

Librerías autorizadas
├── jsPDF + jsPDF-AutoTable (generación PDF)
├── SheetJS/xlsx (exportación Excel)
└── Google Fonts — Inter (tipografía)

CI/CD
└── GitHub Actions → Firebase Hosting (automático en push a main)
```

### 8.2 Estructura de archivos del proyecto

```
sizo/
├── index.html              — Shell principal (login → app)
├── firebase.js             — Inicialización Firebase
├── auth.js                 — Login, logout, session
├── router.js               — Navegación SPA
├── store.js                — Estado reactivo global (sin framework)
│
├── modules/
│   ├── dashboard.js
│   ├── seguimiento.js
│   ├── indicadores.js      — Motor de cálculo (sin I/O)
│   ├── empresas.js
│   ├── usuarios.js
│   ├── accidentes.js
│   ├── ausentismo.js
│   ├── acciones.js
│   ├── inspecciones.js
│   ├── capacitacion.js
│   ├── plan.js
│   ├── auditoria.js
│   ├── casos.js
│   └── maestro.js
│
├── components/
│   ├── sidebar.js
│   ├── topbar.js
│   ├── modal.js
│   ├── chart.js            — Canvas chart engine
│   ├── table.js            — Data table component
│   └── toast.js            — Notificaciones
│
├── reports/
│   ├── pdf-cumplimiento.js
│   └── excel-indicadores.js
│
├── styles/
│   ├── tokens.css          — Design tokens (variables)
│   ├── base.css
│   ├── layout.css
│   ├── components.css
│   └── dark.css
│
├── functions/              — Cloud Functions
│   ├── createUser.js
│   ├── deactivateUser.js
│   ├── onTenantCreated.js
│   └── scheduledAlerts.js
│
└── firestore.rules
```

### 8.3 Principios arquitectónicos

1. **Separación estricta de capas:** El motor de cálculo de indicadores (`indicadores.js`) es una función pura — recibe datos, devuelve indicadores calculados. Sin I/O, sin referencias al DOM.

2. **Firestore como fuente de verdad:** Nunca guardar estado derivado en Firestore. Los indicadores se calculan en el cliente al vuelo.

3. **Custom Claims como capa de autorización:** El `tenantId` y `role` en el token de Firebase Auth son la única fuente de verdad para permisos. Firestore Security Rules los verifican sin leer documentos adicionales.

4. **Soft delete siempre:** Ningún documento se elimina físicamente. Campo `deletedAt: timestamp | null` en todos los documentos.

5. **IDs compuestos para seguimiento:** El documento de seguimiento mensual usa como ID `{empresaId}_{yyyy}_{mm}` para hacer queries O(1) sin índices adicionales.

---

## 9. Modelo de Negocio y Tenancy

### 9.1 Tipos de tenant

| Tipo | Descripción | Restricciones |
|---|---|---|
| `consultora` | Firma consultora con múltiples empresas cliente | Sin límite de empresas según plan |
| `empresa` | Empresa que gestiona su propio SG-SST | 1 empresa máximo (la propia) |

### 9.2 Planes (MVP)

| Plan | Empresas | Usuarios | Historial | Precio referencial |
|---|---|---|---|---|
| Starter | Hasta 5 | Hasta 3 | 12 meses | $150.000 COP/mes |
| Pro | Hasta 20 | Hasta 8 | 36 meses | $380.000 COP/mes |
| Enterprise | Ilimitado | Ilimitado | Ilimitado | A convenir |

*Los planes son referencia para V1 — no se implementa facturación automática en V1.*

### 9.3 Aislamiento de datos

Cada tenant tiene un documento raíz en `/tenants/{tenantId}`. **Ningún dato cruza entre tenants** excepto el catálogo global de indicadores (fichas técnicas por defecto), que es de solo lectura.

---

## 10. Métricas de Éxito

### 10.1 Métricas de adopción (primeros 6 meses)

| Métrica | Meta V1 |
|---|---|
| Tenants activos | ≥ 10 |
| Empresas registradas | ≥ 50 |
| Seguimientos ingresados/mes | ≥ 150 |
| DAU/MAU ratio | ≥ 40% |
| Tiempo promedio en sesión | ≥ 12 min |
| Retención 30 días | ≥ 70% |

### 10.2 Métricas de calidad del producto

| Métrica | Meta |
|---|---|
| Bugs críticos en producción | 0 |
| Tiempo de respuesta dashboard | < 2s |
| Uptime | ≥ 99.5% |
| NPS (Net Promoter Score) | ≥ 40 |

### 10.3 Métricas de negocio (primer año)

| Métrica | Meta |
|---|---|
| MRR (Monthly Recurring Revenue) | ≥ $3.000.000 COP |
| Churn mensual | < 5% |
| LTV / CAC ratio | ≥ 3 |

---

## 11. Fuera de Alcance V1

Los siguientes elementos **no** se implementan en V1:

| Elemento | Razón | Versión objetivo |
|---|---|---|
| Facturación automática y pasarela de pagos | Complejidad — primeros clientes se cobran manualmente | V2 |
| Notificaciones por email/SMS | Requiere Sendgrid/Twilio + diseño de plantillas | V2 |
| App móvil nativa (Android/iOS) | PWA es suficiente para V1 | V3 |
| IA para análisis predictivo de accidentalidad | Requiere volumen de datos históricos | V3 |
| Integración con ARL (FURAT digital) | Depende de APIs ARL que no están disponibles | V3 |
| Módulo de PESV (Plan Estratégico de Seguridad Vial) | Fuera del SG-SST core | V2 |
| Módulo de Gestión Ambiental (SGA) | Expansión futura | V3 |
| Chat interno entre asesor y cliente | Complejidad de UX | V2 |
| Firma digital de documentos | Integración con e.firma / DocuSign | V2 |
| Multiidioma (inglés) | Sin demanda en V1 | V3 |
| Super-admin panel (Webcore Solutions) | Se usa Firebase Console manualmente | V1.5 |

---

## 12. Fases y Milestones

### Fase 0 — Infraestructura (1 semana)
- [ ] Crear proyecto Firebase (dev, staging, prod)
- [ ] Configurar Firebase Auth, Firestore, Storage, Hosting
- [ ] Repositorio GitHub + GitHub Actions pipeline
- [ ] Estructura de carpetas del proyecto
- [ ] Design tokens CSS completos
- [ ] Componentes base: sidebar, topbar, modal, toast

### Fase 1 — Auth y Tenancy (1 semana)
- [ ] Pantalla de login con Firebase Auth
- [ ] Cloud Function `createTenant` (onboarding)
- [ ] Cloud Function `createUser` (con Custom Claims)
- [ ] Security Rules base (tenant isolation)
- [ ] Módulo de usuarios (CRUD)
- [ ] Módulo de empresas (CRUD completo con centros de trabajo)

### Fase 2 — Core SG-SST (2 semanas)
- [ ] Módulo de seguimiento mensual (formulario completo)
- [ ] Motor de cálculo de indicadores (función pura)
- [ ] Dashboard ejecutivo (KPIs, gráfica, alertas, tabla empresas)
- [ ] Maestro de indicadores (fichas + metas)
- [ ] Evaluación de estructura

### Fase 3 — Módulos Operativos (2 semanas)
- [ ] Accidentalidad (registro individual AT)
- [ ] Ausentismo (registro individual)
- [ ] Acciones correctivas/preventivas (ciclo completo)
- [ ] Inspecciones
- [ ] Capacitación
- [ ] Plan de trabajo anual

### Fase 4 — Módulos Complementarios (1 semana)
- [ ] Auditoría y Revisión por la Dirección
- [ ] Casos médicos
- [ ] Perfil de usuario

### Fase 5 — Reportería y QA (1 semana)
- [ ] Generación PDF (Informe de cumplimiento)
- [ ] Exportación Excel (Matriz de indicadores)
- [ ] Testing integral (funcional + security rules)
- [ ] Responsive completo (mobile, tablet, desktop)
- [ ] Dark mode completo
- [ ] Performance audit (Lighthouse ≥ 80)

### Fase 6 — Lanzamiento (0.5 semana)
- [ ] Seed data inicial (tenant demo Addy Luna)
- [ ] Documentación de usuario básica
- [ ] Despliegue en producción
- [ ] Monitoreo Firebase Performance + Crashlytics

**Duración total estimada: 8.5 semanas**

---

## 13. Criterios de Aceptación

Un módulo se considera "aceptado" cuando:

1. ✅ El flujo completo funciona sin errores en Chrome desktop y móvil
2. ✅ Las Security Rules de Firestore impiden acceso no autorizado (ASESOR no puede ver datos de otra empresa; CONSULTA no puede escribir)
3. ✅ Los indicadores calculados coinciden con los cálculos manuales de referencia (spreadsheet de validación)
4. ✅ El formulario valida todos los campos requeridos antes de guardar
5. ✅ Dark mode no rompe ningún componente del módulo
6. ✅ El módulo funciona correctamente en viewport 390px (móvil)
7. ✅ El tiempo de carga del módulo es < 1.5 segundos con datos de prueba

---

## 14. Glosario

| Término | Definición |
|---|---|
| **SG-SST** | Sistema de Gestión de Seguridad y Salud en el Trabajo |
| **AT** | Accidente de Trabajo |
| **EL** | Enfermedad Laboral |
| **IFA** | Índice de Frecuencia de Accidentalidad |
| **ISA** | Índice de Severidad de Accidentalidad |
| **ARL** | Administradora de Riesgos Laborales |
| **COPASST** | Comité Paritario de Seguridad y Salud en el Trabajo (>10 trabajadores) |
| **Vigía SST** | Figura alternativa al COPASST para empresas ≤ 10 trabajadores |
| **COCOLAB** | Comité de Convivencia Laboral |
| **IPER** | Identificación de Peligros y Evaluación de Riesgos |
| **Dec. 1072/2015** | Decreto Único Reglamentario del Sector Trabajo — marco legal SG-SST |
| **Res. 0312/2019** | Define los estándares mínimos del SG-SST según nivel de riesgo y tamaño |
| **Tenant** | Instancia aislada de SIZO para una consultora o empresa independiente |
| **Custom Claims** | Metadatos del token Firebase Auth que definen tenantId y rol |
| **Soft delete** | Marcado de un registro como eliminado sin borrarlo físicamente |
| **FURAT** | Formulario Único de Reporte de Accidente de Trabajo |
| **SVE** | Sistema de Vigilancia Epidemiológica |
