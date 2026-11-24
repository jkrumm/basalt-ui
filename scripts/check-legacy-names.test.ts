import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { scan } from './check-legacy-names.ts'

const GATE = resolve(import.meta.dir, 'check-legacy-names.ts')

describe('scan', () => {
  test('a planted --vx-x is a finding', () => {
    expect(scan('packages/basalt-ui/src/x.css', 'a { color: var(--vx-x); }')).toEqual([
      {
        path: 'packages/basalt-ui/src/x.css',
        line: 1,
        kind: 'vx',
        text: 'a { color: var(--vx-x); }',
      },
    ])
  })

  test('every vx spelling is found: the class, the accessor, the types, a camel-case name', () => {
    for (const text of [
      '.vx-prose',
      'VX.ink',
      'type A = VxVar',
      'collectVxNames()',
      'REMOVED_VX_NAMES',
    ]) {
      expect(scan('apps/playground/src/a.tsx', text).map((f) => f.kind)).toEqual(['vx'])
    }
  })

  test('a base64 run or a word that only contains the letters is not', () => {
    expect(scan('apps/playground/src/a.ts', "'1YVxB+QVxL3'; devx; avx-")).toEqual([])
  })

  test('a British spelling is a finding in a shipped file, in an identifier, a rule id or prose', () => {
    for (const text of ['FavouriteToggle', 'basalt/colour-literal', '// the series colour']) {
      expect(scan('packages/basalt-ui/src/a.ts', text).map((f) => f.kind)).toEqual(['british'])
    }
    expect(scan('apps/playground/src/a.tsx', 'favourites={store}').map((f) => f.kind)).toEqual([
      'british',
    ])
  })

  test('a British spelling in a repo-internal record or a migration row is allowed', () => {
    expect(scan('docs/v3/DIRECTION.md', 'the series colour')).toEqual([])
    expect(scan('packages/basalt-ui/migrations/areas/page.json', 'FavouriteToggle')).toEqual([])
  })

  test('a Mantine mention is a finding in any case', () => {
    expect(scan('packages/basalt-ui/src/a.ts', '// MANTINE')[0]?.kind).toBe('mantine')
  })

  test('an allowlisted path keeps both spellings', () => {
    expect(scan('tools/migrate-v3/x.ts', "'--vx-ink' // mantine")).toEqual([])
    expect(scan('packages/basalt-ui/migrations/areas/tokens.json', '"from": "--vx-x"')).toEqual([])
  })

  test('the import ban list keeps its @mantine line, and nothing else of the file is exempt', () => {
    const path = 'packages/basalt-ui/src/lint/rules/structure/import-boundary.ts'
    expect(scan(path, "  '@mantine/core',")).toEqual([])
    expect(scan(path, "'--vx-ink'").map((f) => f.kind)).toEqual(['vx'])
  })
})

describe('the gate on a packed tarball', () => {
  const run = (files: Record<string, string>) => {
    const dir = mkdtempSync(join(tmpdir(), 'legacy-names-'))
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(dir, path, '..'), { recursive: true })
      writeFileSync(join(dir, path), text)
    }
    return spawnSync('bun', [GATE, '--package', dir], { encoding: 'utf8' })
  }

  test('fails on a planted --vx-x in dist, naming the file as the repo path', () => {
    const r = run({ 'dist/x.css': ':root { --vx-x: 1px; }\n' })
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('packages/basalt-ui/dist/x.css:1: vx:')
  })

  test('passes a clean artifact', () => {
    expect(run({ 'dist/x.css': ':root { --basalt-x: 1px; }\n' }).status).toBe(0)
  })
})
