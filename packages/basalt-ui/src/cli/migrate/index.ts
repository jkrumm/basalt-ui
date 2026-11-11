/**
 * `basalt-ui migrate --from <version> --profile <p> [--json] [--check]`
 * (docs/v3/concepts/migration-release.md 3.3).
 *
 * Reads the app's imports (the census), selects the migration rows that apply from `--from` and
 * whose symbol the app imports, and prints what changes. Never writes, never touches the network.
 * `--check` exits 1 while a removed symbol is still imported, a legacy `[data-mantine-color-scheme]`
 * selector remains, or a legacy-namespace storage or url key has no row.
 *
 * `--json` shape: `MigrateReport` below, `schema: 1`. Changing a field name is a schema bump.
 */
import { parseArgs } from 'node:util'

import { findText, takeCensus } from './census'
import type { Census } from './census'
import { PROFILES, foldChain, loadMigrationFiles, parseVersion } from './rows'
import type {
  AttrRow,
  MigrationFile,
  MigrationRow,
  Profile,
  RuleRow,
  StorageRow,
  TokenRename,
  TokenShift,
  UrlRow,
} from './rows'

export { PROFILES } from './rows'

const OPTIONS = {
  from: { type: 'string' },
  profile: { type: 'string' },
  json: { type: 'boolean' },
  check: { type: 'boolean' },
} as const

/** A symbol the migration removes from the old name: importing it still is a failure under `--check`. */
const REMOVING = new Set(['removed', 'renamed', 'moved'])
const REMOVING_PROP = new Set(['removed-prop', 'renamed-prop'])
/** Always a legacy selector, rows or not (the v2 Mantine scheme attribute). */
const BUILTIN_SELECTOR = '[data-mantine-color-scheme'

export interface ReportRow extends MigrationRow {
  /** Rows file the row came from, relative to `migrations/`. */
  source: string
  /** `file:line` places the app imports or uses the row's symbol. */
  at: string[]
}

export interface Failure {
  reason: 'removed-symbol' | 'legacy-selector' | 'unknown-storage-key' | 'unknown-url-key'
  detail: string
  at: string[]
}

export interface MigrateReport {
  schema: 1
  from: string
  profile: Profile
  /** Number of ts, tsx, astro and css files scanned (never 0: that is an error). */
  scanned: number
  /** Rows files the `--from` chain selected. */
  sources: string[]
  /** Rows whose symbol the app imports (or, for a non-basalt-ui `from`, whose text it contains). */
  rows: ReportRow[]
  tokens: {
    renamed: (TokenRename & { at: string[] })[]
    valueShifts: (TokenShift & { at: string[] })[]
  }
  storage: (StorageRow & { at: string[] })[]
  /** Passed through: a url store has no import to census. */
  urls: UrlRow[]
  attrs: (AttrRow & { at: string[] })[]
  /** Passed through: a lint rule row has no import to census. */
  rules: RuleRow[]
  /** Imported basalt-ui symbols (`module#name`) that no row mentions. */
  unmapped: { symbol: string; at: string[] }[]
  /** Legacy-namespace keys (`mantine-*`, `basalt-*`) the app uses that no row maps. */
  unknownKeys: { store: 'storage' | 'url'; key: string; at: string[] }[]
  /** What `--check` fails on; present with or without `--check`. */
  failures: Failure[]
}

function rowApplies(profile: Profile, profiles: readonly string[] | undefined): boolean {
  return profiles === undefined || profiles.includes(profile)
}

function memberStillUsed(census: Census, key: string, member: string, kind: string): boolean {
  const attr = new RegExp(String.raw`\b${member}\s*[=:]`)
  for (const [file, local] of census.importers.get(key) ?? []) {
    const text = census.text.get(file) ?? ''
    if (
      REMOVING_PROP.has(kind)
        ? attr.test(text)
        : new RegExp(String.raw`\b${local}\.${member}\b`).test(text)
    ) {
      return true
    }
  }
  return false
}

