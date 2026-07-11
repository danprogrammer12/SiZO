// SIZO — Documentación general del SG-SST (política, objetivos, requisitos legales, manual)
import { crearModulo, fmtFecha, badge } from './_crud.js'
import { botonesDescarga } from '../components/exportar-plantilla.js'

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

const COLUMNAS_EXPORT = [
  { key: 'tipo', label: 'Tipo', wch: 20 },
  { key: 'nombre', label: 'Nombre', wch: 30 },
  { key: 'version', label: 'Versión', wch: 10 },
  { key: 'responsable', label: 'Responsable', wch: 20 },
  { key: 'fechaAprobacion', label: 'Fecha aprobación', wch: 16 },
  { key: 'fechaVigencia', label: 'Vigente hasta', wch: 16 },
  { key: 'contenido', label: 'Contenido / resumen', wch: 36 },
]

const { render } = crearModulo({
  tabla: 'documentos_sst',
  titulo: 'Documentación del SG-SST',
  subtitulo: 'Política, objetivos y matriz de requisitos legales',
  icono: '📜',
  labelNuevo: 'Nuevo documento',
  ordenPor: 'creadoEn',
  botones: botonesDescarga({
    tabla: 'documentos_sst',
    titulo: 'Documentación general del SG-SST',
    columnas: COLUMNAS_EXPORT,
    nombreBase: 'SIZO_Documentacion_SST',
  }),
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
