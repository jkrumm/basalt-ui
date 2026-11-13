/**
 * qa-i6 (quality-contract section 6, P9): the perf lane exists, sits in `make evidence` and not in
 * `make check`, holds a budget for both fixtures, and the two basalt-app references teach the
 * per-route bar recipe, the compiler check and the kit rules.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const pkg = resolve(import.meta.dirname, '../..')
const repo = resolve(pkg, '../..')
const read = (path: string): string => readFileSync(path, 'utf8')
const reference = (name: string): string =>
  read(join(pkg, 'agent/skills/basalt-app/references', name))

describe('qa-i6 perf lane', () => {
  test('is a lane of make evidence', () => {
    expect(read(join(repo, 'scripts/evidence/index.ts'))).toMatch(/'perf',\n\] as const/)
    expect(read(join(repo, 'scripts/evidence/perf.ts'))).toContain('export const perf: Lane')
  })

  test('is not part of make check', () => {
    const makefile = read(join(repo, 'Makefile'))
    const check = /^check:.*\n((?:\t.*\n)+)/m.exec(makefile)?.[1] ?? ''
    expect(check).not.toMatch(/perf/)
    // The fixtures run only behind the flag, so the plain `bun test` inside `make check` skips them.
    expect(read(join(pkg, 'tests/quality/perf/perf.test.tsx'))).toContain(
      "process.env['BASALT_PERF']",
    )
  })

  test('budget.json holds a whole-commit ceiling of measured + 5 % for both fixtures', () => {
    const budget = JSON.parse(read(join(pkg, 'tests/quality/perf/budget.json'))) as Record<
      string,
      { measured: number; ceiling: number }
    >
    expect(Object.keys(budget).toSorted()).toEqual(['route-switch', 'ticker'])
    for (const { measured, ceiling } of Object.values(budget)) {
      expect(Number.isInteger(measured) && measured > 0).toBe(true)
      expect(ceiling).toBe(Math.ceil(measured * 1.05))
    }
  })

  test('the ticker budget is gated on commits per tick, not milliseconds', () => {
    const source = read(join(pkg, 'tests/quality/perf/perf.test.tsx'))
    expect(source).toContain('toBeLessThanOrEqual(ceiling)')
    expect(source).not.toMatch(/ms\)?\.toBe(?:Less|Greater)/)
  })
})

describe('qa-i6 references', () => {
  test('performance.md carries the per-route bar recipe, the compiler check and DevTools', () => {
    const text = reference('performance.md')
    for (const needle of [
      'jsGzipMax',
      'cssGzipMax',
      'maxScripts',
      'react.memo_cache_sentinel',
      'Profiler',
    ]) {
      expect(text).toContain(needle)
    }
    expect(text).toMatch(/static closure/)
  })

  test('testing.md carries the kit rules', () => {
    const text = reference('testing.md')
    for (const needle of [
      'installDomShims',
      'settled',
      'findBy',
      'delay={0}',
      'items',
      'hidden: true',
      'Geometry',
    ]) {
      expect(text).toContain(needle)
    }
  })

  test('neither reference names a Mantine API or a model id', () => {
    for (const name of ['performance.md', 'testing.md']) {
      expect(reference(name)).not.toMatch(/mantine|claude-/i)
    }
  })
})
