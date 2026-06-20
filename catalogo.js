// ─────────────────────────────────────────────────────────────
// SIZO — Catálogo de indicadores (metas y fichas por defecto)
// 20 KPIs. inv:true = menor es mejor.
// Normativa principal: Dec. 1072/2015 · Res. 0312/2019.
// IFA/IFM/ISA usan base 240.000 HHT (Art. 2.2.4.1.7 Dec. 1072).
// HHT se estima como: N° trabajadores × días trabajados × 8 hrs/día.
// ─────────────────────────────────────────────────────────────

const CATALOGO = {
  ifa:     { nom: 'IFA — Frecuencia de Accidentalidad', meta: 0,   inv: true,  tipo: 'Resultado', u: 'AT/240.000 HHT', periodicidad: 'Mensual',  normativa: 'Dec. 1072/2015 Art. 2.2.4.1.7', formula: '(AT ocurridos × 240.000) / HHT' },
  ifm:     { nom: 'IFM — AT Mortales',                  meta: 0,   inv: true,  tipo: 'Resultado', u: 'Mort/240.000 HHT', periodicidad: 'Mensual',  normativa: 'Dec. 1072/2015 Art. 2.2.4.1.7', formula: '(AT mortales × 240.000) / HHT' },
  isa:     { nom: 'ISA — Severidad de Accidentalidad',  meta: 0,   inv: true,  tipo: 'Resultado', u: 'Días/240.000 HHT', periodicidad: 'Mensual', normativa: 'Dec. 1072/2015 Art. 2.2.4.1.7', formula: '(Días cargados × 240.000) / HHT' },
  ili:     { nom: 'ILI — Lesiones Incapacitantes',      meta: 0,   inv: true,  tipo: 'Resultado', u: 'índice',      periodicidad: 'Mensual',  normativa: 'Dec. 1072/2015 Art. 2.2.4.1.7', formula: '(IFA × ISA) / 1.000' },
  aus:     { nom: 'Ausentismo total',                   meta: 5,   inv: true,  tipo: 'Resultado', u: '%',           periodicidad: 'Mensual',  normativa: 'Res. 0312/2019', formula: 'Días ausentismo / (N° trab. × días programados) × 100' },
  plan:    { nom: 'Cumplimiento Plan de Trabajo',       meta: 80,  inv: false, tipo: 'Proceso',   u: '%',           periodicidad: 'Mensual',  normativa: 'Dec. 1072/2015 Art. 2.2.4.6.8', formula: 'Actividades ejecutadas / programadas × 100' },
  iper:    { nom: 'Controles IPER implementados',       meta: 100, inv: false, tipo: 'Proceso',   u: '%',           periodicidad: 'Trimestral', normativa: 'Dec. 1072/2015', formula: 'Controles implementados / definidos × 100' },
  cap:     { nom: 'Cumplimiento Capacitaciones',        meta: 80,  inv: false, tipo: 'Proceso',   u: '%',           periodicidad: 'Mensual',  normativa: 'Res. 0312/2019', formula: 'Capacitaciones ejecutadas / programadas × 100' },
  insp:    { nom: 'Cumplimiento Inspecciones',          meta: 100, inv: false, tipo: 'Proceso',   u: '%',           periodicidad: 'Mensual',  normativa: 'Dec. 1072/2015', formula: 'Inspecciones ejecutadas / programadas × 100' },
  evMed:   { nom: 'Evaluaciones médicas al día',        meta: 100, inv: false, tipo: 'Proceso',   u: '%',           periodicidad: 'Anual',    normativa: 'Res. 2346/2007', formula: 'Eval. médicas ejecutadas / programadas × 100' },
  acpm:    { nom: 'Acciones cerradas (ACPM)',           meta: 80,  inv: false, tipo: 'Proceso',   u: '%',           periodicidad: 'Mensual',  normativa: 'Dec. 1072/2015', formula: 'Acciones cerradas / generadas × 100' },
  accVenc: { nom: 'Acciones vencidas',                  meta: 0,   inv: true,  tipo: 'Proceso',   u: 'acciones',    periodicidad: 'Mensual',  normativa: 'Dec. 1072/2015', formula: 'Conteo de acciones vencidas al cierre del mes' },
  reqLeg:  { nom: 'Cumplimiento requisitos legales',    meta: 90,  inv: false, tipo: 'Proceso',   u: '%',           periodicidad: 'Trimestral', normativa: 'Dec. 1072/2015', formula: 'Requisitos cumplidos / aplicables × 100' },
  obj:     { nom: 'Cumplimiento objetivos SST',         meta: 100, inv: false, tipo: 'Proceso',   u: '%',           periodicidad: 'Semestral', normativa: 'Dec. 1072/2015', formula: 'Objetivos cumplidos / definidos × 100' },
  cop:     { nom: 'COPASST / Vigía',                    meta: 100, inv: false, tipo: 'Proceso',   u: '%',           periodicidad: 'Mensual',  normativa: 'Res. 2013/1986', formula: 'Reuniones ejecutadas / programadas × 100' },
  col:     { nom: 'COCOLAB',                            meta: 100, inv: false, tipo: 'Proceso',   u: '%',           periodicidad: 'Mensual',  normativa: 'Res. 0652/2012', formula: 'Reuniones ejecutadas / programadas × 100' },
  vis:     { nom: 'Visitas técnicas del asesor',        meta: 100, inv: false, tipo: 'Proceso',   u: '%',           periodicidad: 'Mensual',  normativa: '—', formula: 'Visitas ejecutadas / programadas × 100' },
  em:      { nom: 'Plan de emergencias',                meta: 100, inv: false, tipo: 'Proceso',   u: '%',           periodicidad: 'Mensual',  normativa: 'Dec. 1072/2015', formula: 'Actividades ejecutadas / programadas × 100' },
  casosAb: { nom: 'Casos médicos abiertos',             meta: 0,   inv: true,  tipo: 'Proceso',   u: 'casos',       periodicidad: 'Mensual',  normativa: '—', formula: 'Conteo de casos médicos abiertos al cierre' },
  diasSinAt: { nom: 'Días sin accidentes',              meta: null, inv: false, tipo: 'Resultado', u: 'días',       periodicidad: 'Continua', normativa: 'Dec. 1072/2015', formula: 'Días transcurridos desde el último AT' },
}

// Indicadores destacados en las tarjetas del dashboard, en orden
const DESTACADOS = ['plan', 'aus', 'ifa', 'cap', 'acpm', 'reqLeg']

function ficha(key) {
  return CATALOGO[key] || { nom: key, meta: null, inv: false, tipo: '—', u: '', normativa: '—' }
}

export { CATALOGO, DESTACADOS, ficha }
