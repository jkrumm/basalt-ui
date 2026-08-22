/**
 * basalt-ui CLI — `init`, `sync`, `check-theme`, `check-coverage`.
 *
 * `checkTheme` is a thin FS walker over the headless guard core (`../guard`). It reads the
 * BasaltConfig, builds a GuardConfig, walks the source roots, calls `checkSource` per file,
 * collects Finding[], groups/reports findings, and returns an exit code.
 *
 * `checkCoverage` asserts 8 invariants: guardKinds ⊆ GUARD_RULES, rule files on disk,
 * skill union ⊆ plugin.json, subpath-export-coverage, exports→SURFACES reverse, globs
 * required for non-empty forbiddenImports, headless Mantine-ban completeness, and
 * optionalPeers peerDependencies/peerDependenciesMeta presence.
 *
 * `init` / `sync` scaffold and reconcile the framework's *agentic* surface into a consumer repo:
 * Claude Code rules + skills, a managed CLAUDE.md block, a DESIGN.md seed, and the toolchain
 * seeds (oxlint / oxfmt / lefthook / CI). Both are sha256-manifest driven for safe,
 * idempotent three-way reconciliation. Dependency-free — Node/Bun built-ins only.
 *
 * Runtime-agnostic (Node or Bun) — built-ins only, no `bun`-module import, so the exported API is
 * safe to import under plain Node. Config is read from the consuming package.json `"basalt"` key;
 * argo's hardcoded values are the DEFAULTS.
 */
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  checkSource,
  DEFAULT_GUARD_CONFIG,
  GENERATED_HEADER_LINE,
  guardKindRemedy,
  GUARD_RULES,
  guardWaiverHint,
  TOKENS_ONLY_DISABLED_KINDS,
  unmatchedExemptPatterns,
} from '../guard'
import type { Finding, GuardConfig, GuardKind, GuardSeverity } from '../guard'
import { evaluateGuardHook } from '../guard/guard-hook'
import { RULE_NAMES, SKILL_NAMES, SURFACES, TOKEN_LAYER_BOUNDARY_SURFACES } from '../surfaces'
import type { DoctrineSpec, SurfaceSpec } from '../surfaces'
import { buildPaletteCss, deriveSpacing } from '../tokens'

/** Shape of the optional `"basalt"` key in a consumer's package.json. */
export type BasaltConfig = {
  /** Source roots to scan. Default: `['src']`. Set explicitly for a monorepo layout. */
  roots?: string[]
  /** Files exempt from the scan (they ARE the palette source). Default: argo's exempt set. */
  exempt?: string[]
  /**
   * Declares this package a tokens-only consumer: it uses the `--vx-*` layer and no Mantine. Turns
   * off every guard kind whose remedy is a Mantine component, a Mantine prop or the React theme
   * factory, leaving the color and typography kinds live. Default: `'mantine'`.
   *
   * Deliberately not inferred from a missing `@mantine/core`: silencing 17 rules (the live count is
   * `TOKENS_ONLY_DISABLED_KINDS.size`, which the check-theme banner prints) is a decision, and
   * a repo that keeps Mantine in a workspace package would otherwise switch off half its own guard
   * without saying so. `basalt-ui doctor` detects the shape and tells you to set this.
   */
  profile?: 'mantine' | 'tokens-only'
  /**
   * Extra files to scan, named individually and relative to this package — for a design surface
   * that lives outside every root and outside the `index.html` / `public/` conventions the walker
   * already derives. Also the ONLY way a `.json` is ever scanned: the guard understands JSON as
   * markup, but a consumer repo's JSON is overwhelmingly config, fixtures and lockfiles, so
   * blanket-scanning it is a false-positive generator rather than a guard.
   *
   * @example
   * { include: ['app/manifest.json', 'emails/template.html'] }
   */
  include?: string[]
  /** Named spacing-scale steps (px) flagged when used as a raw spacing prop. Default: 10/12/16/20/32. */
  spacingSteps?: number[]
  /** Per-kind severity override — `'warn'` reports without failing, `'error'` fails the build.
   *  See `GuardSeverity` in ../guard/types for the grace-minor doctrine behind it. */
  severity?: Partial<Record<GuardKind, GuardSeverity>>
  /** Off-identity Mantine accent families forbidden as chrome accents. Default: argo's set. */
  forbiddenAccents?: string[]
  /** Earned accent hue recorded in DESIGN.md `{{ACCENT_HUE}}`. Default: `blue`. */
  accentHue?: string
  /**
   * Flag any numeric radius prop literal (radius={6}) — use the radius token scale instead.
   * Default: `true` (ON). Set `false` to disable the `raw-radius` check (e.g. a repo that DEFINES
   * the radius primitives).
   */
  rawRadius?: boolean
  /**
   * Flag ad-hoc inline surface styling (`border`/`borderRadius`/`boxShadow` literals in a `style={{}}`)
   * that bypasses the radius-token + `VX.surface.*` + `VX.shadowCard` system. Default: `true` (ON).
   * Set `false` to disable the `raw-surface` check.
   */
  rawSurface?: boolean
  /**
   * Flag `withBorder` on a `Card` / `Paper`. Card depth is `--vx-shadow-card` — a whisper shadow
   * with the 1px ring baked into the SAME value — so `withBorder` draws a SECOND, real border over
   * that ring and the card reads heavy/boxed (docs/DESIGN-SPEC.md doctrine inversion #1).
   * `withBorder={false}` and `<Card.Section withBorder>` (a section divider) both pass.
   * Default: `true` (ON). Set `false` to disable the `card-with-border` check.
   */
  cardWithBorder?: boolean
  /**
   * Flag references to a raw Mantine ramp step used for surface color
   * (`var(--mantine-color-gray-N)` / `var(--mantine-color-dark-N)`) — these bypass the basalt
   * surface tokens. Default: `true` (ON). Set `false` to disable the `off-system-surface-var` check.
   */
  offSystemSurfaceVar?: boolean
  /**
   * Flag a SHADE-PINNED Mantine color — `c="yellow.7"`, `bg="blue.4"`,
   * `var(--mantine-color-red-6)`. A pinned step is one fixed swatch in BOTH color schemes, so it
   * cannot stay legible in either; route a verdict color through `VX.status.*` / `--vx-status-*`,
   * or drop the index (`c="red"`) and let the theme resolve the shade per scheme. `gray-*`/`dark-*`
   * in `var()` form belong to `off-system-surface-var` instead. Default: `true` (ON). Set `false`
   * to disable the `mantine-shade-index` check.
   */
  mantineShadeIndex?: boolean
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
  /**
   * Flag a hardcoded duration/spring/ease literal inline in a `transition={{...}}` prop — route it
   * through `MOTION_DURATION` / `MOTION_SPRING` / `MOTION_EASE_STANDARD` instead. Default: `true`
   * (ON). Set `false` to disable the `raw-motion-value` check.
   */
  rawMotionValue?: boolean
  /**
   * Flag a hand-rolled `<ChartLegend items={[...]}>` array literal — legend entries must be
   * derived (e.g. `items={deriveLegend(series)}`), never authored inline. Default: `true` (ON).
   * Set `false` to disable the `unframed-chart` check.
   */
  unframedChart?: boolean
  /**
   * Flag a chart entry-point JSX tag (`MultiLine`/`Bars`/`Donut`/`DualPanel`/`Heatmap`/`ZonedLine`/
   * `StackedArea`/`LineSparkline`/`BarSparkline`) missing an `ariaLabel` prop. Default: `true`
   * (ON). Set `false` to disable the `chart-missing-aria-label` check.
   */
  chartMissingAriaLabel?: boolean
  /**
   * Flag a raw lowercase `<input>`/`<select>`/`<textarea>` JSX element — it bypasses the entire
   * theme, not just the iOS font-size floor. Use the Mantine equivalents (`TextInput`,
   * `NumberInput`, `Select`, `Textarea`, …) instead. Default: `true` (ON). Set `false` to disable
   * the `raw-form-control` check.
   */
  rawFormControl?: boolean
  /**
   * Flag a `fontSize`/`font-size` literal below 16 inside a `style={{…}}` on a raw form control,
   * or a Mantine `styles={{ input: {…} }}` per-part style — the `styles.css` iOS floor is
   * `!important`, so the override is dead code. Default: `true` (ON). Set `false` to disable the
   * `sub-16-input-font` check.
   */
  sub16InputFont?: boolean
  /**
   * Path of the consumer's guard-exempt series file, for DESIGN.md `{{SERIES_MODULE_PATH}}`.
   * Default: `<first basalt.root>/lib/series.ts` — see `resolveSeriesModulePath`.
   */
  seriesModulePath?: string
  /**
   * Per-rule, per-path exemptions — complements whole-file `exempt` (which skips ALL rules for a
   * file) and the hardcoded per-kind `appliesTo` scoping (e.g. `raw-visx-axis` → chart files
   * only). Each value is a list of path-segment patterns matched against a finding's relative
   * path: a pattern matches when the path split on `/` includes it as a WHOLE segment (`'agent'`
   * matches `src/agent/x.tsx` but not `src/agenting.ts`; a trailing `/` is stripped, so `'agent'`
   * and `'agent/'` are equivalent). Default: `{}` (no exemptions).
   *
   * Two forms per kind. The bare array is paths only. The object form adds the REASON, which is
   * the half a `theme-allow` carries and this key could not: JSON has no comments, so a
   * `.webmanifest` / `.json` finding's only escape is this key, and it was un-reviewable by
   * construction — the rationale ended up in a CLAUDE.md paragraph nobody reads next to the diff.
   * `check-theme --audit-allows` prints the reason (or names its absence) beside what the entry
   * still suppresses. The array form stays supported and unchanged; nothing here is required.
   *
   * @example
   * { exemptRules: { 'inline-display': ['agent'] } } // inline-display never fires under src/agent/**
   * @example
   * { exemptRules: { 'raw-hex': { paths: ['site.webmanifest'],
   *   reason: 'a PWA manifest theme_color MUST be a literal hex — JSON cannot reference a CSS var' } } }
   */
  exemptRules?: Partial<Record<GuardKind, ExemptRuleEntry>>
  /**
   * Declares an intentional `ai` package major-version skew across workspace packages, exempting
   * `doctor`'s `ai-major-parity` hard check. The value IS the reason — a bare `true` is rejected,
   * because the whole point of this key is that the pairing is written down, not just switched off.
   * A written declaration is the pin `basalt/ai-sdk-major`'s own comment notes is otherwise missing.
   *
   * Semantics: absent (or present but not a non-empty string) → the skew still hard-fails exactly as
   * without this key. A non-empty string with a skew present → `doctor` passes, echoing both the
   * skew and this reason. A non-empty string with NO skew present → `doctor` warns that the
   * exemption is stale and can be deleted (an exemption nobody re-checks is how a real, later skew
   * slips through unnoticed).
   *
   * @example
   * // apps/api streams on ai@5; apps/dashboard parses on ai@7; a producer-side TransformStream
   * // neutralizes the one enum value that differs between the two majors.
   * { aiMajorSkewReason: 'apps/api pinned to ai@5, apps/dashboard on ai@7 — the skew is neutralized '
   *   + 'by a producer-side TransformStream in apps/api/src/stream-transform.ts' }
   */
  aiMajorSkewReason?: string
}

/**
 * One `basalt.exemptRules` value: the historical bare path list, or the same list with the reason
 * it exists. See `BasaltConfig.exemptRules`.
 */
type ExemptRuleEntry = string[] | { paths: string[]; reason: string }

/** The paths half of an exemption entry, whichever form it was written in. */
function exemptRulePaths(entry: ExemptRuleEntry | undefined): string[] {
  if (entry === undefined) return []
  return Array.isArray(entry) ? entry : entry.paths
}

/** The recorded reason for an exemption entry, or null for the bare-array form. */
function exemptRuleReason(entry: ExemptRuleEntry | undefined): string | null {
  if (entry === undefined || Array.isArray(entry)) return null
  return entry.reason.trim().length > 0 ? entry.reason.trim() : null
}

/**
 * The guard-shaped `exemptRules` — paths only. The reason the object form carries never reaches
 * the guard: it is accountability for a human reading a diff and for `--audit-allows`, and giving
 * the scan a second shape to understand would only be a way for the two to disagree.
 */
function resolveExemptRules(cfg: BasaltConfig): GuardConfig['exemptRules'] {
  if (cfg.exemptRules === undefined) return DEFAULT_GUARD_CONFIG.exemptRules
  const out: Partial<Record<GuardKind, string[]>> = {}
  for (const [kind, entry] of Object.entries(cfg.exemptRules)) {
    out[kind as GuardKind] = exemptRulePaths(entry)
  }
  return out
}

const DEFAULT_ROOT = 'src'
const DEFAULT_ROOTS = [DEFAULT_ROOT]

/**
 * The configured source roots, or the built-in default. The ONE resolution every roots-derived seed
 * reads — an empty `roots: []` falls back rather than resolving to nothing, because a bare `??`
 * would let `[]` through and render an empty oxfmt glob into the seeded CI, reproducing the exact
 * "matches zero files" break this derivation exists to prevent.
 */
function resolveRoots(cfg: BasaltConfig): string[] {
  return cfg.roots?.length ? cfg.roots : DEFAULT_ROOTS
}

/**
 * The one consumer series path — the DESIGN.md template's `{{SERIES_MODULE_PATH}}`, the default
 * scan exemption, and the skills' prose all resolve through this single function.
 *
 * Derived from the FIRST configured root (argo's convention: `<root>/lib/series.ts`), not a fixed
 * `src/lib/series.ts` — a monorepo that correctly sets `roots: ['apps/web/src']` has no top-level
 * `src/`, so a hardcoded default would seed a DESIGN.md pointing at a path that cannot exist and
 * silently exempt nothing. `seriesModulePath` still overrides for a layout that isn't `<root>/lib/`.
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
function defaultExempt(cfg: BasaltConfig): string[] {
  return [resolveSeriesModulePath(cfg)]
}

const SKIP = /\.gen\.ts$|\.test\.[tj]sx?$|\.d\.ts$/
/** Filenames that look like they ARE the palette source, for the check-theme escape-hatch hint. */
const SERIES_MODULE_HINT_RE = /(series|palette)\.tsx?$/i

const SEVERITY_VALUES: readonly string[] = ['warn', 'error']

/**
 * Drop `basalt.severity` entries whose value is not `'warn'` / `'error'`, loudly.
 *
 * This is the one config field where a typo REMOVES enforcement rather than failing: package.json
 * is untyped at runtime, and `"warning"` would stamp findings with a value matching neither the
 * error bucket (which fails the build) nor the warn bucket (which prints them) — the kind would
 * vanish and `check-theme` would exit 0 as if the tree were clean. Dropping the entry falls the
 * kind back to its default, so the failure direction of a typo is "stricter than you meant, and
 * told about it" instead of "silently unguarded".
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

function readBasaltConfig(cwd: string): BasaltConfig {
  try {
    const pkg = JSON.parse(readFileSync(resolve(cwd, 'package.json'), 'utf8')) as {
      basalt?: BasaltConfig
    }
    return sanitizeSeverity(pkg.basalt ?? {})
  } catch {
    return {}
  }
}

/**
 * Extensions the walker collects. `html?`/`webmanifest` close argo's finding that raw hex ships in
 * `index.html`'s `theme-color` and the webmanifest's `theme_color`/`background_color` — the two
 * places whose colors nothing re-derives on a scheme change, and which the scan never reached.
 */
const SCANNABLE_EXT = /\.(?:tsx?|css|html?|webmanifest)$/

/**
 * Recursively collect scannable files under a root, skipping dependency/build dirs. Node+Bun-safe.
 * `checkSource` is already syntax-aware per extension (`guardSyntaxFor`); the walker was the only
 * gap, twice over — `.css` (CSS modules / `styles.css`) and now `.html`/`.webmanifest`.
 *
 * `.json` is deliberately NOT here even though the guard resolves it as markup: a consumer repo is
 * full of JSON that is configuration, fixtures and lockfiles, and blanket-scanning it produces
 * exactly the class of false positive already reported against a `data.json` test fixture. A JSON
 * that IS a design surface (a `manifest.json` rather than a `*.webmanifest`) is reachable by naming
 * it in `basalt.include`.
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
function relativePosix(fromDir: string, toPath: string): string {
  const rel = relative(fromDir, toPath).replace(/\\/g, '/')
  if (rel === '') return '.'
  return rel.startsWith('.') ? rel : `./${rel}`
}

/**
 * Where `basalt-ui` actually resolves from, seen from a consumer directory.
 *
 * Every toolchain seam basalt seeds (`.oxlintrc.json`'s `extends`, `lefthook.yml`'s `extends`, the
 * CI `run:` steps) used to hardcode `./node_modules/basalt-ui` at the repo ROOT. Under bun's
 * isolated linker a library package that declares basalt a peer + devDependency gets
 * `<pkg>/node_modules/basalt-ui` and NOTHING at the root, so all three silently failed to resolve
 * and `bunx` fetched a second, different copy from npm instead. Resolution therefore walks
 * OUTWARD from the consumer dir first, then across the workspace packages — and every caller
 * renders its paths from the answer rather than assuming the root.
 */
type BasaltInstall = {
  /** Absolute path of the resolved `node_modules/basalt-ui` directory, or null when unresolvable. */
  dir: string | null
  /** The resolved copy's own version, or null. */
  version: string | null
  /** How it was found — `null` when unresolved. `'workspace'` is the isolated-linker case. */
  how: 'cwd' | 'ancestor' | 'workspace' | null
}

const UNRESOLVED_INSTALL: BasaltInstall = { dir: null, version: null, how: null }

/** `<dir>/node_modules/basalt-ui` when it holds a readable package.json, else null. */
function basaltInstallAt(dir: string): { dir: string; version: string | null } | null {
  const installDir = resolve(dir, 'node_modules', 'basalt-ui')
  const raw = readIfExists(resolve(installDir, 'package.json'))
  if (raw === null) return null
  try {
    const pkg = JSON.parse(raw) as { version?: string }
    return { dir: installDir, version: pkg.version ?? null }
  } catch {
    return { dir: installDir, version: null }
  }
}

