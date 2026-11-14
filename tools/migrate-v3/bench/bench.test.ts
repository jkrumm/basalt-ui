import { describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { codemodHtml } from './after.ts'
import { definedClasses, emittedClasses, missingClasses } from './classes-exist.ts'
import { compareFontSize, compareGeometry, observedShifts } from './compare.ts'
import { readOracle } from './index.ts'
import { lintClean, lintCleanCommand } from './lint-clean.ts'
import { STRIDE } from './measure.ts'
import type { Measured } from './measure.ts'
import { SIGNATURE_COUNT, generateSignatures } from './signatures.ts'
import { allowedPairs, checkShifts } from './value-shifts.ts'
import type { ValueShiftRow } from './value-shifts.ts'

const node = (x: number, y: number, w: number, h: number, fs = 15, lh = 23.25, br = 0) => [
  x,
  y,
  w,
  h,
  fs,
  lh,
  br,
]
/** One width, one signature, one node. */
const one = (n: number[]): Measured => [[n]]
const WIDTHS = [700]

describe('oracle and signatures', () => {
  const oracle = readOracle()

  test('375 signatures at 700, 1100 and 1300 px, seven numbers per node', () => {
    expect(SIGNATURE_COUNT).toBe(375)
    expect(oracle.sigs).toHaveLength(375)
    expect(oracle.meta.widths).toEqual([700, 1100, 1300])
    for (const s of oracle.sigs) {
      expect(s.m).toHaveLength(3)
      for (const w of s.m) expect(w.length % STRIDE).toBe(0)
    }
  })

  test('the committed oracle is the generator output, so a changed generator is a visible regeneration', () => {
    expect(generateSignatures().map((s) => s.jsx)).toEqual(oracle.sigs.map((s) => s.jsx))
  }, 120_000)

  test('the codemod emits static HTML for a signature', () => {
    expect(codemodHtml('<Stack gap="lg"><div data-k="1" /></Stack>', 'Stack')).toBe(
      '<div class="flex flex-col gap-5"><div data-k="1"></div></div>',
    )
  })
})

describe('geometry and font-size', () => {
  test('equal boxes pass; a box 1px off fails; sub-pixel noise passes', () => {
    const before = one(node(0, 0, 100, 20))
    expect(compareGeometry(before, one(node(0, 0, 100, 20)), WIDTHS)).toEqual([])
    expect(compareGeometry(before, one(node(0, 0, 100.1, 20)), WIDTHS)).toEqual([])
    expect(compareGeometry(before, one(node(0, 0, 100, 21)), WIDTHS)).toHaveLength(1)
  })

  test('a different node count fails', () => {
    const before: Measured = [[[...node(0, 0, 1, 1), ...node(0, 1, 1, 1)]]]
    expect(compareGeometry(before, one(node(0, 0, 1, 1)), WIDTHS)[0]?.reason).toContain(
      '2 nodes before, 1 after',
    )
  })

  test('font-size must be exact', () => {
    expect(compareFontSize(one(node(0, 0, 1, 1, 15)), one(node(0, 0, 1, 1, 15)), WIDTHS)).toEqual(
      [],
    )
    expect(
      compareFontSize(one(node(0, 0, 1, 1, 15)), one(node(0, 0, 1, 1, 16)), WIDTHS),
    ).toHaveLength(1)
  })
})

describe('valueshifts', () => {
  const rows: ValueShiftRow[] = [
    { token: '--vx-text-md-lh', from: '23.25px (15px x 1.55)', to: '20px' },
    { token: '--vx-radius-ctrl', from: '6px', to: '8px' },
    { token: '--vx-brand', from: 'accent: light #4374a6', to: 'light #4071a4' },
  ]

  test('only line-height and radius rows allow a shift', () => {
    const allowed = allowedPairs(rows)
    expect([...allowed['line-height']]).toEqual(['23.25>20', '15>20'])
    expect([...allowed.radius]).toEqual(['6>8'])
  })

  test('passing: a shift a row names is explained', () => {
    const shifts = observedShifts(
      one(node(0, 0, 1, 1, 15, 23.25, 6)),
      one(node(0, 0, 1, 1, 15, 20, 8)),
      WIDTHS,
    )
    expect(shifts.map((s) => s.kind)).toEqual(['line-height', 'radius'])
    expect(checkShifts(shifts, rows).violations).toEqual([])
  })

  test('failing: a line-height or radius no row names is a violation', () => {
    const shifts = observedShifts(
      one(node(0, 0, 1, 1, 15, 23.25, 6)),
      one(node(0, 0, 1, 1, 15, 22, 0)),
      WIDTHS,
    )
    expect(checkShifts(shifts, rows).violations.map((v) => `${v.kind} ${v.from}>${v.to}`)).toEqual([
      'line-height 23.25>22',
      'radius 6>0',
    ])
  })

  test('no shift, no violation', () => {
    expect(observedShifts(one(node(0, 0, 1, 1)), one(node(0, 0, 1, 1)), WIDTHS)).toEqual([])
  })
})

describe('classes-exist', () => {
  const css =
    '.flex{display:flex}.md\\:gap-4{gap:1rem}.w-\\[320px\\]{width:320px}.\\32xl\\:p-2{padding:0.5rem}'

  test('reads className literals and every string of a cn() call', () => {
    const src = `<div className="flex gap-4"/><p className={cn("text-md", a && 'font-bold', \`mt-2\`)} />`
    expect([...emittedClasses(src)].sort()).toEqual([
      'flex',
      'font-bold',
      'gap-4',
      'mt-2',
      'text-md',
    ])
  })

  test('reads a ternary className and skips marker classes', () => {
    const src = `<div className={dense ? "p-2" : "p-4"} /><i className="group peer/x flex" />`
    expect([...emittedClasses(src)].toSorted()).toEqual(['flex', 'p-2', 'p-4'])
  })

  test('reads escaped selectors', () => {
    expect([...definedClasses(css)].sort()).toEqual(['2xl:p-2', 'flex', 'md:gap-4', 'w-[320px]'])
  })

  test('passing: every emitted class is defined', () => {
    expect(missingClasses('<div className="flex md:gap-4 w-[320px] 2xl:p-2" />', css)).toEqual([])
  })

  test('failing: a class the sheet lacks is named', () => {
    expect(missingClasses('<p className="flex text-xl rounded-md" />', css)).toEqual([
      'rounded-md',
      'text-xl',
    ])
  })
})

describe('lint-clean', () => {
  test('passes on a clean run', async () => {
    expect((await lintClean('/app', () => ({ code: 0, output: '\n' }))).ok).toBe(true)
  })

  test('fails on one finding', async () => {
    const r = await lintClean('/app', () => ({
      code: 1,
      output: 'src/a.tsx:3 basalt/primitive-bypass',
    }))
    expect(r.ok).toBe(false)
    expect(r.output).toContain('primitive-bypass')
  })

  test('the command maps both to an exit code', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lint-clean-test-'))
    try {
      mkdirSync(join(dir, 'src'))
      writeFileSync(join(dir, 'src/a.tsx'), '')
      expect(await lintCleanCommand([dir], () => ({ code: 0, output: '' }))).toBe(0)
      expect(await lintCleanCommand([dir], () => ({ code: 1, output: 'finding' }))).toBe(1)
      expect(await lintCleanCommand([dir], () => ({ code: 2, output: 'no binary' }))).toBe(2)
      expect(await lintCleanCommand([], () => ({ code: 0, output: '' }))).toBe(2)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
