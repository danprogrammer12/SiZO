// Motor de indicadores Dec. 1072 / Res. 0312 (modules/calcular-indicadores.js).
// Función pura, sin red ni DOM — corre siempre, incluso sin .env.
//
// Guarda de regresión crítica (H12 en CLAUDE.md): IFA/IFM/ISA deben usar
// SIEMPRE la base 240.000 HHT (Dec. 1072 Art. 2.2.4.1.7). incidenciaEl usa
// una escala DISTINTA, 100.000 (Res. 0312/2019) sobre trabajadores, no HHT.
// Si alguien "unifica" las escalas por error, estos tests deben romperse.
import { test, expect } from '@playwright/test'
import { calcularIndicadores } from '../../modules/calcular-indicadores.js'

const BASE_SEG = { trab: 10, diasTrab: 22 } // HHT = 10 × 22 × 8 = 1760

test.describe('IFA / IFM / ISA — base constante 240.000 HHT (Dec. 1072)', () => {
  test('IFA = (AT × 240.000) / HHT', () => {
    const hht = 10 * 22 * 8
    const r = calcularIndicadores({ ...BASE_SEG, atOc: 3 })
    expect(r.ifa).toBe(+((3 * 240000) / hht).toFixed(2))
  })

  test('IFM = (AT mortales × 240.000) / HHT', () => {
    const hht = 10 * 22 * 8
    const r = calcularIndicadores({ ...BASE_SEG, atMort: 1 })
    expect(r.ifm).toBe(+((1 * 240000) / hht).toFixed(2))
  })

  test('ISA = (días cargados × 240.000) / HHT', () => {
    const hht = 10 * 22 * 8
    const r = calcularIndicadores({ ...BASE_SEG, diasCarg: 15 })
    expect(r.isa).toBe(+((15 * 240000) / hht).toFixed(2))
  })

  test('sin eventos (atOc/atMort/diasCarg = 0), los índices son 0 exacto', () => {
    const r = calcularIndicadores({ ...BASE_SEG, atOc: 0, atMort: 0, diasCarg: 0 })
    expect(r.ifa).toBe(0)
    expect(r.ifm).toBe(0)
    expect(r.isa).toBe(0)
  })

  test('HHT usa por defecto diasTrab=22 si no se especifica', () => {
    const r = calcularIndicadores({ trab: 10, atOc: 1 })
    const hht = 10 * 22 * 8
    expect(r.ifa).toBe(+((1 * 240000) / hht).toFixed(2))
  })
})

test('ILI = (IFA × ISA) / 1.000', () => {
  const r = calcularIndicadores({ ...BASE_SEG, atOc: 3, diasCarg: 15 })
  expect(r.ili).toBe(+((r.ifa * r.isa) / 1000).toFixed(4))
})

test.describe('incidenciaEl — base 100.000 sobre trabajadores (Res. 0312/2019), NO 240.000 HHT', () => {
  test('usa 100.000 / trab, no 240.000 / HHT', () => {
    const r = calcularIndicadores({ ...BASE_SEG, casosEl: 2 })
    const esperadoCorrecto = +((2 * 100000) / 10).toFixed(2)
    const conFactorEquivocado = +((2 * 240000) / (10 * 22 * 8)).toFixed(2)
    expect(r.incidenciaEl).toBe(esperadoCorrecto)
    expect(r.incidenciaEl).not.toBe(conFactorEquivocado)
  })

  test('sin casos de EL, incidenciaEl es 0', () => {
    const r = calcularIndicadores({ ...BASE_SEG, casosEl: 0 })
    expect(r.incidenciaEl).toBe(0)
  })
})

test.describe('indicadores de proceso (ejecutado/programado × 100)', () => {
  test('plan = actEjec / actProg × 100', () => {
    const r = calcularIndicadores({ ...BASE_SEG, actProg: 20, actEjec: 15 })
    expect(r.plan).toBe(75)
  })

  test('cap = capEjec / capProg × 100', () => {
    const r = calcularIndicadores({ ...BASE_SEG, capProg: 4, capEjec: 4 })
    expect(r.cap).toBe(100)
  })

  test('sin programación (prog=0), el indicador es 0 (evita división por cero)', () => {
    const r = calcularIndicadores({ ...BASE_SEG, actProg: 0, actEjec: 5 })
    expect(r.plan).toBe(0)
  })
})

test('aus = díasAus / (trab × díasTrab) × 100', () => {
  const r = calcularIndicadores({ trab: 10, diasTrab: 22, diasAus: 11 })
  expect(r.aus).toBe(+((11 / (10 * 22)) * 100).toFixed(2))
})
