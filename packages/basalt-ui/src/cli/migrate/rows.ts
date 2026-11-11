/**
 * Migration rows (docs/v3/concepts/migration-release.md 3.2): reading the files a package ships and
 * folding them into the chain a given `--from` version walks. No network, no dependencies.
 *
 * Two sources, both read from the package dir the CLI runs from: `migrations/areas/*.json` (the
 * source tree) and the merged `migrations/<version>.json` a published package ships. A row id in
 * both resolves to the areas file.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export const PROFILES = ['tokens', 'bridge', 'parts', 'app'] as const
export type Profile = (typeof PROFILES)[number]

export interface MigrationRow {
  id: string
  kind: string
  from: string
  to?: string
  profiles?: string[]
  codemod?: string
  verify?: string
  manual?: boolean
  note?: string
}

export interface TokenShift {
  token: string
  from: string
  to: string
}
export interface TokenRename {
  from: string
  to: string
}
export interface StorageRow {
  key: string
  action: string
  to?: string
}
export interface UrlRow {
  store: string
  golden?: string
}
export interface AttrRow {
  from: string
  to?: string
}
export interface RuleRow {
  old: string
  new?: string
  severity?: string
}

export interface MigrationFile {
  /** `areas/<name>.json` or `<version>.json`, relative to `migrations/`. */
  source: string
  /** Semver range of the versions this file migrates from; absent = any version. */
  from?: string
  /** The version this file lands on; the next file in a chain starts here. */
  to?: string
  profiles?: string[]
  rows: MigrationRow[]
  tokens: { renamed: TokenRename[]; valueShifts: TokenShift[] }
  storage: StorageRow[]
  urls: UrlRow[]
  attrs: AttrRow[]
  rules: RuleRow[]
}

export type Version = readonly [number, number, number]

const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/

/** `x.y.z` (optionally `-pre`) or null. A partial or prefixed version is not a version. */
export function parseVersion(text: string): { v: Version; pre: string | null } | null {
  const m = VERSION.exec(text)
  if (m === null) return null
  return { v: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ?? null }
}

function compare(a: ReturnType<typeof parseVersion> & object, b: typeof a): number {
  for (let i = 0; i < 3; i++) {
    const d = (a.v[i] ?? 0) - (b.v[i] ?? 0)
    if (d !== 0) return d
  }
  if (a.pre === b.pre) return 0
  if (a.pre === null) return 1
  if (b.pre === null) return -1
  return a.pre < b.pre ? -1 : 1
}

/** A comparator operand: `1`, `1.40`, `1.40.3` (missing parts are zero), or null. */
function parsePartial(
  text: string,
): { parts: number[]; version: NonNullable<ReturnType<typeof parseVersion>> } | null {
  const m = /^(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?(?:-([0-9A-Za-z.-]+))?$/.exec(text)
  if (m === null) return null
  const parts: number[] = []
  for (const g of [m[1], m[2], m[3]]) {
    if (g === undefined || g === 'x' || g === '*') break
    parts.push(Number(g))
  }
  const v: Version = [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0]
  return { parts, version: { v, pre: m[4] ?? null } }
}

function matchesComparator(
  version: NonNullable<ReturnType<typeof parseVersion>>,
  token: string,
): boolean | null {
  if (token === '*' || token === 'x') return true
  const op = /^(>=|<=|>|<|=)?(.+)$/.exec(token)
  const operand = op?.[2] === undefined ? null : parsePartial(op[2])
  if (op === null || operand === null) return null
  const symbol = op[1] ?? ''
  const cmp = compare(version, operand.version)
  if (symbol === '>=') return cmp >= 0
  if (symbol === '>')
    return cmp > 0 && !(operand.parts.length < 3 && sameLead(version, operand.parts))
  if (symbol === '<=')
    return cmp <= 0 || (operand.parts.length < 3 && sameLead(version, operand.parts))
  if (symbol === '<') return cmp < 0
  // `=` or bare: a full version is equality, a partial one (`2`, `2.1`) is an x-range.
  return operand.parts.length === 3 ? cmp === 0 : sameLead(version, operand.parts)
}

function sameLead(
  version: NonNullable<ReturnType<typeof parseVersion>>,
  parts: readonly number[],
): boolean {
  return parts.every((p, i) => version.v[i] === p)
}

/** Whether `version` is in `range`: comparators ANDed by spaces, sets ORed by `||`. Throws on junk. */
export function satisfies(version: string, range: string): boolean {
  const v = parseVersion(version)
  if (v === null) throw new Error(`unparseable version '${version}'`)
  return range.split('||').some((set) => {
    const tokens = set.trim().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) throw new Error(`unparseable range '${range}'`)
    return tokens.every((token) => {
      const ok = matchesComparator(v, token)
      if (ok === null) throw new Error(`unparseable range '${range}'`)
      return ok
    })
  })
}

