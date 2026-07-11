// SIZO — Matriz de Elementos de Protección Personal (EPP)
import { crearModulo, badge } from './_crud.js'
import { botonesDescarga } from '../components/exportar-plantilla.js'

const ZONAS = [
  { value: 'cabeza', label: 'Cabeza' },
  { value: 'ojos_cara', label: 'Ojos / cara' },
  { value: 'oidos', label: 'Oídos' },
  { value: 'manos', label: 'Manos' },
  { value: 'pies', label: 'Pies' },
  { value: 'cuerpo', label: 'Cuerpo' },
  { value: 'vias_respiratorias', label: 'Vías respiratorias' },
  { value: 'altura', label: 'Trabajo en altura' },
]

const COLUMNAS_EXPORT = [
  { key: 'cargo', label: 'Cargo', wch: 20 },
  { key: 'peligroAsociado', label: 'Peligro asociado', wch: 24 },
  { key: 'eppRequerido', label: 'EPP requerido', wch: 26 },
  { key: 'zonaCuerpo', label: 'Zona del cuerpo', wch: 18 },
  { key: 'normaTecnica', label: 'Norma técnica', wch: 18 },
  { key: 'frecuenciaReposicion', label: 'Frecuencia de reposición', wch: 22 },
]

const { render } = crearModulo({
  tabla: 'matriz_epp',
  titulo: 'Matriz de EPP',
  subtitulo: 'Elementos de protección personal requeridos por cargo',
  icono: '🦺',
  labelNuevo: 'Nuevo EPP requerido',
  ordenPor: 'creadoEn',
  botones: botonesDescarga({
    tabla: 'matriz_epp',
    titulo: 'Matriz de Elementos de Protección Personal (EPP)',
    columnas: COLUMNAS_EXPORT,
    nombreBase: 'SIZO_Matriz_EPP',
    urlOficial: 'https://www.verifty.com/recursos/matriz-epp',
  }),
  columnas: [
    { key: 'cargo', label: 'Cargo' },
    { key: 'eppRequerido', label: 'EPP requerido' },
    { key: 'zonaCuerpo', label: 'Zona', format: v => v ? badge(ZONAS.find(z => z.value === v)?.label || v, {}) : '—' },
    { key: 'normaTecnica', label: 'Norma técnica' },
    { key: 'frecuenciaReposicion', label: 'Reposición' },
  ],
  campos: [
    { key: 'cargo', label: 'Cargo', type: 'text', required: true },
    { key: 'peligroAsociado', label: 'Peligro asociado', type: 'text' },
    { key: 'eppRequerido', label: 'EPP requerido', type: 'text', required: true, ancho: 'full' },
    { key: 'zonaCuerpo', label: 'Zona del cuerpo', type: 'select', options: ZONAS },
    { key: 'normaTecnica', label: 'Norma técnica (NTC/ANSI/NIOSH)', type: 'text' },
    { key: 'frecuenciaReposicion', label: 'Frecuencia de reposición', type: 'text' },
  ],
})

export { render }
