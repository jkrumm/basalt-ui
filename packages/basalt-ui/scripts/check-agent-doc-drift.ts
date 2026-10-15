/**
 * Agent-doc drift guard: fails the build when a managed doc under `agent/rules/**` or
 * `agent/skills/**` names an export that doesn't exist. Two removed-API misses reached a
 * consumer this way already (1.16.0 fixed a CLAUDE.md block still naming `ChartTooltip`; a
 * consumer then found `agent/skills/basalt-design/SKILL.md` still naming it two lines further
 * down) — this is the gate that replaces "a human happens to read the right line".
 *
 * Two complementary checks, because neither alone is sufficient:
 *
 * Check A — bolded-backtick claim, no list to maintain. The docs use `**\`Name\`**` when naming a
 * shipped primitive to compose (`**\`AxisBottomDate\`**` in basalt-charts.md). Every such
 * single-identifier claim is asserted against the real export surface: value exports from
 * `scripts/export-surface.json`, unioned with type exports collected from the `index.ts` barrels
 * under `src/**` (the JSON snapshot only tracks values — see `export-surface.mjs`). A small allowlist
 * covers the same bold-backtick form used for a literal token VALUE rather than an export name
 * (`**\`blue\`**`, `**\`sm\`**`) — each entry documents why it isn't a drift finding.
 *
 * Check B — a denylist, for the plain-backtick cases Check A can't see (`` `ChartCard` /
 * `ChartTooltip` `` uses plain backticks, and plain backticks are far too common to check
 * wholesale). Removed APIs are hand-listed with their replacement and banned outright from
 * `agent/**` AND from JSDoc/line-comment blocks in `src/**\/*.{ts,tsx}` (a stale JSDoc pointer
 * ships straight into `dist/*.d.ts` and is exactly as consumer-visible as a stale `.md` — the
 * comment-masking approach mirrors `tests/jsdoc-specifiers.test.ts`'s block/line-comment
 * extractor, but keeps line numbers so failures point at a real line). Guarded both ways: every
 * denylist name is also asserted ABSENT from the real export surface, so an entry that gets
 * re-introduced as a live export fails loudly instead of silently banning something real.
 *
 * Check D — a deleted-doc denylist. A comment citing a doc path that no longer exists is neither a
 * stale export nor a removed API, so A/B/C all miss it; the path is hand-listed with its new home
 * and scanned across `agent/**`, `src/**` comments and the shipped `configs/**` plugin.
 *
 * Check E — import specifiers. Every `basalt-ui[/sub]` specifier inside a fenced code block of an
 * `agent/**` doc must resolve against `package.json` `exports` (`basalt-ui` ↔ `.`, `basalt-ui/x` ↔
 * `./x`, `./configs/*` is a glob). A folded or dropped subpath (`basalt-ui/notifications`) keeps
 * compiling in prose and fails only in the consumer's editor, which is how it shipped before.
 *
 * Check F — enforcement tags. Every bullet in `agent/rules/*.md` (outside fenced code) ends in at
 * least one tag naming what enforces it — `[basalt/<rule>]` (a shipped oxlint plugin rule),
 * `[check-theme <kind>]` (a guard kind) or `[type <Name>]` (an exported name whose signature makes
 * the mistake a tsc error) — and every tag must resolve. A rule file holds headings, bullets,
 * fenced examples and at most ONE intro line under the H1; a table or a paragraph is an
 * instruction nothing enforces, so it fails.
 *
 * Check G — rule citations. No `agent/**` file may name a repo-local plugin rule (it is not in a
 * consumer's `configs/`) or a rule that 2.0 removed (its concern is a type now).
 *
 * Check H — `llms.txt` header. The entry-point lines (`# basalt-ui/x   NameA, NameB`) name symbols by
 * hand; each must be a published export, so a rename fails the gate instead of shipping stale.
 *
 * Repo-local only: `scripts/` is absent from package.json's `files`, so this reads
 * non-shipped state (`scripts/export-surface.json`) and must not be reachable from a consumer's
 * `node_modules/basalt-ui` — unlike `check-coverage`, it does not belong behind the shipped CLI.
 * It runs as its own CI step instead, right after the coverage check.
 *
 * Usage: bun packages/basalt-ui/scripts/check-agent-doc-drift.ts
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { REPO_LOCAL_RULES } from './check-coverage'
import * as pluginModule from '../configs/oxlint-plugin.js'
import { SURFACES } from '../src/surfaces'
import { GUARD_RULES, TOKENS_ONLY_DISABLED_KINDS } from '../src/guard/index'

const pkgRoot = join(import.meta.dirname, '..')

// ── valid names: value exports (export-surface.json) ∪ type exports (src/**/index.ts barrels) ─────

function collectValueExports(): Set<string> {
  const snapshot = JSON.parse(
    readFileSync(join(pkgRoot, 'scripts/export-surface.json'), 'utf8'),
  ) as Record<string, string[]>
  const names = new Set<string>()
  for (const list of Object.values(snapshot)) {
    for (const name of list) names.add(name)
  }
  return names
}

function findBarrelFiles(): string[] {
  const srcRoot = join(pkgRoot, 'src')
  const entries = readdirSync(srcRoot, { recursive: true }) as string[]
  return entries.filter((rel) => /(^|\/)index\.tsx?$/.test(rel)).map((rel) => join(srcRoot, rel))
}

const TYPE_BLOCK_RE = /export\s+type\s*\{([^}]*)\}/g
/** `export { type A, B }` — inline `type` modifiers inside a value export list. */
const VALUE_BLOCK_RE = /^export\s*\{([^}]*)\}/gm
const DIRECT_TYPE_RE = /^export\s+(?:type|interface)\s+([A-Za-z_$][\w$]*)/gm

/** Type names one barrel/entry source exports — direct declarations and re-export lists. */
function addTypeNames(src: string, names: Set<string>): void {
  for (const match of src.matchAll(TYPE_BLOCK_RE)) {
    for (const item of (match[1] ?? '').split(',')) {
      const trimmed = item.trim()
      if (trimmed.length === 0) continue
      const asMatch = trimmed.match(/\bas\s+([A-Za-z_$][\w$]*)\s*$/)
      const asName = asMatch?.[1]
      names.add(asName ?? trimmed.replace(/^type\s+/, ''))
    }
  }
  for (const match of src.matchAll(VALUE_BLOCK_RE)) {
    for (const item of (match[1] ?? '').split(',')) {
      const inline = item.trim().match(/^type\s+(?:[\w$]+\s+as\s+)?([A-Za-z_$][\w$]*)$/)
      if (inline?.[1] !== undefined) names.add(inline[1])
    }
  }
  for (const match of src.matchAll(DIRECT_TYPE_RE)) {
    const name = match[1]
    if (name !== undefined) names.add(name)
  }
}

