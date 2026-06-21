/**
 * basalt-ui CLI — `init`, `sync`, `check-theme`, `check-coverage`.
 *
 * `checkTheme` is a thin FS walker over the headless guard core (`../guard`). It reads the
 * BasaltConfig, builds a GuardConfig, walks the source roots, calls `checkSource` per file,
 * collects Finding[], groups/reports findings, and returns an exit code.
 *
 * `checkCoverage` asserts the four PROJECTION 5 invariants: guardKinds ⊆ GUARD_RULES,
 * rule files on disk, skill union ⊆ plugin.json, and subpath-export-coverage.
 *
 * `init` / `sync` scaffold and reconcile the framework's *agentic* surface into a consumer repo:
 * Claude Code rules, a managed CLAUDE.md block, a DESIGN.md seed, and the toolchain templates
 * (oxfmt / lefthook / CI). Both are sha256-manifest driven for safe,
 * idempotent three-way reconciliation. Dependency-free — Node/Bun built-ins only.
 *
 * Runtime-agnostic (Node or Bun) — built-ins only, no `bun`-module import, so the exported API is
 * safe to import under plain Node. Config is read from the consuming package.json `"basalt"` key;
 * argo's hardcoded values are the DEFAULTS.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { checkSource, DEFAULT_GUARD_CONFIG, GUARD_RULES } from '../guard'
import type { Finding, GuardConfig } from '../guard'
import { RULE_NAMES, SURFACES } from '../surfaces'
import type { DoctrineSpec, SurfaceSpec } from '../surfaces'

/** Shape of the optional `"basalt"` key in a consumer's package.json. */
export type BasaltConfig = {
  /** Source roots to scan. Default: argo's `['apps/dashboard/src', 'packages/charts/src']`. */
  roots?: string[]
  /** Files exempt from the scan (they ARE the palette source). Default: argo's exempt set. */
  exempt?: string[]
  /** Named spacing-scale steps (px) flagged when used as a raw spacing prop. Default: 10/12/16/20/32. */
  spacingSteps?: number[]
  /** Off-identity Mantine accent families forbidden as chrome accents. Default: argo's set. */
  forbiddenAccents?: string[]
  /** Earned accent hue recorded in DESIGN.md `{{ACCENT_HUE}}`. Default: `blue`. */
  accentHue?: string
  /**
   * Flag ad-hoc inline surface styling (`border`/`borderRadius`/`boxShadow` literals in a `style={{}}`)
   * that bypasses the `withBorder` + radius-token + `VX.surface.*` system. Default: `true` (ON).
   * Set `false` to disable the `raw-surface` check.
   */
  rawSurface?: boolean
  /**
   * Flag references to a raw Mantine ramp step used for surface color
   * (`var(--mantine-color-gray-N)` / `var(--mantine-color-dark-N)`) — these bypass the basalt
   * surface tokens. Default: `true` (ON). Set `false` to disable the `off-system-surface-var` check.
   */
  offSystemSurfaceVar?: boolean
  /**
   * Flag raw lowercase JSX layout/surface elements (`div`/`span`/`section`/…) carrying an inline
   * `style={{}}` with a layout/surface property — steer to a Mantine layout primitive
   * (`Box`/`Flex`/`Grid`/`Stack`/`Group`/`SimpleGrid`/`Paper`). Default: `true` (ON). Set `false`
   * to disable the `raw-html-layout` check.
   */
  rawHtmlLayout?: boolean
  /**
   * Flag spacing/sizing literals inside an inline `style={{}}` (`padding`/`margin`/`gap`/…) — the
   * `raw-spacing` check only catches the Mantine prop syntax. Default: `true` (ON). Set `false` to
   * disable the `inline-spacing` check.
   */
  inlineSpacing?: boolean
  /**
   * Flag `display: 'flex' | 'grid' | 'inline-flex' | 'inline-grid'` in an inline `style={{}}` —
   * steer to `<Flex>`/`<Grid>`/`<Group>`. Default: `true` (ON). Set `false` to disable the
   * `inline-display` check.
   */
  inlineDisplay?: boolean
  /**
   * Flag raw `<AxisLeft>` / `<AxisBottom>` / `<AxisRight>` visx JSX inside chart files (a path
   * containing `/charts/`) — these bypass the `AxisLeftNumeric` / `AxisBottomDate` /
   * `AxisRightNumeric` primitives that carry the theme tokens + smart ticks. The legitimate wrapper
   * (`Axes.tsx`, which IS the primitive) is exempt. Default: `true` (ON). Set `false` to disable the
   * `raw-visx-axis` check.
   */
  rawVisxAxis?: boolean
  /** Path of the consumer's guard-exempt series file, for DESIGN.md `{{SERIES_MODULE_PATH}}`. Default: `src/theme/series.ts`. */
  seriesModulePath?: string
  /** Claude Code marketplace coordinates for the settings stanza `{{MARKETPLACE_OWNER}}/{{MARKETPLACE_REPO}}`. Default: `jkrumm/basalt-ui`. */
  marketplace?: { owner?: string; repo?: string }
}

const DEFAULT_ROOTS = ['apps/dashboard/src', 'packages/charts/src']
const DEFAULT_EXEMPT = [
  'packages/charts/src/palette.ts',
  'packages/charts/src/theme-vars.ts',
  'packages/charts/src/tokens.ts',
  'packages/charts/src/utils/color.ts',
  'apps/dashboard/src/theme.ts',
]

