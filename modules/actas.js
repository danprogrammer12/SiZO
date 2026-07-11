// SIZO — Actas COPASST y Comité de Convivencia Laboral
import { crearModulo, fmtFecha, badge } from './_crud.js'
import { botonesDescarga } from '../components/exportar-plantilla.js'

const TIPOS = [
  { value: 'copasst', label: 'COPASST' },
  { value: 'convivencia', label: 'Comité de Convivencia' },
]

const COLUMNAS_EXPORT = [
  { key: 'tipo', label: 'Comité', wch: 20 },
  { key: 'fecha', label: 'Fecha', wch: 14 },
  { key: 'ordenDia', label: 'Orden del día', wch: 30 },
  { key: 'desarrollo', label: 'Desarrollo', wch: 36 },
  { key: 'compromisos', label: 'Compromisos', wch: 30 },
  { key: 'responsable', label: 'Responsable', wch: 20 },
  { key: 'fechaProximaReunion', label: 'Próxima reunión', wch: 16 },
]

const { render } = crearModulo({
  tabla: 'actas',
  titulo: 'Actas de Comités',
  subtitulo: 'Actas de reunión COPASST y Comité de Convivencia Laboral',
  icono: '📝',
  labelNuevo: 'Nueva acta',
  ordenPor: 'fecha',
  botones: botonesDescarga({
    tabla: 'actas',
    titulo: 'Acta de Comité (COPASST / Convivencia Laboral)',
    columnas: COLUMNAS_EXPORT,
    nombreBase: 'SIZO_Actas_Comites',
    urlOficial: 'https://historico.santander.gov.co/intra/index.php/sig/viewdownload/628-2-formatos/10298-acta-conformacion-de-copasst',
  }),
  columnas: [
    { key: 'fecha', label: 'Fecha', format: fmtFecha },
    { key: 'tipo', label: 'Comité', format: v => badge(TIPOS.find(t => t.value === v)?.label || v,
        { COPASST: 'badge-brand', 'Comité de Convivencia': 'badge-neutral' }) },
    { key: 'responsable', label: 'Responsable' },
    { key: 'fechaProximaReunion', label: 'Próxima reunión', format: fmtFecha },
  ],
  campos: [
    { key: 'tipo', label: 'Comité', type: 'select', required: true, options: TIPOS },
    { key: 'fecha', label: 'Fecha de la reunión', type: 'date', required: true },
    { key: 'ordenDia', label: 'Orden del día', type: 'textarea', ancho: 'full' },
    { key: 'desarrollo', label: 'Desarrollo de la reunión', type: 'textarea', ancho: 'full' },
    { key: 'compromisos', label: 'Compromisos', type: 'textarea', ancho: 'full' },
    { key: 'responsable', label: 'Responsable del acta', type: 'text' },
    { key: 'fechaProximaReunion', label: 'Fecha próxima reunión', type: 'date' },
  ],
  antesDeGuardar: (payload) => {
    if (payload.asistentes == null) payload.asistentes = []
  },
})

export { render }