/** Every type name a `src/**\/index.ts(x)` barrel exports. */
function collectTypeExports(): Set<string> {
  const names = new Set<string>()
  for (const file of findBarrelFiles()) addTypeNames(readFileSync(file, 'utf8'), names)
  return names
}

type ExportsManifest = Record<string, { import?: string } | string>

/** `package.json` `exports`, keyed by subpath (`.`, `./charts`, …). */
function readExportsManifest(): ExportsManifest {
  const manifest = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')) as {
    exports: ExportsManifest
  }
  return manifest.exports
}

/** `.` → `basalt-ui`, `./charts` → `basalt-ui/charts`. */
function subpathSpec(subpath: string): string {
  return subpath === '.' ? 'basalt-ui' : `basalt-ui${subpath.slice(1)}`
}

/** The source entry (`src/**`) behind one `exports` target's `import` path; undefined for assets. */
export function resolveSubpathEntry(target: ExportsManifest[string]): string | undefined {
  const js = typeof target === 'object' ? target.import : undefined
  if (js === undefined) return undefined
  const base = join(pkgRoot, 'src', js.replace(/^\.\/dist\//, '').replace(/\.js$/, ''))
  return [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find(existsSync)
}

/**
 * The PUBLISHED surface per subpath (`basalt-ui`, `basalt-ui/charts`, …): value exports
 * (`export-surface.json`) plus the type names exported by the source entry of that `package.json`
 * `exports` subpath — the same reading `check-budgets`' `barrelTypeExports` uses. A type exported
 * only from an internal barrel is not importable by a consumer, so a `[type X]` tag may not cite it.
 */
export function collectPublishedBySubpath(): Map<string, Set<string>> {
  const values = JSON.parse(
    readFileSync(join(pkgRoot, 'scripts/export-surface.json'), 'utf8'),
  ) as Record<string, string[]>
  const bySubpath = new Map<string, Set<string>>()
  for (const [subpath, target] of Object.entries(readExportsManifest())) {
    const names = new Set(values[subpath] ?? [])
    const entry = resolveSubpathEntry(target)
    if (entry !== undefined) addTypeNames(readFileSync(entry, 'utf8'), names)
    bySubpath.set(subpathSpec(subpath), names)
  }
  return bySubpath
}

/** The union of {@link collectPublishedBySubpath}. */
export function collectPublishedNames(): Set<string> {
  return new Set([...collectPublishedBySubpath().values()].flatMap((names) => [...names]))
}

export function collectValidNames(): Set<string> {
  return new Set([...collectValueExports(), ...collectTypeExports()])
}

// ── agent/**/*.md file list ──────────────────────────────────────────────────

export function findAgentMdFiles(): string[] {
  const agentRoot = join(pkgRoot, 'agent')
  const entries = readdirSync(agentRoot, { recursive: true }) as string[]
  return entries.filter((rel) => rel.endsWith('.md')).map((rel) => join(agentRoot, rel))
}

// ── Check A: bolded-backtick export claims ───────────────────────────────────

const IDENTIFIER_RE = /^[A-Za-z_$][\w$]*$/
const BOLD_BACKTICK_RE = /\*\*`([^`]+)`\*\*/g

/**
 * Bold-backtick spans that name a real thing but not a basalt-ui export — a literal token/size
 * VALUE quoted in the same emphasis form the docs use for a component name. Each entry documents
 * why it is not drift, per the brief: allowlist, don't silently exclude.
 */
export const CHECK_A_ALLOWLIST: ReadonlyMap<string, string> = new Map([
  ['blue', "basalt-tokens.md — the earned accent hue VALUE ('blue'), not an export"],
  ['gray', "basalt-tokens.md — the neutral accent hue VALUE ('gray'), not an export"],
  ['sm', "basalt-mantine.md — a Mantine size-token VALUE ('sm'), not an export"],
])

export type CheckAFailure = { file: string; line: number; name: string }

export function checkA(
  mdFiles: readonly string[],
  validNames: ReadonlySet<string>,
): CheckAFailure[] {
  const failures: CheckAFailure[] = []
  for (const file of mdFiles) {
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((lineText, idx) => {
      for (const match of lineText.matchAll(BOLD_BACKTICK_RE)) {
        const name = match[1] ?? ''
        if (!IDENTIFIER_RE.test(name)) continue
        if (CHECK_A_ALLOWLIST.has(name)) continue
        if (validNames.has(name)) continue
        failures.push({ file: relative(pkgRoot, file), line: idx + 1, name })
      }
    })
  }
  return failures
}

// ── Check B: removed-API denylist ─────────────────────────────────────────────

/**
 * Removed APIs, hand-listed because their plain-backtick mentions are invisible to Check A.
 * Confirmed removed (JSDoc in the built dist explicitly documents the replacement):
 * `ChartTooltip`, `useChartTooltip`, `useHoverSync`, `ChartHoverSync`, `ResponsiveChart`. The
 * remaining four (`HoverContext`, `useTooltipStyles`, `BarsAxisConfig`, `ZonedLineTooltipLabel`)
 * have no trace in the current dist — seeded per the brief's sweep list anyway, mapped to the
 * closest current equivalent, so a doc that starts naming them again fails immediately rather
 * than shipping unnoticed.
 */
export const REMOVED_APIS: Readonly<Record<string, string>> = {
  ChartTooltip: 'the `tooltip` prop (ChartTooltipConfig)',
  useChartTooltip: 'the `tooltip` prop (ChartTooltipConfig)',
  useHoverSync: 'chartCursor',
  HoverContext: 'chartCursor',
  ChartHoverSync: 'cursorGroup',
  ResponsiveChart: 'CartesianChart',
  useNav: '<BasaltShell nav={NAV}>',
  useTooltipStyles: 'the `tooltip` prop (ChartTooltipConfig)',
  BarsAxisConfig: 'AxisConfig',
  ZonedLineTooltipLabel: 'tooltip.rows',
  // ── 2.0 chart layer (docs/V2-SPEC.md § 9; the full fate table is MIGRATING.md § 2.0) ──
  // Kinds folded into `Lines` / `Sparkline`. The deleted kinds that W5 may rebuild under their own
  // name (StackedArea, DualPanel, MirroredBars, BandStrip, Donut, Heatmap) are NOT denylisted: the
  // docs name them as "not shipped", and an entry here would ban that sentence and the return.
  ZonedLine: 'Lines',
  ZonedLineProps: 'LinesProps',
  ZonedLineThreshold: 'Threshold',
  ZonedLineRefLine: 'RefLine',
  MultiLine: 'Lines',
  MultiLineProps: 'LinesProps',
  BarsRefLine: 'RefLine',
  LineSparkline: 'Sparkline (not shipped in 2.0.0)',
  BarSparkline: 'Sparkline (not shipped in 2.0.0)',
  // The assembly and hand-drawn primitives: the host owns frame, axes, overlay and tooltip now.
  ChartFrame: 'CartesianChart',
  ChartFrameProps: 'CartesianChartProps',
  ChartFrameLegend: 'ChartLegendConfig',
  ChartLegend: 'legend.placement',
  ChartTooltipFloat: 'the `tooltip` prop (ChartTooltipConfig)',
  TooltipHeader: 'tooltip.formatHeader',
  TooltipRow: 'tooltip.rows',
  TooltipBody: 'tooltip.rows',
  CartesianTooltipConfig: 'ChartTooltipConfig',
  BandTooltipConfig: 'ChartTooltipConfig',
  Crosshair: 'the engine crosshair',
  SeriesDot: 'the engine focus ring',
  HoverOverlay: 'the engine keyboard focus',
  AxisBottomDate: 'CartesianChart',
  AxisBottomNumeric: 'CartesianChart',
  AxisLeftNumeric: 'AxisConfig',
  AxisRightNumeric: 'AxisConfig (y2)',
  ZoneRects: 'ZoneSpec',
  XZoneRects: 'XZoneSpec',
  AreaGradient: 'ChartSeries.area',
  areaFillUrl: 'ChartSeries.area',
  HatchPattern: 'a flat fill (V2-SPEC § 9.9)',
  hatchFill: 'a flat fill (V2-SPEC § 9.9)',
  hatchSizeFor: 'a flat fill (V2-SPEC § 9.9)',
  VxThemeProvider: 'var(--vx-*) references',
  useVxTheme: 'var(--vx-*) references',
  useChartSize: 'the host measures',
  // Cursor: the 1.x store and hooks became `chartCursor(group?)` + `cursorGroup`.
  ChartCursorScope: 'cursorGroup',
  ChartCursorScopeProps: 'cursorGroup',
  globalCursorStore: 'chartCursor',
  createCursorStore: 'chartCursor',
  useCursorState: 'chartCursor + useSyncExternalStore',
  useChartCursor: 'chartCursor',
  // Layout and ticks: measured by the engine.
  autoMargin: 'the engine measured guides',
  probeAxisLabels: 'the engine measured guides',
  measureText: 'the engine measured guides',
  maxTextWidth: 'the engine measured guides',
  smartTicks: 'xTicks + tickLabels.thin',
  smartTicksEvery: 'xTicks + tickLabels.thin',
  xLabelPxFor: 'xTicks + tickLabels.thin',
  autoXLabelRotate: 'xTicks + tickLabels.thin (labels never rotate)',
  chartMargin: 'the engine measured guides',
  ChartMargin: 'the engine measured guides',
  // Formatters: `./format` only.
  fmtAxisDate: 'basalt-ui/format',
  fmtTooltipDate: 'basalt-ui/format',
  // ── 1.19.0 native mobile nav: the render-callback seam became a component seam ──
  // `SidebarItem.Anchor` (a `NavAnchor`) replaces all three render callbacks, and the mobile
  // model's own row/section types moved into `src/nav/types.ts`.
  NavLinkRenderer: 'NavAnchor',
  MobileNavLinkRenderer: 'NavAnchor',
  BreadcrumbLinkRenderer: 'NavAnchor',
  MobileNavItem: 'SidebarItem',
  MobileNavSection: 'MobileNavSlot',
  // ── 1.26.0 ── The enum-only stores survive as deprecated wrappers (removed in 1.29.0), so they
  // are deliberately NOT denylisted; `useOnlineStatus` is gone outright (A12).
  useOnlineStatus: 'useConnectivity',
  // ── 1.27.0 controls tier ── The controlled article filter bar became the store-bound controls of
  // `./controls`; `FilterSet` is the container, `ViewTabs`/`MultiSelectFilter` the two axes it held.
  ArticleFilterBar: 'FilterSet',
  // ── waves 3+4 (CONTROLS-SPEC) ── the page-action portal became `PageBar`; its provider/outlet
  // are internal to `BasaltShell` now. `BasaltDataTable.toolbarActions` was renamed `actions`.
  PageActions: 'PageBar',
  PageActionsOutlet: 'PageBar',
  PageHeaderProvider: 'PageBar',
  toolbarActions: 'actions',
}

/**
 * Normalize a doc line before denylist matching: decode HTML entities and strip HTML tags, so a
 * name a human READS as `ChartTooltip` cannot slip past because the source spells it
 * `ChartTool&#116;ip` or `ChartTool<span></span>tip`.
 *
 * The threat model here is honest: these docs are written by us and by agents, not by an attacker,
 * and nobody drifts a doc by entity-encoding a letter. This exists because the guard CLAIMS to ban
 * a removed API "in any form", and a check whose stated invariant is wider than its implementation
 * is how a gate earns trust it hasn't got. Cheap to close, so closed.
 */
export function normalizeForDenylist(lineText: string): string {
  return lineText
    .replace(/<[^>]*>/g, '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
}

export type CheckBFailure = { file: string; line: number; name: string; replacement: string }

export function checkB(mdFiles: readonly string[]): CheckBFailure[] {
  const failures: CheckBFailure[] = []
  const entries = Object.entries(REMOVED_APIS)
  for (const file of mdFiles) {
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((lineText, idx) => {
      const normalized = normalizeForDenylist(lineText)
      for (const [name, replacement] of entries) {
        if (new RegExp(`\\b${name}\\b`).test(normalized)) {
          failures.push({ file: relative(pkgRoot, file), line: idx + 1, name, replacement })
        }
      }
    })
  }
  return failures
}

// ── Check B, src comments: same denylist against JSDoc/line comments in shipped source ──────

/** Every `.ts`/`.tsx` file under `src/**` — comment JSDoc ships straight into `dist/*.d.ts`. */
export function findSrcTsFiles(): string[] {
  const srcRoot = join(pkgRoot, 'src')
  const entries = readdirSync(srcRoot, { recursive: true }) as string[]
  return entries.filter((rel) => /\.tsx?$/.test(rel)).map((rel) => join(srcRoot, rel))
}

const BLOCK_COMMENT_RE = /\/\*[\s\S]*?\*\//g
// A negative lookbehind on `:` excludes `http://`/`https://`/`ws://` — a `//` inside one of those,
// run against the UNMASKED source (this function has no string-literal parser), used to start a
// fake "line comment" that swallowed the rest of the real code on that line as if it were comment
// prose, which could both hide a real drifted reference and manufacture a false one out of code
// text. `tests/jsdoc-specifiers.test.ts` runs a plain `\/\/.*$` with no such guard — that file
// only ever concatenates matched comment TEXT for a denylist scan, so a `://` false-positive there
// costs it a spurious substring inside otherwise-discarded code, not a wrong line number; this
// function's masked output is fed back through by character position, where getting it wrong
// actually corrupts `checkBSrc`'s line-accurate report.
const LINE_COMMENT_RE = /(?<!:)\/\/.*/g

/**
 * Blanks every character outside a comment while preserving newlines (so line numbers survive),
 * leaving a same-shaped string where the only surviving content is JSDoc/line-comment text.
 * `checkBSrc` reads real line numbers off this masked output, so a `//` mistaken for the start of a
 * comment (an `http://` URL in a string) must not swallow the rest of a code line as fake comment
 * text.
 */
function maskToComments(source: string): string {
  const masked = source.replace(/[^\n]/g, ' ').split('')
  const keep = (start: number, length: number): void => {
    for (let i = start; i < start + length; i++) {
      if (source[i] !== '\n') masked[i] = source[i]
    }
  }
  for (const match of source.matchAll(BLOCK_COMMENT_RE)) keep(match.index, match[0].length)
  for (const match of source.matchAll(LINE_COMMENT_RE)) keep(match.index, match[0].length)
  return masked.join('')
}

/**
 * `(relative-path, removedName)` pairs where a `REMOVED_APIS` name appears in a `src` comment as
 * historical color — "the removed X", "replaced by", "renamed from", "supersedes X's job" — that
 * NAMES the old symbol to explain the current one, not a stale pointer telling a consumer to use
 * it. Same allowlist-don't-silently-exclude doctrine as `CHECK_A_ALLOWLIST`, scoped to (file,
 * name) rather than name alone so a genuinely stale "use `X`" pointer landing on a NEW line
 * elsewhere in the package still fails.
 */
export const CHECK_B_SRC_ALLOWLIST: ReadonlySet<string> = new Set([
  'src/connectivity/use-connectivity.ts::useOnlineStatus',
  'src/surfaces.ts::ArticleFilterBar',
  'src/shell/page-bar.tsx::PageActions',
  'src/content/index.ts::ArticleFilterBar',
  'src/table/data-table.tsx::toolbarActions',
])

export function checkBSrc(tsFiles: readonly string[]): CheckBFailure[] {
  const failures: CheckBFailure[] = []
  const entries = Object.entries(REMOVED_APIS)
  for (const file of tsFiles) {
    const relFile = relative(pkgRoot, file)
    const lines = maskToComments(readFileSync(file, 'utf8')).split('\n')
    lines.forEach((lineText, idx) => {
      for (const [name, replacement] of entries) {
        if (CHECK_B_SRC_ALLOWLIST.has(`${relFile}::${name}`)) continue
        if (new RegExp(`\\b${name}\\b`).test(lineText)) {
          failures.push({ file: relFile, line: idx + 1, name, replacement })
        }
      }
    })
  }
  return failures
}

/**
 * Guards `maskToComments`/`LINE_COMMENT_RE` itself, against a fixture rather than any file
 * currently on disk — so it catches a regression on the regex, not on today's source happening to
 * lack a `://` URL. Two failure modes in one fixture: a `//` inside `https://` must not be read as
 * a line-comment start (it would blank the URL's OWN "//" but then keep everything after it on the
 * line, including real non-comment text, as if it were comment prose — false-positive material for
 * `checkBSrc`), and a genuine trailing `//` comment later on the SAME line must still be recognized
 * once the URL stops swallowing it.
 */
export function checkMasksUrlSlashesCorrectly(): string[] {
  const failures: string[] = []
  const fixture = "const DOC_URL = 'https://example.com/removed-info' // real note here\n"
  const masked = maskToComments(fixture)
  if (masked.includes('example.com/removed-info')) {
    failures.push(
      "maskToComments: the '//' inside a 'https://' URL is being read as a line-comment start, " +
        'so the URL text (and whatever real code follows it on the line) is kept as if it were ' +
        'comment prose',
    )
  }
  if (!masked.includes('real note here')) {
    failures.push(
      "maskToComments: a genuine trailing '//' comment after a URL literal on the same line is no " +
        'longer being kept',
    )
  }
  return failures
}

/** Guards the denylist itself: a name on it that becomes a live export again must fail loudly. */
export function checkDenylistIsGenuinelyRemoved(validNames: ReadonlySet<string>): string[] {
  const failures: string[] = []
  for (const name of Object.keys(REMOVED_APIS)) {
    if (validNames.has(name)) {
      failures.push(
        `REMOVED_APIS['${name}'] is denylisted as removed but IS a live export — update the ` +
          `replacement or delete the entry (it is otherwise silently banning a real API)`,
      )
    }
  }
  return failures
}

// ── Check D: a citation of a doc file that no longer exists ───────────────────
//
// A comment or doc that cites `docs/waves/RESPONSIVE-SPEC.md` reads as authoritative and leads a
// reader to a path that isn't there — the drift `Check A`/`Check B` cannot see, because it names
// neither an export nor a removed API. Every deleted doc is hand-listed with its current home(s);
// the scan covers every markdown file in the repo (agent docs, `docs/**`, the root AGENTS.md, MAINTAINING.md) and the
// shipped oxlint plugin's own message strings (`configs/**/*.js`, where the `raw-breakpoint` rule's
// messages live — a rule message is as consumer-visible as prose), both scanned RAW; `src/**` JSDoc
// is the one masked half, so a string literal that merely happens to contain a dead path is not a
// citation.

/** Deleted bare filename → the doc path(s) its citations should now point at. */
export const DELETED_DOCS: Readonly<Record<string, string>> = {
  'RESPONSIVE-SPEC.md':
    'docs/DESIGN-CORE.md § Layout, elevation, shapes / docs/V2-SPEC.md § 9 / docs/CONTROLS-SPEC.md §2, §6',
  // Archived with the 1.x chart layer; the 2.0 chart law is V2-SPEC § 9. The key carries the
  // `docs/` prefix so a citation of the archived copy (`docs/archive/CHARTS-SPEC.md`) still passes.
  'docs/CHARTS-SPEC.md': 'docs/V2-SPEC.md § 9',
}

/** Every `.js` file under `configs/**` — the shipped oxlint plugin carries citations in messages. */
export function findConfigsJsFiles(): string[] {
  const configsRoot = join(pkgRoot, 'configs')
  const entries = readdirSync(configsRoot, { recursive: true }) as string[]
  return entries.filter((rel) => rel.endsWith('.js')).map((rel) => join(configsRoot, rel))
}

/** History cites docs as they were then; rewriting it would falsify it (mirrors check-budgets' `APPEND_ONLY_DOCS`). */
const isHistory = (file: string): boolean => {
  const rel = relative(join(pkgRoot, '..', '..'), file).replaceAll('\\', '/')
  return rel.startsWith('docs/archive/') || rel === 'docs/MATURATION-LEDGER.md'
}

export type CheckDFailure = { file: string; line: number; doc: string; replacement: string }

/**
 * `rawFiles` (markdown, and the shipped oxlint plugin's `.js` message strings) are scanned raw — a
 * `.md` file IS prose and a rule message IS consumer-visible text, so there is no comment to mask
 * to. `commentFiles` (`src/**` `.ts`) are scanned through {@link maskToComments} so only a
 * JSDoc/line comment naming the dead path fails — a string literal that merely happens to contain
 * it does not.
 */
export function checkD(
  rawFiles: readonly string[],
  commentFiles: readonly string[],
): CheckDFailure[] {
  const failures: CheckDFailure[] = []
  // A path-keyed entry fires only once that doc is gone from THIS tree: a doc is listed in the
  // wave that archives it, which may land on master before or after the branch citing it.
  const entries = Object.entries(DELETED_DOCS).filter(
    ([doc]) => !doc.includes('/') || !existsSync(join(pkgRoot, '..', '..', doc)),
  )
  const scan = (file: string, lines: string[]): void => {
    lines.forEach((lineText, idx) => {
      for (const [doc, replacement] of entries) {
        if (lineText.includes(doc)) {
          failures.push({ file: relative(pkgRoot, file), line: idx + 1, doc, replacement })
        }
      }
    })
  }
  for (const file of rawFiles.filter((f) => !isHistory(f))) {
    scan(file, readFileSync(file, 'utf8').split('\n'))
  }
  for (const file of commentFiles) {
    scan(file, maskToComments(readFileSync(file, 'utf8')).split('\n'))
  }
  return failures
}

// ── Check C: the tokens-only kind count, restated by hand in eight docs ───────

/**
 * Every markdown file in the repo, minus the directories nothing here owns. Wider than Check A/B's
 * `agent/**` on purpose — the count below is stated in the package README, the root AGENTS.md,
 * MAINTAINING.md, MIGRATING, two `agent/` docs and two root `docs/` pages. `.claude/` is excluded: its
 * only markdown is gitignored agent scratch (review dumps, wave notes) that a CI checkout never
 * has, so scanning it would make the check depend on the working tree it happens to sit in.
 */
export function findRepoMdFiles(root: string = join(pkgRoot, '..', '..')): string[] {
  // Pruned during the walk, not filtered after it: a recursive readdir descends into every
  // `.claude/worktrees/*/node_modules` first, which took this past 30s on a tree with worktrees.
  const skip = new Set(['node_modules', 'dist', '.git', '.claude'])
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      if (entry.isDirectory()) return skip.has(entry.name) ? [] : walk(join(dir, entry.name))
      return entry.name.endsWith('.md') ? [join(dir, entry.name)] : []
    })
  return walk(root)
}

