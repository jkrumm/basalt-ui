/**
 * basalt-ui CLI — the dispatcher plus the plumbing `init`, `sync`, `lint` and `doctor` (each
 * in its own file) share. Runs under Node 22 or newer and under Bun: `node:` built-ins only, no
 * `Bun` global and no `bun`-module import on any path. Dependency-free.
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { RULE_NAMES, SKILL_NAMES } from '../surfaces'
import { doctor } from './doctor'
import { add } from './add'
import { ADD_HELP } from './add/help'
import { eject } from './eject'
import { EJECT_HELP } from './eject/help'
import { COMMAND_OPTIONS, USAGE, unknownFlag } from './help'
import { init } from './init/index'
import { isHookCall, lint } from './lint'
import { migrate } from './migrate'
import { shot } from './shot'
import { sync } from './sync'
import type { BasaltInstall } from './basalt-install'

export type { BasaltInstall }
import { hasDependency, readIfExists, readPackageJson } from './source-text'
import { fontsCss, normalizeColorFunctions, tokensCss } from './tokens-css'
import type { BasaltConfig } from './config'

/** Does `cwd`'s own `package.json` carry a `basalt` key? — "misconfigured roots" vs "wrong
 *  directory", the failure a root-invoked hook hits since 1.29.0's single resolver. Never a walk. */
export function hasBasaltKey(cwd: string): boolean {
  return readPackageJson<{ basalt?: unknown }>(cwd)?.basalt !== undefined
}

export function readBasaltConfig(cwd: string): BasaltConfig {
  return readPackageJson<{ basalt?: BasaltConfig }>(cwd)?.basalt ?? {}
}

// ──────────────────────────────────────────────────────────────────────────────
// Resolution — where basalt is installed, and where the consumer's basalt config lives
// ──────────────────────────────────────────────────────────────────────────────

/** A path relative to `fromDir`, POSIX-separated and always explicitly relative (`./` / `../`). */
export function relativePosix(fromDir: string, toPath: string): string {
  const rel = relative(fromDir, toPath).replace(/\\/g, '/')
  if (rel === '') return '.'
  return rel.startsWith('.') ? rel : `./${rel}`
}

/**
 * Where `basalt-ui` actually resolves from, seen from a consumer directory. Under bun's isolated
 * linker a package that declares basalt gets it at `<pkg>/node_modules` and nothing at the root, so
 * resolution walks OUTWARD from the consumer dir, then across workspace packages, and every caller
 * renders its paths from the answer rather than assuming the root.
 */

const UNRESOLVED_INSTALL: BasaltInstall = { dir: null, version: null, how: null }

/** `<dir>/node_modules/basalt-ui` when it holds a readable package.json, else null. */
function basaltInstallAt(dir: string): { dir: string; version: string | null } | null {
  const installDir = resolve(dir, 'node_modules', 'basalt-ui')
  if (readIfExists(resolve(installDir, 'package.json')) === null) return null
  return {
    dir: installDir,
    version: readPackageJson<{ version?: string }>(installDir)?.version ?? null,
  }
}

/** Resolve the installed basalt-ui: cwd, then every ancestor, then the workspace packages. */
export function findBasaltInstall(cwd: string): BasaltInstall {
  const own = basaltInstallAt(cwd)
  if (own !== null) return { ...own, how: 'cwd' }

  let current = dirname(cwd)
  for (;;) {
    const found = basaltInstallAt(current)
    if (found !== null) return { ...found, how: 'ancestor' }
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }

  for (const pkg of collectWorkspacePackages(cwd).packages) {
    if (pkg.dir === cwd) continue
    const found = basaltInstallAt(pkg.dir)
    if (found !== null) return { ...found, how: 'workspace' }
  }
  return UNRESOLVED_INSTALL
}

/**
 * Which directory a project-scoped command (`doctor`, `sync`, `lint`) reads: `BASALT_CWD` when set,
 * else the invocation cwd. Nothing is inferred (workspace discovery was deleted). The scan scope
 * within it is `basalt.roots` in `package.json` (default `src`).
 */
