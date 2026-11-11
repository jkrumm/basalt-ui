/**
 * The subpath allotment `basalt()` gates on, read from docs/v3/ARCHITECTURE.md (frozen): the
 * section 3 table (subpath -> peers), the primitive list under it, the section 1 L3 row (the two
 * primitives that add a peer of their own) and the declared L4 edges. `allotment.gen.ts` is this
 * parse, committed; `bun packages/basalt-ui/src/vite/allotment.ts` rewrites it and a test pins it.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export type SubpathAllotment = {
  /** Peers every import of the subpath needs installed. */
  peers: string[]
  /** Peers loaded only on first use (`import()`); not gated. */
  lazy: string[]
  /** Other subpaths it imports at runtime: `.` for every layer above core, plus declared edges. */
  reaches: string[]
}

export type Allotment = {
  /** Runtime subpath (`.`, `ui`, `router`, …) -> its allotment. */
  subpaths: Record<string, SubpathAllotment>
  /** The L4 composite subpaths: `optimizeDeps.exclude` targets once an app ejects. */
  composites: string[]
  /** Every allotted primitive (`basalt-ui/ui/<name>`), shipped or not yet. */
  primitives: string[]
  /** A primitive's own extra peers, beyond the `ui` row. */
  primitivePeers: Record<string, string[]>
}

const NPM_NAME = /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/

const unquote = (s: string): string => s.replaceAll('`', '').trim()

/** `./cards` -> `cards`, `.` -> `.`, `./ui/*` -> `ui`. */
const subpathKey = (cell: string): string => {
  const raw = unquote(cell)
  if (raw === '.') return '.'
  return raw.replace(/^\.\//, '').replace(/\/\*$/, '')
}

function section(markdown: string, heading: string): string {
  const start = markdown.indexOf(`\n${heading}`)
  if (start === -1) throw new Error(`ARCHITECTURE.md: no "${heading}" heading`)
  const next = markdown.indexOf('\n## ', start + heading.length + 1)
  return markdown.slice(start, next === -1 ? undefined : next)
}

const cells = (row: string): string[] =>
  row
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim())

/**
 * One peers cell: `;`-separated clauses. `never …` is a prohibition, `… lazy` is loaded on first
 * use, `the <n> required \`./x\` peers` reuses another row's required peers; the rest are names.
 */
function parsePeers(cell: string): { peers: string[]; lazy: string[]; ref: string | null } {
  const peers: string[] = []
  const lazy: string[] = []
  let ref: string | null = null
  for (const clause of cell.split(';').map((c) => c.trim())) {
    if (clause === '' || /^never\b/.test(clause)) continue
    const reuse = /required `(\.\/[a-z-]+)` peers/.exec(clause)
    if (reuse) {
      ref = subpathKey(reuse[1] ?? '')
      continue
    }
    const isLazy = /\blazy$/.test(clause)
    const names = clause
      .replace(/\blazy$/, '')
      .split(',')
      .map(unquote)
      .filter((n) => n !== '' && n !== '(all optional)')
    for (const name of names) {
      if (!NPM_NAME.test(name)) throw new Error(`ARCHITECTURE.md section 3: peer "${name}"`)
      ;(isLazy ? lazy : peers).push(name)
    }
  }
  return { peers, lazy, ref }
}

export function parseAllotment(markdown: string): Allotment {
  const layers = section(markdown, '## 1. Layers and allowed imports')
  const published = section(markdown, '## 3. Published subpaths and budgets')

  const compositeRow = layers.split('\n').find((l) => /^\|\s*4\s*\|/.test(l))
  const compositeDirs = /`src\/\{([a-z,]+)\}`/.exec(compositeRow ?? '')?.[1]
  if (compositeDirs === undefined) throw new Error('ARCHITECTURE.md section 1: no L4 row')
  const composites = compositeDirs.split(',')

  const edges = new Map<string, string[]>()
  const edgeLine = /\*\*Declared L4 edges\*\*[^\n]*/.exec(layers)?.[0] ?? ''
  for (const [, from, to] of edgeLine.matchAll(/`([a-z]+) -> ([a-z, ]+)`/g)) {
    edges.set(
      from ?? '',
      (to ?? '').split(',').map((s) => s.trim()),
    )
  }
  if (edges.size === 0) throw new Error('ARCHITECTURE.md section 1: no declared L4 edges')

  const l3Row = layers.split('\n').find((l) => /^\|\s*3\s*\|/.test(l)) ?? ''
  const primitivePeers: Record<string, string[]> = {}
  for (const [, name, peer] of l3Row.matchAll(/`([a-z-]+)` alone adds `?([@\w/.-]+?)`?(?=[,)])/g)) {
    primitivePeers[name ?? ''] = [peer ?? '']
  }

  const subpaths: Record<string, SubpathAllotment> = {}
  const refs = new Map<string, string>()
  for (const row of published.split('\n')) {
    if (!row.startsWith('| `.')) continue
    const [subpathCell, , peersCell] = cells(row)
    const key = subpathKey(subpathCell ?? '')
    const { peers, lazy, ref } = parsePeers(peersCell ?? '')
    if (ref !== null) refs.set(key, ref)
    const reaches = key === '.' ? [] : ['.']
    subpaths[key] = { peers, lazy, reaches: [...reaches, ...(edges.get(key) ?? [])] }
  }
  for (const [key, ref] of refs) {
    const target = subpaths[ref]
    const entry = subpaths[key]
    if (target === undefined || entry === undefined) throw new Error(`peers ref ${key} -> ${ref}`)
    entry.peers.unshift(...target.peers)
  }

  const listed = /\*\*Primitives \((\d+), census-derived\):\*\* ([^*]+)\./.exec(published)
  if (listed === null) throw new Error('ARCHITECTURE.md section 3: no primitive list')
  // A parenthetical names a module's parts (`card (\`Card\`, …)`), never another module.
  const primitives = (listed[2] ?? '')
    .replace(/\([^)]*\)/g, '')
    .split(',')
    .map((n) => n.trim())
  if (
    primitives.length !== Number(listed[1]) ||
    !primitives.every((n) => /^[a-z][a-z-]*$/.test(n))
  ) {
    throw new Error(
      `ARCHITECTURE.md section 3: ${listed[1]} primitives announced, read ${primitives.join(', ')}`,
    )
  }

  return { subpaths, composites, primitives, primitivePeers }
}

export const ARCHITECTURE = fileURLToPath(
  new URL('../../../../docs/v3/ARCHITECTURE.md', import.meta.url),
)
export const GENERATED = fileURLToPath(new URL('./allotment.gen.ts', import.meta.url))

export function renderAllotment(allotment: Allotment): string {
  return (
    '// Generated by src/vite/allotment.ts from docs/v3/ARCHITECTURE.md sections 1 and 3; do not edit.\n' +
    '// Regenerate: bun packages/basalt-ui/src/vite/allotment.ts\n' +
    "import type { Allotment } from './allotment'\n\n" +
    `export const ALLOTMENT: Allotment = ${JSON.stringify(allotment, null, 2)}\n`
  )
}

if (import.meta.main) {
  writeFileSync(GENERATED, renderAllotment(parseAllotment(readFileSync(ARCHITECTURE, 'utf8'))))
  // The test pins the data, not the bytes, so the formatter owns the layout.
  const fmt = spawnSync('bunx', ['oxfmt', GENERATED], { stdio: 'inherit' })
  process.exit(fmt.status ?? 1)
}