/**
 * The phrasing every doc uses for "how many kinds `profile: 'tokens-only'` disables". `hidden-
 * inline-style` took the set from 16 to 17; code and tests were updated in that commit and eight
 * docs were not — including the two under `agent/`, which `init`/`sync` PLACE INTO consumer repos,
 * so the stale number shipped.
 *
 * Asserted rather than generated: templating one integer into prose costs a build step and a
 * generated-file gate, while this is one regex in a check CI already runs, and it fails in the
 * same commit that changes the set.
 */
const KIND_COUNT_CLAIM = /(?:disables|silences|turns off)\s+(?:the\s+)?(\d+)\s+kinds\b/g

export type CheckCFailure = { file: string; line: number; claimed: number }

export function checkC(mdFiles: readonly string[], actual: number): CheckCFailure[] {
  const failures: CheckCFailure[] = []
  for (const file of mdFiles) {
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((lineText, idx) => {
      for (const match of lineText.matchAll(KIND_COUNT_CLAIM)) {
        const claimed = Number(match[1])
        if (claimed === actual) continue
        failures.push({ file: relative(pkgRoot, file), line: idx + 1, claimed })
      }
    })
  }
  return failures
}

// ── Check E: import specifiers in fenced code blocks resolve against package.json exports ──────

/** The `exports` keys of package.json (`.`, `./charts`, …, `./configs/*`). */
export function collectExportKeys(): string[] {
  const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')) as {
    exports: Record<string, unknown>
  }
  return Object.keys(pkg.exports)
}

