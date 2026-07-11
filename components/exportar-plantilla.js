// SIZO — Exportador genérico de plantillas SGSST a Excel y PDF
// Reutiliza SheetJS y jsPDF+autoTable ya vendorizados (mismo patrón que
// excel-informe.js / pdf-informe.js), pero tabular y sin depender del
// motor de indicadores — sirve para cualquier módulo tipo matriz/listado.
import db      from '../db.js'
import { get } from '../store.js'
import toast   from './toast.js'

const HEX_BRAND = 'FF2563EB'
const HEX_WHITE = 'FFFFFFFF'
const HEX_GRAY  = 'FFF1F5F9'

function celda(v, opts = {}) {
  const val = v ?? ''
  const c = { v: val, t: typeof val === 'number' ? 'n' : 's' }
  if (opts.bold || opts.fill || opts.color) {
    c.s = {}
    c.s.font = { bold: !!opts.bold, color: opts.color ? { rgb: opts.color } : undefined }
    if (opts.fill) c.s.fill = { fgColor: { rgb: opts.fill } }
  }
  return c
}

// filas: array de objetos con las mismas keys que columnas[].key
export function exportarExcel({ titulo, empresa, columnas, filas, nombreArchivo }) {
  const { utils, writeFile } = window.XLSX
  if (!utils || !writeFile) throw new Error('SheetJS no está cargado')

  const wsData = []
  wsData.push(columnas.map((_, i) => celda(i === 0 ? titulo : '', { bold: true, fill: HEX_BRAND, color: HEX_WHITE })))
  wsData.push(columnas.map((_, i) => celda(i === 0 ? `Empresa: ${empresa?.nombre || '—'}` : '', { fill: HEX_GRAY })))
  wsData.push(columnas.map(() => celda('')))
  wsData.push(columnas.map(c => celda(c.label, { bold: true, fill: HEX_BRAND, color: HEX_WHITE })))
  filas.forEach((fila, i) => {
    const bg = i % 2 === 0 ? {} : { fill: HEX_GRAY }
    wsData.push(columnas.map(c => celda(fila[c.key], bg)))
  })

  const ws = utils.aoa_to_sheet(wsData)
  ws['!cols'] = columnas.map(c => ({ wch: c.wch || 20 }))
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: columnas.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: columnas.length - 1 } },
  ]

  // Excel prohíbe : \ / ? * [ ] en el nombre de hoja y lo limita a 31 caracteres
  const nombreHoja = titulo.replace(/[:\\/?*[\]]/g, '-').slice(0, 31)
  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, nombreHoja)
  writeFile(wb, nombreArchivo)
}

export function exportarPdf({ titulo, subtitulo, empresa, columnas, filas, nombreArchivo }) {
  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const fecha = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(titulo, 14, 15)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(`${empresa?.nombre || '—'}${subtitulo ? ' — ' + subtitulo : ''} — Generado el ${fecha}`, 14, 21)

  doc.autoTable({
    startY: 26,
    head: [columnas.map(c => c.label)],
    body: filas.map(fila => columnas.map(c => {
      const v = fila[c.key]
      return v === null || v === undefined || v === '' ? '—' : String(v)
    })),
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    alternateRowStyles: { fillColor: [241, 245, 249] },
    margin: { left: 10, right: 10 },
  })

  doc.save(nombreArchivo)
}

// Genera los botones "Excel" / "PDF" (y opcionalmente "Formato oficial") para
// pasar directamente a cfg.botones de crearModulo(). Cada click vuelve a leer
// los registros activos de la empresa activa — no depende del estado interno
// del módulo CRUD.
function limpiarNombre(s) {
  return String(s || '—').replace(/[^a-zA-Z0-9._-]/g, '_')
}

export function botonesDescarga({ tabla, titulo, subtitulo, columnas, nombreBase, urlOficial }) {
  async function obtenerFilas() {
    const empresa = get('empresa')
    if (!empresa) { toast.warning('Selecciona una empresa'); return null }
    const filas = await db.list(tabla, { eq: { activo: true, empresaId: empresa.id } })
    if (!filas.length) { toast.warning('No hay registros para exportar'); return null }
    return { empresa, filas }
  }

  const botones = [
    { label: '⬇️ Excel', clase: 'btn-secondary', onClick: async () => {
      const r = await obtenerFilas()
      if (!r) return
      exportarExcel({ titulo, empresa: r.empresa, columnas, filas: r.filas,
        nombreArchivo: `${nombreBase}_${limpiarNombre(r.empresa.nombre)}.xlsx` })
    }},
    { label: '📄 PDF', clase: 'btn-secondary', onClick: async () => {
      const r = await obtenerFilas()
      if (!r) return
      exportarPdf({ titulo, subtitulo, empresa: r.empresa, columnas, filas: r.filas,
        nombreArchivo: `${nombreBase}_${limpiarNombre(r.empresa.nombre)}.pdf` })
    }},
  ]
  if (urlOficial) {
    botones.push({ label: '🔗 Formato oficial', clase: 'btn-secondary',
      onClick: () => window.open(urlOficial, '_blank', 'noopener') })
  }
  return botones
}
