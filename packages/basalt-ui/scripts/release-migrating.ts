/**
 * The migration ledger. Lanes add rows to `migrations/areas/<area>.json` (one file per area, so two
 * lanes touching different areas never conflict); the release merges them into
 * `migrations/<version>.json` and renders MIGRATING.md from the merge. MIGRATING.md is generated:
 * never hand-edit it.
 *
 * FAILS CLOSED. Unknown keys, wrong types, a wrong `area`, a missing or extra file all throw with
 * the file and path named. The surface-diff gate throws when a release removes or renames a public
 * symbol, subpath or `--vx-*` name that no row names.
 *
 * Usage: bun packages/basalt-ui/scripts/release-migrating.ts <version>
 *        bun packages/basalt-ui/scripts/release-migrating.ts --check  (validate + gate, writes nothing)
 * Env:   RELEASE_MIGRATING_ROOT overrides the repo root (tests drive a scratch git repo with it).
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseShards, readShards } from './export-surface-shards.mjs'

const defaultRoot = join(import.meta.dirname, '..', '..', '..')
const root = process.env.RELEASE_MIGRATING_ROOT ?? defaultRoot

export const migratingPath = join(root, 'packages/basalt-ui/MIGRATING.md')

const VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

export const AREAS = [
  'tokens',
  'ui',
  'router',
  'data',
  'page',
  'shell',
  'cards',
  'controls',
  'table',
  'charts',
  'content',
  'ai',
  'cli',
  'lint',
  'agent',
] as const

export const PROFILES = ['tokens', 'bridge', 'parts', 'app'] as const
export const FROM_RANGE = '>=1.40 <3'

export type Row = {
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
export type Content = {
  rows: Row[]
  tokens: {
    renamed: { from: string; to: string }[]
    valueShifts: { token: string; from: string; to: string }[]
  }
  storage: { key: string; action: string; to?: string }[]
  urls: { store: string; golden: string }[]
  attrs: { from: string; to: string }[]
  rules: { old: string; new: string; severity: string }[]
}
export type AreaFile = Content & { schema: 1; area: string }
export type Merged = Content & {
  schema: 1
  from: string
  to: string
  profiles: string[]
}
export type Surface = Record<string, string[]>

// ── strict validation ─────────────────────────────────────────────────────────

type Obj = Record<string, unknown>

function fail(file: string, path: string, message: string): never {
  throw new Error(`release-migrating: ${file}: ${path || '<root>'}: ${message}`)
}

function obj(file: string, path: string, value: unknown, keys: Record<string, boolean>): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(file, path, 'expected an object')
  }
  const record = value as Obj
  for (const key of Object.keys(record)) {
    if (!(key in keys)) fail(file, `${path}.${key}`.replace(/^\./, ''), 'unknown key')
  }
  for (const [key, required] of Object.entries(keys)) {
    if (required && !(key in record)) fail(file, `${path}.${key}`.replace(/^\./, ''), 'missing')
  }
  return record
}

function str(file: string, path: string, value: unknown, nonEmpty: boolean): string {
  if (typeof value !== 'string') fail(file, path, 'expected a string')
  if (nonEmpty && value === '') fail(file, path, 'expected a non-empty string')
  return value
}

function optStr(file: string, path: string, record: Obj, key: string): void {
  if (key in record) str(file, `${path}.${key}`, record[key], false)
}

function arr(file: string, path: string, value: unknown): unknown[] {
  if (!Array.isArray(value)) fail(file, path, 'expected an array')
  return value
}

function each(file: string, path: string, value: unknown, check: (item: Obj, at: string) => void) {
  const keys = ITEM_KEYS[path.split('.').pop() as string] as Record<string, boolean>
  arr(file, path, value).forEach((item, i) => {
    check(obj(file, `${path}[${i}]`, item, keys), `${path}[${i}]`)
  })
}

const ITEM_KEYS: Record<string, Record<string, boolean>> = {
  rows: {
    id: true,
    kind: true,
    from: true,
    to: false,
    profiles: false,
    codemod: false,
    verify: false,
    manual: false,
    note: false,
  },
  renamed: { from: true, to: true },
  valueShifts: { token: true, from: true, to: true },
  storage: { key: true, action: true, to: false },
  urls: { store: true, golden: true },
  attrs: { from: true, to: true },
  rules: { old: true, new: true, severity: true },
}

function requireStrings(file: string, at: string, item: Obj) {
  for (const [key, value] of Object.entries(item)) str(file, `${at}.${key}`, value, false)
}

/** Throws unless `value` is exactly an area file for `area`. */
export function validateArea(file: string, area: string, value: unknown): AreaFile {
  const top = obj(file, '', value, {
    schema: true,
    area: true,
    rows: true,
    tokens: true,
    storage: true,
    urls: true,
    attrs: true,
    rules: true,
  })
  if (top.schema !== 1) fail(file, 'schema', 'expected 1')
  if (top.area !== area) fail(file, 'area', `expected '${area}'`)

  each(file, 'rows', top.rows, (row, at) => {
    for (const key of ['id', 'kind', 'from']) str(file, `${at}.${key}`, row[key], true)
    for (const key of ['to', 'codemod', 'verify', 'note']) optStr(file, at, row, key)
    if ('manual' in row && typeof row.manual !== 'boolean') {
      fail(file, `${at}.manual`, 'expected a boolean')
    }
    if ('profiles' in row) {
      arr(file, `${at}.profiles`, row.profiles).forEach((p, i) => {
        if (!PROFILES.includes(p as (typeof PROFILES)[number])) {
          fail(file, `${at}.profiles[${i}]`, `expected one of ${PROFILES.join(', ')}`)
        }
      })
    }
  })

  const tokens = obj(file, 'tokens', top.tokens, { renamed: true, valueShifts: true })
  each(file, 'tokens.renamed', tokens.renamed, (item, at) => requireStrings(file, at, item))
  each(file, 'tokens.valueShifts', tokens.valueShifts, (item, at) => requireStrings(file, at, item))
  for (const key of ['storage', 'urls', 'attrs', 'rules']) {
    each(file, key, top[key], (item, at) => requireStrings(file, at, item))
  }
  return top as unknown as AreaFile
}

