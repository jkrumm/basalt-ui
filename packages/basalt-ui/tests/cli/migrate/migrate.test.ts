/**
 * `basalt-ui migrate` (v3-mig-cli): rows selected by the app's import census, `--json`, `--check`.
 * Row fixtures are inline; the package dir and the app tree are built in temp dirs, so no consumer
 * repo and no shipped row is touched.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { run } from '../../../src/cli'
import { migrate } from '../../../src/cli/migrate'
import type { MigrateReport } from '../../../src/cli/migrate'
import { foldChain, parseMigrationFile, satisfies } from '../../../src/cli/migrate/rows'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'basalt-migrate-'))
  dirs.push(d)
  return d
}

function tree(root: string, files: Record<string, unknown>): string {
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, typeof content === 'string' ? content : JSON.stringify(content))
  }
  return root
}

function rowsFile(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { schema: 1, rows: [], ...extra }
}

const REMOVED = {
  id: 'ui-gone',
  kind: 'removed',
  from: 'basalt-ui#OldThing',
  to: 'basalt-ui/ui#NewThing',
  profiles: ['app', 'bridge'],
}
const OTHER = { id: 'ui-other', kind: 'renamed', from: 'basalt-ui#Other', to: 'basalt-ui#Next' }

function pkgWith(files: Record<string, unknown>): string {
  return tree(
    tmp(),
    Object.fromEntries(Object.entries(files).map(([k, v]) => [`migrations/${k}`, v])),
  )
}

function capture(fn: () => number): { code: number; out: string; err: string } {
  const log = console.log
  const error = console.error
  let out = ''
  let err = ''
  console.log = (...a: unknown[]) => {
    out += `${a.join(' ')}\n`
  }
  console.error = (...a: unknown[]) => {
    err += `${a.join(' ')}\n`
  }
  try {
    return { code: fn(), out, err }
  } finally {
    console.log = log
    console.error = error
  }
}

function json(app: string, pkg: string, flags: string[]): { code: number; report: MigrateReport } {
  const r = capture(() => migrate([...flags, '--json'], app, pkg))
  return { code: r.code, report: JSON.parse(r.out) as MigrateReport }
}

const FLAGS = ['--from', '2.29.0', '--profile', 'app']

describe('row selection by import census', () => {
  it('prints a row for an imported symbol and not for an unimported one', () => {
    const pkg = pkgWith({ 'areas/ui.json': rowsFile({ rows: [REMOVED, OTHER] }) })
    const app = tree(tmp(), { 'src/a.tsx': "import { OldThing, Fine } from 'basalt-ui'\n" })
    const { report } = json(app, pkg, FLAGS)
    expect(report.rows.map((r) => r.id)).toEqual(['ui-gone'])
    expect(report.rows[0]?.at).toEqual(['src/a.tsx:1'])
  })

  it('reads aliased, type-only, multi-line, namespace, dynamic and css imports', () => {
    const pkg = pkgWith({
      'areas/ui.json': rowsFile({
        rows: [
          { id: 'a', kind: 'removed', from: 'basalt-ui/x#A' },
          { id: 'b', kind: 'removed', from: 'basalt-ui/x#B' },
          { id: 'c', kind: 'removed', from: 'basalt-ui/x#C' },
          { id: 'd', kind: 'removed', from: 'basalt-ui/styles.css' },
          { id: 'e', kind: 'removed', from: 'basalt-ui/dyn' },
          { id: 'f', kind: 'removed', from: 'basalt-ui/x#default' },
        ],
      }),
    })
    const app = tree(tmp(), {
      'a.ts':
        "import { type A as Z,\n  B } from 'basalt-ui/x'\nimport * as NS from 'basalt-ui/x'\nNS.C()\n",
      'b.ts': "import Default from 'basalt-ui/x'\nconst m = await import('basalt-ui/dyn')\n",
      'c.css': '@import "basalt-ui/styles.css";\n',
      'd.ts': "import { Q } from 'basalt-ui-extras'\n",
    })
    const { report } = json(app, pkg, FLAGS)
    expect(report.rows.map((r) => r.id).toSorted()).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(report.unmapped).toEqual([])
  })

  it('does not scan node_modules, dist or non-source files', () => {
    const pkg = pkgWith({ 'areas/ui.json': rowsFile({ rows: [REMOVED] }) })
    const app = tree(tmp(), {
      'src/a.ts': 'export {}\n',
      'node_modules/p/i.ts': "import { OldThing } from 'basalt-ui'\n",
      'dist/i.ts': "import { OldThing } from 'basalt-ui'\n",
      'README.md': "import { OldThing } from 'basalt-ui'\n",
    })
    const { report } = json(app, pkg, FLAGS)
    expect(report.rows).toEqual([])
    expect(report.scanned).toBe(1)
  })

  it('filters rows by profile', () => {
    const pkg = pkgWith({ 'areas/ui.json': rowsFile({ rows: [REMOVED] }) })
    const app = tree(tmp(), { 'a.ts': "import { OldThing } from 'basalt-ui'\n" })
    expect(json(app, pkg, ['--from', '2.29.0', '--profile', 'tokens']).report.rows).toEqual([])
    expect(json(app, pkg, ['--from', '2.29.0', '--profile', 'bridge']).report.rows).toHaveLength(1)
  })

  it('prop rows print for an importing app; a non-basalt-ui `from` matches by text', () => {
    const pkg = pkgWith({
      'areas/c.json': rowsFile({
        rows: [
          { id: 'p', kind: 'removed-prop', from: 'basalt-ui/content#Markdown.className' },
          { id: 't', kind: 'renamed', from: '--vx-old-token' },
          { id: 'u', kind: 'renamed', from: '--vx-unused' },
        ],
      }),
    })
    const app = tree(tmp(), {
      'a.tsx': "import { Markdown } from 'basalt-ui/content'\n",
      's.css': '.x { color: var(--vx-old-token) }\n',
    })
    expect(json(app, pkg, FLAGS).report.rows.map((r) => r.id)).toEqual(['p', 't'])
  })
})

describe('unmapped', () => {
  it('lists an imported symbol with no row under unmapped in --json', () => {
    const pkg = pkgWith({ 'areas/ui.json': rowsFile({ rows: [REMOVED] }) })
    const app = tree(tmp(), {
      'a.tsx':
        "import { OldThing, Mystery } from 'basalt-ui'\nimport { Card } from 'basalt-ui/ui'\n",
    })
    const { report } = json(app, pkg, FLAGS)
    expect(report.unmapped.map((u) => u.symbol)).toEqual(['basalt-ui/ui#Card', 'basalt-ui#Mystery'])
    expect(report.unmapped[1]?.at).toEqual(['a.tsx:1'])
  })
})

describe('--check', () => {
  const pkg = () => pkgWith({ 'areas/ui.json': rowsFile({ rows: [REMOVED] }) })

  it('exits 0 on a clean tree', () => {
    const app = tree(tmp(), { 'a.tsx': "import { Fine } from 'basalt-ui'\n" })
    const r = capture(() => migrate([...FLAGS, '--check'], app, pkg()))
    expect(r.code).toBe(0)
  })

  it('exits 1 naming the symbol when a removed one is imported; without --check it exits 0', () => {
    const app = tree(tmp(), { 'a.tsx': "import { OldThing } from 'basalt-ui'\n" })
    const p = pkg()
    const bad = capture(() => migrate([...FLAGS, '--check'], app, p))
    expect(bad.code).toBe(1)
    expect(bad.out).toContain('basalt-ui#OldThing')
    expect(capture(() => migrate(FLAGS, app, p)).code).toBe(0)
  })

  it('a renamed or moved symbol still imported fails; a required-prop row does not', () => {
    const p = pkgWith({
      'areas/a.json': rowsFile({
        rows: [
          { id: 'r', kind: 'renamed', from: 'basalt-ui#R' },
          { id: 'q', kind: 'required-prop', from: 'basalt-ui#Q.x' },
        ],
      }),
    })
    const q = tree(tmp(), { 'a.ts': "import { Q } from 'basalt-ui'\n" })
    expect(capture(() => migrate([...FLAGS, '--check'], q, p)).code).toBe(0)
    const r = tree(tmp(), { 'a.ts': "import { R } from 'basalt-ui'\n" })
    expect(capture(() => migrate([...FLAGS, '--check'], r, p)).code).toBe(1)
  })

  it('a removed prop fails only where the importing file still writes it', () => {
    const p = pkgWith({
      'areas/a.json': rowsFile({
        rows: [{ id: 'cn', kind: 'removed-prop', from: 'basalt-ui#Md.className' }],
      }),
    })
    const used = tree(tmp(), {
      'a.tsx': 'import { Md } from \'basalt-ui\'\nconst x = <Md className="a" />\n',
    })
    const clean = tree(tmp(), { 'a.tsx': "import { Md } from 'basalt-ui'\nconst x = <Md />\n" })
    expect(capture(() => migrate([...FLAGS, '--check'], used, p)).code).toBe(1)
    expect(capture(() => migrate([...FLAGS, '--check'], clean, p)).code).toBe(0)
  })

  it('a removed prop is read inside the component tag, not anywhere in the file', () => {
    const p = pkgWith({
      'areas/a.json': rowsFile({
        rows: [{ id: 'cn', kind: 'removed-prop', from: 'basalt-ui#Md.className' }],
      }),
    })
    const other = tree(tmp(), {
      'a.tsx':
        "import { Md } from 'basalt-ui'\nconst x = <div className=\"a\"><Md /></div>\nconst y = { className: 'b' }\n",
    })
    expect(capture(() => migrate([...FLAGS, '--check'], other, p)).code).toBe(0)
    const aliased = tree(tmp(), {
      'a.tsx': 'import { Md as $Md } from \'basalt-ui\'\nconst x = <$Md\n  className="a"\n/>\n',
    })
    expect(capture(() => migrate([...FLAGS, '--check'], aliased, p)).code).toBe(1)
  })

  it('fails on a legacy [data-mantine-color-scheme] selector with no row at all', () => {
    const app = tree(tmp(), { 'a.css': ':root[data-mantine-color-scheme="dark"] { color: red }\n' })
    const r = capture(() => migrate([...FLAGS, '--check'], app, pkg()))
    expect(r.code).toBe(1)
    expect(r.out).toContain('data-mantine-color-scheme')
  })

  it('fails on a legacy-namespace storage or url key no row maps, passes one that a row maps', () => {
    const p = pkgWith({
      'areas/a.json': rowsFile({
        storage: [
          { key: 'mantine-color-scheme-value', action: 'read-legacy', to: 'basalt:scheme' },
        ],
      }),
    })
    const mapped = tree(tmp(), { 'a.ts': "localStorage.getItem('mantine-color-scheme-value')\n" })
    expect(capture(() => migrate([...FLAGS, '--check'], mapped, p)).code).toBe(0)
    const store = tree(tmp(), { 'a.ts': "localStorage.setItem('basalt-sidebar', '1')\n" })
    expect(capture(() => migrate([...FLAGS, '--check'], store, p)).code).toBe(1)
    const url = tree(tmp(), { 'a.ts': "const v = searchParams.get('basalt-range')\n" })
    const r = capture(() => migrate([...FLAGS, '--check', '--json'], url, p))
    expect(r.code).toBe(1)
    expect((JSON.parse(r.out) as MigrateReport).failures[0]?.reason).toBe('unknown-url-key')
    const own = tree(tmp(), { 'a.ts': "localStorage.getItem('my-app-key')\n" })
    expect(capture(() => migrate([...FLAGS, '--check'], own, p)).code).toBe(0)
  })
})

describe('chains', () => {
  const chain = () =>
    pkgWith({
      '1.0.0-to-2.0.0.json': rowsFile({
        from: '>=1.0 <2',
        to: '2.0.0',
        rows: [{ id: 'ab', kind: 'removed', from: 'basalt-ui#A' }],
      }),
      '2.0.0-to-3.0.0.json': rowsFile({
        from: '>=2.0 <3',
        to: '3.0.0',
        rows: [{ id: 'bc', kind: 'removed', from: 'basalt-ui#B' }],
      }),
    })
  const app = () => tree(tmp(), { 'a.ts': "import { A, B } from 'basalt-ui'\n" })

  it('--from A sees both A to B and B to C', () => {
    const { report } = json(app(), chain(), ['--from', '1.4.0', '--profile', 'app'])
    expect(report.rows.map((r) => r.id)).toEqual(['ab', 'bc'])
  })

  it('--from B sees only B to C, and --from C sees none', () => {
    expect(
      json(app(), chain(), ['--from', '2.5.0', '--profile', 'app']).report.rows.map((r) => r.id),
    ).toEqual(['bc'])
    expect(json(app(), chain(), ['--from', '3.0.0', '--profile', 'app']).report.rows).toEqual([])
  })

  it('a row id in both areas and the merged file resolves to the areas file', () => {
    const p = pkgWith({
      'areas/ui.json': rowsFile({
        rows: [{ id: 'same', kind: 'removed', from: 'basalt-ui#A', to: 'areas' }],
      }),
      '3.0.0.json': rowsFile({
        rows: [{ id: 'same', kind: 'removed', from: 'basalt-ui#A', to: 'merged' }],
      }),
    })
    const { report } = json(app(), p, FLAGS)
    expect(report.rows).toHaveLength(1)
    expect(report.rows[0]?.to).toBe('areas')
    expect(report.rows[0]?.source).toBe('areas/ui.json')
  })

  it('foldChain follows `to` transitively and satisfies reads partial ranges', () => {
    const f = (from: string | undefined, to: string): ReturnType<typeof parseMigrationFile> =>
      parseMigrationFile(
        `${to}.json`,
        JSON.stringify(rowsFile({ ...(from === undefined ? {} : { from }), to })),
      )
    const files = [f('>=2.0 <3', '3.0.0'), f('>=1.40 <2', '2.0.0')]
    expect(foldChain(files, '1.40.3')).toHaveLength(2)
    expect(foldChain(files, '2.29.0')).toHaveLength(1)
    expect(satisfies('1.40.0', '>=1.40 <3')).toBe(true)
    expect(satisfies('1.39.9', '>=1.40 <3')).toBe(false)
    expect(satisfies('2.1.0', '2')).toBe(true)
    expect(satisfies('3.0.0', '<=2 || 3.0.0')).toBe(true)
  })
})

describe('exit 1 on a bad invocation', () => {
  const pkg = () => pkgWith({ 'areas/ui.json': rowsFile({ rows: [REMOVED] }) })
  const app = () => tree(tmp(), { 'a.ts': 'export {}\n' })

  it('unknown flag', () => {
    const r = capture(() => migrate([...FLAGS, '--bogus'], app(), pkg()))
    expect(r.code).toBe(1)
    expect(r.err).toContain('--bogus')
  })

  it('missing --profile or --from, unknown profile, unparseable --from', () => {
    const [a, p] = [app(), pkg()]
    expect(capture(() => migrate(['--from', '2.29.0'], a, p)).code).toBe(1)
    expect(capture(() => migrate(['--profile', 'app'], a, p)).code).toBe(1)
    expect(capture(() => migrate(['--from', '2.29.0', '--profile', 'nope'], a, p)).code).toBe(1)
    for (const from of ['two', '2.29', 'v2.29.0', '']) {
      const r = capture(() => migrate(['--from', from, '--profile', 'app'], a, p))
      expect(r.code).toBe(1)
      expect(r.out).toBe('')
    }
  })

  it('a scan of 0 files', () => {
    const r = capture(() => migrate(FLAGS, tree(tmp(), { 'README.md': 'x' }), pkg()))
    expect(r.code).toBe(1)
    expect(r.err).toContain('0 files')
  })

  it('a rows file it cannot read names the file', () => {
    const r = capture(() => migrate(FLAGS, app(), pkgWith({ 'areas/bad.json': '{ nope' })))
    expect(r.code).toBe(1)
    expect(r.err).toContain('areas/bad.json')
  })
})

describe('dispatch', () => {
  it('run() routes migrate here, not to the "not implemented" stub', () => {
    const app = tree(tmp(), { 'a.ts': 'export {}\n' })
    const r = capture(
      () => run(['migrate', '--from', '2.29.0', '--profile', 'bridge', '--json'], app) as number,
    )
    expect(r.err).not.toContain('not implemented')
    expect(JSON.parse(r.out)).toMatchObject({ schema: 1, from: '2.29.0', profile: 'bridge' })
    expect(r.code).toBe(0)
  })

  it('run() migrate --bogus exits 1', () => {
    expect(capture(() => run(['migrate', '--bogus'], tmp()) as number).code).toBe(1)
  })
})
