// SIZO — Casos Médicos (AT, EL, EG) — acceso restringido a ADMIN
// El gating de ruta vive en router.js (rolesPermitidos.casos = ['ADMIN']);
// la RLS real está en casos_medicos ("solo ADMIN", policy for all).
import { crearModulo, fmtFecha, badge } from './_crud.js'

const TIPO_BADGE   = { AT: 'badge-danger', EL: 'badge-warning', EG: 'badge-neutral' }
const ESTADO_BADGE = { abierto: 'badge-brand', en_seguimiento: 'badge-warning', cerrado: 'badge-success' }

const { render } = crearModulo({
  tabla: 'casos_medicos',
  titulo: 'Casos Médicos',
  subtitulo: 'Seguimiento de casos de accidente de trabajo, enfermedad laboral y general',
  icono: '🩺',
  labelNuevo: 'Nuevo caso',
  ordenPor: 'fechaApertura',
  columnas: [
    { key: 'trabajador', label: 'Trabajador' },
    { key: 'tipo', label: 'Tipo', format: v => badge(v, TIPO_BADGE) },
    { key: 'diagnostico', label: 'Diagnóstico' },
    { key: 'fechaApertura', label: 'Apertura', format: fmtFecha },
    { key: 'estado', label: 'Estado', format: v => badge(v.replace('_', ' '), { [v.replace('_',' ')]: ESTADO_BADGE[v] }) },
    { key: 'reubicacion', label: 'Reubicación', format: v => v ? badge('Sí', { 'Sí': 'badge-warning' }) : '—' },
  ],
  campos: [
    { key: 'trabajador', label: 'Trabajador', type: 'text', required: true },
    { key: 'cargo', label: 'Cargo', type: 'text' },
    { key: 'tipo', label: 'Tipo de caso', type: 'select', required: true, options: [
      { value: 'AT', label: 'Accidente de trabajo' }, { value: 'EL', label: 'Enfermedad laboral' }, { value: 'EG', label: 'Enfermedad general' } ] },
    { key: 'diagnostico', label: 'Diagnóstico', type: 'text', required: true, ancho: 'full' },
    { key: 'cie10', label: 'Código CIE-10', type: 'text' },
    { key: 'fechaApertura', label: 'Fecha de apertura', type: 'date', required: true },
    { key: 'fechaCierre', label: 'Fecha de cierre', type: 'date' },
    { key: 'estado', label: 'Estado', type: 'select', required: true, default: 'abierto', options: [
      { value: 'abierto', label: 'Abierto' }, { value: 'en_seguimiento', label: 'En seguimiento' }, { value: 'cerrado', label: 'Cerrado' } ] },
    { key: 'reubicacion', label: 'Restricciones laborales', type: 'checkbox', checkLabel: 'Requiere reubicación laboral' },
    { key: 'restricciones', label: 'Detalle de restricciones', type: 'textarea', ancho: 'full' },
    { key: 'obs', label: 'Observaciones', type: 'textarea', ancho: 'full' },
  ],
})

export { render }
