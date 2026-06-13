// SIZO — Acciones ACPM (Fase 3)
import { crearModulo, fmtFecha, badge } from './_crud.js'

const ESTADO_BADGE = { abierta: 'badge-brand', en_progreso: 'badge-warning', cerrada: 'badge-success', vencida: 'badge-danger' }
const PRIOR_BADGE  = { alta: 'badge-danger', media: 'badge-warning', baja: 'badge-neutral' }

const { render } = crearModulo({
  tabla: 'acciones',
  titulo: 'Acciones ACPM',
  subtitulo: 'Acciones correctivas, preventivas y de mejora',
  icono: '⚡',
  labelNuevo: 'Nueva acción',
  ordenPor: 'fechaLimite',
  columnas: [
    { key: 'descripcion', label: 'Descripción', format: v => v?.length > 60 ? v.slice(0, 60) + '…' : v },
    { key: 'tipo', label: 'Tipo' },
    { key: 'prioridad', label: 'Prioridad', format: v => badge(v, PRIOR_BADGE) },
    { key: 'estado', label: 'Estado', format: v => badge(v.replace('_', ' '), { [v.replace('_',' ')]: ESTADO_BADGE[v] }) },
    { key: 'fechaLimite', label: 'Límite', format: fmtFecha },
    { key: 'responsable', label: 'Responsable' },
  ],
  campos: [
    { key: 'tipo', label: 'Tipo', type: 'select', required: true, options: [
      { value: 'correctiva', label: 'Correctiva' }, { value: 'preventiva', label: 'Preventiva' }, { value: 'mejora', label: 'Mejora' } ] },
    { key: 'origen', label: 'Origen', type: 'select', required: true, options: [
      { value: 'inspeccion', label: 'Inspección' }, { value: 'accidente', label: 'Accidente' }, { value: 'auditoria', label: 'Auditoría' },
      { value: 'seguimiento', label: 'Seguimiento' }, { value: 'revision_direccion', label: 'Revisión dirección' }, { value: 'otro', label: 'Otro' } ] },
    { key: 'descripcion', label: 'Descripción', type: 'textarea', required: true, ancho: 'full' },
    { key: 'responsable', label: 'Responsable', type: 'text', required: true },
    { key: 'fechaLimite', label: 'Fecha límite', type: 'date', required: true },
    { key: 'prioridad', label: 'Prioridad', type: 'select', required: true, default: 'media', options: [
      { value: 'alta', label: 'Alta' }, { value: 'media', label: 'Media' }, { value: 'baja', label: 'Baja' } ] },
    { key: 'estado', label: 'Estado', type: 'select', required: true, default: 'abierta', options: [
      { value: 'abierta', label: 'Abierta' }, { value: 'en_progreso', label: 'En progreso' }, { value: 'cerrada', label: 'Cerrada' } ] },
    { key: 'obs', label: 'Observaciones', type: 'textarea', ancho: 'full' },
  ],
  antesDeGuardar: (payload) => {
    payload.fechaCierre = payload.estado === 'cerrada' ? new Date().toISOString() : null
  },
})

export { render }