/** Reads and validates every area file; the directory must hold exactly `AREAS`. */
export function loadAreas(rootDir: string = root): AreaFile[] {
  const dir = join(rootDir, 'packages/basalt-ui/migrations/areas')
  const expected = AREAS.map((area) => `${area}.json`)
  const present = existsSync(dir) ? readdirSync(dir).toSorted() : []
  const missing = expected.filter((name) => !present.includes(name))
  const extra = present.filter((name) => !expected.includes(name))
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `release-migrating: migrations/areas: missing [${missing.join(', ')}], unexpected [${extra.join(', ')}]`,
    )
  }

  const ids = new Map<string, string>()
  return AREAS.map((area) => {
    const file = `migrations/areas/${area}.json`
    let parsed: unknown
    try {
      parsed = JSON.parse(readFileSync(join(dir, `${area}.json`), 'utf8'))
    } catch (error) {
      throw new Error(`release-migrating: ${file}: not valid JSON`, { cause: error })
    }
    const validated = validateArea(file, area, parsed)
    validated.rows.forEach((row, i) => {
      const seen = ids.get(row.id)
      if (seen !== undefined)
        fail(file, `rows[${i}].id`, `duplicate id '${row.id}' (also in ${seen})`)
      ids.set(row.id, file)
    })
    return validated
  })
}

// ── merge / digest ────────────────────────────────────────────────────────────

export function mergeAreas(areas: readonly AreaFile[], version: string): Merged {
  return {
    schema: 1,
    from: FROM_RANGE,
    to: version,
    profiles: [...PROFILES],
    rows: areas.flatMap((a) => a.rows),
    tokens: {
      renamed: areas.flatMap((a) => a.tokens.renamed),
      valueShifts: areas.flatMap((a) => a.tokens.valueShifts),
    },
    storage: areas.flatMap((a) => a.storage),
    urls: areas.flatMap((a) => a.urls),
    attrs: areas.flatMap((a) => a.attrs),
    rules: areas.flatMap((a) => a.rules),
  }
}

