// SIZO — Plan de Trabajo Anual (Fase 3)
import { crearModulo, badge, MESES } from './_crud.js'

const COMP_LABEL = {
  politica: 'Política', planificacion: 'Planificación', implementacion: 'Implementación',
  verificacion: 'Verificación', mejora: 'Mejora',
}
const ESTADO_BADGE = { pendiente: 'badge-neutral', en_progreso: 'badge-warning', completada: 'badge-success', cancelada: 'badge-danger' }

const añoActual = new Date().getFullYear()

const { render } = crearModulo({
  tabla: 'plan_actividades',
  titulo: 'Plan de Trabajo',
  subtitulo: 'Plan anual de actividades SG-SST por componente (PHVA)',
  icono: '🗓️',
  labelNuevo: 'Nueva actividad',
  ordenPor: 'mes',
  columnas: [
    { key: 'actividad', label: 'Actividad' },
    { key: 'componente', label: 'Componente', format: v => badge(COMP_LABEL[v] || v, { [COMP_LABEL[v]]: 'badge-brand' }) },
    { key: 'mes', label: 'Mes', format: v => MESES[v - 1] || v },
    { key: 'responsable', label: 'Responsable' },
    { key: 'estado', label: 'Estado', format: v => badge(v.replace('_', ' '), { [v.replace('_',' ')]: ESTADO_BADGE[v] }) },
  ],
  campos: [
    { key: 'actividad', label: 'Actividad', type: 'text', required: true, ancho: 'full' },
    { key: 'componente', label: 'Componente PHVA', type: 'select', required: true, options:
      Object.entries(COMP_LABEL).map(([value, label]) => ({ value, label })) },
    { key: 'year', label: 'Año', type: 'number', required: true, default: añoActual },
    { key: 'mes', label: 'Mes programado', type: 'select', required: true, options:
      MESES.map((m, i) => ({ value: i + 1, label: m })) },
    { key: 'responsable', label: 'Responsable', type: 'text', required: true },
    { key: 'presupuesto', label: 'Presupuesto (COP)', type: 'number', min: 0 },
    { key: 'estado', label: 'Estado', type: 'select', required: true, default: 'pendiente', options: [
      { value: 'pendiente', label: 'Pendiente' }, { value: 'en_progreso', label: 'En progreso' },
      { value: 'completada', label: 'Completada' }, { value: 'cancelada', label: 'Cancelada' } ] },
    { key: 'obs', label: 'Observaciones', type: 'textarea', ancho: 'full' },
  ],
})

export { render }
