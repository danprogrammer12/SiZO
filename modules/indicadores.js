// SIZO — Motor de Indicadores (Fase 2)
// Función pura — sin I/O. Recibe datos de seguimiento y retorna los 26 KPIs calculados.

/**
 * @param {object} seg  — documento de seguimiento mensual
 * @param {object} meta — metas del indicador (del catálogo o configuración custom)
 * @returns {object}    — mapa de KPIs calculados
 */
function calcularIndicadores(seg, meta = {}) {
  const trab     = seg.trab     || 1   // evitar división por cero
  const diasTrab = seg.diasTrab || 22

  const kpis = {}

  // IFA — Índice de Frecuencia de Accidentes (Dec. 1072)
  kpis.ifa = seg.atOc > 0
    ? +((seg.atOc / trab) * 100).toFixed(2)
    : 0

  // IFM — Índice de Frecuencia de Accidentes Mortales
  kpis.ifm = seg.atMort > 0
    ? +((seg.atMort / trab) * 100).toFixed(2)
    : 0

  // ISA — Índice de Severidad de Accidentes
  kpis.isa = seg.diasCarg > 0
    ? +((seg.diasCarg / trab) * 100).toFixed(2)
    : 0

  // ILI — Índice de Lesiones Incapacitantes
  kpis.ili = (kpis.ifa * kpis.isa) / 1000

  // Tasa de ausentismo general
  kpis.aus = diasTrab > 0
    ? +((seg.diasAus / (trab * diasTrab)) * 100).toFixed(2)
    : 0

  // Cumplimiento plan de trabajo
  kpis.plan = seg.actProg > 0
    ? +((seg.actEjec / seg.actProg) * 100).toFixed(2)
    : 0

  // Cumplimiento controles IPER
  kpis.iper = seg.ctrlDef > 0
    ? +((seg.ctrlImpl / seg.ctrlDef) * 100).toFixed(2)
    : 0

  // Cumplimiento capacitaciones
  kpis.cap = seg.capProg > 0
    ? +((seg.capEjec / seg.capProg) * 100).toFixed(2)
    : 0

  // Cumplimiento inspecciones
  kpis.insp = seg.inspProg > 0
    ? +((seg.inspEjec / seg.inspProg) * 100).toFixed(2)
    : 0

  // Cumplimiento evaluaciones médicas
  kpis.evMed = seg.evMedProg > 0
    ? +((seg.evMedEjec / seg.evMedProg) * 100).toFixed(2)
    : 0

  // Acciones cerradas vs generadas
  kpis.acpm = seg.accGen > 0
    ? +((seg.accCerr / seg.accGen) * 100).toFixed(2)
    : 0

  // Acciones vencidas
  kpis.accVenc = seg.accVenc || 0

  // Cumplimiento requisitos legales
  kpis.reqLeg = seg.reqAplic > 0
    ? +((seg.reqCumpl / seg.reqAplic) * 100).toFixed(2)
    : 0

  // Cumplimiento objetivos SST
  kpis.obj = seg.objDef > 0
    ? +((seg.objCumpl / seg.objDef) * 100).toFixed(2)
    : 0

  // Cumplimiento COPASST/Vigía
  kpis.cop = seg.copProg > 0
    ? +((seg.copEjec / seg.copProg) * 100).toFixed(2)
    : 0

  // Cumplimiento Cocolab
  kpis.col = seg.colProg > 0
    ? +((seg.colEjec / seg.colProg) * 100).toFixed(2)
    : 0

  // Cumplimiento visitas asesor
  kpis.vis = seg.visProg > 0
    ? +((seg.visEjec / seg.visProg) * 100).toFixed(2)
    : 0

  // Cumplimiento plan de emergencias
  kpis.em = seg.emProg > 0
    ? +((seg.emEjec / seg.emProg) * 100).toFixed(2)
    : 0

  // Casos médicos abiertos
  kpis.casosAb = seg.casosAb || 0

  // Días sin accidente
  kpis.diasSinAt = seg.fechaUltimoAt
    ? Math.floor((Date.now() - new Date(seg.fechaUltimoAt).getTime()) / 864e5)
    : null

  return kpis
}

/**
 * Semáforo de un indicador
 * @param {number} valor
 * @param {number} meta
 * @param {boolean} inv — true = menor es mejor (ifa, aus, etc.)
 */
function semaforo(valor, meta, inv = false) {
  if (valor === null || valor === undefined) return 'neutral'
  const ratio = inv
    ? (meta > 0 ? valor / meta : 0)
    : (meta > 0 ? valor / meta : 1)

  if (inv) {
    if (valor === 0)    return 'verde'
    if (ratio <= 0.5)   return 'verde'
    if (ratio <= 0.85)  return 'amarillo'
    if (ratio <= 1.0)   return 'naranja'
    return 'rojo'
  } else {
    if (ratio >= 0.85)  return 'verde'
    if (ratio >= 0.61)  return 'amarillo'
    if (ratio >= 0.41)  return 'naranja'
    return 'rojo'
  }
}

// Render del módulo Maestro de Indicadores (placeholder Fase 2)
async function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Motor de Indicadores</h2>
        <p class="page-subtitle">26 KPIs calculados — Maestro de fichas técnicas</p>
      </div>
    </div>
    <div class="empty-state">
      <div class="empty-state-icon">📈</div>
      <h3 class="empty-state-title">Módulo en construcción</h3>
      <p class="text-muted">Disponible en Fase 2 — Core SG-SST</p>
    </div>
  `
}

export { render, calcularIndicadores, semaforo }