/** Digest of the merged content only, so it does not move with the release version. */
export function digestOf(merged: Content): string {
  const canonical = JSON.stringify({
    rows: merged.rows,
    tokens: merged.tokens,
    storage: merged.storage,
    urls: merged.urls,
    attrs: merged.attrs,
    rules: merged.rules,
  })
  return createHash('sha256').update(canonical).digest('hex')
}

// ── renderer ──────────────────────────────────────────────────────────────────

const HEADER = [
  '3.0 is a rewrite of the styling and component layer, and 2.x consumers migrate when they choose: 2.x',
  'stays on npm as published and a pin keeps working. The rows (renames, removals, token and storage',
  'changes) land here with the 3.0 commits; until they do, stay on your 2.x pin.',
].join('\n')

export const DIGEST_RE =
  /^<!-- Generated by scripts\/release-migrating\.ts .*\(digest ([0-9a-f]{64})\)/m

function section(title: string, bullets: string[]): string[] {
  return [`### ${title}`, '', ...(bullets.length > 0 ? bullets : ['_None._']), '']
}

export function renderMigrating(merged: Content, digest: string): string {
  const rows = merged.rows.map((r) => {
    const target = r.to === undefined ? '' : ` → \`${r.to}\``
    const codemod = r.codemod === undefined ? '' : ` — codemod: ${r.codemod}`
    const manual = r.manual === true ? ' — manual' : ''
    return `- \`${r.id}\` (${r.kind}): \`${r.from}\`${target}${codemod}${manual}`
  })
  const tokens = [
    ...merged.tokens.renamed.map((t) => `- \`${t.from}\` → \`${t.to}\``),
    ...merged.tokens.valueShifts.map((t) => `- \`${t.token}\`: \`${t.from}\` → \`${t.to}\``),
  ]
  const storage = merged.storage.map(
    (s) => `- \`${s.key}\`: ${s.action}${s.to === undefined ? '' : ` → \`${s.to}\``}`,
  )
  const urls = merged.urls.map((u) => `- \`${u.store}\`: golden \`${u.golden}\``)
  const attrs = merged.attrs.map((a) => `- \`${a.from}\` → \`${a.to}\``)
  const rules = merged.rules.map((r) => `- \`${r.old}\` → \`${r.new}\` (${r.severity})`)

  return [
    '# Migrating basalt-ui',
    '',
    `<!-- Generated by scripts/release-migrating.ts from migrations/areas (digest ${digest}). Do not edit. -->`,
    '',
    HEADER,
    '',
    '## 2.x to 3.0',
    '',
    ...section('Rows', rows),
    ...section('Tokens', tokens),
    ...section('Storage', storage),
    ...section('URLs', urls),
    ...section('Attributes', attrs),
    ...section('Lint rules', rules),
  ]
    .join('\n')
    .replace(/\n+$/, '\n')
}

// ── surface-diff gate ─────────────────────────────────────────────────────────

const specifierOf = (key: string): string =>
  key === '.' ? 'basalt-ui' : `basalt-ui/${key.slice(2)}`

export function surfaceIds(surface: Surface): string[] {
  return Object.entries(surface).flatMap(([key, names]) =>
    names.map((name) => `${specifierOf(key)}#${name}`),
  )
}

export function parseVxNames(source: string): string[] {
  return [...source.matchAll(/'(--vx-[A-Za-z0-9-]+)'/g)].map((m) => m[1] as string)
}

export function findUncovered(
  prevSurface: Surface,
  nowSurface: Surface,
  prevVx: readonly string[],
  nowVx: readonly string[],
  merged: Content,
): string[] {
  const fromSet = new Set(merged.rows.map((r) => r.from))
  const renamedFrom = new Set(merged.tokens.renamed.map((t) => t.from))

  const nowIds = new Set(surfaceIds(nowSurface))
  const removedSymbols = surfaceIds(prevSurface).filter((id) => !nowIds.has(id))
  const uncoveredSymbols = removedSymbols.filter(
    (id) => !fromSet.has(id) && !fromSet.has(id.slice(0, id.indexOf('#'))),
  )

  const nowVxSet = new Set(nowVx)
  const uncoveredVx = prevVx.filter(
    (name) => !nowVxSet.has(name) && !fromSet.has(name) && !renamedFrom.has(name),
  )
  return [...new Set([...uncoveredSymbols, ...uncoveredVx])].toSorted()
}