const SKIP = /\.gen\.ts$|\.test\.[tj]sx?$|\.d\.ts$/

function readBasaltConfig(cwd: string): BasaltConfig {
  try {
    const pkg = JSON.parse(readFileSync(resolve(cwd, 'package.json'), 'utf8')) as {
      basalt?: BasaltConfig
    }
    return pkg.basalt ?? {}
  } catch {
    return {}
  }
}

/** Recursively collect .ts/.tsx files under a root, skipping dependency/build dirs. Node+Bun-safe. */
function walkTsFiles(dir: string, out: string[] = []): string[] {
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
    if (isDir) walkTsFiles(abs, out)
    else if (/\.tsx?$/.test(name)) out.push(abs)
  }
  return out
}

/**
 * Theme guard — thin FS walker over the headless `../guard` core. Reads BasaltConfig, builds a
 * GuardConfig, walks roots, calls checkSource per file, collects Finding[], groups/reports, returns
 * 0 (clean) / 1 (violations). A `theme-allow` comment exempts a line.
 */
export function checkTheme(cwd: string = process.cwd()): number {
  const cfg = readBasaltConfig(cwd)
  const roots = cfg.roots ?? DEFAULT_ROOTS
  const exempt = new Set(cfg.exempt ?? DEFAULT_EXEMPT)

  const guardCfg: GuardConfig = {
    spacingSteps: cfg.spacingSteps ?? DEFAULT_GUARD_CONFIG.spacingSteps,
    forbiddenAccents: cfg.forbiddenAccents ?? DEFAULT_GUARD_CONFIG.forbiddenAccents,
    rawSurface: cfg.rawSurface ?? DEFAULT_GUARD_CONFIG.rawSurface,
    offSystemSurfaceVar: cfg.offSystemSurfaceVar ?? DEFAULT_GUARD_CONFIG.offSystemSurfaceVar,
    rawHtmlLayout: cfg.rawHtmlLayout ?? DEFAULT_GUARD_CONFIG.rawHtmlLayout,
    inlineSpacing: cfg.inlineSpacing ?? DEFAULT_GUARD_CONFIG.inlineSpacing,
    inlineDisplay: cfg.inlineDisplay ?? DEFAULT_GUARD_CONFIG.inlineDisplay,
    rawVisxAxis: cfg.rawVisxAxis ?? DEFAULT_GUARD_CONFIG.rawVisxAxis,
    allowComment: 'theme-allow',
  }

  const findings: Finding[] = []
  for (const root of roots) {
    for (const f of walkTsFiles(resolve(cwd, root))) {
      // Normalize to forward slashes so path matching (SKIP, exempt, isChartFile) is
      // identical on Windows (where `relative` yields backslashes) and POSIX.
      const rel = relative(cwd, f).replace(/\\/g, '/')
      if (SKIP.test(rel) || exempt.has(rel)) continue
      const text = readFileSync(f, 'utf8')
      findings.push(...checkSource(text, rel, guardCfg))
    }
  }

  if (findings.length === 0) {
    console.log('✓ Theme guard: no off-palette colors.')
    return 0
  }

  const byFile = new Map<string, Finding[]>()
  for (const f of findings) {
    const list = byFile.get(f.relPath) ?? []
    list.push(f)
    byFile.set(f.relPath, list)
  }
  console.error(`✖ Theme guard: ${findings.length} off-palette / off-identity violation(s)\n`)
  for (const [file, vs] of [...byFile].toSorted()) {
    console.error(file)
    for (const v of vs.toSorted((a, b) => a.line - b.line)) {
      console.error(`  ${String(v.line).padStart(4)}  ${v.kind.padEnd(22)} ${v.token}`)
    }
    console.error('')
  }
  console.error(
    'Fix: route color through VX.* / the Mantine theme; for an off-identity accent use blue/gray or ' +
      'a status hue (red/green/orange/yellow); for raw spacing/radius use the scale token; for ' +
      'raw-surface use `withBorder` + a `radius` token / `VX.surface.*` / `var(--vx-radius-card)` ' +
      'instead of inline border/radius/shadow. ' +
      'off-system-surface-var: raw Mantine ramp step bypasses the basalt surface tokens — use ' +
      'VX.surface.* / --vx-surface-* (border/panel/subtle/bg) instead. ' +
      'raw-html-layout: raw HTML element with inline layout/surface styling — use a Mantine layout ' +
      'primitive (Box/Flex/Grid/Stack/Group). ' +
      'inline-spacing: inline spacing literal — use the Mantine spacing prop/token (p/m/gap with ' +
      'xs..xl). ' +
      'inline-display: use <Flex>/<Grid>/<Group> instead of an inline display:flex/grid. ' +
      'raw-visx-axis: raw <AxisLeft>/<AxisBottom>/<AxisRight> in a chart file — use ' +
      'AxisLeftNumeric / AxisBottomDate / AxisRightNumeric from the charts primitives. ' +
      'Add a `theme-allow` comment for a deliberate exception.',
  )
  return 1
}

// ──────────────────────────────────────────────────────────────────────────────
// init / sync — managed-files engine
// ──────────────────────────────────────────────────────────────────────────────

/**
 * How a managed file is reconciled with its shipped source.
 *
 * - `copy`  : verbatim asset. init skips if the dest already exists; sync three-way reconciles it.
 * - `block` : a `<!-- basalt:begin -->…<!-- basalt:end -->` region inside a host file (CLAUDE.md).
 *             The rest of the host file is owned by the consumer; only the block is managed.
 * - `seed`  : written once if absent, then owned entirely by the consumer. sync never overwrites it
 *             and never reports drift (it is a starting point, not a managed mirror).
 */
