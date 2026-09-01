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
 * Repo-local only: `scripts/` is absent from package.json's `files`, so this reads
 * non-shipped state (`scripts/export-surface.json`) and must not be reachable from a consumer's
 * `node_modules/basalt-ui` — unlike `check-coverage`, it does not belong behind the shipped CLI.
 * It runs as its own CI step instead, right after the coverage check.
 *
 * Usage: bun packages/basalt-ui/scripts/check-agent-doc-drift.ts
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { TOKENS_ONLY_DISABLED_KINDS } from '../src/guard/index'

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
const DIRECT_TYPE_RE = /^export\s+(?:type|interface)\s+([A-Za-z_$][\w$]*)/gm

/** Every type name a `src/**\/index.ts(x)` barrel exports — direct declarations and re-export lists. */
function collectTypeExports(): Set<string> {
  const names = new Set<string>()
  for (const file of findBarrelFiles()) {
    const src = readFileSync(file, 'utf8')

    for (const match of src.matchAll(TYPE_BLOCK_RE)) {
      for (const item of (match[1] ?? '').split(',')) {
        const trimmed = item.trim()
        if (trimmed.length === 0) continue
        const asMatch = trimmed.match(/\bas\s+([A-Za-z_$][\w$]*)\s*$/)
        const asName = asMatch?.[1]
        names.add(asName ?? trimmed.replace(/^type\s+/, ''))
      }
    }

    for (const match of src.matchAll(DIRECT_TYPE_RE)) {
      const name = match[1]
      if (name !== undefined) names.add(name)
    }
  }
  return names
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
  ChartTooltip: 'ChartTooltipFloat',
  useChartTooltip: 'useChartCursor',
  useHoverSync: 'useChartCursor',
  HoverContext: 'ChartCursorScope',
  ChartHoverSync: 'ChartCursorScope',
  ResponsiveChart: 'ChartFrame',
  useTooltipStyles: 'ChartTooltipFloat',
  BarsAxisConfig: 'AxisConfig',
  ZonedLineTooltipLabel: 'TooltipRow',
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
  'src/data/data-table.tsx::toolbarActions',
  'src/charts/cursor/scope.tsx::ChartHoverSync',
  'src/charts/cursor/store.ts::ChartHoverSync',
  'src/charts/primitives/ChartTooltip.tsx::useChartTooltip',
  'src/charts/primitives/ChartFrame.tsx::ResponsiveChart',
  'src/charts/hooks/useChartCursor.ts::useChartTooltip',
  'src/charts/hooks/useChartCursor.ts::useHoverSync',
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

// ── Check C: the tokens-only kind count, restated by hand in eight docs ───────

/**
 * Every markdown file in the repo, minus the directories nothing here owns. Wider than Check A/B's
 * `agent/**` on purpose — the count below is stated in the package README, both CLAUDE.mds,
 * MIGRATING, two `agent/` docs and two root `docs/` pages.
 */
export function findRepoMdFiles(): string[] {
  const repoRoot = join(pkgRoot, '..', '..')
  const entries = readdirSync(repoRoot, { recursive: true }) as string[]
  return entries
    .filter((rel) => rel.endsWith('.md') && !/(^|[\\/])(node_modules|dist|\.git)[\\/]/.test(rel))
    .map((rel) => join(repoRoot, rel))
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

// ── main ──────────────────────────────────────────────────────────────────────

function main(): void {
  const validNames = collectValidNames()
  const mdFiles = findAgentMdFiles()
  const srcTsFiles = findSrcTsFiles()

  const aFailures = checkA(mdFiles, validNames)
  const bFailures = [...checkB(mdFiles), ...checkBSrc(srcTsFiles)]
  const cFailures = checkC(findRepoMdFiles(), TOKENS_ONLY_DISABLED_KINDS.size)
  const selfFailures = [
    ...checkDenylistIsGenuinelyRemoved(validNames),
    ...checkMasksUrlSlashesCorrectly(),
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
    ...selfFailures,
  ]

  if (messages.length > 0) {
    console.error(`✖ agent-doc-drift: ${messages.length} failure(s)`)
    for (const m of messages) console.error(`  ${m}`)
    process.exit(1)
  }

  console.log(
    `✓ agent-doc-drift: 0 failures (${mdFiles.length} docs + ${srcTsFiles.length} src files ` +
      `scanned, ${validNames.size} valid names, ${Object.keys(REMOVED_APIS).length} denylisted)`,
  )
}

// Only run when executed directly (not when imported by the test suite)
if (import.meta.path === Bun.main) {
  main()
}
