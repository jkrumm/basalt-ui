/**
 * Spike 622 (docs/v3/ARCHITECTURE.md section 11, falsifiers F1 and F4). Throwaway harness, no tests.
 *
 *   F1  does the v3 export surface map (a) the basalt-ui signatures argo imports and (b) the
 *       Mantine component tags the fleet renders? Rules are fixed in the verdict block below.
 *   F4  how many hand-rolled copies of each section 10 refusal exist (refusals.json predicates)?
 *
 * Static AST scan over the consumer repos, strictly read-only. The output is deterministic (sorted
 * keys and arrays, no timestamps) and carries no file paths unless CENSUS_NAMES=1. The 13th
 * consumer (EPOS) appears as counts only, never by id, path or name.
 *
 * Prints ONE JSON object on stdout and always exits 0 (0 = the harness ran, not "hypothesis held").
 * Progress goes to stderr.
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import ts from 'typescript'

const ROOT = resolve(import.meta.dir, '../../..')
const DOCS = join(ROOT, 'docs/v3')
const HOME = homedir()
const WITH_NAMES = process.env.CENSUS_NAMES === '1'

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  '.claude',
  'out',
  'dist-print',
  '.output',
  '.next',
  '.astro',
  '.turbo',
  'target',
  'coverage',
  '.svelte-kit',
  'vendor',
  'var',
])
const MAX_BYTES = 1024 * 1024
const SOURCE_RE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/
const NOT_SOURCE_RE = /\.d\.[cm]?ts$|\.gen\.ts$/
const TEST_PATH_RE = /\.(test|spec)\.[cm]?[tj]sx?$|(^|\/)(tests?|e2e|__tests__|__mocks__)\//
const JSX_RE = /\.[tj]sx$/
const LAYOUT = new Set(['Stack', 'Group', 'Flex', 'Center', 'Box', 'Text', 'SimpleGrid'])
const DOCUMENTED = { total: 4310, component: 1755 }
const EPOS_ID = 'epos'

const CONSUMERS: readonly (readonly [string, string])[] = [
  ['argo', 'SourceRoot/argo'],
  ['rb', 'SourceRoot/rb'],
  ['linewatch', 'SourceRoot/linewatch'],
  ['shutterflow', 'SourceRoot/shutterflow'],
  ['weatherorb', 'SourceRoot/weatherorb'],
  ['finances', 'SourceRoot/finances'],
  ['email-gateway', 'SourceRoot/email-gateway'],
  ['image-gateway', 'SourceRoot/image-gateway'],
  ['rollhook', 'SourceRoot/rollhook'],
  ['obsidian', 'SourceRoot/basalt-ui-obsidian'],
  ['jkrumm-com', 'SourceRoot/jkrumm.com'],
  ['console', 'SourceRoot/software-factory/apps/console'],
]
const EPOS_ROOT = join(HOME, 'IuRoot/epos-ai-teamchat-athena/ui')
const EVIDENCE9 = new Set([
  'argo',
  'rb',
  'linewatch',
  'weatherorb',
  'shutterflow',
  'image-gateway',
  'email-gateway',
  'obsidian',
  'finances',
])
const ARGO_ROOT = join(HOME, 'SourceRoot/argo')

// ---------------------------------------------------------------------------------------------
// Types and small helpers

interface ImportRec {
  from: string
  names: string[]
}
interface Module {
  repo: string
  rel: string
  kind: 'source' | 'pkg' | 'other'
  imports: ImportRec[]
  decls: Set<string>
  calls: Set<string>
  idents: Set<string>
  jsxAttrs: Set<string>
  deps: Set<string>
}
interface Parsed {
  imports: ImportRec[]
  decls: Set<string>
  calls: Set<string>
  idents: Set<string>
  jsxAttrs: Set<string>
  tags: Map<string, number>
  errors: number
}
interface MappingEntry {
  kind: string
  to: string
  cite: string
  anchor: string
  judgement?: boolean
}
interface Mapping {
  extras: string[]
  sigs: Record<string, MappingEntry>
  families: Record<string, MappingEntry>
  tagAliases: Record<string, { to: string }>
}
type Pred =
  | { import: { from: string; names?: string[] } }
  | { decl: string }
  | { call: string }
  | { ident: string }
  | { jsxAttr: string }
  | { path: string }
  | { dep: string }
  | { any: Pred[] }
interface Item {
  id: string
  role: 'copy' | 'lib'
  all: Pred[]
}
interface Refusal {
  id: string
  applicable?: boolean
  items: Item[]
}
interface RefusalsFile {
  optimistic: { items: Item[] }
  refusals: Refusal[]
}

const log = (msg: string): void => process.stderr.write(`[census] ${msg}\n`)
const sha8 = (s: string): string => createHash('sha1').update(s).digest('hex').slice(0, 8)
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
const sortedArr = (xs: Iterable<string>): string[] => [...xs].toSorted(cmp)
const round4 = (n: number, d: number): number => (d === 0 ? 0 : Number((n / d).toFixed(4)))
const readText = (p: string): string => (existsSync(p) ? readFileSync(p, 'utf8') : '')

function sortedRecord<T>(m: Map<string, T> | Record<string, T>): Record<string, T> {
  const entries = m instanceof Map ? [...m.entries()] : Object.entries(m)
  entries.sort((a, b) => cmp(a[0], b[0]))
  return Object.fromEntries(entries)
}

function moduleId(m: Module): string {
  return sha8(`${m.repo}:${m.rel}`)
}

// ---------------------------------------------------------------------------------------------
// File walk

interface WalkedFile {
  abs: string
  rel: string
}

function walk(root: string, accept: (rel: string) => boolean): WalkedFile[] {
  const out: WalkedFile[] = []
  const visit = (dir: string, relDir: string): void => {
    let entries: import('node:fs').Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    entries.sort((a, b) => cmp(a.name, b.name))
    for (const e of entries) {
      if (e.isSymbolicLink()) continue
      const rel = relDir === '' ? e.name : `${relDir}/${e.name}`
      const abs = join(dir, e.name)
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('dist-')) visit(abs, rel)
        continue
      }
      if (!e.isFile() || !accept(rel)) continue
      try {
        if (statSync(abs).size > MAX_BYTES) continue
      } catch {
        continue
      }
      out.push({ abs, rel })
    }
  }
  visit(root, '')
  return out
}

// ---------------------------------------------------------------------------------------------
// Parsing

function calleeText(n: ts.Node): string | null {
  if (ts.isIdentifier(n)) return n.text
  if (!ts.isPropertyAccessExpression(n)) return null
  const base = calleeText(n.expression)
  return base === null ? null : `${base}.${n.name.text}`
}

function tagPath(n: ts.Node): string[] | null {
  if (ts.isIdentifier(n)) return [n.text]
  if (!ts.isPropertyAccessExpression(n)) return null
  const base = tagPath(n.expression)
  return base === null ? null : [...base, n.name.text]
}

function specText(n: ts.Expression | undefined): string | null {
  return n !== undefined && ts.isStringLiteralLike(n) ? n.text : null
}

/** local binding name -> Mantine export name ('*' = namespace import). */
function mantineBindings(sf: ts.SourceFile): Map<string, string> {
  const out = new Map<string, string>()
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st)) continue
    const from = specText(st.moduleSpecifier)
    const clause = st.importClause
    if (from === null || !from.startsWith('@mantine/') || clause === undefined) continue
    if (clause.name !== undefined) out.set(clause.name.text, clause.name.text)
    const nb = clause.namedBindings
    if (nb === undefined) continue
    if (ts.isNamespaceImport(nb)) {
      out.set(nb.name.text, '*')
      continue
    }
    for (const el of nb.elements) out.set(el.name.text, (el.propertyName ?? el.name).text)
  }
  return out
}