const FENCE_RE = /^\s*```/
const SPECIFIER_RE = /(['"])(basalt-ui(?:\/[^'"\s]*)?)\1/g

function resolvesToExport(specifier: string, exportKeys: readonly string[]): boolean {
  const key = specifier === 'basalt-ui' ? '.' : `./${specifier.slice('basalt-ui/'.length)}`
  return exportKeys.some((exportKey) =>
    exportKey.endsWith('/*') ? key.startsWith(exportKey.slice(0, -1)) : exportKey === key,
  )
}

export type CheckEFailure = { line: number; specifier: string }

/** Dead `basalt-ui[/sub]` specifiers inside the fenced code blocks of one markdown document. */
export function findDeadSpecifiers(
  markdown: string,
  exportKeys: readonly string[],
): CheckEFailure[] {
  const failures: CheckEFailure[] = []
  let inFence = false
  markdown.split('\n').forEach((lineText, idx) => {
    if (FENCE_RE.test(lineText)) {
      inFence = !inFence
      return
    }
    if (!inFence) return
    for (const match of lineText.matchAll(SPECIFIER_RE)) {
      const specifier = match[2] ?? ''
      if (!resolvesToExport(specifier, exportKeys)) failures.push({ line: idx + 1, specifier })
    }
  })
  return failures
}

export function checkE(
  mdFiles: readonly string[],
  exportKeys: readonly string[],
): (CheckEFailure & { file: string })[] {
  return mdFiles.flatMap((file) =>
    findDeadSpecifiers(readFileSync(file, 'utf8'), exportKeys).map((f) => ({
      ...f,
      file: relative(pkgRoot, file),
    })),
  )
}

// ── Check F: every bullet in a rule file ends in resolvable enforcement tags ──────────────────────

/** Rules 2.0 removed: the concern is a type (or unrepresentable) now, so citing one is drift. */
export const REMOVED_RULES: Readonly<Record<string, string>> = {
  'provider-above-router': 'BasaltProvider mounts the router',
  'page-bar-budget': 'the PageBar actions tuple type',
  'agent-resume-guard': 'basalt/agent-no-raw-usechat',
  'deprecated-export': 'nothing: 2.0 ships no deprecations',
}

export type TagSources = {
  /** Shipped plugin rule ids: the registry minus {@link REPO_LOCAL_RULES} and {@link REMOVED_RULES}. */
  readonly pluginRules: ReadonlySet<string>
  /** `GUARD_RULES` keys. */
  readonly guardKinds: ReadonlySet<string>
  /** The published surface (see {@link collectPublishedNames}). */
  readonly typeNames: ReadonlySet<string>
}

const TAG = String.raw`\[(?:basalt\/[a-z0-9-]+|check-theme [a-z0-9-]+|type [A-Za-z_$][\w$]*)\]`
const TAG_RE = new RegExp(TAG, 'g')
/** A bullet ENDS in its tags: one or more tags, then nothing. */
const TRAILING_TAGS_RE = new RegExp(`(?:\\s*${TAG})+\\s*$`)
const BULLET_RE = /^\s*(?:[-*]|\d+\.)\s+/

export type CheckFFailure = { line: number; message: string }

function tagFailure(tag: string, sources: TagSources): string | undefined {
  if (tag.startsWith('basalt/')) {
    const id = tag.slice('basalt/'.length)
    if (REPO_LOCAL_RULES.has(id)) return `[${tag}] is repo-local and never ships`
    if (id in REMOVED_RULES) return `[${tag}] was removed in 2.0`
    return sources.pluginRules.has(id) ? undefined : `[${tag}] is not a shipped plugin rule`
  }
  if (tag.startsWith('check-theme ')) {
    const kind = tag.slice('check-theme '.length)
    return sources.guardKinds.has(kind) ? undefined : `[${tag}] is not a guard kind`
  }
  const name = tag.slice('type '.length)
  return sources.typeNames.has(name) ? undefined : `[${tag}] is not an exported name`
}

/** Tag failures of one rule document: untagged bullets, unresolved tags, non-bullet prose. */
export function checkF(markdown: string, sources: TagSources): CheckFFailure[] {
  const failures: CheckFFailure[] = []
  let inFrontmatter = false
  let inFence = false
  let inComment = false
  // The intro paragraph is the prose directly under the H1, before any bullet or heading.
  let introOpen = false
  let bullet: { line: number; text: string } | undefined

  const closeBullet = (): void => {
    if (bullet === undefined) return
    const text = bullet.text.replace(/\s+/g, ' ').trim()
    const trailing = text.match(TRAILING_TAGS_RE)
    if (trailing === null) {
      failures.push({ line: bullet.line, message: 'bullet does not end in an enforcement tag' })
    } else {
      for (const tag of trailing[0].matchAll(TAG_RE)) {
        const message = tagFailure(tag[0].slice(1, -1), sources)
        if (message !== undefined) failures.push({ line: bullet.line, message })
      }
    }
    bullet = undefined
  }

  markdown.split('\n').forEach((raw, idx) => {
    const line = idx + 1
    if (idx === 0 && raw.trim() === '---') {
      inFrontmatter = true
      return
    }
    if (inFrontmatter) {
      if (raw.trim() === '---') inFrontmatter = false
      return
    }
    if (FENCE_RE.test(raw)) {
      closeBullet()
      introOpen = false
      inFence = !inFence
      return
    }
    if (inFence) return
    if (inComment || raw.trimStart().startsWith('<!--')) {
      inComment = !raw.includes('-->')
      return
    }
    if (raw.trim() === '') {
      closeBullet()
      return
    }
    if (raw.startsWith('#')) {
      closeBullet()
      introOpen = /^#\s/.test(raw)
      return
    }
    if (BULLET_RE.test(raw)) {
      closeBullet()
      introOpen = false
      bullet = { line, text: raw }
      return
    }
    if (bullet !== undefined && /^\s/.test(raw)) {
      bullet.text += `\n${raw}`
      return
    }
    closeBullet()
    if (introOpen) {
      introOpen = false // the allowance is ONE line: a second paragraph or a table row fails
      return
    }
    failures.push({
      line,
      message: 'prose outside a bullet (only the intro line under the H1 is allowed)',
    })
  })
  closeBullet()
  return failures
}

/** `agent/rules/*.md` — the only files the tag law covers; skills are procedure, not law. */
export function findRuleFiles(): string[] {
  return findAgentMdFiles().filter((f) => relative(join(pkgRoot, 'agent'), f).startsWith('rules/'))
}

