// SIZO — Exportador Excel: Matriz de indicadores SG-SST
// Usa SheetJS (UMD vendorizado, disponible en window.XLSX)
import { calcularIndicadores } from '../modules/calcular-indicadores.js'
import { CATALOGO, ficha }     from '../catalogo.js'

const MESES_LARGO = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

// Colores hex (ARGB para xlsx)
const HEX = {
  brand:    'FF2563EB',
  navy:     'FF0F172A',
  gray:     'FF64748B',
  grayBg:   'FFF1F5F9',
  white:    'FFFFFFFF',
  verde:    'FF22C55E',
  amarillo: 'FFF59E0B',
  naranja:  'FFFB923C',
  rojo:     'FFEF4444',
  neutral:  'FF94A3B8',
}

function colorSemaforo(valor, meta, inv) {
  if (meta === null || meta === undefined) return HEX.neutral
  const cumple = inv ? valor <= meta : valor >= meta
  if (cumple) return HEX.verde
  const diff = inv
    ? (valor - meta) / (meta || 1)
    : (meta - valor) / (meta || 1)
  if (diff <= 0.1) return HEX.amarillo
  if (diff <= 0.25) return HEX.naranja
  return HEX.rojo
}

function celda(v, opts = {}) {
  const c = { v, t: typeof v === 'number' ? 'n' : 's' }
  if (opts.bold || opts.fill || opts.color || opts.align || opts.border) {
    c.s = {}
    if (opts.bold || opts.color) {
      c.s.font = { bold: !!opts.bold }
      if (opts.color) c.s.font.color = { rgb: opts.color }
    }
    if (opts.fill) c.s.fill = { fgColor: { rgb: opts.fill } }
    if (opts.align) c.s.alignment = { horizontal: opts.align, wrapText: true }
    if (opts.border) {
      const b = { style: 'thin', color: { rgb: 'FFE2E8F0' } }
      c.s.border = { top: b, bottom: b, left: b, right: b }
    }
  }
  return c
}