function git(rootDir: string, args: string[]): string {
  const result = Bun.spawnSync(['git', ...args], { cwd: rootDir, stdout: 'pipe', stderr: 'pipe' })
  if (!result.success) {
    throw new Error(`release-migrating: git ${args.join(' ')} failed: ${result.stderr.toString()}`)
  }
  return result.stdout.toString()
}

/** Highest stable `v*` tag other than `v<version>`, or undefined when none resolves. */
export function previousTag(rootDir: string, version: string): string | undefined {
  let listing: string
  try {
    listing = git(rootDir, ['tag', '--list', 'v*', '--sort=-v:refname'])
  } catch {
    return undefined
  }
  return listing.split('\n').find((tag) => /^v\d+\.\d+\.\d+$/.test(tag) && tag !== `v${version}`)
}

const SURFACE_DIR = 'packages/basalt-ui/scripts/export-surface'
/** The pre-shard single-file snapshot, still what a tag from before the shard split carries. */
const LEGACY_SURFACE_PATH = 'packages/basalt-ui/scripts/export-surface.json'
const VX_PATH = 'packages/basalt-ui/src/guard/vx-names.ts'

/** The surface a tag shipped: its shards, or the single-file snapshot of a pre-shard tag. */
function surfaceAtTag(rootDir: string, tag: string): Surface {
  const listing = git(rootDir, ['ls-tree', '--name-only', tag, `${SURFACE_DIR}/`])
  const files = listing
    .split('\n')
    .filter((path) => path.endsWith('.json'))
    .map((path): [string, string] => [
      path.slice(SURFACE_DIR.length + 1),
      git(rootDir, ['show', `${tag}:${path}`]),
    ])
  if (files.length > 0) return parseShards(files)
  return JSON.parse(git(rootDir, ['show', `${tag}:${LEGACY_SURFACE_PATH}`])) as Surface
}

function runGate(rootDir: string, tag: string, merged: Content): void {
  const prevSurface = surfaceAtTag(rootDir, tag)
  const prevVx = parseVxNames(git(rootDir, ['show', `${tag}:${VX_PATH}`]))
  const nowSurface: Surface = readShards(join(rootDir, SURFACE_DIR))
  const nowVx = parseVxNames(readFileSync(join(rootDir, VX_PATH), 'utf8'))
  const uncovered = findUncovered(prevSurface, nowSurface, prevVx, nowVx, merged)
  if (uncovered.length > 0) {
    throw new Error(
      `release-migrating: ${uncovered.length} removed or renamed public name(s) have no migration row: ${uncovered.join(', ')}`,
    )
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2)
  const check = args.includes('--check')
  const version = args.find((arg) => arg !== '--check')

  if (!check && (version === undefined || !VERSION_RE.test(version))) {
    console.error('usage: bun packages/basalt-ui/scripts/release-migrating.ts <version> | --check')
    process.exit(2)
  }

  const areas = loadAreas(root)
  const merged = mergeAreas(areas, version ?? '0.0.0')
  const tag = previousTag(root, version ?? '')

  if (check) {
    if (tag === undefined) console.warn('⚠ no previous v* tag; surface diff skipped')
    else runGate(root, tag, merged)
    console.log('✓ release-migrating --check: migration areas are valid.')
    return
  }

  if (tag === undefined) {
    throw new Error('release-migrating: no previous stable v* tag; cannot run the surface gate')
  }
  runGate(root, tag, merged)

  const jsonPath = join(root, `packages/basalt-ui/migrations/${version}.json`)
  writeFileSync(jsonPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
  writeFileSync(migratingPath, renderMigrating(merged, digestOf(merged)), 'utf8')
  console.log(`wrote ${jsonPath} and ${migratingPath}`)
}

if (import.meta.path === Bun.main) {
  try {
    main()
  } catch (error) {
    console.error((error as Error).message)
    process.exit(1)
  }
}
