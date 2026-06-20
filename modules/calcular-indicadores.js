// Función pura sin dependencias de DOM — importable desde Node (tests) y browser
export function calcularIndicadores(seg, meta = {}) {
  const trab     = seg.trab     || 1
  const diasTrab = seg.diasTrab || 22

  // HHT — Horas Hombre Trabajadas (base Dec. 1072/2015 Art. 2.2.4.1.7)
  // Se estiman desde los datos de seguimiento: trabajadores × días trabajados × 8 hrs/día
  const hht = (trab * diasTrab * 8) || 1

  const kpis = {}

  // IFA — Índice de Frecuencia de AT (Dec. 1072: AT × 240.000 / HHT)
  kpis.ifa = seg.atOc > 0
    ? +((seg.atOc * 240000) / hht).toFixed(2)
    : 0

  // IFM — Índice de Frecuencia de AT Mortales (Dec. 1072: mort × 240.000 / HHT)
  kpis.ifm = seg.atMort > 0
    ? +((seg.atMort * 240000) / hht).toFixed(2)
    : 0

  // ISA — Índice de Severidad (Dec. 1072: días cargados × 240.000 / HHT)
  kpis.isa = seg.diasCarg > 0
    ? +((seg.diasCarg * 240000) / hht).toFixed(2)
    : 0

  // ILI — Índice de Lesiones Incapacitantes (IFA × ISA / 1.000)
  kpis.ili = +((kpis.ifa * kpis.isa) / 1000).toFixed(4)

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
