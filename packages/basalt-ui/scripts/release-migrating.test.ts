/**
 * The migration ledger: area-file validation, the surface-diff gate, the release step and the
 * generated MIGRATING.md. The CLI is driven against scratch repos via RELEASE_MIGRATING_ROOT.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, test } from 'bun:test'
import { foldChain, loadMigrationFiles } from '../src/cli/migrate/rows'
import { serializeShard, shardFile } from './export-surface-shards.mjs'

import {
  AREAS,
  DIGEST_RE,
  digestOf,
  findUncovered,
  loadAreas,
  mergeAreas,
  renderMigrating,
} from './release-migrating'
import type { AreaFile, Row } from './release-migrating'

const SCRIPT = join(import.meta.dir, 'release-migrating.ts')
const PKG = join(import.meta.dir, '..')
const REAL_ROOT = join(PKG, '..', '..')

const seed = (area: string): AreaFile => ({
  schema: 1,
  area,
  rows: [],
  tokens: { renamed: [], valueShifts: [] },
  storage: [],
  urls: [],
  attrs: [],
  rules: [],
})

const scratches: string[] = []
afterAll(() => {
  for (const dir of scratches) rmSync(dir, { recursive: true, force: true })
})

function sh(cwd: string, ...args: string[]): void {
  const r = Bun.spawnSync(args, { cwd, stdout: 'pipe', stderr: 'pipe' })
  if (!r.success) throw new Error(`${args.join(' ')}: ${r.stderr.toString()}`)
}

const vxSource = (names: string[]) =>
  `export const N = [\n${names.map((n) => `  '${n}',`).join('\n')}\n]\n`

/** One shard file per subpath, as `export-surface.mjs --update` writes them. */
function writeSurface(pkg: string, surface: Record<string, string[]>): void {
  const dir = join(pkg, 'scripts/export-surface')
  mkdirSync(dir, { recursive: true })
  for (const [subpath, names] of Object.entries(surface)) {
    writeFileSync(join(dir, shardFile(subpath)), serializeShard(names))
  }
}

/** A scratch git repo with the minimal tree, committed and tagged v2.29.0. */
function scratch(legacySurface = false): string {
  const dir = mkdtempSync(join(tmpdir(), 'release-migrating-'))
  scratches.push(dir)
  const pkg = join(dir, 'packages/basalt-ui')
  mkdirSync(join(pkg, 'scripts'), { recursive: true })
  mkdirSync(join(pkg, 'src/guard'), { recursive: true })
  cpSync(join(PKG, 'migrations'), join(pkg, 'migrations'), { recursive: true })
  // Lanes add real rows to the area files; the scratch repo starts from the empty seeds.
  for (const area of AREAS) {
    writeFileSync(
      join(pkg, 'migrations/areas', `${area}.json`),
      `${JSON.stringify(seed(area), null, 2)}\n`,
    )
  }
  cpSync(join(PKG, 'MIGRATING.md'), join(pkg, 'MIGRATING.md'))
  const taggedSurface = { '.': ['Keep', 'Gone'], './charts': ['Chart'] }
  if (legacySurface) {
    // A tag from before the shard split carries the single-file snapshot.
    writeFileSync(join(pkg, 'scripts/export-surface.json'), JSON.stringify(taggedSurface))
  } else {
    writeSurface(pkg, taggedSurface)
  }
  writeFileSync(join(pkg, 'src/guard/vx-names.ts'), vxSource(['--vx-a', '--vx-b']))
  sh(dir, 'git', 'init', '-q', '-b', 'master')
  sh(dir, 'git', 'config', 'user.email', 't@example.com')
  sh(dir, 'git', 'config', 'user.name', 't')
  sh(dir, 'git', 'config', 'commit.gpgsign', 'false')
  sh(dir, 'git', 'config', 'tag.gpgsign', 'false')
  sh(dir, 'git', 'add', '-A')
  sh(dir, 'git', 'commit', '-q', '-m', 'init')
  sh(dir, 'git', 'tag', 'v2.29.0')
  return dir
}