export type PluginShape = {
  readonly default?: { readonly rules?: Readonly<Record<string, unknown>> }
}

/** The registry's rule ids; throws a named error when the plugin's default export is not a plugin. */
export function pluginRuleIds(plugin: PluginShape): string[] {
  const rules = plugin.default?.rules
  if (rules === undefined || typeof rules !== 'object') {
    throw new Error(
      "configs/oxlint-plugin.js: the default export has no 'rules' object — the tag check cannot " +
        'read the plugin registry',
    )
  }
  return Object.keys(rules)
}

export function loadTagSources(): TagSources {
  return {
    pluginRules: new Set(
      pluginRuleIds(pluginModule).filter(
        (id) => !REPO_LOCAL_RULES.has(id) && !(id in REMOVED_RULES),
      ),
    ),
    guardKinds: new Set(Object.keys(GUARD_RULES)),
    typeNames: collectPublishedNames(),
  }
}

/**
 * The two hand-kept sets must not rot: every repo-local id is still registered (else the entry
 * guards nothing) and every removed id is retired in the plugin (else it was never removed).
 */
export function checkRuleSets(
  registered: readonly string[],
  retired: ReadonlySet<string>,
): string[] {
  return [
    ...[...REPO_LOCAL_RULES]
      .filter((id) => !registered.includes(id))
      .map((id) => `REPO_LOCAL_RULES['${id}'] is not registered in configs/oxlint-plugin.js`),
    ...Object.keys(REMOVED_RULES)
      .filter((id) => !retired.has(id))
      .map((id) => `REMOVED_RULES['${id}'] is not in RETIRED_RULE_IDS (configs/oxlint-plugin.js)`),
  ]
}

