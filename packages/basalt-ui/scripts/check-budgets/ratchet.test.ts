/**
 * The budget ratchet and area discovery: a ceiling goes down freely and up only with a named raise
 * row, and a lane adds its own area file with `index.ts` and `ratchet.ts` unedited.
 */
import { afterAll, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { areaFiles, runBudgets } from './index'
import { ratchetViolations } from './ratchet'

const REAL_AREAS = join(import.meta.dir, 'areas')

// The discovery copy runs a full budget pass over a one-row area; the real-areas test loads every file.
setDefaultTimeout(180_000)

/** A self-contained area file: one row `r` at `ceiling`, plus raw `raises` source. */
const fixtureArea = (ceiling: number, raises = '{}') =>
  `export const rows = [{ id: 'r', order: 1, label: 'r', ceiling: ${ceiling}, measure: () => 1 }]\n` +
  `export const raises = ${raises}\n`

const raiseRow = (repo: string, { from = 100, to = 120, consumer = 'a screen' } = {}) =>
  `{ r: [{ from: ${from}, to: ${to}, consumer: '${consumer}', repo: '${repo}' }] }`

describe('ratchet', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'check-budgets-ratchet-'))
  afterAll(() => rmSync(scratch, { recursive: true, force: true }))

  /**
   * Write `current` as an area file and ratchet it against `base` (`null` = no base file). Each
   * file gets a fresh directory: Bun caches a directory's listing, so a file added to one that was
   * already imported from is not found.
   */
  async function ratchet(current: string, base: string | null) {
    const file = join(mkdtempSync(join(scratch, 'f-')), 'fix.ts')
    writeFileSync(file, current)
    return ratchetViolations({ files: [file], readBase: () => base })
  }

  test('a raised ceiling with no row fails', async () => {
    const [violation, ...rest] = await ratchet(fixtureArea(120), fixtureArea(100))
    expect(rest).toEqual([])
    expect(violation).toContain('ceiling 100 → 120')
    expect(violation).toContain('no raise row')
  })

  test('a row naming a repo other than argo passes', async () => {
    expect(await ratchet(fixtureArea(120, raiseRow('rollhook')), fixtureArea(100))).toEqual([])
  })

  test('a row naming argo fails, in any casing', async () => {
    for (const repo of ['argo', ' Argo ']) {
      const [violation] = await ratchet(fixtureArea(120, raiseRow(repo)), fixtureArea(100))
      expect(violation).toContain('names argo')
    }
  })

  test('a row without a repo or a consumer fails', async () => {
    const [noRepo] = await ratchet(fixtureArea(120, raiseRow('')), fixtureArea(100))
    expect(noRepo).toContain('names no repo')
    const noConsumer = raiseRow('rb', { consumer: ' ' })
    const [violation] = await ratchet(fixtureArea(120, noConsumer), fixtureArea(100))
    expect(violation).toContain('names no consumer')
  })

  test('a row for another step does not cover the raise', async () => {
    const stale = raiseRow('rb', { from: 90 })
    expect(await ratchet(fixtureArea(120, stale), fixtureArea(100))).toHaveLength(1)
  })

  test('a lowered or unchanged ceiling passes', async () => {
    expect(await ratchet(fixtureArea(80), fixtureArea(100))).toEqual([])
    expect(await ratchet(fixtureArea(100), fixtureArea(100))).toEqual([])
  })

  test('no base file passes', async () => {
    expect(await ratchet(fixtureArea(999), null)).toEqual([])
  })

  test('a row new to an existing area passes', async () => {
    const extra = "rows.push({ id: 'n', order: 2, label: 'n', ceiling: 5000, measure: () => 1 })\n"
    expect(await ratchet(fixtureArea(100) + extra, fixtureArea(100))).toEqual([])
  })

  test('a row moved to another area file keeps its base ceiling', async () => {
    const dir = mkdtempSync(join(scratch, 'move-'))
    const from = join(dir, 'old.ts')
    const to = join(dir, 'new.ts')
    writeFileSync(from, 'export const rows = []\n')
    writeFileSync(to, fixtureArea(120))
    const readBase = (file: string) => (file === from ? fixtureArea(100) : null)
    const [violation, ...rest] = await ratchetViolations({ files: [from, to], readBase })
    expect(rest).toEqual([])
    expect(violation).toContain('new/r: ceiling 100 → 120')
  })

  test('the real area files load as their own base, imports resolved', async () => {
    const files = areaFiles(REAL_AREAS)
    expect(files.length).toBeGreaterThan(0)
    const readBase = (file: string) => readFileSync(file, 'utf8')
    expect(await ratchetViolations({ files, readBase })).toEqual([])
  })

  test('two branches that raise different rows of one area file merge without a conflict', () => {
    const base = readFileSync(join(REAL_AREAS, 'surface.ts'), 'utf8')
    /** What a branch does to raise `id`: the ceiling number, then a new entry at the head of the row's raises. */
    const raise = (source: string, id: string, ceiling: RegExp, to: string): string =>
      source
        .replace(ceiling, (match) => match.replace(/\d+/, to))
        .replace(
          `  '${id}': [\n`,
          `  '${id}': [\n    { from: 1, to: 2, consumer: 'a screen', repo: 'rb' },\n`,
        )
    const ours = raise(base, 'barrel-types', /ceiling: \d+, \/\/ v3 table-ga: 24/, '999')
    const theirs = raise(base, 'non-chart-symbols', /ceiling: \d+, \/\/ v3 table-ga: `Table/, '998')
    expect(ours).not.toBe(base)
    expect(theirs).not.toBe(base)

    const dir = mkdtempSync(join(tmpdir(), 'check-budgets-merge-'))
    try {
      for (const [name, text] of [
        ['base', base],
        ['ours', ours],
        ['theirs', theirs],
      ] as const) {
        writeFileSync(join(dir, name), text)
      }
      const merged = Bun.spawnSync(
        ['git', 'merge-file', '-p', join(dir, 'ours'), join(dir, 'base'), join(dir, 'theirs')],
        { stderr: 'pipe' },
      )
      expect(merged.exitCode).toBe(0)
      const text = merged.stdout.toString()
      expect(text.match(/consumer: 'a screen'/g)).toHaveLength(2)
      expect(text).toContain('ceiling: 999,')
      expect(text).toContain('ceiling: 998,')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('area discovery', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'check-budgets-areas-'))
  afterAll(() => rmSync(scratch, { recursive: true, force: true }))

  test('areas/zz-fixture.ts in a copy is picked up with index.ts and ratchet.ts unedited', async () => {
    const src = import.meta.dir
    mkdirSync(join(scratch, 'areas'))
    for (const name of ['index.ts', 'ratchet.ts', 'lib.ts']) {
      copyFileSync(join(src, name), join(scratch, name))
    }
    writeFileSync(join(scratch, 'areas/zz-fixture.ts'), fixtureArea(7))

    const copy = (await import(pathToFileURL(join(scratch, 'index.ts')).href)) as {
      runBudgets: typeof runBudgets
    }
    const lines: string[] = []
    const code = await copy.runBudgets({ reportOnly: false, log: (l) => lines.push(l) })

    expect(code).toBe(0)
    expect(lines[0]).toStartWith('✓ r')
    expect(lines.at(-1)).toContain('all 1 budgets within ceiling')
  })

  test('rows print in `order` across areas; a repeated id is refused', async () => {
    const dir = mkdtempSync(join(scratch, 'order-'))
    const row = (id: string, order: number) =>
      `{ id: '${id}', order: ${order}, label: '${id}', ceiling: 1, measure: () => 1 }`
    writeFileSync(join(dir, 'a.ts'), `export const rows = [${row('late', 20)}]\n`)
    writeFileSync(join(dir, 'b.ts'), `export const rows = [${row('early', 10)}]\n`)
    const run = (lines: string[]) =>
      runBudgets({
        reportOnly: true,
        areasDir: dir,
        readBase: () => null,
        log: (l) => lines.push(l),
      })

    const lines: string[] = []
    await run(lines)
    expect(lines.slice(0, 2).map((l) => l.slice(2).trim().split(/\s+/)[0])).toEqual([
      'early',
      'late',
    ])

    writeFileSync(join(dir, 'c.ts'), `export const rows = [${row('early', 30)}]\n`)
    await expect(run([])).rejects.toThrow('defined twice')
  })

  test('a directory with no area files fails instead of passing empty', async () => {
    const dir = mkdtempSync(join(scratch, 'empty-'))
    const run = runBudgets({
      reportOnly: false,
      areasDir: dir,
      readBase: () => null,
      log: () => {},
    })
    await expect(run).rejects.toThrow('no area files')
  })
})
