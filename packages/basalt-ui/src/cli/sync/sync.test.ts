/**
 * `sync` against fixture trees (test/fixtures/sync): consumers in six shapes, one miniature shipped
 * package. The signal is zero false drift: a second `sync --check` after a `sync` must be green on
 * every shape, under a formatter, behind bun's isolated linker, and without touching an mtime.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseManifest, readManifest, serializeManifest, writeManifest } from '../manifest'
import type { Manifest } from '../manifest'
import { sync } from './index'
import type { SyncOptions } from './index'

const FIXTURES = fileURLToPath(new URL('../../../test/fixtures/sync/', import.meta.url))
const PKG = join(FIXTURES, 'pkg')
const OXFMT = fileURLToPath(new URL('../../../../../node_modules/.bin/oxfmt', import.meta.url))
const BEGIN = '<!-- basalt:begin'

const scratch: string[] = []
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true })
  delete process.env['BASALT_CWD']
})

function tmp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'basalt-sync-'))
  scratch.push(dir)
  return dir
}

/** A copy of a fixture consumer with a `.git` marker, the way `makeRepo` builds one. */
function consumer(name: string): string {
  const dir = tmp()
  cpSync(join(FIXTURES, 'consumers', name), dir, { recursive: true })
  mkdirSync(join(dir, '.git'))
  return dir
}

type Run = { code: number; log: string }

function run(dir: string, opts: SyncOptions = {}): Run {
  const saved = { log: console.log, error: console.error }
  let log = ''
  const sink = (...args: unknown[]): void => {
    log += `${args.join(' ')}\n`
  }
  console.log = sink
  console.error = sink
  try {
    return { code: sync({ pkgRoot: PKG, ...opts }, dir), log }
  } finally {
    console.log = saved.log
    console.error = saved.error
  }
}

/** Every file under `dir` (no `.git`) as relative path -> bytes. */
function snapshot(dir: string, root = dir, out = new Map<string, string>()): Map<string, string> {
  for (const name of readdirSync(dir)) {
    if (name === '.git') continue
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) snapshot(abs, root, out)
    else out.set(abs.slice(root.length + 1), readFileSync(abs, 'utf8'))
  }
  return out
}

/** Sets every file's mtime to a fixed past instant and returns the map: the writes oracle. */
function pinTimes(dir: string): Map<string, number> {
  const past = new Date('2001-01-01T00:00:00Z')
  const times = new Map<string, number>()
  for (const rel of snapshot(dir).keys()) {
    utimesSync(join(dir, rel), past, past)
    times.set(rel, past.getTime())
  }
  return times
}

function mtimes(dir: string): Map<string, number> {
  return new Map([...snapshot(dir).keys()].map((rel) => [rel, statSync(join(dir, rel)).mtimeMs]))
}

const read = (dir: string, rel: string): string => readFileSync(join(dir, rel), 'utf8')
function write(dir: string, rel: string, content: string): void {
  mkdirSync(join(dir, rel, '..'), { recursive: true })
  writeFileSync(join(dir, rel), content)
}
function manifestOf(dir: string): Manifest {
  const read = readManifest(dir)
  if (read === null || 'error' in read) throw new Error('fixture manifest unreadable')
  return read.manifest
}

const SHAPES = [
  'single-root',
  'multi-root',
  'shutterflow',
  'root-dot',
  'oxfmt-formatted',
  'tokens-only',
]

