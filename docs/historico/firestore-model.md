# SIZO — Modelo Firestore Definitivo
**Versión:** 1.2  
**Fecha:** 2026-06-06  
**Estado:** ✅ APROBADO PARA IMPLEMENTACIÓN

**Cambios v1.2 — 11 correcciones de auditoría:**
- [C1]  Security Rules: regla explícita para subcolección /configuracion/obs/{year}
- [C2]  Queries 6.2 y 6.4: reemplazado where(deletedAt==null) por where(activo==true)
- [C3]  Soft delete (6.8): agrega activo:false al updateDoc
- [C4]  Script de migración: actualizado para escribir obs a subcolección correcta
- [C5]  Tenant (3.1): logoUrl renombrado a logoPath — guardar path, no URL directa
- [C6]  Acciones (3.7): evidencia reemplazado por evidenciaPath + evidenciaNombre + evidenciaTamano
- [C7]  Tenants/usuarios/empresas: actualizadoEn estandarizado a updatedAt; tenant agrega updatedBy
- [C8]  Security Rules: eval_estructura y configuracion usan create/update explícitos + delete:false
- [C9]  Capacitaciones, ausencias, accidentes, auditorias, eval_estructura: campos de auditoría completos
- [C10] scheduledUpdateAccionesVencidas: agrega filtro activo==true y updatedBy:'system'
- [C11] Security Rules: eliminadas funciones isValidTimestamp() y uid() sin uso

**Historial:**
- v1.0 — 2026-06-05: modelo inicial
- v1.1 — 2026-06-06: decisiones arquitectónicas aprobadas (mes 1-12, activo:boolean, etc.)
- v1.2 — 2026-06-06: auditoría final — 11 correcciones aplicadas

---

## Índice

