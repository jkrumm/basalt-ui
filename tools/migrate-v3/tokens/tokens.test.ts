import { describe, expect, test } from 'bun:test'
import { cpSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runImports } from '../imports/index.ts'
import { DEFAULT_ROWS_DIR, loadTokenRows, runTokens } from './index.ts'
import { transformTokens } from './transform.ts'

const FIXTURES = join(import.meta.dir, 'fixtures')
const shipped = loadTokenRows(DEFAULT_ROWS_DIR)
const apply = (source: string) => transformTokens(source, { file: 'x.css', rows: shipped.rows })

describe('shipped rows', () => {
  test('the prefix rows are loaded as prefixes, never as names', () => {
    expect(shipped.rows.prefixes.map((r) => [r.from, r.to])).toEqual([
      ['--vx-*', '--basalt-*'],
      ['.vx-*', '.basalt-*'],
    ])
  })

  test('every name row maps to a v3 name, never to a 2.x one', () => {
    for (const row of shipped.rows.names) expect(row.to).not.toMatch(/^(--vx-|\.vx-|VX\.)/)
  })
})

describe('tokens', () => {
  test('a name row wins over the prefix: --vx-accent is --basalt-brand, not --basalt-accent', () => {
    expect(apply('a { color: var(--vx-accent); }').text).toBe('a { color: var(--basalt-brand); }')
  })

  test('a name keeps its whole word: --vx-accent-fill is its own row', () => {
    expect(apply('var(--vx-accent-fill)').text).toBe('var(--basalt-brand-fill)')
  })

  test('the prefix renames every other custom property, its suffix kept', () => {
    expect(apply('var(--vx-ink-muted) var(--vx-text-sm-lh)').text).toBe(
      'var(--basalt-ink-muted) var(--basalt-text-sm-lh)',
    )
  })

  test('a member row matches under the old and the new accessor', () => {
    expect(apply('VX.surface.panel').text).toBe('BASALT.card')
    expect(apply('BASALT.surface.panel').text).toBe('BASALT.card')
    expect(apply('row.VX.surface.panel').text).toBe('row.VX.surface.panel')
  })

  test('a class is renamed in markup and in CSS, not inside another word or a path', () => {
    expect(apply('<div className="vx-prose wide">').text).toBe(
      '<div className="basalt-prose wide">',
    )
    expect(apply('.vx-prose h2 {}').text).toBe('.basalt-prose h2 {}')
    expect(apply("import '@x/vx-prose'; my-vx-prose").text).toBe(
      "import '@x/vx-prose'; my-vx-prose",
    )
  })

  test('a file with no 2.x name is returned byte for byte', () => {
    const source = 'a { color: var(--basalt-ink); }\n'
    expect(apply(source)).toEqual({ text: source, changes: [] })
  })
})

describe('a 2.x app, imports then tokens', () => {
  test('--vx-ink, .vx-prose and VX.ink come out on the v3 names', () => {
    const dir = mkdtempSync(join(tmpdir(), 'migrate-v3-tokens-'))
    cpSync(join(FIXTURES, 'before'), dir, { recursive: true })
    runImports({ dir, rowsDir: DEFAULT_ROWS_DIR, write: true })
    const summary = runTokens({ dir, rowsDir: DEFAULT_ROWS_DIR, write: true })
    expect(summary.changedFiles).toBe(2)
    for (const file of ['src/panel.tsx', 'src/panel.css']) {
      expect(readFileSync(join(dir, file), 'utf8')).toBe(
        readFileSync(join(FIXTURES, 'after', file), 'utf8'),
      )
    }
  })
})
