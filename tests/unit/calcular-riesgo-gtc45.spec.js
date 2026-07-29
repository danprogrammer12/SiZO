// Motor de valoración de riesgos GTC 45 (modules/calcular-riesgo-gtc45.js).
// Función pura, sin red ni DOM — corre siempre, incluso sin .env.
import { test, expect } from '@playwright/test'
import { calcularRiesgoGtc45 } from '../../modules/calcular-riesgo-gtc45.js'

test.describe('nivelProbabilidad = ND × NE', () => {
  test('multiplica deficiencia por exposición', () => {
    const r = calcularRiesgoGtc45({ nivelDeficiencia: 6, nivelExposicion: 3, nivelConsecuencia: 25 })
    expect(r.nivelProbabilidad).toBe(18)
  })

  const casos = [
    { nd: 0, ne: 1, esperado: 0 },
    { nd: 2, ne: 4, esperado: 8 },
    { nd: 10, ne: 4, esperado: 40 },
  ]
  for (const { nd, ne, esperado } of casos) {
    test(`ND=${nd} × NE=${ne} = ${esperado}`, () => {
      const r = calcularRiesgoGtc45({ nivelDeficiencia: nd, nivelExposicion: ne, nivelConsecuencia: 10 })
      expect(r.nivelProbabilidad).toBe(esperado)
    })
  }
})

test.describe('interpretación de probabilidad (umbrales GTC 45)', () => {
  const casos = [
    { nd: 10, ne: 4, esperado: 'Muy Alto' },  // 40 >= 24
    { nd: 6, ne: 2, esperado: 'Alto' },       // 12, entre 10 y 24
    { nd: 2, ne: 3, esperado: 'Medio' },      // 6, entre 6 y 10
    { nd: 2, ne: 2, esperado: 'Bajo' },       // 4, < 6
  ]
  for (const { nd, ne, esperado } of casos) {
    test(`probabilidad=${nd * ne} → ${esperado}`, () => {
      const r = calcularRiesgoGtc45({ nivelDeficiencia: nd, nivelExposicion: ne, nivelConsecuencia: 10 })
      expect(r.interpretacionProbabilidad).toBe(esperado)
    })
  }
})

test.describe('nivelRiesgo = probabilidad × NC → zona I-IV + aceptabilidad', () => {
  test('zona I — No aceptable (nivelRiesgo >= 600)', () => {
    // probabilidad = 10*4 = 40, NC=100 → 4000
    const r = calcularRiesgoGtc45({ nivelDeficiencia: 10, nivelExposicion: 4, nivelConsecuencia: 100 })
    expect(r.nivelRiesgo).toBe(4000)
    expect(r.interpretacionRiesgo).toBe('I')
    expect(r.aceptabilidad).toBe('No aceptable')
  })

  test('zona II — No aceptable o aceptable con control específico (150 <= nivelRiesgo < 600)', () => {
    // probabilidad = 6*3 = 18, NC=25 → 450
    const r = calcularRiesgoGtc45({ nivelDeficiencia: 6, nivelExposicion: 3, nivelConsecuencia: 25 })
    expect(r.nivelRiesgo).toBe(450)
    expect(r.interpretacionRiesgo).toBe('II')
    expect(r.aceptabilidad).toBe('No aceptable o aceptable con control específico')
  })

  test('zona III — Mejorable (40 <= nivelRiesgo < 150)', () => {
    // probabilidad = 2*3 = 6, NC=10 → 60
    const r = calcularRiesgoGtc45({ nivelDeficiencia: 2, nivelExposicion: 3, nivelConsecuencia: 10 })
    expect(r.nivelRiesgo).toBe(60)
    expect(r.interpretacionRiesgo).toBe('III')
    expect(r.aceptabilidad).toBe('Mejorable')
  })

  test('zona IV — Aceptable (nivelRiesgo < 40)', () => {
    // probabilidad = 0*1 = 0, NC=10 → 0
    const r = calcularRiesgoGtc45({ nivelDeficiencia: 0, nivelExposicion: 1, nivelConsecuencia: 10 })
    expect(r.nivelRiesgo).toBe(0)
    expect(r.interpretacionRiesgo).toBe('IV')
    expect(r.aceptabilidad).toBe('Aceptable')
  })

  test('umbral exacto 600 cae en zona I (>=, no >)', () => {
    // probabilidad = 6*4 = 24, NC=25 → 600 exacto
    const r = calcularRiesgoGtc45({ nivelDeficiencia: 6, nivelExposicion: 4, nivelConsecuencia: 25 })
    expect(r.nivelRiesgo).toBe(600)
    expect(r.interpretacionRiesgo).toBe('I')
  })

  test('umbral exacto 150 cae en zona II (>=, no III)', () => {
    // probabilidad = 6*1 = 6, NC=25 → 150 exacto
    const r = calcularRiesgoGtc45({ nivelDeficiencia: 6, nivelExposicion: 1, nivelConsecuencia: 25 })
    expect(r.nivelRiesgo).toBe(150)
    expect(r.interpretacionRiesgo).toBe('II')
  })

  test('umbral exacto 40 cae en zona III (>=, no IV)', () => {
    // probabilidad = 2*2 = 4, NC=10 → 40 exacto
    const r = calcularRiesgoGtc45({ nivelDeficiencia: 2, nivelExposicion: 2, nivelConsecuencia: 10 })
    expect(r.nivelRiesgo).toBe(40)
    expect(r.interpretacionRiesgo).toBe('III')
  })
})

test('valores no numéricos/ausentes se tratan como 0, sin NaN', () => {
  const r = calcularRiesgoGtc45({})
  expect(r.nivelProbabilidad).toBe(0)
  expect(r.nivelRiesgo).toBe(0)
  expect(r.interpretacionRiesgo).toBe('IV')
  expect(Number.isNaN(r.nivelProbabilidad)).toBe(false)
  expect(Number.isNaN(r.nivelRiesgo)).toBe(false)
})