function run(dir: string, ...args: string[]) {
  const r = Bun.spawnSync(['bun', SCRIPT, ...args], {
    env: { ...process.env, RELEASE_MIGRATING_ROOT: dir },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return { code: r.exitCode, out: r.stdout.toString() + r.stderr.toString() }
}

const areaPath = (dir: string, area: string) =>
  join(dir, 'packages/basalt-ui/migrations/areas', `${area}.json`)
const readArea = (dir: string, area: string) =>
  JSON.parse(readFileSync(areaPath(dir, area), 'utf8')) as Record<string, unknown>
const writeArea = (dir: string, area: string, value: unknown) =>
  writeFileSync(areaPath(dir, area), `${JSON.stringify(value, null, 2)}\n`)

const ROW: Row = { id: 'gone', kind: 'removed', from: 'basalt-ui#Gone' }

describe('area files', () => {
  test('17 area files, in order, each valid', () => {
    expect(AREAS).toHaveLength(17)
    const areas = loadAreas(REAL_ROOT)
    expect(areas.map((a) => a.area)).toEqual([...AREAS])
  })
})

const walked = (from: string) => foldChain(loadMigrationFiles(PKG), from).map((f) => f.source)

describe('legacy-1x floor', () => {
  test('a 1.x install walks the floor file and reaches 3.0.0', () => {
    expect(walked('1.40.3')).toContain('areas/legacy-1x.json')
    expect(walked('1.41.0')).toContain('areas/legacy-1x.json')
  })

  test('a 2.x install does not', () => {
    expect(walked('2.29.0')).not.toContain('areas/legacy-1x.json')
  })
})

describe('--check', () => {
  test('exits 0 on empty areas', () => {
    expect(run(scratch(), '--check').code).toBe(0)
  })

  test('exits 0 on the committed state', () => {
    expect(run(REAL_ROOT, '--check').code).toBe(0)
  })

  const mutations: [string, (v: Record<string, unknown>) => unknown][] = [
    ['wrong schema', (v) => ({ ...v, schema: 2 })],
    ['extra key', (v) => ({ ...v, extra: 1 })],
    ['wrong area', (v) => ({ ...v, area: 'ui' })],
    ['non-string from', (v) => ({ ...v, rows: [{ id: 'a', kind: 'removed', from: 3 }] })],
    [
      'unknown row key',
      (v) => ({ ...v, rows: [{ id: 'a', kind: 'removed', from: 'f', bogus: 1 }] }),
    ],
    [
      'bad profile',
      (v) => ({ ...v, rows: [{ id: 'a', kind: 'removed', from: 'f', profiles: ['x'] }] }),
    ],
    ['unknown kind', (v) => ({ ...v, rows: [{ id: 'a', kind: 'k', from: 'f', to: 't' }] })],
    ['row without from', (v) => ({ ...v, rows: [{ id: 'a', kind: 'renamed', to: 't' }] })],
    [
      'row with an empty from',
      (v) => ({ ...v, rows: [{ id: 'a', kind: 'renamed', from: '', to: 't' }] }),
    ],
    ['renamed row without to', (v) => ({ ...v, rows: [{ id: 'a', kind: 'renamed', from: 'f' }] })],
    ['empty file-level from', (v) => ({ ...v, from: '' })],
    ['non-string file-level to', (v) => ({ ...v, to: 3 })],
    ['bad file-level profile', (v) => ({ ...v, profiles: ['x'] })],
    ['flag row without to', (v) => ({ ...v, rows: [{ id: 'a', kind: 'flag', from: 'f' }] })],
  ]
  for (const [name, mutate] of mutations) {
    test(`fails closed: ${name}`, () => {
      const dir = scratch()
      writeArea(dir, 'tokens', mutate(readArea(dir, 'tokens')))
      const r = run(dir, '--check')
      expect(r.code).not.toBe(0)
      expect(r.out).toContain('tokens.json')
    })
  }

  test('a file-level from, to and profiles are accepted and the merge ignores them', () => {
    const dir = scratch()
    writeArea(dir, 'legacy-1x', {
      ...readArea(dir, 'legacy-1x'),
      from: '>=1.40 <2',
      to: '3.0.0',
      profiles: ['app'],
      rows: [{ id: 'floor', kind: 'removed', from: 'basalt-ui#Gone' }],
    })
    expect(run(dir, '--check').code).toBe(0)
    const merged = mergeAreas(loadAreas(dir), '3.0.0')
    expect(merged.from).toBe('>=1.40 <3')
    expect(merged.rows.map((r) => r.id)).toEqual(['floor'])
  })

  test('fails closed: duplicate row id across two files', () => {
    const dir = scratch()
    for (const area of ['tokens', 'ui']) {
      writeArea(dir, area, {
        ...readArea(dir, area),
        rows: [{ id: 'dup', kind: 'removed', from: 'f' }],
      })
    }
    const r = run(dir, '--check')
    expect(r.code).not.toBe(0)
    expect(r.out).toContain('duplicate id')
  })

  test('fails closed: extra and missing files', () => {
    const dir = scratch()
    writeFileSync(areaPath(dir, 'bogus'), JSON.stringify(seed('bogus')))
    expect(run(dir, '--check').code).not.toBe(0)
    rmSync(areaPath(dir, 'bogus'))
    rmSync(areaPath(dir, 'ui'))
    expect(run(dir, '--check').code).not.toBe(0)
  })

  test('without a tag it warns and passes', () => {
    const dir = scratch()
    sh(dir, 'git', 'tag', '-d', 'v2.29.0')
    const r = run(dir, '--check')
    expect(r.code).toBe(0)
    expect(r.out).toContain('surface diff skipped')
  })

  test('a bad version is a usage error', () => {
    expect(run(scratch(), 'nope').code).toBe(2)
  })
})

describe('findUncovered', () => {
  const prev = { '.': ['A', 'B'], './x': ['C', 'D'] }
  const now = { '.': ['A'], './x': ['C', 'D'] }
  const none = mergeAreas(AREAS.map(seed), '0.0.0')
  const withRows = (rows: Row[]) => ({ ...none, rows })

  test('removed symbol without a row is listed', () => {
    expect(findUncovered(prev, now, [], [], none)).toEqual(['basalt-ui#B'])
  })

  test('exact row covers it', () => {
    const merged = withRows([{ id: 'b', kind: 'k', from: 'basalt-ui#B' }])
    expect(findUncovered(prev, now, [], [], merged)).toEqual([])
  })

  test('a bare-subpath row covers every symbol of the subpath', () => {
    const merged = withRows([{ id: 'x', kind: 'k', from: 'basalt-ui/x' }])
    expect(findUncovered(prev, { '.': ['A', 'B'] }, [], [], merged)).toEqual([])
    expect(findUncovered(prev, { '.': ['A'] }, [], [], merged)).toEqual(['basalt-ui#B'])
  })

  test('a moved symbol still needs a row', () => {
    const moved = { '.': ['A'], './y': ['B'], './x': ['C', 'D'] }
    expect(findUncovered(prev, moved, [], [], none)).toEqual(['basalt-ui#B'])
  })

  test('removed --vx name needs a row or a tokens.renamed from', () => {
    expect(findUncovered({}, {}, ['--vx-x'], [], none)).toEqual(['--vx-x'])
    const row = withRows([{ id: 'v', kind: 'k', from: '--vx-x' }])
    expect(findUncovered({}, {}, ['--vx-x'], [], row)).toEqual([])
    const renamed = {
      ...none,
      tokens: { ...none.tokens, renamed: [{ from: '--vx-x', to: '--vx-y' }] },
    }
    expect(findUncovered({}, {}, ['--vx-x'], ['--vx-y'], renamed)).toEqual([])
  })

  test('additions never fail', () => {
    const added = { ...prev, './z': ['Q'] }
    expect(findUncovered(prev, added, ['--vx-a'], ['--vx-a', '--vx-b'], none)).toEqual([])
  })

  test('result is sorted', () => {
    expect(findUncovered({ '.': ['Z', 'M'] }, {}, ['--vx-q'], [], none)).toEqual([
      '--vx-q',
      'basalt-ui#M',
      'basalt-ui#Z',
    ])
  })
})

describe('release step', () => {
  test('a previous tag with the legacy single-file snapshot still feeds the gate', () => {
    const dir = scratch(true)
    writeSurface(join(dir, 'packages/basalt-ui'), { '.': ['Keep'], './charts': ['Chart'] })
    const blocked = run(dir, '3.0.0')
    expect(blocked.code).not.toBe(0)
    expect(blocked.out).toContain('basalt-ui#Gone')
  })

  test('gate blocks without writing; a row lets it through', () => {
    const dir = scratch()
    const pkg = join(dir, 'packages/basalt-ui')
    const before = readFileSync(join(pkg, 'MIGRATING.md'), 'utf8')
    writeSurface(pkg, { '.': ['Keep'], './charts': ['Chart'] })

    const blocked = run(dir, '3.0.0')
    expect(blocked.code).not.toBe(0)
    expect(blocked.out).toContain('1 removed or renamed public name(s) have no migration row')
    expect(blocked.out).toContain('basalt-ui#Gone')
    expect(existsSync(join(pkg, 'migrations/3.0.0.json'))).toBe(false)
    expect(readFileSync(join(pkg, 'MIGRATING.md'), 'utf8')).toBe(before)

    writeArea(dir, 'ui', { ...readArea(dir, 'ui'), rows: [ROW] })
    const ok = run(dir, '3.0.0')
    expect(ok.code).toBe(0)
    const merged = JSON.parse(readFileSync(join(pkg, 'migrations/3.0.0.json'), 'utf8'))
    expect(merged.rows).toEqual([ROW])
    expect(merged.to).toBe('3.0.0')
    expect(merged.from).toBe('>=1.40 <3')
    expect(merged.profiles).toEqual(['tokens', 'bridge', 'parts', 'app'])
    expect(readFileSync(join(pkg, 'MIGRATING.md'), 'utf8')).toContain('`gone` (removed)')
  })

  test('no previous tag fails closed', () => {
    const dir = scratch()
    sh(dir, 'git', 'tag', '-d', 'v2.29.0')
    expect(run(dir, '3.0.0').code).not.toBe(0)
  })
})

describe('MIGRATING.md', () => {
  const committed = readFileSync(join(PKG, 'MIGRATING.md'), 'utf8')
  const merged = mergeAreas(loadAreas(REAL_ROOT), '0.0.0')

  test('matches the areas, or is pending the next release', () => {
    const digest = DIGEST_RE.exec(committed)?.[1]
    expect(digest).toBeDefined()
    expect(committed.startsWith('# Migrating basalt-ui\n')).toBe(true)
    if (digest === digestOf(merged)) expect(committed).toBe(renderMigrating(merged, digest))
  })

  test('is short, deterministic and carries the verbatim header', () => {
    expect(committed.split('\n').length).toBeLessThan(200)
    const digest = digestOf(merged)
    expect(renderMigrating(merged, digest)).toBe(renderMigrating(merged, digest))
    expect(committed).toContain(
      '3.0 is a rewrite of the styling and component layer, and 2.x consumers migrate when they choose: 2.x\n' +
        'stays on npm as published and a pin keeps working. The rows (renames, removals, token and storage\n' +
        'changes) land here with the 3.0 commits; until they do, stay on your 2.x pin.',
    )
  })

  test('merging concatenates in AREAS order', () => {
    const areas = AREAS.map((area, i) => ({
      ...seed(area),
      rows: [{ id: `r${i}`, kind: 'removed', from: `f${i}` }],
    }))
    expect(mergeAreas(areas, '3.0.0').rows.map((r) => r.id)).toEqual(AREAS.map((_, i) => `r${i}`))
  })

  test('renders rows, tokens and the other sections', () => {
    const md = renderMigrating(
      {
        ...merged,
        rows: [
          {
            id: 'a',
            kind: 'rename',
            from: 'basalt-ui#A',
            to: 'basalt-ui#B',
            codemod: 'c',
            manual: true,
          },
        ],
        tokens: {
          renamed: [{ from: '--vx-a', to: '--vx-b' }],
          valueShifts: [{ token: '--vx-c', from: '1', to: '2' }],
        },
        storage: [{ key: 'k', action: 'rename', to: 'k2' }],
        urls: [{ store: 's', golden: 'g' }],
        attrs: [{ from: 'a', to: 'b' }],
        rules: [{ old: 'o', new: 'n', severity: 'error' }],
      },
      'd',
    )
    expect(md).toContain('- `a` (rename): `basalt-ui#A` → `basalt-ui#B` — codemod: c — manual')
    expect(md).not.toContain('_None._')
  })
})

describe('no-conflict claim', () => {
  test('two branches editing different area files merge cleanly', () => {
    const dir = scratch()
    const edit = (area: string, id: string) =>
      writeArea(dir, area, { ...readArea(dir, area), rows: [{ id, kind: 'removed', from: id }] })
    const commit = (msg: string) => {
      sh(dir, 'git', 'add', '-A')
      sh(dir, 'git', 'commit', '-q', '-m', msg)
    }
    sh(dir, 'git', 'checkout', '-q', '-b', 'lane-a')
    edit('tokens', 'a')
    commit('a')
    sh(dir, 'git', 'checkout', '-q', 'master')
    sh(dir, 'git', 'checkout', '-q', '-b', 'lane-b')
    edit('ui', 'b')
    commit('b')
    sh(dir, 'git', 'merge', '-q', '--no-edit', 'lane-a')
    expect(loadAreas(dir).flatMap((a) => a.rows.map((r) => r.id))).toEqual(['a', 'b'])
  })
})