// ── Check G: no agent file names a repo-local or removed plugin rule ──────────────────────────────

/** Every file under `agent/` that ships into a consumer repo (`.md` docs and `.tpl` templates). */
export function findAgentFiles(): string[] {
  const agentRoot = join(pkgRoot, 'agent')
  const entries = readdirSync(agentRoot, { recursive: true }) as string[]
  return entries.filter((rel) => /\.(md|tpl)$/.test(rel)).map((rel) => join(agentRoot, rel))
}

export type CheckGFailure = { file: string; line: number; id: string; why: string }

export function checkG(files: readonly string[]): CheckGFailure[] {
  const ids: [string, string][] = [
    ...[...REPO_LOCAL_RULES].map((id): [string, string] => [id, 'is repo-local and never ships']),
    ...Object.entries(REMOVED_RULES).map(([id, instead]): [string, string] => [
      id,
      `was removed in 2.0 — use ${instead}`,
    ]),
  ]
  const failures: CheckGFailure[] = []
  for (const file of files) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((lineText, idx) => {
        for (const [id, why] of ids) {
          if (new RegExp(`(?<![\\w-])${id}(?![\\w-])`).test(lineText)) {
            failures.push({ file: relative(pkgRoot, file), line: idx + 1, id, why })
          }
        }
      })
  }
  return failures
}

