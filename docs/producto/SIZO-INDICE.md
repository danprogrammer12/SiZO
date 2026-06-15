# SIZO — Índice de Memoria del Proyecto
**Generado:** 2026-06-05  
**Estado del proyecto:** En fase de implementación  

Este archivo documenta todo el conocimiento acumulado sobre SIZO en esta carpeta y en la memoria de Claude. Úsalo como punto de entrada para cualquier sesión futura.

---

## ¿Qué es SIZO?

**SIZO** (`SIZ◉`) es un producto SaaS propio de Webcore Solutions para la gestión integral del SG-SST (Sistema de Gestión de Seguridad y Salud en el Trabajo) en Colombia.

- **Mercado objetivo:** Consultoras SST y empresas que gestionan su propio SG-SST
- **Normativa base:** Dec. 1072/2015 · Res. 0312/2019 · Ley 1562/2012 · Res. 2346/2007
- **Stack:** HTML/CSS/JS vanilla + Firebase (Auth, Firestore, Storage, Hosting)
- **Carpeta:** `proyectos_dp/productos/SIZO/`

---

## Archivos en esta carpeta

### `SGSST_ERP_Final.html`
**Tipo:** Prototipo funcional (fuente de referencia)  
**Qué contiene:**
- ERP SG-SST completo en un único archivo HTML de ~440KB
- Persistencia en `localStorage` bajo la clave `sgsst_erp_v1`
- 13 módulos operativos implementados (usuarios, empresas, seguimiento mensual, dashboard, indicadores, accidentalidad, ausentismo, plan de trabajo, capacitación, inspecciones, acciones, auditoría, casos médicos)
- 26 indicadores calculados automáticamente (IFA, ISA, ausentismo, plan, capacitaciones, etc.)
- 3 roles: ADMIN, ASESOR SST, CONSULTA
- Datos demo de 5 empresas en Santa Marta / Barranquilla / Ciénaga
- Dependencias externas: Chart.js 4.4.1, SheetJS/xlsx 0.18.5, Google Fonts (Syne, DM Sans, DM Mono)

**Para qué sirve:** Es la referencia funcional completa. Todo lo que SIZO V1 debe hacer ya está implementado aquí — la tarea es migrarlo a Firebase con arquitectura multitenant y autenticación real.

---

### `analisis-ingenieria-inversa.md`
**Tipo:** Documento de análisis técnico  
**Generado en:** sesión 2026-06-05  
**Qué contiene:**

1. **Resumen ejecutivo** — Estado general del prototipo
2. **Arquitectura actual** — Patrón SPA monolítico, objeto `S` como estado global, `nav(v)` para navegación
3. **Inventario de módulos** — Núcleo (completamente implementados) vs. secundarios vs. Fase 2
4. **Modelo de datos reconstruido** — Esquemas de todas las entidades: Usuario, Empresa, CentroTrabajo, Seguimiento mensual (con todos sus campos)
5. **Flujo de dependencias** — Seguimiento mensual como fuente única → Motor de cálculo → Dashboard
6. **Sistema de indicadores** — Los 26 KPIs con fórmulas, metas, umbrales y semaforización
7. **Roles y permisos** — Qué puede hacer ADMIN / ASESOR / CONSULTA módulo por módulo
8. **Normativa incorporada** — Dónde impacta Dec. 1072, Res. 0312, Ley 1562, Res. 2346
9. **Funcionalidades incompletas** — Perfil usuario (Fase 2), contraseñas en texto plano, badge hardcodeado, años hardcodeados
10. **Riesgos técnicos** — 10 riesgos clasificados por severidad (críticos, altos, medios, bajos)
11. **Análisis de migración a SaaS** — Qué depende de localStorage → qué colecciones Firestore, soporte actual del modelo multitenant

---

### `dashboard.html`
**Tipo:** Mockup funcional aprobado  
**Generado en:** sesión 2026-06-05  
**Qué contiene:**
- Dashboard Ejecutivo de SIZO implementado en HTML/CSS/JS vanilla puro (sin frameworks)
- Sidebar dark con logo `SIZ◉`, navegación agrupada con badges, perfil de usuario
- Topbar con selector de empresa, badge de período, notificaciones, toggle dark/light mode
- 6 KPIs con valores reales del prototipo, tendencias vs. mes anterior, semaforización por color
- Gráfico multi-línea en Canvas 2D vanilla: Cumplimiento (azul + fill), Ausentismo (ámbar dashed), AT mensuales (rojo puntos) — con tooltip interactivo en hover
- Panel de 4 alertas prioritarias con severidad (crítico / advertencia / aviso)
- Tabla de empresas con barra de progreso de cumplimiento, indicadores pip de colores, nivel Res. 0312, estado
- Dark mode completo con CSS variables
- Responsive: 1440px → 1024px → 768px → 390px
- Datos reales de las 5 empresas demo del prototipo (Hotel Mar Azul, Distribuciones Caribe, etc.)

