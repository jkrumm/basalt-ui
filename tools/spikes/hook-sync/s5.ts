/**
 * S5 (skills-agent-layer.md section 8): render-then-compare `sync`. The renderer here is a stub of the
 * v3 one: it fills the `paths:` list of a managed rule from the declared (or detected) roots and leaves
 * every other byte alone, the same job `renderRulePaths` does in 2.x. The managed set is the shipped 2.x
 * rules and skills. Compare = render in memory, read the file, classify with the E1 digest
 * (guardrails.md section 15): current | missing | stale (digest unchanged, render moved) | edited.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { AGENT_DIR, OXFMT, progress, put, sha256, sh, treeDigest, walk } from './util'

const FRONT = /^---\n[\s\S]*?\n---\n/
const PATHS = /^paths:\n(?: {2}- .*\n)+/m
const MANIFEST = '.basalt/manifest.json'

type Managed = { dest: string; text: string }
type Manifest = { basaltVersion: string; roots: string[]; managed: Record<string, string> }
type Kind = 'current' | 'missing' | 'stale' | 'edited'
type Report = Record<Kind, string[]>

export function renderPaths(text: string, roots: readonly string[], sort = false): string {
  const front = FRONT.exec(text)?.[0]
  if (front === undefined || !/^paths:/m.test(front)) return text
  const list = (sort ? [...roots].sort() : roots).map((raw) => {
    const root = raw.replace(/^(?:\.\/)+/, '').replace(/\/+$/, '')
    if (raw.startsWith('/') || root === '')
      throw new Error(`root must be a relative directory: ${raw}`)
    return `  - '${root === '.' ? '**' : `${root}/**`}'`
  })
  return front.replace(PATHS, () => `paths:\n${list.join('\n')}\n`) + text.slice(front.length)
}

function loadManaged(agentDir: string): Managed[] {
  const out: Managed[] = []
  for (const kind of ['rules', 'skills'] as const) {
    for (const f of walk(join(agentDir, kind))) {
      out.push({
        dest: `.claude/${kind}/${f}`,
        text: readFileSync(join(agentDir, kind, f), 'utf8'),
      })
    }
  }
  return out
}

type Pkg = { workspaces?: string[]; basalt?: { roots: string[] }; [k: string]: unknown }
const readJson = <T = Pkg>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T

/** Declared `basalt.roots`, else every workspace package that has a `src`, else a root `src`. */
function resolveRoots(dir: string): string[] {
  const pkg = readJson(join(dir, 'package.json'))
  const declared = pkg.basalt?.roots
  if (declared) return declared
  const found: string[] = []
  for (const glob of (pkg.workspaces ?? []) as string[]) {
    const base = glob.replace(/\/\*$/, '')
    if (!existsSync(join(dir, base))) continue
    for (const child of walkDirs(join(dir, base)))
      if (existsSync(join(dir, base, child, 'src'))) found.push(`${base}/${child}/src`)
  }
  if (found.length === 0 && existsSync(join(dir, 'src'))) found.push('src')
  return found.sort()
}

const walkDirs = (d: string): string[] =>
  walk(d)
    .map((f) => f.split('/')[0]!)
    .filter((v, i, a) => a.indexOf(v) === i)

type Opts = { check?: boolean; force?: boolean; sort?: boolean; pkgAgent?: string }

