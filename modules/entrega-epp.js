// SIZO — Entrega individual de EPP (evidencia firmada, Dec. 1072/2015 Art. 2.2.4.6.24)
import { crearModulo, fmtFecha, badge } from './_crud.js'
import { botonesDescarga } from '../components/exportar-plantilla.js'

const COLUMNAS_EXPORT = [
  { key: 'fechaEntrega', label: 'Fecha de entrega', wch: 14 },
  { key: 'trabajador', label: 'Trabajador', wch: 22 },
  { key: 'cargo', label: 'Cargo', wch: 18 },
  { key: 'eppEntregado', label: 'EPP entregado', wch: 26 },
  { key: 'cantidad', label: 'Cantidad', wch: 10 },
  { key: 'talla', label: 'Talla', wch: 10 },
  { key: 'fechaProximaReposicion', label: 'Próxima reposición', wch: 16 },
  { key: 'firmado', label: 'Firmado', wch: 10 },
  { key: 'observaciones', label: 'Observaciones', wch: 26 },
]

const { render } = crearModulo({
  tabla: 'entrega_epp',
  titulo: 'Entrega de EPP',
  subtitulo: 'Registro de entrega individual de elementos de protección personal',
  icono: '📦',
  labelNuevo: 'Nueva entrega',
  ordenPor: 'fechaEntrega',
  botones: botonesDescarga({
    tabla: 'entrega_epp',
    titulo: 'Formato de Entrega Individual de EPP',
    columnas: COLUMNAS_EXPORT,
    nombreBase: 'SIZO_Entrega_EPP',
    urlOficial: 'https://www.ramajudicial.gov.co/documents/8957139/8958832/F-SST-11+Formato+entrega+EPP+2022+V2.xls/c67ab34d-8b23-4add-a32a-61d04f945883',
  }),
  columnas: [
    { key: 'fechaEntrega', label: 'Fecha', format: fmtFecha },
    { key: 'trabajador', label: 'Trabajador' },
    { key: 'eppEntregado', label: 'EPP entregado' },
    { key: 'cantidad', label: 'Cant.' },
    { key: 'firmado', label: 'Firmado', format: v =>
        v ? badge('Sí', { 'Sí': 'badge-success' }) : badge('Pendiente', { Pendiente: 'badge-warning' }) },
  ],
  campos: [
    { key: 'trabajador', label: 'Trabajador', type: 'text', required: true },
    { key: 'cargo', label: 'Cargo', type: 'text' },
    { key: 'eppEntregado', label: 'EPP entregado', type: 'text', required: true, ancho: 'full' },
    { key: 'cantidad', label: 'Cantidad', type: 'number', min: 1, default: 1, required: true },
    { key: 'talla', label: 'Talla', type: 'text' },
    { key: 'fechaEntrega', label: 'Fecha de entrega', type: 'date', required: true },
    { key: 'fechaProximaReposicion', label: 'Próxima reposición', type: 'date' },
    { key: 'firmado', label: 'Confirmación', type: 'checkbox', checkLabel: 'Trabajador firmó la entrega' },
    { key: 'observaciones', label: 'Observaciones', type: 'textarea', ancho: 'full' },
  ],
})

export { render }