1. [Estrategia multitenant](#1-estrategia-multitenant)
2. [Árbol de colecciones](#2-árbol-de-colecciones)
3. [Esquemas de documentos](#3-esquemas-de-documentos)
4. [Security Rules completas](#4-security-rules-completas)
5. [Índices compuestos](#5-índices-compuestos)
6. [Patrones de query clave](#6-patrones-de-query-clave)
7. [Cloud Functions requeridas](#7-cloud-functions-requeridas)
8. [IDs y convenciones](#8-ids-y-convenciones)
9. [Migración desde localStorage](#9-migración-desde-localstorage)
10. [Variables de entorno](#10-variables-de-entorno)
11. [Firebase Storage — Modelo de archivos](#11-firebase-storage--modelo-de-archivos)

---

## 1. Estrategia Multitenant

### Decisión de arquitectura: Subcollections por tenant

Se eligió el patrón **subcollections por tenant** sobre colecciones planas con campo `tenantId`.

| Criterio | Subcollections (elegida) | Colecciones planas |
|---|---|---|
| Aislamiento de datos | ✅ Garantizado por estructura | ⚠ Depende de rules |
| Security Rules | ✅ `match /tenants/{tenantId}` bloquea todo | ❌ Cada query necesita validar |
| Queries cross-tenant | ❌ Requiere collectionGroup | ✅ Query directa |
| Escalabilidad | ✅ Sin límite de tenants | ✅ Igual |
| Borrado de tenant | ✅ Borra subcollección completa | ❌ Múltiples colecciones |

Los `collectionGroup` queries se usan para consultas de super-admin (exclusivamente por Cloud Functions con admin SDK).

### Jerarquía de autorización

```
Firebase Auth Token
  ├── uid          → identifica el usuario
  ├── tenantId     → determina qué tenant puede ver
  ├── role         → ADMIN | ASESOR | CONSULTA
  └── empresasIds  → array de empIds (ASESOR: N empresas · CONSULTA: exactamente 1)

Security Rules validan:
  request.auth.token.tenantId == tenantId (del path)
```

Los Custom Claims son la **única fuente de verdad** para autorización. Las Security Rules los leen directamente del token sin hacer lecturas adicionales a Firestore.

**Límite operativo:** máximo 35 empresas por ASESOR en V1 (restricción de Custom Claims de 1.000 bytes).

---

## 2. Árbol de Colecciones

```
firestore/
│
├── tenants/                          ← Colección raíz de tenants
│   └── {tenantId}/                   ← Documento del tenant
│       ├── usuarios/                 ← Usuarios del tenant
│       │   └── {userId}
│       ├── empresas/                 ← Empresas cliente
│       │   └── {empresaId}
│       ├── seguimiento/              ← Datos operativos mensuales
│       │   └── {empresaId}_{yyyy}_{mm}
│       ├── accidentes/               ← Registro individual de AT
│       │   └── {atId}
│       ├── ausencias/                ← Registro individual de ausencias
│       │   └── {ausId}
│       ├── acciones/                 ← ACPM (correctivas y preventivas)
│       │   └── {accionId}
│       ├── inspecciones/             ← Inspecciones de seguridad
│       │   └── {insId}
│       ├── capacitaciones/           ← Registro de capacitaciones
│       │   └── {capId}
│       ├── plan_actividades/         ← Plan de trabajo anual
│       │   └── {planId}
│       ├── auditorias/               ← Auditorías y revisión por dirección
│       │   └── {audId}
│       ├── casos_medicos/            ← Casos médicos (acceso ADMIN only)
│       │   └── {casoId}
│       ├── eval_estructura/          ← Evaluación de estándares normativos
│       │   └── {empresaId}_{yyyy}
│       └── configuracion/            ← Config por empresa (metas, fichas)
│           └── {empresaId}
│               └── obs/              ← Observaciones por año (subcolección)
│                   └── {year}
│
└── catalogo/                         ← Datos globales (read-only para todos)
    └── indicadores/
        └── {indKey}                  ← Ficha técnica por defecto de cada indicador
```

---

## 3. Esquemas de Documentos

### 3.1 `/tenants/{tenantId}`

```javascript
{
  // Identificadores
  id:          string,          // Igual al tenantId del path
  nombre:      string,          // "Addy Luna Servicios y Consultorías S.A.S"
  nombreCorto: string,          // "Addy Luna"
  tipo:        "consultora" | "empresa",

  // Plan y estado
  plan:        "starter" | "pro" | "enterprise",
  activo:      boolean,
  trialEnds:   Timestamp | null,

  // Configuración visual
  logoPath:    string | null,   // path en Firebase Storage — resolver con getDownloadURL()
  colorPrimario: string | null, // HEX — override del brand color

  // Contacto del tenant
  email:       string,
  tel:         string | null,
  ciudad:      string | null,

  // Metadata
  creadoEn:    Timestamp,
  updatedAt:   Timestamp,
  updatedBy:   string,          // uid del último que modificó el tenant
  adminUid:    string,          // uid del usuario ADMIN principal
}
```

---

### 3.2 `/tenants/{tenantId}/usuarios/{userId}`

```javascript
{
  // Identidad (userId = Firebase Auth UID)
  uid:         string,
  nombre:      string,          // "Carlos Pérez"
  email:       string,          // lowercase siempre

  // Rol y acceso
  rol:         "ADMIN" | "ASESOR" | "CONSULTA",
  activo:      boolean,
  empresasIds: string[],        // ASESOR: N empresas · CONSULTA: exactamente 1 · ADMIN: []

  // Datos personales opcionales
  tel:         string | null,
  tel2:        string | null,
  bday:        string | null,   // "YYYY-MM-DD"
  linkedin:    string | null,
  ciudad:      string | null,

  // Metadata
  ultimoAcceso:  Timestamp | null,
  creadoEn:      Timestamp,
  updatedAt:     Timestamp,
  updatedBy:     string,        // uid del ADMIN que realizó el último cambio
  creadoPor:     string,        // uid del ADMIN que lo creó
  deletedAt:     Timestamp | null,  // solo auditoría — filtrar con activo:boolean
}
```

**Nota:** La contraseña nunca se guarda en Firestore — exclusivamente en Firebase Auth.

---

### 3.3 `/tenants/{tenantId}/empresas/{empresaId}`

```javascript
{
  id:           string,

  // ── INFORMACIÓN BÁSICA ────────────────────────────────
  nombre:       string,         // Razón social
  nombreCom:    string | null,  // Nombre comercial
  nit:          string | null,
  ciiu:         string | null,  // Código CIIU (4–6 dígitos)
  actividad:    string | null,  // Descripción actividad económica

  // Ubicación
  ciudad:       string,
  dpto:         string | null,
  direccion:    string | null,

  // Contacto
  tel1:         string | null,
  tel2:         string | null,
  email1:       string | null,
  email2:       string | null,

  // Responsables
  repLegal:     string | null,
  bdayRep:      string | null,  // "YYYY-MM-DD"
  respSst:      string | null,
  bdaySst:      string | null,  // "YYYY-MM-DD"
  respAdmin:    string | null,
  obs:          string | null,

  // ── CLASIFICACIÓN SST ─────────────────────────────────
  trab:         number,         // N° trabajadores promedio
  nivelRiesgo:  "I" | "II" | "III" | "IV" | "V",  // Nivel ocupacional
  claseRiesgo:  "I" | "II" | "III" | "IV" | "V",  // Clase ARL
  codArl:       string | null,
  descArl:      string | null,
  arl:          string | null,  // "Positiva" | "SURA" | etc.
  copasst:      "vigia" | "copasst" | null,

  // Asesor asignado
  asesorId:     string | null,  // uid del usuario ASESOR

  // ── CONTRATO ──────────────────────────────────────────
  tipoContrato: "mensual" | "trimestral" | "semestral" | "anual" | "proyecto" | "indefinido" | null,
  frecuencia:   "semanal" | "quincenal" | "mensual" | "bimestral" | "trimestral" | "semestral" | null,
  fechaInicioSst:   string | null,   // "YYYY-MM-DD" — inicio implementación SG-SST
  contratoInicio:   string | null,   // "YYYY-MM-DD"
  contratoFin:      string | null,   // "YYYY-MM-DD" — se usa para alertas de vencimiento

  // ── CENTROS DE TRABAJO ────────────────────────────────
  // Embebido (< 10 centros por empresa en promedio)
  centros: [
    {
      nombre:      string,
      ciudad:      string | null,
      direccion:   string | null,
      actividad:   string | null,
      claseRiesgo: "I" | "II" | "III" | "IV" | "V" | null,
      codArl:      string | null,
      descArl:     string | null,
      trab:        number,
      resp:        string | null,
      contacto:    string | null,
    }
  ],

  // ── METADATA ──────────────────────────────────────────
  activa:        boolean,       // false = soft deleted — usar en queries
  creadoEn:      Timestamp,
  updatedAt:     Timestamp,
  updatedBy:     string,
  creadoPor:     string,        // uid
  deletedAt:     Timestamp | null,  // solo auditoría
}
```

**Campo derivado (NO almacenar):** El nivel Res. 0312/2019 se calcula en el cliente con `nivelRes0312(trab, nivelRiesgo)`.

---

### 3.4 `/tenants/{tenantId}/seguimiento/{empresaId}_{yyyy}_{mm}`

```javascript
// ID compuesto: "e1_2025_5" (mes 1-indexado, Mayo = 5)
{
  // Claves de contexto (para collectionGroup queries)
  empresaId:    string,
  year:         number,         // 2025
  mes:          number,         // 1–12 (enero=1, diciembre=12)

  // ── ACCIDENTALIDAD ────────────────────────────────────
  trab:         number,         // N° trabajadores promedio del mes
  atOc:         number,         // AT ocurridos
  atInv:        number,         // AT investigados en ≤ 15 días hábiles
  atMort:       number,         // AT mortales
  diasIncap:    number,         // Días de incapacidad por AT
  diasCarg:     number,         // Días cargados (muerte = 6000, secuelas según tabla)
  diasIncapAt:  number,         // Días ausentismo exclusivo por AT
  casosEl:      number,         // Casos nuevos enfermedad laboral
  fechaUltimoAt: string | null, // "YYYY-MM-DD" — para cálculo diasSinAT

  // ── AUSENTISMO ────────────────────────────────────────
  diasAus:      number,         // Días ausentismo total (todas causas)
  diasTrab:     number,         // Días de trabajo programados (generalmente 22)

  // ── PLAN DE TRABAJO ───────────────────────────────────
  actProg:      number,         // Actividades programadas
  actEjec:      number,         // Actividades ejecutadas
  ctrlDef:      number,         // Controles IPER definidos
  ctrlImpl:     number,         // Controles IPER implementados

  // ── CAPACITACIÓN ──────────────────────────────────────
  capProg:      number,         // Capacitaciones programadas
  capEjec:      number,         // Capacitaciones ejecutadas
  capAsist:     number,         // Total asistentes

  // ── INSPECCIONES ─────────────────────────────────────
  inspProg:     number,
  inspEjec:     number,

  // ── EVALUACIONES MÉDICAS ──────────────────────────────
  evMedProg:    number,
  evMedEjec:    number,

  // ── SEGUIMIENTO SG-SST ────────────────────────────────
  accGen:       number,         // Acciones generadas en el mes
  accCerr:      number,         // Acciones cerradas en el mes
  accVenc:      number,         // Acciones vencidas acumuladas al cierre del mes
  casosAb:      number,         // Casos médicos abiertos al cierre del mes
  reqAplic:     number,         // Requisitos legales aplicables
  reqCumpl:     number,         // Requisitos legales cumplidos
  objDef:       number,         // Objetivos SST definidos
  objCumpl:     number,         // Objetivos SST cumplidos

  // ── COPASST / VIGÍA ───────────────────────────────────
  copProg:      number,
  copEjec:      number,

  // ── COCOLAB ───────────────────────────────────────────
  colProg:      number,
  colEjec:      number,

  // ── VISITAS DEL ASESOR ────────────────────────────────
  visProg:      number,
  visEjec:      number,

  // ── PLAN DE EMERGENCIAS ───────────────────────────────
  emProg:       number,
  emEjec:       number,

  // ── OBSERVACIONES ────────────────────────────────────
  obs:          string,         // Texto libre del asesor

  // ── METADATA ──────────────────────────────────────────
  completado:   boolean,        // true cuando el asesor marca el mes como cerrado
  updatedAt:    Timestamp,
  updatedBy:    string,         // uid del último que guardó
  creadoEn:     Timestamp,
  creadoPor:    string,
}
```

---

### 3.5 `/tenants/{tenantId}/accidentes/{atId}`

```javascript
{
  id:           string,         // auto-generated
  empresaId:    string,

  // Datos del trabajador
  trabajador:   string,
  cargo:        string | null,
  area:         string | null,
  tipoVinculacion: "directa" | "contratista" | "temporal" | null,

  // Datos del evento
  fecha:        Timestamp,
  hora:         string | null,  // "HH:MM"
  lugar:        string | null,
  descripcion:  string,

  // Clasificación médica
  tipoLesion:   string | null,
  parteAfectada: string | null,
  diasIncapacidad: number,
  esGrave:      boolean,        // Dec. 1072 define "accidente grave"
  esMortal:     boolean,

  // Investigación (plazo: 15 días hábiles — Dec. 1072)
  investigado:         boolean,
  fechaInvestigacion:  Timestamp | null,
  causasInmediatas:    string | null,
  causasBasicas:       string | null,
  factoresPersonales:  string | null,
  factoresTrabajo:     string | null,

  // Acciones derivadas — consultar con where('origenId', '==', atId)

  // Metadata
  activo:       boolean,
  creadoEn:     Timestamp,
  creadoPor:    string,
  updatedAt:    Timestamp,
  updatedBy:    string,
  deletedAt:    Timestamp | null,  // solo auditoría
}
```

---

### 3.6 `/tenants/{tenantId}/ausencias/{ausId}`

```javascript
{
  id:           string,
  empresaId:    string,

  trabajador:   string,
  cargo:        string | null,

  causa:        "AT" | "EL" | "EG" | "licencia_maternidad" | "licencia_paternidad" | "licencia_luto" | "licencia_remunerada" | "otra",
  diagnostico:  string | null,
  certificado:  boolean,

  fechaInicio:  Timestamp,
  fechaFin:     Timestamp | null,
  dias:         number,         // Se calcula automáticamente

  obs:          string | null,

  // Metadata
  activo:       boolean,
  creadoEn:     Timestamp,
  creadoPor:    string,
  updatedAt:    Timestamp,
  updatedBy:    string,
  deletedAt:    Timestamp | null,  // solo auditoría
}
```

---

### 3.7 `/tenants/{tenantId}/acciones/{accionId}`

```javascript
{
  id:           string,
  empresaId:    string,

  // Clasificación
  tipo:         "correctiva" | "preventiva" | "mejora",
  origen:       "inspeccion" | "accidente" | "auditoria" | "seguimiento" | "revision_direccion" | "otro",
  origenId:     string | null,  // ref al documento origen

  // Contenido
  descripcion:  string,
  responsable:  string,
  fechaLimite:  Timestamp,
  prioridad:    "alta" | "media" | "baja",

  // Estado
  estado:       "abierta" | "en_progreso" | "cerrada" | "vencida",
  fechaCierre:  Timestamp | null,

  // Evidencia de cierre — guardar path, no URL directa
  evidenciaPath:    string | null,   // path en Firebase Storage
  evidenciaNombre:  string | null,   // nombre original del archivo para display
  evidenciaTamano:  number | null,   // tamaño en bytes

  obs:          string | null,

  // Metadata
  activo:       boolean,
  creadoEn:     Timestamp,
  creadoPor:    string,
  updatedAt:    Timestamp,
  updatedBy:    string,
  deletedAt:    Timestamp | null,  // solo auditoría
}
```

**Nota:** El estado `vencida` lo actualiza `scheduledUpdateAccionesVencidas` diariamente.

---

### 3.8 `/tenants/{tenantId}/inspecciones/{insId}`

```javascript
{
  id:           string,
  empresaId:    string,

  fecha:        Timestamp,
  area:         string,
  inspector:    string,         // Nombre del inspector
  tipo:         "planeada" | "no_planeada",

  hallazgos: [
    {
      descripcion:  string,
      condicion:    "segura" | "insegura",
      riesgo:       "bajo" | "medio" | "alto" | "critico",
      accionRequerida: boolean,
    }
  ],

  calificacion: number,         // 0–100
  obs:          string | null,
  // accionesIds eliminado — consultar acciones con where('origenId', '==', insId)

  // Metadata
  activo:       boolean,
  creadoEn:     Timestamp,
  creadoPor:    string,
  updatedAt:    Timestamp,
  updatedBy:    string,
  deletedAt:    Timestamp | null,  // solo auditoría
}
```

---

### 3.9 `/tenants/{tenantId}/capacitaciones/{capId}`

```javascript
{
  id:           string,
  empresaId:    string,

  tema:         string,
  fecha:        Timestamp,
  duracion:     number,         // Horas
  instructor:   string,
  modalidad:    "presencial" | "virtual" | "mixta",
  asistentes:   number,
  metodologia:  string | null,

  // Evaluación de eficacia
  evaluada:     boolean,
  notaPromedio: number | null,  // 0–5

  obs:          string | null,

  // Metadata
  activo:       boolean,
  creadoEn:     Timestamp,
  creadoPor:    string,
  updatedAt:    Timestamp,
  updatedBy:    string,
  deletedAt:    Timestamp | null,  // solo auditoría
}
```

---

### 3.10 `/tenants/{tenantId}/plan_actividades/{planId}`

```javascript
{
  id:           string,
  empresaId:    string,
  year:         number,

  actividad:    string,
  componente:   "politica" | "planificacion" | "implementacion" | "verificacion" | "mejora",
  mes:          number,         // 1–12 (mes programado)
  responsable:  string,
  presupuesto:  number | null,  // COP

  estado:       "pendiente" | "en_progreso" | "completada" | "cancelada",
  obs:          string | null,

  // Metadata
  activo:       boolean,
  creadoEn:     Timestamp,
  creadoPor:    string,
  updatedAt:    Timestamp,
  updatedBy:    string,
  deletedAt:    Timestamp | null,  // solo auditoría
}
```

---

### 3.11 `/tenants/{tenantId}/auditorias/{audId}`

```javascript
{
  id:           string,
  empresaId:    string,
  year:         number,

  tipo:         "interna" | "externa",
  fecha:        Timestamp,
  auditor:      string,
  alcance:      string | null,

  // Resultados — mapeados a los 11 estándares de estructura
  evaluaciones: {
    // key = "E01" ... "E11"
    [estructuraId: string]: {
      criterios:  boolean[],    // Array de boolean por criterio (max 6)
      obs:        string | null,
    }
  },

  puntajeGlobal: number,        // 0–100 calculado en cliente
  hallazgos:     string | null,
  compromisos:   string | null,
  // accionesIds eliminado — consultar acciones con where('origenId', '==', audId)

  estado:       "pendiente" | "en_proceso" | "completada",
  obs:          string | null,

  // Metadata
  activo:       boolean,
  creadoEn:     Timestamp,
  creadoPor:    string,
  updatedAt:    Timestamp,
  updatedBy:    string,
  deletedAt:    Timestamp | null,  // solo auditoría
}
```

---

### 3.12 `/tenants/{tenantId}/casos_medicos/{casoId}`

```javascript
{
  id:           string,
  empresaId:    string,

  trabajador:   string,
  cargo:        string | null,

  tipo:         "AT" | "EL" | "EG",
  diagnostico:  string,
  cie10:        string | null,  // Código CIE-10

  fechaApertura: Timestamp,
  fechaCierre:   Timestamp | null,
  estado:        "abierto" | "en_seguimiento" | "cerrado",

  restricciones: string | null,
  reubicacion:   boolean,
  obs:           string | null,

  // Metadata
  activo:       boolean,
  creadoEn:     Timestamp,
  creadoPor:    string,         // Solo ADMIN puede crear
  updatedAt:    Timestamp,
  updatedBy:    string,
  deletedAt:    Timestamp | null,  // solo auditoría
}
```

---

### 3.13 `/tenants/{tenantId}/eval_estructura/{empresaId}_{yyyy}`

```javascript
// ID compuesto: "e1_2025"
{
  empresaId:    string,
  year:         number,

  evaluaciones: {
    E01: { criterios: [true, false, true, true, false, true], obs: string | null },
    E02: { criterios: [true, true, false, true, true, false], obs: string | null },
    // ... E01 a E11
  },

  puntajeGlobal: number,        // Calculado en cliente al guardar

  // Metadata
  activo:       boolean,
  creadoEn:     Timestamp,
  creadoPor:    string,
  updatedAt:    Timestamp,
  updatedBy:    string,
}
```

---

### 3.14 `/tenants/{tenantId}/configuracion/{empresaId}`

```javascript
// Un documento de configuración por empresa
// Solo almacena overrides — si una clave no existe se usan los valores del catálogo global
{
  empresaId:    string,

  // Metas personalizadas por indicador
  metasCustom: {
    // key = indKey ("ifa", "aus", "plan", etc.)
    [indKey: string]: {
      metaNum: number,          // Valor numérico de la meta
      inv:     boolean,         // true = menor es mejor
    }
  },

  // Sobrescritura de fichas técnicas
  fichaCustom: {
    [indKey: string]: {
      nom:           string | null,
      tipo:          string | null,
      normativa:     string | null,
      periodicidad:  string | null,
      formula:       string | null,
      meta:          string | null,
      fuente:        string | null,
      umbral:        string | null,
      responsable:   string | null,
      evidencia:     string | null,
      interp:        string | null,
    }
  },

  // Resultados del año anterior (referencia de tendencia)
  resAnteriores: {
    [indKey: string]: {
      valor: number,
      year:  string,            // "2024"
    }
  },

  // Las observaciones por indicador van en la subcolección obs/{year}
  // para evitar crecimiento indefinido de este documento

  updatedAt:    Timestamp,
  updatedBy:    string,
}
```

---

### 3.15 `/tenants/{tenantId}/configuracion/{empresaId}/obs/{year}`

```javascript
// Subcolección de observaciones — un documento por año por empresa
// Reemplaza el campo obsIndicadores que existía en el documento raíz
{
  empresaId:  string,
  year:       number,           // 2025

  // key = indKey ("ifa", "aus", "plan", etc.)
  obs: {
    [indKey: string]: string,   // Observación libre del asesor, máx ~500 chars
  },

  updatedAt:  Timestamp,
  updatedBy:  string,
}
```

---

### 3.16 `/catalogo/indicadores/{indKey}` (global, read-only)

```javascript
// Ficha técnica por defecto — misma para todos los tenants
// Solo se modifica por Webcore Solutions vía admin SDK
{
  indKey:       string,         // "ifa", "aus", "plan", etc.
  nom:          string,
  tipo:         "Resultado" | "Proceso" | "Base",
  normativa:    string,         // "Dec. 1072/2015 Art. X"
  periodicidad: "Mensual" | "Trimestral" | "Semestral" | "Anual",
  formula:      string,         // "AT ocurridos / N° trabajadores × 100"
  meta:         string,         // Descripción textual de la meta
  metaNum:      number | null,  // Valor numérico por defecto
  inv:          boolean,        // Dirección del semáforo (true = menor es mejor)
  fuente:       string,
  umbral:       string,
  responsable:  string,
  evidencia:    string,
  interp:       string,
  orden:        number,         // Para ordenar en el Maestro
}
```

---

## 4. Security Rules Completas

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── HELPERS ──────────────────────────────────────────────────────────
    function isAuth() {
      return request.auth != null;
    }

    function tenantClaim() {
      return request.auth.token.tenantId;
    }

    function roleClaim() {
      return request.auth.token.role;
    }

    function empresasClaim() {
      return request.auth.token.empresasIds;
    }

    function isAdmin() {
      return roleClaim() == 'ADMIN';
    }

    function isAsesor() {
      return roleClaim() == 'ASESOR';
    }

    function isConsulta() {
      return roleClaim() == 'CONSULTA';
    }

    function belongsToTenant(tenantId) {
      return tenantClaim() == tenantId;
    }

    function canReadEmpresa(empresaId) {
      return isAdmin() ||
             (empresasClaim() is list && empresasClaim().hasAny([empresaId]));
    }

    function canWriteEmpresaData(empresaId) {
      return isAdmin() || (isAsesor() && empresasClaim() is list
                           && empresasClaim().hasAny([empresaId]));
    }

    // ── CATÁLOGO GLOBAL (read-only para todos los autenticados) ───────────
    match /catalogo/{doc=**} {
      allow read:  if isAuth();
      allow write: if false;    // Solo admin SDK (Cloud Functions)
    }

    // ── TENANTS ───────────────────────────────────────────────────────────
    match /tenants/{tenantId} {
      allow read:   if isAuth() && belongsToTenant(tenantId);
      allow write:  if false;   // Solo Cloud Functions con admin SDK

      // ── USUARIOS ────────────────────────────────────────────────────────
      match /usuarios/{userId} {
        allow read:   if isAuth() && belongsToTenant(tenantId);
        allow create: if isAuth() && belongsToTenant(tenantId) && isAdmin()
                      && request.resource.data.keys().hasAll(['uid','nombre','email','rol','activo'])
                      && request.resource.data.rol in ['ADMIN','ASESOR','CONSULTA'];
        allow update: if isAuth() && belongsToTenant(tenantId) && isAdmin()
                      && !request.resource.data.diff(resource.data).affectedKeys()
                         .hasAny(['uid','creadoEn','creadoPor']);
        allow delete: if false;
      }

      // ── EMPRESAS ─────────────────────────────────────────────────────────
      match /empresas/{empresaId} {
        allow read:   if isAuth() && belongsToTenant(tenantId) && canReadEmpresa(empresaId);
        allow create: if isAuth() && belongsToTenant(tenantId) && isAdmin()
                      && request.resource.data.keys().hasAll(['nombre','trab','nivelRiesgo','activa']);
        allow update: if isAuth() && belongsToTenant(tenantId) && isAdmin();
        allow delete: if false;
      }

      // ── SEGUIMIENTO ───────────────────────────────────────────────────────
      match /seguimiento/{segId} {
        allow read:   if isAuth() && belongsToTenant(tenantId)
                      && canReadEmpresa(resource.data.empresaId);
        allow create: if isAuth() && belongsToTenant(tenantId)
                      && canWriteEmpresaData(request.resource.data.empresaId)
                      && request.resource.data.keys().hasAll(['empresaId','year','mes']);
        allow update: if isAuth() && belongsToTenant(tenantId)
                      && canWriteEmpresaData(resource.data.empresaId)
                      && !request.resource.data.diff(resource.data).affectedKeys()
                         .hasAny(['empresaId','year','mes','creadoEn','creadoPor']);
        allow delete: if false;
      }

      // ── ACCIDENTES ────────────────────────────────────────────────────────
      match /accidentes/{atId} {
        allow read:   if isAuth() && belongsToTenant(tenantId)
                      && canReadEmpresa(resource.data.empresaId);
        allow create: if isAuth() && belongsToTenant(tenantId)
                      && canWriteEmpresaData(request.resource.data.empresaId);
        allow update: if isAuth() && belongsToTenant(tenantId)
                      && canWriteEmpresaData(resource.data.empresaId);
        allow delete: if false;
      }

      // ── AUSENCIAS ─────────────────────────────────────────────────────────
      match /ausencias/{ausId} {
        allow read:   if isAuth() && belongsToTenant(tenantId)
                      && canReadEmpresa(resource.data.empresaId);
        allow create: if isAuth() && belongsToTenant(tenantId)
                      && canWriteEmpresaData(request.resource.data.empresaId);
        allow update: if isAuth() && belongsToTenant(tenantId)
                      && canWriteEmpresaData(resource.data.empresaId);
        allow delete: if false;
      }

      // ── ACCIONES ──────────────────────────────────────────────────────────
      match /acciones/{accionId} {
        allow read:   if isAuth() && belongsToTenant(tenantId)
                      && canReadEmpresa(resource.data.empresaId);
        allow create: if isAuth() && belongsToTenant(tenantId)
                      && canWriteEmpresaData(request.resource.data.empresaId)
                      && !isConsulta();
        allow update: if isAuth() && belongsToTenant(tenantId)
                      && canWriteEmpresaData(resource.data.empresaId)
                      && !isConsulta()
                      && !request.resource.data.diff(resource.data).affectedKeys()
                         .hasAny(['creadoEn','creadoPor','empresaId']);
        allow delete: if false;
      }

      // ── INSPECCIONES ──────────────────────────────────────────────────────
      match /inspecciones/{insId} {
        allow read:   if isAuth() && belongsToTenant(tenantId)
                      && canReadEmpresa(resource.data.empresaId);
        allow create: if isAuth() && belongsToTenant(tenantId)
                      && canWriteEmpresaData(request.resource.data.empresaId);
        allow update: if isAuth() && belongsToTenant(tenantId)
                      && canWriteEmpresaData(resource.data.empresaId);
        allow delete: if false;
      }

      // ── CAPACITACIONES ────────────────────────────────────────────────────
      match /capacitaciones/{capId} {
        allow read:   if isAuth() && belongsToTenant(tenantId)
                      && canReadEmpresa(resource.data.empresaId);
        allow create: if isAuth() && belongsToTenant(tenantId)
                      && canWriteEmpresaData(request.resource.data.empresaId);
        allow update: if isAuth() && belongsToTenant(tenantId)
                      && canWriteEmpresaData(resource.data.empresaId);
        allow delete: if false;
      }

      // ── PLAN ACTIVIDADES ──────────────────────────────────────────────────
      match /plan_actividades/{planId} {
        allow read:   if isAuth() && belongsToTenant(tenantId)
                      && canReadEmpresa(resource.data.empresaId);
        allow create: if isAuth() && belongsToTenant(tenantId)
                      && canWriteEmpresaData(request.resource.data.empresaId);
        allow update: if isAuth() && belongsToTenant(tenantId)
                      && canWriteEmpresaData(resource.data.empresaId);
        allow delete: if false;
      }

      // ── AUDITORÍAS ────────────────────────────────────────────────────────
      match /auditorias/{audId} {
        allow read:   if isAuth() && belongsToTenant(tenantId)
                      && canReadEmpresa(resource.data.empresaId);
        allow create: if isAuth() && belongsToTenant(tenantId)
                      && canWriteEmpresaData(request.resource.data.empresaId);
        allow update: if isAuth() && belongsToTenant(tenantId)
                      && canWriteEmpresaData(resource.data.empresaId);
        allow delete: if false;
      }

      // ── CASOS MÉDICOS (ADMIN only) ────────────────────────────────────────
      match /casos_medicos/{casoId} {
        allow read:   if isAuth() && belongsToTenant(tenantId) && isAdmin();
        allow create: if isAuth() && belongsToTenant(tenantId) && isAdmin();
        allow update: if isAuth() && belongsToTenant(tenantId) && isAdmin();
        allow delete: if false;
      }

      // ── EVALUACIÓN ESTRUCTURA ─────────────────────────────────────────────
      match /eval_estructura/{evalId} {
        allow read:   if isAuth() && belongsToTenant(tenantId)
                      && canReadEmpresa(resource.data.empresaId);
        allow create: if isAuth() && belongsToTenant(tenantId) && isAdmin();
        allow update: if isAuth() && belongsToTenant(tenantId) && isAdmin();
        allow delete: if false;
      }

      // ── CONFIGURACIÓN ─────────────────────────────────────────────────────
      match /configuracion/{empresaId} {
        allow read:   if isAuth() && belongsToTenant(tenantId)
                      && canReadEmpresa(empresaId);
        allow create: if isAuth() && belongsToTenant(tenantId) && isAdmin();
        allow update: if isAuth() && belongsToTenant(tenantId) && isAdmin();
        allow delete: if false;

        // ── OBSERVACIONES POR AÑO (subcolección) ─────────────────────────
        match /obs/{year} {
          allow read:   if isAuth() && belongsToTenant(tenantId)
                        && canReadEmpresa(empresaId);
          allow create: if isAuth() && belongsToTenant(tenantId)
                        && canWriteEmpresaData(empresaId);
          allow update: if isAuth() && belongsToTenant(tenantId)
                        && canWriteEmpresaData(empresaId);
          allow delete: if false;
        }
      }

    } // end /tenants/{tenantId}

  } // end /databases
} // end service
```

---

## 5. Índices Compuestos

Definir en `firestore.indexes.json` antes de desplegar:

```json
{
  "indexes": [
    {
      "collectionGroup": "seguimiento",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "empresaId", "order": "ASCENDING" },
        { "fieldPath": "year",      "order": "ASCENDING" },
        { "fieldPath": "mes",       "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "accidentes",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "empresaId", "order": "ASCENDING" },
        { "fieldPath": "activo",    "order": "ASCENDING" },
        { "fieldPath": "fecha",     "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "accidentes",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "empresaId",   "order": "ASCENDING" },
        { "fieldPath": "investigado", "order": "ASCENDING" },
        { "fieldPath": "activo",      "order": "ASCENDING" },
        { "fieldPath": "fecha",       "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "acciones",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "empresaId", "order": "ASCENDING" },
        { "fieldPath": "activo",    "order": "ASCENDING" },
        { "fieldPath": "estado",    "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "acciones",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "empresaId",   "order": "ASCENDING" },
        { "fieldPath": "activo",      "order": "ASCENDING" },
        { "fieldPath": "fechaLimite", "order": "ASCENDING" },
        { "fieldPath": "estado",      "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "ausencias",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "empresaId",   "order": "ASCENDING" },
        { "fieldPath": "activo",      "order": "ASCENDING" },
        { "fieldPath": "fechaInicio", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "inspecciones",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "empresaId", "order": "ASCENDING" },
        { "fieldPath": "activo",    "order": "ASCENDING" },
        { "fieldPath": "fecha",     "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "capacitaciones",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "empresaId", "order": "ASCENDING" },
        { "fieldPath": "activo",    "order": "ASCENDING" },
        { "fieldPath": "fecha",     "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "plan_actividades",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "empresaId", "order": "ASCENDING" },
        { "fieldPath": "year",      "order": "ASCENDING" },
        { "fieldPath": "mes",       "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "auditorias",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "empresaId", "order": "ASCENDING" },
        { "fieldPath": "activo",    "order": "ASCENDING" },
        { "fieldPath": "fecha",     "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "empresas",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "asesorId", "order": "ASCENDING" },
        { "fieldPath": "activa",   "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "empresas",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "activa",      "order": "ASCENDING" },
        { "fieldPath": "contratoFin", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "acciones",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "empresaId", "order": "ASCENDING" },
        { "fieldPath": "activo",    "order": "ASCENDING" },
        { "fieldPath": "estado",    "order": "ASCENDING" },
        { "fieldPath": "prioridad", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "seguimiento",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "empresaId",  "order": "ASCENDING" },
        { "fieldPath": "year",       "order": "ASCENDING" },
        { "fieldPath": "completado", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "casos_medicos",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "empresaId",    "order": "ASCENDING" },
        { "fieldPath": "activo",       "order": "ASCENDING" },
        { "fieldPath": "estado",       "order": "ASCENDING" },
        { "fieldPath": "fechaApertura","order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "ausencias",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "empresaId",  "order": "ASCENDING" },
        { "fieldPath": "activo",     "order": "ASCENDING" },
        { "fieldPath": "causa",      "order": "ASCENDING" },
        { "fieldPath": "fechaInicio","order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

---

## 6. Patrones de Query Clave

### 6.1 Cargar seguimiento anual de una empresa

```javascript
// Carga los 12 documentos del año con IDs directos (O(1) por documento)
// mes es 1-indexado: enero=1 ... diciembre=12
const ids = Array.from({length: 12}, (_, i) => `${empresaId}_2025_${i + 1}`)
const docs = await Promise.all(
  ids.map(id => getDoc(doc(db, `tenants/${tenantId}/seguimiento`, id)))
)

// O con query por campo (requiere índice compuesto empresaId+year):
const q = query(
  collection(db, `tenants/${tenantId}/seguimiento`),
  where('empresaId', '==', empresaId),
  where('year', '==', 2025)
)
```

### 6.2 Dashboard — cargar todas las empresas del tenant (ADMIN)

```javascript
// [C2] Filtrar por activa:boolean, no por deletedAt
const q = query(
  collection(db, `tenants/${tenantId}/empresas`),
  where('activa', '==', true)
)
onSnapshot(q, snapshot => { /* actualizar estado */ })
```

### 6.3 Dashboard — cargar empresas del asesor

```javascript
// empresasIds viene de Custom Claims — disponible sin query adicional
const tokenResult = await auth.currentUser.getIdTokenResult()
const ids = tokenResult.claims.empresasIds  // ['e1','e3','e4']
const docs = await Promise.all(
  ids.map(id => getDoc(doc(db, `tenants/${tenantId}/empresas`, id)))
)
```

### 6.4 Alertas — acciones vencidas globales

```javascript
// [C2] Filtrar por activo:boolean, no por deletedAt
const q = query(
  collection(db, `tenants/${tenantId}/acciones`),
  where('activo', '==', true),
  where('estado', '==', 'vencida')
)
```

### 6.5 Acciones próximas a vencer (7 días)

```javascript
const ahora   = Timestamp.now()
const en7dias = Timestamp.fromDate(new Date(Date.now() + 7 * 864e5))

const q = query(
  collection(db, `tenants/${tenantId}/acciones`),
  where('empresaId', '==', empresaId),
  where('activo',    '==', true),
  where('estado',    'in', ['abierta', 'en_progreso']),
  where('fechaLimite', '<=', en7dias),
  where('fechaLimite', '>=', ahora)
)
```

### 6.6 AT sin investigar en más de 15 días

```javascript
const hace15dias = Timestamp.fromDate(new Date(Date.now() - 15 * 864e5))

const q = query(
  collection(db, `tenants/${tenantId}/accidentes`),
  where('empresaId',   '==', empresaId),
  where('activo',      '==', true),
  where('investigado', '==', false),
  where('fecha',       '<=', hace15dias)
)
```

### 6.7 Guardar seguimiento mensual (upsert con ID compuesto)

```javascript
// mes es 1-indexado: Mayo = 5
const segId = `${empresaId}_${year}_${mes}`
const ref   = doc(db, `tenants/${tenantId}/seguimiento`, segId)

await setDoc(ref, {
  empresaId, year, mes,
  // ... todos los campos numéricos
  updatedAt: serverTimestamp(),
  updatedBy: auth.currentUser.uid,
  creadoEn:  serverTimestamp(),   // ignorado en updates por merge:true
  creadoPor: auth.currentUser.uid,
}, { merge: true })
```

### 6.8 Soft delete de un documento

```javascript
// [C3] El soft delete SIEMPRE actualiza activo:false
await updateDoc(
  doc(db, `tenants/${tenantId}/acciones`, accionId),
  {
    activo:    false,                  // ← filtro de queries
    deletedAt: serverTimestamp(),      // ← solo auditoría
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid,
  }
)

// Las queries usan: where('activo', '==', true)
// deletedAt NO se usa en queries
```

### 6.9 Leer/escribir observaciones de indicadores

```javascript
// Leer observaciones del año activo
const obsRef = doc(db, `tenants/${tenantId}/configuracion/${empresaId}/obs/${year}`)
const obsSnap = await getDoc(obsRef)
const obs = obsSnap.exists() ? obsSnap.data().obs : {}

// Guardar observación de un indicador
await setDoc(obsRef, {
  empresaId,
  year,
  obs: { ...obs, [indKey]: textoObservacion },
  updatedAt: serverTimestamp(),
  updatedBy: auth.currentUser.uid,
}, { merge: true })
```

---

## 7. Cloud Functions Requeridas

### 7.1 `createTenant` (HTTPS Callable)

```javascript
// Input
{
  tenantNombre: string,
  tipo:         'consultora' | 'empresa',
  plan:         string,
  adminNombre:  string,
  adminEmail:   string,
  adminPassword: string
}

// Proceso:
// 1. Generar tenantId (UUID)
// 2. Crear documento /tenants/{tenantId}
// 3. Crear usuario en Firebase Auth
// 4. Setear Custom Claims: { tenantId, role: 'ADMIN', empresasIds: [] }
// 5. Crear documento /tenants/{tenantId}/usuarios/{uid}

// Output: { tenantId, uid }
```

### 7.2 `createUser` (HTTPS Callable — ADMIN only)

```javascript
// Input
{ nombre, email, password, rol, empresasIds }

// Proceso:
// 1. Verificar que el caller es ADMIN del tenant (via context.auth.token.role)
// 2. Crear usuario en Firebase Auth
// 3. Setear Custom Claims: { tenantId: caller.tenantId, role: rol, empresasIds }
// 4. Crear documento /tenants/{tenantId}/usuarios/{uid}

// Output: { uid }
```

### 7.3 `deactivateUser` (HTTPS Callable — ADMIN only)

```javascript
// Input: { userId }
// Proceso:
// 1. Revocar tokens: admin.auth().revokeRefreshTokens(userId)
// 2. Deshabilitar en Auth: admin.auth().updateUser(userId, { disabled: true })
// 3. Actualizar Firestore: { activo: false, deletedAt: now, updatedAt: now, updatedBy: callerUid }
// NOTA: El ID token actual sigue válido hasta ~1 hora — comportamiento conocido de Firebase Auth
```

### 7.4 `updateUserEmpresas` (HTTPS Callable — ADMIN only)

```javascript
// Input: { userId, empresasIds: string[] }
// Proceso:
// 1. Validar que empresasIds.length <= 35 (límite de Custom Claims)
// 2. Actualizar Custom Claims en Firebase Auth
// 3. Actualizar campo empresasIds en /usuarios/{userId}
// 4. Revocar tokens para forzar refresh en el próximo login
```

### 7.5 `scheduledUpdateAccionesVencidas` (Scheduled — diaria)

```javascript
// Cron: cada día a las 00:15 (Colombia UTC-5 = 05:15 UTC)
// Proceso:
// 1. collectionGroup query sobre todas las acciones donde:
//    activo == true                             ← [C10] filtrar solo activas
//    AND estado in ['abierta', 'en_progreso']
//    AND fechaLimite < hoy
// 2. Actualizar cada una:
//    { estado: 'vencida', updatedAt: now, updatedBy: 'system' }  ← [C10] updatedBy
// 3. Loguear conteo en Cloud Logging
```

### 7.6 `scheduledContratoAlerts` (Scheduled — diaria)

```javascript
// Cron: cada día a las 08:00 (Colombia)
// Proceso:
// 1. Buscar empresas activas con contratoFin entre hoy y +30 días
// 2. Loguear en Cloud Logging (V1) — enviar email al ADMIN del tenant en V2
```

---

## 8. IDs y Convenciones

### Reglas de naming

| Colección | Tipo de ID | Formato | Ejemplo |
|---|---|---|---|
| `tenants` | Auto-generado | `auto` | `t7k2mN9p...` |
| `usuarios` | Firebase Auth UID | `uid` | `xKj2...` |
| `empresas` | Auto-generado | `auto` | `e1k9...` |
| `seguimiento` | Compuesto determinístico | `{empId}_{yyyy}_{mm}` | `e1_2025_5` (Mayo) |
| `eval_estructura` | Compuesto determinístico | `{empId}_{yyyy}` | `e1_2025` |
| `configuracion` | ID de empresa | `{empId}` | `e1k9...` |
| `configuracion/obs` | Año | `{year}` | `2025` |
| Resto | Auto-generado | `auto` | `a8f3...` |

**Nunca usar `Math.random()` para IDs** — usar siempre `addDoc()` de Firebase.

### Convenciones de campos

| Tipo | Convención | Ejemplo |
|---|---|---|
| Timestamps | `Timestamp` de Firebase | `serverTimestamp()` |
| Fechas sin hora | `string "YYYY-MM-DD"` | `"2025-06-05"` |
| Filtro activo | `activo: boolean` — **usar en queries** | `where('activo', '==', true)` |
| Soft delete | `deletedAt: Timestamp\|null` — **solo auditoría, nunca en queries** | `deletedAt: serverTimestamp()` |
| Campos de auditoría | Siempre presentes en todos los documentos | `creadoEn`, `creadoPor`, `updatedAt`, `updatedBy` |
| Arrays vacíos | `[]` en vez de `null` | `empresasIds: []` |
| Strings vacíos | `null` en vez de `""` | `obs: null` |
| Numbers sin dato | `0` (nunca `null` para operaciones matemáticas) | `atOc: 0` |
| Mes | Siempre 1–12 (1-indexado) | `mes: 5` = Mayo |
| Paginación | `pageSize = 25` en todas las listas | `limit(25)` + `startAfter(cursor)` |
| updatedBy en sistema | `'system'` para operaciones automáticas | Cloud Functions scheduled |

### Soft delete — patrón único

```javascript
// SIEMPRE los dos campos juntos:
{ activo: false, deletedAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: uid }

// NUNCA solo uno de los dos
```

---

## 9. Migración desde localStorage

### 9.1 Script de migración

```javascript
// migration.js — ejecutar UNA sola vez con admin SDK
const admin = require('firebase-admin')
admin.initializeApp({ credential: admin.credential.cert('./service-account.json') })
const db = admin.firestore()

async function migrate(tenantId, localStorageData) {
  const S = JSON.parse(localStorageData)

  // Firestore tiene límite de 500 ops por batch
  const batch = db.batch()

  // 1. Usuarios
  for (const [uid_local, u] of Object.entries(S.usuarios)) {
    const ref = db.doc(`tenants/${tenantId}/usuarios/${uid_local}`)
    batch.set(ref, {
      uid:         uid_local,
      nombre:      u.nombre,
      email:       u.email.toLowerCase(),
      rol:         u.rol,
      activo:      u.activo ?? true,
      empresasIds: u.empresas || [],
      tel:         u.tel || null,
      ultimoAcceso: u.ultimo_acceso ? new Date(u.ultimo_acceso) : null,
      creadoEn:    admin.firestore.FieldValue.serverTimestamp(),
      updatedAt:   admin.firestore.FieldValue.serverTimestamp(),
      updatedBy:   'migration',
      creadoPor:   'migration',
      deletedAt:   null,
    })
  }

  // 2. Empresas
  for (const [empId, c] of Object.entries(S.clientes)) {
    const ref = db.doc(`tenants/${tenantId}/empresas/${empId}`)
    batch.set(ref, {
      id:          empId,
      nombre:      c.nombre,
      nombreCom:   c.nombre_com || null,
      nit:         c.nit || null,
      // ... mapear todos los campos snake_case → camelCase
      activa:      c.activa ?? true,
      centros:     c.centros || [],
      creadoEn:    admin.firestore.FieldValue.serverTimestamp(),
      updatedAt:   admin.firestore.FieldValue.serverTimestamp(),
      updatedBy:   'migration',
      creadoPor:   'migration',
      deletedAt:   null,
    })
  }

  // 3. Seguimiento
  for (const [key, data] of Object.entries(S.seguimiento)) {
    const [empId, year, mes] = key.split('|')
    const segId = `${empId}_${year}_${mes}`
    const ref   = db.doc(`tenants/${tenantId}/seguimiento/${segId}`)
    batch.set(ref, {
      empresaId: empId, year: parseInt(year), mes: parseInt(mes),
      trab: data.trab || 0, atOc: data.at_oc || 0,
      // ... mapear todos los campos
      creadoEn:  admin.firestore.FieldValue.serverTimestamp(),
      creadoPor: 'migration',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'migration',
    })
  }

  // 4. Configuración raíz (metas y fichas custom — SIN obsIndicadores)
  for (const empId of Object.keys(S.clientes)) {
    const ref = db.doc(`tenants/${tenantId}/configuracion/${empId}`)
    batch.set(ref, {
      empresaId:     empId,
      metasCustom:   S.metas_custom  || {},
      fichaCustom:   S.ficha_custom  || {},
      resAnteriores: S.res_anteriores || {},
      updatedAt:     admin.firestore.FieldValue.serverTimestamp(),
      updatedBy:     'migration',
    })
  }

  await batch.commit()

  // [C4] 5. Observaciones — escribir a subcolección /obs/{year}
  // Procesar separado porque puede superar el límite de 500 ops del batch
  if (S.obs_ind) {
    const obsBatch = db.batch()
    // S.obs_ind tiene claves tipo "empId|year|indKey"
    const byEmpYear = {}
    for (const [key, texto] of Object.entries(S.obs_ind)) {
      const [empId, year, indKey] = key.split('|')
      const mapKey = `${empId}__${year}`
      if (!byEmpYear[mapKey]) byEmpYear[mapKey] = { empId, year, obs: {} }
      byEmpYear[mapKey].obs[indKey] = texto
    }
    for (const { empId, year, obs } of Object.values(byEmpYear)) {
      const ref = db.doc(`tenants/${tenantId}/configuracion/${empId}/obs/${year}`)
      obsBatch.set(ref, {
        empresaId: empId,
        year:      parseInt(year),
        obs,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: 'migration',
      })
    }
    await obsBatch.commit()
  }

  console.log('Migración completada')
}
```

### 9.2 Checklist de migración

- [ ] Crear tenant en Firestore con `createTenant` Cloud Function
- [ ] Crear usuarios en Firebase Auth y obtener nuevos UIDs
- [ ] Actualizar Custom Claims de cada usuario
- [ ] Ejecutar script de migración con admin SDK
- [ ] Verificar integridad: contar documentos migrados vs fuente
- [ ] Verificar subcolección obs: comprobar que cada año/empresa tiene su documento
- [ ] Probar login con cada rol (ADMIN, ASESOR, CONSULTA)
- [ ] Verificar que Security Rules bloquean accesos no autorizados
- [ ] Desactivar el prototipo HTML original

---

## 10. Variables de Entorno

### `.env.development`

```bash
FIREBASE_API_KEY=AIza...
FIREBASE_AUTH_DOMAIN=sizo-dev.firebaseapp.com
FIREBASE_PROJECT_ID=sizo-dev
FIREBASE_STORAGE_BUCKET=sizo-dev.appspot.com
FIREBASE_MESSAGING_SENDER_ID=000000000000
FIREBASE_APP_ID=1:000000000000:web:xxx
```

### `.env.production`

```bash
FIREBASE_API_KEY=AIza...
FIREBASE_AUTH_DOMAIN=sizo-prod.firebaseapp.com
FIREBASE_PROJECT_ID=sizo-prod
FIREBASE_STORAGE_BUCKET=sizo-prod.appspot.com
FIREBASE_MESSAGING_SENDER_ID=111111111111
FIREBASE_APP_ID=1:111111111111:web:yyy
```

### `firebase.js` — inicialización

```javascript
import { initializeApp }             from 'firebase/app'
import { getAuth, setPersistence,
         browserLocalPersistence }   from 'firebase/auth'
import { getFirestore,
         enableIndexedDbPersistence } from 'firebase/firestore'
import { getStorage }                from 'firebase/storage'
import { getFunctions }              from 'firebase/functions'

const firebaseConfig = {
  apiKey:            'REEMPLAZAR',
  authDomain:        'REEMPLAZAR.firebaseapp.com',
  projectId:         'REEMPLAZAR',
  storageBucket:     'REEMPLAZAR.appspot.com',
  messagingSenderId: 'REEMPLAZAR',
  appId:             'REEMPLAZAR',
}

const app = initializeApp(firebaseConfig)

export const auth      = getAuth(app)
export const db        = getFirestore(app)
export const storage   = getStorage(app)
export const functions = getFunctions(app, 'us-central1')

setPersistence(auth, browserLocalPersistence).catch(console.error)

enableIndexedDbPersistence(db).catch(err => {
  if (err.code === 'failed-precondition') console.warn('Offline: múltiples tabs')
  else if (err.code === 'unimplemented')  console.warn('Offline: browser no soportado')
})
```

---

## Apéndice — Diagrama de relaciones

```
tenant
  ├──< usuarios (1:N)
  │       └── empresasIds → empresa[]   (ASESOR: N · CONSULTA: 1 · ADMIN: [])
  │
  └──< empresas (1:N)
          ├── asesorId → usuario        (FK lógica)
          ├── centros[]                 (embebido)
          │
          ├──< seguimiento (1:N)        clave: empId_yyyy_mm (mes 1-12)
          ├──< accidentes (1:N)
          ├──< ausencias (1:N)
          ├──< acciones (1:N)
          │       └── origenId → inspección | AT | auditoría (relación unidireccional)
          ├──< inspecciones (1:N)       acciones via where(origenId==insId)
          ├──< capacitaciones (1:N)
          ├──< plan_actividades (1:N)
          ├──< auditorias (1:N)         acciones via where(origenId==audId)
          ├──< casos_medicos (1:N)      [ADMIN only]
          ├──  eval_estructura (1:1)    clave: empId_yyyy
          └──  configuracion (1:1)      clave: empId
                  └──< obs (1:N)        clave: {year} — un doc por año

catalogo
  └── indicadores (global)             [read-only, sin tenant]
```

---

## 11. Firebase Storage — Modelo de Archivos

### 11.1 Estructura de carpetas

```
/{tenantId}/
  /logos/
    tenant-logo.{ext}              ← Logo de la consultora
    {empresaId}-logo.{ext}         ← Logo de empresa cliente
  /evidencias/
    /acciones/{accionId}/
      {uuid}.{ext}                 ← Evidencia de cierre de acción
    /inspecciones/{insId}/
      {uuid}.{ext}                 ← Fotos de hallazgos
    /capacitaciones/{capId}/
      {uuid}.{ext}                 ← Lista de asistencia, evaluaciones
    /accidentes/{atId}/
      {uuid}.{ext}                 ← Incapacidad, fotos del lugar
  /reportes-generados/
    /{empresaId}/{year}/
      informe-{mm}.pdf             ← PDFs de informes de cumplimiento
      matriz-indicadores-{mm}.xlsx ← Exportaciones Excel
```

**Convención de nombres:** siempre `{uuid}.{ext}` — nunca el nombre original del archivo.  
El nombre original se guarda en el campo `evidenciaNombre` del documento Firestore.

### 11.2 Patrón de subida

```javascript
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, storage } from './firebase.js'

async function subirEvidencia(archivo, tenantId, accionId) {
  const ext      = archivo.name.split('.').pop().toLowerCase()
  const fileName = `${crypto.randomUUID()}.${ext}`
  const path     = `${tenantId}/evidencias/acciones/${accionId}/${fileName}`

  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, archivo)

  // Guardar el PATH en Firestore, NO la URL
  return {
    evidenciaPath:   path,
    evidenciaNombre: archivo.name,
    evidenciaTamano: archivo.size,
  }
}

// Generar URL on-demand cuando se necesita abrir/descargar:
async function abrirEvidencia(path) {
  const url = await getDownloadURL(ref(storage, path))
  window.open(url, '_blank')
}
```

### 11.3 Security Rules para Storage

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{tenantId}/{allPaths=**} {
      allow read:  if request.auth != null
                   && request.auth.token.tenantId == tenantId;
      allow write: if request.auth != null
                   && request.auth.token.tenantId == tenantId
                   && request.auth.token.role in ['ADMIN', 'ASESOR']
                   && request.resource.size <= 10 * 1024 * 1024
                   && request.resource.contentType.matches(
                        'image/.*|application/pdf|application/vnd\\.openxmlformats.*'
                      );
    }
  }
}
```

### 11.4 Tipos permitidos y límites

| Carpeta | Tipos MIME | Tamaño máx |
|---|---|---|
| `/logos/` | `image/jpeg`, `image/png`, `image/webp` | 2 MB |
| `/evidencias/` | `image/*`, `application/pdf` | 10 MB |
| `/reportes-generados/` | `application/pdf`, `application/vnd.openxmlformats-*` | 20 MB |

### 11.5 Política de URLs

Todas las URLs son autenticadas (`getDownloadURL()`). **Nunca** guardar URLs directas en Firestore — guardar siempre el `path` y generar la URL on-demand. Las URLs de Storage contienen tokens que pueden rotar.

### 11.6 Archivos huérfanos

Al hacer soft delete de un documento con archivos adjuntos, los archivos permanecen en Storage. Para V1 se acepta este comportamiento y se limpian manualmente. Para V2 implementar una Cloud Function `onDocumentUpdated` que detecte `activo: false` y borre los archivos del path correspondiente.