export function exportarMatrizExcel({ empresa, seguimiento, periodo, asesorNombre = '—' }) {
  const { utils, writeFile } = window.XLSX
  if (!utils || !writeFile) throw new Error('SheetJS no está cargado')

  const kpis    = seguimiento ? calcularIndicadores(seguimiento) : null
  const mes     = MESES_LARGO[periodo.month - 1]
  const periodo_ = `${mes} ${periodo.year}`
  const fecha   = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
  const wb      = utils.book_new()

  // ══════════════════════════════════════════════════════════════
  // HOJA 1 — Información general + KPIs
  // ══════════════════════════════════════════════════════════════
  const wsData = []

  // Encabezado empresa
  wsData.push([
    celda('SIZO — Informe de Cumplimiento SG-SST', { bold: true, fill: HEX.brand, color: HEX.white }),
    celda(''), celda(''), celda(''), celda(''),
  ])
  wsData.push([celda(''), celda(''), celda(''), celda(''), celda('')])
  wsData.push([
    celda('Empresa:', { bold: true, fill: HEX.grayBg }),
    celda(empresa.nombre || '—'),
    celda(''), celda(''), celda(''),
  ])
  if (empresa.nit) wsData.push([
    celda('NIT:', { bold: true, fill: HEX.grayBg }),
    celda(empresa.nit),
    celda(''), celda(''), celda(''),
  ])
  wsData.push([
    celda('Período:', { bold: true, fill: HEX.grayBg }),
    celda(periodo_),
    celda(''), celda(''), celda(''),
  ])
  wsData.push([
    celda('Asesor SST:', { bold: true, fill: HEX.grayBg }),
    celda(asesorNombre),
    celda(''), celda(''), celda(''),
  ])
  wsData.push([
    celda('Nivel Res. 0312:', { bold: true, fill: HEX.grayBg }),
    celda(empresa.nivelRes0312 || '—'),
    celda(''), celda(''), celda(''),
  ])
  wsData.push([
    celda('Fecha de emisión:', { bold: true, fill: HEX.grayBg }),
    celda(fecha),
    celda(''), celda(''), celda(''),
  ])
  wsData.push([celda(''), celda(''), celda(''), celda(''), celda('')])

  // Encabezado tabla indicadores
  wsData.push([
    celda('Indicador',    { bold: true, fill: HEX.brand, color: HEX.white, align: 'center' }),
    celda('Valor',        { bold: true, fill: HEX.brand, color: HEX.white, align: 'center' }),
    celda('Unidad',       { bold: true, fill: HEX.brand, color: HEX.white, align: 'center' }),
    celda('Meta',         { bold: true, fill: HEX.brand, color: HEX.white, align: 'center' }),
    celda('Periodicidad', { bold: true, fill: HEX.brand, color: HEX.white, align: 'center' }),
    celda('Normativa',    { bold: true, fill: HEX.brand, color: HEX.white, align: 'center' }),
    celda('Estado',       { bold: true, fill: HEX.brand, color: HEX.white, align: 'center' }),
  ])

  const altBg  = { fill: HEX.grayBg }
  let rowIdx   = 0
  for (const key of Object.keys(CATALOGO)) {
    const f    = ficha(key)
    const val  = kpis ? (kpis[key] ?? 0) : null
    const sem  = (val !== null) ? colorSemaforo(val, f.meta, f.inv) : HEX.neutral
    const label = sem === HEX.verde    ? 'Bien'
                : sem === HEX.amarillo ? 'Atención'
                : sem === HEX.naranja  ? 'Alerta'
                : sem === HEX.rojo     ? 'Crítico'
                : 'Sin datos'
    const bg   = rowIdx % 2 === 0 ? {} : altBg
    wsData.push([
      celda(f.nom,            { ...bg, border: true }),
      celda(val !== null ? val : '—', { ...bg, border: true, bold: true, color: sem.slice(2), align: 'center' }),
      celda(f.u,              { ...bg, border: true, align: 'center' }),
      celda(f.meta !== null ? `${f.meta}${f.u === '%' ? '%' : ''}` : '—', { ...bg, border: true, align: 'center' }),
      celda(f.periodicidad,   { ...bg, border: true, align: 'center' }),
      celda(f.normativa,      { ...bg, border: true }),
      celda(label,            { border: true, fill: sem.slice(2) === HEX.white.slice(2) ? HEX.grayBg : sem,
                                color: HEX.white, align: 'center', bold: true }),
    ])
    rowIdx++
  }

  const ws1 = utils.aoa_to_sheet(wsData)

  // Anchos de columna
  ws1['!cols'] = [
    { wch: 52 }, // Indicador
    { wch: 12 }, // Valor
    { wch: 22 }, // Unidad
    { wch: 14 }, // Meta
    { wch: 16 }, // Periodicidad
    { wch: 42 }, // Normativa
    { wch: 14 }, // Estado
  ]

  // Merge: fila 0 (título) — columnas A:G
  ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }]

  utils.book_append_sheet(wb, ws1, 'Indicadores')

  // ══════════════════════════════════════════════════════════════
  // HOJA 2 — Accidentalidad y Plan de trabajo
  // ══════════════════════════════════════════════════════════════
  if (seguimiento) {
    const seg = seguimiento
    const ws2Data = []

    ws2Data.push([
      celda('Accidentalidad y Ausentismo — ' + periodo_, { bold: true, fill: HEX.brand, color: HEX.white }),
      celda(''),
    ])
    ws2Data.push([celda(''), celda('')])

    const filaAcc = [
      ['Trabajadores expuestos',             seg.trab ?? '—'],
      ['Días trabajados en el período',       seg.diasTrab ?? '—'],
      ['HHT (horas hombre trabajadas)',       seg.trab && seg.diasTrab ? seg.trab * seg.diasTrab * 8 : '—'],
      ['Accidentes de trabajo ocurridos',     seg.atOc ?? 0],
      ['Accidentes de trabajo investigados',  seg.atInv ?? 0],
      ['Accidentes mortales',                 seg.atMort ?? 0],
      ['Días de incapacidad (AT)',             seg.diasInc ?? 0],
      ['Días cargados (severidad)',            seg.diasCarg ?? 0],
      ['IFA — Índice de Frecuencia',          kpis?.ifa ?? '—'],
      ['ISA — Índice de Severidad',           kpis?.isa ?? '—'],
      ['IFM — Índice de Frecuencia Mortales', kpis?.ifm ?? '—'],
      ['ILI — Índice de Lesiones Incap.',     kpis?.ili ?? '—'],
      ['Días de ausentismo (total)',           seg.diasAus ?? 0],
      ['Tasa de ausentismo %',                kpis?.aus ?? '—'],
      ['Casos médicos abiertos',              seg.casosAb ?? 0],
    ]

    filaAcc.forEach(([lbl, val], i) => {
      const bg = i % 2 === 0 ? {} : altBg
      ws2Data.push([
        celda(lbl, { ...bg, bold: true, border: true }),
        celda(val, { ...bg, border: true, align: 'center' }),
      ])
    })

    ws2Data.push([celda(''), celda('')])
    ws2Data.push([
      celda('Plan de trabajo y cumplimiento', { bold: true, fill: HEX.brand, color: HEX.white }),
      celda(''),
    ])
    ws2Data.push([celda(''), celda('')])

    const filaPlan = [
      ['Actividades programadas',       seg.actProg ?? '—'],
      ['Actividades ejecutadas',        seg.actEjec ?? '—'],
      ['Cumplimiento plan %',           kpis?.plan  ?? '—'],
      ['Acciones ACPM generadas',       seg.accGen  ?? '—'],
      ['Acciones ACPM cerradas',        seg.accCerr ?? '—'],
      ['Acciones vencidas',             seg.accVenc ?? 0],
      ['Cumplimiento ACPM %',           kpis?.acpm  ?? '—'],
      ['Capacitaciones programadas',    seg.capProg ?? '—'],
      ['Capacitaciones ejecutadas',     seg.capEjec ?? '—'],
      ['Cumplimiento capacitaciones %', kpis?.cap   ?? '—'],
      ['Inspecciones programadas',      seg.inspProg ?? '—'],
      ['Inspecciones ejecutadas',       seg.inspEjec ?? '—'],
    ]

    filaPlan.forEach(([lbl, val], i) => {
      const bg = i % 2 === 0 ? {} : altBg
      ws2Data.push([
        celda(lbl, { ...bg, bold: true, border: true }),
        celda(val, { ...bg, border: true, align: 'center' }),
      ])
    })

    const ws2 = utils.aoa_to_sheet(ws2Data)
    ws2['!cols'] = [{ wch: 42 }, { wch: 18 }]
    ws2['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    ]
    utils.book_append_sheet(wb, ws2, 'Accidentalidad y Plan')
  }

  // ══════════════════════════════════════════════════════════════
  // Descargar
  // ══════════════════════════════════════════════════════════════
  const nombre = `SIZO_Matriz_${empresa.nombre?.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo.year}_${String(periodo.month).padStart(2, '0')}.xlsx`
  writeFile(wb, nombre)
}
