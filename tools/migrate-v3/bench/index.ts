// The four checks of the replacement proof (migration-release.md section 7) that need no consumer:
// `bench` (1) and `valueshifts` (2) measure the codemod's output against the committed Mantine oracle;
// `classes-exist` (3) and `lint-clean` (4) run per consumer, in its cutover PR.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { afterPage } from './after.ts'
import { classesExistCommand } from './classes-exist.ts'
import { compareFontSize, compareGeometry, observedShifts } from './compare.ts'
import { lintCleanCommand } from './lint-clean.ts'
import { lineHeightsOf, measure } from './measure.ts'
import type { Measured } from './measure.ts'
import { DEFAULT_ROWS, readRows, reportShifts } from './value-shifts.ts'

export { classesExistCommand, lintCleanCommand }

type Oracle = {
  meta: { mantine: string; font: string; widths: number[] }
  sigs: { tag: string; jsx: string; m: number[][] }[]
}

export function readOracle(path = join(import.meta.dir, 'oracle.json')): Oracle {
  return JSON.parse(readFileSync(path, 'utf8')) as Oracle
}

/** The oracle as `[width][signature]`. */
function oracleMeasured(o: Oracle): Measured {
  return o.meta.widths.map((_, wi) => o.sigs.map((s) => s.m[wi]!))
}

/** Natural pass (font-size, line-height, radius) and the line-height-pinned pass (geometry). */
async function measureAfter(o: Oracle): Promise<{ natural: Measured; pinned: Measured }> {
  const page = afterPage(o.sigs)
  const natural = await measure(page)
  const pinned = await measure(page, lineHeightsOf(oracleMeasured(o)))
  return { natural, pinned }
}

const show = (
  label: string,
  items: { sig: number; width: number; reason: string }[],
  o: Oracle,
) => {
  for (const i of items.slice(0, 20))
    console.error(
      `  ${label} signature ${i.sig} at ${i.width}px: ${i.reason}\n    ${o.sigs[i.sig]?.jsx}`,
    )
  if (items.length > 20) console.error(`  ... and ${items.length - 20} more`)
}

export async function benchCommand(): Promise<number> {
  const o = readOracle()
  const { natural, pinned } = await measureAfter(o)
  const before = oracleMeasured(o)
  const geometry = compareGeometry(before, pinned, o.meta.widths)
  const fontSize = compareFontSize(before, natural, o.meta.widths)
  const shifts = observedShifts(before, natural, o.meta.widths)
  show('geometry', geometry, o)
  show('font-size', fontSize, o)
  console.log(
    `bench: ${o.sigs.length} signatures x ${o.meta.widths.length} widths (${o.meta.widths.join(', ')} px), ` +
      `${geometry.length} geometry mismatches, ${fontSize.length} font-size mismatches; ` +
      `${shifts.length} line-height/radius shifts left to valueshifts`,
  )
  return geometry.length + fontSize.length === 0 ? 0 : 1
}

export async function valueshiftsCommand(args: string[]): Promise<number> {
  const { values } = parseArgs({ args, options: { rows: { type: 'string' } } })
  const rows = readRows(values.rows ?? DEFAULT_ROWS)
  const o = readOracle()
  const { natural } = await measureAfter(o)
  return reportShifts(observedShifts(oracleMeasured(o), natural, o.meta.widths), rows)
}
