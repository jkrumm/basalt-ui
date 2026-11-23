/**
 * The G2 freeze (v3-freeze-g2): the seeded rows of page, shell, content and router, and the pins
 * that make a seeded edit of a G2 contract or value-export list fail `check-contract-frozen`.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { main, PINS_PATH } from '../check-contract-frozen'
import { REPO_ROOT } from './lib'
import type { AreaModule } from './lib'

describe('G2 area files', () => {
  test.each(['page', 'shell', 'content', 'router'] as const)(
    '%s exports seeded rows',
    async (name) => {
      const area = (await import(`./areas/${name}`)) as AreaModule
      expect(area.rows.length).toBeGreaterThan(0)
      for (const row of area.rows) expect(row.ceiling).toBeGreaterThan(0)
    },
  )

  test('the value-symbol rows are exact', async () => {
    const exact = { 'page-symbols': 28, 'shell-symbols': 5, 'content-symbols': 2 }
    for (const name of ['page', 'shell', 'content'] as const) {
      const area = (await import(`./areas/${name}`)) as AreaModule
      for (const row of area.rows) {
        const want = exact[row.id as keyof typeof exact]
        if (want !== undefined) expect(row.ceiling).toBe(want)
      }
    }
  })
})

describe('G2 pins', () => {
  const PREFIX = 'packages/basalt-ui/'
  const CONTRACTS = ['page', 'shell', 'content'].map((n) => `${PREFIX}src/${n}/contract.ts`)
  const LISTS = [
    'scripts/export-surface/page.json',
    'scripts/export-surface/content.json',
    'scripts/export-surface/router.json',
    'src/shell/index.ts',
    'src/router/index.ts',
  ].map((f) => PREFIX + f)

  const scratch = mkdtempSync(join(tmpdir(), 'g2-pins-'))
  afterAll(() => rmSync(scratch, { recursive: true, force: true }))

  function copyRoot(name: string): string {
    const root = join(scratch, name)
    const pins = JSON.parse(readFileSync(join(REPO_ROOT, PINS_PATH), 'utf8')) as Record<
      string,
      string
    >
    for (const file of [...Object.keys(pins), PINS_PATH]) {
      mkdirSync(dirname(join(root, file)), { recursive: true })
      cpSync(join(REPO_ROOT, file), join(root, file))
    }
    return root
  }

  test('every G2 contract and value-export list is pinned, and the tree is frozen', () => {
    const pins = JSON.parse(readFileSync(join(REPO_ROOT, PINS_PATH), 'utf8'))
    for (const file of [...CONTRACTS, ...LISTS]) expect(pins).toHaveProperty([file])
    expect(main(['--base', 'HEAD', '--root', REPO_ROOT])).toBe(0)
  })

  test.each([...CONTRACTS, ...LISTS])('a seeded edit of %s fails the gate', (file) => {
    const root = copyRoot(`offender-${file.replaceAll('/', '_')}`)
    writeFileSync(join(root, file), `${readFileSync(join(root, file), 'utf8')}\n// seeded\n`)
    expect(main(['--base', 'HEAD', '--root', root])).toBe(1)
  })
})
