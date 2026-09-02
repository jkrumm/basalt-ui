/**
 * basalt-ui CLI — `init`, `sync`, `check-theme`, `doctor`.
 *
 * `checkTheme` is a thin FS walker over the headless guard core (`../guard`). It reads the
 * BasaltConfig, builds a GuardConfig, walks the source roots, calls `checkSource` per file,
 * collects Finding[], groups/reports findings, and returns an exit code.
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
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DEFAULT_GUARD_CONFIG, guardWaiverHint } from '../guard'
import type { GuardConfig, GuardKind, GuardSeverity } from '../guard'
import { RULE_NAMES, SKILL_NAMES } from '../surfaces'
import { checkTheme } from './check-theme'
import { doctor } from './doctor'
import { guardHook } from './guard-hook'
import { COMMAND_OPTIONS, USAGE, unknownFlag } from './help'
import { init } from './init'
import { sync } from './sync'
import { fontsCss, normalizeColorFunctions, tokensCss } from './tokens-css'

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
   * only). Each value is a list of patterns matched against a finding's relative path. A pattern
   * may be a whole path segment (`'agent'` matches `src/agent/x.tsx`, not `src/agenting.ts`), a
   * relative path (`'public/site.webmanifest'`), a directory prefix, or a glob — `*` stops at `/`,
   * `**` does not, and a slash-free glob also matches the basename, so `'*.module.css'` works.
   * A trailing `/` is stripped. An entry that suppresses nothing is reported, and
   * `check-theme --audit-allows` exits 1 on it. Default: `{}` (no exemptions).
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
export type ExemptRuleEntry = string[] | { paths: string[]; reason: string }

/** The paths half of an exemption entry, whichever form it was written in. */
export function exemptRulePaths(entry: ExemptRuleEntry | undefined): string[] {
  if (entry === undefined) return []
  return Array.isArray(entry) ? entry : entry.paths
}

/** The recorded reason for an exemption entry, or null for the bare-array form. */
export function exemptRuleReason(entry: ExemptRuleEntry | undefined): string | null {
  if (entry === undefined || Array.isArray(entry)) return null
  return entry.reason.trim().length > 0 ? entry.reason.trim() : null
}

/**
 * The guard-shaped `exemptRules` — paths only. The reason the object form carries never reaches
 * the guard: it is accountability for a human reading a diff and for `--audit-allows`, and giving
 * the scan a second shape to understand would only be a way for the two to disagree.
 */
export function resolveExemptRules(cfg: BasaltConfig): GuardConfig['exemptRules'] {
  if (cfg.exemptRules === undefined) return DEFAULT_GUARD_CONFIG.exemptRules
  const out: Partial<Record<GuardKind, string[]>> = {}
  for (const [kind, entry] of Object.entries(cfg.exemptRules)) {
    out[kind as GuardKind] = exemptRulePaths(entry)
  }
  return out
}

export const DEFAULT_ROOT = 'src'
export const DEFAULT_ROOTS = [DEFAULT_ROOT]

/**
 * The configured source roots, or the built-in default. The ONE resolution every roots-derived seed
 * reads — an empty `roots: []` falls back rather than resolving to nothing, because a bare `??`
 * would let `[]` through and render an empty oxfmt glob into the seeded CI, reproducing the exact
 * "matches zero files" break this derivation exists to prevent.
 */