type ProjectResolution = {
  /** The directory to read. Equals the invocation cwd unless BASALT_CWD relocated it. */
  dir: string
  /** The invocation cwd when BASALT_CWD relocated the command away from it, else null. */
  relocatedFrom: string | null
}

/**
 * Which directory a project-scoped command reads: `BASALT_CWD` when set, else the invocation cwd
 * — nothing inferred, nothing walked. Workspace-glob discovery and ancestor/descendant fallbacks
 * (multi-repo speculation for a single-owner fleet where every consumer runs its own commands from
 * its own directory) were deleted; a monorepo package that needs a different root sets `BASALT_CWD`
 * explicitly, or the invoking script's `root:`/`cwd` does.
 */
export function resolveProjectDir(cwd: string): ProjectResolution {
  const override = process.env['BASALT_CWD']
  if (override === undefined || override.length === 0) {
    return { dir: cwd, relocatedFrom: null }
  }
  const dir = isAbsolute(override) ? override : resolve(cwd, override)
  return { dir, relocatedFrom: dir === cwd ? null : cwd }
}

/** Says so when `BASALT_CWD` moved the command off the directory it was invoked in. */
export function noteRelocation(command: string, project: ProjectResolution): void {
  if (project.relocatedFrom === null) return
  console.log(
    `basalt-ui ${command}: BASALT_CWD relocated from ${project.relocatedFrom} to ${project.dir}.`,
  )
}

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/** Read a shipped source asset from the package root; null if the sibling hasn't authored it yet. */
export function readSource(pkgRoot: string, source: string): string | null {
  return readIfExists(resolve(pkgRoot, source))
}

function readPackageName(cwd: string): string {
  const name = readPackageJson<{ name?: string }>(cwd)?.name
  if (name && name.length > 0) return name
  return cwd.split('/').filter(Boolean).pop() ?? 'app'
}

/** The framework's own published version, read from the package root package.json. */
export function readFrameworkVersion(pkgRoot: string): string {
  return readPackageJson<{ version?: string }>(pkgRoot)?.version ?? '0.0.0'
}

/** Rule roots when nothing is declared or inferable — what the shipped rules matched before roots. */
const LEGACY_RULE_ROOTS = ['src', 'apps/**/src', 'packages/**/src']

const FRONT_MATTER = /^---\n[\s\S]*?\n---\n/
const RULE_PATHS_BLOCK = /^paths:\n(?: {2}- .*\n)+/m

/**
 * A rule's front-matter `paths:` block rendered from `roots`: one `'<root>/**'` item per root,
 * normalised (no `./`, no trailing slash) and single-quoted for YAML. Only the leading `---…---`
 * block is touched. Front matter without `paths:` is returned unchanged; a `paths:` that is not the
 * expected list shape, or a root that would match everywhere (`''`, `/`, absolute), throws.
 */
