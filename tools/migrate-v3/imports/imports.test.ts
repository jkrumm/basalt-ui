import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadRenameRows, runImports } from './index.ts'
import { transformImports } from './transform.ts'

const ROWS_DIR = join(import.meta.dir, 'fixtures', 'areas')
const { rows, skipped } = loadRenameRows(ROWS_DIR)
const apply = (source: string) => transformImports(source, { file: 'x.tsx', rows })

describe('rows', () => {
  test('only well-formed, non-manual rename rows with codemod "imports" are applied', () => {
    expect(rows.map((r) => r.id)).toEqual(['shell-rename', 'hook-move'])
    expect(skipped).toHaveLength(1)
    expect(skipped[0]).toContain('malformed')
  })

  test('shipped rows that are renames in shape but name no "imports" codemod are reported, not dropped', () => {
    const shipped = loadRenameRows(
      join(import.meta.dir, '../../../packages/basalt-ui/migrations/areas'),
    )
    expect(shipped.rows).toEqual([])
    const reported = shipped.skipped.join('\n')
    for (const id of [
      'content-Callout',
      'content-Prose',
      'content-ArticleLayout',
      'content-TableOfContents',
    ]) {
      expect(reported).toContain(`row ${id} is a rename but its codemod is not "imports"`)
    }
  })

  test('kinds moved and renamed are accepted when the row names the imports codemod', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rows-'))
    writeFileSync(
      join(dir, 'a.json'),
      JSON.stringify({
        rows: [
          { id: 'a', kind: 'moved', from: 'p#A', to: 'p/x#A', codemod: 'imports' },
          { id: 'b', kind: 'renamed', from: 'p#B', to: 'p/x#C', codemod: 'imports' },
        ],
      }),
    )
    expect(loadRenameRows(dir).rows.map((r) => r.id)).toEqual(['a', 'b'])
  })
})