/** Where the app uses the row's symbol, and whether that is a removed thing still in use. */
function matchRow(row: MigrationRow, census: Census): { at: string[]; removed: boolean } {
  const hash = row.from.indexOf('#')
  const module = hash < 0 ? row.from : row.from.slice(0, hash)
  if (module !== 'basalt-ui' && !module.startsWith('basalt-ui/')) {
    return { at: findText(census, row.from), removed: false }
  }
  if (hash < 0) {
    const at = census.modules.get(module) ?? []
    return { at, removed: REMOVING.has(row.kind) && at.length > 0 }
  }
  const symbol = row.from.slice(hash + 1)
  const dot = symbol.indexOf('.')
  const key = `${module}#${dot < 0 ? symbol : symbol.slice(0, dot)}`
  const at = census.symbols.get(key) ?? []
  if (at.length === 0) return { at, removed: false }
  if (dot < 0) return { at, removed: REMOVING.has(row.kind) }
  const removing = REMOVING.has(row.kind) || REMOVING_PROP.has(row.kind)
  return { at, removed: removing && memberStillUsed(census, key, symbol.slice(dot + 1), row.kind) }
}

function mapped(key: string, rows: readonly MigrationRow[]): boolean {
  const module = key.slice(0, key.indexOf('#'))
  return rows.some((r) => r.from === module || r.from === key || r.from.startsWith(`${key}.`))
}

export interface ReportInput {
  from: string
  profile: Profile
}

/** The whole report for an app tree. Throws an `Error` for anything the caller must exit 1 on. */
export function buildReport(input: ReportInput, cwd: string, pkgRoot: string): MigrateReport {
  const census = takeCensus(cwd)
  if (census.files.length === 0) {
    throw new Error(
      `scanned 0 files under ${cwd} (looked for ts, tsx, astro and css); run it in the app directory.`,
    )
  }
  const files: MigrationFile[] = foldChain(loadMigrationFiles(pkgRoot), input.from).filter((f) =>
    rowApplies(input.profile, f.profiles),
  )
  const allRows = files.flatMap((f) => f.rows.map((r) => ({ ...r, source: f.source })))
  const failures: Failure[] = []

  const rows: ReportRow[] = []
  for (const row of allRows) {
    if (!rowApplies(input.profile, row.profiles)) continue
    const { at, removed } = matchRow(row, census)
    if (at.length === 0) continue
    rows.push({ ...row, at })
    if (removed) {
      failures.push({
        reason: 'removed-symbol',
        detail: `${row.from} (${row.id}) is removed and still imported`,
        at,
      })
    }
  }

  const present = <T>(items: readonly T[], needle: (item: T) => string): (T & { at: string[] })[] =>
    items.flatMap((item) => {
      const at = findText(census, needle(item))
      return at.length === 0 ? [] : [{ ...item, at }]
    })

  const attrs = present(
    [...files.flatMap((f) => f.attrs), { from: BUILTIN_SELECTOR }].map((a) => ({
      ...a,
      from: a.from.endsWith(']') ? a.from.slice(0, -1) : a.from,
    })),
    (a) => a.from,
  )
  const seenSelectors = new Set<string>()
  const legacy = attrs.filter((a) => !seenSelectors.has(a.from) && seenSelectors.add(a.from))
  for (const a of legacy) {
    failures.push({
      reason: 'legacy-selector',
      detail: `legacy selector ${a.from}] is still in use`,
      at: a.at,
    })
  }

  const storage = present(
    files.flatMap((f) => f.storage),
    (s) => s.key,
  )
  const known = new Set(
    files.flatMap((f) => f.storage.flatMap((s) => [s.key, ...(s.to === undefined ? [] : [s.to])])),
  )
  const urlStores = files.flatMap((f) => f.urls)
  const unknownKeys: MigrateReport['unknownKeys'] = []
  for (const [key, at] of census.storageKeys) {
    if (!known.has(key)) unknownKeys.push({ store: 'storage', key, at })
  }
  for (const [key, at] of census.urlKeys) {
    if (!urlStores.some((u) => u.store.includes(key))) unknownKeys.push({ store: 'url', key, at })
  }
  for (const u of unknownKeys) {
    failures.push({
      reason: u.store === 'storage' ? 'unknown-storage-key' : 'unknown-url-key',
      detail: `${u.store} key '${u.key}' is in a legacy namespace and no row maps it`,
      at: u.at,
    })
  }

  const unmapped = [...census.symbols]
    .filter(([key]) => !mapped(key, allRows))
    .map(([symbol, at]) => ({ symbol, at }))
    .toSorted((a, b) => a.symbol.localeCompare(b.symbol))

  return {
    schema: 1,
    from: input.from,
    profile: input.profile,
    scanned: census.files.length,
    sources: files.map((f) => f.source),
    rows,
    tokens: {
      renamed: present(
        files.flatMap((f) => f.tokens.renamed),
        (t) => t.from,
      ),
      valueShifts: present(
        files.flatMap((f) => f.tokens.valueShifts),
        (t) => t.token,
      ),
    },
    storage,
    urls: urlStores,
    attrs: legacy,
    rules: files.flatMap((f) => f.rules),
    unmapped,
    unknownKeys,
    failures,
  }
}

