/**
 * basalt-ui CLI — the dispatcher plus the plumbing `init`, `sync`, `check-theme` and `doctor` (each
 * in its own file) share. `init`/`sync` reconcile the agentic surface and the toolchain seeds into
 * a consumer repo through a sha256 manifest (three-way, idempotent). Runtime-agnostic and
 * dependency-free — Node/Bun built-ins only, no `bun`-module import. Config is the consuming
 * package.json's `"basalt"` key; argo's values are the defaults.
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DEFAULT_GUARD_CONFIG, guardWaiverHint } from '../guard'
import type { GuardConfig, GuardKind, GuardSeverity } from '../guard'
import { AGENT_NAMES, RULE_NAMES, SKILL_NAMES } from '../surfaces'
import { checkTheme } from './check-theme'
import { doctor } from './doctor'
import { eject } from './eject'
import { guardHook } from './guard-hook'
import { COMMAND_OPTIONS, USAGE, unknownFlag } from './help'
import { init } from './init/index'
import { isHookCall, lint } from './lint'
import { migrate } from './migrate'
import { shot } from './shot'
import { sync } from './sync'
import type { BasaltInstall } from './basalt-install'
import { routerSeedDest } from './router-wiring'

export type { BasaltInstall }
import { hasDependency, readIfExists, readPackageJson } from './source-text'
import { fontsCss, normalizeColorFunctions, tokensCss } from './tokens-css'
import { DEFAULT_ROOT, exemptRulePaths, resolveRoots } from './config'
import type { BasaltConfig } from './config'

/**
 * The consumer's `GuardConfig`: every `basalt` key the guard knows, over `DEFAULT_GUARD_CONFIG`.
 * One builder for `check-theme` and `guard-hook`, so the hook never judges an edit by a different
 * config than the build. `exemptRules` reaches the guard as paths only — the reason the object form
 * carries is accountability for a human and for `--audit-allows`, not a second shape to scan.
 */
type PassthroughKey = Exclude<keyof GuardConfig, 'allowComment' | 'exemptRules' | 'profile'>

/**
 * The `basalt` keys that reach the guard verbatim — named, never matched by name at runtime.
 * `satisfies Record<…>` makes a GuardConfig key missing here, or one that is not a key, a tsc error.
 */
const GUARD_PASSTHROUGH = {
  spacingSteps: true,
  rawRadius: true,
  forbiddenAccents: true,
  mantineShadeIndex: true,
  rawSurface: true,
  cardWithBorder: true,
  offSystemSurfaceVar: true,
  rawHtmlLayout: true,
  inlineSpacing: true,
  inlineDisplay: true,
  rawMotionValue: true,
  rawFormControl: true,
  sub16InputFont: true,
  severity: true,
} as const satisfies Record<PassthroughKey, true>

export function resolveGuardConfig(cfg: BasaltConfig, profile: DoctorProfile): GuardConfig {
  const exemptRules: Partial<Record<GuardKind, string[]>> = {}
  for (const [kind, entry] of Object.entries(cfg.exemptRules ?? {})) {
    exemptRules[kind as GuardKind] = exemptRulePaths(entry)
  }
  // Typed as the guard's shape, so a BasaltConfig field whose type drifts from it fails to compile.
  const from: Partial<Pick<GuardConfig, PassthroughKey>> = cfg
  const set = (Object.keys(GUARD_PASSTHROUGH) as PassthroughKey[]).filter(
    (k) => (from[k] ?? null) !== null,
  )
  return {
    ...DEFAULT_GUARD_CONFIG,
    ...Object.fromEntries(set.map((k) => [k, from[k]])),
    allowComment: 'theme-allow',
    exemptRules,
    ...(profile === 'tokens-only' ? { profile: 'tokens-only' as const } : {}),
  }
}

/**
 * The one consumer series path (DESIGN.md's `{{SERIES_MODULE_PATH}}`, the default scan exemption,
 * the skills' prose). Derived from the FIRST configured root (`<root>/lib/series.ts`), since a
 * monorepo with `roots: ['apps/web/src']` has no top-level `src/`. `seriesModulePath` overrides.
 */
function resolveSeriesModulePath(cfg: BasaltConfig): string {
  if (cfg.seriesModulePath !== undefined) return cfg.seriesModulePath
  const [firstRoot = DEFAULT_ROOT] = resolveRoots(cfg)
  return `${firstRoot}/lib/series.ts`
}

/**
 * A root as a single-quoted oxfmt glob for the seeded CI `run:` step. POSIX-escapes any embedded
 * quote (`'` → `'\''`) — `roots` is consumer-authored, and an unescaped apostrophe would break out
 * of the quoting and emit a workflow that fails on a syntax error the consumer can't trace back
 * here. Not a privilege boundary (it's their own config rendering into their own CI), just a file
 * this CLI generates and therefore owes valid quoting.
 */
