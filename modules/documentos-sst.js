// SIZO — Documentación general del SG-SST (política, objetivos, requisitos legales, manual)
import { crearModulo, fmtFecha, badge } from './_crud.js'

const TIPOS = [
  { value: 'politica', label: 'Política de SST' },
  { value: 'objetivos', label: 'Objetivos del SG-SST' },
  { value: 'requisitos_legales', label: 'Matriz de requisitos legales' },
  { value: 'manual_sgsst', label: 'Manual del SG-SST' },
]

function vigencia(fechaVigencia) {
  if (!fechaVigencia) return badge('Sin definir', {})
  const venc = new Date(fechaVigencia) < new Date()
  return venc ? badge('Vencido', { Vencido: 'badge-danger' }) : badge('Vigente', { Vigente: 'badge-success' })
}

const { render } = crearModulo({
  tabla: 'documentos_sst',
  titulo: 'Documentación del SG-SST',
  subtitulo: 'Política, objetivos y matriz de requisitos legales',
  icono: '📜',
  labelNuevo: 'Nuevo documento',
  ordenPor: 'creadoEn',
  columnas: [
    { key: 'tipo', label: 'Tipo', format: v => badge(TIPOS.find(t => t.value === v)?.label || v, { }) },
    { key: 'nombre', label: 'Nombre' },
    { key: 'version', label: 'Versión' },
    { key: 'fechaVigencia', label: 'Vigencia', format: fmtFecha },
    { key: 'fechaVigencia', label: 'Estado', format: vigencia },
  ],
  campos: [
    { key: 'tipo', label: 'Tipo de documento', type: 'select', required: true, options: TIPOS },
    { key: 'nombre', label: 'Nombre del documento', type: 'text', required: true, ancho: 'full' },
    { key: 'version', label: 'Versión', type: 'text' },
    { key: 'responsable', label: 'Responsable', type: 'text' },
    { key: 'fechaAprobacion', label: 'Fecha de aprobación', type: 'date' },
    { key: 'fechaVigencia', label: 'Vigente hasta', type: 'date' },
    { key: 'contenido', label: 'Contenido / resumen', type: 'textarea', ancho: 'full' },
  ],
})

export { render }
