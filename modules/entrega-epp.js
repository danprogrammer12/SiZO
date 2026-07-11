// SIZO — Entrega individual de EPP (evidencia firmada, Dec. 1072/2015 Art. 2.2.4.6.24)
import { crearModulo, fmtFecha, badge } from './_crud.js'

const { render } = crearModulo({
  tabla: 'entrega_epp',
  titulo: 'Entrega de EPP',
  subtitulo: 'Registro de entrega individual de elementos de protección personal',
  icono: '📦',
  labelNuevo: 'Nueva entrega',
  ordenPor: 'fechaEntrega',
  columnas: [
    { key: 'fechaEntrega', label: 'Fecha', format: fmtFecha },
    { key: 'trabajador', label: 'Trabajador' },
    { key: 'eppEntregado', label: 'EPP entregado' },
    { key: 'cantidad', label: 'Cant.' },
    { key: 'firmado', label: 'Firmado', format: v =>
        v ? badge('Sí', { 'Sí': 'badge-success' }) : badge('Pendiente', { Pendiente: 'badge-warning' }) },
  ],
  campos: [
    { key: 'trabajador', label: 'Trabajador', type: 'text', required: true },
    { key: 'cargo', label: 'Cargo', type: 'text' },
    { key: 'eppEntregado', label: 'EPP entregado', type: 'text', required: true, ancho: 'full' },
    { key: 'cantidad', label: 'Cantidad', type: 'number', min: 1, default: 1, required: true },
    { key: 'talla', label: 'Talla', type: 'text' },
    { key: 'fechaEntrega', label: 'Fecha de entrega', type: 'date', required: true },
    { key: 'fechaProximaReposicion', label: 'Próxima reposición', type: 'date' },
    { key: 'firmado', label: 'Confirmación', type: 'checkbox', checkLabel: 'Trabajador firmó la entrega' },
    { key: 'observaciones', label: 'Observaciones', type: 'textarea', ancho: 'full' },
  ],
})

export { render }