/** Resolve the installed basalt-ui: cwd, then every ancestor, then the workspace packages. */
function findBasaltInstall(cwd: string): BasaltInstall {
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

/** True when `dir` is a basalt-configured project — it carries the manifest or a `basalt` key. */
function hasBasaltProject(dir: string): boolean {
  if (existsSync(resolve(dir, MANIFEST_PATH))) return true
  const raw = readIfExists(resolve(dir, 'package.json'))
  if (raw === null) return false
  try {
    return (JSON.parse(raw) as { basalt?: unknown }).basalt !== undefined
  } catch {
    return false
  }
}

/**
 * Which directory a project-scoped command (`check-theme`, `doctor`) should actually read.
 *
 * The shipped lefthook preset and every `bunx basalt-ui …` in the seeded CI run at the REPO ROOT,
 * while in a monorepo the `basalt` config and the manifest live in a package below it — verified to
 * produce `0 files scanned` and a `manifest missing` failure, i.e. a gate that never gates. Rather
 * than make every consumer hand-write a `--cwd`, a command with no basalt project at its own cwd
 * relocates to the single workspace package that has one, and says so. Two or more candidates is
 * genuinely ambiguous and reported as such; `BASALT_CWD` is the explicit override.
 */
type ProjectResolution = {
  /** The directory to read. Equals the invocation cwd unless a relocation happened. */
  dir: string
  /** The invocation cwd when the command relocated away from it, else null. */
  relocatedFrom: string | null
  /** Candidate project dirs when relocation was impossible because several exist, else null. */
  ambiguous: string[] | null
}

function resolveProjectDir(cwd: string): ProjectResolution {
  const override = process.env['BASALT_CWD']
  if (override !== undefined && override.length > 0) {
    const dir = isAbsolute(override) ? override : resolve(cwd, override)
    return { dir, relocatedFrom: dir === cwd ? null : cwd, ambiguous: null }
  }
  if (hasBasaltProject(cwd)) return { dir: cwd, relocatedFrom: null, ambiguous: null }

  const candidates = collectWorkspacePackages(cwd)
    .packages.filter((pkg) => pkg.dir !== cwd && hasBasaltProject(pkg.dir))
    .map((pkg) => pkg.dir)
  if (candidates.length === 1) {
    return { dir: candidates[0] as string, relocatedFrom: cwd, ambiguous: null }
  }
  if (candidates.length > 1) return { dir: cwd, relocatedFrom: null, ambiguous: candidates }
  return { dir: cwd, relocatedFrom: null, ambiguous: null }
}

/**
 * Which shape of consumer a project-scoped command is looking at.
 *
 * A tokens-only consumer took the `--vx-*` layer and nothing else. Every guard kind whose remedy is
 * a Mantine component or the React theme factory is meaningless there — telling a Mantine-free app
 * to swap its `<select>` for `@mantine/core`'s `Select` is advice it must not take.
 *
 * DECLARED, never inferred, when the answer SILENCES something. The two callers want opposite
 * failure directions and so do not share a default:
 *
 * - `check-theme` (`declaredProfile`) turns 17 kinds OFF, so it moves on an explicit signal only —
 *   `--tokens-only`, or `"basalt": { "profile": "tokens-only" }`. Inferring it from the ABSENCE of
 *   `@mantine/core` would silence the Mantine half of the guard on any repo that keeps its Mantine
 *   dependency in a workspace package rather than the one holding the basalt config, which is
 *   precisely this round's "reports green while enforcing nothing" failure with the guard's own
 *   hand on the switch.
 * - `doctor` ({@link inferredProfile}) only changes which ADVICE it prints, never what it enforces,
 *   so it may infer from absence and then tell the consumer to write the key down.
 */
function declaredProfile(cfg: BasaltConfig, flags: readonly string[]): DoctorProfile {
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
function conflictingProfileFlags(flags: readonly string[]): boolean {
  return flags.includes('--tokens-only') && flags.includes('--framework')
}

/** True when nothing anywhere in the workspace declares Mantine — see {@link inferredProfile}. */
function workspaceHasMantine(cwd: string): boolean {
  if (hasDependency(cwd, '@mantine/core')) return true
  return collectWorkspacePackages(cwd).packages.some((pkg) =>
    hasDependency(pkg.dir, '@mantine/core'),
  )
}

/**
 * `doctor`'s profile: the declaration if there is one, else inferred from no scaffold manifest and
 * no `@mantine/core` anywhere in the workspace. Advice only — see {@link declaredProfile}.
 */
function inferredProfile(cwd: string, cfg: BasaltConfig, flags: readonly string[]): DoctorProfile {
  if (
    flags.includes('--tokens-only') ||
    flags.includes('--framework') ||
    cfg.profile !== undefined
  ) {
    return declaredProfile(cfg, flags)
  }
  return !existsSync(resolve(cwd, MANIFEST_PATH)) && !workspaceHasMantine(cwd)
    ? 'tokens-only'
    : 'framework'
}

/**
 * The relative paths `check-theme` would actually scan for a given config — the ONE place the walk
 * + `SKIP` + `exempt` filtering lives, so `doctor`'s "the guard sees zero files" check can never
 * disagree with what `check-theme` does.
 */
function scannableFiles(cwd: string, cfg: BasaltConfig): string[] {
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
 * The app-shell files that sit BESIDE a source root rather than inside it — `index.html` and
 * anything under `public/`.
 *
 * Widening the walker's extension filter alone would still have missed every one of them: argo
 * configures `roots: ['apps/dashboard/src']`, while the raw hex lives in `apps/dashboard/index.html`
 * and `apps/dashboard/public/site.webmanifest`. Both locations are the Vite convention basalt's own
 * `basaltViteConfig`/`basaltAppPlugin` assume, so deriving them from each root's parent needs no
 * config and holds for a monorepo package the same way it holds at a repo root. Nothing else in the
 * parent is walked — a sibling `docs/` full of throwaway HTML stays unscanned.
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
 * Theme guard — thin FS walker over the headless `../guard` core. Reads BasaltConfig, builds a
 * GuardConfig, walks roots, calls checkSource per file, collects Finding[], groups/reports, returns
 * 0 (clean) / 1 (violations). A `theme-allow` comment exempts a line.
 *
 * Runs against `resolveProjectDir(cwd)`, not `cwd` — see that type's doc for why a root-invoked
 * hook or CI step has to find the package the config lives in rather than scan nothing and pass.
 */
export function checkTheme(
  invocationCwd: string = process.cwd(),
  flags: readonly string[] = [],
): number {
  if (conflictingProfileFlags(flags)) {
    console.error(
      'basalt-ui check-theme: --tokens-only and --framework are alternatives — pass one.',
    )
    return 1
  }
  const project = resolveProjectDir(invocationCwd)
  if (project.ambiguous !== null) {
    console.error(
      `✖ basalt-ui check-theme: no basalt config at ${invocationCwd}, and ${project.ambiguous.length} ` +
        `workspace packages carry one (${project.ambiguous.map((d) => relativePosix(invocationCwd, d)).join(', ')}) — ` +
        'run it from one of them, or set BASALT_CWD to pick.',
    )
    return 1
  }
  const cwd = project.dir
  if (project.relocatedFrom !== null) {
    console.log(
      `basalt-ui check-theme: no basalt config at ${project.relocatedFrom} — running in ` +
        `${relativePosix(project.relocatedFrom, cwd)}, where it lives.`,
    )
  }
  const cfg = readBasaltConfig(cwd)
  const roots = resolveRoots(cfg)
  const profile = declaredProfile(cfg, flags)
  if (profile === 'tokens-only') {
    console.log(
      'basalt-ui check-theme: tokens-only profile — ' +
        `${TOKENS_ONLY_DISABLED_KINDS.size} Mantine-coupled kinds are off; the color and typography ` +
        'kinds still apply. Pass --framework to force the full set.',
    )
  }

  const guardCfg: GuardConfig = {
    spacingSteps: cfg.spacingSteps ?? DEFAULT_GUARD_CONFIG.spacingSteps,
    rawRadius: cfg.rawRadius ?? DEFAULT_GUARD_CONFIG.rawRadius,
    forbiddenAccents: cfg.forbiddenAccents ?? DEFAULT_GUARD_CONFIG.forbiddenAccents,
    mantineShadeIndex: cfg.mantineShadeIndex ?? DEFAULT_GUARD_CONFIG.mantineShadeIndex,
    rawSurface: cfg.rawSurface ?? DEFAULT_GUARD_CONFIG.rawSurface,
    cardWithBorder: cfg.cardWithBorder ?? DEFAULT_GUARD_CONFIG.cardWithBorder,
    offSystemSurfaceVar: cfg.offSystemSurfaceVar ?? DEFAULT_GUARD_CONFIG.offSystemSurfaceVar,
    rawHtmlLayout: cfg.rawHtmlLayout ?? DEFAULT_GUARD_CONFIG.rawHtmlLayout,
    inlineSpacing: cfg.inlineSpacing ?? DEFAULT_GUARD_CONFIG.inlineSpacing,
    inlineDisplay: cfg.inlineDisplay ?? DEFAULT_GUARD_CONFIG.inlineDisplay,
    rawVisxAxis: cfg.rawVisxAxis ?? DEFAULT_GUARD_CONFIG.rawVisxAxis,
    rawMotionValue: cfg.rawMotionValue ?? DEFAULT_GUARD_CONFIG.rawMotionValue,
    unframedChart: cfg.unframedChart ?? DEFAULT_GUARD_CONFIG.unframedChart,
    chartMissingAriaLabel: cfg.chartMissingAriaLabel ?? DEFAULT_GUARD_CONFIG.chartMissingAriaLabel,
    rawFormControl: cfg.rawFormControl ?? DEFAULT_GUARD_CONFIG.rawFormControl,
    sub16InputFont: cfg.sub16InputFont ?? DEFAULT_GUARD_CONFIG.sub16InputFont,
    allowComment: 'theme-allow',
    exemptRules: resolveExemptRules(cfg),
    severity: cfg.severity ?? DEFAULT_GUARD_CONFIG.severity,
    ...(profile === 'tokens-only' ? { profile: 'tokens-only' as const } : {}),
  }

  const findings: Finding[] = []
  const scanned = scannableFiles(cwd, cfg)
  for (const rel of scanned) {
    findings.push(...checkSource(readFileSync(resolve(cwd, rel), 'utf8'), rel, guardCfg))
  }

  if (scanned.length === 0) {
    // A configured-but-wrong root is never intentional, and silently scanning 0 files under the
    // built-in defaults (argo's pre-migration layout) is the same failure mode for every other
    // consumer — both cases fail loud instead of warn-plus-green.
    if (cfg.roots === undefined) {
      console.error(
        `✖ basalt-ui check-theme: 0 files scanned — no "basalt.roots" configured in package.json, and ` +
          `the built-in default roots (${DEFAULT_ROOTS.join(', ')}) matched zero files. ` +
          'Set "basalt": { "roots": [...] } in package.json to point at your source directories.',
      )
    } else {
      console.error(
        `✖ basalt-ui check-theme: 0 files scanned — the configured "basalt.roots" (${roots.join(', ')}) ` +
          'matched zero files. Check the paths in "basalt.roots" in package.json.',
      )
    }
    return 1
  }

  // The audit is a REPORT over the same scan, not a second scan with different rules — it runs
  // after the 0-files gate so "every waiver is dead" can never mean "nothing was read".
  if (flags.includes('--audit-allows')) return auditAllows(cwd, cfg, guardCfg, scanned)

  // An exemption that matched nothing is reported, never silently honoured. A WARNING rather than a
  // failure: the entry enforced exactly nothing before this line existed, so failing on it would
  // break a green build at upgrade time over config that was already inert — `--audit-allows` is
  // the lane that exits non-zero on a dead waiver, for a consumer who opts into that gate.
  for (const unmatched of unmatchedExemptPatterns(guardCfg, scanned)) {
    console.error(
      `⚠ basalt-ui check-theme: "basalt.exemptRules" entry ${unmatched.kind}: ` +
        `"${unmatched.pattern}" ` +
        (unmatched.reason === 'unknown-kind'
          ? 'names no guard kind — it exempts nothing at all (a typo, or a kind that was renamed).'
          : 'matched none of the scanned files — it suppresses nothing, and reads as coverage in a ' +
            'config review while enforcing as much as an empty object.'),
    )
  }

  if (findings.length === 0) {
    console.log('✓ Theme guard: no off-palette colors.')
    return 0
  }

  // Errors and warnings are reported as two separate blocks, not one list with a column: a
  // consumer scanning the output needs "what breaks my build" answered before "what will later".
  const errors = findings.filter((f) => f.severity === 'error')
  const warnings = findings.filter((f) => f.severity === 'warn')

  const report = (group: Finding[], heading: string): void => {
    const byFile = new Map<string, Finding[]>()
    for (const f of group) {
      const list = byFile.get(f.relPath) ?? []
      list.push(f)
      byFile.set(f.relPath, list)
    }
    console.error(heading)
    for (const [file, vs] of [...byFile].toSorted()) {
      console.error(file)
      for (const v of vs.toSorted((a, b) => a.line - b.line)) {
        console.error(`  ${String(v.line).padStart(4)}  ${v.kind.padEnd(22)} ${v.text}`)
      }
      console.error('')
    }
  }

  if (warnings.length > 0) {
    report(
      warnings,
      // Deliberately neutral about WHY a kind is a warning. Two origins reach this block — a kind
      // in its grace minor, and a consumer's own `basalt.severity` override — and the finding
      // doesn't carry which. Promising promotion next minor would be wrong for the second.
      `⚠ Theme guard: ${warnings.length} warning(s) — reported, not fatal. A kind warns while it ` +
        'is in its grace minor, or because `basalt.severity` turned it down; fix on your own ' +
        'schedule.\n',
    )
  }
  if (errors.length > 0) {
    report(errors, `✖ Theme guard: ${errors.length} off-palette / off-identity violation(s)\n`)
  }

  // Remedies come from the guard's own rule registry, never from a copy kept here: the local table
  // this replaced had no entry for any of the five kinds 1.20.0 added, so exactly the new findings
  // — the ones whose whole argument is "this looks correct and is not" — printed no argument.
  const presentKinds = [...new Set(findings.map((f) => f.kind))].toSorted()
  // And the closer is per FILE CLASS: prescribing a `theme-allow` comment to a .webmanifest (which
  // has no comment syntax) is what pushed two consumers into a blanket exemption instead.
  const waiverHints = [...new Set(findings.map((f) => guardWaiverHint(f.relPath)))].toSorted()
  console.error(['Fix:', ...presentKinds.map(guardKindRemedy), ...waiverHints].join(' '))

  // A violation in a file that looks like the palette source itself is likely intentional — point
  // at the exempt escape hatch instead of leaving the author to search for it.
  if (findings.some((f) => SERIES_MODULE_HINT_RE.test(f.relPath))) {
    console.error(
      'Hint: if a flagged file IS your palette/series source, exempt it via ' +
        '"basalt": { "exempt": ["<path>"] } in package.json.',
    )
  }
  // Warnings alone pass. That is the whole point of the grace minor: a consumer takes the upgrade
  // on a green build and schedules the fix, instead of the release scheduling it for them.
  return errors.length > 0 ? 1 : 0
}

// ── check-theme --audit-allows — every waiver, and whether it still suppresses anything ─────────

/** The token an audit probe substitutes for `theme-allow`. Contains no substring of it, on purpose. */
const AUDIT_NEUTRALIZED_TOKEN = 'basalt-audit-neutralized'

/** `relPath:line:kind` — a finding's identity for set arithmetic across two runs of the same file. */
function findingKey(f: Finding): string {
  return `${f.relPath}:${f.line}:${f.kind}`
}

/**
 * Everything allowed between a comment opener (or the start of the line) and the token, for it to
 * be an ANNOTATION rather than prose mentioning one.
 *
 * Mirrors the guard's `ANNOTATION_PREFIX`, which is module-private. It decides only which lines
 * this REPORT lists — what each one suppresses is answered by re-running `checkSource`, so the two
 * cannot disagree about enforcement, only about whether a doc sentence gets a line in the audit.
 * Worth an export from the guard if it ever gains a third caller.
 */
const AUDIT_ANNOTATION_PREFIX = /(?:^|\/\/|\/\*|<!--|^\s*\*)\s*$/

/**
 * The rule ids an annotation NAMES, as written. Classification only — what it actually waives is
 * decided by re-running the guard.
 *
 * It exists for one distinction the behavioural probe cannot make: an annotation scoped to an
 * oxlint PLUGIN rule (`hand-rolled-plot`, `raw-scroll-container`, …) suppresses nothing `checkSource`
 * can see, because those rules live in the plugin. Calling it dead would tell someone to delete a
 * live waiver — the exact failure this command exists to prevent, pointed the other way.
 */
function annotationRuleIds(rest: string): string[] {
  const head = (rest.replace(/^-file\b/, '').split(/—|–|:|\s-\s/)[0] ?? '').trim()
  return head
    .split(',')
    .map((word) => word.trim().replace(/^basalt\//, ''))
    .filter((word) => /^[a-z][a-z0-9-]*$/.test(word))
}

/** True when the token on this line opens an annotation — comment form, or the JSON member form. */
function isAllowAnnotationLine(line: string, token: string): boolean {
  const at = line.indexOf(token)
  if (at === -1) return false
  if (line.includes(`"basalt:${token}`)) return true
  return AUDIT_ANNOTATION_PREFIX.test(line.slice(0, at))
}

/**
 * `check-theme --audit-allows` — list every active waiver and prove, per waiver, whether it still
 * suppresses anything.
 *
 * The accountability release shipped `theme-allow-unscoped`, which reports a waiver that names no
 * rule — but a waiver that is perfectly well written and covers a finding that no longer exists is
 * invisible to it, and to everything else. Two consumers found five of those by hand, by editing
 * the token out and re-running the guard. This is that method, automated: for each annotation the
 * file is re-checked with THAT occurrence neutralized, and the findings that appear are exactly
 * what it suppresses. Nothing is inferred from the annotation's text, so the audit cannot disagree
 * with the scan — it IS the scan, run twice.
 *
 * `basalt.exemptRules` entries are audited the same way, one pattern at a time. That also answers
 * the question the key could never answer for itself: a pattern that matches no scanned file (a
 * real relative path, say, where the matcher takes whole path SEGMENTS) suppresses nothing and is
 * reported as dead rather than passing silently.
 *
 * Exit 1 when anything is dead, so it can be wired into CI as a gate. A waiver nobody re-checks is
 * how a rule quietly stops applying to the file that needed the exception most.
 */
function auditAllows(
  cwd: string,
  cfg: BasaltConfig,
  guardCfg: GuardConfig,
  scanned: string[],
): number {
  const token = guardCfg.allowComment
  const lines: string[] = [`\nbasalt-ui check-theme --audit-allows — ${cwd}\n`]
  let dead = 0
  let live = 0
  let outOfReach = 0
  let unaccountable = 0

  // ── theme-allow annotations ─────────────────────────────────────────────────
  const waiverLines: string[] = []
  const sources = new Map<string, string>()
  for (const rel of scanned) sources.set(rel, readFileSync(resolve(cwd, rel), 'utf8'))

  for (const rel of scanned) {
    const text = sources.get(rel) ?? ''
    if (!text.includes(token)) continue
    const baseline = checkSource(text, rel, guardCfg)
    const baselineKeys = new Set(
      baseline.filter((f) => f.kind !== 'theme-allow-unscoped').map(findingKey),
    )
    const unscopedAt = new Map(
      baseline.filter((f) => f.kind === 'theme-allow-unscoped').map((f) => [f.line, f.token]),
    )
    const fileLines = text.split('\n')
    for (const [index, line] of fileLines.entries()) {
      if (!isAllowAnnotationLine(line ?? '', token)) continue
      const probe = [...fileLines]
      probe[index] = (line ?? '').replaceAll(token, AUDIT_NEUTRALIZED_TOKEN)
      const revealed = checkSource(probe.join('\n'), rel, guardCfg)
        .filter((f) => f.kind !== 'theme-allow-unscoped' && !baselineKeys.has(findingKey(f)))
        .map((f) => `${f.kind}@${f.line}`)
      const note = unscopedAt.get(index + 1)
      if (note !== undefined) unaccountable++
      const site = `  ${rel}:${index + 1}`.padEnd(52)
      const suffix = note === undefined ? '' : ` [${note}]`
      const ids = annotationRuleIds((line ?? '').slice((line ?? '').indexOf(token) + token.length))
      if (revealed.length > 0) {
        live++
        waiverLines.push(`${site} suppresses ${[...new Set(revealed)].join(', ')}${suffix}`)
      } else if (ids.length > 0 && !ids.some((id) => Object.hasOwn(GUARD_RULES, id))) {
        outOfReach++
        waiverLines.push(
          `${site} scoped to ${ids.join(', ')} — not a check-theme kind, so this audit cannot ` +
            `judge it (an oxlint plugin rule, or a typo theme-allow-unscoped would report)${suffix}`,
        )
      } else {
        dead++
        waiverLines.push(`${site} SUPPRESSES NOTHING — dead, delete it${suffix}`)
      }
    }
  }

  lines.push(`${token} annotations (${waiverLines.length}):`)
  lines.push(...(waiverLines.length === 0 ? ['  (none)'] : waiverLines))

  // ── basalt.exemptRules entries ──────────────────────────────────────────────
  const exemptLines: string[] = []
  let exemptCount = 0
  const declared = Object.entries(cfg.exemptRules ?? {}) as [GuardKind, ExemptRuleEntry][]
  if (declared.length > 0) {
    const baselineKeys = new Set<string>()
    for (const rel of scanned) {
      for (const f of checkSource(sources.get(rel) ?? '', rel, guardCfg))
        baselineKeys.add(findingKey(f))
    }
    for (const [kind, entry] of declared) {
      const reason = exemptRuleReason(entry)
      for (const pattern of exemptRulePaths(entry)) {
        exemptCount++
        const probeCfg: GuardConfig = {
          ...guardCfg,
          exemptRules: {
            ...guardCfg.exemptRules,
            [kind]: exemptRulePaths(entry).filter((p) => p !== pattern),
          },
        }
        const revealed = new Set<string>()
        for (const rel of scanned) {
          for (const f of checkSource(sources.get(rel) ?? '', rel, probeCfg)) {
            if (!baselineKeys.has(findingKey(f))) revealed.add(f.relPath)
          }
        }
        const site = `  ${kind}: "${pattern}"`.padEnd(52)
        const why = reason === null ? ' [no reason recorded]' : ` — ${reason}`
        if (revealed.size === 0) {
          dead++
          const unmatched = unmatchedExemptPatterns(guardCfg, scanned).find(
            (u) => u.kind === kind && u.pattern === pattern,
          )
          exemptLines.push(
            `${site} SUPPRESSES NOTHING — ` +
              (unmatched === undefined
                ? 'the files it matches have no such finding; delete it'
                : unmatched.reason === 'unknown-kind'
                  ? 'it names no guard kind (a typo, or a renamed kind)'
                  : 'it matches no scanned file at all') +
              why,
          )
        } else {
          live++
          exemptLines.push(
            `${site} suppresses findings in ${[...revealed].toSorted().join(', ')}${why}`,
          )
        }
      }
    }
  }
  lines.push(`\nbasalt.exemptRules entries (${exemptCount}):`)
  lines.push(...(exemptLines.length === 0 ? ['  (none)'] : exemptLines))

  lines.push(
    `\n${live} live, ${dead} dead, ${outOfReach} outside check-theme's reach, ${unaccountable} ` +
      'unaccountable (reported as theme-allow-unscoped by a normal run).',
  )
  if (dead > 0) {
    lines.push(
      'A dead waiver is not harmless: it is an exception nobody re-checked, and it will silently ' +
        'cover the next real finding on that line.',
    )
  }
  console.log(lines.join('\n'))
  return dead > 0 ? 1 : 0
}

// ──────────────────────────────────────────────────────────────────────────────
// init / sync — managed-files engine
// ──────────────────────────────────────────────────────────────────────────────

/**
 * How a file the framework writes into a consumer repo is owned. Two modes, one question:
 * **does Claude read this file?**
 *
 * - `managed` : basalt owns it. sync refreshes it to the shipped version; a local edit is skipped
 *               and reported (`--force` overwrites); `--check` exits 1 on drift. Applies to exactly
 *               what Claude reads (.claude/rules/*, .claude/skills/*, the CLAUDE.md block) —
 *               Claude Code cannot load rules or skills from node_modules, and that platform limit
 *               is the only reason anything is copied at all. The sync diff is the review gate.
 * - `seed`    : written once if absent, then owned entirely by the consumer. sync never overwrites
 *               it and never reports drift (a starting point, not a managed mirror). Everything a
 *               machine reads is a seed, and a good seed's content is a REFERENCE (`extends` into
 *               node_modules/basalt-ui/configs/*), not a copy, so the toolchain auto-updates with
 *               the package while the consumer still owns the file.
 *
 * A managed file with `markers: true` is spliced as a `<!-- basalt:begin -->…<!-- basalt:end -->`
 * region inside a host file the consumer otherwise owns (CLAUDE.md) — not a third mode, just
 * managed ownership scoped to a region.
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
  /** The consumer's configured roots as space-separated quoted oxfmt globs, e.g. `'apps/web/src/**'`. */
  ROOTS_GLOBS: string
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
  const install = findBasaltInstall(cwd)
  const binDir = install.dir === null ? null : resolve(install.dir, '..', '.bin')
  return {
    APP_NAME: readPackageName(cwd),
    BASALT_VERSION: readFrameworkVersion(pkgRoot),
    ACCENT_HUE: cfg.accentHue ?? 'blue',
    SERIES_MODULE_PATH: resolveSeriesModulePath(cfg),
    ROOTS_GLOBS: resolveRoots(cfg).map(toRootGlob).join(' '),
    OXLINT_PRESET_PATH: shippedAssetPath(install, cwd, 'configs/oxlint.json'),
    LEFTHOOK_PRESET_PATH: shippedAssetPath(install, cwd, 'configs/lefthook.yml'),
    BASALT_BIN:
      binDir === null
        ? 'bunx basalt-ui'
        : `${relativePosix(cwd, binDir).replace(/^\.\//, '')}/basalt-ui`,
  }
}

/** Substitute every `{{KEY}}` placeholder from the variable map; unknown keys are left verbatim. */
function fillTemplate(tpl: string, vars: TemplateVars): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (m, key: string) => {
    const v = (vars as Record<string, string>)[key]
    return v ?? m
  })
}

/**
 * The character span of the managed `basalt:begin … basalt:end` region, or null if absent.
 * Duplicate begin markers are an error, loudly — silently picking one region would splice into the
 * wrong place and leave the other stale forever.
 */
function findBlockRegion(host: string): { start: number; end: number } | null {
  const start = host.indexOf(BLOCK_BEGIN_PREFIX)
  if (start === -1) return null
  const duplicate = host.indexOf(BLOCK_BEGIN_PREFIX, start + BLOCK_BEGIN_PREFIX.length)
  if (duplicate !== -1) {
    throw new Error(
      `duplicate \`${BLOCK_BEGIN_PREFIX}\` markers found in the host file — remove the stale ` +
        'basalt block by hand, then re-run.',
    )
  }
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

/**
 * Explicit `--with-router` / `--with-query` CLI flags force-include a router/query scaffold even
 * when the peer isn't detected in the consumer's package.json yet (e.g. it's about to be added).
 */
type ScaffoldFlags = {
  withRouter?: boolean
  withQuery?: boolean
  /** `--merge-lint`: splice the shipped preset's `extends` into an `.oxlintrc.json` init would keep. */
  mergeLint?: boolean
}

/** Router/query peer presence, resolved from detection + explicit flags. */
type PeerFlags = { hasRouter: boolean; hasQuery: boolean }

/** True when `pkgName` appears in the consumer's dependencies, devDependencies, or peerDependencies. */
function hasDependency(cwd: string, pkgName: string): boolean {
  try {
    const pkg = JSON.parse(readFileSync(resolve(cwd, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
    }
    return Boolean(
      pkg.dependencies?.[pkgName] ??
      pkg.devDependencies?.[pkgName] ??
      pkg.peerDependencies?.[pkgName],
    )
  } catch {
    return false
  }
}

/**
 * Resolves whether the consumer has the optional TanStack router/query peers — auto-detected from
 * package.json, or forced via `--with-router` / `--with-query`. Both `basalt-ui init` (for gating
 * which seed scaffolds to write) and `basalt-ui sync` (so it doesn't silently re-seed a scaffold whose
 * peer was never installed) call this once, up front.
 */
function resolvePeerFlags(cwd: string, flags: ScaffoldFlags): PeerFlags {
  return {
    hasRouter: flags.withRouter === true || hasDependency(cwd, '@tanstack/react-router'),
    hasQuery: flags.withQuery === true || hasDependency(cwd, '@tanstack/react-query'),
  }
}

/**
 * Where the seed engine is running relative to the consumer's git repo — decides which
 * repo-root-shaped seeds are safe to write. `init`/`sync` compute it once per run via
 * `resolvePlacement` and print the matching skip notices themselves; `managedFiles` only reads it.
 */
type PlacementFlags = {
  /** True when the package directory IS the detected repo root, or no `.git` exists anywhere above
   *  it (a consumer not using git keeps today's behaviour exactly). False means the package lives
   *  in a subdirectory of the repo (a monorepo's `web/`, say) — lefthook and GitHub Actions both
   *  only read config at the repo root, so seeding either one there is worse than not seeding at
   *  all. */
  isPackageRepoRoot: boolean
  /** Absolute path of the detected repo root. Meaningful only when `isPackageRepoRoot` is false —
   *  otherwise it equals the package dir and is never read. */
  repoRoot: string
  /** Absolute path of a `query-client.ts` already present elsewhere under the package's `src/` (the
   *  consumer relocated it — e.g. to `src/lib/query-client.ts`), or null. The seed's OWN
   *  destination is deliberately excluded here — that exact-path case is handled by the ordinary
   *  skip-if-exists logic every seed file already goes through, unchanged. */
  relocatedQueryClient: string | null
}

/** The default placement — today's single-package-at-repo-root behaviour, unconditionally. */
const ROOT_PLACEMENT: PlacementFlags = {
  isPackageRepoRoot: true,
  repoRoot: '',
  relocatedQueryClient: null,
}

/**
 * Walks up from `dir` looking for a `.git` entry — ordinarily a directory, but a git worktree or
 * submodule points it at a FILE instead, and both still mean "this directory is the repo root".
 * Stops at the filesystem root. Returns `dir` itself when no `.git` is found anywhere, so a
 * consumer not using git falls back to today's behaviour exactly.
 */
function findRepoRoot(dir: string): string {
  let current = dir
  for (;;) {
    if (existsSync(resolve(current, '.git'))) return current
    const parent = dirname(current)
    if (parent === current) return dir
    current = parent
  }
}

/**
 * First path under `dir` (recursive) whose basename is `filename`, or null. Skips dependency/build
 * dirs, mirroring `walkSourceFiles`'s scoping.
 */
function findFileNamed(dir: string, filename: string): string | null {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return null
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
    if (isDir) {
      const found = findFileNamed(abs, filename)
      if (found !== null) return found
    } else if (name === filename) {
      return abs
    }
  }
  return null
}

/**
 * Absolute path of a `query-client.ts` living elsewhere under the package's `src/`, or null. The
 * seed's own destination is excluded — reseeding on top of a RELOCATED client (the failure this
 * exists to prevent) is a different case from the seed's own path already being occupied, which the
 * ordinary skip-if-exists logic handles unchanged.
 */
function findRelocatedQueryClient(cwd: string): string | null {
  const seedAbs = resolve(cwd, 'src/query-client.ts')
  const found = findFileNamed(resolve(cwd, 'src'), 'query-client.ts')
  return found !== null && found !== seedAbs ? found : null
}

/** Resolve a run's placement flags once, from the consumer cwd. */
function resolvePlacement(cwd: string): PlacementFlags {
  const repoRoot = findRepoRoot(cwd)
  return {
    isPackageRepoRoot: repoRoot === cwd,
    repoRoot,
    relocatedQueryClient: findRelocatedQueryClient(cwd),
  }
}

/** The full managed-file manifest. Stable, declarative — the single source of truth for init/sync. */
function managedFiles(peers: PeerFlags, placement: PlacementFlags = ROOT_PLACEMENT): ManagedFile[] {
  // ── managed: exactly what Claude reads ──────────────────────────────────────
  const rules: ManagedFile[] = RULE_NAMES.map((name) => ({
    dest: `.claude/rules/basalt-${name}.md`,
    mode: 'managed' as const,
    source: `agent/rules/basalt-${name}.md`,
    render: (ctx: RenderContext) => readSource(ctx.pkgRoot, `agent/rules/basalt-${name}.md`),
  }))

  // Skills take the same managed path the rules do — Claude Code cannot load skills from
  // node_modules, and a plugin cannot ship rules, so init/sync is the one delivery channel for the
  // whole agentic layer. The `basalt-` filename prefix keeps the /basalt-design ergonomics.
  const skills: ManagedFile[] = SKILL_NAMES.map((name) => ({
    dest: `.claude/skills/${name}/SKILL.md`,
    mode: 'managed' as const,
    source: `agent/skills/${name}/SKILL.md`,
    render: (ctx: RenderContext) => readSource(ctx.pkgRoot, `agent/skills/${name}/SKILL.md`),
  }))

  const claudeBlock: ManagedFile = {
    dest: 'CLAUDE.md',
    mode: 'managed',
    markers: true,
    source: 'agent/templates/CLAUDE-block.md.tpl',
    // With markers, render() returns the fully-rendered region INCLUDING its begin/end markers.
    // The writer splices it into the consumer's host CLAUDE.md at apply time.
    render: (ctx) => {
      const tpl = readSource(ctx.pkgRoot, 'agent/templates/CLAUDE-block.md.tpl')
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

  // Scaffold destination is `.oxfmtrc.json` — oxfmt auto-discovers that filename, not `oxfmt.json`
  // (the pre-rename scaffold; see migrateLegacyOxfmt for the one-time cleanup of the old dest).
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
    source: 'configs/oxlint.json',
    render: (ctx) => `{\n  "extends": ["${ctx.vars.OXLINT_PRESET_PATH}"]\n}\n`,
  }

  // ── Seed scaffolds: written by init, never overwritten by sync ─────────────
  // These are starting-point files owned entirely by the consumer after first write.

  /** TanStack Query client bootstrap (seed — consumer-owned after init). */
  const queryClient: ManagedFile = {
    dest: 'src/query-client.ts',
    mode: 'seed',
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
    mode: 'seed',
    source: 'agent/templates/__root.tpl',
    render: (ctx) => {
      const tpl = readSource(ctx.pkgRoot, 'agent/templates/__root.tpl')
      if (tpl === null) return null
      return fillTemplate(tpl, ctx.vars)
    },
  }

  // `query-client.ts` only needs @tanstack/react-query; `__root.tsx` imports BOTH
  // @tanstack/react-router (createRootRouteWithContext) and @tanstack/react-query (the QueryClient
  // type) — both are documented optional peers, so seeding either scaffold without its peer(s)
  // installed would ship a file with an unresolved import.
  const scaffolds: ManagedFile[] = []
  if (peers.hasQuery && placement.relocatedQueryClient === null) scaffolds.push(queryClient)
  if (peers.hasRouter && peers.hasQuery) scaffolds.push(rootRoute)

  // lefthook.yml / .github/workflows/check.yml are repo-root-shaped: lefthook and GitHub Actions
  // only ever read config at the repo root, so a package living in a subdirectory (a monorepo's
  // `web/`) skips both rather than relocating them — the repo root very often already has its own
  // lefthook/CI config, and writing over or beside it is worse than not writing at all.
  const rootTooling: ManagedFile[] = placement.isPackageRepoRoot ? [lefthook, ci] : []

  return [...rules, ...skills, claudeBlock, design, oxfmt, ...rootTooling, oxlintrc, ...scaffolds]
}

type Manifest = {
  version: 1
  /** The basalt-ui version that last wrote this manifest — `doctor`'s one reconciliation axis. */
  basaltVersion?: string
  /** dest path → sha256 of the managed unit (file bytes, block body, or stanza) at last write. */
  files: Record<string, string>
  /**
   * The resolved level-0 spacing scale (`xs`..`xl`, px) at last write — `doctor`'s second
   * reconciliation axis, and the only one that reports a change in RENDERED OUTPUT rather than in
   * placed files.
   *
   * A retune of the spacing bases moves every surface in every consumer calling
   * `createBasaltTheme()` bare. basalt-ui bans majors by design, so the changelog is the only
   * channel that carries that, and a one-line `feat:` subject cannot convey blast radius: the
   * 1.2.0 retune shipped as "tighten the sidebar, open up components" and went unverified in
   * production for a day because nothing said "every padding moved". Recording the scale makes the
   * move mechanically visible on the next `doctor` run instead of depending on a subject line.
   */
  spacingScale?: Record<string, number>
}

function readManifest(cwd: string): Manifest {
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

/** The pre-rename oxfmt scaffold dest, superseded by `.oxfmtrc.json` (oxfmt's auto-discovered name). */
const LEGACY_OXFMT_DEST = 'oxfmt.json'

/**
 * One-time cleanup for consumers who ran `init`/`sync` before the `.oxfmtrc.json` rename: drops the
 * stale `oxfmt.json` manifest entry so it stops being reconciled/recreated forever, and deletes the
 * on-disk file when it still byte-matches the shipped default (untouched since the last sync). A
 * locally-edited copy is left in place — the manifest entry alone determines "was basalt tracking
 * this", so a fresh consumer (no legacy entry) is a no-op.
 */
function migrateLegacyOxfmt(cwd: string, pkgRoot: string, manifest: Manifest): void {
  if (!(LEGACY_OXFMT_DEST in manifest.files)) return
  delete manifest.files[LEGACY_OXFMT_DEST]
  const legacyAbs = resolve(cwd, LEGACY_OXFMT_DEST)
  const onDisk = readIfExists(legacyAbs)
  if (onDisk === null) return
  const shipped = readSource(pkgRoot, 'configs/oxfmt.json')
  if (shipped !== null && onDisk === shipped) unlinkSync(legacyAbs)
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
 * The current on-disk state of a managed unit, plus the version the framework wants. For a
 * marker-spliced file the "current" unit is the existing region (markers included); otherwise it
 * is the whole file.
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
  if (file.markers) {
    return { current: extractBlockRegion(onDisk), desired }
  }
  return { current: onDisk, desired }
}

type Classification = 'unchanged' | 'drifted' | 'missing' | 'current'

/**
 * Normalize a managed unit's rendered bytes for the ledger comparison below — makes a delta that is
 * PURELY formatting or a version bump invisible to drift detection, while a real prose/content edit
 * stays fully visible:
 *
 *  - Blank out the per-release `BASALT_VERSION` token in a marker's begin line
 *    (`<!-- basalt:begin 1.0.1 -->` → `<!-- basalt:begin -->`). It changes on every release and is
 *    the only per-release variable that lands INSIDE the hashed region (the rest of
 *    `CLAUDE-block.md.tpl` has no other `{{…}}` placeholders today), so stripping it is what lets
 *    one normalized rendering stand in for every version of a given template body instead of
 *    needing one ledger entry per release. If a future marker template interpolates another
 *    per-release var inside its region, extend this normalization the same way.
 *  - Trim trailing whitespace per line and collapse every run of blank lines to none. This is the
 *    fix for the actual argo repro: lefthook's oxfmt reformats a spliced block (or a whole managed
 *    file) AFTER `writeUnit` has already exited and the manifest hash was recorded, so the manifest
 *    can never account for the reformat up front — normalizing it away here is the only place that
 *    can.
 *
 * Deliberately whitespace-only — word content is untouched, so a genuine hand-edit inside the block
 * still changes the normalized text and still classifies `drifted`.
 */
function normalizeForLedger(text: string): string {
  return text
    .replace(/(<!-- basalt:begin)\s+\S+(\s*-->)/, '$1$2')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

/**
 * Write a managed unit to disk (whole file, or marker-spliced region). Returns the unit's hash —
 * `sha256(normalizeForLedger(desired))`, NOT the raw bytes.
 *
 * This is the ledger: the manifest already records "what basalt shipped last sync", one entry per
 * dest — a stored NORMALIZED hash makes that same single entry survive both a downstream formatter
 * (the consumer's own lefthook oxfmt reformatting the written file/block after this function has
 * already returned) and a version bump that changed the template's own words since the recorded
 * entry — the argo cross-version case: current is v1.0.0's block, post-oxfmt; desired is v1.0.1's
 * (different words, e.g. the CLI bin rename). Recording the raw hash can never reconcile that;
 * recording the normalized hash lets `classify()` normalize `state.current` the same way and
 * compare directly against it, no separate historical-hash storage required.
 */
function writeUnit(file: ManagedFile, cwd: string, desired: string): string {
  const destAbs = resolve(cwd, file.dest)
  if (file.markers) {
    const host = readIfExists(destAbs) ?? ''
    writeFileEnsuringDir(destAbs, applyBlock(host, desired))
  } else {
    writeFileEnsuringDir(destAbs, desired)
  }
  return sha256(normalizeForLedger(desired))
}

/**
 * Classify a managed file against the manifest for a sync run.
 * - missing  : the managed unit is absent on disk → recreate.
 * - current  : on disk == desired → nothing to do.
 * - unchanged: on disk matches a KNOWN-SHIPPED rendering of this template, checked three ways (any
 *              one is sufficient) — but != desired as-is → safe overwrite:
 *              1. `sha256(current) === manifestHash` — legacy raw-hash path. An existing consumer
 *                 manifest (written before this fix, or by a still-running older CLI) holds the RAW
 *                 hash of what was written, not the normalized one; keep matching it directly so an
 *                 upgrade never mass-classifies a pristine tree as drifted.
 *                 Residual transitional gap: a manifest written by a pre-1.0.2 CLI holds a raw hash
 *                 of the exact old bytes, so if the on-disk block was ALSO reformatted by a
 *                 downstream formatter AND the template body changed cross-version in the same
 *                 upgrade, none of the three paths above match and it classifies `drifted`, needing
 *                 one `--force`. Once any sync since writes a normalized entry (path 2/3 or a
 *                 healed write), the gap is closed for good for that file. Deliberately not solved
 *                 by keeping a historical per-version ledger — that's a real but bounded tradeoff.
 *              2. `sha256(normalizeForLedger(current)) === manifestHash` — the ledger proper.
 *                 `manifestHash` normally holds `sha256(normalizeForLedger(<bytes written at the
 *                 last sync>))` (see `writeUnit`); normalizing `current` the same way and comparing
 *                 survives a downstream formatter reformatting the file AND a version bump that
 *                 changed the template's own words between the sync that wrote this manifest entry
 *                 and the version being synced now — the argo cross-version false positive.
 *              3. `normalizeForLedger(current) === normalizeForLedger(desired)` — same-version
 *                 fallback for when there is no manifest entry to compare against at all (e.g. it
 *                 was dropped), but the on-disk bytes still match today's rendering modulo
 *                 formatting noise.
 * - drifted  : on disk matches NONE of the above (a real, word-level local edit) → skip unless
 *              --force.
 */
function classify(state: UnitState, manifestHash: string | undefined): Classification {
  if (state.current === null) return 'missing'
  if (state.desired !== null && state.current === state.desired) return 'current'
  const currentHash = sha256(state.current)
  if (currentHash === manifestHash) return 'unchanged'
  if (sha256(normalizeForLedger(state.current)) === manifestHash) return 'unchanged'
  if (
    state.desired !== null &&
    normalizeForLedger(state.current) === normalizeForLedger(state.desired)
  ) {
    return 'unchanged'
  }
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

// ──────────────────────────────────────────────────────────────────────────────
// init — describing the repo it is actually in
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Read → mutate → write the consumer's package.json, preserving its own indentation and trailing
 * newline. `mutate` returns false to abort the write (nothing to change). Returns whether a write
 * happened. Deliberately a JSON round-trip rather than a textual splice: key ORDER is preserved by
 * `JSON.parse`/`stringify`, and anything fancier would be a formatter this CLI has no business being.
 */
function patchPackageJson(cwd: string, mutate: (pkg: Record<string, unknown>) => boolean): boolean {
  const abs = resolve(cwd, 'package.json')
  const raw = readIfExists(abs)
  if (raw === null) return false
  let pkg: Record<string, unknown>
  try {
    pkg = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return false
  }
  if (!mutate(pkg)) return false
  const indent = /\n([ \t]+)"/.exec(raw)?.[1] ?? '  '
  writeFileSync(abs, JSON.stringify(pkg, null, indent) + (raw.endsWith('\n') ? '\n' : ''))
  return true
}

/**
 * The source roots for THIS repo, inferred from its actual layout — the fix for the single most
 * reported false-green: without `basalt.roots` a workspace repo scaffolds a `check-theme` that
 * scans zero files and a CI `oxfmt 'src/**'` that matches nothing, while `doctor` reports green.
 *
 * A workspace repo resolves to the `src/` of every workspace package that depends on basalt or
 * Mantine (a backend package's `src/` has nothing for a design guard to say); with no such package
 * it falls back to every workspace `src/`, and a single-package repo to plain `src`. Empty when
 * nothing plausible exists — `init` says so rather than writing a root that matches nothing.
 */
function detectRoots(cwd: string): string[] {
  const workspacePackages = collectWorkspacePackages(cwd).packages.filter((pkg) => pkg.dir !== cwd)
  const withSrc = workspacePackages.filter((pkg) => existsSync(resolve(pkg.dir, 'src')))
  const uiPackages = withSrc.filter(
    (pkg) => hasDependency(pkg.dir, 'basalt-ui') || hasDependency(pkg.dir, '@mantine/core'),
  )
  const chosen = uiPackages.length > 0 ? uiPackages : withSrc
  if (chosen.length > 0) {
    return chosen.map((pkg) => relativePosix(cwd, resolve(pkg.dir, 'src')).replace(/^\.\//, ''))
  }
  return existsSync(resolve(cwd, DEFAULT_ROOT)) ? [DEFAULT_ROOT] : []
}

/** What `reconcileRoots` found — the one roots decision `init` and `sync` both report from. */
type RootsState =
  /** The key was absent and has just been written. */
  | { readonly kind: 'wrote'; readonly roots: string[] }
  /** The key is absent and nothing plausible could be inferred. */
  | { readonly kind: 'undetectable' }
  /** The key is already declared. `unscanned` names inferable roots it does not cover. */
  | { readonly kind: 'declared'; readonly declared: string[]; readonly unscanned: string[] }

/** True when `root` is `detected` itself or an ancestor of it. */
function rootCovers(root: string, detected: string): boolean {
  const r = root.replace(/\/+$/, '')
  return detected === r || detected.startsWith(`${r}/`)
}

/**
 * Read — and when absent and `write` is set, seed — `basalt.roots`.
 *
 * Shared by `init` and `sync` because the key going missing is the SAME false green in both: the
 * built-in `src` default happens to resolve from a package cwd, so `guard-scan` passes, `check-theme`
 * scans something, and the repo is silently guarding a subset of itself. `init` wrote it and `sync`
 * did not — which meant the fix reached new scaffolds only, while every existing consumer (the ones
 * who by definition upgrade rather than scaffold) stayed on the undeclared default.
 *
 * A DECLARED value is never overwritten, not even when the layout disagrees with it. `roots` is a
 * subset by construction in a monorepo — a React-free package deliberately left out is the normal
 * case, not drift — so a disagreement is reported as one line naming what is not covered, and the
 * consumer decides. Silently widening someone's deliberate scope would turn an upgrade into an
 * unplanned lint debt.
 */
function reconcileRoots(cwd: string, opts: { write: boolean }): RootsState {
  const declared = readBasaltConfig(cwd).roots
  const detected = detectRoots(cwd)
  if (declared !== undefined) {
    const unscanned = detected.filter((d) => !declared.some((r) => rootCovers(r, d)))
    return { kind: 'declared', declared, unscanned }
  }
  if (detected.length === 0) return { kind: 'undetectable' }
  if (!opts.write) return { kind: 'declared', declared: [], unscanned: detected }
  const wrote = patchPackageJson(cwd, (pkg) => {
    const basalt = (pkg['basalt'] ?? {}) as Record<string, unknown>
    if (basalt['roots'] !== undefined) return false
    pkg['basalt'] = { ...basalt, roots: detected }
    return true
  })
  return wrote ? { kind: 'wrote', roots: detected } : { kind: 'undetectable' }
}

/** The lines `init`/`sync` print for a roots reconciliation. Empty when there is nothing to say. */
function rootsNotices(state: RootsState): { log: string[]; error: string[] } {
  if (state.kind === 'wrote') {
    return {
      log: [
        `wrote "basalt": { "roots": ${JSON.stringify(state.roots)} } to package.json — ` +
          'check-theme, the CI oxfmt globs and the default scan exemption all derive from it. ' +
          'Correct it if your sources live elsewhere.',
      ],
      error: [],
    }
  }
  if (state.kind === 'undetectable') {
    return {
      log: [],
      error: [
        'could not infer "basalt.roots" — no src/ here and no workspace package with one. Set ' +
          '"basalt": { "roots": [...] } in package.json by hand, or check-theme will fail with ' +
          '"0 files scanned".',
      ],
    }
  }
  if (state.unscanned.length === 0) return { log: [], error: [] }
  if (state.declared.length === 0) {
    return {
      log: [],
      error: [
        `"basalt.roots" is not set — the guard is running on the built-in default ("${DEFAULT_ROOT}"). ` +
          `This layout suggests ${JSON.stringify(state.unscanned)}; declare it in package.json.`,
      ],
    }
  }
  return {
    log: [
      `keeping your "basalt.roots" (${JSON.stringify(state.declared)}) — never overwritten. The ` +
        `layout also has ${JSON.stringify(state.unscanned)}, which nothing scans; add it if it ` +
        'should be guarded, or leave it if the exclusion is deliberate.',
    ],
    error: [],
  }
}

/**
 * Strip JSONC comments (and trailing commas) so `.oxlintrc.json` can be READ. oxlint accepts JSONC
 * and real consumer configs use it — a plain `JSON.parse` there reported "not valid JSON" on a
 * perfectly good config. String-aware, so a `//` inside a value survives.
 *
 * Only ever used for reading. The trailing-comma pass is a plain regex and could in principle mangle
 * a `, }` sequence inside a string; the failure direction is a parse error, which the caller already
 * treats as "cannot tell", never as "passes".
 */
function stripJsonc(text: string): string {
  let out = ''
  let inString = false
  let escaped = false
  let i = 0
  while (i < text.length) {
    const ch = text[i] as string
    if (inString) {
      out += ch
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      i += 1
      continue
    }
    if (ch === '"') {
      inString = true
      out += ch
      i += 1
      continue
    }
    if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i += 1
      continue
    }
    if (ch === '/' && text[i + 1] === '*') {
      i += 2
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1
      i += 2
      continue
    }
    out += ch
    i += 1
  }
  return out.replace(/,(\s*[}\]])/g, '$1')
}

/** Parse a JSONC document, or null when it does not parse at all. */
function parseJsonc(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(stripJsonc(text)) as Record<string, unknown>
  } catch {
    return null
  }
}

/** Outcome of splicing the shipped preset into an `.oxlintrc.json` the consumer already had. */
type MergeLintResult = 'added' | 'already' | 'absent' | 'unreadable' | 'has-comments'

/**
 * The `extends` entry pointing at the shipped oxlint preset, or null when none does.
 *
 * Returns the ENTRY rather than a boolean because the string alone proves nothing: a consumer that
 * upgraded (or moved to an isolated linker) keeps a perfectly well-shaped
 * `./node_modules/basalt-ui/configs/oxlint.json` that resolves to nothing, and oxlint then refuses
 * to start with `NotFound` while a check built to prove the framework is ON reports green. The
 * caller resolves this against the config's own directory — see `extendsSeam`.
 */
function basaltPresetEntry(entries: unknown): string | null {
  if (!Array.isArray(entries)) return null
  const match = entries.find(
    (entry): entry is string =>
      typeof entry === 'string' && entry.endsWith('basalt-ui/configs/oxlint.json'),
  )
  return match ?? null
}

// ── The two `extends` seams init writes once and nothing ever revisits ───────────────────────────
//
// `.oxlintrc.json` and `lefthook.yml` are consumer-owned after the first write: `sync` never
// touches either. So 1.20.0's path-resolution fix reached NEW scaffolds only — every existing
// monorepo consumer kept a root-relative `extends` that resolves to nothing. oxlint at least
// hard-errors (`NotFound`). lefthook does not: a missing extends target merges to ZERO commands and
// exits 0, so `lefthook dump` is clean and the repo silently has no pre-commit gate at all.
//
// Both seams therefore need a checker that resolves the path rather than pattern-matching the
// string, and both `doctor` (the gate) and `sync` (the command an upgrade actually runs) report
// through it.

const LEFTHOOK_CONFIG_NAMES = ['lefthook.yml', 'lefthook.yaml', '.lefthook.yml', '.lefthook.yaml']

/** The lefthook config present at `dir` (repo-root-relative name), or null when there is none. */
function findLefthookConfig(dir: string): string | null {
  return LEFTHOOK_CONFIG_NAMES.find((name) => existsSync(resolve(dir, name))) ?? null
}

/**
 * The `extends:` entries of a lefthook YAML — the block-sequence form init seeds and the inline
 * array form a consumer may write instead.
 *
 * A three-line reader rather than a YAML dependency: this parses ONE top-level key whose value is a
 * list of plain scalars, and a wrong answer costs a diagnostic, never a write.
 */
function yamlUnquote(raw: string): string {
  return raw.trim().replace(/^['"]|['"]$/g, '')
}

function yamlExtendsEntries(text: string): string[] {
  const lines = text.split('\n')
  const out: string[] = []
  for (const [index, line] of lines.entries()) {
    const inline = /^extends:\s*\[(.*)\]\s*$/.exec(line ?? '')
    if (inline !== null) {
      out.push(...(inline[1] ?? '').split(',').map(yamlUnquote).filter(Boolean))
      continue
    }
    if (!/^extends:\s*(#.*)?$/.test(line ?? '')) continue
    for (const next of lines.slice(index + 1)) {
      if (/^\s*(#.*)?$/.test(next ?? '')) continue
      const item = /^\s*-\s*(.+?)\s*$/.exec(next ?? '')
      if (item === null) break
      out.push(yamlUnquote(item[1] ?? ''))
    }
  }
  return out
}

/** The state of one shipped-preset `extends` seam in a consumer-owned config. */
type ExtendsSeam =
  /** No such config file — nothing is wired, and that is a legitimate consumer choice. */
  | { readonly kind: 'no-file' }
  /** The file exists but names no basalt preset. */
  | { readonly kind: 'unwired'; readonly file: string }
  /** It names one, and the path resolves to nothing — the silent-gate case. */
  | { readonly kind: 'broken'; readonly file: string; readonly entry: string }
  | { readonly kind: 'ok'; readonly file: string; readonly entry: string }

/**
 * Resolve a lefthook config's basalt `extends` entry against the directory the config lives in —
 * which is how lefthook itself resolves it.
 */
function inspectLefthookSeam(repoRoot: string): ExtendsSeam {
  const file = findLefthookConfig(repoRoot)
  if (file === null) return { kind: 'no-file' }
  const raw = readIfExists(resolve(repoRoot, file))
  if (raw === null) return { kind: 'no-file' }
  const entry = yamlExtendsEntries(raw).find((e) => e.endsWith('basalt-ui/configs/lefthook.yml'))
  if (entry === undefined) return { kind: 'unwired', file }
  return existsSync(resolve(repoRoot, entry))
    ? { kind: 'ok', file, entry }
    : { kind: 'broken', file, entry }
}

/**
 * Splice the shipped preset into an EXISTING `.oxlintrc.json` (`init --merge-lint`). Opt-in, not
 * automatic: turning the framework on adds real lint debt to previously-clean code (see the
 * lint-debt notice `init` prints), and that is a decision, not a scaffold step. Prepends the preset
 * so the consumer's own `extends` entries still win.
 */
function mergeOxlintExtends(cwd: string, presetPath: string): MergeLintResult {
  const abs = resolve(cwd, '.oxlintrc.json')
  const raw = readIfExists(abs)
  if (raw === null) return 'absent'
  const cfg = parseJsonc(raw)
  if (cfg === null) return 'unreadable'
  if (basaltPresetEntry(cfg['extends']) !== null) return 'already'
  // Rewriting a JSONC config through JSON.stringify would silently delete the consumer's comments,
  // which in a lint config are usually the WHY of every disabled rule. Refuse and say so.
  if (stripJsonc(raw) !== raw) return 'has-comments'
  const existing = Array.isArray(cfg['extends'])
    ? (cfg['extends'] as unknown[]).filter((entry) => typeof entry === 'string')
    : []
  // Rebuild rather than spread, so `extends` keeps its original position when it was already there
  // and lands first when it wasn't — a diff a human reviews should not reshuffle the whole file.
  const merged: Record<string, unknown> = 'extends' in cfg ? {} : { extends: [presetPath] }
  for (const [key, value] of Object.entries(cfg)) {
    merged[key] = key === 'extends' ? [presetPath, ...existing] : value
  }
  const indent = /\n([ \t]+)"/.exec(raw)?.[1] ?? '  '
  writeFileSync(abs, JSON.stringify(merged, null, indent) + (raw.endsWith('\n') ? '\n' : ''))
  return 'added'
}

/**
 * What a consumer LOSES by `init` keeping a file it already had — the half the aggregate
 * `20 written, 2 kept` never said. A kept `.oxlintrc.json` is the headline case: the framework's
 * whole lint half stays off, and every gate downstream reports green over it.
 */
const KEPT_FILE_COST: Record<string, string> = {
  '.oxlintrc.json':
    'the shipped oxlint preset (the basalt/* design rules AND the jsx-a11y / import / promise / ' +
    'unicorn plugins) is NOT active — nothing else turns it on, and every gate stays green ' +
    'without it. Re-run with `--merge-lint` to splice the extends in, or add it by hand.',
  'lefthook.yml':
    'the pre-commit oxlint / oxfmt / check-theme jobs are not wired — add `extends: ' +
    '[<preset>]` to your own file.',
  '.github/workflows/check.yml':
    'CI does not run check-theme or the sync drift gate — copy those steps into your own workflow.',
  '.oxfmtrc.json': 'your existing formatter config stands; basalt formats nothing on its own.',
  'DESIGN.md': 'the design brief Claude reads is yours, not the seeded one.',
}

/** Scaffold all managed files into the consumer repo, then write the manifest. Idempotent. Returns 0. */
export function init(cwd: string = process.cwd(), scaffoldFlags: ScaffoldFlags = {}): number {
  // ── Describe the repo BEFORE rendering anything ───────────────────────────
  // Every roots-derived seed (the CI oxfmt globs, DESIGN.md's series path, the default scan
  // exemption) renders from `basalt.roots`, so the key has to exist first. Writing it is what
  // stops a workspace repo scaffolding a guard that scans zero files while doctor reports green.
  const install = findBasaltInstall(cwd)
  if (install.dir === null) {
    console.error(
      `⚠ basalt-ui init: basalt-ui does not resolve from ${cwd} or any directory above it — the ` +
        'seeded `extends` paths and CI steps are being written against the repo root by assumption. ' +
        'Install basalt-ui here (or at the repo root) and re-run `basalt-ui init` so they resolve.',
    )
  }

  const rootsState = reconcileRoots(cwd, { write: true })

  // Built AFTER the roots patch — every roots-derived template variable reads the key just written.
  const ctx = renderContext(cwd)

  // `basalt-tokens.md` tells the consumer to wire `oxlint . && basalt-ui check-theme` into their
  // lint, and init's own closing message says to run check-theme next — but nothing ever added a
  // script, so the guard stayed manual for exactly as long as someone remembered it.
  const lintScript = `oxlint . && ${ctx.vars.BASALT_BIN} check-theme`
  const seededLintScript = patchPackageJson(cwd, (pkg) => {
    const scripts = (pkg['scripts'] ?? {}) as Record<string, unknown>
    if (scripts['lint:basalt'] !== undefined) return false
    pkg['scripts'] = { ...scripts, 'lint:basalt': lintScript }
    return true
  })

  const manifest = readManifest(cwd)
  migrateLegacyOxfmt(cwd, ctx.pkgRoot, manifest)
  const peers = resolvePeerFlags(cwd, scaffoldFlags)
  const placement = resolvePlacement(cwd)
  const files = managedFiles(peers, placement)

  const writtenFiles: string[] = []
  const keptFiles: string[] = []
  const missingSources: string[] = []

  for (const file of files) {
    const state = unitState(file, cwd, ctx)
    if (state.desired === null) {
      missingSources.push(file.source)
      continue
    }

    // Whole files (managed + seed) are skip-if-exists on init; a marker-spliced region always
    // inserts/updates itself inside its host file.
    const destExists = existsSync(resolve(cwd, file.dest))
    if (!file.markers && destExists) {
      // Already present — keep the consumer's copy untouched. Record the SHIPPED hash (normalized,
      // same ledger form `writeUnit` uses) so a later sync treats a pre-existing-but-different file
      // as locally drifted (skip unless --force), never silently clobbering a file the consumer
      // authored before init.
      manifest.files[file.dest] = sha256(normalizeForLedger(state.desired))
      keptFiles.push(file.dest)
      continue
    }

    const hash = writeUnit(file, cwd, state.desired)
    manifest.files[file.dest] = hash
    writtenFiles.push(file.dest)
  }

  const mergeLint: MergeLintResult | null =
    scaffoldFlags.mergeLint === true ? mergeOxlintExtends(cwd, ctx.vars.OXLINT_PRESET_PATH) : null

  manifest.basaltVersion = ctx.vars.BASALT_VERSION
  manifest.spacingScale = { ...deriveSpacing(0).scale }
  writeFileEnsuringDir(resolve(cwd, MANIFEST_PATH), `${JSON.stringify(manifest, null, 2)}\n`)

  console.log(
    `basalt-ui init: ${writtenFiles.length} written, ${keptFiles.length} kept, manifest at ${MANIFEST_PATH}`,
  )
  if (missingSources.length > 0) {
    console.log(
      `basalt-ui init: ${missingSources.length} shipped asset(s) not present, skipped: ${missingSources.join(', ')}`,
    )
  }
  // Naming the kept files is the fix for the report's headline false-green: `20 written, 2 kept`
  // named neither the file nor the consequence, so a repo that already had an `.oxlintrc.json`
  // ended up with the framework's lint half off and every gate downstream reporting green.
  if (keptFiles.length > 0) {
    console.log(`\nKept (already present — basalt did not touch them):`)
    for (const dest of keptFiles) {
      const cost = KEPT_FILE_COST[dest]
      console.log(cost === undefined ? `  · ${dest}` : `  · ${dest} — ${cost}`)
    }
  }
  if (mergeLint !== null) {
    const mergeMessage: Record<MergeLintResult, string> = {
      added: `spliced "${ctx.vars.OXLINT_PRESET_PATH}" into the existing .oxlintrc.json extends`,
      already: '.oxlintrc.json already extends the shipped preset — nothing to do',
      absent:
        'no existing .oxlintrc.json to merge into (the seeded one already extends the preset)',
      unreadable: '.oxlintrc.json is not valid JSON — merge the extends entry by hand',
      'has-comments':
        '.oxlintrc.json carries comments; rewriting it would delete them (usually the reason each ' +
        `rule is off). Add "extends": ["${ctx.vars.OXLINT_PRESET_PATH}"] as the first entry by hand.`,
    }
    console.log(`basalt-ui init: --merge-lint — ${mergeMessage[mergeLint]}`)
  }
  const rootsMessages = rootsNotices(rootsState)
  for (const line of rootsMessages.log) console.log(`basalt-ui init: ${line}`)
  for (const line of rootsMessages.error) console.error(`⚠ basalt-ui init: ${line}`)
  if (seededLintScript) {
    console.log(`basalt-ui init: added the "lint:basalt" script (${lintScript}) to package.json.`)
  }
  // lefthook.yml / .github/workflows/check.yml are repo-root-shaped — neither lefthook nor GitHub
  // Actions reads config from anywhere but the repo root, so a package living in a subdirectory
  // skips both rather than relocating them into a spot nothing reads.
  if (!placement.isPackageRepoRoot) {
    console.log(
      `basalt-ui init: skipped lefthook.yml (this package is not the repo root — repo root ` +
        `detected at ${placement.repoRoot}) — lefthook only reads config at the repo root; extend ` +
        `${ctx.vars.LEFTHOOK_PRESET_PATH} from your root lefthook.yml instead, and give its ` +
        `check-theme command \`env: { BASALT_CWD: ${relativePosix(placement.repoRoot, cwd)} }\` ` +
        'so the guard runs where your basalt config actually lives.',
    )
    console.log(
      `basalt-ui init: skipped .github/workflows/check.yml (this package is not the repo root — ` +
        `repo root detected at ${placement.repoRoot}) — GitHub Actions only reads .github/ at the ` +
        `repo root; copy the steps from ${shippedAssetPath(install, placement.repoRoot, 'configs/check.yml')} ` +
        'into your root CI workflow instead.',
    )
  }
  if (placement.relocatedQueryClient !== null) {
    console.log(
      `basalt-ui init: skipped src/query-client.ts (found an existing query client at ` +
        `${relative(cwd, placement.relocatedQueryClient)}) — import it from there instead of ` +
        're-seeding at the original path.',
    )
  }
  // query-client.ts / __root.tsx reference the optional TanStack peers directly — seeding them
  // without the peer installed would ship an unresolved import. Hint how to opt in instead.
  if (!peers.hasQuery) {
    console.log(
      'basalt-ui init: skipped src/query-client.ts (no @tanstack/react-query dependency detected) — ' +
        'install it, or re-run with --with-query, to scaffold it.',
    )
  }
  if (!peers.hasRouter || !peers.hasQuery) {
    console.log(
      'basalt-ui init: skipped src/routes/__root.tsx (needs both @tanstack/react-router and ' +
        '@tanstack/react-query) — install both, or re-run with --with-router --with-query, to scaffold it.',
    )
  }
  // The guard-hook PreToolUse registration is NOT written automatically — add it manually to
  // .claude/settings.json so every Write/Edit/MultiEdit goes through the theme guard.
  console.log(
    `\nTheme guard hook: add to .claude/settings.json → hooks.PreToolUse to catch violations before they land:\n` +
      `  "hooks": {\n` +
      `    "PreToolUse": [\n` +
      `      {\n` +
      `        "matcher": "Write|Edit|MultiEdit",\n` +
      `        "hooks": [{ "type": "command", "command": "bunx basalt-ui guard-hook" }]\n` +
      `      }\n` +
      `    ]\n` +
      `  }`,
  )
  // `init` on an existing app is a LINT-DEBT EVENT, not a no-op — the shipped preset turns on whole
  // oxlint plugins the repo was never linted against, so previously-clean code lands with real
  // findings on the first run. Naming the plugins (derived from the preset, so the count can't
  // drift) is what turns that from a nasty surprise into a scheduled triage.
  const presetPlugins = readOxlintPresetPlugins(ctx.pkgRoot)
  if (presetPlugins.length > 0) {
    console.log(
      `\nLint debt: adopting the shipped oxlint preset on an EXISTING app is not a no-op — it turns ` +
        `on ${presetPlugins.length} plugins (${presetPlugins.join(', ')}) plus the basalt/* design ` +
        'rules, on code never linted against them. Run `oxlint .` now and triage the count before ' +
        'your next commit; turn a rule off in your own .oxlintrc.json with a written reason rather ' +
        'than blanket-disabling a plugin.',
    )
  }
  console.log(
    'Activate the hooks: `lefthook install` — the seeded lefthook.yml is inert until the git hooks ' +
      'are written, and looks configured either way.',
  )
  // First adoption on a previously guard-clean repo can surface a wall of findings (the 1.0 guard
  // adds several rule kinds beyond a legacy local guard) — steer toward tuning config, not mass-allow.
  console.log(
    `\nFirst run: run \`${ctx.vars.BASALT_BIN} check-theme\` next (or \`bun run lint:basalt\`), then ` +
      'tune the per-rule `basalt.*` config keys in package.json for anything that fires — do not ' +
      'mass-`theme-allow` findings. Then `basalt-ui doctor` to confirm the wiring actually took.',
  )
  return 0
}

/** The oxlint plugins the shipped preset switches on — read from the preset, never restated. */
function readOxlintPresetPlugins(pkgRoot: string): string[] {
  const raw = readSource(pkgRoot, 'configs/oxlint.json')
  if (raw === null) return []
  try {
    const plugins = (JSON.parse(raw) as { plugins?: unknown }).plugins
    return isStringArray(plugins) ? plugins : []
  } catch {
    return []
  }
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
  // Before renderContext, which reads `basalt.roots` for the roots-derived template variables.
  const rootsState = reconcileRoots(cwd, { write: opts.check !== true })
  const ctx = renderContext(cwd)
  const manifest = readManifest(cwd)
  if (!opts.check) migrateLegacyOxfmt(cwd, ctx.pkgRoot, manifest)
  const peers = resolvePeerFlags(cwd, {})
  const placement = resolvePlacement(cwd)
  const files = managedFiles(peers, placement)

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
    if (file.mode === 'seed') {
      if (state.current === null && !opts.check) {
        manifest.files[file.dest] = writeUnit(file, cwd, state.desired)
        recreated++
      }
      continue
    }

    const kind = classify(state, manifest.files[file.dest])

    if (kind === 'current') {
      // On-disk bytes already equal `desired` exactly — record the ledger's normalized form
      // (not the raw bytes) so this entry keeps behaving like every other `writeUnit`-recorded
      // hash for a future classify() call.
      manifest.files[file.dest] = sha256(normalizeForLedger(state.desired))
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

  // Placement notices — informational, never affect the exit code (a skipped tooling seed or a
  // relocated scaffold is a legitimate consumer choice, not a sync failure).
  if (!placement.isPackageRepoRoot) {
    console.log(
      `basalt-ui sync: skipped lefthook.yml (this package is not the repo root — repo root ` +
        `detected at ${placement.repoRoot}) — lefthook only reads config at the repo root; extend ` +
        'node_modules/basalt-ui/configs/lefthook.yml from your root lefthook.yml instead.',
    )
    console.log(
      `basalt-ui sync: skipped .github/workflows/check.yml (this package is not the repo root — ` +
        `repo root detected at ${placement.repoRoot}) — GitHub Actions only reads .github/ at the ` +
        'repo root; extend node_modules/basalt-ui/configs/check.yml from your root CI workflow instead.',
    )
  }
  if (placement.relocatedQueryClient !== null) {
    console.log(
      `basalt-ui sync: skipped src/query-client.ts (found an existing query client at ` +
        `${relative(cwd, placement.relocatedQueryClient)}) — import it from there instead of ` +
        're-seeding at the original path.',
    )
  }

  const rootsMessages = rootsNotices(rootsState)
  for (const line of rootsMessages.log) console.log(`basalt-ui sync: ${line}`)
  for (const line of rootsMessages.error) console.error(`⚠ basalt-ui sync: ${line}`)

  // The two `extends` seams sync does NOT own. Reported here because sync is the command an
  // UPGRADE runs, and an upgrade is exactly when a resolved path goes stale — 1.20.0 fixed the
  // paths `init` renders and reached no existing consumer at all. Informational: these are
  // consumer-owned files, and `doctor` is the gate that fails on them.
  const install = findBasaltInstall(cwd)
  const lefthookSeam = inspectLefthookSeam(placement.repoRoot)
  if (lefthookSeam.kind === 'broken') {
    console.error(
      `⚠ basalt-ui sync: ${lefthookSeam.file} extends "${lefthookSeam.entry}", which does not ` +
        'exist — lefthook merges a missing extends target into ZERO commands and still exits 0, ' +
        'so there is no pre-commit gate. Repoint it at ' +
        `"${shippedAssetPath(install, placement.repoRoot, 'configs/lefthook.yml')}".`,
    )
  }
  const oxlintrcRaw = readIfExists(resolve(cwd, '.oxlintrc.json'))
  const oxlintEntry =
    oxlintrcRaw === null ? null : basaltPresetEntry(parseJsonc(oxlintrcRaw)?.['extends'])
  if (oxlintEntry !== null && !existsSync(resolve(cwd, oxlintEntry))) {
    console.error(
      `⚠ basalt-ui sync: .oxlintrc.json extends "${oxlintEntry}", which does not exist — oxlint ` +
        'refuses to start on a missing extends target (`NotFound`). Repoint it at ' +
        `"${shippedAssetPath(install, cwd, 'configs/oxlint.json')}".`,
    )
  }

  if (opts.check) {
    if (driftLines.length > 0) {
      console.error('basalt-ui sync --check: locally-drifted managed files:')
      for (const l of driftLines) console.error(l)
    }
    if (staleForCheck > 0) {
      console.error(`basalt-ui sync --check: ${staleForCheck} managed file(s) out of date.`)
      return 1
    }
    console.log('✓ basalt-ui sync --check: all managed files current.')
    return 0
  }

  manifest.basaltVersion = ctx.vars.BASALT_VERSION
  manifest.spacingScale = { ...deriveSpacing(0).scale }
  writeFileEnsuringDir(resolve(cwd, MANIFEST_PATH), `${JSON.stringify(manifest, null, 2)}\n`)

  console.log(
    `basalt-ui sync: ${updated} updated, ${recreated} recreated, ${skippedDrift} skipped (drift).`,
  )
  if (driftLines.length > 0) {
    console.log('Locally-edited files were skipped (run with --force to overwrite):')
    for (const l of driftLines) console.log(l)
  }
  if (missingSources.length > 0) {
    console.log(
      `basalt-ui sync: ${missingSources.length} shipped asset(s) not present, skipped: ${missingSources.join(', ')}`,
    )
  }
  return 0
}

// ──────────────────────────────────────────────────────────────────────────────
// check-coverage — 8-assertion coverage gate
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Assert the 8 SURFACES invariants against the live SURFACES + GUARD_RULES + plugin.json.
 * Returns 0 when all pass; 1 when any fail (console.error each failure).
 *
 * Eight assertions:
 *  1. Every doctrine spec's guardKinds ⊆ keyof GUARD_RULES.
 *  2. Every doctrine rule (deduped) maps to agent/rules/basalt-{rule}.md on disk.
 *  3. Every doctrine skill (deduped) maps to agent/skills/{skill}/SKILL.md on disk.
 *  4. Every non-#, non-'.' JS-subpath SURFACES key has a package.json exports entry.
 *  5. Every real package.json exports key has a SURFACES entry.
 *  6. Every surface with non-empty forbiddenImports has a globs field.
 *  7. Every headless surface is Mantine-free — via all 3 `forbiddenImports` bans, OR (for
 *     `TOKEN_LAYER_BOUNDARY_SURFACES` members, `./charts`/`./tokens`) exemption, since their
 *     Mantine-free guarantee is covered by the repo-local-only `basalt/token-layer-boundary`
 *     plugin rule instead — this assertion cannot verify that rule's live registration itself (see
 *     the assertion's own comment below for why); basalt's own CI does
 *     (`tests/surfaces-coverage.test.ts`).
 *  8. Every doctrine optionalPeers entry exists in peerDependencies AND peerDependenciesMeta.
 *
 * Tooling surfaces are exempt from assertions 1–3 by the discriminant.
 * Synthetic #-keys participate in assertions 1 and 2 but feed assertion 3 only
 * via the deduped skill union (no independent per-#-surface skill row).
 */
export function checkCoverage(): number {
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

  // ── Assertion 3: every doctrine skill (deduped) → agent/skills/{skill}/SKILL.md ──
  // Mirrors assertion 2's shape — skills ship in the npm package and are placed by init/sync,
  // so a skill referenced by SURFACES must exist as a shipped asset at the package root.
  for (const skill of SKILL_NAMES) {
    const skillPath = resolve(pkgRoot, `agent/skills/${skill}/SKILL.md`)
    if (!existsSync(skillPath)) {
      failures.push(
        `Missing skill file: agent/skills/${skill}/SKILL.md (derived from SURFACES doctrine skills)`,
      )
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
    if (!Object.hasOwn(SURFACES, exportKey)) {
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

  // ── Assertion 7: every headless surface is Mantine-free ──────────────────────
  // Guarantees the Mantine-free boundary — a future headless surface without coverage fails here.
  // Coverage is either all 3 forbiddenImports bans, OR membership in
  // `TOKEN_LAYER_BOUNDARY_SURFACES` (`./charts`/`./tokens`), whose Mantine-free guarantee comes
  // from the `basalt/token-layer-boundary` plugin rule instead — protects both layering (tokens
  // upstream of Mantine) and packaging (those two subpaths resolve with no `@mantine/*` installed,
  // CI-tested via `scripts/pack-test.sh` + `scripts/check-dist-layering.mjs`; see surfaces.ts's
  // `TOKEN_LAYER_BOUNDARY_SURFACES` doc comment). This assertion CANNOT also verify
  // that rule's live registration: `check-coverage` is a shipped CLI subcommand whose assertions
  // must all read pkgRoot-relative paths so it works from inside a consumer's node_modules — and a
  // repo-local `.oxlintrc.json` read from an installed package path-resolves to the CONSUMER's own
  // config, not basalt's. That "fails loudly if enforcement is removed" guarantee lives in
  // basalt's own CI instead (`tests/surfaces-coverage.test.ts`, via
  // `hasTokenLayerBoundaryRegistered` against `.oxlintrc.json`).
  const REQUIRED_MANTINE_BANS = ['@mantine/core', '@mantine/hooks', '@mantine/*'] as const

  for (const [key, spec] of allSpecs) {
    if (spec.layer !== 'headless') continue
    if (TOKEN_LAYER_BOUNDARY_SURFACES.has(key)) continue
    for (const required of REQUIRED_MANTINE_BANS) {
      const hasBan = spec.forbiddenImports.some((fi) => fi.spec === required)
      if (!hasBan) {
        failures.push(
          `SURFACES['${key}'] is headless but missing Mantine ban for '${required}' in forbiddenImports`,
        )
      }
    }
  }

  // ── Assertion 8: every doctrine optionalPeers entry → peerDependencies + peerDependenciesMeta ──
  // Closes the silent-drop gap: an optionalPeer listed in SURFACES but absent from package.json
  // means the published package never tells npm about the dependency.
  let peerDependencies: Record<string, string> = {}
  let peerDependenciesMeta: Record<string, { optional?: boolean }> = {}
  try {
    const frameworkPkg = JSON.parse(readFileSync(resolve(pkgRoot, 'package.json'), 'utf8')) as {
      peerDependencies?: Record<string, string>
      peerDependenciesMeta?: Record<string, { optional?: boolean }>
    }
    peerDependencies = frameworkPkg.peerDependencies ?? {}
    peerDependenciesMeta = frameworkPkg.peerDependenciesMeta ?? {}
  } catch {
    failures.push(`Cannot read package.json peerDependencies at ${pkgRoot}`)
  }

  for (const spec of doctrineSpecs) {
    for (const peer of spec.optionalPeers ?? []) {
      if (!(peer in peerDependencies)) {
        failures.push(
          `SURFACES doctrine optionalPeer '${peer}' is not listed in package.json peerDependencies`,
        )
      }
      if (peerDependenciesMeta[peer]?.optional !== true) {
        failures.push(
          `SURFACES doctrine optionalPeer '${peer}' is not marked optional in package.json peerDependenciesMeta`,
        )
      }
    }
  }

  // ── Report ──────────────────────────────────────────────────────────────────
  if (failures.length === 0) {
    console.log('✓ check-coverage: all 8 assertions pass.')
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
  /**
   * Number of checks that could not RUN (as opposed to ran and passed). Counted separately and
   * exits non-zero on its own: under bun's isolated linker `doctor` used to drop two of its five
   * checks and still print "All checks passed", which is the same false-green this whole surface
   * exists to remove. A check that cannot run is not a check that passed.
   */
  skipped: number
}

/**
 * Which shape of consumer `doctor` is looking at.
 *
 * `framework` — the Mantine app the scaffold is for. `tokens-only` — a consumer that took the
 * `--vx-*` layer and nothing else (rollhook: no Mantine, no manifest, `tokens:css` output). Telling
 * the second to "run `basalt-ui init`" is the wrong instruction: init scaffolds Mantine rules,
 * skills and a DESIGN.md it will never read. Auto-detected, forced by `--framework` / `--tokens-only`.
 */
type DoctorProfile = 'framework' | 'tokens-only'

type WorkspacePackage = { readonly name: string; readonly dir: string }

/** {@link collectWorkspacePackages}'s return: the walked packages plus whether a `workspaces`
 * field was present at all (distinguishes "nothing to compare" from "not a workspace root"). */
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
 * Expands a root `package.json`'s `workspaces` patterns into concrete package directories.
 * Supports literal segments, a single-wildcard segment, and a double-wildcard segment, both
 * interior and trailing (e.g. `packages` followed by a double wildcard, or an interior single
 * wildcard between two literal segments) — not just one trailing single-wildcard segment. A
 * candidate directory that has no `package.json` of its own is skipped, not reported — an empty
 * scaffold directory is not a workspace package. Also honours npm/bun/yarn `!`-prefixed exclusion
 * entries (e.g. `["packages/*", "!packages/legacy"]`) — both the included and excluded patterns
 * are expanded through the same machinery, then the excluded set is subtracted.
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
 * Every workspace package declared by `cwd`'s root `package.json` (npm/bun/yarn `workspaces`
 * field, array or `{ packages: [...] }` object form), named + directory-resolved — PLUS the root
 * manifest itself, labelled `"{name} (root)"`. The root is walked because it commonly carries a
 * hoisted `ai` dev dependency that can itself skew against a workspace package's own major — that
 * is the producer/consumer shape the whole check exists to catch, and it is invisible if only the
 * expanded workspace dirs are inspected. `hasWorkspacesField` is `false` (and `packages` empty)
 * when `cwd` has no `package.json`, no `workspaces` field, or the field is a shape this doesn't
 * recognize — a repo-wide walk is a bonus check, not something that should ever throw doctor over
 * an unrecognized `workspaces` shape.
 */
function collectWorkspacePackages(cwd: string): WorkspaceWalk {
  const raw = readIfExists(resolve(cwd, 'package.json'))
  if (raw === null) return { packages: [], hasWorkspacesField: false }

  let parsed: { workspaces?: unknown; name?: string }
  try {
    parsed = JSON.parse(raw) as { workspaces?: unknown; name?: string }
  } catch {
    return { packages: [], hasWorkspacesField: false }
  }

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
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

/**
 * First run of digits in a semver range string (`^7.0.15` → `7`), or null if there is none.
 *
 * Duplicated verbatim in `configs/oxlint-plugin.js` — that file must stay import-free from this
 * package (it loads via `jsPlugins` out of a consumer's node_modules, before this package's own
 * code is necessarily resolvable), so the duplication is structural, not an oversight. Keep both
 * copies in sync by hand; a future parsing fix (pre-release suffixes, say) must land in both.
 */
function majorOf(range: string | undefined): number | null {
  if (typeof range !== 'string') return null
  const match = range.match(/\d+/)
  return match === null ? null : Number(match[0])
}

/** The `ai` package's declared major at `dir`'s own `package.json`, or null if undeclared/unreadable. */
function aiMajorAt(dir: string): number | null {
  const raw = readIfExists(resolve(dir, 'package.json'))
  if (raw === null) return null
  try {
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
    }
    return majorOf(
      pkg.dependencies?.['ai'] ?? pkg.devDependencies?.['ai'] ?? pkg.peerDependencies?.['ai'],
    )
  } catch {
    return null
  }
}

/**
 * Splits `basalt.aiMajorSkewReason` into a validated reason (or null) plus whether the key was
 * present at all but failed validation. A present-but-invalid value (anything other than a
 * non-empty string — including a bare `true`) is treated as absent for the pass/fail decision, same
 * as a missing key, but doctor's failure message still calls out that the key exists and is
 * malformed rather than silently falling back to the plain "no exemption" message — a forgotten key
 * and a broken one are different mistakes and deserve different guidance.
 */
function resolveAiMajorSkewReason(cfg: BasaltConfig): {
  reason: string | null
  presentButInvalid: boolean
} {
  const raw = cfg.aiMajorSkewReason
  if (raw === undefined) return { reason: null, presentButInvalid: false }
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return { reason: raw, presentButInvalid: false }
  }
  return { reason: null, presentButInvalid: true }
}

/**
 * Check a consumer repo's basalt integration and print a pass/warn report.
 *
 * With the plugin retired there is exactly ONE version axis — the npm package — so doctor verifies
 * one thing: the basalt-ui resolved in the consumer's node_modules against the version recorded in
 * .basalt/manifest.json at the last init/sync. File-level drift is `sync --check`'s job, not
 * doctor's.
 *
 * The checks are numbered in the order they run and print — there is no gap, and the number in a
 * section header below is the number in the report.
 *
 * Hard failures (exit non-zero):
 *   1. .basalt/manifest.json exists (init was run).
 *   2. `basalt-resolves`: basalt-ui resolves from here. Unresolvable used to make checks silently
 *      VANISH from the report (5 checks became 3) while the footer still read "All checks passed".
 *      It is also the moment `bunx basalt-ui` stops using the pinned copy.
 *   6. `guard-scan`: `check-theme` would scan MORE than zero files. `check-theme` already exits 1
 *      on "0 files scanned"; doctor disagreeing with it in the same repo is the bug.
 *   7. `oxlint-preset`: the consumer's `.oxlintrc.json` actually `extends` the shipped preset AND
 *      that path RESOLVES. `init` keeps an existing config, so the framework's whole lint half can
 *      be off with nothing to say so — one repo carried six real violations invisibly across five
 *      minors that way. Matching the string alone reproduced the same false green one layer in: a
 *      well-shaped entry pointing at a path that no longer exists passed this check in the very
 *      tree where oxlint refused to start with `NotFound`.
 *   8. `lefthook-preset`: the repo-root lefthook config's `extends` target resolves. lefthook
 *      merges a MISSING target into zero commands and exits 0 — no error, a clean `lefthook dump`,
 *      and no pre-commit gate. Nothing but a check can see that. Not-extending-at-all is a warning
 *      (a consumer may run their own hooks); extending a path that isn't there is a hard failure.
 *   10. `ai-major-parity`: every workspace package that declares the `ai` package agrees on its
 *      major version. `basalt/ai-sdk-major` (the oxlint plugin rule) cannot catch this — it checks
 *      a linted file's NEAREST package.json, so a lint run scoped to one workspace package only
 *      ever sees that package's own `ai` major and is perfectly happy; the cross-package skew (one
 *      package streaming on `ai@5`, another parsing it on `ai@7`) only a repo-wide manifest walk
 *      can see. Skipped entirely when `cwd` has no `workspaces` field or none of its packages
 *      declare `ai`. A detected skew is exempt-able via `basalt.aiMajorSkewReason` (a non-empty
 *      reason string, not a bare `true`) in the consumer's package.json — an intentional
 *      producer/consumer split neutralized by a transform is a locked decision, not a defect, and
 *      the written reason IS the pin that a permanently-failing guard would otherwise lack. Missing
 *      or invalid (empty/non-string) still hard-fails exactly as if the key were absent.
 *
 * Warnings (non-fatal):
 *   3. The installed node_modules/basalt-ui version matches the manifest's basaltVersion
 *      (a mismatch means the package was upgraded but `sync` never ran — the placed doctrine is
 *      stale).
 *   4. The spacing scale still matches the one stamped into the manifest at the last init/sync
 *      (skipped when there is no manifest to compare against; a neutral pass when this CLI is
 *      demonstrably not the installed package — see the check).
 *   5. The running CLI's own version matches the installed basalt-ui (catches a stale
 *      `bunx basalt-ui` npm fetch; best-effort, skipped if node_modules is absent).
 *   9. `basaltAppPlugin`'s (basalt-ui/vite) default icon filenames exist under public/ (only when
 *      a public/ dir exists at all — skipped otherwise).
 *   10 (second half). A declared `basalt.aiMajorSkewReason` when the ai majors currently AGREE — the
 *      exemption is stale and can be deleted; an exemption nobody revisits is how a real, later
 *      skew slips through unnoticed.
 *
 * An AMBIGUOUS project (no config here, several workspace packages carrying one) short-circuits
 * before any of them, exactly as `check-theme` does: running the remaining checks against the wrong
 * root buries the one real error under spurious ones.
 *
 * SKIPPED is now a third outcome beside pass/warn/fail and exits non-zero on its own — a check that
 * cannot run is not a check that passed. "Not applicable to this profile" is a pass, not a skip.
 *
 * Returns the exit code: 0 = all good, 1 = one or more hard failures or unrunnable checks.
 */
export function doctor(invocationCwd: string = process.cwd(), flags: string[] = []): number {
  if (conflictingProfileFlags(flags)) {
    console.error('basalt-ui doctor: --tokens-only and --framework are alternatives — pass one.')
    return 1
  }
  const project = resolveProjectDir(invocationCwd)
  // Ambiguity is terminal, exactly as it is for check-theme. Falling back to `invocationCwd` ran
  // every remaining check against the WRONG root and buried the one real error under spurious
  // ones — guard-scan reporting 0 files, .oxlintrc.json "missing" — which is this round's own
  // false-report bug class reappearing inside the fix for it.
  if (project.ambiguous !== null) {
    console.error(
      `\nbasalt-ui doctor — ${invocationCwd}\n\n` +
        `  ✖ no basalt config at ${invocationCwd}, and ${project.ambiguous.length} workspace ` +
        `packages carry one (${project.ambiguous.map((d) => relativePosix(invocationCwd, d)).join(', ')}) — ` +
        'run doctor from one of them, or set BASALT_CWD to pick.\n\n' +
        '1 hard failure(s), 0 warning(s).\n',
    )
    return 1
  }
  const cwd = project.dir
  const cfg = readBasaltConfig(cwd)
  const result: DoctorResult = { hardFailures: 0, warnings: 0, skipped: 0 }
  const lines: string[] = [`\nbasalt-ui doctor — ${cwd}\n`]

  function pass(msg: string): void {
    lines.push(`  ✓ ${msg}`)
  }
  function warn(msg: string): void {
    lines.push(`  ⚠ ${msg}`)
    result.warnings++
  }
  function skip(msg: string): void {
    lines.push(`  ⊘ SKIPPED — ${msg}`)
    result.skipped++
  }
  function fail(msg: string): void {
    lines.push(`  ✖ ${msg}`)
    result.hardFailures++
  }

  if (project.relocatedFrom !== null) {
    lines.push(
      `  → no basalt config at ${project.relocatedFrom} — reporting on ` +
        `${relativePosix(project.relocatedFrom, cwd)}, where it lives.\n`,
    )
  }

  // ── Profile ────────────────────────────────────────────────────────────────
  const manifestAbs = resolve(cwd, MANIFEST_PATH)
  const manifestExists = existsSync(manifestAbs)
  const profile = inferredProfile(cwd, cfg, flags)
  if (profile === 'tokens-only') {
    lines.push(
      '  profile: tokens-only — checking the token layer only. The scaffold checks below are not\n' +
        '  applicable; `basalt-ui init` is NOT the fix here, it places a Mantine doctrine you have no\n' +
        '  use for. Pass --framework to force the full profile.\n',
    )
    // check-theme will NOT infer this — it silences 17 kinds, so it moves only on a declaration.
    // Doctor is the surface that can safely detect the shape, so it is the one that has to say so.
    if (cfg.profile === undefined) {
      lines.push(
        '  → inferred (no .basalt/manifest.json and no @mantine/core in this workspace). Write it\n' +
          '    down as "basalt": { "profile": "tokens-only" } in package.json — check-theme does not\n' +
          '    infer it, so today it still reports the Mantine-only kinds against this repo.\n',
      )
    }
  }

  // ── Hard check 1: manifest exists ──────────────────────────────────────────
  if (profile === 'tokens-only') {
    pass(`${MANIFEST_PATH}: n/a — a tokens-only consumer has no scaffold to reconcile`)
  } else if (manifestExists) {
    pass(`${MANIFEST_PATH} exists`)
  } else {
    fail(`${MANIFEST_PATH} missing — run \`basalt-ui init\` to scaffold the consumer repo`)
  }

  // ── Hard check 2: basalt-ui resolves from here ─────────────────────────────
  // Unresolvable used to make checks 3 and 5 VANISH from the report while the footer still read
  // "All checks passed" — 5 checks silently became 3. It is also the moment `bunx basalt-ui`
  // stops using the pinned copy and quietly downloads a different one from npm, so the failure
  // has to be loud rather than absent.
  const install = findBasaltInstall(cwd)
  const installedVersion = install.version
  if (install.dir === null) {
    fail(
      `basalt-ui does not resolve from ${cwd}, any directory above it, or any workspace package — ` +
        'so every version check below is unrunnable, `extends: [<preset>]` cannot resolve, and ' +
        '`bunx basalt-ui` will silently fetch a DIFFERENT copy from npm instead of your pinned ' +
        'one. Add basalt-ui as a dependency here (or at the repo root) and re-run.',
    )
  } else if (install.how === 'cwd') {
    pass(
      `basalt-ui resolves at ./node_modules/basalt-ui (${installedVersion ?? 'unknown version'})`,
    )
  } else {
    pass(
      `basalt-ui resolves at ${relativePosix(cwd, install.dir)} (${installedVersion ?? 'unknown version'}, ` +
        `found via the ${install.how}) — seeded \`extends\` paths and CI steps must use that path, ` +
        'not ./node_modules/basalt-ui.',
    )
  }

  // ── Warn check 3: installed basalt-ui version matches the manifest ─────────
  // THE one version axis. The manifest records the version whose init/sync placed the doctrine;
  // node_modules is what the app actually resolves. A mismatch means "upgrade landed, sync didn't".
  if (profile === 'framework' && manifestExists && installedVersion === null) {
    skip(
      'installed-vs-manifest version — basalt-ui did not resolve, so there is nothing to compare',
    )
  }
  if (manifestExists && installedVersion !== null) {
    const manifestVersion = readManifest(cwd).basaltVersion
    if (manifestVersion === undefined) {
      warn(
        `${MANIFEST_PATH} records no basaltVersion (written by an older basalt-ui) — run ` +
          '`basalt-ui sync` to refresh the doctrine and stamp the manifest.',
      )
    } else if (manifestVersion !== installedVersion) {
      warn(
        `installed basalt-ui (${installedVersion}) differs from the version that last synced ` +
          `(${manifestVersion}) — the placed doctrine is stale; run \`basalt-ui sync\`.`,
      )
    } else {
      pass(`installed basalt-ui (${installedVersion}) matches the manifest's basaltVersion`)
    }
  }

  const cliVersion = readFrameworkVersion(packageRoot())

  // ── Warn check 4: the spacing scale has not moved under the app ────────────
  // The only check here that reports a change in RENDERED OUTPUT rather than in placed files. A
  // retune of the spacing bases moves every surface in an app calling `createBasaltTheme()` bare,
  // and majors are banned by design, so nothing in the version number says so — 1.2.0's retune
  // shipped under "tighten the sidebar, open up components" and sat unverified in production for a
  // day. Diffing the current scale against what last synced makes that move something a consumer
  // is told rather than something they have to notice.
  //
  // The scale that matters is the INSTALLED package's — that is what the app renders with — but
  // `deriveSpacing` here is the RUNNING CLI's, which a stale `bunx basalt-ui` fetch makes a
  // different package. Rather than load the installed tokens entry (async, and doctor is sync),
  // the comparison is skipped whenever the two versions are known to disagree: a false "matches"
  // is worse than no answer. Check 5 below names that disagreement, so this stays a neutral note.
  const cliIsTheInstall = installedVersion === null || installedVersion === cliVersion
  if (profile === 'tokens-only') {
    pass('spacing scale: n/a — a tokens-only consumer renders no basalt Mantine theme')
  } else if (!manifestExists) {
    // Printing NOTHING is the failure SKIPPED exists to end: the check simply vanished from the
    // report whenever there was no manifest, which is precisely when it is least safe to assume.
    skip(
      `spacing scale — no ${MANIFEST_PATH} records the scale this app last synced with, so there ` +
        'is nothing to compare against',
    )
  } else if (!cliIsTheInstall) {
    pass(
      `spacing scale not compared — this CLI (${cliVersion}) is not the installed basalt-ui ` +
        `(${installedVersion}), so its scale is not the one the app renders with`,
    )
  } else {
    const recorded = readManifest(cwd).spacingScale
    const current = deriveSpacing(0).scale as Record<string, number>
    if (recorded === undefined) {
      // Silent for a manifest written before this field existed — the version check above already
      // says "run sync", and a second warning for the same cause is noise.
      pass('spacing scale not yet recorded — `basalt-ui sync` will stamp it')
    } else {
      // Over the UNION of both key sets: a step the scale gained since the last sync is a move the
      // app feels, and so is one it lost. Iterating only `current` would miss the second.
      const steps = [...new Set([...Object.keys(current), ...Object.keys(recorded)])].toSorted()
      const moved = steps
        .filter((step) => recorded[step] !== current[step])
        .map((step) => `${step} ${recorded[step] ?? '(none)'}→${current[step] ?? '(removed)'}`)
      if (moved.length > 0) {
        warn(
          `the spacing scale moved since the last sync (${moved.join(', ')}) — every surface in an ` +
            'app calling createBasaltTheme() bare shifts with it. Review the app visually, then run ' +
            '`basalt-ui sync` to record the new scale.',
        )
      } else {
        pass('spacing scale matches the last sync')
      }
    }
  }

  // ── Warn check 5: running CLI version matches the consumer's installed basalt-ui ────
  // Catches the failure mode where bunx fetches a stale published package instead of the local
  // install — the CLI that ran doctor and the package resolved from the consumer's node_modules
  // silently disagree.
  if (installedVersion === null) {
    skip('CLI-vs-installed version — basalt-ui did not resolve, so there is no installed version')
  } else if (installedVersion !== cliVersion) {
    warn(
      `running CLI version (${cliVersion}) differs from the installed basalt-ui version at ` +
        `${install.dir === null ? 'node_modules' : relativePosix(cwd, install.dir)} (${installedVersion}) — ` +
        'likely a stale `bunx basalt-ui` fetch from npm; run the local bin ' +
        '(`node_modules/.bin/basalt-ui`, or a package.json script) so the pinned copy is the one ' +
        'that runs.',
    )
  } else {
    pass(`CLI version (${cliVersion}) matches the installed basalt-ui`)
  }

  // ── Hard check 6: the guard would actually scan something ──────────────────
  // `check-theme` exits 1 on "0 files scanned" — doctor reporting all-green in the SAME repo is
  // the disagreement consumers reported: init ran, doctor passed, and the palette guard was a
  // no-op the whole time because no `basalt.roots` described the workspace layout.
  if (profile === 'tokens-only') {
    pass('guard-scan: n/a — the theme guard is a Mantine-app check')
  } else {
    const scanned = scannableFiles(cwd, cfg)
    if (scanned.length === 0) {
      fail(
        `guard-scan: check-theme would scan 0 files — the roots (${resolveRoots(cfg).join(', ')}) ` +
          `match nothing under ${cwd}, so the palette guard is a no-op that still exits green in ` +
          'every gate that does not run it. Set "basalt": { "roots": [...] } in package.json.',
      )
    } else {
      pass(
        `guard-scan: check-theme covers ${scanned.length} file(s) under ${resolveRoots(cfg).join(', ')}`,
      )
    }
  }

  // ── Hard check 7: the consumer's oxlint config extends the shipped preset ──
  // `init` KEEPS an existing `.oxlintrc.json`, so a repo can carry the whole scaffold with the
  // framework's lint half switched off and nothing anywhere saying so. One repo ran five minors
  // that way and surfaced six real `basalt/no-raw-font-size` errors the moment it was wired.
  if (profile === 'tokens-only') {
    pass('oxlint-preset: n/a — the shipped preset is a Mantine/React preset')
  } else {
    const oxlintrcRaw = readIfExists(resolve(cwd, '.oxlintrc.json'))
    if (oxlintrcRaw === null) {
      fail(
        '.oxlintrc.json missing — the shipped oxlint preset (the basalt/* design rules) is not ' +
          'active. Run `basalt-ui init` to seed it.',
      )
    } else {
      // JSONC: oxlint accepts comments and real consumer configs carry them.
      const parsed = parseJsonc(oxlintrcRaw)
      if (parsed === null) {
        skip(
          '.oxlintrc.json does not parse as JSON/JSONC — cannot tell whether it extends the preset',
        )
      } else {
        const entry = basaltPresetEntry(parsed['extends'])
        const correct = shippedAssetPath(install, cwd, 'configs/oxlint.json')
        if (entry === null) {
          fail(
            '.oxlintrc.json does NOT extend the shipped preset — every basalt/* design rule is off ' +
              `and oxlint reports green without them. Add "extends": ["${correct}"], or re-run ` +
              '`basalt-ui init --merge-lint` to splice it in.',
          )
        } else if (!existsSync(resolve(cwd, entry)) && entry === correct && install.dir !== null) {
          // The path is the one basalt resolves from and the asset still isn't there — a partial
          // or corrupted install, not a stale path. Saying "repoint it at <the same string>" would
          // be the unhelpful shape of a correct diagnosis.
          fail(
            `.oxlintrc.json extends "${entry}", which does not exist (${resolve(cwd, entry)}) — ` +
              'basalt-ui resolves there but ships no `configs/oxlint.json` at that path, so oxlint ' +
              'refuses to start (`NotFound`) and nothing is linted. Reinstall basalt-ui.',
          )
        } else if (!existsSync(resolve(cwd, entry))) {
          // The string is right and the file is not there. oxlint refuses to start at all
          // (`invalid config file … NotFound`), so a green line here is a check that proves the
          // framework is ON while the linter is dead — the same false-green class this check was
          // added to close, one layer in. `install` already computed the true path in this run.
          fail(
            `.oxlintrc.json extends "${entry}", which does not exist (${resolve(cwd, entry)}) — ` +
              'oxlint refuses to start on a missing extends target (`NotFound`), so nothing is ' +
              `linted at all. Repoint it at "${correct}", where basalt-ui actually resolves.`,
          )
        } else {
          pass(`.oxlintrc.json extends the shipped basalt-ui oxlint preset (${entry})`)
        }
      }
    }
  }

  // ── Hard check 8: the lefthook preset's extends target actually exists ─────
  // The loudest silent failure in the toolchain: lefthook merges a MISSING extends target into
  // zero commands and exits 0 — `lefthook dump` prints the extends line, no commands, and a clean
  // exit — so a repo whose path went stale has no pre-commit gate and nothing anywhere says so.
  // Unlike oxlint there is no error to notice, which is why this has to be a check rather than a
  // remedy line someone reads after a failure.
  const repoRoot = findRepoRoot(cwd)
  const lefthookSeam =
    profile === 'tokens-only' ? { kind: 'n/a' as const } : inspectLefthookSeam(repoRoot)
  const lefthookCorrect = shippedAssetPath(install, repoRoot, 'configs/lefthook.yml')
  if (lefthookSeam.kind === 'n/a') {
    pass('lefthook-preset: n/a — a tokens-only consumer wires its own hooks')
  } else if (lefthookSeam.kind === 'no-file') {
    pass(`lefthook-preset: n/a — no lefthook config at ${repoRoot}`)
  } else if (lefthookSeam.kind === 'unwired') {
    warn(
      `${lefthookSeam.file} does not extend the shipped lefthook preset — the oxlint / oxfmt / ` +
        `check-theme pre-commit jobs are not wired. Add "extends: [${lefthookCorrect}]" to it.`,
    )
  } else if (lefthookSeam.kind === 'broken') {
    fail(
      `${lefthookSeam.file} extends "${lefthookSeam.entry}", which does not exist ` +
        `(${resolve(repoRoot, lefthookSeam.entry)}) — lefthook merges a missing extends ` +
        'target into ZERO commands and still exits 0, so this repo has no pre-commit gate and ' +
        `\`lefthook dump\` looks clean. Repoint it at "${lefthookCorrect}".`,
    )
  } else {
    pass(`${lefthookSeam.file} extends the shipped lefthook preset (${lefthookSeam.entry})`)
  }

  // ── Warn check 8: basaltAppPlugin's default icon files exist in public/ ────
  // basalt-ui/vite's basaltAppPlugin (head/manifest metadata) references these filenames by
  // default (the realfavicongenerator convention). Only runs when a public/ dir exists at all —
  // apps that don't use the plugin, or don't use Vite's public-dir convention, get no false
  // warning. Best-effort: a custom `icons.dir` isn't visible here, so this checks the root only.
  const publicDir = resolve(cwd, 'public')
  if (profile === 'framework' && existsSync(publicDir)) {
    const iconFiles = [
      'favicon.ico',
      'favicon.svg',
      'favicon-96x96.png',
      'apple-touch-icon.png',
      'web-app-manifest-192x192.png',
      'web-app-manifest-512x512.png',
    ]
    const missingIcons = iconFiles.filter((f) => !existsSync(resolve(publicDir, f)))
    if (missingIcons.length > 0) {
      warn(
        `public/ is missing basaltAppPlugin icon file(s): ${missingIcons.join(', ')} — generate ` +
          'them (e.g. via realfavicongenerator.net) and place them at the public/ root.',
      )
    } else {
      pass("public/ has all of basaltAppPlugin's default icon files")
    }
  }

  // ── Hard check 9: ai package major version parity across workspace packages ─
  // basalt/ai-sdk-major (the lint rule) is per-file against the NEAREST package.json, so a lint
  // run scoped to one workspace package only ever sees that package's own `ai` major and is
  // perfectly happy. The real defect is CROSS-package (argo defect 1: apps/api on ai@5 producing a
  // stream apps/dashboard's ai@7 client can't parse) and only a repo-wide manifest walk sees it —
  // this is that walk. Hard failure, not a warning: a skewed pair throws at runtime, it doesn't
  // just look different. `basalt.aiMajorSkewReason` exempts an INTENTIONAL skew (e.g. a
  // producer-side TransformStream neutralizing the divergent enum value) — see the BasaltConfig
  // JSDoc for its exact semantics; a stale declaration (skew resolved, reason still present) warns
  // instead of passing silently.
  const workspaceWalk = collectWorkspacePackages(cwd)
  const aiMajors = workspaceWalk.packages
    .map((pkg) => ({ name: pkg.name, major: aiMajorAt(pkg.dir) }))
    .filter((entry): entry is { name: string; major: number } => entry.major !== null)
  const { reason: aiMajorSkewReason, presentButInvalid: aiMajorSkewReasonInvalid } =
    resolveAiMajorSkewReason(cfg)
  if (aiMajors.length > 0) {
    const distinctMajors = new Set(aiMajors.map((entry) => entry.major))
    if (distinctMajors.size > 1) {
      const summary = aiMajors.map((entry) => `${entry.name}@ai${entry.major}`).join(', ')
      if (aiMajorSkewReason !== null) {
        pass(
          `ai package major version mismatch across workspace packages: ${summary} — exempted via ` +
            `basalt.aiMajorSkewReason: "${aiMajorSkewReason}"`,
        )
      } else if (aiMajorSkewReasonInvalid) {
        fail(
          `ai package major version mismatch across workspace packages: ${summary} — ` +
            'basalt.aiMajorSkewReason is present but is not a non-empty string (a bare `true` is ' +
            'not accepted); the exemption must carry a written reason, e.g. ' +
            '`aiMajorSkewReason: "apps/api on ai@5, apps/dashboard on ai@7, neutralized by a ' +
            'producer-side TransformStream"`.',
        )
      } else {
        fail(`ai package major version mismatch across workspace packages: ${summary}`)
      }
    } else {
      const [major] = distinctMajors
      if (aiMajorSkewReason !== null) {
        warn(
          `basalt.aiMajorSkewReason ("${aiMajorSkewReason}") is declared but the ai package major ` +
            `already matches across all ${aiMajors.length} workspace package(s) declaring it ` +
            `(ai@${major}) — the exemption is no longer needed and can be deleted.`,
        )
      } else {
        pass(
          `ai package major matches across ${aiMajors.length} workspace package(s) declaring it (ai@${major})`,
        )
      }
    }
  } else if (workspaceWalk.hasWorkspacesField) {
    // A hard check that can silently not run is worse than one that is absent — say so.
    pass('ai-major-parity: no workspace package declares the ai dependency — nothing to compare')
  }

  // ── Report ──────────────────────────────────────────────────────────────────
  // "All checks passed" is only printable when every check ran AND passed. A skipped check counts
  // against the exit code on its own — the report that dropped two of five checks and still
  // claimed green is the bug this footer exists to make impossible.
  lines.push('')
  if (result.hardFailures === 0 && result.warnings === 0 && result.skipped === 0) {
    lines.push('All checks passed.')
  } else {
    const parts: string[] = []
    if (result.hardFailures > 0) parts.push(`${result.hardFailures} hard failure(s)`)
    if (result.skipped > 0) parts.push(`${result.skipped} check(s) SKIPPED (could not run)`)
    parts.push(`${result.warnings} warning(s)`)
    lines.push(`${parts.join(', ')}.`)
  }
  lines.push('')

  if (result.hardFailures > 0 || result.skipped > 0) {
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
  description: string
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
      description: spec.description ?? `basalt-ui${key === '.' ? '' : key} subpath`,
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

/** Read the value that follows a `--flag` in an argv slice; `undefined` when absent or terminal. */
function flagValue(flags: string[], name: string): string | undefined {
  const i = flags.indexOf(name)
  if (i === -1) return undefined
  const value = flags[i + 1]
  return value === undefined || value.startsWith('--') ? undefined : value
}

/**
 * The generated-file header: the canonical marker line (imported from the guard, which owns it),
 * then the version + invocation that produced the file.
 *
 * Both lines are load-bearing, not decoration — `checkSource` only exempts a stylesheet whose line
 * 1 is the marker verbatim AND whose line 2 parses as this provenance line. Reword either half and
 * basalt starts reporting its own output again (116 findings in rollhook's token sheet).
 */
function generatedHeader(version: string, command: string, flags: string[]): string {
  const shown = flags.filter((f) => f !== '--check')
  const invocation = shown.length === 0 ? command : `${command} ${shown.join(' ')}`
  return `${GENERATED_HEADER_LINE}\n/* basalt-ui ${version} — \`basalt-ui ${invocation}\` */\n`
}

/**
 * Space- and number-normalize the argument list of a legacy color function so the emitted file
 * survives a normal repo's formatter.
 *
 * This is FORMATTING ONLY and deliberately the CLI's single deviation from "print exactly what
 * `buildPaletteCss` returned": `rgba(255,255,255,0.6)` and `rgba(255, 255, 255, 0.6)` are the same
 * colour, the shipped palette emits the first form on the dark side and the second on the light
 * side, and a consumer committing the output ate a lint-ignore entry for the difference. The token
 * VALUES are untouched — nothing here can change what basalt's tokens are.
 *
 * Trailing zeros go the same way and for the same reason: prettier rewrites `0.10` → `0.1`, so the
 * two `rgba(28, 25, 23, 0.10)` alphas in the light shadow tokens were the whole reason the one
 * framework-free consumer still could not lint its committed sheet — `--fix` and `tokens:css
 * --check` disagreed forever, and the lint-ignore entry survived two releases. Only a bare decimal
 * literal is touched (never a `%`, a `var()` or a unit), and `0.10`/`0.1` are the same number.
 *
 * Exported for tests, so the expectation can be computed rather than restated.
 */
export function normalizeColorFunctions(css: string): string {
  return css.replace(/\b(rgba?|hsla?)\(([^()]*)\)/g, (_match, fn: string, args: string) => {
    const parts = args.split(',').map((part) => normalizeCssNumber(part.trim()))
    return `${fn}(${parts.join(', ')})`
  })
}

/** `0.10` → `0.1`, `1.0` → `1`; anything that is not a bare decimal literal is returned verbatim. */
function normalizeCssNumber(arg: string): string {
  if (!/^\d+\.\d+$/.test(arg)) return arg
  return arg.replace(/\.?0+$/, '')
}

/** A scheme-class emission uses this sentinel attribute, then rewrites it to a class selector. */
const SCHEME_CLASS_SENTINEL = 'data-basalt-scheme-class'

/**
 * Write (or drift-check) a generated stylesheet. `--check` makes no writes and exits 1 when the
 * file on disk differs from what would be emitted — the CI gate for a committed `tokens:css`
 * artifact, mirroring `sync --check`. Without `--out` the content goes to stdout unchanged.
 */
function emitGeneratedCss(content: string, flags: string[], cwd: string, command: string): number {
  const out = flagValue(flags, '--out')
  const check = flags.includes('--check')
  if (out === undefined) {
    if (check) {
      console.error(
        `${command}: --check needs --out <path> — there is nothing to compare stdout to.`,
      )
      return 1
    }
    process.stdout.write(content)
    return 0
  }
  const target = isAbsolute(out) ? out : resolve(cwd, out)
  const shown = relative(cwd, target) || target
  if (check) {
    const onDisk = readIfExists(target)
    if (onDisk === null) {
      console.error(
        `✖ ${command} --check: ${shown} does not exist — run without --check to write it.`,
      )
      return 1
    }
    if (onDisk === content) {
      console.log(`✓ ${command} --check: ${shown} is up to date.`)
      return 0
    }
    console.error(
      `✖ ${command} --check: ${shown} differs from what \`basalt-ui ${command}\` emits today ` +
        `(on disk ${onDisk.split('\n').length} lines, emitted ${content.split('\n').length}) — ` +
        're-run the same command without --check and commit the result.',
    )
    return 1
  }
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content)
  console.log(`wrote ${content.split('\n').length} lines → ${shown}`)
  return 0
}

/**
 * tokens:css — emit the `--vx-*` stylesheet, optionally retargeted.
 *
 * The escape hatch from installing anything: a static site runs this once (`bunx basalt-ui
 * tokens:css --selector-attribute data-theme --out src/tokens.css`) and consumes basalt's token
 * system as plain CSS, with no package in its dependency tree at all. `basalt-ui/tokens.css` is the
 * same artifact for a consumer that does install; this command exists for the ones that shouldn't
 * have to just to change a selector.
 *
 * It parses flags and calls `buildPaletteCss` for the token VALUES — the CLI and the API must not
 * be able to disagree about what basalt's tokens are. What it adds is strictly file framing for an
 * artifact a consumer COMMITS: the `@generated` header (the guard's skip marker), a trailing
 * newline, and `rgba()` argument spacing. All three were reported by the one framework-free
 * consumer as the reasons the output could not simply be committed.
 */
export function tokensCss(flags: string[], cwd: string = process.cwd()): number {
  const attribute = flagValue(flags, '--selector-attribute')
  const schemeClass = flagValue(flags, '--selector-class')
  const lightClass = flagValue(flags, '--light-class')
  const darkValue = flagValue(flags, '--dark-value')
  const lightValue = flagValue(flags, '--light-value')
  const defaultScheme = flagValue(flags, '--default-scheme')

  const only = flagValue(flags, '--only')

  if (defaultScheme !== undefined && !['dark', 'light', 'none'].includes(defaultScheme)) {
    console.error(
      `tokens:css: --default-scheme must be dark, light or none (got '${defaultScheme}')`,
    )
    return 1
  }
  if (only !== undefined && !['core', 'all'].includes(only)) {
    console.error(`tokens:css: --only must be core or all (got '${only}')`)
    return 1
  }
  if (schemeClass !== undefined && attribute !== undefined) {
    console.error(
      'tokens:css: --selector-class and --selector-attribute are alternatives — pass one.',
    )
    return 1
  }
  if (schemeClass !== undefined && /[^\w-]/.test(schemeClass)) {
    console.error(
      `tokens:css: --selector-class must be a plain CSS class name (got '${schemeClass}')`,
    )
    return 1
  }
  if (lightClass !== undefined && /[^\w-]/.test(lightClass)) {
    console.error(`tokens:css: --light-class must be a plain CSS class name (got '${lightClass}')`)
    return 1
  }

  // A class selector is Tailwind's universal dark convention (`<html class="dark">`) and was
  // reachable before only by parking dark on the bare `:root` via --default-scheme. `buildPaletteCss`
  // emits attribute selectors, so the class form is produced by emitting against a sentinel
  // attribute this CLI chose itself and rewriting exactly those selectors — a rewrite of strings
  // the command generated deterministically, never of a token value.
  const resolvedDarkValue = schemeClass !== undefined ? schemeClass : darkValue
  const resolvedLightValue = schemeClass !== undefined ? (lightClass ?? 'light') : lightValue
  const resolvedAttribute = schemeClass !== undefined ? SCHEME_CLASS_SENTINEL : attribute

  const scheme = {
    ...(resolvedAttribute === undefined ? {} : { attribute: resolvedAttribute }),
    ...(resolvedDarkValue === undefined ? {} : { darkValue: resolvedDarkValue }),
    ...(resolvedLightValue === undefined ? {} : { lightValue: resolvedLightValue }),
  }

  let css = buildPaletteCss({
    ...(Object.keys(scheme).length === 0 ? {} : { scheme }),
    ...(defaultScheme === undefined
      ? {}
      : { defaultScheme: defaultScheme as 'dark' | 'light' | 'none' }),
    ...(flags.includes('--media-fallback') ? { mediaFallback: true } : {}),
    ...(only === undefined ? {} : { only: only as 'core' | 'all' }),
    // The tokens-only consumer is exactly the one who writes these names by hand, so they are also
    // the one who wants the deprecated camelCase aliases gone — and this command is their only
    // entry point. Without the flag the CLI and the API could disagree about what basalt's tokens
    // are, which is the one thing this command is documented never to allow.
    ...(flags.includes('--no-legacy-aliases') ? { legacyAliases: false } : {}),
  })

  if (schemeClass !== undefined) {
    css = css.replace(
      new RegExp(`\\[${SCHEME_CLASS_SENTINEL}='([\\w-]+)'\\]`, 'g'),
      (_match, value: string) => `.${value}`,
    )
  }

  const version = readFrameworkVersion(packageRoot())
  const content = `${generatedHeader(version, 'tokens:css', flags)}${normalizeColorFunctions(css)}\n`
  return emitGeneratedCss(content, flags, cwd, 'tokens:css')
}

/** Every `--basalt-font-*` declaration in the shipped stylesheet, in source order. */
function readShippedFontDecls(pkgRoot: string): { name: string; value: string }[] {
  const css = readSource(pkgRoot, 'dist/styles.css') ?? readSource(pkgRoot, 'src/styles.css')
  if (css === null) return []
  const decls: { name: string; value: string }[] = []
  for (const match of css.matchAll(/(--basalt-font[\w-]*)\s*:\s*([^;]+);/g)) {
    decls.push({
      name: match[1] as string,
      value: (match[2] as string).replace(/\s+/g, ' ').trim(),
    })
  }
  return decls
}

/**
 * fonts:css — emit the shipped `--basalt-font-*` stacks as plain CSS.
 *
 * The typeface half of the framework-free route, which had no supported path at all: `tokens.css`
 * emits no font vars, `styles.css` is the one place the defaults live and a framework-free consumer
 * is told not to import it, and `buildFontsCss` returns `''` unless the caller already knows the
 * stacks. The one non-Mantine consumer lost its font identity entirely and hardcoded the stacks —
 * which the theme guard then flagged as `raw-font-family`.
 *
 * The declarations are READ from the shipped stylesheet rather than restated here, so this command
 * and `basalt-ui/styles.css` can never name different typefaces. Note the fonts themselves are
 * `@fontsource-variable/*` packages: without them the stacks fall through to their own system
 * fallbacks, which is the intended framework-free behaviour.
 */
export function fontsCss(flags: string[], cwd: string = process.cwd()): number {
  const pkgRoot = packageRoot()
  const decls = readShippedFontDecls(pkgRoot)
  if (decls.length === 0) {
    console.error(
      'fonts:css: could not read the shipped font stacks from styles.css — this is a packaging ' +
        'bug in basalt-ui, not a config error.',
    )
    return 1
  }
  const body = `:root {\n${decls.map((d) => `  ${d.name}: ${d.value};`).join('\n')}\n}\n`
  const header = generatedHeader(readFrameworkVersion(pkgRoot), 'fonts:css', flags)
  return emitGeneratedCss(`${header}${body}`, flags, cwd, 'fonts:css')
}

/**
 * guard-hook — PreToolUse stdin adapter.
 *
 * Reads a JSON PreToolUse payload from stdin, evaluates it against the consumer's GuardConfig
 * (from the "basalt" key in the nearest package.json), and writes the Claude Code hook response
 * to stdout. Always exits 0 — the hook must never block Claude on a parse error or non-file tool.
 */
export async function guardHook(cwd: string = process.cwd()): Promise<number> {
  let raw: string
  try {
    // Bun: Bun.stdin.text() drains stdin to a string; under Node fall back to manual drain.
    if (typeof (globalThis as Record<string, unknown>)['Bun'] !== 'undefined') {
      raw = await globalThis['Bun'].stdin.text()
    } else {
      const chunks: Buffer[] = []
      for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
      raw = Buffer.concat(chunks).toString('utf8')
    }
  } catch {
    // Unreadable stdin → allow
    process.stdout.write(
      '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}\n',
    )
    return 0
  }

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    // Malformed JSON → allow (never block on a bad payload)
    process.stdout.write(
      '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}\n',
    )
    return 0
  }

  const cfg = readBasaltConfig(cwd)
  const guardCfg: GuardConfig = {
    spacingSteps: cfg.spacingSteps ?? DEFAULT_GUARD_CONFIG.spacingSteps,
    rawRadius: cfg.rawRadius ?? DEFAULT_GUARD_CONFIG.rawRadius,
    forbiddenAccents: cfg.forbiddenAccents ?? DEFAULT_GUARD_CONFIG.forbiddenAccents,
    mantineShadeIndex: cfg.mantineShadeIndex ?? DEFAULT_GUARD_CONFIG.mantineShadeIndex,
    rawSurface: cfg.rawSurface ?? DEFAULT_GUARD_CONFIG.rawSurface,
    cardWithBorder: cfg.cardWithBorder ?? DEFAULT_GUARD_CONFIG.cardWithBorder,
    offSystemSurfaceVar: cfg.offSystemSurfaceVar ?? DEFAULT_GUARD_CONFIG.offSystemSurfaceVar,
    rawHtmlLayout: cfg.rawHtmlLayout ?? DEFAULT_GUARD_CONFIG.rawHtmlLayout,
    inlineSpacing: cfg.inlineSpacing ?? DEFAULT_GUARD_CONFIG.inlineSpacing,
    inlineDisplay: cfg.inlineDisplay ?? DEFAULT_GUARD_CONFIG.inlineDisplay,
    rawVisxAxis: cfg.rawVisxAxis ?? DEFAULT_GUARD_CONFIG.rawVisxAxis,
    rawMotionValue: cfg.rawMotionValue ?? DEFAULT_GUARD_CONFIG.rawMotionValue,
    unframedChart: cfg.unframedChart ?? DEFAULT_GUARD_CONFIG.unframedChart,
    chartMissingAriaLabel: cfg.chartMissingAriaLabel ?? DEFAULT_GUARD_CONFIG.chartMissingAriaLabel,
    rawFormControl: cfg.rawFormControl ?? DEFAULT_GUARD_CONFIG.rawFormControl,
    sub16InputFont: cfg.sub16InputFont ?? DEFAULT_GUARD_CONFIG.sub16InputFont,
    allowComment: 'theme-allow',
    exemptRules: resolveExemptRules(cfg),
    severity: cfg.severity ?? DEFAULT_GUARD_CONFIG.severity,
    // Same detection check-theme uses: the hook must never block an edit over advice the app
    // cannot take ("use @mantine/core's Select") in a repo with no Mantine.
    ...(declaredProfile(cfg, []) === 'tokens-only' ? { profile: 'tokens-only' as const } : {}),
  }

  // Honor the consumer's roots / exempt / skip config so the hook never blocks edits to exempted
  // palette source or files outside the guarded roots (mirrors checkTheme's file-walk scoping).
  const roots = cfg.roots ?? DEFAULT_ROOTS
  const exempt = new Set(cfg.exempt ?? defaultExempt(cfg))
  const isInScope = (filePath: string): boolean => {
    const abs = isAbsolute(filePath) ? filePath : resolve(cwd, filePath)
    const rel = relative(cwd, abs).replace(/\\/g, '/')
    if (rel === '' || rel.startsWith('..')) return false
    if (SKIP.test(rel) || exempt.has(rel)) return false
    return roots.some((root) => {
      const r = root.replace(/\\/g, '/').replace(/\/+$/, '')
      return rel === r || rel.startsWith(`${r}/`)
    })
  }

  const result = evaluateGuardHook(payload, guardCfg, { isInScope })

  if (result.permissionDecision === 'deny' && result.reason !== undefined) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: result.reason,
        },
      }) + '\n',
    )
  } else {
    process.stdout.write(
      '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}\n',
    )
  }
  return 0
}

/** The one usage string — printed by `basalt help` / `--help` / `-h` AND the unknown-command fallback. */
const USAGE =
  'Usage: basalt-ui <init [--with-router] [--with-query] [--merge-lint] | sync [--force] [--check] |\n' +
  '                  check-theme [--audit-allows] | check-coverage | info [--json] |\n' +
  '                  doctor [--tokens-only|--framework] | guard-hook | tokens:css | fonts:css | help>\n\n' +
  'check-theme [--tokens-only|--framework] [--audit-allows]\n' +
  '  --audit-allows reports instead of scanning: every `theme-allow` annotation and every\n' +
  '  `basalt.exemptRules` entry, with what each one still suppresses — proved by re-running the\n' +
  '  guard with that one waiver neutralized, not by reading its text. Exits 1 on a waiver that\n' +
  '  suppresses nothing (dead), which is what makes it usable as a CI gate.\n\n' +
  'tokens:css [--out <path>] [--check] [--selector-attribute <attr> | --selector-class <class>]\n' +
  '           [--light-class <class>] [--dark-value <v>] [--light-value <v>]\n' +
  '           [--default-scheme <dark|light|none>] [--media-fallback] [--only <core|all>]\n' +
  '           [--no-legacy-aliases]\n' +
  '  Emit the --vx-* stylesheet (stdout unless --out). Defaults reproduce basalt-ui/tokens.css.\n' +
  '  --selector-class emits `:root.dark` instead of an attribute selector (the Tailwind convention).\n' +
  '  --check writes nothing and exits 1 when --out differs from what would be emitted (a CI gate).\n' +
  '  --no-legacy-aliases drops the deprecated camelCase spellings (--vx-accentFill and friends),\n' +
  '  which are emitted by default as aliases of the canonical kebab-case names.\n\n' +
  'fonts:css [--out <path>] [--check]\n' +
  '  Emit the shipped --basalt-font-* stacks as plain CSS — the typeface half of the token layer,\n' +
  '  otherwise reachable only by importing styles.css.\n\n' +
  'doctor [--tokens-only|--framework]\n' +
  '  Auto-detects a tokens-only consumer (no manifest + no @mantine/core) and checks only what\n' +
  '  applies. A check that cannot RUN is reported as SKIPPED and exits non-zero.\n\n' +
  'check-theme / doctor honour BASALT_CWD, and relocate to the single workspace package carrying a\n' +
  'basalt config when invoked from a repo root that has none — several carrying one is ambiguous\n' +
  'and exits 1 in BOTH. --tokens-only and --framework are alternatives; passing both is an error.\n\n' +
  'Every subcommand accepts --help / -h to print this message and exit without running.'

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
  switch (cmd) {
    case 'init':
      return init(cwd, {
        withRouter: flags.includes('--with-router'),
        withQuery: flags.includes('--with-query'),
        mergeLint: flags.includes('--merge-lint'),
      })
    case 'sync':
      return sync({ force: flags.includes('--force'), check: flags.includes('--check') }, cwd)
    case 'check-theme':
      return checkTheme(cwd, flags)
    case 'check-coverage':
      return checkCoverage()
    case 'info':
      return info(flags)
    case 'doctor':
      return doctor(cwd, flags)
    case 'guard-hook':
      return guardHook(cwd)
    case 'tokens:css':
      return tokensCss(flags, cwd)
    case 'fonts:css':
      return fontsCss(flags, cwd)
    default:
      console.error(USAGE)
      return 1
  }
}

// Re-export the managed-file manifest for testing / introspection (no default export).
// `normalizeForLedger` is exported so tests can compute a fixture's expected ledger hash without
// duplicating the normalization algorithm — it stays call-site-internal to writeUnit/classify.
export { managedFiles, MANIFEST_PATH, normalizeForLedger, RULE_NAMES, SKILL_NAMES }
export type { ManagedFile, Manifest, SyncOptions, DoctorResult }