function parseSource(text: string, rel: string): Parsed {
  const kind = /\.[mc]?ts$/.test(rel) ? ts.ScriptKind.TS : ts.ScriptKind.TSX
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, kind)
  const p: Parsed = {
    imports: [],
    decls: new Set(),
    calls: new Set(),
    idents: new Set(),
    jsxAttrs: new Set(),
    tags: new Map(),
    errors: 0,
  }
  const diagnostics = (sf as unknown as { parseDiagnostics?: unknown[] }).parseDiagnostics
  p.errors = diagnostics !== undefined && diagnostics.length > 0 ? 1 : 0
  const bindings = JSX_RE.test(rel) ? mantineBindings(sf) : new Map<string, string>()

  const countTag = (tagName: ts.Node): void => {
    const path = tagPath(tagName)
    if (path === null) return
    const bound = bindings.get(path[0])
    if (bound === undefined) return
    const name = bound === '*' ? path[1] : bound
    if (name === undefined) return
    p.tags.set(name, (p.tags.get(name) ?? 0) + 1)
  }

  const visit = (n: ts.Node): void => {
    if (ts.isIdentifier(n)) p.idents.add(n.text)
    else if (ts.isImportDeclaration(n)) {
      const from = specText(n.moduleSpecifier)
      const nb = n.importClause?.namedBindings
      const names =
        nb !== undefined && ts.isNamedImports(nb)
          ? nb.elements.map((el) => (el.propertyName ?? el.name).text)
          : []
      if (from !== null) p.imports.push({ from, names })
    } else if (ts.isExportDeclaration(n)) {
      const from = specText(n.moduleSpecifier)
      const clause = n.exportClause
      const names =
        clause !== undefined && ts.isNamedExports(clause)
          ? clause.elements.map((el) => (el.propertyName ?? el.name).text)
          : []
      if (from !== null) p.imports.push({ from, names })
    } else if (ts.isImportEqualsDeclaration(n)) {
      const ref = n.moduleReference
      const from = ts.isExternalModuleReference(ref) ? specText(ref.expression) : null
      if (from !== null) p.imports.push({ from, names: [] })
    } else if (ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) {
      if (n.name !== undefined) p.decls.add(n.name.text)
    } else if (ts.isVariableDeclaration(n)) {
      if (ts.isIdentifier(n.name)) p.decls.add(n.name.text)
    } else if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
      const callee = calleeText(n.expression)
      if (callee !== null) p.calls.add(callee)
      const isDynamic = n.expression.kind === ts.SyntaxKind.ImportKeyword
      if (isDynamic || callee === 'require') {
        const from = specText(n.arguments?.[0])
        if (from !== null && (isDynamic || ts.isCallExpression(n)))
          p.imports.push({ from, names: [] })
      }
    } else if (ts.isJsxAttribute(n)) {
      p.jsxAttrs.add(ts.isIdentifier(n.name) ? n.name.text : n.name.name.text)
    } else if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      countTag(n.tagName)
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return p
}

