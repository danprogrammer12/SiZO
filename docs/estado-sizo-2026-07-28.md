# SIZO — Estado actual del producto (2026-07-28)

## Qué es

SIZO (`SIZ◉`) es un ERP SaaS de Seguridad y Salud en el Trabajo (SG-SST) para el mercado colombiano, producto propio de Webcore Solutions. Multitenant, orientado a consultoras SST que gestionan varias empresas cliente desde una sola cuenta.

- **URL producción:** https://danprogrammer12.github.io/SiZO
- **Repositorio:** https://github.com/danprogrammer12/SiZO
- **Stack:** JavaScript vanilla (SPA sin framework, ES modules), Supabase (Auth + PostgreSQL con RLS + Storage), pdf-lib, GitHub Pages

## Contexto reciente

El proyecto Supabase original (`ifqzdrqzjgsdhjbqkbba`) fue eliminado por inactividad tras una pausa del proyecto. El 2026-07-27/28 se reconstruyó desde cero en un proyecto nuevo (`zfdiloozznodysbsrqhv`): schema completo, RLS, Edge Functions redesplegadas, tenant y usuario ADMIN reprovisionados. Producción verificada funcionando de punta a punta (login, creación de usuarios).

Todas las migraciones SQL quedaron consolidadas en `supabase/migrations/000_RECREAR_BD_DESDE_CERO.sql` para poder repetir el proceso si vuelve a ser necesario.

---

## Roles y multitenancy

| Rol | Permisos |
|-----|----------|
| `ADMIN` | Acceso total a todas las empresas del tenant, gestión de usuarios |
| `ASESOR` | Solo sus empresas asignadas — puede escribir |
| `CONSULTA` | Solo lectura de sus empresas asignadas |
| `SUPERADMIN` | Fuera del tenant — panel de gestión de todos los tenants (billing, planes) |

La seguridad real vive en RLS de PostgreSQL (multitenant por `tenant_id` en el JWT). El gating de rutas en el frontend es solo UX, no seguridad.

---

## Módulos operativos

| Módulo | Qué hace |
|--------|----------|
| **Dashboard** | Vista consolidada de todas las empresas + vista individual por empresa |
| **Seguimiento** | Captura mensual de indicadores SG-SST por empresa (accidentalidad, ausentismo, plan de trabajo, capacitación, inspecciones, evaluaciones médicas, COPASST, emergencias, etc.) |
| **Empresas** | CRUD de empresas cliente + asignación de asesores |
| **Usuarios** | CRUD de usuarios del tenant, creación vía Edge Function (`crear-usuario`) con invitación automática por correo |
| **Matriz de Riesgos (IPVR / GTC 45)** | Identificación de peligros y valoración de riesgos según metodología GTC 45. Motor de cálculo puro (ND×NE→probabilidad, probabilidad×NC→nivel de riesgo→zona I-IV) |
| **Matriz de EPP** | Cruce cargo/tarea con EPP requerido, puede referenciar el peligro de origen en la Matriz de Riesgos |
| **Entrega de EPP** | Evidencia de entrega individual firmada (Dec. 1072 Art. 2.2.4.6.24) |
| **Gestor Documental** | Núcleo del producto. Repositorio central de documentos SST: categorización, vigencia (Vigente / Por vencer 30d / Vencido), historial de versiones, firma digital sobre PDF (dibujada, imagen o texto predeterminado + posicionamiento arrastrable + notas), previsualización, descarga, soft-delete. **En ajuste actualmente: mecánica de firma.** |
| **Actas de Comités** | COPASST y Comité de Convivencia Laboral, con periodicidad y compromisos |
| **Accidentes** | Registro de accidentes de trabajo: causas inmediatas/básicas, factores personales/de trabajo, investigación |
| **Ausentismo** | Registro de ausencias (AT, EL, EG, licencias) con conteo de días |
| **Acciones (ACPM)** | Acciones correctivas/preventivas/de mejora, con trazabilidad al hallazgo de origen (inspección, accidente, auditoría, etc.) |
| **Inspecciones** | Inspecciones planeadas/no planeadas con hallazgos y calificación |
| **Capacitación** | Registro de capacitaciones: tema, asistentes, evaluación |
| **Plan de Trabajo** | Actividades anuales del SG-SST por componente (política, planificación, implementación, verificación, mejora) |
| **Auditoría** | Auditorías internas/externas con hallazgos y compromisos |
| **Casos Médicos** | Solo ADMIN — seguimiento de casos AT/EL/EG con restricciones y reubicación |
| **Indicadores** | Motor de cálculo puro (IFA/IFM/ISA con base HHT 240.000, incidencia de EL con escala 100.000 según Res. 0312/2019) |
| **Maestro** | Catálogo de 21 KPIs con metas, fórmulas y normativa asociada |
| **Perfil** | Datos del usuario |
| **SUPERADMIN** | Panel fuera del tenant: gestión de planes, suspensión/reactivación, extensión de trial (billing actualmente en pausa por decisión del negocio) |

### Descarga de plantillas oficiales

`components/exportar-plantilla.js` centraliza exportación a Excel (SheetJS) y PDF (jsPDF+autoTable) para los módulos tabulares (matriz de riesgos, matriz EPP, entrega EPP, actas, casos, auditoría). Cuando existe fuente pública confiable (ARL/universidad), agrega botón "Formato oficial" — no se redistribuye la GTC 45 de ICONTEC (es de pago), solo recreaciones libres equivalentes.

---

## Autoregistro y acceso

- **Autoregistro público** (`#register`): crea tenant + usuario ADMIN sin intervención del superadmin, vía Edge Function `registrar-tenant`
- **Modo demo**: botón "Ver demo" con login automático a usuario CONSULTA restringido a empresas de demostración
- **Recuperación de contraseña**: flujo completo vía Supabase Auth (`PASSWORD_RECOVERY`)

---

## Seguridad

Auditoría de seguridad completa realizada 2026-06-15 (hallazgos H1-H15), todos resueltos: XSS, tests con RLS autenticado, protección contra escalamiento de rol/tenant, CSP, límite de resultados en queries, refresco de JWT, InitPlan en políticas RLS, recuperación de contraseña, entre otros.

**Pendiente de infraestructura:** headers HTTP de Cloudflare (X-Frame-Options, HSTS) — requieren dominio personalizado, aún sin definir.

**Bug conocido sin causa raíz identificada:** el `UPDATE` directo vía PostgREST para soft-delete queda bloqueado por RLS en algunas tablas pese a políticas correctas (motivo exacto no determinado tras diagnóstico exhaustivo). Workaround aplicado: funciones `SECURITY DEFINER` (`soft_delete_documento`, `soft_delete_matriz_riesgos`, `soft_delete_acta`) que validan permisos en PL/pgSQL y actualizan como dueño de tabla. Si el mismo síntoma aparece en otra tabla, replicar el patrón en vez de depurar la policy.

---

## Trabajo en curso

- **Ajustes a la firma digital del Gestor Documental** (en progreso) — mecánica de firma sobre PDF (dibujo/imagen/texto + posicionamiento + notas) tiene avances pero requiere refinamiento.

## Pendientes conocidos

- Billing: validaciones de límite de plan/trial construidas pero sin verificar en producción — en pausa por decisión del negocio, no es prioridad actual
- Banner de plan/trial en topbar — no implementado
- Headers HTTP de Cloudflare — requiere dominio personalizado
- Dominio personalizado — sin definir