describe('zero false drift', () => {
  it.each(SHAPES)('%s: a second sync --check is green and writes nothing', (shape) => {
    const dir = consumer(shape)
    expect(run(dir).code).toBe(0)
    const placed = snapshot(dir)
    const times = pinTimes(dir)

    const check = run(dir, { check: true })
    expect(check.log).toContain('all managed files current')
    expect(check.code).toBe(0)
    expect(run(dir).code).toBe(0)
    expect(snapshot(dir)).toEqual(placed)
    expect(mtimes(dir)).toEqual(times)
  })

  it('places rules by declared profile: a tokens-only repo gets the block and no agent files', () => {
    const dir = consumer('tokens-only')
    run(dir)
    expect(existsSync(join(dir, '.claude'))).toBe(false)
    expect(read(dir, 'AGENTS.md')).toContain('Profile: tokens')
  })

  it('renders rule paths from the declared roots, sorted, and `.` as **', () => {
    const multi = consumer('multi-root')
    run(multi)
    const rule = read(multi, '.claude/rules/basalt-tokens.md')
    expect(rule).toContain(
      "paths:\n  - 'apps/admin/src/**'\n  - 'apps/web/src/**'\n  - 'packages/ui/src/**'\n",
    )
    expect(read(multi, '.claude/rules/basalt-state.md')).not.toContain('paths:')

    const shutter = consumer('shutterflow')
    run(shutter)
    const scoped = read(shutter, '.claude/rules/basalt-ui.md')
    expect(scoped).toContain("  - 'apps/desktop/src/**'\n  - 'apps/gallery/src/**'\n")
    expect(scoped).not.toContain('apps/share')

    const dot = consumer('root-dot')
    run(dot)
    expect(read(dot, '.claude/rules/basalt-ui.md')).toContain("paths:\n  - '**'\n")
  })

  it('stays green behind a formatter that ignores the managed paths, and on templates it keeps clean', () => {
    const dir = consumer('oxfmt-formatted')
    run(dir)
    const fmt = Bun.spawnSync([OXFMT, '.'], { cwd: dir })
    expect(fmt.exitCode).toBe(0)
    expect(run(dir, { check: true }).code).toBe(0)
    expect(read(dir, 'CLAUDE.md')).toBe('# Mine\n')
  })

  it('stays green behind bun’s isolated linker: the symlinked package renders the same tree', () => {
    const store = tmp()
    const real = join(store, 'node_modules/.bun/basalt-ui@3.0.0/node_modules/basalt-ui')
    mkdirSync(join(real, '..'), { recursive: true })
    cpSync(PKG, real, { recursive: true })

    const viaReal = consumer('single-root')
    const viaLink = consumer('single-root')
    mkdirSync(join(viaLink, 'node_modules'))
    symlinkSync(real, join(viaLink, 'node_modules/basalt-ui'))

    expect(run(viaReal, { pkgRoot: real }).code).toBe(0)
    expect(run(viaLink, { pkgRoot: join(viaLink, 'node_modules/basalt-ui') }).code).toBe(0)
    const strip = (dir: string): Map<string, string> => {
      const all = snapshot(dir)
      for (const key of all.keys()) if (key.startsWith('node_modules')) all.delete(key)
      return all
    }
    expect(strip(viaLink)).toEqual(strip(viaReal))
    expect(
      run(viaLink, { check: true, pkgRoot: join(viaLink, 'node_modules/basalt-ui') }).code,
    ).toBe(0)
  })
})

describe('roots', () => {
  it('detects a changed manifest.roots, writes nothing under --check, and sync finishes it', () => {
    const dir = consumer('single-root')
    run(dir)
    const manifest = manifestOf(dir)
    writeManifest(dir, { ...manifest, roots: { 'apps/web/src': 'app' } })
    const times = pinTimes(dir)

    const check = run(dir, { check: true })
    expect(check.code).toBe(1)
    expect(check.log).toContain('.claude/rules/basalt-tokens.md')
    expect(check.log).toContain('.claude/rules/basalt-ui.md')
    expect(check.log).not.toContain('basalt-state.md')
    expect(mtimes(dir)).toEqual(times)

    expect(run(dir).code).toBe(0)
    expect(read(dir, '.claude/rules/basalt-ui.md')).toContain("'apps/web/src/**'")
    expect(run(dir, { check: true }).code).toBe(0)
  })

  it('reordering the same roots is no drift', () => {
    const dir = consumer('multi-root')
    run(dir)
    const manifest = manifestOf(dir)
    const reversed = Object.fromEntries(Object.entries(manifest.roots).toReversed())
    writeManifest(dir, { ...manifest, roots: reversed })
    expect(run(dir, { check: true }).code).toBe(0)
  })
})