// ---------------------------------------------------------------------------------------------
// Consumer scan

interface TagStats {
  files: number
  total: number
  layout: number
  component: number
}
interface RepoScan {
  id: string
  missing: boolean
  sourceFiles: number
  parsed: number
  parseErrors: number
  head: string
  modules: Module[]
  tagStats: TagStats
  tagNames: Map<string, number>
}

function gitHead(root: string): string {
  try {
    const r = Bun.spawnSync(['git', 'rev-parse', '--short', 'HEAD'], { cwd: root })
    return r.exitCode === 0 ? r.stdout.toString().trim() : ''
  } catch {
    return ''
  }
}

function depKeys(text: string): Set<string> {
  const out = new Set<string>()
  try {
    const json = JSON.parse(text) as Record<string, unknown>
    for (const field of [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ]) {
      const block = json[field]
      if (typeof block !== 'object' || block === null) continue
      for (const k of Object.keys(block)) out.add(k)
    }
  } catch {
    // an unparsable package.json has no dependencies
  }
  return out
}

function scanRepo(id: string, root: string): RepoScan {
  const scan: RepoScan = {
    id,
    missing: !existsSync(root),
    sourceFiles: 0,
    parsed: 0,
    parseErrors: 0,
    head: '',
    modules: [],
    tagStats: { files: 0, total: 0, layout: 0, component: 0 },
    tagNames: new Map(),
  }
  if (scan.missing) return scan
  scan.head = gitHead(root)
  const files = walk(root, (rel) => !TEST_PATH_RE.test(rel))
  for (const f of files) {
    const base: Module = {
      repo: id,
      rel: f.rel,
      kind: 'other',
      imports: [],
      decls: new Set(),
      calls: new Set(),
      idents: new Set(),
      jsxAttrs: new Set(),
      deps: new Set(),
    }
    if (f.rel === 'package.json' || f.rel.endsWith('/package.json')) {
      base.kind = 'pkg'
      base.deps = depKeys(readText(f.abs))
      scan.modules.push(base)
      continue
    }
    if (!SOURCE_RE.test(f.rel) || NOT_SOURCE_RE.test(f.rel)) {
      scan.modules.push(base)
      continue
    }
    scan.sourceFiles++
    let parsed: Parsed
    try {
      parsed = parseSource(readText(f.abs), f.rel)
    } catch {
      scan.modules.push(base)
      continue
    }
    scan.parsed++
    scan.parseErrors += parsed.errors
    scan.modules.push({
      ...base,
      kind: 'source',
      imports: parsed.imports,
      decls: parsed.decls,
      calls: parsed.calls,
      idents: parsed.idents,
      jsxAttrs: parsed.jsxAttrs,
    })
    if (parsed.tags.size === 0) continue
    scan.tagStats.files++
    for (const [name, n] of parsed.tags) {
      scan.tagStats.total += n
      if (LAYOUT.has(name)) scan.tagStats.layout += n
      else scan.tagStats.component += n
      scan.tagNames.set(name, (scan.tagNames.get(name) ?? 0) + n)
    }
  }
  log(`${id}: ${scan.sourceFiles} source files, ${scan.tagStats.total} mantine tags`)
  return scan
}

