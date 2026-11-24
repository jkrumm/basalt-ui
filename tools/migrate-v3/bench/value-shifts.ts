// `valueshifts`: the line-height and radius differences between before and after must equal the
// tokens.valueShifts rows of migrations/areas/tokens.json, and nothing else may differ.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Shift } from './compare.ts'
import { REPO_ROOT } from './measure.ts'

export type ValueShiftRow = { token: string; from: string; to: string }
export const DEFAULT_ROWS = join(REPO_ROOT, 'packages/basalt-ui/migrations/areas/tokens.json')

const KIND_OF = (token: string): Shift['kind'] | null =>
  token.endsWith('-lh') ? 'line-height' : token.startsWith('--vx-radius-') ? 'radius' : null

const pxValues = (text: string): number[] =>
  [...text.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((m) => Number.parseFloat(m[1]!))

/** The `from>to` pairs the rows allow, per kind. Color and size rows name no line-height or radius and are skipped. */
export function allowedPairs(rows: ValueShiftRow[]): Record<Shift['kind'], Set<string>> {
  const out: Record<Shift['kind'], Set<string>> = { 'line-height': new Set(), radius: new Set() }
  for (const row of rows) {
    const kind = KIND_OF(row.token)
    if (!kind) continue
    for (const from of pxValues(row.from))
      for (const to of pxValues(row.to)) out[kind].add(`${from}>${to}`)
  }
  return out
}

export type ShiftReport = { violations: Shift[]; explained: Map<string, number> }

export function checkShifts(shifts: Shift[], rows: ValueShiftRow[]): ShiftReport {
  const allowed = allowedPairs(rows)
  const violations: Shift[] = []
  const explained = new Map<string, number>()
  for (const s of shifts) {
    const key = `${s.kind} ${s.from}>${s.to}`
    if (allowed[s.kind].has(`${s.from}>${s.to}`)) explained.set(key, (explained.get(key) ?? 0) + 1)
    else violations.push(s)
  }
  return { violations, explained }
}

export function readRows(path: string): ValueShiftRow[] {
  const json = JSON.parse(readFileSync(path, 'utf8')) as {
    tokens?: { valueShifts?: ValueShiftRow[] }
  }
  const rows = json.tokens?.valueShifts
  if (!rows) throw new Error(`${path}: no tokens.valueShifts`)
  return rows
}

export function reportShifts(shifts: Shift[], rows: ValueShiftRow[]): number {
  const { violations, explained } = checkShifts(shifts, rows)
  for (const [key, n] of explained) console.log(`  ok  ${key} (${n}x)`)
  const unique = new Map<string, Shift & { n: number }>()
  for (const v of violations) {
    const key = `${v.kind} ${v.from}>${v.to}`
    unique.set(key, { ...v, n: (unique.get(key)?.n ?? 0) + 1 })
  }
  for (const [key, v] of unique)
    console.error(
      `  FAIL ${key} (${v.n}x, first: signature ${v.sig} at ${v.width}px): no valueShifts row`,
    )
  console.log(
    `valueshifts: ${shifts.length} shifts, ${shifts.length - violations.length} explained by rows, ${violations.length} unexplained`,
  )
  return violations.length === 0 ? 0 : 1
}
