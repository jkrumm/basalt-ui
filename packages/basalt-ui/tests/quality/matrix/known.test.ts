import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { KNOWN, KNOWN_CHIPS, classify, loadCycleChips, loadCycleKnown } from './known'
import { EXPRESSION_INDEX, routePaths, scenarioPaths } from './routes'

describe('cycle chip waivers', () => {
  const inCycle = async <T>(files: Record<string, string>, read: (root: string) => Promise<T>) => {
    const root = mkdtempSync(join(tmpdir(), 'matrix-cycle-'))
    try {
      for (const [cycle, source] of Object.entries(files)) {
        mkdirSync(join(root, cycle))
        writeFileSync(join(root, cycle, 'known.ts'), source)
      }
      return await read(root)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }

  test('knownChips of every cycle folder is read, with or without known', async () => {
    const routes = await inCycle(
      {
        'a-1': `export const knownChips = ['/scenarios/expr-n63', '/scenarios/expr-n64']\n`,
        'b-1': `export const known = []\nexport const knownChips = ['/scenarios/expr-n67']\n`,
        'c-1': `export const known = []\n`,
      },
      loadCycleChips,
    )
    expect(routes).toEqual(['/scenarios/expr-n63', '/scenarios/expr-n64', '/scenarios/expr-n67'])
  })

  test('a cycle that only waives chips has no findings to read', async () => {
    const findings = await inCycle({ 'a-1': `export const knownChips = ['/x']\n` }, loadCycleKnown)
    expect(findings).toEqual([])
  })

  test('knownChips that is not a list of route paths is refused', async () => {
    await expect(
      inCycle({ 'a-1': `export const knownChips = ['expr-n63']\n` }, loadCycleChips),
    ).rejects.toThrow('array of route paths')
    await expect(
      inCycle({ 'a-1': `export const knownChips = 'x'\n` }, loadCycleChips),
    ).rejects.toThrow('array of route paths')
  })
})

describe('cycle waivers', () => {
  test('a waiver in a cycle folder is read and covers its route item', async () => {
    const root = mkdtempSync(join(tmpdir(), 'matrix-cycle-'))
    try {
      mkdirSync(join(root, 'demo-1'))
      writeFileSync(
        join(root, 'demo-1', 'known.ts'),
        `export const known = [
          { route: '/cycle/demo', assertion: 'ringWalk', item: /^button "Go": no focus outline$/, owner: 'row' },
        ]\n`,
      )
      mkdirSync(join(root, 'no-waivers'))
      const loaded = await loadCycleKnown(root)
      expect(loaded.map((k) => k.route)).toEqual(['/cycle/demo'])
      const failure = 'ringWalk: 1 finding\n  button "Go": no focus outline'
      const covered = classify('/cycle/demo', [failure], loaded)
      expect(covered.unexpected).toEqual([])
      expect(covered.matched).toEqual(loaded)
      expect(classify('/cycle/other', [failure], loaded).unexpected).toEqual([failure])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('an entry that is not a KnownFinding is refused', async () => {
    const root = mkdtempSync(join(tmpdir(), 'matrix-cycle-'))
    try {
      mkdirSync(join(root, 'bad-1'))
      writeFileSync(join(root, 'bad-1', 'known.ts'), `export const known = [{ route: '/x' }]\n`)
      await expect(loadCycleKnown(root)).rejects.toThrow('not a KnownFinding')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('every waiver names a route the playground has', () => {
    const paths = new Set(routePaths())
    const unknown = KNOWN.filter((k) => k.route !== '*' && !paths.has(k.route)).map((k) => k.route)
    expect(unknown).toEqual([])
  })

  test('every chip waiver names a route one of the apps has', () => {
    const paths = new Set([...routePaths(), EXPRESSION_INDEX, ...scenarioPaths()])
    expect(KNOWN_CHIPS.filter((route) => !paths.has(route))).toEqual([])
  })

  test('classify covers an item by route and assertion', () => {
    const failure = 'axe: 1 violation\n  color-contrast (serious) on x'
    const { unexpected } = classify('/charts', [failure])
    expect(unexpected).toEqual([])
  })
})
