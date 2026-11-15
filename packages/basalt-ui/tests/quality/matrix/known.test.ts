import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { KNOWN, classify, loadCycleKnown } from './known'
import { routePaths } from './routes'

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

  test('classify covers an item by route and assertion', () => {
    const failure = 'axe: 1 violation\n  color-contrast (serious) on x'
    const { unexpected } = classify('/charts', [failure])
    expect(unexpected).toEqual([])
  })
})