function formatReport(report: MigrateReport): string {
  const lines = [
    `basalt-ui migrate: from ${report.from}, profile ${report.profile}: ${report.scanned} files scanned, ${report.rows.length} rows apply`,
  ]
  for (const row of report.rows) {
    lines.push(
      `  ${row.id}  ${row.kind}  ${row.from}${row.to === undefined ? '' : ` -> ${row.to}`}${row.manual === true ? '  [manual]' : ''}`,
    )
    if (row.note !== undefined) lines.push(`    ${row.note}`)
    lines.push(
      `    at ${row.at.slice(0, 5).join(', ')}${row.at.length > 5 ? `, +${row.at.length - 5} more` : ''}`,
    )
  }
  for (const t of report.tokens.renamed)
    lines.push(`  token ${t.from} -> ${t.to}  at ${t.at[0] ?? ''}`)
  for (const t of report.tokens.valueShifts)
    lines.push(`  token ${t.token}: ${t.from} -> ${t.to}  at ${t.at[0] ?? ''}`)
  for (const s of report.storage)
    lines.push(
      `  storage ${s.key}: ${s.action}${s.to === undefined ? '' : ` -> ${s.to}`}  at ${s.at[0] ?? ''}`,
    )
  for (const a of report.attrs)
    lines.push(
      `  selector ${a.from}]${a.to === undefined ? '' : ` -> ${a.to}`}  at ${a.at[0] ?? ''}`,
    )
  if (report.unmapped.length > 0) {
    lines.push(`unmapped (imported, no row): ${report.unmapped.map((u) => u.symbol).join(', ')}`)
  }
  for (const f of report.failures) lines.push(`FAIL ${f.reason}: ${f.detail}  at ${f.at[0] ?? ''}`)
  return lines.join('\n')
}

/**
 * The `migrate` verb. Exit 1 on an unknown flag, a missing `--profile` or `--from`, a `--from` that
 * is not `x.y.z`, an unknown profile, unreadable rows, a scan of 0 files, and, under `--check`,
 * any failure.
 */
export function migrate(flags: readonly string[], cwd: string, pkgRoot: string): number {
  try {
    const { values } = parseArgs({
      args: [...flags],
      options: OPTIONS,
      strict: true,
      allowPositionals: false,
    })
    if (values.from === undefined) throw new Error('--from <version> is required.')
    if (parseVersion(values.from) === null)
      throw new Error(`--from '${values.from}' is not a version (x.y.z).`)
    const profile = PROFILES.find((p) => p === values.profile)
    if (profile === undefined) {
      throw new Error(
        values.profile === undefined
          ? `--profile is required (${PROFILES.join(' | ')}).`
          : `--profile '${values.profile}' is not one of ${PROFILES.join(' | ')}.`,
      )
    }
    const report = buildReport({ from: values.from, profile }, cwd, pkgRoot)
    console.log(values.json === true ? JSON.stringify(report, null, 2) : formatReport(report))
    return values.check === true && report.failures.length > 0 ? 1 : 0
  } catch (err) {
    const accepted = Object.keys(OPTIONS)
      .map((k) => `--${k}`)
      .join(' ')
    console.error(
      `basalt-ui migrate: ${err instanceof Error ? err.message : String(err)} Accepted: ${accepted}\n`,
    )
    return 1
  }
}
