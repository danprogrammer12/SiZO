// SIZO — Regresión H4: conversión de claves preserva JSONB (round-trip verbatim)
// Ejercita el CÓDIGO REAL (case-convert.js, sin red ni esm.sh).
//
//   node testing/QA/poc-jsonb-roundtrip.mjs   (o: npm run test:unit)
//
// Fija el contrato: las columnas de nivel superior se convierten camel↔snake,
// pero el CONTENIDO de las columnas JSONB se preserva tal cual. Si alguien
// hace que la conversión recurra en profundidad, este test debe FALLAR.

import { toRow, fromRow } from '../../case-convert.js'

let pass = 0, fail = 0
function check(nombre, ok, detalle) {
  console.log(`  ${ok ? '✓ PASS' : '✗ FAIL'}  ${nombre}${detalle ? ` — ${detalle}` : ''}`)
  ok ? pass++ : fail++
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

console.log('═══ H4 — Round-trip de conversión de claves ═══\n')

// 1) Columnas de nivel superior SÍ se convierten a snake_case al escribir
{
  const row = toRow({ empresaId: 'x', nombreCom: 'ACME', tenantId: 't1' })
  check('toRow convierte columnas a snake_case',
    'empresa_id' in row && 'nombre_com' in row && 'tenant_id' in row,
    Object.keys(row).join(', '))
}

// 2) Columnas de nivel superior SÍ se convierten a camelCase al leer
{
  const obj = fromRow({ empresa_id: 'x', contrato_fin: '2026-12-31' })
  check('fromRow convierte columnas a camelCase', 'empresaId' in obj && 'contratoFin' in obj,
    Object.keys(obj).join(', '))
}

// 3) JSONB (objeto) — claves internas PRESERVADAS al escribir
{
  const row = toRow({ metasCustom: { ifaMeta: 5, ausentismoMeta: 2 } })
  check('toRow preserva claves internas de JSONB objeto',
    eq(row.metas_custom, { ifaMeta: 5, ausentismoMeta: 2 }),
    JSON.stringify(row.metas_custom))
}

// 4) JSONB (array de objetos) — claves internas PRESERVADAS al escribir
{
  const row = toRow({ hallazgos: [{ areaInspeccionada: 'Bodega', nivelRiesgo: 'alto' }] })
  check('toRow preserva claves internas de JSONB array',
    eq(row.hallazgos, [{ areaInspeccionada: 'Bodega', nivelRiesgo: 'alto' }]),
    JSON.stringify(row.hallazgos))
}

// 5) Round-trip completo: lo que entra al JSONB sale idéntico
{
  const original = { empresaId: 'e1', centros: [{ nombreCentro: 'Sede 1', codArl: '123' }] }
  const ida = toRow(original)              // a snake (escritura)
  const vuelta = fromRow(ida)              // a camel (lectura)
  check('Round-trip preserva el contenido JSONB verbatim',
    eq(vuelta.centros, original.centros) && vuelta.empresaId === 'e1',
    JSON.stringify(vuelta.centros))
}

// 6) Listas (array de filas) — cada fila se convierte, JSONB intacto
{
  const lista = fromRow([{ empresa_id: 'x', hallazgos: [{ areaInspeccionada: 'A' }] }])
  check('fromRow de lista convierte columnas y deja JSONB intacto',
    lista[0].empresaId === 'x' && eq(lista[0].hallazgos, [{ areaInspeccionada: 'A' }]),
    JSON.stringify(lista[0]))
}

console.log(`\n═══ RESULTADO H4: ${pass} PASS · ${fail} FAIL ═══`)
process.exit(fail ? 1 : 0)
