// SIZO — Inspecciones (Fase 3)
import { crearModulo, fmtFecha, badge } from './_crud.js'

const { render } = crearModulo({
  tabla: 'inspecciones',
  titulo: 'Inspecciones',
  subtitulo: 'Inspecciones planeadas y no planeadas de seguridad',
  icono: '🔍',
  labelNuevo: 'Nueva inspección',
  ordenPor: 'fecha',
  columnas: [
    { key: 'fecha', label: 'Fecha', format: fmtFecha },
    { key: 'area', label: 'Área' },
    { key: 'inspector', label: 'Inspector' },
    { key: 'tipo', label: 'Tipo', format: v => badge(v === 'planeada' ? 'Planeada' : 'No planeada',
        { Planeada: 'badge-brand', 'No planeada': 'badge-warning' }) },
    { key: 'calificacion', label: 'Calificación', format: v => v != null ? `${v}/100` : '—' },
  ],
  campos: [
    { key: 'fecha', label: 'Fecha', type: 'date', required: true },
    { key: 'area', label: 'Área inspeccionada', type: 'text', required: true },
    { key: 'inspector', label: 'Inspector', type: 'text', required: true },
    { key: 'tipo', label: 'Tipo', type: 'select', required: true, default: 'planeada', options: [
      { value: 'planeada', label: 'Planeada' }, { value: 'no_planeada', label: 'No planeada' } ] },
    { key: 'calificacion', label: 'Calificación (0-100)', type: 'number', min: 0, default: 0 },
    { key: 'obs', label: 'Hallazgos y observaciones', type: 'textarea', ancho: 'full' },
  ],
  antesDeGuardar: (payload) => {
    // hallazgos detallados se modelan como jsonb; v1 guarda arreglo vacío
    if (payload.hallazgos == null) payload.hallazgos = []
  },
})

export { render }
