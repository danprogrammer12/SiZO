// SIZO — Capacitación (Fase 3)
import { crearModulo, fmtFecha, badge } from './_crud.js'

const { render } = crearModulo({
  tabla: 'capacitaciones',
  titulo: 'Capacitación',
  subtitulo: 'Registro de capacitaciones y evaluación de eficacia',
  icono: '📚',
  labelNuevo: 'Nueva capacitación',
  ordenPor: 'fecha',
  columnas: [
    { key: 'tema', label: 'Tema' },
    { key: 'fecha', label: 'Fecha', format: fmtFecha },
    { key: 'instructor', label: 'Instructor' },
    { key: 'modalidad', label: 'Modalidad', format: v => badge(v,
        { presencial: 'badge-brand', virtual: 'badge-neutral', mixta: 'badge-warning' }) },
    { key: 'asistentes', label: 'Asistentes' },
    { key: 'evaluada', label: 'Eficacia', format: (v, it) => v ? `✓ ${it.notaPromedio ?? '—'}/5` : '—' },
  ],
  campos: [
    { key: 'tema', label: 'Tema', type: 'text', required: true, ancho: 'full' },
    { key: 'fecha', label: 'Fecha', type: 'date', required: true },
    { key: 'duracion', label: 'Duración (horas)', type: 'number', min: 0, step: '0.5', default: 0 },
    { key: 'instructor', label: 'Instructor', type: 'text', required: true },
    { key: 'modalidad', label: 'Modalidad', type: 'select', required: true, default: 'presencial', options: [
      { value: 'presencial', label: 'Presencial' }, { value: 'virtual', label: 'Virtual' }, { value: 'mixta', label: 'Mixta' } ] },
    { key: 'asistentes', label: 'N° asistentes', type: 'number', min: 0, default: 0 },
    { key: 'metodologia', label: 'Metodología', type: 'text' },
    { key: 'evaluada', label: 'Evaluación', type: 'checkbox', checkLabel: 'Eficacia evaluada' },
    { key: 'notaPromedio', label: 'Nota promedio (0-5)', type: 'number', min: 0, step: '0.1' },
    { key: 'obs', label: 'Observaciones', type: 'textarea', ancho: 'full' },
  ],
})

export { render }
