// SIZO — Matriz de Identificación de Peligros y Valoración de Riesgos (IPVR / GTC 45)
import { crearModulo, badge } from './_crud.js'
import { calcularRiesgoGtc45 } from './calcular-riesgo-gtc45.js'
import { botonesDescarga } from '../components/exportar-plantilla.js'

const CATEGORIAS = [
  { value: 'fisico', label: 'Físico' },
  { value: 'quimico', label: 'Químico' },
  { value: 'biologico', label: 'Biológico' },
  { value: 'biomecanico', label: 'Biomecánico' },
  { value: 'condiciones_seguridad', label: 'Condiciones de seguridad' },
  { value: 'fenomenos_naturales', label: 'Fenómenos naturales' },
  { value: 'psicosocial', label: 'Psicosocial' },
]

const NIVEL_DEFICIENCIA = [
  { value: 10, label: 'Muy Alto (10)' },
  { value: 6,  label: 'Alto (6)' },
  { value: 2,  label: 'Medio (2)' },
  { value: 0,  label: 'Bajo (0)' },
]

const NIVEL_EXPOSICION = [
  { value: 4, label: 'Continua (4)' },
  { value: 3, label: 'Frecuente (3)' },
  { value: 2, label: 'Ocasional (2)' },
  { value: 1, label: 'Esporádica (1)' },
]

const NIVEL_CONSECUENCIA = [
  { value: 100, label: 'Mortal / Catastrófico (100)' },
  { value: 60,  label: 'Muy Grave (60)' },
  { value: 25,  label: 'Grave (25)' },
  { value: 10,  label: 'Leve (10)' },
]

const ACEPTABILIDAD_BADGE = {
  'No aceptable': 'badge-danger',
  'No aceptable o aceptable con control específico': 'badge-danger',
  'Mejorable': 'badge-warning',
  'Aceptable': 'badge-success',
}

const COLUMNAS_EXPORT = [
  { key: 'proceso', label: 'Proceso', wch: 18 },
  { key: 'zonaLugar', label: 'Zona / lugar', wch: 16 },
  { key: 'actividad', label: 'Actividad', wch: 18 },
  { key: 'tarea', label: 'Tarea', wch: 16 },
  { key: 'peligroCategoria', label: 'Categoría', wch: 14 },
  { key: 'peligroDescripcion', label: 'Peligro', wch: 26 },
  { key: 'fuente', label: 'Fuente', wch: 16 },
  { key: 'controlesFuente', label: 'Control fuente', wch: 16 },
  { key: 'controlesMedio', label: 'Control medio', wch: 16 },
  { key: 'controlesIndividuo', label: 'Control individuo', wch: 16 },
  { key: 'numExpuestos', label: 'N.° expuestos', wch: 10 },
  { key: 'nivelDeficiencia', label: 'ND', wch: 6 },
  { key: 'nivelExposicion', label: 'NE', wch: 6 },
  { key: 'nivelProbabilidad', label: 'NP', wch: 6 },
  { key: 'interpretacionProbabilidad', label: 'Interp. NP', wch: 12 },
  { key: 'nivelConsecuencia', label: 'NC', wch: 6 },
  { key: 'nivelRiesgo', label: 'NR', wch: 8 },
  { key: 'interpretacionRiesgo', label: 'Zona', wch: 8 },
  { key: 'aceptabilidad', label: 'Aceptabilidad', wch: 22 },
  { key: 'controlesPropuestos', label: 'Controles propuestos', wch: 26 },
]

const { render } = crearModulo({
  tabla: 'matriz_riesgos',
  titulo: 'Matriz de Riesgos',
  subtitulo: 'Identificación de peligros y valoración de riesgos (GTC 45)',
  icono: '🛡️',
  labelNuevo: 'Nuevo peligro',
  ordenPor: 'creadoEn',
  botones: botonesDescarga({
    tabla: 'matriz_riesgos',
    titulo: 'Matriz de Identificación de Peligros y Valoración de Riesgos (GTC 45)',
    subtitulo: 'IPVR',
    columnas: COLUMNAS_EXPORT,
    nombreBase: 'SIZO_Matriz_Riesgos',
    urlOficial: 'https://planeacion.uniandes.edu.co/images/Formatos/SG-SST/FOR-45-1-05-01_Formato_matriz_de_peligros_y_riesgos.xlsx',
  }),
  columnas: [
    { key: 'proceso', label: 'Proceso' },
    { key: 'peligroCategoria', label: 'Categoría',
      format: v => badge(CATEGORIAS.find(c => c.value === v)?.label || v, {}) },
    { key: 'peligroDescripcion', label: 'Peligro' },
    { key: 'nivelRiesgo', label: 'Nivel de riesgo',
      format: (v, it) => v != null ? `${v} (${it.interpretacionRiesgo})` : '—' },
    { key: 'aceptabilidad', label: 'Aceptabilidad',
      format: v => v ? badge(v, ACEPTABILIDAD_BADGE) : '—' },
  ],
  campos: [
    { key: 'proceso', label: 'Proceso', type: 'text', required: true },
    { key: 'zonaLugar', label: 'Zona / lugar', type: 'text' },
    { key: 'actividad', label: 'Actividad', type: 'text', required: true },
    { key: 'rutinaria', label: 'Actividad rutinaria', type: 'checkbox', checkLabel: 'Sí', default: true },
    { key: 'tarea', label: 'Tarea', type: 'text' },
    { key: 'peligroCategoria', label: 'Categoría del peligro', type: 'select', required: true, options: CATEGORIAS },
    { key: 'peligroDescripcion', label: 'Descripción del peligro', type: 'text', required: true, ancho: 'full' },
    { key: 'fuente', label: 'Fuente del peligro', type: 'text' },
    { key: 'numExpuestos', label: 'N.° de expuestos', type: 'number', min: 0, default: 1 },
    { key: 'peorConsecuencia', label: 'Peor consecuencia', type: 'text' },
    { key: 'efectosPosibles', label: 'Efectos posibles', type: 'textarea', ancho: 'full' },
    { key: 'controlesFuente', label: 'Controles en la fuente', type: 'text' },
    { key: 'controlesMedio', label: 'Controles en el medio', type: 'text' },
    { key: 'controlesIndividuo', label: 'Controles en el individuo', type: 'text' },
    { key: 'nivelDeficiencia', label: 'Nivel de deficiencia', type: 'select', required: true, default: 2, options: NIVEL_DEFICIENCIA },
    { key: 'nivelExposicion', label: 'Nivel de exposición', type: 'select', required: true, default: 2, options: NIVEL_EXPOSICION },
    { key: 'nivelConsecuencia', label: 'Nivel de consecuencia', type: 'select', required: true, default: 25, options: NIVEL_CONSECUENCIA },
    { key: 'controlesPropuestos', label: 'Controles propuestos / medidas de intervención', type: 'textarea', ancho: 'full' },
  ],
  antesDeGuardar: (payload) => {
    // Los selects llegan como string desde el form — normalizar antes de calcular y guardar
    payload.nivelDeficiencia  = Number(payload.nivelDeficiencia)
    payload.nivelExposicion   = Number(payload.nivelExposicion)
    payload.nivelConsecuencia = Number(payload.nivelConsecuencia)
    Object.assign(payload, calcularRiesgoGtc45(payload))
  },
})

export { render }