describe('edited and retired files', () => {
  it('leaves an edited rule, reports it, and --force overwrites it', () => {
    const dir = consumer('single-root')
    run(dir)
    const edited = `${read(dir, '.claude/rules/basalt-state.md')}\n- our own bullet\n`
    write(dir, '.claude/rules/basalt-state.md', edited)

    const check = run(dir, { check: true })
    expect(check.code).toBe(1)
    expect(check.log).toContain('basalt-state.md: edited locally')

    const plain = run(dir)
    expect(plain.code).toBe(0)
    expect(plain.log).toContain('.claude/rules/basalt-state.md')
    expect(read(dir, '.claude/rules/basalt-state.md')).toBe(edited)

    expect(run(dir, { force: true }).code).toBe(0)
    expect(read(dir, '.claude/rules/basalt-state.md')).not.toContain('our own bullet')
    expect(run(dir, { check: true }).code).toBe(0)
  })

  it('keeps an edit through a roots change while the untouched rules move', () => {
    const dir = consumer('single-root')
    run(dir)
    const edited = `${read(dir, '.claude/rules/basalt-ui.md')}\n- ours\n`
    write(dir, '.claude/rules/basalt-ui.md', edited)
    writeManifest(dir, { ...manifestOf(dir), roots: { lib: 'app' } })

    run(dir)
    expect(read(dir, '.claude/rules/basalt-ui.md')).toBe(edited)
    expect(read(dir, '.claude/rules/basalt-tokens.md')).toContain("'lib/**'")
  })

  it('never clobbers an unrecorded file at a managed path', () => {
    const dir = consumer('single-root')
    write(dir, '.claude/rules/basalt-state.md', 'mine, from before sync existed\n')
    run(dir)
    expect(read(dir, '.claude/rules/basalt-state.md')).toBe('mine, from before sync existed\n')
  })

  it('deletes a retired untouched file and its emptied directory, and leaves a retired edited one', () => {
    const dir = consumer('single-root')
    run(dir)
    const untouched = '.claude/skills/basalt-old/SKILL.md'
    const edited = '.claude/rules/basalt-gone.md'
    write(dir, untouched, 'retired upstream\n')
    write(dir, edited, 'retired upstream\n')
    const first = manifestOf(dir)
    const sha = new Bun.CryptoHasher('sha256').update('retired upstream\n').digest('hex')
    writeManifest(dir, { ...first, managed: { ...first.managed, [untouched]: sha, [edited]: sha } })
    write(dir, edited, 'retired upstream, but ours now\n')

    const check = run(dir, { check: true })
    expect(check.code).toBe(1)
    expect(check.log).toContain(`${untouched}: retired`)
    expect(check.log).toContain(`${edited}: retired (edited locally)`)
    expect(existsSync(join(dir, untouched))).toBe(true)

    run(dir)
    expect(existsSync(join(dir, untouched))).toBe(false)
    expect(existsSync(join(dir, '.claude/skills/basalt-old'))).toBe(false)
    expect(existsSync(join(dir, '.claude/skills/basalt-design'))).toBe(true)
    expect(read(dir, edited)).toBe('retired upstream, but ours now\n')
    expect(manifestOf(dir).managed[untouched]).toBeUndefined()
    expect(manifestOf(dir).managed[edited]).toBe(sha)

    run(dir, { force: true })
    expect(existsSync(join(dir, edited))).toBe(false)
    expect(manifestOf(dir).managed[edited]).toBeUndefined()
  })

  it('drops the ledger entry of a retired file that is already gone', () => {
    const dir = consumer('single-root')
    run(dir)
    const manifest = manifestOf(dir)
    const ghost = '.claude/rules/basalt-ghost.md'
    writeManifest(dir, { ...manifest, managed: { ...manifest.managed, [ghost]: 'abc' } })
    expect(run(dir, { check: true }).code).toBe(0)
    run(dir)
    expect(manifestOf(dir).managed['.claude/rules/basalt-ghost.md']).toBeUndefined()
  })
})