// ---------------------------------------------------------------------------------------------
// Docs: section 3 symbol sets, section 9 rows

function backticked(text: string, re: RegExp): string[] {
  return [...text.matchAll(re)].map((m) => m[1] ?? '')
}

function splitTopLevel(text: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of text) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  parts.push(cur)
  return parts
}

const pascal = (kebab: string): string =>
  kebab
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')

function tableRowsAfter(lines: string[], heading: string): string[][] {
  const start = lines.findIndex((l) => l.startsWith(heading))
  if (start < 0) return []
  const rows: string[][] = []
  let inTable = false
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('|')) {
      inTable = true
      rows.push(line.split('|').map((c) => c.trim()))
      continue
    }
    if (inTable) break
  }
  // drop header and separator rows
  return rows.slice(2)
}

interface Section3 {
  table: Set<string>
  prim: Set<string>
  declaredSum: number
}

function readSection3(): Section3 {
  const text = readText(join(DOCS, 'ARCHITECTURE.md'))
  const lines = text.split('\n')
  const table = new Set<string>()
  for (const cols of tableRowsAfter(lines, '## 3. Published subpaths and budgets')) {
    if ((cols[1] ?? '').includes('./ui/*')) continue
    for (const id of backticked(cols[2] ?? '', /`([A-Za-z_$][\w$]*)`/g)) table.add(id)
  }
  const prim = new Set<string>()
  const para =
    text.match(/\*\*Primitives \(36, census-derived\):\*\*([\s\S]*?)\*\*Tooling/)?.[1] ?? ''
  for (const id of backticked(para, /`([A-Za-z_$][\w$]*)`/g)) prim.add(id)
  for (const item of splitTopLevel(para)) {
    const word = item.trim().match(/^[a-z][a-z-]*/)?.[0]
    if (word !== undefined) prim.add(pascal(word))
  }
  const declared = text.match(/Sum (\d+) of 100/)?.[1]
  return { table, prim, declaredSum: declared === undefined ? 91 : Number(declared) }
}

interface Row9 {
  names: Set<string>
  noAnswer: Set<string>
}

