// SIZO — Auditoría interna y revisión por la dirección (Dec. 1072/2015 Art. 2.2.4.6.29-31)
import { crearModulo, fmtFecha, badge } from './_crud.js'
import { botonesDescarga } from '../components/exportar-plantilla.js'

const ESTADO_BADGE = { pendiente: 'badge-neutral', en_proceso: 'badge-warning', completada: 'badge-success' }

const COLUMNAS_EXPORT = [
  { key: 'year', label: 'Año', wch: 8 },
  { key: 'tipo', label: 'Tipo', wch: 10 },
  { key: 'fecha', label: 'Fecha', wch: 14 },
  { key: 'auditor', label: 'Auditor', wch: 20 },
  { key: 'alcance', label: 'Alcance', wch: 26 },
  { key: 'puntajeGlobal', label: 'Puntaje', wch: 10 },
  { key: 'hallazgos', label: 'Hallazgos', wch: 30 },
  { key: 'compromisos', label: 'Compromisos', wch: 30 },
  { key: 'estado', label: 'Estado', wch: 14 },
]

const { render } = crearModulo({
  tabla: 'auditorias',
  titulo: 'Auditoría',
  subtitulo: 'Auditorías internas, externas y revisión por la dirección',
  icono: '📄',
  labelNuevo: 'Nueva auditoría',
  ordenPor: 'fecha',
  botones: botonesDescarga({
    tabla: 'auditorias',
    titulo: 'Programa de Auditoría del SG-SST',
    columnas: COLUMNAS_EXPORT,
    nombreBase: 'SIZO_Auditorias',
  }),
  columnas: [
    { key: 'fecha', label: 'Fecha', format: fmtFecha },
    { key: 'tipo', label: 'Tipo', format: v => badge(v === 'interna' ? 'Interna' : 'Externa',
        { Interna: 'badge-brand', Externa: 'badge-neutral' }) },
    { key: 'auditor', label: 'Auditor' },
    { key: 'puntajeGlobal', label: 'Puntaje', format: v => v != null ? `${v}/100` : '—' },
    { key: 'estado', label: 'Estado', format: v => badge(v.replace('_', ' '), { [v.replace('_',' ')]: ESTADO_BADGE[v] }) },
  ],
  campos: [
    { key: 'year', label: 'Año', type: 'number', required: true, default: new Date().getFullYear() },
    { key: 'tipo', label: 'Tipo de auditoría', type: 'select', required: true, options: [
      { value: 'interna', label: 'Interna' }, { value: 'externa', label: 'Externa' } ] },
    { key: 'fecha', label: 'Fecha', type: 'date', required: true },
    { key: 'auditor', label: 'Auditor', type: 'text', required: true },
    { key: 'alcance', label: 'Alcance', type: 'textarea', ancho: 'full' },
    { key: 'puntajeGlobal', label: 'Puntaje global (0-100)', type: 'number', min: 0 },
    { key: 'hallazgos', label: 'Hallazgos', type: 'textarea', ancho: 'full' },
    { key: 'compromisos', label: 'Compromisos / plan de acción', type: 'textarea', ancho: 'full' },
    { key: 'estado', label: 'Estado', type: 'select', required: true, default: 'pendiente', options: [
      { value: 'pendiente', label: 'Pendiente' }, { value: 'en_proceso', label: 'En proceso' }, { value: 'completada', label: 'Completada' } ] },
    { key: 'obs', label: 'Observaciones', type: 'textarea', ancho: 'full' },
  ],
  antesDeGuardar: (payload) => {
    // evaluaciones detalladas por estándar Res. 0312 se modelan como jsonb; v1 guarda objeto vacío
    if (payload.evaluaciones == null) payload.evaluaciones = {}
  },
})

export { render }
