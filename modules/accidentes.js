// SIZO — Accidentalidad (Fase 3)
import { crearModulo, fmtFecha, badge } from './_crud.js'
import { abrirVerificadorARL, abrirPortalADRES } from '../components/verificar-arl.js'

const { render } = crearModulo({
  botones: [
    { label: '🔍 Consultar ARL', clase: 'btn-secondary', onClick: abrirVerificadorARL },
    { label: '🌐 Consultar ADRES', clase: 'btn-secondary', onClick: abrirPortalADRES },
  ],
  tabla: 'accidentes',
  titulo: 'Accidentalidad',
  subtitulo: 'Registro y seguimiento de accidentes de trabajo',
  icono: '⚠️',
  labelNuevo: 'Reportar AT',
  ordenPor: 'fecha',
  columnas: [
    { key: 'fecha', label: 'Fecha', format: fmtFecha },
    { key: 'trabajador', label: 'Trabajador' },
    { key: 'area', label: 'Área' },
    { key: 'diasIncapacidad', label: 'Días incap.' },
    { key: 'esMortal', label: 'Gravedad', format: (_, it) =>
        it.esMortal ? badge('Mortal', { Mortal: 'badge-danger' })
        : it.esGrave ? badge('Grave', { Grave: 'badge-warning' })
        : badge('Leve', { Leve: 'badge-neutral' }) },
    { key: 'investigado', label: 'Investigado', format: v =>
        v ? badge('Sí', { 'Sí': 'badge-success' }) : badge('No', { No: 'badge-warning' }) },
  ],
  campos: [
    { key: 'trabajador', label: 'Trabajador', type: 'text', required: true },
    { key: 'cargo', label: 'Cargo', type: 'text' },
    { key: 'area', label: 'Área', type: 'text' },
    { key: 'tipoVinculacion', label: 'Vinculación', type: 'select', options: [
      { value: 'directa', label: 'Directa' }, { value: 'contratista', label: 'Contratista' }, { value: 'temporal', label: 'Temporal' } ] },
    { key: 'fecha', label: 'Fecha del evento', type: 'date', required: true },
    { key: 'hora', label: 'Hora (HH:MM)', type: 'text' },
    { key: 'lugar', label: 'Lugar', type: 'text', ancho: 'full' },
    { key: 'descripcion', label: 'Descripción', type: 'textarea', required: true, ancho: 'full' },
    { key: 'tipoLesion', label: 'Tipo de lesión', type: 'text' },
    { key: 'parteAfectada', label: 'Parte afectada', type: 'text' },
    { key: 'diasIncapacidad', label: 'Días de incapacidad', type: 'number', min: 0, required: true, default: 0 },
    { key: 'esGrave', label: 'Clasificación', type: 'checkbox', checkLabel: 'Accidente grave' },
    { key: 'esMortal', label: ' ', type: 'checkbox', checkLabel: 'Accidente mortal' },
    { key: 'investigado', label: 'Investigación', type: 'checkbox', checkLabel: 'Investigado (≤15 días hábiles)' },
    { key: 'fechaInvestigacion', label: 'Fecha investigación', type: 'date' },
    { key: 'causasInmediatas', label: 'Causas inmediatas (actos y condiciones subestándar)', type: 'textarea', ancho: 'full' },
    { key: 'causasBasicas', label: 'Causas básicas', type: 'textarea', ancho: 'full' },
    { key: 'factoresPersonales', label: 'Factores personales', type: 'textarea', ancho: 'full' },
    { key: 'factoresTrabajo', label: 'Factores de trabajo', type: 'textarea', ancho: 'full' },
  ],
})

export { render }