describe('the AGENTS block', () => {
  it('appends once when absent, keeps the host, and never creates or touches CLAUDE.md', () => {
    const dir = consumer('single-root')
    run(dir)
    const first = read(dir, 'AGENTS.md')
    expect(first.startsWith('# Host\n\nKeep this.\n\n<!-- basalt:begin 3.0.0 -->')).toBe(true)
    expect(first.split(BEGIN)).toHaveLength(2)
    expect(existsSync(join(dir, 'CLAUDE.md'))).toBe(false)

    expect(run(dir).code).toBe(0)
    expect(read(dir, 'AGENTS.md')).toBe(first)
  })

  it('creates AGENTS.md when the host file is missing', () => {
    const dir = consumer('root-dot')
    run(dir)
    expect(read(dir, 'AGENTS.md').startsWith('<!-- basalt:begin 3.0.0 -->')).toBe(true)
  })

  it('replaces only the marked region and keeps text either side', () => {
    const dir = consumer('single-root')
    run(dir)
    const stale = read(dir, 'AGENTS.md')
      .replace('Profile: app', 'Profile: elsewhere')
      .replace('# Host', '# Host (edited)')
    write(dir, 'AGENTS.md', `${stale}\nAfter the block.\n`)
    expect(run(dir, { check: true }).log).toContain('AGENTS.md: basalt block out of date')
    run(dir)
    const healed = read(dir, 'AGENTS.md')
    expect(healed).toContain('Profile: app')
    expect(healed.startsWith('# Host (edited)\n')).toBe(true)
    expect(healed.endsWith('\nAfter the block.\n')).toBe(true)
  })

  it('a duplicate marker pair exits 1 with both line numbers, in sync and in --check, writing nothing', () => {
    const dir = consumer('single-root')
    run(dir)
    const block = read(dir, 'AGENTS.md').slice(read(dir, 'AGENTS.md').indexOf(BEGIN))
    write(dir, 'AGENTS.md', `${read(dir, 'AGENTS.md')}\n${block}`)
    const before = snapshot(dir)
    const lines = read(dir, 'AGENTS.md')
      .split('\n')
      .flatMap((text, i) => (text.startsWith(BEGIN) ? [i + 1] : []))
    expect(lines).toHaveLength(2)

    for (const opts of [{}, { check: true }]) {
      const out = run(dir, opts)
      expect(out.code).toBe(1)
      expect(out.log).toMatch(/duplicate/i)
      expect(out.log).toContain(`lines ${lines[0]} and ${lines[1]}`)
    }
    expect(snapshot(dir)).toEqual(before)
  })

  it('a begin marker with no end is an error that names its line', () => {
    const dir = consumer('single-root')
    write(dir, 'AGENTS.md', '# Host\n\n<!-- basalt:begin 3.0.0 -->\nhalf a block\n')
    const out = run(dir)
    expect(out.code).toBe(1)
    expect(out.log).toContain('line 3')
    expect(read(dir, 'AGENTS.md')).toBe('# Host\n\n<!-- basalt:begin 3.0.0 -->\nhalf a block\n')
  })

  it('does not count a prose mention of the marker as a block', () => {
    const dir = consumer('single-root')
    write(dir, 'AGENTS.md', 'Mention `<!-- basalt:begin -->` in prose.\n')
    expect(run(dir).code).toBe(0)
    expect(read(dir, 'AGENTS.md').startsWith('Mention `<!-- basalt:begin -->` in prose.\n\n')).toBe(
      true,
    )
  })
})

describe('the manifest', () => {
  it('round-trips tokens[], extra, ejected and fields it does not know through a sync', () => {
    const dir = consumer('single-root')
    const manifest: Manifest = {
      ...manifestOf(dir),
      ejected: {
        button: { path: 'src/components/ui/button.tsx', fromVersion: '3.0.0', origin: 'ejected' },
      },
      deepRender: ['src/stage.ts'],
      viewports: ['1800x1200'],
      rest: { futureField: { a: 1 } },
    }
    writeManifest(dir, manifest)
    run(dir)
    const after = manifestOf(dir)
    expect(after.tokens).toEqual(manifest.tokens)
    expect(after.extra).toBe('src/basalt.tokens.ts')
    expect(after.ejected).toEqual(manifest.ejected)
    expect(after.deepRender).toEqual(['src/stage.ts'])
    expect(after.viewports).toEqual(['1800x1200'])
    expect(after.rest).toEqual({ futureField: { a: 1 } })
    expect(Object.keys(after.managed)).toContain('.claude/rules/basalt-tokens.md')
    expect(parseManifest(serializeManifest(after))).toEqual({ manifest: after })
  })

  it('records the digest of the raw bytes it wrote', () => {
    const dir = consumer('single-root')
    run(dir)
    const rule = '.claude/rules/basalt-state.md'
    const sha = new Bun.CryptoHasher('sha256').update(read(dir, rule)).digest('hex')
    expect(manifestOf(dir).managed[rule]).toBe(sha)
    expect(manifestOf(dir).version).toBe('3.0.0')
  })

  it.each([
    ['not JSON', '{'],
    ['no profile', '{"version":"2.29.0","files":{}}'],
    ['a bad profile', '{"profile":"shiny"}'],
    ['an absolute root', '{"profile":"app","roots":{"/etc":"app"}}'],
    ['a root that leaves the install', '{"profile":"app","roots":{"../x":"app"}}'],
    ['a managed key that leaves the install', '{"profile":"app","managed":{"../../x.txt":"abc"}}'],
    ['a root with a bad profile', '{"profile":"app","roots":{"src":"nope"}}'],
    ['malformed tokens', '{"profile":"app","tokens":[{"out":"a.css","format":"scss","flags":[]}]}'],
    ['a non-string extra', '{"profile":"app","extra":3}'],
  ])('rejects %s with an error and no stack', (_label, text) => {
    expect('error' in parseManifest(text)).toBe(true)
  })

  it('refuses a broken manifest from sync, exit 1, nothing written', () => {
    const dir = consumer('single-root')
    write(dir, '.basalt/manifest.json', '{"version":"2.29.0","files":{}}')
    const before = snapshot(dir)
    const out = run(dir)
    expect(out.code).toBe(1)
    expect(out.log).toContain('migrate')
    expect(snapshot(dir)).toEqual(before)
  })
})