function fail(source: string, why: string): never {
  throw new Error(`migrations/${source}: ${why}`)
}

function list<T>(value: unknown, source: string, field: string, ok: (x: Item) => boolean): T[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) fail(source, `'${field}' must be an array`)
  for (const item of value) {
    if (typeof item !== 'object' || item === null || !ok(item as Item)) {
      fail(source, `'${field}' holds an entry of the wrong shape`)
    }
  }
  return value as T[]
}

type Field = 'id' | 'kind' | 'from' | 'to' | 'token' | 'key' | 'action' | 'store' | 'old'
type Item = Partial<Record<Field, unknown>>
interface RawFile {
  schema?: unknown
  from?: unknown
  to?: unknown
  profiles?: unknown
  rows?: unknown
  tokens?: { renamed?: unknown; valueShifts?: unknown }
  storage?: unknown
  urls?: unknown
  attrs?: unknown
  rules?: unknown
}

const isStr = (x: unknown): x is string => typeof x === 'string' && x.length > 0

/** Parse and validate one rows file. Throws an `Error` naming the file on a shape it cannot use. */
export function parseMigrationFile(source: string, text: string): MigrationFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return fail(source, 'not valid JSON')
  }
  if (typeof raw !== 'object' || raw === null) return fail(source, 'not a JSON object')
  const o = raw as RawFile
  if (o.schema !== 1) return fail(source, `schema must be 1, got ${JSON.stringify(o.schema)}`)
  for (const key of ['from', 'to'] as const) {
    if (o[key] !== undefined && !isStr(o[key])) fail(source, `'${key}' must be a string`)
  }
  if (isStr(o.from)) {
    try {
      satisfies('0.0.0', o.from)
    } catch {
      fail(source, `'from' is not a version range: '${o.from}'`)
    }
  }
  if (isStr(o.to) && parseVersion(o.to) === null) fail(source, `'to' is not a version: '${o.to}'`)

  const rows = list<MigrationRow>(
    o.rows,
    source,
    'rows',
    (r) => isStr(r.id) && isStr(r.kind) && isStr(r.from),
  )
  const tokens = o.tokens ?? {}
  return {
    source,
    ...(isStr(o.from) ? { from: o.from } : {}),
    ...(isStr(o.to) ? { to: o.to } : {}),
    ...(Array.isArray(o.profiles) ? { profiles: o.profiles.filter(isStr) } : {}),
    rows,
    tokens: {
      renamed: list<TokenRename>(tokens.renamed, source, 'tokens.renamed', (r) => isStr(r.from)),
      valueShifts: list<TokenShift>(tokens.valueShifts, source, 'tokens.valueShifts', (r) =>
        isStr(r.token),
      ),
    },
    storage: list<StorageRow>(o.storage, source, 'storage', (r) => isStr(r.key) && isStr(r.action)),
    urls: list<UrlRow>(o.urls, source, 'urls', (r) => isStr(r.store)),
    attrs: list<AttrRow>(o.attrs, source, 'attrs', (r) => isStr(r.from)),
    rules: list<RuleRow>(o.rules, source, 'rules', (r) => isStr(r.old)),
  }
}

function jsonFiles(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.json'))
      .map((e) => e.name)
      .toSorted()
  } catch {
    return []
  }
}

/**
 * Every rows file the package carries: `areas/*.json` first, then the merged `<version>.json` files,
 * with a row id already seen in an earlier file dropped from the later one (the areas file wins).
 */
export function loadMigrationFiles(pkgRoot: string): MigrationFile[] {
  const base = join(pkgRoot, 'migrations')
  const sources = [...jsonFiles(join(base, 'areas')).map((n) => `areas/${n}`), ...jsonFiles(base)]
  const seen = new Set<string>()
  return sources.map((source) => {
    const file = parseMigrationFile(source, readFileSync(join(base, source), 'utf8'))
    const rows = file.rows.filter((r) => !seen.has(r.id))
    for (const r of file.rows) seen.add(r.id)
    return { ...file, rows }
  })
}

/**
 * The files `--from` walks: those whose `from` range holds the version (no range = any version),
 * then, transitively, those whose range holds the `to` of a file already selected. Rows A to B and
 * B to C therefore resolve to A to C, and 1.40.3 sees the 2.0 and 3.0 rows at once.
 */
export function foldChain(files: readonly MigrationFile[], from: string): MigrationFile[] {
  const reachable = [from]
  const selected = new Set<MigrationFile>()
  let grew = true
  while (grew) {
    grew = false
    for (const file of files) {
      if (selected.has(file)) continue
      if (file.from !== undefined && !reachable.some((v) => satisfies(v, file.from as string)))
        continue
      selected.add(file)
      grew = true
      if (file.to !== undefined && !reachable.includes(file.to)) reachable.push(file.to)
    }
  }
  return files.filter((f) => selected.has(f))
}