// ── Check H: the symbols llms.txt's header names are published ───────────────────────────────────

const LLMS_ENTRY_RE = /^# (basalt-ui(?:\/[a-z-]+)?) {2,}(.+)$/
/** Any header line that starts like an entry point but is not the title (`# basalt-ui v…`). */
const LLMS_ENTRYISH_RE = /^# basalt-ui(?!\s+v\d)/

export type CheckHFailure = { line: number; message: string }

/** Each header entry line is well-formed and names only exports of ITS OWN subpath. */
export function checkLlmsNames(
  text: string,
  published: ReadonlyMap<string, ReadonlySet<string>>,
): CheckHFailure[] {
  const failures: CheckHFailure[] = []
  text.split('\n').forEach((lineText, idx) => {
    if (!LLMS_ENTRYISH_RE.test(lineText)) return
    const line = idx + 1
    const match = LLMS_ENTRY_RE.exec(lineText)
    const spec = match?.[1]
    const names = match?.[2]
    if (spec === undefined || names === undefined) {
      failures.push({ line, message: `header line is not an entry point: ${lineText}` })
      return
    }
    const subpath = published.get(spec)
    if (subpath === undefined) {
      failures.push({ line, message: `'${spec}' is not a published subpath` })
      return
    }
    for (const name of names.split(',').map((n) => n.trim())) {
      if (!subpath.has(name)) {
        failures.push({ line, message: `'${name}' is not a published export of ${spec}` })
      }
    }
  })
  return failures
}

// ── Check I: backticked names in barrel doc comments + SURFACES descriptions are real exports ────

/**
 * `<subpath>:<name>` — backticked terms that are deliberately NOT exports of that subpath: props
 * and options of its exports, platform APIs, env vars, names of internals. Every entry must still
 * appear in that subpath's prose and still be absent from its exports (a test holds both).
 */
export const CHECK_I_NON_EXPORTS: ReadonlySet<string> = new Set([
  'basalt-ui/commands:BasaltProvider', // the root provider that mounts the bus
  'basalt-ui/content:CodeBlock', // internal
  'basalt-ui/content:MermaidDiagram', // internal
  'basalt-ui/format:Intl', // the platform API the formatters wrap
  'basalt-ui/vite:BASALT_LOCAL', // an env var
  'basalt-ui/vite:__APP_VERSION__', // a define the preset injects
  'basalt-ui/vite:allowedHosts', // Vite server option
  'basalt-ui/vite:strictPort', // Vite server option
  'basalt-ui/vite:plugins', // Vite config key
  'basalt-ui/vite:warnIfUnenforced', // internal check the preset runs
  'basalt-ui/charts:marks', // prose: the marks a chart kind fixes
  'basalt-ui/controls:ctl', // the size tier
  'basalt-ui/controls:options', // a prop of NumberFilter
  'basalt-ui/forms:key', // the React `key` prop
  'basalt-ui/format:locale', // an option of the formatters
  'basalt-ui/format:opts', // the options argument
  'basalt-ui/format:undefined', // a return value
  'basalt-ui/agent:ai', // the Vercel `ai` package
  'basalt-ui/content:fenceRenderers', // a prop of Markdown
  'basalt-ui/content:streaming', // a prop of Markdown
  'basalt-ui/content:contentTrust', // a prop of Markdown
  'basalt-ui/content:sanitizeSchema', // a prop of Markdown
])

const BACKTICK_IDENT_RE = /`([A-Za-z_$][\w$]*)(?:\(\))?`/g

/**
 * The first JSDoc block before the first statement of a source file (line comments, plain block
 * comments and whitespace may precede it), or undefined when a statement comes first.
 * @throws when the JSDoc block is never closed.
 */