function readRow9(): Row9 {
  const lines = readText(join(DOCS, 'concepts/primitives-distribution.md')).split('\n')
  const names = new Set<string>()
  const noAnswer = new Set<string>()
  for (const cols of tableRowsAfter(lines, '## 9. Every Mantine feature and its answer')) {
    const tokens = backticked(cols[1] ?? '', /`([^`]+)`/g)
    for (const t of tokens) names.add(t)
    if ((cols[3] ?? '').startsWith('**No answer in basalt**'))
      for (const t of tokens) noAnswer.add(t)
  }
  return { names, noAnswer }
}

// ---------------------------------------------------------------------------------------------
// F1a: argo signatures

function documentedSignatures(): { names: Set<string>; version: string } {
  const names = new Set<string>()
  for (const line of readText(join(ARGO_ROOT, 'node_modules/basalt-ui/llms.txt')).split('\n')) {
    if (!line.startsWith('Signature:')) continue
    const name = line
      .slice('Signature:'.length)
      .trim()
      .match(/^(?:(?:type|interface|const|function)\s+)?([A-Za-z_$][\w$]*)/)?.[1]
    if (name !== undefined) names.add(name)
  }
  let version = ''
  try {
    const pkg = JSON.parse(readText(join(ARGO_ROOT, 'node_modules/basalt-ui/package.json'))) as {
      version?: string
    }
    version = pkg.version ?? ''
  } catch {
    // no installed basalt-ui in argo
  }
  return { names, version }
}

interface Used {
  spec: Map<string, string>
  files: Map<string, Set<number>>
}

function usedSignatures(): Used {
  const used: Used = { spec: new Map(), files: new Map() }
  const dir = join(ARGO_ROOT, 'apps/dashboard')
  if (!existsSync(dir)) return used
  const files = walk(dir, (rel) => /\.tsx?$/.test(rel))
  files.forEach((f, idx) => {
    for (const imp of parseSource(readText(f.abs), f.rel).imports) {
      if (imp.from !== 'basalt-ui' && !imp.from.startsWith('basalt-ui/')) continue
      for (const name of imp.names) {
        const prev = used.spec.get(name)
        if (prev === undefined || imp.from < prev) used.spec.set(name, imp.from)
        const set = used.files.get(name) ?? new Set<number>()
        set.add(idx)
        used.files.set(name, set)
      }
    }
  })
  return used
}

// ---------------------------------------------------------------------------------------------
// F4: predicate DSL

type Test = (m: Module) => boolean

const anyMatch = (set: Set<string>, re: RegExp): boolean => {
  for (const v of set) if (re.test(v)) return true
  return false
}

function compile(p: Pred): Test {
  if ('import' in p) {
    const re = new RegExp(p.import.from)
    const wanted = p.import.names
    return (m) =>
      m.kind === 'source' &&
      m.imports.some(
        (i) => re.test(i.from) && (wanted === undefined || i.names.some((n) => wanted.includes(n))),
      )
  }
  if ('decl' in p) {
    const re = new RegExp(p.decl)
    return (m) => m.kind === 'source' && anyMatch(m.decls, re)
  }
  if ('call' in p) {
    const re = new RegExp(p.call)
    return (m) => m.kind === 'source' && anyMatch(m.calls, re)
  }
  if ('ident' in p) {
    const re = new RegExp(p.ident)
    return (m) => m.kind === 'source' && anyMatch(m.idents, re)
  }
  if ('jsxAttr' in p) {
    const re = new RegExp(p.jsxAttr)
    return (m) => m.kind === 'source' && anyMatch(m.jsxAttrs, re)
  }
  if ('path' in p) {
    const re = new RegExp(p.path)
    return (m) => re.test(m.rel)
  }
  if ('dep' in p) {
    const re = new RegExp(p.dep)
    return (m) => m.kind === 'pkg' && anyMatch(m.deps, re)
  }
  if ('any' in p) {
    const tests = p.any.map(compile)
    return (m) => tests.some((t) => t(m))
  }
  throw new Error(`unknown predicate ${JSON.stringify(p)}`)
}

interface Evaluation {
  signatureHits: Set<Module>
  copy: Set<Module>
  lib: Set<Module>
  perItem: Map<string, Set<Module>>
}

function evaluate(
  items: Item[],
  mods: Module[],
  rejected: ReadonlySet<string> = new Set(),
): Evaluation {
  const ev: Evaluation = {
    signatureHits: new Set(),
    copy: new Set(),
    lib: new Set(),
    perItem: new Map(),
  }
  for (const item of items) {
    const tests = item.all.map(compile)
    const hits = new Set<Module>()
    if (tests.length > 0) {
      for (const m of mods) {
        if (!tests.every((t) => t(m))) continue
        if (item.role === 'copy') ev.signatureHits.add(m)
        if (item.role === 'copy' && rejected.has(moduleId(m))) continue
        hits.add(m)
      }
    }
    ev.perItem.set(item.id, hits)
    for (const m of hits) (item.role === 'copy' ? ev.copy : ev.lib).add(m)
  }
  return ev
}

const repoIdsOf = (mods: Iterable<Module>): string[] =>
  sortedArr(new Set([...mods].map((m) => m.repo)))

function summarize(ev: Evaluation) {
  const perItem: Record<string, { copies: number; repos: number }> = {}
  for (const [id, hits] of ev.perItem)
    perItem[id] = { copies: hits.size, repos: repoIdsOf(hits).length }
  const repoIds = repoIdsOf(ev.copy)
  return {
    signatureHits: ev.signatureHits.size,
    copies: ev.copy.size,
    repos: repoIds.length,
    repoIds,
    perItem: sortedRecord(perItem),
    libModules: ev.lib.size,
    ids: sortedArr([...ev.copy].map(moduleId)),
  }
}

// ---------------------------------------------------------------------------------------------
// Main

function verifyEntry(
  entry: MappingEntry,
  section3: Set<string>,
  docCache: Map<string, string>,
): string | null {
  let doc = docCache.get(entry.cite)
  if (doc === undefined) {
    doc = readText(join(DOCS, entry.cite))
    docCache.set(entry.cite, doc)
  }
  if (doc === '') return `cite file missing or empty: ${entry.cite}`
  if (!doc.includes(entry.anchor)) return `anchor not found in ${entry.cite}`
  if (entry.kind === 'symbol' && !section3.has(entry.to))
    return `target not in section 3: ${entry.to}`
  return null
}

function main(): void {
  const mapping = JSON.parse(readText(join(import.meta.dir, 'mapping.json'))) as Mapping
  const refusalsFile = JSON.parse(readText(join(import.meta.dir, 'refusals.json'))) as RefusalsFile
  const review = JSON.parse(readText(join(import.meta.dir, 'review.json'))) as {
    notCopy: { refusal: string; id: string }[]
  }
  const rejectedFor = (refusal: string): Set<string> =>
    new Set(review.notCopy.filter((r) => r.refusal === refusal).map((r) => r.id))

  // ---- scan
  const scans = CONSUMERS.map(([id, rel]) => scanRepo(id, join(HOME, rel)))
  const eposScan = scanRepo(EPOS_ID, EPOS_ROOT)
  const fleet = scans.filter((s) => !s.missing)

  // ---- section 3 and section 9
  const s3 = readSection3()
  const section3 = new Set([...s3.table, ...s3.prim])
  const row9 = readRow9()

  // ---- F1a
  const doc = documentedSignatures()
  const used = usedSignatures()
  const usedNames = sortedArr([...used.spec.keys()].filter((n) => doc.names.has(n)))
  const docCache = new Map<string, string>()
  const citeFailures: { name: string; reason: string }[] = []
  const byKind = new Map<string, number>()
  const judgement: string[] = []
  const unmappedSigs: string[] = []
  let kept = 0
  let mapped = 0
  const markMapped = (kind: string): void => {
    mapped++
    byKind.set(kind, (byKind.get(kind) ?? 0) + 1)
  }
  for (const name of usedNames) {
    if (section3.has(name)) {
      kept++
      continue
    }
    const entry = Object.hasOwn(mapping.sigs, name) ? mapping.sigs[name] : undefined
    if (entry !== undefined) {
      const reason = verifyEntry(entry, section3, docCache)
      if (reason === null) {
        markMapped(entry.kind)
        if (entry.judgement === true) judgement.push(name)
      } else {
        citeFailures.push({ name, reason })
        unmappedSigs.push(name)
      }
      continue
    }
    if (mapping.extras.includes(name)) {
      markMapped('extra')
      continue
    }
    const family = used.spec.get(name) === 'basalt-ui/format' ? mapping.families.format : undefined
    if (family !== undefined && verifyEntry(family, section3, docCache) === null) {
      markMapped(family.kind)
      continue
    }
    unmappedSigs.push(name)
  }

  const extras = mapping.extras.map((name) => ({
    name,
    inSection3: s3.table.has(name),
    argoFiles: used.files.get(name)?.size ?? 0,
  }))
  const symbolSumAfterExtras = s3.table.size + mapping.extras.filter((n) => !s3.table.has(n)).length
  const symbolSumIfUnmappedAlsoAdded = symbolSumAfterExtras + unmappedSigs.length

  // ---- F1b
  const isMapped = (name: string): boolean => {
    if (row9.names.has(name)) return true
    const alias = Object.hasOwn(mapping.tagAliases, name) ? mapping.tagAliases[name] : undefined
    return alias !== undefined && row9.names.has(alias.to)
  }
  const byApp: Record<
    string,
    { files: number; total: number; layout: number; component: number; unmapped: number }
  > = {}
  const unmappedCounts = new Map<string, number>()
  const componentNames = new Set<string>()
  const fleetTags = { total: 0, layout: 0, component: 0, unmapped: 0 }
  const evidence9 = { total: 0, component: 0 }
  for (const s of fleet) {
    let unmapped = 0
    for (const [name, n] of s.tagNames) {
      if (LAYOUT.has(name)) continue
      componentNames.add(name)
      if (isMapped(name)) continue
      unmapped += n
      unmappedCounts.set(name, (unmappedCounts.get(name) ?? 0) + n)
    }
    byApp[s.id] = { ...s.tagStats, unmapped }
    fleetTags.total += s.tagStats.total
    fleetTags.layout += s.tagStats.layout
    fleetTags.component += s.tagStats.component
    fleetTags.unmapped += unmapped
    if (!EVIDENCE9.has(s.id)) continue
    evidence9.total += s.tagStats.total
    evidence9.component += s.tagStats.component
  }
  const unmappedNames = [...unmappedCounts.entries()]
    .toSorted((a, b) => b[1] - a[1] || cmp(a[0], b[0]))
    .map(([name, count]) => ({ name, count }))

  // ---- F1 totals
  const sigUsed = usedNames.length
  const f1Total = sigUsed + fleetTags.component
  const f1Unmapped = unmappedSigs.length + fleetTags.unmapped
  const unmappedShare = round4(f1Unmapped, f1Total)
  const distinctTotal = sigUsed + componentNames.size
  const distinctUnmapped = unmappedSigs.length + unmappedCounts.size

  // ---- F4
  const fleetMods = fleet.flatMap((s) => s.modules)
  const matched = new Set<Module>()
  const byRefusal: Record<string, unknown> = {}
  const eposByRefusal: Record<string, number> = {}
  const copiesByRefusal = new Map<string, number>()
  const eposCopies = new Map<string, number>()
  for (const r of refusalsFile.refusals) {
    if (r.applicable === false) {
      byRefusal[r.id] = { applicable: false, copies: 0, repos: 0 }
      eposByRefusal[r.id] = 0
      continue
    }
    const ev = evaluate(r.items, fleetMods, rejectedFor(r.id))
    for (const m of ev.signatureHits) matched.add(m)
    const summary = summarize(ev)
    byRefusal[r.id] = summary
    copiesByRefusal.set(r.id, summary.copies)
    const eposN = evaluate(r.items, eposScan.modules).copy.size
    eposByRefusal[r.id] = eposN
    eposCopies.set(r.id, eposN)
  }
  const optEv = evaluate(refusalsFile.optimistic.items, fleetMods)
  for (const m of optEv.signatureHits) matched.add(m)
  const optSummary = summarize(optEv)
  const { libModules: _libModules, ...optimistic } = optSummary
  const optEposCopies = evaluate(refusalsFile.optimistic.items, eposScan.modules).copy.size

  const reinstate = sortedArr([...copiesByRefusal].filter(([, n]) => n >= 3).map(([id]) => id))
  const watch = sortedArr(
    [...copiesByRefusal]
      .filter(([id, n]) => n < 3 && n + (eposCopies.get(id) ?? 0) >= 3)
      .map(([id]) => id),
  )

  // ---- verdict
  const f1Refuted = unmappedShare > 0.1 || symbolSumAfterExtras > 100
  const f4Refuted = reinstate.length > 0
  const verdictLines = {
    F1: f1Refuted ? 'REFUTED' : 'PASS',
    F4: f4Refuted ? 'REFUTED' : 'PASS',
    Optimistic: optSummary.copies >= 2 ? 'keep' : 'drop',
    Verdict: f1Refuted || f4Refuted ? 'REFUTED' : 'PASS',
  }

  const scanRepos: Record<string, unknown> = {}
  for (const s of scans) {
    scanRepos[s.id] = s.missing
      ? { missing: true }
      : { sourceFiles: s.sourceFiles, parsed: s.parsed, parseErrors: s.parseErrors, head: s.head }
  }

  const out: Record<string, unknown> = {
    harness: { name: 'census', typescript: ts.version },
    scan: {
      repos: sortedRecord(scanRepos),
      epos: eposScan.missing
        ? { available: false, sourceFiles: 0 }
        : { available: true, sourceFiles: eposScan.sourceFiles },
    },
    f1: {
      total: f1Total,
      unmapped: f1Unmapped,
      unmappedShare,
      distinct: {
        total: distinctTotal,
        unmapped: distinctUnmapped,
        share: round4(distinctUnmapped, distinctTotal),
      },
      signaturesOnly: {
        used: sigUsed,
        kept,
        mapped,
        unmapped: unmappedSigs.length,
        share: round4(unmappedSigs.length, sigUsed),
      },
      argo: {
        signatures: sigUsed,
        documented: doc.names.size,
        llmsVersion: doc.version,
        kept,
        mapped,
        unmapped: unmappedSigs.length,
        byKind: sortedRecord(byKind),
        unmappedNames: sortedArr(unmappedSigs),
        judgement: sortedArr(judgement),
        citeFailures,
        usedNames,
      },
      section3: {
        tableSymbols: s3.table.size,
        declaredSum: s3.declaredSum,
        sumMatches: s3.table.size === s3.declaredSum,
        primitiveNames: s3.prim.size,
      },
      extras,
      symbolSumAfterExtras,
      symbolSumIfUnmappedAlsoAdded,
      tags: {
        total: fleetTags.total,
        layout: fleetTags.layout,
        component: fleetTags.component,
        unmapped: fleetTags.unmapped,
        evidence9,
        unmappedNames,
        distinctComponentNames: componentNames.size,
        distinctUnmapped: unmappedCounts.size,
        noAnswerNames: sortedArr(row9.noAnswer),
        documented: DOCUMENTED,
        epos: eposScan.tagStats,
        byApp: sortedRecord(byApp),
      },
    },
    f4: {
      byRefusal: sortedRecord(byRefusal),
      optimisticCopies: optSummary.copies,
      optimistic,
      epos: {
        available: !eposScan.missing,
        byRefusal: sortedRecord(eposByRefusal),
        optimisticCopies: optEposCopies,
      },
      watch,
      reinstate,
    },
    verdictLines,
    verdict: verdictLines.Verdict,
  }
  if (WITH_NAMES) {
    out.names = sortedRecord(
      new Map([...matched].map((m) => [moduleId(m), `${m.repo}:${m.rel}`] as const)),
    )
  }
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`)
}

main()
