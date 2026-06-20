// SIZO — Generador de PDF: Informe de Cumplimiento SG-SST
// Usa jsPDF + autoTable (UMD vendorizado, disponible en window.jspdf)
import { calcularIndicadores } from '../modules/calcular-indicadores.js'
import { CATALOGO, DESTACADOS, ficha } from '../catalogo.js'

const MESES_LARGO = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

// Colores corporativos SIZO
const C = {
  brand:    [37, 99, 235],    // #2563EB
  navy:     [15, 23, 42],     // #0F172A
  teal:     [6,  182, 212],   // #06B6D4
  gray:     [100, 116, 139],  // text-secondary
  grayLight:[241, 245, 249],  // surface-2
  white:    [255, 255, 255],
  verde:    [34, 197, 94],
  amarillo: [245, 158, 11],
  naranja:  [251, 146, 60],
  rojo:     [239, 68, 68],
}

const SEM_COLOR = {
  verde:    C.verde,
  amarillo: C.amarillo,
  naranja:  C.naranja,
  rojo:     C.rojo,
  neutral:  C.gray,
}

function colorSemaforo(valor, meta, inv) {
  if (meta === null || meta === undefined) return 'neutral'
  const cumple = inv ? valor <= meta : valor >= meta
  if (cumple) return 'verde'
  const diff = inv
    ? (valor - meta) / (meta || 1)
    : (meta - valor) / (meta || 1)
  if (diff <= 0.1) return 'amarillo'
  if (diff <= 0.25) return 'naranja'
  return 'rojo'
}