**Paleta aplicada:** `#2563EB` (brand) · `#0F172A` (navy/sidebar) · `#06B6D4` (teal) · `#F8FAFC` (bg) · `#22C55E` / `#F59E0B` / `#EF4444` (estados)  
**Tipografía:** Inter (Google Fonts) — único recurso externo

**Estado:** Aprobado — sirve como guía visual para toda la implementación.

---

### `PRD-SIZO-V1.md`
**Tipo:** Product Requirements Document completo  
**Generado en:** sesión 2026-06-05  
**Secciones (14):**

1. **Visión del producto** — Declaración de visión, propuesta de valor, identidad de marca
2. **Problema** — Contexto normativo colombiano, dolor del mercado, solución alternativa actual (Excel/WhatsApp)
3. **Usuarios y personas** — 4 personas detalladas:
   - Persona 1: Administrador de Consultora (ADMIN) — Addy Luna
   - Persona 2: Asesor SST (ASESOR) — Carlos Pérez
   - Persona 3: Gerente del cliente (CONSULTA) — Roberto Díaz
   - Persona 4: Empresa Independiente (ADMIN propio)
4. **Alcance V1** — Definición de "completitud", 20 módulos con prioridad P0/P1/P2 y origen (prototipo vs. nuevo)
5. **Módulos y requerimientos funcionales** — RF detallados para cada módulo:
   - Auth (RF-AUTH-01 a 06) con matriz de acceso por rol y módulo
   - Tenant/Onboarding (RF-TENANT-01 a 03)
   - Usuarios (RF-USR-01 a 08)
   - Empresas (RF-EMP-01 a 06) incluyendo cálculo automático Nivel Res. 0312
   - Seguimiento mensual (RF-SEG-01 a 07) — 12 secciones de datos
   - Motor de indicadores (RF-IND-01 a 07) — tabla completa de los 26 KPIs con fórmulas, metas, normativa
   - Dashboard ejecutivo (RF-DASH-01 a 06)
   - Accidentalidad, Ausentismo, Acciones ACPM, Inspecciones, Capacitación, Plan de Trabajo, Maestro, Auditoría, Reportes PDF/Excel, Casos Médicos
6. **Historias de usuario** — 13 user stories por persona
7. **Requerimientos no funcionales** — Performance (< 3s carga, < 200ms cálculo), Seguridad (Custom Claims, Security Rules, soft delete), Escalabilidad (500 tenants, 100 empresas/tenant), Usabilidad (responsive, dark mode, español)
8. **Arquitectura técnica** — Stack definitivo, estructura de carpetas del proyecto
9. **Modelo de negocio y tenancy** — Tipos consultora/empresa, 3 planes (Starter $150K/Pro $380K/Enterprise)
10. **Métricas de éxito** — Adopción, calidad, negocio (MRR, churn, LTV/CAC)
11. **Fuera de alcance V1** — 10 elementos con justificación y versión objetivo
12. **Fases y milestones** — 6 fases, 8.5 semanas:
    - Fase 0: Infraestructura (1 sem)
    - Fase 1: Auth y Tenancy (1 sem)
    - Fase 2: Core SG-SST — seguimiento + indicadores + dashboard (2 sem)
    - Fase 3: Módulos operativos (2 sem)
    - Fase 4: Módulos complementarios (1 sem)
    - Fase 5: Reportería y QA (1 sem)
    - Fase 6: Lanzamiento (0.5 sem)
13. **Criterios de aceptación** — 7 criterios por módulo
14. **Glosario** — 18 términos SG-SST

---

### `firestore-model.md`
**Tipo:** Modelo de datos definitivo para implementación  
**Generado en:** sesión 2026-06-05  
**Secciones (10):**

1. **Estrategia multitenant** — Decisión: subcollections por tenant (vs. colecciones planas). Jerarquía de autorización con Custom Claims.

2. **Árbol de colecciones completo:**
   ```
   /tenants/{tenantId}/
     usuarios, empresas, seguimiento, accidentes, ausencias,
     acciones, inspecciones, capacitaciones, plan_actividades,
     auditorias, casos_medicos, eval_estructura, configuracion
   /catalogo/indicadores/   ← global, read-only
   ```

