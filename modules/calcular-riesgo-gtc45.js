// Motor de valoración de riesgos GTC 45 — función pura sin dependencias de DOM
// (mismo patrón que calcular-indicadores.js: importable desde Node y browser)
export function calcularRiesgoGtc45({ nivelDeficiencia, nivelExposicion, nivelConsecuencia }) {
  const nd = Number(nivelDeficiencia) || 0
  const ne = Number(nivelExposicion)  || 0
  const nc = Number(nivelConsecuencia) || 0

  const nivelProbabilidad = nd * ne

  let interpretacionProbabilidad
  if (nivelProbabilidad >= 24)      interpretacionProbabilidad = 'Muy Alto'
  else if (nivelProbabilidad >= 10) interpretacionProbabilidad = 'Alto'
  else if (nivelProbabilidad >= 6)  interpretacionProbabilidad = 'Medio'
  else                              interpretacionProbabilidad = 'Bajo'

  const nivelRiesgo = nivelProbabilidad * nc

  let interpretacionRiesgo, aceptabilidad
  if (nivelRiesgo >= 600) {
    interpretacionRiesgo = 'I'
    aceptabilidad = 'No aceptable'
  } else if (nivelRiesgo >= 150) {
    interpretacionRiesgo = 'II'
    aceptabilidad = 'No aceptable o aceptable con control específico'
  } else if (nivelRiesgo >= 40) {
    interpretacionRiesgo = 'III'
    aceptabilidad = 'Mejorable'
  } else {
    interpretacionRiesgo = 'IV'
    aceptabilidad = 'Aceptable'
  }

  return { nivelProbabilidad, interpretacionProbabilidad, nivelRiesgo, interpretacionRiesgo, aceptabilidad }
}