export function leadingDocComment(source: string): string | undefined {
  let rest = source
  for (;;) {
    rest = rest.trimStart()
    if (rest.startsWith('//')) {
      const eol = rest.indexOf('\n')
      if (eol === -1) return undefined
      rest = rest.slice(eol + 1)
      continue
    }
    if (!rest.startsWith('/*')) return undefined
    const end = rest.indexOf('*/', 2)
    if (end === -1) throw new Error('unterminated block comment')
    if (rest.startsWith('/**') && !rest.startsWith('/**/')) return rest.slice(3, end)
    rest = rest.slice(end + 2)
  }
}

export type CheckIFailure = { where: string; message: string }

/**
 * Fail closed: every backticked identifier in `text` must be an export of `spec` or allow-listed
 * as `<spec>:<name>`. Prose words (`options`, `locale`) are allow-listed too — one explicit list.
 */
export function checkDocNames(opts: {
  where: string
  spec: string
  text: string
  published: ReadonlySet<string>
  allow?: ReadonlySet<string>
}): CheckIFailure[] {
  const { where, spec, text, published, allow = CHECK_I_NON_EXPORTS } = opts
  const bad = new Set<string>()
  for (const match of text.matchAll(BACKTICK_IDENT_RE)) {
    const name = match[1]
    if (name !== undefined && !published.has(name) && !allow.has(`${spec}:${name}`)) bad.add(name)
  }
  return [...bad].map((name) => ({
    where,
    message: `names \`${name}\`, which is not an export of ${spec} (fix the prose, or allow-list '${spec}:${name}' in CHECK_I_NON_EXPORTS)`,
  }))
}

/** Barrel header + SURFACES description of every published JS subpath. */
export function checkI(
  published: ReadonlyMap<string, ReadonlySet<string>>,
  allow: ReadonlySet<string> = CHECK_I_NON_EXPORTS,
): CheckIFailure[] {
  const failures: CheckIFailure[] = []
  for (const [subpath, target] of Object.entries(readExportsManifest())) {
    const spec = subpathSpec(subpath)
    const names = published.get(spec)
    const entry = resolveSubpathEntry(target)
    if (names === undefined || entry === undefined) continue

    const header = leadingDocComment(readFileSync(entry, 'utf8'))
    const surface = subpath in SURFACES ? SURFACES[subpath as keyof typeof SURFACES] : undefined
    const description = surface !== undefined && 'description' in surface ? surface.description : ''
    const where = relative(pkgRoot, entry)
    if (header === undefined) {
      failures.push({ where, message: 'has no module doc comment before its first statement' })
    }
    for (const [label, text] of [
      [`${where} (module doc comment)`, header ?? ''],
      [`src/surfaces.ts ${subpath} description`, description],
    ] as const) {
      failures.push(...checkDocNames({ where: label, spec, text, published: names, allow }))
    }
  }
  return failures
}

// ── main ──────────────────────────────────────────────────────────────────────

function main(): void {
  const validNames = collectValidNames()
  const mdFiles = findAgentMdFiles()
  const srcTsFiles = findSrcTsFiles()
  const configsJsFiles = findConfigsJsFiles()
  const repoMdFiles = findRepoMdFiles()

  const aFailures = checkA(mdFiles, validNames)
  const bFailures = [...checkB(mdFiles), ...checkBSrc(srcTsFiles)]
  const cFailures = checkC(repoMdFiles, TOKENS_ONLY_DISABLED_KINDS.size)
  // `repoMdFiles` already contains `mdFiles`; configs `.js` are raw (their message strings are
  // consumer-visible), only `src/**` goes through the comment mask.
  const dFailures = checkD([...repoMdFiles, ...configsJsFiles], srcTsFiles)
  const eFailures = checkE(mdFiles, collectExportKeys())
  const tagSources = loadTagSources()
  const fFailures = findRuleFiles().flatMap((file) =>
    checkF(readFileSync(file, 'utf8'), tagSources).map((f) => ({
      ...f,
      file: relative(pkgRoot, file),
    })),
  )
  const gFailures = checkG(findAgentFiles())
  const hFailures = checkLlmsNames(
    readFileSync(join(pkgRoot, 'llms.txt'), 'utf8'),
    collectPublishedBySubpath(),
  )
  const iFailures = checkI(collectPublishedBySubpath())
  const selfFailures = [
    ...checkDenylistIsGenuinelyRemoved(validNames),
    ...checkMasksUrlSlashesCorrectly(),
    ...checkRuleSets(pluginRuleIds(pluginModule), pluginModule.RETIRED_RULE_IDS),
  ]

  const messages: string[] = [
    ...aFailures.map(
      (f) =>
        `${f.file}:${f.line}: '**\`${f.name}\`**' claims '${f.name}' is a shipped export, but it ` +
        `is not in the export surface (scripts/export-surface.json + src/**/index.ts type barrels)`,
    ),
    ...bFailures.map(
      (f) =>
        `${f.file}:${f.line}: references removed API '${f.name}' — use '${f.replacement}' instead`,
    ),
    ...cFailures.map(
      (f) =>
        `${f.file}:${f.line}: says tokens-only disables ${f.claimed} kinds, but ` +
        `TOKENS_ONLY_DISABLED_KINDS has ${TOKENS_ONLY_DISABLED_KINDS.size}`,
    ),
    ...dFailures.map(
      (f) => `${f.file}:${f.line}: cites deleted doc '${f.doc}' — use ${f.replacement} instead`,
    ),
    ...eFailures.map(
      (f) =>
        `${f.file}:${f.line}: imports '${f.specifier}', which package.json 'exports' does not resolve`,
    ),
    ...fFailures.map((f) => `${f.file}:${f.line}: ${f.message}`),
    ...hFailures.map((f) => `llms.txt:${f.line}: ${f.message}`),
    ...iFailures.map((f) => `${f.where}: ${f.message}`),
    ...gFailures.map((f) => `${f.file}:${f.line}: rule '${f.id}' ${f.why}`),
    ...selfFailures,
  ]

  if (messages.length > 0) {
    console.error(`✖ agent-doc-drift: ${messages.length} failure(s)`)
    for (const m of messages) console.error(`  ${m}`)
    process.exit(1)
  }

  console.log(
    `✓ agent-doc-drift: 0 failures (${repoMdFiles.length} docs + ${srcTsFiles.length} src files + ` +
      `${configsJsFiles.length} configs files scanned, ${validNames.size} valid names, ` +
      `${Object.keys(REMOVED_APIS).length} denylisted, ${Object.keys(DELETED_DOCS).length} deleted docs)`,
  )
}

// Only run when executed directly (not when imported by the test suite)
if (import.meta.path === Bun.main) {
  main()
}