function toRootGlob(root: string): string {
  return `'${root.replace(/'/g, `'\\''`)}/**'`
}

/**
 * Default scan exemption — a bare consumer's only palette source is its series module (the doctrine
 * directs every consumer to put raw hex series colors there). Shares `resolveSeriesModulePath` with
 * `buildTemplateVars`'s `{{SERIES_MODULE_PATH}}`, so the seeded path and the exemption can't drift.
 */
export function defaultExempt(cfg: BasaltConfig): string[] {
  return [resolveSeriesModulePath(cfg)]
}

export const SKIP = /\.gen\.ts$|\.test\.[tj]sx?$|\.d\.ts$/
/** Filenames that look like they ARE the palette source, for the check-theme escape-hatch hint. */
export const SERIES_MODULE_HINT_RE = /(series|palette)\.tsx?$/i

const SEVERITY_VALUES: readonly string[] = ['warn', 'error']

/**
 * Drop `basalt.severity` entries whose value is not `'warn'` / `'error'`, loudly: a typo there would
 * silently REMOVE enforcement. The kind falls back to its default instead (stricter, and told about).
 */
function sanitizeSeverity(cfg: BasaltConfig): BasaltConfig {
  const raw: unknown = cfg.severity
  if (raw === undefined) return cfg
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    console.error('⚠ basalt.severity is not an object — ignoring it; every kind keeps its default.')
    const { severity: _dropped, ...rest } = cfg
    return rest
  }
  const kept: Record<string, GuardSeverity> = {}
  for (const [kind, value] of Object.entries(raw)) {
    if (typeof value === 'string' && SEVERITY_VALUES.includes(value)) {
      kept[kind] = value as GuardSeverity
      continue
    }
    console.error(
      `⚠ basalt.severity["${kind}"] is ${JSON.stringify(value)}, not 'warn' or 'error' — ` +
        'ignoring it; that kind keeps its default severity.',
    )
  }
  return { ...cfg, severity: kept as Partial<Record<GuardKind, GuardSeverity>> }
}

/** Does `cwd`'s own `package.json` carry a `basalt` key? — "misconfigured roots" vs "wrong
 *  directory", the failure a root-invoked hook hits since 1.29.0's single resolver. Never a walk. */
export function hasBasaltKey(cwd: string): boolean {
  return readPackageJson<{ basalt?: unknown }>(cwd)?.basalt !== undefined
}

export function readBasaltConfig(cwd: string): BasaltConfig {
  return sanitizeSeverity(readPackageJson<{ basalt?: BasaltConfig }>(cwd)?.basalt ?? {})
}

/**
 * Extensions the walker collects: source (`.astro`/`.jsx`/`.vue` and the `.mjs`/`.cjs`/`.mts`/`.cts`
 * module spellings) plus `html?`/`webmanifest`, where raw hex ships in `theme-color` and friends.
 */
const SCANNABLE_EXT = /\.(?:tsx?|jsx|[cm][jt]s|astro|vue|css|html?|webmanifest)$/

/**
 * Recursively collect scannable files under a root, skipping dependency/build dirs. `.json` is NOT
 * scanned (config, fixtures, lockfiles: false positives); name a design-surface JSON in `basalt.include`.
 */
function walkSourceFiles(dir: string, out: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out // root absent — nothing to scan
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.git' || name === 'dist') continue
    const abs = resolve(dir, name)
    let isDir: boolean
    try {
      isDir = statSync(abs).isDirectory()
    } catch {
      continue
    }
    if (isDir) walkSourceFiles(abs, out)
    else if (SCANNABLE_EXT.test(name)) out.push(abs)
  }
  return out
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
 * The `extends`/`run:` path a seeded config should carry to reach a shipped asset — rendered from
 * where basalt ACTUALLY resolves, relative to the directory the config lives in. Falls back to the
 * root-relative form when nothing resolves (a pre-install `init`), so the seed is still the shape a
 * later `bun install` makes true.
 */
function shippedAssetPath(install: BasaltInstall, fromDir: string, asset: string): string {
  if (install.dir === null) return `./node_modules/basalt-ui/${asset}`
  return `${relativePosix(fromDir, install.dir)}/${asset}`
}

/**
 * Which directory a project-scoped command (`check-theme`, `doctor`) reads: `BASALT_CWD` when set,
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

/**
 * Which shape of consumer a project-scoped command is looking at — DECLARED, never inferred
 * (`--tokens-only`, or `"basalt": { "profile": "tokens-only" }`), because the answer switches the
 * Mantine-remedy guard kinds off. Why that direction: package MAINTAINING.md § CLI.
 */
export function declaredProfile(cfg: BasaltConfig, flags: readonly string[]): DoctorProfile {
  if (flags.includes('--tokens-only')) return 'tokens-only'
  if (flags.includes('--framework')) return 'framework'
  return cfg.profile === 'tokens-only' ? 'tokens-only' : 'framework'
}

/**
 * `--tokens-only` and `--framework` are alternatives, so passing both is a contradiction rather
 * than a precedence question — the same reading `tokens:css` already applies to `--selector-class`
 * vs `--selector-attribute`. Silently preferring one meant a CI step that accumulated both flags
 * enforced whichever the code happened to test first.
 */
export function conflictingProfileFlags(command: string, flags: readonly string[]): boolean {
  const both = flags.includes('--tokens-only') && flags.includes('--framework')
  if (both)
    console.error(
      `basalt-ui ${command}: --tokens-only and --framework are alternatives — pass one.`,
    )
  return both
}

/** Says so when `BASALT_CWD` moved the command off the directory it was invoked in. */
export function noteRelocation(command: string, project: ProjectResolution): void {
  if (project.relocatedFrom === null) return
  console.log(
    `basalt-ui ${command}: BASALT_CWD relocated from ${project.relocatedFrom} to ${project.dir}.`,
  )
}

/**
 * The relative paths `check-theme` would actually scan for a given config — the ONE place the walk
 * + `SKIP` + `exempt` filtering lives, so `doctor`'s "the guard sees zero files" check can never
 * disagree with what `check-theme` does.
 */
export function scannableFiles(cwd: string, cfg: BasaltConfig): string[] {
  const exempt = new Set(cfg.exempt ?? defaultExempt(cfg))
  const seen = new Set<string>()
  const out: string[] = []
  const add = (abs: string): void => {
    // Normalize to forward slashes so path matching (SKIP, exempt, isChartFile) is
    // identical on Windows (where `relative` yields backslashes) and POSIX.
    const rel = relative(cwd, abs).replace(/\\/g, '/')
    if (rel.startsWith('..') || SKIP.test(rel) || exempt.has(rel) || seen.has(rel)) return
    seen.add(rel)
    out.push(rel)
  }

  for (const root of resolveRoots(cfg)) {
    const rootAbs = resolve(cwd, root)
    for (const f of walkSourceFiles(rootAbs)) add(f)
    for (const f of appShellFiles(rootAbs)) add(f)
  }
  // Explicitly named files, the one route by which a `.json` is ever scanned.
  for (const rel of cfg.include ?? []) add(resolve(cwd, rel))
  return out
}

/**
 * The app-shell files that sit BESIDE a source root rather than inside it: `index.html` and anything
 * under `public/` (argo's raw hex lives in `apps/dashboard/index.html`, with `roots` on `…/src`).
 * Nothing else in the parent is walked.
 */
function appShellFiles(rootAbs: string): string[] {
  const appDir = dirname(rootAbs)
  const out: string[] = []
  for (const name of ['index.html', 'index.htm']) {
    const abs = resolve(appDir, name)
    if (existsSync(abs)) out.push(abs)
  }
  out.push(...walkSourceFiles(resolve(appDir, 'public')))
  return out
}

/**
 * A path in the JSON family that is NOT a manifest — the sentinel that gets `guardWaiverHint`'s
 * plain-JSON closer. Used only by {@link waiverHintFor}; see its doc for why.
 */
const PLAIN_JSON_HINT_PATH = 'manifest.json'

/**
 * The waiver closer for a file, gated on the profile. `guardWaiverHint` leads a `.webmanifest` with
 * `basaltAppPlugin` — right for a Mantine app, advice a `profile: tokens-only` consumer cannot take
 * (rollhook's Astro site has no `index.html` for the plugin and owns its maskable icons). There the
 * manifest is plain JSON — the member is the whole answer, plus one sentence on the withheld remedy.
 * The remedy text still comes from the guard's registry; only the class mapping is decided here.
 */
export function waiverHintFor(relPath: string, profile: DoctorProfile): string {
  if (profile !== 'tokens-only' || !relPath.endsWith('.webmanifest')) {
    return guardWaiverHint(relPath)
  }
  return (
    `${guardWaiverHint(PLAIN_JSON_HINT_PATH)} (basaltAppPlugin would emit the file instead, but ` +
    "it needs basalt's Vite/React layer, which a tokens-only consumer has opted out of.)"
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// init / sync — managed-files engine
// ──────────────────────────────────────────────────────────────────────────────

/**
 * How a file the framework writes into a consumer repo is owned:
 * - `managed`: basalt owns it (what Claude reads: .claude/rules/*, .claude/skills/*, the AGENTS.md
 *   block). sync refreshes it; a local edit is skipped and reported (`--force` overwrites); `--check`
 *   exits 1 on drift.
 * - `seed`: written once if absent, then the consumer's. sync never overwrites it or reports drift.
 *
 * `markers: true` splices a managed `<!-- basalt:begin -->…<!-- basalt:end -->` region into a host
 * file the consumer otherwise owns (AGENTS.md).
 */
type Mode = 'managed' | 'seed'

/** A single file the framework writes into a consumer repo. */
type ManagedFile = {
  /** Path of the produced file, relative to the consumer repo root. Stable manifest key. */
  dest: string
  /** Ownership mode. */
  mode: Mode
  /**
   * `managed` only: the file is a marker-delimited region spliced into a consumer-owned host file
   * rather than a whole file. `render()` returns the region INCLUDING its begin/end markers.
   */
  markers?: true
  /** Path of the shipped source asset, relative to the package root. */
  source: string
  /**
   * The exact bytes this file should contain right now, given the shipped source + consumer
   * context. Returns null when the shipped source is missing (a sibling-authored asset not yet
   * present) so the engine can skip it cleanly instead of crashing.
   */
  render: (ctx: RenderContext) => string | null
}

/** Everything a template needs to resolve its `{{…}}` placeholders. */
export type RenderContext = {
  pkgRoot: string
  vars: TemplateVars
}

/**
 * The placeholder map consumed by the shipped templates. `{{APP_NAME}}` comes from the consumer
 * package.json; `{{BASALT_VERSION}}` from the framework's own package.json; the rest from the
 * consumer `"basalt"` config with framework defaults.
 */
type TemplateVars = {
  APP_NAME: string
  BASALT_VERSION: string
  ACCENT_HUE: string
  SERIES_MODULE_PATH: string
  /** The consumer's configured roots as space-separated quoted oxfmt globs, e.g. `'apps/web/src/**'`. */
  ROOTS_GLOBS: string
  /** The roots a rule's `paths:` renders from: `basalt.roots` (init/sync write the inferred ones first), else {@link LEGACY_RULE_ROOTS}. */
  RULE_ROOTS: string[]
  /** Path to the shipped oxlint preset from the consumer dir — RESOLVED, never assumed at the root. */
  OXLINT_PRESET_PATH: string
  /** Path to the shipped lefthook preset from the consumer dir — same resolution. */
  LEFTHOOK_PRESET_PATH: string
  /**
   * How a seeded script or CI step invokes the CLI. The locally-installed bin when basalt resolves
   * (so the step can never silently run a DIFFERENT version that `bunx` fetched from npm), and
   * `bunx basalt-ui` only as the pre-install fallback.
   */
  BASALT_BIN: string
  /** The CI gate steps after install: `make check` when the repo owns one, else the built-in set. */
  GATE_STEPS: string
}

export const MANIFEST_PATH = '.basalt/manifest.json'
/** The host file the managed block is spliced into (and its manifest key). */
const AGENTS_MD = 'AGENTS.md'

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

/**
 * How a seeded script, CI step or piece of doctor advice invokes the CLI: the LOCAL bin wherever
 * basalt resolved, `bunx basalt-ui` only as the pre-install fallback (`bunx` does not re-resolve a
 * cached package, so it lets a consumer pin one version and be gated by another).
 */
function basaltBinCommand(install: BasaltInstall, cwd: string): string {
  if (install.dir === null) return 'bunx basalt-ui'
  const binDir = resolve(install.dir, '..', '.bin')
  return `${relativePosix(cwd, binDir).replace(/^\.\//, '')}/basalt-ui`
}

/** Every basalt-written `oxlint .` carries it: config ignores don't stop oxlint loading a worktree's nested config (1.87). */
export const OXLINT_IGNORE_FLAG = "--ignore-pattern '.claude/worktrees/**'"

/**
 * The consumer owns the CI gate when its Makefile has a `check:` target: `doctor` and `sync --check`
 * stay as steps of their own (drift is never skippable), then `make check` replaces the built-in
 * lint/theme/format steps. Without one, the built-in steps run. Rendered at `{{GATE_STEPS}}`.
 */
function ciGateSteps(cwd: string): string {
  const owned = /^check\s*:/m.test(readIfExists(resolve(cwd, 'Makefile')) ?? '')
  const drift = ["- run: '{{BASALT_BIN}} doctor'", "- run: '{{BASALT_BIN}} sync --check'"]
  const steps = owned
    ? [...drift, '- run: make check']
    : [
        `- run: bunx oxlint ${OXLINT_IGNORE_FLAG} .`,
        drift[0],
        "- run: '{{BASALT_BIN}} check-theme'",
        drift[1],
        "- run: bunx oxfmt {{ROOTS_GLOBS}} '!**/dist/**' --check",
      ]
  return steps.join('\n      ')
}

/** Build the template-variable map from the framework root + consumer cwd/config. */
function buildTemplateVars(pkgRoot: string, cwd: string, cfg: BasaltConfig): TemplateVars {
  const install = findBasaltInstall(cwd)
  return {
    APP_NAME: readPackageName(cwd),
    BASALT_VERSION: readFrameworkVersion(pkgRoot),
    ACCENT_HUE: cfg.accentHue ?? 'blue',
    SERIES_MODULE_PATH: resolveSeriesModulePath(cfg),
    ROOTS_GLOBS: resolveRoots(cfg).map(toRootGlob).join(' '),
    RULE_ROOTS: cfg.roots ?? [],
    OXLINT_PRESET_PATH: shippedAssetPath(install, cwd, OXLINT_FILES.preset),
    LEFTHOOK_PRESET_PATH: shippedAssetPath(install, cwd, 'configs/lefthook.yml'),
    BASALT_BIN: basaltBinCommand(install, cwd),
    GATE_STEPS: ciGateSteps(cwd),
  }
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

/** Substitute every `{{KEY}}` placeholder from the variable map; unknown keys are left verbatim. */
function fillTemplate(tpl: string, vars: TemplateVars): string {
  const fill = (text: string): string =>
    text.replace(/\{\{(\w+)\}\}/g, (m, key: string) => {
      const v = (vars as Record<string, unknown>)[key]
      return typeof v === 'string' ? v : m
    })
  // The marker is a YAML comment so the template stays valid YAML; GATE_STEPS itself carries
  // placeholders, so it expands before the generic pass.
  return fill(tpl.replace('# {{GATE_STEPS}}', vars.GATE_STEPS))
}

/** The app directory a command's app-scoped half targets: `rel` is '' when it is the install root. */
export type AppResolution = { dir: string; rel: string } | { error: string }

/** `dir` relative to `root` without relativePosix's leading `./` ('' for the root itself). */
const appRelative = (root: string, dir: string): string =>
  relativePosix(root, dir).replace(/^\.\/?/, '')

const hasViteEntry = (dir: string): boolean =>
  existsSync(resolve(dir, 'src/main.tsx')) || existsSync(resolve(dir, 'index.html'))

/**
 * Where the Vite app lives relative to the install root `root` (manifest, `.claude/`, AGENTS block).
 * ONE resolution for `doctor`, `sync` and `init`, in order: `basalt.app` in the root package.json;
 * else the single workspace package that depends on basalt-ui AND has a Vite entry; else `root`
 * itself (a single-package app). Two such packages is an error — the choice is not inferable.
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
    (pkg) => pkg.dir !== root && hasDependency(pkg.dir, 'basalt-ui') && hasViteEntry(pkg.dir),
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
 * Where the seed engine is running relative to the consumer's git repo — decides which
 * repo-root-shaped seeds are safe to write. `init`/`sync` compute it once per run via
 * `resolvePlacement` and print the matching skip notices themselves; `managedFiles` only reads it.
 */
export type PlacementFlags = {
  /** True when the package directory IS the detected repo root, or no `.git` exists anywhere above
   *  it (a consumer not using git keeps today's behaviour exactly). False means the package lives
   *  in a subdirectory of the repo (a monorepo's `web/`, say) — lefthook and GitHub Actions both
   *  only read config at the repo root, so seeding either one there is worse than not seeding at
   *  all. */
  isPackageRepoRoot: boolean
  /** Absolute path of the detected repo root. Meaningful only when `isPackageRepoRoot` is false —
   *  otherwise it equals the package dir and is never read. */
  repoRoot: string
  /** The app directory relative to the install root ('' = the root itself); see {@link resolveAppDir}. */
  appRel: string
  /** Non-null when the app directory is ambiguous or invalid: commands refuse rather than guess. */
  appError: string | null
}

/** The default placement — today's single-package-at-repo-root behaviour, unconditionally. */
export const ROOT_PLACEMENT: PlacementFlags = {
  isPackageRepoRoot: true,
  repoRoot: '',
  appRel: '',
  appError: null,
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

/** The AST lane's other half: an `oxlint` bin in `node_modules/.bin`, `dir` up to the repo root. */
export const OXLINT_NO_BIN =
  'oxlint config found but no oxlint binary — the AST lane never runs; add oxlint as a devDependency'
export function oxlintBinResolves(dir: string): boolean {
  const root = findRepoRoot(dir)
  for (let d = dir; ; d = dirname(d)) {
    if (existsSync(resolve(d, 'node_modules/.bin/oxlint'))) return true
    if (d === root || dirname(d) === d) return false
  }
}

/** Every `.md` file under a shipped skill dir (no dot-segments), relative and sorted; `SKILL.md` first. Empty if the dir is absent. */
function skillFiles(pkgRoot: string, name: string): string[] {
  const root = resolve(pkgRoot, 'agent/skills', name)
  if (!existsSync(root)) return []
  const rels = readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => relative(root, join(e.parentPath, e.name)).split(sep).join('/'))
    .filter((rel) => !rel.split('/').some((seg) => seg.startsWith('.')))
    .toSorted()
  return [...rels.filter((r) => r === 'SKILL.md'), ...rels.filter((r) => r !== 'SKILL.md')]
}

/** The shipped rule names: every `agent/rules/basalt-<name>.md`, the directory v3 `sync` also walks. */
function shippedRuleNames(pkgRoot: string): string[] {
  const dir = resolve(pkgRoot, 'agent/rules')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .map((file) => /^basalt-(.+)\.md$/.exec(file)?.[1])
    .filter((name): name is string => name !== undefined)
    .toSorted()
}

/** The full managed-file manifest. Stable, declarative — the single source of truth for init/sync. */
export function managedFiles(
  placement: PlacementFlags = ROOT_PLACEMENT,
  pkgRoot: string = packageRoot(),
): ManagedFile[] {
  // ── managed: exactly what Claude reads ──────────────────────────────────────
  const rules: ManagedFile[] = shippedRuleNames(pkgRoot).map((name) => ({
    dest: `.claude/rules/basalt-${name}.md`,
    mode: 'managed' as const,
    source: `agent/rules/basalt-${name}.md`,
    render: (ctx: RenderContext) => {
      const text = readSource(ctx.pkgRoot, `agent/rules/basalt-${name}.md`)
      return text === null ? null : renderRulePaths(text, ctx.vars.RULE_ROOTS)
    },
  }))

  // Skills take the same managed path the rules do — Claude Code cannot load skills from
  // node_modules, and a plugin cannot ship rules, so init/sync is the one delivery channel for the
  // whole agentic layer. The `basalt-` filename prefix keeps the /basalt-design ergonomics.
  // Every file under `agent/skills/<name>/` is its own managed unit (SKILL.md plus `references/**`),
  // found by walking the shipped tree — no per-file list to maintain.
  const skills: ManagedFile[] = SKILL_NAMES.flatMap((name) =>
    skillFiles(pkgRoot, name).map((rel) => ({
      dest: `.claude/skills/${name}/${rel}`,
      mode: 'managed' as const,
      source: `agent/skills/${name}/${rel}`,
      render: () => readSource(pkgRoot, `agent/skills/${name}/${rel}`),
    })),
  )

  // Subagents load only walking UP from the session cwd, so the consumer root is the right home.
  const agents: ManagedFile[] = AGENT_NAMES.map((name) => ({
    dest: `.claude/agents/${name}.md`,
    mode: 'managed' as const,
    source: `agent/reviewer/${name}.md`,
    render: (ctx: RenderContext) => readSource(ctx.pkgRoot, `agent/reviewer/${name}.md`),
  }))

  // AGENTS.md, not CLAUDE.md: Claude Code loads a repo-root AGENTS.md directly, but ANY CLAUDE.md
  // in or above the cwd suppresses it — so the block must not be the reason a CLAUDE.md exists.
  const agentsBlock: ManagedFile = {
    dest: AGENTS_MD,
    mode: 'managed',
    markers: true,
    source: 'agent/templates/AGENTS-block.md.tpl',
    // With markers, render() returns the fully-rendered region INCLUDING its begin/end markers.
    // The writer splices it into the consumer's host AGENTS.md at apply time.
    render: (ctx) => {
      const tpl = readSource(ctx.pkgRoot, 'agent/templates/AGENTS-block.md.tpl')
      if (tpl === null) return null
      return fillTemplate(tpl, ctx.vars).trim()
    },
  }

  // ── seed: everything a machine reads — written once, then consumer-owned ────
  const design: ManagedFile = {
    dest: 'DESIGN.md',
    mode: 'seed',
    source: 'agent/templates/DESIGN.md.tpl',
    render: (ctx) => {
      const tpl = readSource(ctx.pkgRoot, 'agent/templates/DESIGN.md.tpl')
      if (tpl === null) return null
      return fillTemplate(tpl, ctx.vars)
    },
  }

  // Scaffold destination is `.oxfmtrc.json` — oxfmt auto-discovers that filename, not `oxfmt.json`.
  // Content is a starting copy, not a reference — oxfmt has no `extends` mechanism.
  const oxfmt: ManagedFile = {
    dest: '.oxfmtrc.json',
    mode: 'seed',
    source: 'configs/oxfmt.json',
    render: (ctx) => readSource(ctx.pkgRoot, 'configs/oxfmt.json'),
  }

  // Seed a lefthook.yml that `extends` the shipped preset — the consumer owns the file (their own
  // commands merge alongside), while the preset's oxlint/oxfmt/check-theme jobs auto-update with
  // the package. `source` names the preset the stub references; the stub itself is emitted inline.
  const lefthook: ManagedFile = {
    dest: 'lefthook.yml',
    mode: 'seed',
    source: 'configs/lefthook.yml',
    render: (ctx) =>
      '# Seeded by basalt-ui init — you own this file; sync never touches it again.\n' +
      '# The extends target supplies oxlint + oxfmt + check-theme pre-commit jobs and\n' +
      '# auto-updates with the basalt-ui package. Add your own commands alongside.\n' +
      '# The path is RESOLVED from where basalt-ui actually installed, not assumed at the\n' +
      '# repo root — under an isolated linker it lives beside the package that depends on it.\n' +
      '# Run `lefthook install` once: the file is inert until the git hooks are written.\n' +
      '#\n' +
      '# NOTE: an extends target WINS on a colliding key — a `run:`/`glob:` you write under one of\n' +
      "# the preset's command names is discarded silently. `env:`, `exclude:`, `skip:` and your own\n" +
      '# command names merge. See the preset itself for the sanctioned override seams.\n' +
      'extends:\n' +
      `  - ${ctx.vars.LEFTHOOK_PRESET_PATH.replace(/^\.\//, '')}\n` +
      // The one seam that has to be RENDERED rather than documented: the preset is read in place
      // out of node_modules, so it cannot template the resolved bin the way check.yml does. Its
      // default (`bunx --no-install basalt-ui`) fails loudly rather than fetching a stranger's
      // copy; this pins it to the local one whenever basalt actually resolved.
      (ctx.vars.BASALT_BIN.startsWith('bunx ')
        ? ''
        : '\n# The theme guard runs the LOCAL bin, not a copy `bunx` fetches from npm.\n' +
          'pre-commit:\n' +
          '  commands:\n' +
          '    check-theme:\n' +
          '      env:\n' +
          `        BASALT_BIN: ${ctx.vars.BASALT_BIN}\n`),
  }

  // CI is inherently repo-shaped (a monorepo's check.yml needs its own scripts), and GitHub Actions
  // has no in-repo `extends` — so the workflow seeds as an explicit starting copy. Its oxfmt globs
  // come from `{{ROOTS_GLOBS}}` rather than a hardcoded `src/**`: on a monorepo the latter matches
  // nothing and oxfmt exits 2, breaking the consumer's very first CI run for a reason that reads
  // like a basalt bug.
  const ci: ManagedFile = {
    dest: '.github/workflows/check.yml',
    mode: 'seed',
    source: 'configs/check.yml',
    render: (ctx) => {
      const tpl = readSource(ctx.pkgRoot, 'configs/check.yml')
      if (tpl === null) return null
      return fillTemplate(tpl, ctx.vars)
    },
  }

  // Seed an `.oxlintrc.json` that extends the shipped preset (written once, then consumer-owned).
  // `render` emits the stub inline rather than copying `source`; `source` names the preset the stub
  // extends, and the `seed` mode never reports drift, so it is not read back at sync time.
  const oxlintrc: ManagedFile = {
    dest: '.oxlintrc.json',
    mode: 'seed',
    source: OXLINT_FILES.preset,
    render: (ctx) => `{\n  "extends": ["${ctx.vars.OXLINT_PRESET_PATH}"]\n}\n`,
  }

  // ── Seed scaffolds: written by init, never overwritten by sync ─────────────
  // These are starting-point files owned entirely by the consumer after first write.

  /** TanStack Router root route with QueryClient context wiring (seed — consumer-owned after init). */
  const rootRoute: ManagedFile = {
    dest: routerSeedDest(placement.appRel, 'root'),
    mode: 'seed',
    source: 'agent/templates/__root.tpl',
    render: (ctx) => {
      const tpl = readSource(ctx.pkgRoot, 'agent/templates/__root.tpl')
      if (tpl === null) return null
      return fillTemplate(tpl, ctx.vars)
    },
  }

  /** The leaf `NAV` module `__root.tsx` imports (seed — consumer-owned after init). */
  const navModule: ManagedFile = {
    dest: routerSeedDest(placement.appRel, 'nav'),
    mode: 'seed',
    source: 'agent/templates/nav.tpl',
    render: (ctx) => readSource(ctx.pkgRoot, 'agent/templates/nav.tpl'),
  }

  /** The 2.0 entry: mounts the router and declares the `Register` augmentation `defineNav` needs. */
  const mainEntry: ManagedFile = {
    dest: routerSeedDest(placement.appRel, 'main'),
    mode: 'seed',
    source: 'agent/templates/main.tpl',
    render: (ctx) => readSource(ctx.pkgRoot, 'agent/templates/main.tpl'),
  }
  /** The pathless `_app` layout and the pending, error and not-found components `main.tsx` imports. */
  const appSeeds: ManagedFile[] = (
    [
      ['app', '_app.tpl'],
      ['appError', '_app-error.tpl'],
      ['appMissing', '_app-missing.tpl'],
      ['appPending', '_app-pending.tpl'],
    ] as const
  ).map(([seed, tpl]) => ({
    dest: routerSeedDest(placement.appRel, seed),
    mode: 'seed',
    source: `agent/templates/${tpl}`,
    render: (ctx) => {
      const text = readSource(ctx.pkgRoot, `agent/templates/${tpl}`)
      return text === null ? null : fillTemplate(text, ctx.vars)
    },
  }))
  const scaffolds: ManagedFile[] = [navModule, rootRoute, mainEntry, ...appSeeds]

  // lefthook and GitHub Actions only read config at the repo root: a package in a subdirectory skips
  // both (the root often has its own), and `sync` reports on the root's files instead.
  const rootTooling: ManagedFile[] = placement.isPackageRepoRoot ? [lefthook, ci] : []

  return [
    ...rules,
    ...skills,
    ...agents,
    agentsBlock,
    design,
    oxfmt,
    ...rootTooling,
    oxlintrc,
    ...scaffolds,
  ]
}

export type Manifest = {
  version: 1
  /** The basalt-ui version that last wrote this manifest — `doctor`'s one reconciliation axis. */
  basaltVersion?: string
  /** dest path → sha256 of the managed unit (file bytes, block body, or stanza) at last write. */
  files: Record<string, string>
  /**
   * The resolved level-0 spacing scale (`xs`..`xl`, px) at last write: `doctor`'s second axis, and
   * the only one that reports a change in RENDERED OUTPUT. A retune of the spacing bases moves every
   * surface in every consumer, which a one-line `feat:` subject cannot convey.
   */
  spacingScale?: Record<string, number>
}

export function readManifest(cwd: string): Manifest {
  const raw = readIfExists(resolve(cwd, MANIFEST_PATH))
  if (raw === null) return { version: 1, files: {} }
  try {
    const parsed = JSON.parse(raw) as Partial<Manifest>
    const manifest: Manifest = { version: 1, files: parsed.files ?? {} }
    if (typeof parsed.basaltVersion === 'string') manifest.basaltVersion = parsed.basaltVersion
    // `typeof null === 'object'` and so is an array — a hand-edited manifest carrying either would
    // reach doctor and be indexed as a record. Values must be numbers too: a `"4"` would never
    // `===` the derived `4`, so doctor would report every step as moved. Anything else is treated
    // as unrecorded, which reads as "run sync" rather than as a garbled diff.
    const scale: unknown = parsed.spacingScale
    if (
      scale !== null &&
      scale !== undefined &&
      typeof scale === 'object' &&
      !Array.isArray(scale) &&
      Object.values(scale).every((v) => typeof v === 'number')
    ) {
      manifest.spacingScale = scale as Record<string, number>
    }
    return manifest
  } catch {
    return { version: 1, files: {} }
  }
}

/** Resolve the package root at runtime (two levels up from dist/cli/index.js). */
export function packageRoot(): string {
  return fileURLToPath(new URL('../../', import.meta.url))
}

/** Build the render context for a run from the package root + consumer cwd/config. */
export function renderContext(
  cwd: string,
  ruleRoots?: readonly string[],
  pkgRoot: string = packageRoot(),
): RenderContext {
  const vars = buildTemplateVars(pkgRoot, cwd, readBasaltConfig(cwd))
  return { pkgRoot, vars: ruleRoots === undefined ? vars : { ...vars, RULE_ROOTS: [...ruleRoots] } }
}

/** The shipped oxlint files, package-relative — the one spelling every reader of them uses. */
export const OXLINT_FILES = {
  preset: 'configs/oxlint.json',
  guards: 'configs/oxlint-basalt.json',
  plugin: 'configs/oxlint-plugin.js',
} as const

/** Whether an `extends`/`jsPlugins` entry names that shipped basalt-ui file. */
export const namesShipped = (entry: unknown, file: string): entry is string =>
  typeof entry === 'string' && entry.endsWith(`basalt-ui/${file}`)

/**
 * The `extends` entry naming a shipped preset (full or guards-only), or null. The ENTRY, not a
 * boolean: a well-shaped `./node_modules/basalt-ui/configs/oxlint.json` can resolve to nothing
 * (an upgrade, an isolated linker), and oxlint then dies `NotFound` while a check built to prove the
 * lane is ON reports green — callers resolve it against the config's own directory.
 */
export function basaltPresetEntry(entries: unknown): string | null {
  const presets = [OXLINT_FILES.preset, OXLINT_FILES.guards]
  return [entries].flat().find((e): e is string => presets.some((f) => namesShipped(e, f))) ?? null
}

// workspace-glob primitives — shared by findBasaltInstall

/**
 * Which shape of consumer a command is looking at: `framework` (the Mantine app the scaffold is
 * for) or `tokens-only` (took the `--vx-*` layer and nothing else, so `init` is the wrong advice).
 * DECLARED only (`--framework` / `--tokens-only` / `basalt.profile`), never inferred; see
 * {@link declaredProfile}.
 */
export type DoctorProfile = 'framework' | 'tokens-only'

type WorkspacePackage = { readonly name: string; readonly dir: string }

/** {@link collectWorkspacePackages}'s return: the packages plus whether a `workspaces` field existed. */
type WorkspaceWalk = {
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
function collectWorkspacePackages(cwd: string): WorkspaceWalk {
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
 * The `guard-hook` subcommand is async (reads stdin); all others are synchronous.
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
    console.log(USAGE)
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
    case 'check-theme':
      return checkTheme(cwd, flags)
    case 'doctor':
      return doctor(cwd, flags)
    case 'guard-hook':
      return guardHook(cwd)
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
    case 'lint':
      return lint(flags, cwd)
    default:
      // Named, not just implied by a usage dump: a full-screen help block with no error line reads
      // like the command ran and chose to print help. Reported by a consumer who passed
      // `"check-theme --audit-allows"` as ONE argument and could not tell what had been rejected.
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
export type { ManagedFile }

// Re-export every split-out command so `import { X } from './index'` keeps working — `index.ts` is
// dispatch + shared helpers only (C2); the command implementations live in their own files.
export { checkTheme, doctor, guardHook, init, sync, fontsCss, normalizeColorFunctions, tokensCss }
export type { SyncOptions } from './sync'
export type { DoctorOptions, Result as DoctorResult } from './doctor'