export function resolveRoots(cfg: BasaltConfig): string[] {
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
export function defaultExempt(cfg: BasaltConfig): string[] {
  return [resolveSeriesModulePath(cfg)]
}

export const SKIP = /\.gen\.ts$|\.test\.[tj]sx?$|\.d\.ts$/
/** Filenames that look like they ARE the palette source, for the check-theme escape-hatch hint. */
export const SERIES_MODULE_HINT_RE = /(series|palette)\.tsx?$/i

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

export function readBasaltConfig(cwd: string): BasaltConfig {
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
 *
 * `astro`/`jsx`/`vue` close the same gap one component layer up. rollhook's marketing site is
 * Astro: `apps/marketing/src` holds two `.astro` templates that are its ENTIRE markup layer, and
 * check-theme reported a clean 4-file scan without ever opening either. The colour and typography
 * kinds apply to them exactly as they do to `.html`, which was already scanned; `.jsx` and `.vue`
 * were missing from the same regex, so a plain-JS or Vue consumer was unguarded end to end.
 */
const SCANNABLE_EXT = /\.(?:tsx?|jsx|astro|vue|css|html?|webmanifest)$/

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
export function relativePosix(fromDir: string, toPath: string): string {
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
export type BasaltInstall = {
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
export function shippedAssetPath(install: BasaltInstall, fromDir: string, asset: string): string {
  if (install.dir === null) return `./node_modules/basalt-ui/${asset}`
  return `${relativePosix(fromDir, install.dir)}/${asset}`
}

/**
 * Which directory a project-scoped command (`check-theme`, `doctor`) should actually read.
 *
 * One resolver, nothing inferred: `BASALT_CWD` when set, else the invocation cwd. A monorepo
 * package whose install lives elsewhere sets `BASALT_CWD` explicitly (or the invoking script's
 * `root:`/`cwd` does) rather than relying on workspace-glob discovery or an ancestor/descendant
 * walk — both were deleted (see `resolveProjectDir`'s own doc below) as multi-repo speculation for
 * a single-owner fleet where every consumer already runs its own commands from its own directory.
 * The scan scope within that directory is `basalt.roots` in `package.json` (default `src`).
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
 * - `doctor` no longer infers a profile at all (workspace-wide Mantine detection was deleted along
 *   with the rest of the multi-repo discovery); it reads the same declaration `check-theme` does.
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
export function conflictingProfileFlags(flags: readonly string[]): boolean {
  return flags.includes('--tokens-only') && flags.includes('--framework')
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
 * A path in the JSON family that is NOT a manifest — the sentinel that gets `guardWaiverHint`'s
 * plain-JSON closer. Used only by {@link waiverHintFor}; see its doc for why.
 */
const PLAIN_JSON_HINT_PATH = 'manifest.json'

/**
 * The waiver closer for a file, gated on the profile.
 *
 * `guardWaiverHint` keys off the file class, and for a `.webmanifest` it leads with
 * `basaltAppPlugin` — right for a Mantine app, since a hex in a manifest can never be *right* and
 * the plugin removes the hand-copy entirely. A `profile: tokens-only` consumer has definitionally
 * opted out of that layer: rollhook's Astro site has no `index.html` for the plugin to transform,
 * imports no basalt JavaScript at all, and owns maskable icons the plugin does not emit. Leading
 * with the plugin there is advice the consumer cannot take, in the one release that finally gave
 * that file class a remedy.
 *
 * So under tokens-only a manifest is treated as what it is to that consumer — plain JSON, with the
 * member as the whole answer — plus one sentence saying which remedy is being withheld and why.
 * The remedy text still comes from the guard's own registry; only the class mapping is decided here.
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
export const MANIFEST_PATH = '.basalt/manifest.json'

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

export function readIfExists(abs: string): string | null {
  if (!existsSync(abs)) return null
  return readFileSync(abs, 'utf8')
}

/** Read a shipped source asset from the package root; null if the sibling hasn't authored it yet. */
export function readSource(pkgRoot: string, source: string): string | null {
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
export function readFrameworkVersion(pkgRoot: string): string {
  try {
    const pkg = JSON.parse(readFileSync(resolve(pkgRoot, 'package.json'), 'utf8')) as {
      version?: string
    }
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

/**
 * How a seeded script, a seeded CI step, or a piece of doctor advice should invoke the CLI.
 *
 * The LOCAL bin wherever basalt actually resolved; `bunx basalt-ui` only as the pre-install
 * fallback. `bunx` does not re-resolve a package it has cached, so a seeded `bunx basalt-ui` lets a
 * consumer pin one version and be gated by another — which is exactly what happened across three
 * consumer repos, in CI, in package.json scripts and in a `.claude` PreToolUse hook, all of them
 * placed here. Every emitted invocation goes through this function so there is one place for it to
 * be right.
 */
export function basaltBinCommand(install: BasaltInstall, cwd: string): string {
  if (install.dir === null) return 'bunx basalt-ui'
  const binDir = resolve(install.dir, '..', '.bin')
  return `${relativePosix(cwd, binDir).replace(/^\.\//, '')}/basalt-ui`
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
    OXLINT_PRESET_PATH: shippedAssetPath(install, cwd, 'configs/oxlint.json'),
    LEFTHOOK_PRESET_PATH: shippedAssetPath(install, cwd, 'configs/lefthook.yml'),
    BASALT_BIN: basaltBinCommand(install, cwd),
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
export type ScaffoldFlags = {
  withRouter?: boolean
  withQuery?: boolean
  /** `--merge-lint`: splice the shipped preset's `extends` into an `.oxlintrc.json` init would keep. */
  mergeLint?: boolean
}

/** Router/query peer presence, resolved from detection + explicit flags. */
export type PeerFlags = { hasRouter: boolean; hasQuery: boolean }

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
export function resolvePeerFlags(cwd: string, flags: ScaffoldFlags): PeerFlags {
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
  /** Absolute path of a `query-client.ts` already present elsewhere under the package's `src/` (the
   *  consumer relocated it — e.g. to `src/lib/query-client.ts`), or null. The seed's OWN
   *  destination is deliberately excluded here — that exact-path case is handled by the ordinary
   *  skip-if-exists logic every seed file already goes through, unchanged. */
  relocatedQueryClient: string | null
}

/** The default placement — today's single-package-at-repo-root behaviour, unconditionally. */
export const ROOT_PLACEMENT: PlacementFlags = {
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
export function findRepoRoot(dir: string): string {
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
export function resolvePlacement(cwd: string): PlacementFlags {
  const repoRoot = findRepoRoot(cwd)
  return {
    isPackageRepoRoot: repoRoot === cwd,
    repoRoot,
    relocatedQueryClient: findRelocatedQueryClient(cwd),
  }
}

/** The full managed-file manifest. Stable, declarative — the single source of truth for init/sync. */
export function managedFiles(
  peers: PeerFlags,
  placement: PlacementFlags = ROOT_PLACEMENT,
): ManagedFile[] {
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

export type Manifest = {
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

/**
 * The two managed NAMESPACES whose membership is derived, not fixed: `RULE_NAMES` and `SKILL_NAMES`
 * decide which files `managedFiles()` places under them, so a rule or skill that is RETIRED
 * upstream leaves a file behind in every consumer that ever synced it — and Claude keeps loading it.
 *
 * Scoped to these two patterns on purpose, and never applied to the manifest wholesale: several
 * managed/seed entries are legitimately absent from `managedFiles()` for a run (`lefthook.yml` and
 * `check.yml` when the package is not the repo root, `src/query-client.ts` when it was relocated,
 * the scaffolds without their peers). Deleting a dest just because this run did not place it would
 * remove a consumer's CI workflow on a monorepo.
 */
const RETIREABLE_DEST_PATTERNS: readonly RegExp[] = [
  /^\.claude\/rules\/basalt-[a-z0-9-]+\.md$/,
  /^\.claude\/skills\/basalt-[a-z0-9-]+\/SKILL\.md$/,
]

/** A tracked dest inside a derived namespace that this basalt version no longer ships. */
export function retiredManagedDests(
  manifest: Manifest,
  files: readonly ManagedFile[],
): readonly string[] {
  const shipped = new Set(files.map((f) => f.dest))
  return Object.keys(manifest.files)
    .filter((dest) => !shipped.has(dest))
    .filter((dest) => RETIREABLE_DEST_PATTERNS.some((re) => re.test(dest)))
    .toSorted()
}

/** Outcome of one prune pass — `removed` was deleted, `drifted` was locally edited and left alone. */
export type PruneResult = { removed: string[]; drifted: string[] }

/**
 * Report a prune pass. Always names the files: a doctrine file DISAPPEARING from a consumer's
 * `.claude/` is exactly the class of change the sync diff exists to be reviewed, and `9 removed`
 * with no names is what made the kept-files line a false green before 1.23.0.
 */
export function reportPrune(pruned: PruneResult): void {
  if (pruned.removed.length > 0) {
    console.log(
      `\nRetired by this basalt-ui version (deleted — they no longer ship):\n` +
        pruned.removed.map((dest) => `  · ${dest}`).join('\n'),
    )
  }
  if (pruned.drifted.length === 0) return
  console.log(
    `\nRetired but locally edited, so left in place — your agent still loads them. Delete them, ` +
      'or run `basalt-ui sync --force`:\n' +
      pruned.drifted.map((dest) => `  · ${dest}`).join('\n'),
  )
}

/**
 * Delete the managed rule/skill files this basalt version retired, and drop their manifest entries.
 *
 * The 13→6 rule merge (`docs/CONTROLS-SPEC.md` §7) is the case this exists for: nine
 * `.claude/rules/basalt-*.md` files stopped shipping in one minor, and without this a consumer's
 * agent would go on reading `basalt-router.md`'s superseded placement doctrine forever, with
 * `sync --check` reporting green because nothing in the ledger asks about a dest the run no longer
 * places.
 *
 * Same three-way discipline as every other managed unit, so a consumer edit is never discarded
 * silently: an untouched file (matching its recorded hash, raw or normalized) is deleted and its
 * entry dropped; a locally-edited one is LEFT in place, reported, and keeps its entry so
 * `sync --check` stays red and `--force` can still finish the job. `dryRun` is `--check`.
 */
export function pruneRetiredManagedFiles(
  cwd: string,
  manifest: Manifest,
  files: readonly ManagedFile[],
  opts: { dryRun?: boolean; force?: boolean } = {},
): PruneResult {
  const result: PruneResult = { removed: [], drifted: [] }
  for (const dest of retiredManagedDests(manifest, files)) {
    const abs = resolve(cwd, dest)
    const current = readIfExists(abs)
    const recorded = manifest.files[dest]
    const untouched =
      current === null ||
      sha256(current) === recorded ||
      sha256(normalizeForLedger(current)) === recorded
    if (!untouched && opts.force !== true) {
      result.drifted.push(dest)
      continue
    }
    result.removed.push(dest)
    if (opts.dryRun === true) continue
    delete manifest.files[dest]
    if (current !== null) unlinkSync(abs)
    removeEmptyParentDir(abs)
  }
  return result
}

/**
 * Remove a now-empty `.claude/skills/basalt-x/` directory after its `SKILL.md` was pruned. Silent by
 * design — a leftover empty directory is cosmetic, and a consumer file sitting beside the skill is a
 * reason to keep it, not an error to report.
 */
function removeEmptyParentDir(fileAbs: string): void {
  const dir = dirname(fileAbs)
  try {
    if (readdirSync(dir).length === 0) rmdirSync(dir)
  } catch {
    /* not empty, not readable, or already gone — nothing to clean up */
  }
}

/** The frozen `> Managed by basalt-ui (1.9.0).` opener every pre-fix DESIGN.md seed carries. */
export function writeFileEnsuringDir(abs: string, content: string): void {
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}

/** Resolve the package root at runtime (two levels up from dist/cli/index.js). */
export function packageRoot(): string {
  return fileURLToPath(new URL('../../', import.meta.url))
}

/**
 * The current on-disk state of a managed unit, plus the version the framework wants. For a
 * marker-spliced file the "current" unit is the existing region (markers included); otherwise it
 * is the whole file.
 */
export type UnitState = {
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
export function unitState(file: ManagedFile, cwd: string, ctx: RenderContext): UnitState {
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
export function normalizeForLedger(text: string): string {
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
export function writeUnit(file: ManagedFile, cwd: string, desired: string): string {
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
export function classify(state: UnitState, manifestHash: string | undefined): Classification {
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

export function diffSummary(file: ManagedFile, state: UnitState): string {
  const cur = state.current ?? ''
  const des = state.desired ?? ''
  const curLines = cur.split('\n').length
  const desLines = des.split('\n').length
  return `  ~ ${file.dest} (local: ${curLines} lines, shipped: ${desLines} lines) — locally edited, skipped (use --force to overwrite)`
}

/** Build the render context for a run from the package root + consumer cwd/config. */
export function renderContext(cwd: string): RenderContext {
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
export function patchPackageJson(
  cwd: string,
  mutate: (pkg: Record<string, unknown>) => boolean,
): boolean {
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
export type RootsState =
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
export function reconcileRoots(cwd: string, opts: { write: boolean }): RootsState {
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
export function rootsNotices(state: RootsState): { log: string[]; error: string[] } {
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
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string
    if (inString) {
      out += ch
      if (ch === '\\') out += text[++i] ?? ''
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++
      continue
    } else if (ch === '/' && text[i + 1] === '*') {
      i += 2
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++
      i++
      continue
    }
    out += ch
  }
  return out.replace(/,(\s*[}\]])/g, '$1')
}

/** Parse a JSONC document, or null when it does not parse at all. */
export function parseJsonc(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(stripJsonc(text)) as Record<string, unknown>
  } catch {
    return null
  }
}

/** Outcome of splicing the shipped preset into an `.oxlintrc.json` the consumer already had. */
export type MergeLintResult = 'added' | 'already' | 'absent' | 'unreadable' | 'has-comments'

/**
 * The `extends` entry pointing at the shipped oxlint preset, or null when none does.
 *
 * Returns the ENTRY rather than a boolean because the string alone proves nothing: a consumer that
 * upgraded (or moved to an isolated linker) keeps a perfectly well-shaped
 * `./node_modules/basalt-ui/configs/oxlint.json` that resolves to nothing, and oxlint then refuses
 * to start with `NotFound` while a check built to prove the framework is ON reports green. The
 * caller resolves this against the config's own directory — see `extendsSeam`.
 */
export function basaltPresetEntry(entries: unknown): string | null {
  if (!Array.isArray(entries)) return null
  const match = entries.find(
    (entry): entry is string =>
      typeof entry === 'string' && entry.endsWith('basalt-ui/configs/oxlint.json'),
  )
  return match ?? null
}

// ── The lefthook gate — checked via `lefthook dump`, not hand-rolled YAML parsing ────────────────
//
// `lefthook dump` resolves `extends`/`include`/remote configs/`root:` the same way lefthook itself
// does, so this reads the MERGED config lefthook actually runs rather than pattern-matching the
// YAML text for an `extends:` entry (which cannot tell a resolvable seam from a broken one, and
// cannot see a gate spelled out directly instead of via `extends` at all). Best-effort: lefthook is
// a consumer tool basalt neither installs nor requires, so an absent binary or a dump that fails
// downgrades the verdict to a warning that says so, rather than inventing a pass or a fail.

const LEFTHOOK_CONFIG_NAMES = ['lefthook.yml', 'lefthook.yaml', '.lefthook.yml', '.lefthook.yaml']

/** The lefthook config present at `dir` (repo-root-relative name), or null when there is none. */
function findLefthookConfig(dir: string): string | null {
  return LEFTHOOK_CONFIG_NAMES.find((name) => existsSync(resolve(dir, name))) ?? null
}

/** Every command's `run:` string across every hook in a `lefthook dump --format json` payload. */
function lefthookDumpRunLines(dump: Record<string, unknown>): string[] {
  const out: string[] = []
  for (const hook of Object.values(dump)) {
    if (typeof hook !== 'object' || hook === null || !('commands' in hook)) continue
    const commands = (hook as { commands?: unknown }).commands
    if (typeof commands !== 'object' || commands === null) continue
    for (const command of Object.values(commands as Record<string, unknown>)) {
      const run = (command as { run?: unknown } | undefined)?.run
      if (typeof run === 'string') out.push(run)
    }
  }
  return out
}

export type LefthookGate =
  /** No such config file — nothing is wired, and that is a legitimate consumer choice. */
  | { readonly kind: 'no-file' }
  /** A command runs the guard — the gate exists. */
  | { readonly kind: 'wired'; readonly file: string }
  /** `lefthook dump` merged everything and no command runs the guard — provably no gate. */
  | { readonly kind: 'absent'; readonly file: string }
  /** A config exists but `lefthook dump --format json` could not be run or parsed. */
  | { readonly kind: 'unreadable'; readonly file: string }

export function inspectLefthookGate(repoRoot: string): LefthookGate {
  const file = findLefthookConfig(repoRoot)
  if (file === null) return { kind: 'no-file' }
  const localBin = resolve(repoRoot, 'node_modules/.bin/lefthook')
  const bin = existsSync(localBin) ? localBin : 'lefthook'
  let dump: Record<string, unknown> | null = null
  try {
    const result = spawnSync(bin, ['dump', '--format', 'json'], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 10_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    dump =
      result.error === undefined && result.status === 0
        ? (JSON.parse(result.stdout) as Record<string, unknown>)
        : null
  } catch {
    dump = null
  }
  if (dump === null) return { kind: 'unreadable', file }
  const wired = lefthookDumpRunLines(dump).some((run) => /\bcheck-theme\b/.test(run))
  return wired ? { kind: 'wired', file } : { kind: 'absent', file }
}

/**
 * Splice the shipped preset into an EXISTING `.oxlintrc.json` (`init --merge-lint`). Opt-in, not
 * automatic: turning the framework on adds real lint debt to previously-clean code (see the
 * lint-debt notice `init` prints), and that is a decision, not a scaffold step. Prepends the preset
 * so the consumer's own `extends` entries still win.
 */
export function mergeOxlintExtends(cwd: string, presetPath: string): MergeLintResult {
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

// ──────────────────────────────────────────────────────────────────────────────
// workspace-glob primitives — shared by findBasaltInstall and reconcileRoots (`doctor` moved to
// its own file in C2 and no longer walks the workspace: ai-major-parity is scoped to one
// package.json, and project resolution is BASALT_CWD → cwd, nothing inferred).
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Which shape of consumer a project-scoped command is looking at.
 *
 * `framework` — the Mantine app the scaffold is for. `tokens-only` — a consumer that took the
 * `--vx-*` layer and nothing else (rollhook: no Mantine, no manifest, `tokens:css` output). Telling
 * the second to "run `basalt-ui init`" is the wrong instruction: init scaffolds Mantine rules,
 * skills and a DESIGN.md it will never read. DECLARED only (`--framework` / `--tokens-only`, or
 * `"basalt": { "profile": "tokens-only" }`) — never inferred; see {@link declaredProfile}.
 */
export type DoctorProfile = 'framework' | 'tokens-only'

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
  // Before dispatch, for the same reason --help is: this answers "which basalt-ui is running" and
  // must never run a command to do it. `bunx` does not re-resolve a cached package, so a consumer
  // can pin 1.23.0, invoke `bunx basalt-ui`, and be gated by a months-old copy — the version is the
  // only thing that catches it, and it has to be one bare line an agent can compare.
  if (cmd === '--version' || cmd === '-v' || cmd === 'version') {
    console.log(readFrameworkVersion(packageRoot()))
    return 0
  }
  if (cmd !== undefined) {
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
      return init(cwd, {
        withRouter: flags.includes('--with-router'),
        withQuery: flags.includes('--with-query'),
        mergeLint: flags.includes('--merge-lint'),
      })
    case 'sync':
      return sync(
        { force: flags.includes('--force'), check: flags.includes('--check'), flags },
        cwd,
      )
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
export { RULE_NAMES, SKILL_NAMES }
export type { ManagedFile }

// Re-export every split-out command so `import { X } from './index'` keeps working — `index.ts` is
// dispatch + shared helpers only (C2); the command implementations live in their own files.
export { checkTheme, doctor, guardHook, init, sync, fontsCss, normalizeColorFunctions, tokensCss }
export type { SyncOptions } from './sync'
export type { DoctorResult } from './doctor'
