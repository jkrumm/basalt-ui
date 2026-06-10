/**
 * basalt-ui CLI — `init`, `sync`, `check-theme`.
 *
 * `checkTheme` is a REAL Bun-runtime port of argo `scripts/check-theme.mjs`: the theme guard that
 * fails on colors bypassing the central palette.
 *
 * `init` / `sync` scaffold and reconcile the framework's *agentic* surface into a consumer repo:
 * Claude Code rules, a settings stanza, a managed CLAUDE.md block, a DESIGN.md seed, and the
 * toolchain templates (oxfmt / lefthook / CI). Both are sha256-manifest driven for safe,
 * idempotent three-way reconciliation. Dependency-free — Node/Bun built-ins only.
 *
 * Bun runtime only (uses `Bun.Glob`). Config is read from the consuming package.json `"basalt"`
 * key; argo's hardcoded values are the DEFAULTS.
 */
import { Glob } from 'bun'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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
const DEFAULT_SPACING_STEPS = [10, 12, 16, 20, 32]
const DEFAULT_FORBIDDEN_ACCENTS = ['teal', 'violet', 'grape', 'indigo', 'pink']

const SKIP = /\.gen\.ts$|\.test\.[tj]sx?$|\.d\.ts$/
const HEX = /#[0-9a-fA-F]{3,8}\b/g
const FUNC = /\b(?:rgba?|hsla?)\(/g
// localStorage theme read — banned (theme must resolve via the Mantine color scheme + --vx-* vars).
const LOCALSTORAGE_THEME = /localStorage\s*\.\s*getItem\s*\(\s*['"]theme['"]\s*\)/g

type Violation = { rel: string; line: number; token: string; kind: string }

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

function scanFile(
  abs: string,
  rel: string,
  patterns: {
    forbiddenAccent: RegExp
    spacingProp: RegExp
    radiusProp: RegExp
  },
  violations: Violation[],
): void {
  const lines = readFileSync(abs, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (line.includes('theme-allow')) continue
    for (const m of line.matchAll(HEX)) {
      violations.push({ rel, line: i + 1, token: m[0], kind: 'raw-hex' })
    }
    for (const m of line.matchAll(FUNC)) {
      violations.push({ rel, line: i + 1, token: m[0], kind: 'raw-color-fn' })
    }
    for (const m of line.matchAll(LOCALSTORAGE_THEME)) {
      violations.push({ rel, line: i + 1, token: m[0], kind: 'localstorage-theme' })
    }
    for (const m of line.matchAll(patterns.forbiddenAccent)) {
      violations.push({ rel, line: i + 1, token: m[1] ?? '', kind: 'off-identity-accent' })
    }
    for (const m of line.matchAll(patterns.spacingProp)) {
      violations.push({ rel, line: i + 1, token: m[0], kind: 'raw-spacing' })
    }
    for (const m of line.matchAll(patterns.radiusProp)) {
      violations.push({ rel, line: i + 1, token: m[0], kind: 'raw-radius' })
    }
  }
}

/**
 * Theme guard — scans source roots for raw color literals (hex / rgb() / hsl()), off-identity
 * Mantine accent props, raw spacing/radius props that equal a named scale step, and localStorage
 * theme reads. Exits non-zero on violations. A `theme-allow` comment exempts a line.
 */
export function checkTheme(cwd: string = process.cwd()): void {
  const cfg = readBasaltConfig(cwd)
  const roots = cfg.roots ?? DEFAULT_ROOTS
  const exempt = new Set(cfg.exempt ?? DEFAULT_EXEMPT)
  const spacingSteps = cfg.spacingSteps ?? DEFAULT_SPACING_STEPS
  const forbiddenAccents = cfg.forbiddenAccents ?? DEFAULT_FORBIDDEN_ACCENTS

  const patterns = {
    forbiddenAccent: new RegExp(
      `\\b(?:color|c|bg|backgroundColor)\\s*=\\s*\\{?\\s*['"](${forbiddenAccents.join('|')})['"]`,
      'g',
    ),
    spacingProp: new RegExp(
      `\\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap)=\\{(?:${spacingSteps.join('|')})\\}`,
      'g',
    ),
    radiusProp: /\bradius=(?:\{[0-9]+\}|"[0-9]+")/g,
  }

  const violations: Violation[] = []
  for (const root of roots) {
    const glob = new Glob('**/*.{ts,tsx}')
    for (const f of glob.scanSync({ cwd: resolve(cwd, root), absolute: true })) {
      const rel = relative(cwd, f)
      if (SKIP.test(rel) || exempt.has(rel)) continue
      scanFile(f, rel, patterns, violations)
    }
  }

  if (violations.length === 0) {
    console.log('✓ Theme guard: no off-palette colors.')
    process.exit(0)
  }

  const byFile = new Map<string, Violation[]>()
  for (const v of violations) {
    const list = byFile.get(v.rel) ?? []
    list.push(v)
    byFile.set(v.rel, list)
  }
  console.error(`✖ Theme guard: ${violations.length} off-palette / off-identity violation(s)\n`)
  for (const [file, vs] of [...byFile].toSorted()) {
    console.error(file)
    for (const v of vs.toSorted((a, b) => a.line - b.line)) {
      console.error(`  ${String(v.line).padStart(4)}  ${v.kind.padEnd(18)} ${v.token}`)
    }
    console.error('')
  }
  console.error(
    'Fix: route color through VX.* / the Mantine theme; for an off-identity accent use blue/gray or ' +
      'a status hue (red/green/orange/yellow); for raw spacing/radius use the scale token. Add a ' +
      '`theme-allow` comment for a deliberate exception.',
  )
  process.exit(1)
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
 * - `merge` : a JSON stanza shallow-merged into the consumer file (settings.json). init/sync union
 *             the stanza in without clobbering consumer keys; the manifest hashes the *stanza*,
 *             so local edits to other keys never trip drift.
 * - `seed`  : written once if absent, then owned entirely by the consumer. sync never overwrites it
 *             and never reports drift (it is a starting point, not a managed mirror).
 */
type Strategy = 'copy' | 'block' | 'merge' | 'seed'

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

const RULE_NAMES = ['tokens', 'charts', 'mantine', 'router', 'query', 'state'] as const

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

/** Shallow-merge a JSON stanza into a host JSON object; stanza keys take precedence. */
function mergeStanza(hostJson: string | null, stanza: string): string {
  const host = hostJson ? (JSON.parse(hostJson) as Record<string, unknown>) : {}
  const add = JSON.parse(stanza) as Record<string, unknown>
  const merged = { ...host, ...add }
  return `${JSON.stringify(merged, null, 2)}\n`
}

/** The full managed-file manifest. Stable, declarative — the single source of truth for init/sync. */
function managedFiles(): ManagedFile[] {
  const rules: ManagedFile[] = RULE_NAMES.map((name) => ({
    dest: `.claude/rules/basalt-${name}.md`,
    strategy: 'copy',
    source: `agent/rules/basalt-${name}.md`,
    render: (ctx) => readSource(ctx.pkgRoot, `agent/rules/basalt-${name}.md`),
  }))

  const settings: ManagedFile = {
    dest: '.claude/settings.json',
    strategy: 'merge',
    source: 'agent/templates/settings.stanza.json',
    // For merge, render() returns the *stanza* (placeholders resolved) — the hashed/managed unit,
    // not the merged file. The writer merges it into the live consumer file at apply time.
    render: (ctx) => {
      const tpl = readSource(ctx.pkgRoot, 'agent/templates/settings.stanza.json')
      if (tpl === null) return null
      return fillTemplate(tpl, ctx.vars)
    },
  }

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

  return [...rules, settings, claudeBlock, design, oxfmt, lefthook, ci]
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
 * the "current" unit is the existing region (markers included); for `merge` it is the
 * stanza-shaped subset of the live settings file; for `copy`/`seed` it is the whole file.
 */
type UnitState = {
  /** The managed unit's current bytes on disk (block region / stanza-subset / whole file). */
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

/** Canonicalize a JSON string by parse+pretty-reprint so formatting never affects comparison. */
function canonicalJson(text: string): string | null {
  try {
    return JSON.stringify(JSON.parse(text) as unknown, null, 2)
  } catch {
    return null
  }
}

/**
 * The stanza-shaped subset of a live settings file (only the keys the stanza manages), canonically
 * serialized so it is byte-comparable against the canonical desired stanza.
 */
function extractStanzaSubset(host: string | null, stanza: string): string | null {
  if (host === null) return null
  let parsedHost: Record<string, unknown>
  let parsedStanza: Record<string, unknown>
  try {
    parsedHost = JSON.parse(host) as Record<string, unknown>
    parsedStanza = JSON.parse(stanza) as Record<string, unknown>
  } catch {
    return null
  }
  const subset: Record<string, unknown> = {}
  for (const key of Object.keys(parsedStanza)) {
    if (key in parsedHost) subset[key] = parsedHost[key]
  }
  if (Object.keys(subset).length === 0) return null
  return JSON.stringify(subset, null, 2)
}

/** Read the current vs desired managed-unit bytes for a file. */
function unitState(file: ManagedFile, cwd: string, ctx: RenderContext): UnitState {
  const desired = file.render(ctx)
  const destAbs = resolve(cwd, file.dest)
  const onDisk = readIfExists(destAbs)
  if (file.strategy === 'block') {
    return { current: extractBlockRegion(onDisk), desired }
  }
  if (file.strategy === 'merge') {
    // Compare canonical stanza vs canonical stanza-subset so formatting/key-order never trips drift.
    const stanza = desired === null ? null : canonicalJson(desired)
    return {
      current: stanza === null ? null : extractStanzaSubset(onDisk, stanza),
      desired: stanza,
    }
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
  if (file.strategy === 'merge') {
    const host = readIfExists(destAbs)
    writeFileEnsuringDir(destAbs, mergeStanza(host, desired))
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

/** Scaffold all managed files into the consumer repo, then write the manifest. Idempotent. */
export function init(cwd: string = process.cwd()): void {
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
    // `merge` always unions its stanza (both are non-destructive to consumer-owned content).
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
  process.exit(0)
}

type SyncOptions = { force?: boolean; check?: boolean }

/**
 * Reconcile managed files with the shipped versions via a sha256 three-way compare.
 *
 * - `--check` makes NO writes; exits non-zero if any managed file is out-of-date or locally drifted
 *   (a CI freshness gate), exit 0 when all current.
 * - `--force` overwrites locally-drifted files instead of skipping them.
 */
export function sync(opts: SyncOptions = {}, cwd: string = process.cwd()): void {
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
      process.exit(1)
    }
    console.log('✓ basalt sync --check: all managed files current.')
    process.exit(0)
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
  process.exit(0)
}

// Re-export the managed-file manifest for testing / introspection (no default export).
export { managedFiles, MANIFEST_PATH, RULE_NAMES }
export type { ManagedFile, Manifest, SyncOptions }