export function renderRulePaths(text: string, roots: readonly string[]): string {
  const front = FRONT_MATTER.exec(text)?.[0]
  if (front === undefined || !/^paths:/m.test(front)) return text
  if (!RULE_PATHS_BLOCK.test(front)) throw new Error('rule `paths:` is not a list of `  - …` items')
  const items = (roots.length > 0 ? roots : LEGACY_RULE_ROOTS).map((raw) => {
    const root = raw.replace(/^(?:\.\/)+/, '').replace(/\/+$/, '')
    if (/[\n\r]/.test(root)) throw new Error(`basalt.roots entry has a line break: ${raw}`)
    if (raw.startsWith('/') || root === '') {
      throw new Error(`basalt.roots entry must be a relative directory, got ${JSON.stringify(raw)}`)
    }
    return `  - '${(root === '.' ? '**' : `${root}/**`).replace(/'/g, "''")}'`
  })
  return (
    front.replace(RULE_PATHS_BLOCK, () => `paths:\n${items.join('\n')}\n`) +
    text.slice(front.length)
  )
}

/** The app directory a command's app-scoped half targets: `rel` is '' when it is the install root. */
export type AppResolution = { dir: string; rel: string } | { error: string }

/** `dir` relative to `root` without relativePosix's leading `./` ('' for the root itself). */
const appRelative = (root: string, dir: string): string =>
  relativePosix(root, dir).replace(/^\.\/?/, '')

export const hasViteEntry = (dir: string): boolean =>
  existsSync(resolve(dir, 'src/main.tsx')) || existsSync(resolve(dir, 'index.html'))

/**
 * Where the Vite app lives relative to the install root `root` (manifest, `.claude/`, AGENTS block).
 * ONE resolution for `doctor`, `sync` and `init`, in order: `basalt.app` in the root package.json;
 * else the single workspace package that depends on basalt-ui AND has a Vite entry; else `root`
 * itself (a single-package app). Two such packages is an error — the choice is not inferable. A
 * package declaring `basalt.sibling` is a declared second install and never a candidate.
 */
export function resolveAppDir(root: string): AppResolution {
  const self = { dir: root, rel: '' }
  const explicit = readBasaltConfig(root).app
  if (explicit !== undefined) {
    const dir = resolve(root, explicit)
    const rel = appRelative(root, dir)
    if (rel.startsWith('..') || !existsSync(resolve(dir, 'package.json'))) {
      return {
        error: `basalt.app "${explicit}" must be a directory with a package.json inside ${root}.`,
      }
    }
    return dir === root ? self : { dir, rel }
  }
  const candidates = collectWorkspacePackages(root).packages.filter(
    (pkg) =>
      pkg.dir !== root &&
      hasDependency(pkg.dir, 'basalt-ui') &&
      hasViteEntry(pkg.dir) &&
      readBasaltConfig(pkg.dir).sibling !== true,
  )
  if (candidates.length === 0) return self
  const [only] = candidates
  if (candidates.length === 1 && only !== undefined) {
    return { dir: only.dir, rel: appRelative(root, only.dir) }
  }
  const names = candidates.map((pkg) => appRelative(root, pkg.dir)).join(', ')
  return {
    error:
      `${candidates.length} workspace packages depend on basalt-ui and have a Vite entry (${names}) — ` +
      'cannot tell which is the app. Set `basalt.app` (e.g. `"basalt": { "app": "apps/web" }`) in the root package.json.',
  }
}

/**
 * Walks up from `dir` looking for a `.git` entry — ordinarily a directory, but a git worktree or
 * submodule points it at a FILE instead, and both still mean "this directory is the repo root".
 * Stops at the filesystem root. Returns `dir` itself when no `.git` is found anywhere, so a
 * consumer not using git falls back to today's behaviour exactly.
 */
export function findRepoRoot(dir: string): string {
  let current = dir
  for (;;) {
    if (existsSync(resolve(current, '.git'))) return current
    const parent = dirname(current)
    if (parent === current) return dir
    current = parent
  }
}

/** Resolve the package root at runtime (two levels up from dist/cli/index.js). */
export function packageRoot(): string {
  return fileURLToPath(new URL('../../', import.meta.url))
}

// workspace-glob primitives — shared by findBasaltInstall

export type WorkspacePackage = { readonly name: string; readonly dir: string }

/** {@link collectWorkspacePackages}'s return: the packages plus whether a `workspaces` field existed. */
export type WorkspaceWalk = {
  readonly packages: readonly WorkspacePackage[]
  readonly hasWorkspacesField: boolean
}

/**
 * Every subdirectory of `base` (name only), or `[]` if `base` doesn't exist / isn't a directory.
 * `node_modules` is always excluded — a wildcard workspaces pattern must never descend into a
 * dependency tree. `skipDotDirs` additionally excludes dot-directories; it is only set by the
 * `*`/`**` wildcard descent in {@link expandPatternSegments}, never for an explicitly named
 * literal segment, so a pattern like `.internal/*` still resolves.
 */
function subdirNames(base: string, options: { skipDotDirs?: boolean } = {}): string[] {
  let entries: string[]
  try {
    entries = readdirSync(base)
  } catch {
    return []
  }
  return entries.filter((name) => {
    if (name === 'node_modules') return false
    if (options.skipDotDirs && name.startsWith('.')) return false
    try {
      return statSync(resolve(base, name)).isDirectory()
    } catch {
      return false
    }
  })
}

/**
 * Expands one glob PATTERN's segments against the filesystem, starting from `baseDir`. Supports
 * three segment kinds: a literal name, a single `*` wildcard (any one directory), and a `**`
 * wildcard (zero or more directory levels, i.e. arbitrary depth) — covering a trailing single
 * wildcard, an interior wildcard between literal segments, and a trailing double-wildcard alike,
 * not just one trailing single-wildcard segment.
 */
function expandPatternSegments(baseDir: string, segments: readonly string[]): string[] {
  if (segments.length === 0) return [baseDir]
  const [head, ...rest] = segments

  if (head === '**') {
    // Zero levels: `**` consumes nothing and the rest of the pattern matches right here.
    const matches = expandPatternSegments(baseDir, rest)
    // One-or-more levels: descend into every subdirectory, `**` still active.
    for (const name of subdirNames(baseDir, { skipDotDirs: true })) {
      matches.push(...expandPatternSegments(resolve(baseDir, name), segments))
    }
    return matches
  }

  const names =
    head === '*'
      ? subdirNames(baseDir, { skipDotDirs: true })
      : subdirNames(baseDir).filter((n) => n === head)
  return names.flatMap((name) => expandPatternSegments(resolve(baseDir, name), rest))
}

/**
 * Expands a root `package.json`'s `workspaces` patterns into package directories: literal,
 * single-wildcard and double-wildcard segments (interior or trailing) and `!`-prefixed exclusions.
 * A directory without its own `package.json` is skipped.
 */
function expandWorkspaceGlobs(cwd: string, patterns: readonly string[]): string[] {
  const expand = (pattern: string): string[] =>
    expandPatternSegments(
      cwd,
      pattern.split('/').filter((s) => s.length > 0),
    )

  const excluded = new Set(
    patterns
      .filter((pattern) => pattern.startsWith('!'))
      .flatMap((pattern) => expand(pattern.replace(/^!+/, ''))),
  )

  const dirs: string[] = []
  for (const pattern of patterns) {
    if (pattern.startsWith('!')) continue
    for (const abs of expand(pattern)) {
      if (excluded.has(abs)) continue
      if (existsSync(resolve(abs, 'package.json'))) dirs.push(abs)
    }
  }
  return dirs
}

/**
 * Every workspace package declared by `cwd`'s root `package.json` (array or `{ packages }` form),
 * PLUS the root manifest itself, labelled `"{name} (root)"` (it commonly carries a hoisted `ai`
 * dev dependency that can skew against a package's major). `hasWorkspacesField` is `false` when
 * there is no `package.json`, no `workspaces` field, or a shape this doesn't recognize; never throws.
 */
export function collectWorkspacePackages(cwd: string): WorkspaceWalk {
  const parsed = readPackageJson<{ workspaces?: unknown; name?: string }>(cwd)
  if (parsed === null) return { packages: [], hasWorkspacesField: false }

  const patterns = isStringArray(parsed.workspaces)
    ? parsed.workspaces
    : parsed.workspaces !== null &&
        typeof parsed.workspaces === 'object' &&
        isStringArray((parsed.workspaces as { packages?: unknown }).packages)
      ? (parsed.workspaces as { packages: string[] }).packages
      : null
  if (patterns === null) return { packages: [], hasWorkspacesField: false }

  const rootName = parsed.name && parsed.name.length > 0 ? `${parsed.name} (root)` : '(root)'
  const workspacePackages = expandWorkspaceGlobs(cwd, patterns).map((dir) => ({
    name: readPackageName(dir),
    dir,
  }))

  return {
    packages: [{ name: rootName, dir: cwd }, ...workspacePackages],
    hasWorkspacesField: true,
  }
}

/** Narrows to a string array — shared by `collectWorkspacePackages`'s two `workspaces` shapes. */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

/**
 * CLI dispatcher — parses argv (subcommand + flags) and returns the command's exit code. The bin
 * entry is the ONLY caller that translates this to process.exit, so init/sync/checkTheme stay free
 * of process side effects and are safe to import and call from tests.
 *
 * `--help` / `-h` (on ANY subcommand) and the bare `help` command short-circuit BEFORE dispatch —
 * checked first, so a mutating command (`sync`, `init`) never runs just because the caller only
 * asked to read about it.
 *
 */
export function run(argv: string[], cwd: string = process.cwd()): number | Promise<number> {
  const [cmd, ...flags] = argv
  if (
    cmd === 'help' ||
    cmd === '--help' ||
    cmd === '-h' ||
    flags.includes('--help') ||
    flags.includes('-h')
  ) {
    // A command with its own help text prints it; the rest print the one usage.
    console.log(cmd === 'eject' ? EJECT_HELP : cmd === 'add' ? ADD_HELP : USAGE)
    return 0
  }
  // Before dispatch, like --help: it answers "which basalt-ui is running" as one bare line.
  if (cmd === '--version' || cmd === '-v' || cmd === 'version') {
    console.log(readFrameworkVersion(packageRoot()))
    return 0
  }
  // `lint --hook` is exempt: a hook that exits 1 reads as a pass, so it answers its own bad flags with 2.
  if (cmd !== undefined && !(cmd === 'lint' && isHookCall(flags))) {
    const bad = unknownFlag(cmd, flags)
    if (bad !== null) {
      const accepted = Object.keys(COMMAND_OPTIONS[cmd] ?? {}).map((k) => `--${k}`)
      console.error(
        `basalt-ui ${cmd}: unrecognized flag '${bad}'. ` +
          `Accepted: ${accepted.join(' ') || '(none)'} --help\n`,
      )
      return 1
    }
  }
  switch (cmd) {
    case 'init':
      return init(flags, cwd)
    case 'sync':
      return sync({ force: flags.includes('--force'), check: flags.includes('--check') }, cwd)
    case 'doctor':
      return doctor(cwd, flags)
    case 'tokens:css':
      return tokensCss(flags, cwd)
    case 'fonts:css':
      return fontsCss(flags, cwd)
    case 'shot':
      return shot(flags, cwd)
    case 'migrate':
      return migrate(flags, cwd, packageRoot())
    case 'eject':
      return eject(flags, cwd)
    case 'add':
      return add(flags, cwd)
    case 'lint':
      return lint(flags, cwd)
    default:
      // Named, not just implied by a usage dump: a full-screen help block with no error line reads
      // like the command ran and chose to print help. Reported by a consumer who passed
      // `"doctor --from 2.30.0"` as ONE argument and could not tell what had been rejected.
      console.error(
        cmd === undefined
          ? 'basalt-ui: no command given.\n'
          : `basalt-ui: unknown command '${cmd}'.\n`,
      )
      console.error(USAGE)
      return 1
  }
}

// `RULE_NAMES`/`SKILL_NAMES` re-exported for testing / introspection (no default export).
export { isStartApp } from './router-wiring'
export { readIfExists, readPackageJson } from './source-text'
export { RULE_NAMES, SKILL_NAMES }
/** What `sync` renders from, for the tarball-parity gate (`scripts/check-tarball-parity.mjs`). */
export { shippedSources } from './sync/render'

// Re-export every split-out command so `import { X } from './index'` keeps working — `index.ts` is
// dispatch + shared helpers only (C2); the command implementations live in their own files.
export { doctor, init, sync, fontsCss, normalizeColorFunctions, tokensCss }
export type { SyncOptions } from './sync'
export type { DoctorOptions, Result as DoctorResult } from './doctor'