export async function generarInformePDF({ empresa, seguimiento, periodo, asesorNombre = '—' }) {
  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const kpis = seguimiento ? calcularIndicadores(seguimiento) : null
  const mesLabel = MESES_LARGO[periodo.month - 1]
  const fecha    = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })

  const W  = doc.internal.pageSize.getWidth()   // 210 mm
  const H  = doc.internal.pageSize.getHeight()  // 297 mm
  let y = 0

  // ── Helpers ──────────────────────────────────────────────────
  function addPage() {
    doc.addPage()
    y = 20
  }

  function chkPage(needed = 20) {
    if (y + needed > H - 15) addPage()
  }

  function titulo(txt, size = 11, color = C.navy) {
    chkPage(12)
    doc.setFontSize(size)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...color)
    doc.text(txt, 14, y)
    y += size * 0.45 + 2
  }

  function subtitulo(txt) {
    chkPage(8)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.gray)
    doc.text(txt, 14, y)
    y += 6
  }

  function separador() {
    chkPage(6)
    doc.setDrawColor(...C.grayLight)
    doc.setLineWidth(0.3)
    doc.line(14, y, W - 14, y)
    y += 5
  }

  function kpiPill(label, valor, unidad, sem, x, pw) {
    const color = SEM_COLOR[sem] || C.gray
    doc.setFillColor(...color)
    doc.roundedRect(x, y, pw, 18, 2, 2, 'F')
    doc.setFillColor(255, 255, 255, 0.15)
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.white)
    doc.text(label, x + pw / 2, y + 5.5, { align: 'center', maxWidth: pw - 2 })
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text(`${valor}${unidad}`, x + pw / 2, y + 13, { align: 'center' })
  }

  // ════════════════════════════════════════════════
  // PORTADA
  // ════════════════════════════════════════════════
  // Banda superior azul
  doc.setFillColor(...C.brand)
  doc.rect(0, 0, W, 45, 'F')

  // Logo texto — ◉ no es soportado por Helvetica; se dibuja un círculo
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.white)
  doc.text('SIZO', 14, 22)
  // Punto teal sobre la O
  const oxOff = 14 + doc.getTextWidth('SIZ') + doc.getTextWidth('O') * 0.5
  doc.setFillColor(...C.teal)
  doc.circle(oxOff, 15.5, 2.2, 'F')

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.white)
  doc.text('Sistema de Gestión de Seguridad y Salud en el Trabajo', 14, 30)

  // Tipo de informe (derecha)
  doc.setFontSize(8)
  doc.setTextColor(200, 220, 255)
  doc.text('INFORME DE CUMPLIMIENTO SG-SST', W - 14, 18, { align: 'right' })
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.white)
  doc.text(`${mesLabel} ${periodo.year}`, W - 14, 26, { align: 'right' })

  // Datos de empresa
  y = 58
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.navy)
  doc.text(empresa.nombre || '—', 14, y)
  y += 8

  if (empresa.nit) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.gray)
    doc.text(`NIT: ${empresa.nit}`, 14, y)
    y += 6
  }
  if (empresa.sector) {
    doc.setFontSize(9)
    doc.setTextColor(...C.gray)
    doc.text(`Sector: ${empresa.sector}`, 14, y)
    y += 6
  }

  // Tabla de datos generales
  y += 4
  doc.autoTable({
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['Campo', 'Valor']],
    body: [
      ['Período',          `${mesLabel} ${periodo.year}`],
      ['Asesor SST',       asesorNombre],
      ['Fecha de emisión', fecha],
      ['Nivel Res. 0312',  empresa.nivelRes0312 || '—'],
      ['Actividad económica', empresa.actividad || '—'],
    ],
    headStyles:  { fillColor: C.brand, textColor: C.white, fontSize: 8, fontStyle: 'bold' },
    bodyStyles:  { fontSize: 8, textColor: C.navy },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
    alternateRowStyles: { fillColor: C.grayLight },
    tableLineColor: C.grayLight,
    tableLineWidth: 0.1,
  })
  y = doc.lastAutoTable.finalY + 10

  // ── KPIs destacados en portada ──────────────────
  if (kpis) {
    titulo('Indicadores destacados del período', 10)
    y += 2
    const cols   = 3
    const gap    = 3
    const pw     = (W - 28 - gap * (cols - 1)) / cols
    const kKeys  = DESTACADOS.slice(0, 6)
    for (let i = 0; i < kKeys.length; i++) {
      const key  = kKeys[i]
      const f    = ficha(key)
      const val  = kpis[key] ?? 0
      const sem  = colorSemaforo(val, f.meta, f.inv)
      const unit = f.u === '%' ? '%' : (f.u === 'AT/240.000 HHT' ? '' : '')
      const col  = i % cols
      const x    = 14 + col * (pw + gap)
      if (col === 0 && i > 0) y += 22
      kpiPill(f.nom, val, unit, sem, x, pw)
    }
    y += 24
  } else {
    y += 4
    doc.setFontSize(8)
    doc.setTextColor(...C.gray)
    doc.text('Sin datos de seguimiento registrados para este período.', 14, y)
    y += 10
  }

  // ════════════════════════════════════════════════
  // PÁGINA 2 — Tabla completa de indicadores
  // ════════════════════════════════════════════════
  addPage()
  titulo('Matriz de indicadores — ' + `${mesLabel} ${periodo.year}`, 12)
  subtitulo('Normativa: Decreto 1072/2015 y Resolución 0312/2019')
  y += 2

  if (kpis) {
    const rows = Object.keys(CATALOGO).map(key => {
      const f   = ficha(key)
      const val = kpis[key] ?? 0
      const sem = colorSemaforo(val, f.meta, f.inv)
      const metaStr = f.meta !== null ? `${f.meta}${f.u === '%' ? '%' : ''}` : '—'
      return {
        row:   [f.nom, `${val} ${f.u}`, metaStr, f.periodicidad, f.normativa],
        color: SEM_COLOR[sem],
        sem,
      }
    })

    doc.autoTable({
      startY: y,
      margin: { left: 14, right: 14 },
      head:   [['Indicador', 'Valor', 'Meta', 'Periodicidad', 'Normativa']],
      body:   rows.map(r => r.row),
      headStyles: { fillColor: C.brand, textColor: C.white, fontSize: 7.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7, textColor: C.navy },
      columnStyles: {
        0: { cellWidth: 68 },
        1: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 24, halign: 'center' },
        4: { cellWidth: 46 },
      },
      alternateRowStyles: { fillColor: C.grayLight },
      didDrawCell: (data) => {
        if (data.column.index === 1 && data.section === 'body') {
          const r = rows[data.row.index]
          if (r) {
            const [rr, gg, bb] = r.color
            doc.setTextColor(rr, gg, bb)
          }
        }
      },
      tableLineColor: C.grayLight,
      tableLineWidth: 0.1,
    })
    y = doc.lastAutoTable.finalY + 8
  } else {
    doc.setFontSize(8)
    doc.setTextColor(...C.gray)
    doc.text('Sin datos de seguimiento para calcular indicadores.', 14, y)
    y += 10
  }

  // ════════════════════════════════════════════════
  // PÁGINA 3 — Accidentalidad y ausentismo
  // ════════════════════════════════════════════════
  if (seguimiento) {
    addPage()
    titulo('Accidentalidad y Ausentismo', 12)
    separador()

    const seg = seguimiento
    doc.autoTable({
      startY: y,
      margin: { left: 14, right: 14 },
      head:   [['Variable', 'Valor']],
      body:   [
        ['Trabajadores expuestos',              seg.trab ?? '—'],
        ['Días trabajados en el período',        seg.diasTrab ?? '—'],
        ['HHT (horas hombre trabajadas)',        seg.trab && seg.diasTrab ? seg.trab * seg.diasTrab * 8 : '—'],
        ['Accidentes de trabajo ocurridos',      seg.atOc ?? 0],
        ['Accidentes de trabajo investigados',   seg.atInv ?? 0],
        ['Accidentes mortales',                  seg.atMort ?? 0],
        ['Días de incapacidad (AT)',              seg.diasInc ?? 0],
        ['Días cargados (severidad)',             seg.diasCarg ?? 0],
        ['IFA — Índice de Frecuencia',           kpis?.ifa ?? '—'],
        ['ISA — Índice de Severidad',            kpis?.isa ?? '—'],
        ['IFM — Índice de Frecuencia Mortales',  kpis?.ifm ?? '—'],
        ['ILI — Índice de Lesiones Incap.',      kpis?.ili ?? '—'],
        ['Días de ausentismo (total)',            seg.diasAus ?? 0],
        ['Tasa de ausentismo %',                 kpis?.aus ?? '—'],
        ['Casos médicos abiertos',               seg.casosAb ?? 0],
      ],
      headStyles:  { fillColor: C.brand, textColor: C.white, fontSize: 8, fontStyle: 'bold' },
      bodyStyles:  { fontSize: 8, textColor: C.navy },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 90 } },
      alternateRowStyles: { fillColor: C.grayLight },
      tableLineColor: C.grayLight,
      tableLineWidth: 0.1,
    })
    y = doc.lastAutoTable.finalY + 8

    // ── Plan de trabajo ──
    titulo('Plan de trabajo y cumplimiento', 11)
    separador()
    doc.autoTable({
      startY: y,
      margin: { left: 14, right: 14 },
      head:   [['Variable', 'Valor']],
      body:   [
        ['Actividades programadas',    seg.actProg ?? '—'],
        ['Actividades ejecutadas',     seg.actEjec ?? '—'],
        ['Cumplimiento plan %',        kpis?.plan ?? '—'],
        ['Acciones ACPM generadas',    seg.accGen ?? '—'],
        ['Acciones ACPM cerradas',     seg.accCerr ?? '—'],
        ['Acciones vencidas',          seg.accVenc ?? 0],
        ['Cumplimiento ACPM %',        kpis?.acpm ?? '—'],
        ['Capacitaciones programadas', seg.capProg ?? '—'],
        ['Capacitaciones ejecutadas',  seg.capEjec ?? '—'],
        ['Cumplimiento capacitaciones %', kpis?.cap ?? '—'],
        ['Inspecciones programadas',   seg.inspProg ?? '—'],
        ['Inspecciones ejecutadas',    seg.inspEjec ?? '—'],
      ],
      headStyles:  { fillColor: C.brand, textColor: C.white, fontSize: 8, fontStyle: 'bold' },
      bodyStyles:  { fontSize: 8, textColor: C.navy },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 90 } },
      alternateRowStyles: { fillColor: C.grayLight },
      tableLineColor: C.grayLight,
      tableLineWidth: 0.1,
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // ── Pie en todas las páginas ──
  const total = doc.internal.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setFontSize(7)
    doc.setTextColor(...C.gray)
    doc.text(`Generado por SIZO · ${fecha} · Página ${p} de ${total}`, W / 2, H - 8, { align: 'center' })
  }

  // Descargar
  const nombre = `SIZO_Informe_${empresa.nombre?.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo.year}_${String(periodo.month).padStart(2, '0')}.pdf`
  doc.save(nombre)
}