type Strategy = 'copy' | 'block' | 'seed'

/** A single file the framework writes into a consumer repo. */
type ManagedFile = {
  /** Path of the produced file, relative to the consumer repo root. Stable manifest key. */
  dest: string
  /** Reconciliation strategy. */
  strategy: Strategy
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
type RenderContext = {
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
  MARKETPLACE_OWNER: string
  MARKETPLACE_REPO: string
}

// The block markers the CLAUDE.md template emits. The begin marker carries the framework version
// (`<!-- basalt:begin 1.0.0 -->`), so the region is matched by the begin PREFIX, not an exact string.
const BLOCK_BEGIN_PREFIX = '<!-- basalt:begin'
const BLOCK_END = '<!-- basalt:end -->'
const MANIFEST_PATH = '.basalt/manifest.json'

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function readIfExists(abs: string): string | null {
  if (!existsSync(abs)) return null
  return readFileSync(abs, 'utf8')
}

/** Read a shipped source asset from the package root; null if the sibling hasn't authored it yet. */
function readSource(pkgRoot: string, source: string): string | null {
  return readIfExists(resolve(pkgRoot, source))
}

function readPackageName(cwd: string): string {
  try {
    const pkg = JSON.parse(readFileSync(resolve(cwd, 'package.json'), 'utf8')) as { name?: string }
    if (pkg.name && pkg.name.length > 0) return pkg.name
  } catch {
    // fall through to dir name
  }
  return cwd.split('/').filter(Boolean).pop() ?? 'app'
}

/** The framework's own published version, read from the package root package.json. */
function readFrameworkVersion(pkgRoot: string): string {
  try {
    const pkg = JSON.parse(readFileSync(resolve(pkgRoot, 'package.json'), 'utf8')) as {
      version?: string
    }
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

/** Build the template-variable map from the framework root + consumer cwd/config. */
function buildTemplateVars(pkgRoot: string, cwd: string, cfg: BasaltConfig): TemplateVars {
  return {
    APP_NAME: readPackageName(cwd),
    BASALT_VERSION: readFrameworkVersion(pkgRoot),
    ACCENT_HUE: cfg.accentHue ?? 'blue',
    SERIES_MODULE_PATH: cfg.seriesModulePath ?? 'src/theme/series.ts',
    MARKETPLACE_OWNER: cfg.marketplace?.owner ?? 'jkrumm',
    MARKETPLACE_REPO: cfg.marketplace?.repo ?? 'basalt-ui',
  }
}

/** Substitute every `{{KEY}}` placeholder from the variable map; unknown keys are left verbatim. */
function fillTemplate(tpl: string, vars: TemplateVars): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (m, key: string) => {
    const v = (vars as Record<string, string>)[key]
    return v ?? m
  })
}

/** The character span of the managed `basalt:begin … basalt:end` region, or null if absent. */
function findBlockRegion(host: string): { start: number; end: number } | null {
  const start = host.indexOf(BLOCK_BEGIN_PREFIX)
  if (start === -1) return null
  const endMarker = host.indexOf(BLOCK_END, start)
  if (endMarker === -1) return null
  return { start, end: endMarker + BLOCK_END.length }
}

/**
 * Replace (or append) the managed block inside a host file. `block` is the fully-rendered template
 * INCLUDING its `basalt:begin … basalt:end` markers. Everything outside the region is preserved;
 * with no existing region the block is appended after a separating blank line.
 */
function applyBlock(host: string, block: string): string {
  const region = findBlockRegion(host)
  if (region) {
    return `${host.slice(0, region.start)}${block.trim()}${host.slice(region.end)}`
  }
  const base = host.trimEnd()
  return base.length === 0 ? `${block.trim()}\n` : `${base}\n\n${block.trim()}\n`
}

/** The full managed-file manifest. Stable, declarative — the single source of truth for init/sync. */
function managedFiles(): ManagedFile[] {
  const rules: ManagedFile[] = RULE_NAMES.map((name) => ({
    dest: `.claude/rules/basalt-${name}.md`,
    strategy: 'copy' as const,
    source: `agent/rules/basalt-${name}.md`,
    render: (ctx: RenderContext) => readSource(ctx.pkgRoot, `agent/rules/basalt-${name}.md`),
  }))

  const claudeBlock: ManagedFile = {
    dest: 'CLAUDE.md',
    strategy: 'block',
    source: 'agent/templates/CLAUDE-block.md.tpl',
    // For block, render() returns the fully-rendered block INCLUDING its begin/end markers — the
    // managed region. The writer splices it into the consumer's host CLAUDE.md at apply time.
    render: (ctx) => {
      const tpl = readSource(ctx.pkgRoot, 'agent/templates/CLAUDE-block.md.tpl')
      if (tpl === null) return null
      return fillTemplate(tpl, ctx.vars).trim()
    },
  }

  const design: ManagedFile = {
    dest: 'DESIGN.md',
    strategy: 'seed',
    source: 'agent/templates/DESIGN.md.tpl',
    render: (ctx) => {
      const tpl = readSource(ctx.pkgRoot, 'agent/templates/DESIGN.md.tpl')
      if (tpl === null) return null
      return fillTemplate(tpl, ctx.vars)
    },
  }

  const oxfmt: ManagedFile = {
    dest: 'oxfmt.json',
    strategy: 'copy',
    source: 'configs/oxfmt.json',
    render: (ctx) => readSource(ctx.pkgRoot, 'configs/oxfmt.json'),
  }

  const lefthook: ManagedFile = {
    dest: 'lefthook.yml',
    strategy: 'copy',
    source: 'configs/lefthook.yml',
    render: (ctx) => readSource(ctx.pkgRoot, 'configs/lefthook.yml'),
  }

  const ci: ManagedFile = {
    dest: '.github/workflows/check.yml',
    strategy: 'copy',
    source: 'configs/check.yml',
    render: (ctx) => readSource(ctx.pkgRoot, 'configs/check.yml'),
  }

  // Seed an `.oxlintrc.json` that extends the shipped preset (written once, then consumer-owned).
  // `render` emits the stub inline rather than copying `source`; `source` names the preset the stub
  // extends, and the `seed` strategy never reports drift, so it is not read back at sync time.
  const oxlintrc: ManagedFile = {
    dest: '.oxlintrc.json',
    strategy: 'seed',
    source: 'configs/oxlint.json',
    render: () => '{\n  "extends": ["./node_modules/basalt-ui/configs/oxlint.json"]\n}\n',
  }

  // ── Seed scaffolds: written by init, never overwritten by sync ─────────────
  // These are starting-point files owned entirely by the consumer after first write.

  /** TanStack Query client bootstrap (seed — consumer-owned after init). */
  const queryClient: ManagedFile = {
    dest: 'src/query-client.ts',
    strategy: 'seed',
    source: 'agent/templates/query-client.ts.tpl',
    render: (ctx) => {
      const tpl = readSource(ctx.pkgRoot, 'agent/templates/query-client.ts.tpl')
      if (tpl === null) return null
      return fillTemplate(tpl, ctx.vars)
    },
  }

  /** TanStack Router root route with QueryClient context wiring (seed — consumer-owned after init). */
  const rootRoute: ManagedFile = {
    dest: 'src/routes/__root.tsx',
    strategy: 'seed',
    source: 'agent/templates/__root.tpl',
    render: (ctx) => {
      const tpl = readSource(ctx.pkgRoot, 'agent/templates/__root.tpl')
      if (tpl === null) return null
      return fillTemplate(tpl, ctx.vars)
    },
  }

  return [...rules, claudeBlock, design, oxfmt, lefthook, ci, oxlintrc, queryClient, rootRoute]
}

type Manifest = {
  version: 1
  /** dest path → sha256 of the managed unit (file bytes, block body, or stanza) at last write. */
  files: Record<string, string>
}

function readManifest(cwd: string): Manifest {
  const raw = readIfExists(resolve(cwd, MANIFEST_PATH))
  if (raw === null) return { version: 1, files: {} }
  try {
    const parsed = JSON.parse(raw) as Partial<Manifest>
    return { version: 1, files: parsed.files ?? {} }
  } catch {
    return { version: 1, files: {} }
  }
}

function writeFileEnsuringDir(abs: string, content: string): void {
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}

/** Resolve the package root at runtime (two levels up from dist/cli/index.js). */
function packageRoot(): string {
  return fileURLToPath(new URL('../../', import.meta.url))
}

/**
 * The current on-disk state of a managed unit, plus the version the framework wants. For `block`
 * the "current" unit is the existing region (markers included); for `copy`/`seed` it is the whole
 * file.
 */
type UnitState = {
  /** The managed unit's current bytes on disk (block region / whole file). */
  current: string | null
  /** The managed unit's desired bytes from the shipped source. null = source not shipped yet. */
  desired: string | null
}

/** The existing managed region (markers included, trimmed) inside a host file, or null. */
function extractBlockRegion(host: string | null): string | null {
  if (host === null) return null
  const region = findBlockRegion(host)
  if (region === null) return null
  return host.slice(region.start, region.end).trim()
}

/** Read the current vs desired managed-unit bytes for a file. */
function unitState(file: ManagedFile, cwd: string, ctx: RenderContext): UnitState {
  const desired = file.render(ctx)
  const destAbs = resolve(cwd, file.dest)
  const onDisk = readIfExists(destAbs)
  if (file.strategy === 'block') {
    return { current: extractBlockRegion(onDisk), desired }
  }
  return { current: onDisk, desired }
}

/** Write a managed unit to disk according to its strategy. Returns the hash of the written unit. */
function writeUnit(file: ManagedFile, cwd: string, desired: string): string {
  const destAbs = resolve(cwd, file.dest)
  if (file.strategy === 'block') {
    const host = readIfExists(destAbs) ?? ''
    writeFileEnsuringDir(destAbs, applyBlock(host, desired))
    return sha256(desired)
  }
  writeFileEnsuringDir(destAbs, desired)
  return sha256(desired)
}

type Classification = 'unchanged' | 'drifted' | 'missing' | 'current'

/**
 * Classify a managed file against the manifest for a sync run.
 * - missing  : the managed unit is absent on disk → recreate.
 * - current  : on disk == desired → nothing to do.
 * - unchanged: on disk == manifest hash (untouched since last sync) but != desired → safe overwrite.
 * - drifted  : on disk != manifest hash AND != desired (locally edited) → skip unless --force.
 */
function classify(state: UnitState, manifestHash: string | undefined): Classification {
  if (state.current === null) return 'missing'
  if (state.desired !== null && state.current === state.desired) return 'current'
  const currentHash = sha256(state.current)
  if (currentHash === manifestHash) return 'unchanged'
  return 'drifted'
}

function diffSummary(file: ManagedFile, state: UnitState): string {
  const cur = state.current ?? ''
  const des = state.desired ?? ''
  const curLines = cur.split('\n').length
  const desLines = des.split('\n').length
  return `  ~ ${file.dest} (local: ${curLines} lines, shipped: ${desLines} lines) — locally edited, skipped (use --force to overwrite)`
}

/** Build the render context for a run from the package root + consumer cwd/config. */
function renderContext(cwd: string): RenderContext {
  const pkgRoot = packageRoot()
  return { pkgRoot, vars: buildTemplateVars(pkgRoot, cwd, readBasaltConfig(cwd)) }
}

/** Scaffold all managed files into the consumer repo, then write the manifest. Idempotent. Returns 0. */
export function init(cwd: string = process.cwd()): number {
  const ctx = renderContext(cwd)
  const manifest = readManifest(cwd)
  const files = managedFiles()

  let written = 0
  let skipped = 0
  const missingSources: string[] = []

  for (const file of files) {
    const state = unitState(file, cwd, ctx)
    if (state.desired === null) {
      missingSources.push(file.source)
      continue
    }

    // `seed` + `copy` are skip-if-exists on init. `block` always inserts/updates its region;
    const destExists = existsSync(resolve(cwd, file.dest))
    if ((file.strategy === 'copy' || file.strategy === 'seed') && destExists) {
      // Already present — keep the consumer's copy untouched. Record the SHIPPED hash so a later
      // sync treats a pre-existing-but-different file as locally drifted (skip unless --force),
      // never silently clobbering a file the consumer authored before init.
      manifest.files[file.dest] = sha256(state.desired)
      skipped++
      continue
    }

    const hash = writeUnit(file, cwd, state.desired)
    manifest.files[file.dest] = hash
    written++
  }

  writeFileEnsuringDir(resolve(cwd, MANIFEST_PATH), `${JSON.stringify(manifest, null, 2)}\n`)

  console.log(`basalt init: ${written} written, ${skipped} kept, manifest at ${MANIFEST_PATH}`)
  if (missingSources.length > 0) {
    console.log(
      `basalt init: ${missingSources.length} shipped asset(s) not present, skipped: ${missingSources.join(', ')}`,
    )
  }
  // Skills ship via the basalt plugin, not init (a plugin can't write repo doctrine, and project
  // settings can't auto-install a plugin). Install it once at user scope — applies to every project
  // and auto-updates — so per-project setup stays just `basalt init`.
  const mp = `${ctx.vars.MARKETPLACE_OWNER}/${ctx.vars.MARKETPLACE_REPO}`
  console.log(
    `\nSkills: install the basalt plugin once (user scope → all projects, then auto-updates):\n` +
      `  claude plugin marketplace add ${mp}\n` +
      `  claude plugin install basalt@${ctx.vars.MARKETPLACE_REPO}   (enable auto-update when prompted)`,
  )
  return 0
}

type SyncOptions = { force?: boolean; check?: boolean }

/**
 * Reconcile managed files with the shipped versions via a sha256 three-way compare.
 *
 * - `--check` makes NO writes; exits non-zero if any managed file is out-of-date or locally drifted
 *   (a CI freshness gate), exit 0 when all current.
 * - `--force` overwrites locally-drifted files instead of skipping them.
 */
export function sync(opts: SyncOptions = {}, cwd: string = process.cwd()): number {
  const ctx = renderContext(cwd)
  const manifest = readManifest(cwd)
  const files = managedFiles()

  let updated = 0
  let recreated = 0
  let skippedDrift = 0
  let staleForCheck = 0
  const driftLines: string[] = []
  const missingSources: string[] = []

  for (const file of files) {
    const state = unitState(file, cwd, ctx)
    if (state.desired === null) {
      missingSources.push(file.source)
      continue
    }

    // `seed` is written once, then owned by the consumer — never reconciled, never reported.
    if (file.strategy === 'seed') {
      if (state.current === null && !opts.check) {
        manifest.files[file.dest] = writeUnit(file, cwd, state.desired)
        recreated++
      }
      continue
    }

    const kind = classify(state, manifest.files[file.dest])

    if (kind === 'current') {
      manifest.files[file.dest] = sha256(state.desired)
      continue
    }

    if (kind === 'drifted' && !opts.force) {
      driftLines.push(diffSummary(file, state))
      staleForCheck++
      skippedDrift++
      continue
    }

    // missing | unchanged | (drifted && force) → write the shipped version.
    staleForCheck++
    if (opts.check) continue
    manifest.files[file.dest] = writeUnit(file, cwd, state.desired)
    if (kind === 'missing') recreated++
    else updated++
  }

  if (opts.check) {
    if (driftLines.length > 0) {
      console.error('basalt sync --check: locally-drifted managed files:')
      for (const l of driftLines) console.error(l)
    }
    if (staleForCheck > 0) {
      console.error(`basalt sync --check: ${staleForCheck} managed file(s) out of date.`)
      return 1
    }
    console.log('✓ basalt sync --check: all managed files current.')
    return 0
  }

  writeFileEnsuringDir(resolve(cwd, MANIFEST_PATH), `${JSON.stringify(manifest, null, 2)}\n`)

  console.log(
    `basalt sync: ${updated} updated, ${recreated} recreated, ${skippedDrift} skipped (drift).`,
  )
  if (driftLines.length > 0) {
    console.log('Locally-edited files were skipped (run with --force to overwrite):')
    for (const l of driftLines) console.log(l)
  }
  if (missingSources.length > 0) {
    console.log(
      `basalt sync: ${missingSources.length} shipped asset(s) not present, skipped: ${missingSources.join(', ')}`,
    )
  }
  return 0
}

// ──────────────────────────────────────────────────────────────────────────────
// check-coverage — PROJECTION 5 triad + plugin-skill coverage gate
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Assert the four PROJECTION 5 invariants against the live SURFACES + GUARD_RULES + plugin.json.
 * Returns 0 when all pass; 1 when any fail (console.error each failure).
 *
 * Four assertions:
 *  1. Every doctrine spec's guardKinds ⊆ keyof GUARD_RULES.
 *  2. Every doctrine rule (deduped) maps to agent/rules/basalt-{rule}.md on disk.
 *  3. Deduped union of doctrine skill[] ⊆ plugin.json skills.
 *  4. Every non-#, non-'.' JS-subpath SURFACES key has a package.json exports entry.
 *
 * Tooling surfaces are exempt from assertions 1–3 by the discriminant.
 * Synthetic #-keys participate in assertions 1 and 2 but feed assertion 3 only
 * via the deduped skill union (no independent per-#-surface skill row).
 */
export function checkCoverage(cwd: string = process.cwd()): number {
  const pkgRoot = packageRoot()
  const failures: string[] = []

  const allSpecs = Object.entries(SURFACES) as [string, SurfaceSpec][]
  const doctrineSpecs = (Object.values(SURFACES) as SurfaceSpec[]).filter(
    (s): s is DoctrineSpec => s.kind === 'doctrine',
  )

  // ── Assertion 1: every doctrine spec's guardKinds ⊆ keyof GUARD_RULES ──────
  const validGuardKinds = new Set(Object.keys(GUARD_RULES))
  for (const [key, spec] of allSpecs) {
    if (spec.kind !== 'doctrine') continue
    for (const kind of spec.guardKinds) {
      if (!validGuardKinds.has(kind)) {
        failures.push(
          `SURFACES['${key}'].guardKinds includes '${kind}' which is not in GUARD_RULES`,
        )
      }
    }
  }

  // ── Assertion 2: every doctrine rule (deduped) → agent/rules/basalt-{rule}.md ──
  for (const rule of RULE_NAMES) {
    const rulePath = resolve(pkgRoot, `agent/rules/basalt-${rule}.md`)
    if (!existsSync(rulePath)) {
      failures.push(
        `Missing rule file: agent/rules/basalt-${rule}.md (derived from SURFACES doctrine rules)`,
      )
    }
  }

  // ── Assertion 3: deduped union of doctrine skill[] ⊆ plugin.json skills ────
  // Skipped gracefully when plugin.json is absent (non-framework-repo context).
  const pluginJsonPath = resolve(cwd, 'plugins/basalt/.claude-plugin/plugin.json')
  if (!existsSync(pluginJsonPath)) {
    console.log(
      `  (assertion 3 skipped: plugin.json not found — not in the basalt-ui framework repo, skipping the plugin-skills check)`,
    )
  } else {
    let pluginSkillNames: Set<string> = new Set()
    try {
      const pluginJson = JSON.parse(readFileSync(pluginJsonPath, 'utf8')) as { skills?: string[] }
      // skills are path references like './skills/basalt-app'; extract the last path segment
      pluginSkillNames = new Set((pluginJson.skills ?? []).map((s) => s.split('/').pop() ?? s))
    } catch {
      failures.push(`Cannot read plugin.json at ${pluginJsonPath}`)
    }

    const doctrineSkillUnion = new Set(doctrineSpecs.flatMap((s) => [...s.skill]))
    for (const skill of doctrineSkillUnion) {
      if (!pluginSkillNames.has(skill)) {
        failures.push(
          `SURFACES doctrine skill '${skill}' is not listed in plugins/basalt/.claude-plugin/plugin.json skills`,
        )
      }
    }
  }

  // ── Assertion 4: subpath-export-coverage ────────────────────────────────────
  // Every non-#, non-'.' JS-subpath SURFACES key must have a package.json exports entry.
  let pkgExports: Set<string> = new Set()
  try {
    const consumerPkgPath = resolve(pkgRoot, 'package.json')
    const consumerPkg = JSON.parse(readFileSync(consumerPkgPath, 'utf8')) as {
      exports?: Record<string, unknown>
    }
    pkgExports = new Set(Object.keys(consumerPkg.exports ?? {}))
  } catch {
    failures.push(`Cannot read package.json at ${pkgRoot}`)
  }

  for (const key of Object.keys(SURFACES)) {
    if (key.startsWith('#') || key === '.') continue
    if (!pkgExports.has(key)) {
      failures.push(
        `SURFACES key '${key}' is a JS subpath but has no entry in package.json exports`,
      )
    }
  }

  // ── Assertion 5: every real package.json exports key has a SURFACES entry ────
  // Excludes ./styles.css and ./configs/* (non-JS assets / raw file paths).
  for (const exportKey of pkgExports) {
    if (exportKey === '.' || exportKey === './styles.css' || exportKey.startsWith('./configs/'))
      continue
    if (!(exportKey in SURFACES)) {
      failures.push(`package.json exports key '${exportKey}' has no matching SURFACES entry`)
    }
  }

  // ── Assertion 6: every surface with non-empty forbiddenImports has a globs field ──
  for (const [key, spec] of allSpecs) {
    if (spec.forbiddenImports.length === 0) continue
    if (!('globs' in spec) || spec.globs === undefined) {
      failures.push(
        `SURFACES['${key}'] has non-empty forbiddenImports but no globs field (required for oxlint emission)`,
      )
    }
  }

  // ── Report ──────────────────────────────────────────────────────────────────
  if (failures.length === 0) {
    console.log('✓ check-coverage: all PROJECTION 5 assertions pass.')
    return 0
  }

  console.error(`✖ check-coverage: ${failures.length} failure(s)`)
  for (const f of failures) {
    console.error(`  ${f}`)
  }
  return 1
}

// ──────────────────────────────────────────────────────────────────────────────
// doctor — consumer repo integration health check
// ──────────────────────────────────────────────────────────────────────────────

type DoctorResult = {
  /** Number of hard failures (exit non-zero). */
  hardFailures: number
  /** Number of warnings (informational only). */
  warnings: number
}

/**
 * Check a consumer repo's basalt integration and print a pass/warn report.
 *
 * Hard failures (exit non-zero):
 *   1. .basalt/manifest.json exists (init was run).
 *
 * Warnings (non-fatal):
 *   2. CLAUDE.md contains the basalt managed block (<!-- basalt:begin marker).
 *   3. All 11 basalt-*.md rule files exist under .claude/rules/.
 *   4. The basalt plugin appears to be installed (best-effort ~/.claude/settings.json check).
 *
 * Returns the exit code: 0 = all good, 1 = one or more hard failures.
 */
export function doctor(cwd: string = process.cwd()): number {
  const result: DoctorResult = { hardFailures: 0, warnings: 0 }
  const lines: string[] = [`\nbasalt doctor — ${cwd}\n`]

  function pass(msg: string): void {
    lines.push(`  ✓ ${msg}`)
  }
  function warn(msg: string): void {
    lines.push(`  ⚠ ${msg}`)
    result.warnings++
  }
  function fail(msg: string): void {
    lines.push(`  ✖ ${msg}`)
    result.hardFailures++
  }

  // ── Hard check 1: manifest exists ──────────────────────────────────────────
  const manifestAbs = resolve(cwd, MANIFEST_PATH)
  if (existsSync(manifestAbs)) {
    pass(`${MANIFEST_PATH} exists`)
  } else {
    fail(`${MANIFEST_PATH} missing — run \`basalt init\` to scaffold the consumer repo`)
  }

  // ── Warn check 2: CLAUDE.md contains the basalt managed block ──────────────
  const claudeMdAbs = resolve(cwd, 'CLAUDE.md')
  const claudeMdContent = readIfExists(claudeMdAbs)
  if (claudeMdContent !== null && claudeMdContent.includes(BLOCK_BEGIN_PREFIX)) {
    pass('CLAUDE.md contains the basalt managed block')
  } else if (claudeMdContent === null) {
    warn('CLAUDE.md not found — run `basalt init` to scaffold the basalt block')
  } else {
    warn(
      `CLAUDE.md does not contain the basalt managed block (expected marker: ${BLOCK_BEGIN_PREFIX}) — run \`basalt sync\``,
    )
  }

  // ── Warn check 3: all 11 rule files exist ──────────────────────────────────
  const missingRules: string[] = []
  for (const name of RULE_NAMES) {
    const ruleAbs = resolve(cwd, `.claude/rules/basalt-${name}.md`)
    if (!existsSync(ruleAbs)) missingRules.push(`basalt-${name}.md`)
  }
  if (missingRules.length === 0) {
    pass(`all ${RULE_NAMES.length} basalt-*.md rule files present under .claude/rules/`)
  } else {
    warn(
      `missing rule files under .claude/rules/: ${missingRules.join(', ')} — run \`basalt sync\` to restore`,
    )
  }

  // ── Warn check 4: basalt plugin appears installed (best-effort) ─────────────
  const settingsPath = resolve(process.env['HOME'] ?? '~', '.claude', 'settings.json')
  try {
    const settingsContent = readIfExists(settingsPath)
    if (settingsContent !== null && settingsContent.includes('basalt')) {
      pass('basalt plugin appears installed in ~/.claude/settings.json')
    } else {
      warn(
        'basalt plugin not detected in ~/.claude/settings.json — install once at user scope:\n' +
          '    claude plugin marketplace add jkrumm/basalt-ui\n' +
          '    claude plugin install basalt@basalt-ui',
      )
    }
  } catch {
    warn('could not read ~/.claude/settings.json — plugin install status unknown')
  }

  // ── Report ──────────────────────────────────────────────────────────────────
  lines.push('')
  if (result.hardFailures === 0 && result.warnings === 0) {
    lines.push('All checks passed.')
  } else {
    if (result.hardFailures > 0)
      lines.push(`${result.hardFailures} hard failure(s), ${result.warnings} warning(s).`)
    else lines.push(`${result.warnings} warning(s).`)
  }
  lines.push('')

  if (result.hardFailures > 0) {
    console.error(lines.join('\n'))
    return 1
  }
  console.log(lines.join('\n'))
  return 0
}

// ──────────────────────────────────────────────────────────────────────────────
// info — SURFACES-derived surface map
// ──────────────────────────────────────────────────────────────────────────────

/** One row in the `basalt info` output — one per published JS subpath export. */
export type InfoSubpath = {
  path: string
  layer: string
  rule: string | null
  skills: readonly string[]
  optionalPeers: string[]
}

/** The stable JSON shape for `basalt info --json`. */
export type InfoOutput = {
  name: string
  version: string
  subpaths: InfoSubpath[]
}

/**
 * Print a human-readable (or JSON) map of the published basalt-ui surface derived from
 * SURFACES + package.json. Every row is live-derived — the subpath list cannot drift.
 *
 * `basalt info`         → human-readable table
 * `basalt info --json`  → stable JSON (InfoOutput shape)
 */
export function info(flags: string[]): number {
  const pkgRoot = packageRoot()

  // Read package.json for name, version, peerDependencies, peerDependenciesMeta, and exports.
  let pkgName = 'basalt-ui'
  let pkgVersion = '0.0.0'
  let peerDeps: Record<string, string> = {}
  let peerMeta: Record<string, { optional?: boolean }> = {}
  let pkgExports: Record<string, unknown> = {}
  try {
    const pkg = JSON.parse(readFileSync(resolve(pkgRoot, 'package.json'), 'utf8')) as {
      name?: string
      version?: string
      peerDependencies?: Record<string, string>
      peerDependenciesMeta?: Record<string, { optional?: boolean }>
      exports?: Record<string, unknown>
    }
    pkgName = pkg.name ?? pkgName
    pkgVersion = pkg.version ?? pkgVersion
    peerDeps = pkg.peerDependencies ?? {}
    peerMeta = pkg.peerDependenciesMeta ?? {}
    pkgExports = pkg.exports ?? {}
  } catch {
    // proceed with defaults
  }

  // Derive optional peer set: all peers marked optional in peerDependenciesMeta.
  const optionalPeerSet = new Set(
    Object.entries(peerMeta)
      .filter(([, m]) => m.optional === true)
      .map(([name]) => name),
  )

  // Build subpath rows from SURFACES — only real JS subpath keys (non-#, non-'./configs/*').
  // Restrict to keys that also appear in package.json exports so we match what is published.
  const publishedExportKeys = new Set(Object.keys(pkgExports))

  const subpaths: InfoSubpath[] = []
  for (const [key, spec] of Object.entries(SURFACES) as [string, SurfaceSpec][]) {
    if (key.startsWith('#')) continue
    if (!publishedExportKeys.has(key)) continue

    const docSpec = spec.kind === 'doctrine' ? spec : null

    // Resolve optional peers from spec.optionalPeers (SURFACES SSOT), with versions from package.json.
    const specPeers: readonly string[] =
      docSpec !== null && 'optionalPeers' in docSpec && Array.isArray(docSpec.optionalPeers)
        ? docSpec.optionalPeers
        : []
    const optionalPeers = specPeers
      .filter((p) => optionalPeerSet.has(p) && p in peerDeps)
      .map((p) => `${p}@${peerDeps[p]}`)

    subpaths.push({
      path: `basalt-ui${key === '.' ? '' : key.slice(1)}`,
      layer: spec.layer,
      rule: docSpec?.rule ?? null,
      skills: docSpec?.skill ?? [],
      optionalPeers,
    })
  }

  const output: InfoOutput = { name: pkgName, version: pkgVersion, subpaths }

  if (flags.includes('--json')) {
    console.log(JSON.stringify(output, null, 2))
    return 0
  }

  // Human-readable output
  console.log(`\nbasalt-ui v${pkgVersion} — published surface\n`)
  const COL = { path: 32, layer: 18, rule: 18, skills: 36 }
  const header = [
    'SUBPATH'.padEnd(COL.path),
    'LAYER'.padEnd(COL.layer),
    'RULE'.padEnd(COL.rule),
    'SKILLS'.padEnd(COL.skills),
    'OPTIONAL PEERS',
  ].join('  ')
  console.log(header)
  console.log('-'.repeat(header.length))
  for (const row of output.subpaths) {
    const line = [
      row.path.padEnd(COL.path),
      row.layer.padEnd(COL.layer),
      (row.rule ?? '—').padEnd(COL.rule),
      (row.skills.join(', ') || '—').padEnd(COL.skills),
      row.optionalPeers.join(', ') || '—',
    ].join('  ')
    console.log(line)
  }
  console.log('')
  return 0
}

/**
 * CLI dispatcher — parses argv (subcommand + flags) and returns the command's exit code. The bin
 * entry is the ONLY caller that translates this to process.exit, so init/sync/checkTheme stay free
 * of process side effects and are safe to import and call from tests.
 */
export function run(argv: string[], cwd: string = process.cwd()): number {
  const [cmd, ...flags] = argv
  switch (cmd) {
    case 'init':
      return init(cwd)
    case 'sync':
      return sync({ force: flags.includes('--force'), check: flags.includes('--check') }, cwd)
    case 'check-theme':
      return checkTheme(cwd)
    case 'check-coverage':
      return checkCoverage(cwd)
    case 'info':
      return info(flags)
    case 'doctor':
      return doctor(cwd)
    default:
      console.error(
        'Usage: basalt <init | sync [--force] [--check] | check-theme | check-coverage | info [--json] | doctor>',
      )
      return 1
  }
}

// Re-export the managed-file manifest for testing / introspection (no default export).
export { managedFiles, MANIFEST_PATH, RULE_NAMES }
export type { ManagedFile, Manifest, SyncOptions, DoctorResult }
