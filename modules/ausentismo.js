// SIZO — Ausentismo (Fase 3)
import { crearModulo, fmtFecha, badge } from './_crud.js'
import { abrirVerificadorARL, abrirPortalADRES } from '../components/verificar-arl.js'

const CAUSA_LABEL = {
  AT: 'Accidente trabajo', EL: 'Enf. laboral', EG: 'Enf. general',
  licencia_maternidad: 'Lic. maternidad', licencia_paternidad: 'Lic. paternidad',
  licencia_luto: 'Lic. luto', licencia_remunerada: 'Lic. remunerada', otra: 'Otra',
}
const CAUSA_BADGE = { AT: 'badge-danger', EL: 'badge-warning', EG: 'badge-brand' }

const { render } = crearModulo({
  botones: [
    { label: '🔍 Consultar ARL', clase: 'btn-secondary', onClick: abrirVerificadorARL },
    { label: '🌐 Consultar ADRES', clase: 'btn-secondary', onClick: abrirPortalADRES },
  ],
  tabla: 'ausencias',
  titulo: 'Ausentismo',
  subtitulo: 'Registro de ausencias e incapacidades',
  icono: '📅',
  labelNuevo: 'Registrar ausencia',
  ordenPor: 'fechaInicio',
  columnas: [
    { key: 'trabajador', label: 'Trabajador' },
    { key: 'causa', label: 'Causa', format: v => badge(CAUSA_LABEL[v] || v, { [CAUSA_LABEL[v]]: CAUSA_BADGE[v] || 'badge-neutral' }) },
    { key: 'fechaInicio', label: 'Inicio', format: fmtFecha },
    { key: 'fechaFin', label: 'Fin', format: fmtFecha },
    { key: 'dias', label: 'Días' },
    { key: 'certificado', label: 'Certificado', format: v => v ? '✓' : '—' },
  ],
  campos: [
    { key: 'trabajador', label: 'Trabajador', type: 'text', required: true },
    { key: 'cargo', label: 'Cargo', type: 'text' },
    { key: 'causa', label: 'Causa', type: 'select', required: true, options:
      Object.entries(CAUSA_LABEL).map(([value, label]) => ({ value, label })) },
    { key: 'diagnostico', label: 'Diagnóstico', type: 'text' },
    { key: 'fechaInicio', label: 'Fecha inicio', type: 'date', required: true },
    { key: 'fechaFin', label: 'Fecha fin', type: 'date' },
    { key: 'certificado', label: 'Soporte', type: 'checkbox', checkLabel: 'Tiene certificado / incapacidad' },
    { key: 'obs', label: 'Observaciones', type: 'textarea', ancho: 'full' },
  ],
  antesDeGuardar: (payload) => {
    if (payload.fechaInicio && payload.fechaFin) {
      const ini = new Date(payload.fechaInicio), fin = new Date(payload.fechaFin)
      payload.dias = Math.max(0, Math.round((fin - ini) / 864e5) + 1)
    } else {
      payload.dias = payload.dias || 1
    }
  },
})

export { render }
