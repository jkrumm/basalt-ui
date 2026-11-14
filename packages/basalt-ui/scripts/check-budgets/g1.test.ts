/**
 * The G1 freeze (v3-freeze-g1): the ceiling method, the seeded rows of the six layers, and the pins
 * that make a new value export of a G1 subpath fail `check-contract-frozen`.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { main, PINS_PATH } from '../check-contract-frozen'
import { PKG_ROOT, REPO_ROOT } from './lib'
import type { AreaModule } from './lib'
import { seedCeiling } from './ui-bundle'

const AREAS = ['ui', 'cards', 'charts', 'data', 'router', 'table'] as const

describe('seedCeiling', () => {
  test.each([
    [298, 500],
    [10_000, 10_500],
    [23_177, 24_500],
    [76_190, 80_000],
    [76_191, 80_500],
  ])('%d B seeds %d', (measured, ceiling) => {
    expect(seedCeiling(measured)).toBe(ceiling)
  })
})

describe('G1 area files', () => {
  test.each(AREAS)('%s exports seeded byte or count rows', async (name) => {
    const area = (await import(`./areas/${name}`)) as AreaModule
    expect(area.rows.length).toBeGreaterThan(0)
    for (const row of area.rows) expect(row.ceiling).toBeGreaterThan(0)
  })

  test('a seeded byte row measures under its ceiling, within the 5 percent plus 0.5 KB rounding', async () => {
    const { rows } = (await import('./areas/router')) as AreaModule
    const row = rows[0]
    if (row === undefined) throw new Error('router area has no row')
    const measured = await row.measure({
      providerOnlyDist: '',
      once: (_key, build) => build(),
    })
    const value = typeof measured === 'number' ? measured : measured.value
    expect(value).toBeLessThanOrEqual(row.ceiling)
    expect(value).toBeGreaterThan((row.ceiling - 500) / 1.05)
  }, 60_000)
})

describe('G1 pins', () => {
  const PINNED = [
    'src/ui/slots.ts',
    'scripts/export-surface/cards.json',
    'scripts/export-surface/charts.json',
    'scripts/export-surface/data.json',
    'scripts/export-surface/router.json',
    'scripts/export-surface/table.json',
  ].map((f) => `packages/basalt-ui/${f}`)

  const scratch = mkdtempSync(join(tmpdir(), 'g1-pins-'))
  afterAll(() => rmSync(scratch, { recursive: true, force: true }))

  function copyRoot(name: string): string {
    const root = join(scratch, name)
    const pins = JSON.parse(readFileSync(join(REPO_ROOT, PINS_PATH), 'utf8')) as Record<
      string,
      string
    >
    for (const file of Object.keys(pins)) {
      mkdirSync(dirname(join(root, file)), { recursive: true })
      cpSync(join(REPO_ROOT, file), join(root, file))
    }
    mkdirSync(dirname(join(root, PINS_PATH)), { recursive: true })
    cpSync(join(REPO_ROOT, PINS_PATH), join(root, PINS_PATH))
    return root
  }

  test('every G1 value-export list and SLOTS is pinned, and the tree is frozen', () => {
    const pins = JSON.parse(readFileSync(join(PKG_ROOT, 'scripts/contract-pins.json'), 'utf8'))
    for (const file of PINNED) expect(pins).toHaveProperty([file])
    expect(pins).toHaveProperty(['packages/basalt-ui/src/table/contract.ts'])
    expect(main(['--base', 'HEAD', '--root', REPO_ROOT])).toBe(0)
  })

  test('a seeded value export added to a G1 subpath fails the gate', () => {
    for (const shard of PINNED.filter((f) => f.endsWith('.json'))) {
      const root = copyRoot(`offender-${shard.split('/').pop()}`)
      const file = join(root, shard)
      const names = JSON.parse(readFileSync(file, 'utf8')) as string[]
      writeFileSync(file, `${JSON.stringify([...names, 'seededOffender'], null, 2)}\n`)
      expect(main(['--base', 'HEAD', '--root', root])).toBe(1)
    }
  })
})