3. **Esquemas de documentos** — 15 esquemas completos con tipos exactos:
   - `/tenants/{tenantId}` — tenant raíz
   - `/usuarios/{userId}` — usuario (uid = Firebase Auth UID)
   - `/empresas/{empresaId}` — empresa con centros embebidos
   - `/seguimiento/{empId}_{yyyy}_{mm}` — datos operativos mensuales (ID compuesto determinístico, 35 campos numéricos)
   - `/accidentes/{atId}` — registro individual AT con campos de investigación
   - `/ausencias/{ausId}` — registro individual de ausencia
   - `/acciones/{accionId}` — ACPM con ciclo de vida (abierta → en_progreso → cerrada/vencida)
   - `/inspecciones/{insId}` — con hallazgos embebidos
   - `/capacitaciones/{capId}` — con evaluación de eficacia
   - `/plan_actividades/{planId}` — por componente SG-SST
   - `/auditorias/{audId}` — con evaluaciones de estructura E01-E11
   - `/casos_medicos/{casoId}` — acceso ADMIN only
   - `/eval_estructura/{empId}_{yyyy}` — ID compuesto
   - `/configuracion/{empId}` — metas custom, fichas custom, resultados anteriores, observaciones
   - `/catalogo/indicadores/{indKey}` — fichas por defecto globales

4. **Security Rules completas** (~120 líneas) — Protección por `tenantId` en Custom Claims, validación de rol, restricción ADMIN-only para casos médicos y configuración, prohibición de delete físico.

5. **Índices compuestos** — 13 índices en formato `firestore.indexes.json` listos para deploy.

6. **Patrones de query clave** — 8 ejemplos con código real: carga anual por empresa, dashboard ADMIN, dashboard ASESOR (desde Claims sin query), acciones vencidas, acciones próximas a vencer (7 días), AT sin investigar (15 días hábiles), upsert de seguimiento con `setDoc merge`, soft delete.

7. **Cloud Functions requeridas** — 6 funciones especificadas con input/proceso/output:
   - `createTenant` — onboarding completo
   - `createUser` — con Custom Claims
   - `deactivateUser` — revoca tokens
   - `updateUserEmpresas` — actualiza Claims de ASESOR
   - `scheduledUpdateAccionesVencidas` — cron diario
   - `scheduledContratoAlerts` — cron diario

8. **IDs y convenciones** — Tabla de ID por colección, reglas de naming (camelCase, Timestamps, soft delete, arrays vacíos vs null).

9. **Migración desde localStorage** — Script Node.js con admin SDK para importar datos del prototipo + checklist de 8 pasos.

10. **Variables de entorno** — Configuración dev/prod + código de inicialización Firebase con persistencia offline.

---

### `sizo_logo_main_1780640154048.png`
**Tipo:** Asset de marca  
**Qué contiene:** Logo oficial de SIZO.

---

## Decisiones clave registradas

| Decisión | Elección | Alternativa descartada |
|---|---|---|
| Arquitectura multitenant | Subcollections por tenant | Colecciones planas con campo tenantId |
| Control de acceso | Custom Claims en Firebase Auth Token | Leer documento usuario en cada request |
| ID de seguimiento | Compuesto `{empId}_{yyyy}_{mm}` | Auto-generado |
| Cálculo de indicadores | Función pura en cliente | Cloud Functions |
| Borrado de datos | Soft delete (`deletedAt`) | Borrado físico |
| Framework frontend | Ninguno — vanilla JS | React, Vue, Svelte |
| Generación PDF | jsPDF + autoTable en cliente | Cloud Function / servidor |
| Charts | Canvas 2D API vanilla | Chart.js |

---

## Estado del proyecto al 2026-06-05

| Fase | Estado |
|---|---|
| Ingeniería inversa del prototipo | ✅ Completada |
| Diseño del mockup (Dashboard) | ✅ Aprobado |
| PRD V1 | ✅ Completado |
| Modelo Firestore | ✅ Completado |
| Infraestructura Firebase | ⬜ Pendiente — próximo paso |
| Auth y Tenancy | ⬜ Pendiente |
| Core SG-SST | ⬜ Pendiente |
| Módulos operativos | ⬜ Pendiente |
| Reportería y QA | ⬜ Pendiente |
| Lanzamiento | ⬜ Pendiente |

**Próximo paso concreto:** Crear proyecto Firebase en consola (dev + prod), configurar Auth/Firestore/Storage/Hosting, inicializar repositorio GitHub con GitHub Actions. → Fase 0 del PRD.
