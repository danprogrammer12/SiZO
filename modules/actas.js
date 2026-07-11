// SIZO — Actas COPASST y Comité de Convivencia Laboral
import { crearModulo, fmtFecha, badge } from './_crud.js'

const TIPOS = [
  { value: 'copasst', label: 'COPASST' },
  { value: 'convivencia', label: 'Comité de Convivencia' },
]

const { render } = crearModulo({
  tabla: 'actas',
  titulo: 'Actas de Comités',
  subtitulo: 'Actas de reunión COPASST y Comité de Convivencia Laboral',
  icono: '📝',
  labelNuevo: 'Nueva acta',
  ordenPor: 'fecha',
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