/** The sync core: classify every managed file, write what is safe to write (not in check mode). */
function reconcile(dir: string, opts: Opts = {}): Report {
  const roots = resolveRoots(dir)
  const managed = loadManaged(opts.pkgAgent ?? AGENT_DIR)
  const manifestPath = join(dir, MANIFEST)
  const manifest: Manifest = existsSync(manifestPath)
    ? readJson(manifestPath)
    : { basaltVersion: '0.0.0-spike', roots: [], managed: {} }
  const report: Report = { current: [], missing: [], stale: [], edited: [] }
  for (const m of managed) {
    const want = renderPaths(m.text, roots, opts.sort)
    const path = join(dir, m.dest)
    const disk = existsSync(path) ? readFileSync(path, 'utf8') : null
    let kind: Kind
    if (disk === want) kind = 'current'
    else if (disk === null) kind = 'missing'
    else kind = sha256(disk) === manifest.managed[m.dest] ? 'stale' : 'edited'
    report[kind].push(m.dest)
    if (opts.check) continue
    if (kind === 'edited' && !opts.force) continue
    if (kind !== 'current') put(path, want)
    manifest.managed[m.dest] = sha256(want)
  }
  if (!opts.check) {
    manifest.roots = roots
    put(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  }
  return report
}

const nonCurrent = (r: Report): number => r.missing.length + r.stale.length + r.edited.length

/** `.basalt/manifest.json` of the nearest ancestor, the way `sync` resolves the project from a package. */
function findProject(cwd: string): string {
  let d = cwd
  while (!existsSync(join(d, MANIFEST))) {
    const up = dirname(d)
    if (up === d) throw new Error('no manifest above cwd')
    d = up
  }
  return d
}

type Shape = { name: string; files: Record<string, string>; roots?: string[]; deepest: string }

const ws = ['apps/*', 'packages/*']
const pkgJson = (name: string, extra: Record<string, unknown> = {}): string =>
  `${JSON.stringify({ name, private: true, ...extra }, null, 2)}\n`
const tsx = 'export const X = () => null\n'

function shapes(): Shape[] {
  const roots = (r: string[]): Record<string, unknown> => ({ basalt: { roots: r } })
  return [
    {
      name: 'single-root',
      roots: ['src'],
      deepest: 'src',
      files: { 'package.json': pkgJson('a', roots(['src'])), 'src/main.tsx': tsx },
    },
    {
      name: 'root-dot',
      roots: ['.'],
      deepest: 'lib',
      files: { 'package.json': pkgJson('a', roots(['.'])), 'lib/main.tsx': tsx },
    },
    {
      name: 'workspace-one-root',
      roots: ['apps/dashboard/src'],
      deepest: 'apps/dashboard/src',
      files: {
        'package.json': pkgJson('w', { workspaces: ws, ...roots(['apps/dashboard/src']) }),
        'apps/dashboard/src/main.tsx': tsx,
        'packages/ui/src/x.tsx': tsx,
        'packages/config/index.ts': 'export {}\n',
      },
    },
    {
      name: 'workspace-several-roots',
      roots: ['apps/dashboard/src', 'apps/web/src', 'packages/ui/src'],
      deepest: 'apps/web/src',
      files: {
        'package.json': pkgJson('w', {
          workspaces: ws,
          ...roots(['apps/dashboard/src', 'apps/web/src', 'packages/ui/src']),
        }),
        'apps/dashboard/src/a.tsx': tsx,
        'apps/web/src/b.tsx': tsx,
        'packages/ui/src/c.tsx': tsx,
      },
    },
    {
      name: 'workspace-derived',
      deepest: 'packages/ui/src',
      files: {
        'package.json': pkgJson('w', { workspaces: ws }),
        'apps/dashboard/src/a.tsx': tsx,
        'apps/web/src/b.tsx': tsx,
        'packages/ui/src/c.tsx': tsx,
      },
    },
    {
      // Desktop app, one frontend root next to a Rust crate; no basalt file exists yet (a first install).
      name: 'desktop-single-root',
      roots: ['src'],
      deepest: 'src',
      files: {
        'package.json': pkgJson('d', roots(['src'])),
        'src/main.tsx': tsx,
        'src-tauri/Cargo.toml': '[package]\nname = "d"\n',
        'AGENTS.md': '# d\n\nDesktop app.\n',
      },
    },
  ]
}

function build(shape: Shape, base: string): string {
  const dir = mkdtempSync(join(base, `${shape.name}-`))
  for (const [f, t] of Object.entries(shape.files)) put(join(dir, f), t)
  return dir
}

type Ignore = 'none' | 'oxfmtignore' | 'prettierignore' | 'rcPatterns'

function format(dir: string, config: 'default' | 'repo', ignore: Ignore): number | null {
  for (const f of ['.oxfmtrc.json', '.oxfmtignore', '.prettierignore'])
    rmSync(join(dir, f), { force: true })
  const repo = {
    printWidth: 100,
    tabWidth: 2,
    useTabs: false,
    singleQuote: true,
    trailingComma: 'all',
    semi: false,
  }
  const rc = {
    ...(config === 'repo' ? repo : {}),
    ...(ignore === 'rcPatterns' ? { ignorePatterns: ['.claude/**', '.basalt/**'] } : {}),
  }
  if (Object.keys(rc).length > 0)
    writeFileSync(join(dir, '.oxfmtrc.json'), `${JSON.stringify(rc)}\n`)
  if (ignore === 'oxfmtignore') writeFileSync(join(dir, '.oxfmtignore'), '.claude/\n.basalt/\n')
  if (ignore === 'prettierignore')
    writeFileSync(join(dir, '.prettierignore'), '.claude/\n.basalt/\n')
  return sh(`"${OXFMT}" --write . >/dev/null 2>&1`, { cwd: dir }).status
}

const pathBearing = (): number =>
  loadManaged(AGENT_DIR).filter((m) => /^paths:/m.test(FRONT.exec(m.text)?.[0] ?? '')).length

function addRoot(shape: Shape, dir: string, name = 'extra'): void {
  if (shape.roots === undefined) return void put(join(dir, `packages/${name}/src/x.tsx`), tsx)
  const pkg = readJson(join(dir, 'package.json'))
  pkg.basalt = { roots: [...(pkg.basalt?.roots ?? []), `packages/${name}/src`] }
  writeFileSync(join(dir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`)
}

function swapRoot(shape: Shape, dir: string): void {
  if (shape.roots === undefined) return void rmSync(join(dir, 'apps/web'), { recursive: true })
  const pkg = readJson(join(dir, 'package.json'))
  pkg.basalt = { roots: shape.roots.length > 1 ? shape.roots.slice(0, -1) : ['other/src'] }
  writeFileSync(join(dir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`)
}

function measureShape(shape: Shape, base: string) {
  const dir = build(shape, base)
  const total = loadManaged(AGENT_DIR).length
  const first = reconcile(dir)
  let falseDrift = 0
  const check = (cwd = dir): Report => reconcile(findProject(cwd), { check: true })

  falseDrift += nonCurrent(check())
  const before = treeDigest(dir)
  reconcile(dir)
  const idempotent = treeDigest(dir) === before
  if (!idempotent) falseDrift++
  const sub = join(dir, shape.deepest)
  mkdirSync(sub, { recursive: true })
  const subdirDrift = nonCurrent(check(sub))
  falseDrift += subdirDrift

  // The consumer's formatter runs over the whole tree. oxfmt 0.72 reads `.gitignore` and `.prettierignore`
  // by default and `.oxfmtignore` only behind `--ignore-path`, so each way of ignoring is measured.
  const formatterExits: (number | null)[] = []
  const fmt = (config: 'default' | 'repo', ignore: Ignore): number => {
    const copy = `${dir}-fmt-${config}-${ignore}`
    cpSync(dir, copy, { recursive: true })
    formatterExits.push(format(copy, config, ignore))
    return nonCurrent(reconcile(copy, { check: true }))
  }
  const ignoredDrift = fmt('default', 'rcPatterns')
  falseDrift += ignoredDrift
  const unignored = {
    defaultConfig: fmt('default', 'none'),
    repoConfig: fmt('repo', 'none'),
    oxfmtignoreFileOnly: fmt('default', 'oxfmtignore'),
    prettierignore: fmt('default', 'prettierignore'),
  }

  // Roots change. Every path-bearing file must flip to stale, nothing else may.
  const want = pathBearing()
  const cases: Record<string, unknown> = {}
  const detect = (name: string, mutate: () => void): boolean => {
    mutate()
    const r = check()
    const ok = r.stale.length === want && r.edited.length === 0 && r.missing.length === 0
    cases[name] = {
      stale: r.stale.length,
      edited: r.edited.length,
      expectedStale: want,
      detected: ok,
    }
    reconcile(dir)
    if (nonCurrent(check()) !== 0) cases[`${name}Applied`] = 'not clean after sync'
    return ok
  }
  const detectedAdd = detect('rootAdded', () => addRoot(shape, dir))
  const detectedSwap = detect('rootRemovedOrReplaced', () => swapRoot(shape, dir))

  // An edited managed file plus a roots change: the edit is kept and reported, the rest follows the roots.
  const tokens = join(dir, '.claude/rules/basalt-tokens.md')
  writeFileSync(tokens, `${readFileSync(tokens, 'utf8')}\n- a local line the consumer added\n`)
  addRoot(shape, dir, 'extra2')
  const mixed = check()
  const kept = reconcile(dir)
  const stillEdited = check().edited.length === 1
  reconcile(dir, { force: true })
  const mixedOk =
    mixed.edited.length === 1 &&
    mixed.stale.length === want - 1 &&
    kept.edited.length === 1 &&
    stillEdited &&
    nonCurrent(check()) === 0
  cases['editedPlusRootChange'] = {
    edited: mixed.edited.length,
    stale: mixed.stale.length,
    keptByWrite: stillEdited,
    forceFinishes: nonCurrent(check()) === 0,
    detected: mixedOk,
  }

  // Reordering the same roots: drift to the plain renderer, silent for a renderer that sorts.
  let reorder: unknown = 'n/a (one root)'
  const roots = resolveRoots(dir)
  if (roots.length > 1) {
    reconcile(dir, { sort: true })
    const pkg = readJson(join(dir, 'package.json'))
    if (pkg.basalt?.roots) {
      pkg.basalt = { roots: roots.toReversed() }
      writeFileSync(join(dir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`)
      reorder = {
        plainRendererStale: reconcile(dir, { check: true }).stale.length,
        sortingRendererStale: reconcile(dir, { check: true, sort: true }).stale.length,
      }
    }
  }

  return {
    name: shape.name,
    managedFiles: total,
    pathBearingFiles: want,
    firstSyncCreated: first.missing.length,
    falseDrift,
    idempotent,
    subdirDrift,
    formatterIgnored: ignoredDrift,
    formatterExits,
    formatterUnignored: unignored,
    rootsChange: cases,
    reorder,
    detected: detectedAdd && detectedSwap && mixedOk,
  }
}

/** bun's isolated linker: the package sits beside its dependent, not at the root. */
function measureIsolated(base: string) {
  const dir = mkdtempSync(join(base, 'isolated-'))
  const pkgDir = join(dir, 'vendor/pkg/package')
  cpSync(join(AGENT_DIR, 'rules'), join(pkgDir, 'agent/rules'), { recursive: true })
  cpSync(join(AGENT_DIR, 'skills'), join(pkgDir, 'agent/skills'), { recursive: true })
  put(
    join(pkgDir, 'package.json'),
    '{"name":"basalt-ui","version":"0.0.0-spike","bin":{"basalt-ui":"bin.mjs"}}\n',
  )
  put(join(pkgDir, 'bin.mjs'), '#!/usr/bin/env node\nconsole.log("stub")\n', 0o755)
  sh('tar -czf vendor/basalt-ui.tgz -C vendor/pkg package', { cwd: dir })
  put(
    join(dir, 'package.json'),
    pkgJson('iso', { workspaces: ['apps/*'], basalt: { roots: ['apps/dashboard/src'] } }),
  )
  put(
    join(dir, 'apps/dashboard/package.json'),
    '{"name":"dashboard","dependencies":{"basalt-ui":"file:../../vendor/basalt-ui.tgz"}}\n',
  )
  put(join(dir, 'apps/dashboard/src/main.tsx'), tsx)
  put(join(dir, 'bunfig.toml'), '[install]\nlinker = "isolated"\n')
  const install = Bun.spawnSync([process.execPath, 'install'], {
    cwd: dir,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const resolveFrom = (from: string): string | null => {
    try {
      return Bun.resolveSync('basalt-ui/package.json', from)
    } catch {
      return null
    }
  }
  const fromApp = resolveFrom(join(dir, 'apps/dashboard'))
  const fromRoot = resolveFrom(dir)
  let renderIdentical = false
  if (fromApp !== null) {
    reconcile(dir, { pkgAgent: join(dirname(fromApp), 'agent') })
    const direct = mkdtempSync(join(base, 'direct-'))
    put(join(direct, 'package.json'), readFileSync(join(dir, 'package.json'), 'utf8'))
    reconcile(direct)
    renderIdentical = treeDigest(join(dir, '.claude')) === treeDigest(join(direct, '.claude'))
  }
  return {
    installExit: install.exitCode,
    packageAtRoot: existsSync(join(dir, 'node_modules/basalt-ui')),
    packageBesideApp: existsSync(join(dir, 'apps/dashboard/node_modules/basalt-ui')),
    resolvesFromRoot: fromRoot !== null,
    resolvesFromApp: fromApp !== null,
    resolvedThroughStore: fromApp !== null && fromApp.includes('/node_modules/.bun/'),
    binAtRoot: existsSync(join(dir, 'node_modules/.bin/basalt-ui')),
    binBesideApp: existsSync(join(dir, 'apps/dashboard/node_modules/.bin/basalt-ui')),
    renderIdentical,
    realpathStable: fromApp === null ? false : realpathSync(fromApp) === fromApp,
  }
}

// settings.json merge ---------------------------------------------------------------------------------

const BASALT = '.basalt/hook.mjs'
type Group = { matcher?: string; hooks: { type: string; command: string }[] }
const cmd = (e: string): string => `node "$CLAUDE_PROJECT_DIR/${BASALT}" ${e}`
const ENTRIES: Record<string, Group> = {
  PostToolUse: {
    matcher: 'Edit|Write|MultiEdit',
    hooks: [{ type: 'command', command: cmd('post-edit') }],
  },
  Stop: { hooks: [{ type: 'command', command: cmd('stop') }] },
  PreToolUse: {
    matcher: 'Edit|Write|MultiEdit',
    hooks: [{ type: 'command', command: cmd('pre-edit') }],
  },
}
type Settings = { hooks?: Record<string, Group[]>; [k: string]: unknown }
const isBasalt = (g: Group): boolean => g.hooks.some((h) => h.command.includes(BASALT))
const detectIndent = (t: string): number => /^( +)\S/m.exec(t)?.[1]?.length ?? 2

/** Parse, replace basalt entries in place (append when absent), keep everything else; unparseable: write nothing. */
function mergeSettings(text: string | null): { text: string | null } {
  let obj: Settings = {}
  if (text !== null) {
    try {
      obj = JSON.parse(text)
    } catch {
      return { text: null }
    }
  }
  const hooks = (obj.hooks ??= {})
  for (const [event, entry] of Object.entries(ENTRIES)) {
    const list = (hooks[event] ??= [])
    const at = list.findIndex(isBasalt)
    if (at === -1) list.push(entry)
    else list[at] = entry
  }
  return { text: `${JSON.stringify(obj, null, text === null ? 2 : detectIndent(text))}\n` }
}

function checkSettings(text: string): 'current' | 'stale' | 'unparseable' {
  try {
    const obj = JSON.parse(text)
    const ok = Object.entries(ENTRIES).every(
      ([e, entry]) =>
        JSON.stringify((obj.hooks?.[e] ?? []).filter(isBasalt)) === JSON.stringify([entry]),
    )
    return ok ? 'current' : 'stale'
  } catch {
    return 'unparseable'
  }
}

const foreign = (obj: Settings): unknown => ({
  ...obj,
  hooks: Object.fromEntries(
    Object.entries(obj.hooks ?? {})
      .map(([e, l]) => [e, l.filter((g) => !isBasalt(g))] as const)
      .filter(([, l]) => l.length > 0),
  ),
})

function measureSettings() {
  const guard = {
    matcher: 'Edit|Write',
    hooks: [{ type: 'command', command: 'node scripts/live-library-guard.mjs' }],
  }
  const fixtures: Record<string, string | null> = {
    absent: null,
    desktopLiveGuard: `${JSON.stringify({ permissions: { deny: ['Bash(rm -rf:*)'] }, hooks: { PreToolUse: [guard] } }, null, 4)}\n`,
    legacyMarkerlessEntry: `${JSON.stringify({ env: { A: '1' }, hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command: 'bunx basalt-ui guard-hook' }] }], Stop: [{ hooks: [{ type: 'command', command: 'node scripts/audit.mjs' }] }] } }, null, 2)}\n`,
    compactArrays:
      '{\n  "permissions": { "deny": ["Bash(rm -rf:*)", "Bash(git push --force:*)"] },\n  "hooks": { "PreToolUse": [{ "matcher": "Edit", "hooks": [{ "type": "command", "command": "node g.mjs" }] }] }\n}\n',
    unparseableTrailingComma: '{\n  "hooks": {},\n}\n',
    jsoncComment: '{\n  // keep\n  "hooks": {}\n}\n',
  }
  const cases = Object.entries(fixtures).map(([name, original]) => {
    const merged = mergeSettings(original).text
    if (merged === null) return { name, written: false, untouched: true, ok: true }
    const again = mergeSettings(merged).text
    const parsedBefore = original === null ? { hooks: {} } : JSON.parse(original)
    const foreignPreserved =
      JSON.stringify(foreign(parsedBefore)) === JSON.stringify(foreign(JSON.parse(merged)))
    const idempotent = again === merged
    const appendedAfter = JSON.parse(merged)
    appendedAfter.hooks.Stop.push({ hooks: [{ type: 'command', command: 'node later.mjs' }] })
    const stableWhenForeignAppended =
      mergeSettings(`${JSON.stringify(appendedAfter, null, 2)}\n`).text ===
      `${JSON.stringify(appendedAfter, null, 2)}\n`
    const foreignEdit = JSON.parse(merged)
    foreignEdit.permissions = { deny: ['x'] }
    const removed = JSON.parse(merged)
    removed.hooks.Stop = []
    const originalLines = new Set(
      (original ?? '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    )
    const mergedLines = new Set(merged.split('\n').map((l) => l.trim()))
    const churn = [...originalLines].filter((l) => !mergedLines.has(l)).length
    const row = {
      name,
      written: true,
      foreignPreserved,
      idempotent,
      stableWhenForeignAppended,
      indentKept: original === null || detectIndent(original) === detectIndent(merged),
      checkCurrentAfterMerge: checkSettings(merged) === 'current',
      checkIgnoresForeignEdit: checkSettings(JSON.stringify(foreignEdit)) === 'current',
      checkDetectsBasaltRemoval: checkSettings(JSON.stringify(removed)) === 'stale',
      originalLinesRewritten: churn,
    }
    return {
      ...row,
      ok:
        foreignPreserved &&
        idempotent &&
        stableWhenForeignAppended &&
        row.checkCurrentAfterMerge &&
        row.checkIgnoresForeignEdit &&
        row.checkDetectsBasaltRemoval,
    }
  })
  return { cases, ok: cases.every((c) => c.ok) }
}

export type S5Result = Record<string, unknown> & { verdict: 'pass' | 'refuted' }

export async function runS5(): Promise<S5Result> {
  const base = mkdtempSync(join(tmpdir(), 'basalt-hook-sync-s5-'))
  try {
    progress('s5: render-then-compare over six shapes')
    const per = shapes().map((s) => measureShape(s, base))
    progress('s5: bun isolated linker')
    const isolated = measureIsolated(base)
    progress('s5: settings.json merge')
    const settings = measureSettings()
    let rendererMatches2x: boolean | string = 'unavailable'
    try {
      const real = await import(resolve(AGENT_DIR, '../src/cli/index.ts'))
      const sample = loadManaged(AGENT_DIR).filter((m) => /^paths:/m.test(m.text))
      const sets = [['src'], ['.'], ['apps/dashboard/src', 'packages/ui/src']]
      rendererMatches2x = sample.every((m) =>
        sets.every((r) => real.renderRulePaths(m.text, r) === renderPaths(m.text, r)),
      )
    } catch {
      rendererMatches2x = 'unavailable'
    }
    const falseDrift = per.reduce((n, s) => n + s.falseDrift, 0)
    const rootsChangeDetected = per.every((s) => s.detected)
    const formatterRan = per.every((s) => s.formatterExits.every((c) => c === 0))
    const isolatedOk =
      isolated.resolvesFromApp &&
      !isolated.resolvesFromRoot &&
      isolated.renderIdentical &&
      isolated.binBesideApp &&
      !isolated.binAtRoot
    return {
      falseDrift,
      falseDriftByShape: Object.fromEntries(per.map((s) => [s.name, s.falseDrift])),
      rootsChangeDetected,
      formatterRan,
      formatterUnignoredFalseDrift: Object.fromEntries(
        per.map((s) => [s.name, s.formatterUnignored]),
      ),
      shapes: per,
      isolatedLinker: isolated,
      settingsMerge: settings,
      calibration: { rendererMatches2x },
      verdict:
        falseDrift === 0 && formatterRan && rootsChangeDetected && isolatedOk && settings.ok
          ? 'pass'
          : 'refuted',
    }
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
}