describe('the install', () => {
  it('refuses a repo with no manifest, names init --profile, and writes nothing', () => {
    const dir = tmp()
    mkdirSync(join(dir, '.git'))
    write(dir, 'package.json', '{"name":"x","devDependencies":{"basalt-ui":"^3.0.0"}}')
    const before = snapshot(dir)
    for (const opts of [{}, { check: true }]) {
      const out = run(dir, opts)
      expect(out.code).toBe(1)
      expect(out.log).toContain('basalt-ui init --profile')
    }
    expect(snapshot(dir)).toEqual(before)
  })

  it('syncs the install above from a package under a declared root', () => {
    const dir = consumer('multi-root')
    mkdirSync(join(dir, 'apps/web'), { recursive: true })
    const out = run(join(dir, 'apps/web'))
    expect(out.code).toBe(0)
    expect(out.log).toContain(`belongs to the install at ${dir}`)
    expect(existsSync(join(dir, '.claude/rules/basalt-tokens.md'))).toBe(true)
    expect(existsSync(join(dir, 'apps/web/.claude'))).toBe(false)
  })

  it('refuses an undeclared second consumer under the install, writing nothing', () => {
    const dir = consumer('multi-root')
    mkdirSync(join(dir, 'tools/scripts'), { recursive: true })
    const before = snapshot(dir)
    const out = run(join(dir, 'tools/scripts'))
    expect(out.code).toBe(1)
    expect(out.log).toContain('undeclared second consumer')
    expect(snapshot(dir)).toEqual(before)
  })

  it('resolves BASALT_CWD ahead of the cwd and says so', () => {
    const dir = consumer('single-root')
    const elsewhere = tmp()
    process.env['BASALT_CWD'] = dir
    const out = run(elsewhere, { check: true })
    expect(out.log).toContain(`BASALT_CWD relocated from ${elsewhere} to ${dir}`)
  })
})

describe('the preset seam', () => {
  const presetFiles = (): { path: string; content: string }[] => [
    { path: '.oxlintrc.basalt.json', content: '{ "plugins": [] }\n' },
  ]

  it('places generated files, overwrites an edit without a digest, and checks their bytes', () => {
    const dir = consumer('single-root')
    expect(run(dir, { presetFiles }).code).toBe(0)
    expect(read(dir, '.oxlintrc.basalt.json')).toBe('{ "plugins": [] }\n')
    expect(Object.keys(manifestOf(dir).managed)).not.toContain('.oxlintrc.basalt.json')
    expect(run(dir, { presetFiles, check: true }).code).toBe(0)

    write(dir, '.oxlintrc.basalt.json', '{ "plugins": ["mine"] }\n')
    const check = run(dir, { presetFiles, check: true })
    expect(check.code).toBe(1)
    expect(check.log).toContain('.oxlintrc.basalt.json: out of date')
    run(dir, { presetFiles })
    expect(read(dir, '.oxlintrc.basalt.json')).toBe('{ "plugins": [] }\n')
  })

  it('defaults to no preset files', () => {
    const dir = consumer('single-root')
    run(dir)
    expect(existsSync(join(dir, '.oxlintrc.basalt.json'))).toBe(false)
  })
})