describe('imports', () => {
  test('applies a rename row and leaves an unmapped import alone', () => {
    const source = [
      "import { BasaltShell, Unmapped } from 'basalt-ui'",
      "import { Other } from 'somewhere-else'",
      '',
      'export const A = () => <BasaltShell><Unmapped /><Other /></BasaltShell>',
      '',
    ].join('\n')
    const { text, changes } = apply(source)
    expect(text).toBe(
      [
        "import { Unmapped } from 'basalt-ui'",
        "import { AppShell } from 'basalt-ui/shell'",
        "import { Other } from 'somewhere-else'",
        '',
        'export const A = () => <AppShell><Unmapped /><Other /></AppShell>',
        '',
      ].join('\n'),
    )
    expect(changes).toEqual([
      {
        file: 'x.tsx',
        row: 'shell-rename',
        from: 'basalt-ui#BasaltShell',
        to: 'basalt-ui/shell#AppShell',
      },
    ])
  })

  test('a file with no mapped import is returned byte for byte', () => {
    const source = "import { Unmapped } from 'basalt-ui'\nexport const x = Unmapped\n"
    expect(apply(source)).toEqual({ text: source, changes: [] })
  })

  test('the whole declaration moves when it held only the renamed symbol', () => {
    expect(apply("import { useThing } from 'basalt-ui'\nuseThing()\n").text).toBe(
      "import { useThing } from 'basalt-ui/hooks'\nuseThing()\n",
    )
  })

  test('an aliased import keeps its local name and is not rewritten at the use site', () => {
    const { text } = apply(
      "import { BasaltShell as Shell } from 'basalt-ui'\nexport const a = <Shell />\n",
    )
    expect(text).toBe(
      "import { AppShell as Shell } from 'basalt-ui/shell'\nexport const a = <Shell />\n",
    )
  })

  test('a symbol merges into an existing import of its target module', () => {
    const { text } = apply(
      "import { BasaltShell } from 'basalt-ui'\nimport { Sidebar } from 'basalt-ui/shell'\nexport const a = BasaltShell\n",
    )
    expect(text).toBe(
      "import { Sidebar, AppShell } from 'basalt-ui/shell'\nexport const a = AppShell\n",
    )
  })

  test('property names and attributes spelled like the symbol are not renamed', () => {
    const { text } = apply(
      "import { BasaltShell } from 'basalt-ui'\nconst o = { BasaltShell: 1 }\nexport const a = [BasaltShell, o.BasaltShell]\n",
    )
    expect(text).toContain('const o = { BasaltShell: 1 }')
    expect(text).toContain('[AppShell, o.BasaltShell]')
  })

  test('an inline type modifier survives the rewrite', () => {
    const { text } = apply(
      "import { BasaltShell, type ShellProps } from 'basalt-ui'\nexport const a: ShellProps = BasaltShell\n",
    )
    expect(text).toBe(
      "import { type ShellProps } from 'basalt-ui'\nimport { AppShell } from 'basalt-ui/shell'\nexport const a: ShellProps = AppShell\n",
    )
    expect(apply("import { type BasaltShell } from 'basalt-ui'\nlet a: BasaltShell\n").text).toBe(
      "import { type AppShell } from 'basalt-ui/shell'\nlet a: AppShell\n",
    )
  })

  test('only uses of the binding are renamed: not destructuring keys, interface members or shadows', () => {
    const { text } = apply(
      [
        "import { useThing } from 'basalt-ui'",
        'interface P { useThing: string }',
        'const { useThing: x } = o',
        'export function f() {',
        '  const useThing = 1',
        '  return useThing',
        '}',
        'export const g = useThing()',
        '',
      ].join('\n'),
    )
    expect(text).toContain("import { useThing } from 'basalt-ui/hooks'")
    expect(text).toContain('interface P { useThing: string }')
    expect(text).toContain('const { useThing: x } = o')
    expect(text).toContain('  return useThing')
    expect(text).toContain('export const g = useThing()')
  })

  test('a renamed symbol keeps its public name when re-exported or used as a shorthand key', () => {
    const { text } = apply(
      "import { BasaltShell } from 'basalt-ui'\nexport { BasaltShell }\nexport const o = { BasaltShell }\n",
    )
    expect(text).toContain('export { AppShell as BasaltShell }')
    expect(text).toContain('export const o = { BasaltShell: AppShell }')
  })

  test('a .ts file with an angle-bracket cast parses as TypeScript; an unparsable file is flagged', () => {
    const cast = transformImports(
      "import { BasaltShell } from 'basalt-ui'\nconst a = <Foo>BasaltShell\n",
      { file: 'x.ts', rows },
    )
    expect(cast.parseFailed).toBeUndefined()
    expect(cast.text).toContain("from 'basalt-ui/shell'")
    expect(apply('const = ;;{').parseFailed).toBe(true)
  })

  test('a second run over its own output is a no-op', () => {
    const first = apply(
      "import { BasaltShell, useThing } from 'basalt-ui'\nexport const a = <BasaltShell>{useThing()}</BasaltShell>\n",
    )
    expect(first.changes).toHaveLength(2)
    const second = apply(first.text)
    expect(second.text).toBe(first.text)
    expect(second.changes).toEqual([])
  })
})

describe('runImports over a directory', () => {
  test('rewrites files in place, dry run does not, second run changes nothing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'imports-'))
    mkdirSync(join(dir, 'src'))
    writeFileSync(
      join(dir, 'src', 'a.tsx'),
      "import { BasaltShell } from 'basalt-ui'\nexport const a = BasaltShell\n",
    )
    writeFileSync(
      join(dir, 'src', 'b.ts'),
      "import { Unmapped } from 'basalt-ui'\nexport const b = Unmapped\n",
    )
    const dry = runImports({ dir, rowsDir: ROWS_DIR, write: false })
    expect(dry.changedFiles).toBe(1)
    expect(readFileSync(join(dir, 'src', 'a.tsx'), 'utf8')).toContain('BasaltShell')
    const first = runImports({ dir, rowsDir: ROWS_DIR, write: true })
    expect(first.changes).toHaveLength(1)
    expect(readFileSync(join(dir, 'src', 'a.tsx'), 'utf8')).toBe(
      "import { AppShell } from 'basalt-ui/shell'\nexport const a = AppShell\n",
    )
    expect(readFileSync(join(dir, 'src', 'b.ts'), 'utf8')).toContain("from 'basalt-ui'")
    expect(runImports({ dir, rowsDir: ROWS_DIR, write: true }).changedFiles).toBe(0)
  })
})
