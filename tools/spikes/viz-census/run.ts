/**
 * Spike v3-spike-viz-census (docs/v3/EXPRESSION.md, Hypothesis and Thresholds). Throwaway harness,
 * no tests.
 *
 *   V1  what share of the fleet's visualization modules can v3 express only through
 *       `CartesianChart.custom` or not at all?
 *   V2  which forms recur (3+ copies in 2+ repos) outside the shipped kinds?
 *   V3  which hand-written geometry helpers recur (3+ copies in 2+ repos)?
 *   V4  which of the twelve devices are present in under 25% of the modules where they apply?
 *
 * Static AST scan over the consumer repos, strictly read-only. Candidates come from the fixed
 * signatures in signatures.json; review.json confirms or rejects each candidate and classifies the
 * confirmed ones. The output is deterministic (sorted keys and arrays, no timestamps) and carries
 * no file paths unless CENSUS_NAMES=1. The 13th consumer (Epos) appears as counts only.
 *
 * Prints ONE JSON object on stdout and always exits 0 (0 = the harness ran, not "hypothesis held").
 * Progress goes to stderr.
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import ts from 'typescript'

const HERE = resolve(import.meta.dir)
const HOME = homedir()
const WITH_NAMES = process.env.CENSUS_NAMES === '1'

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  '.claude',
  'out',
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

const SUBSTRATES = ['kind', 'cartesian-compose', 'hand-svg', 'hand-html', 'canvas', 'library']
const V3_WAYS = ['kind', 'CartesianChart', 'CartesianChart.custom', 'primitive', 'none']
const HELPERS = [
  'scale',
  'ticks',
  'polar-arc',
  'packing',
  'measure-width',
  'label-fit',
  'hit-focus',
  'tooltip',
]
const DEVICES = [
  'd01-metaphor',
  'd02-hero-readout',
  'd03-delta-baseline',
  'd04-colour-budget',
  'd05-quantized',
  'd06-threshold-geometry',
  'd07-pre-annotation',
  'd08-direct-labels',
  'd09-live-cues',
  'd10-dim-focus',
  'd11-keyboard',
  'd12-anatomy',
]
// Thresholds of docs/v3/EXPRESSION.md § Thresholds, as the spike brief spells them out.
const V1_CONFIRM_SHARE = 0.2
const V1_REFUTE_SHARE = 0.1
const RULE_COPIES = 3
const RULE_REPOS = 2
const V1_REPOS = 3
const V4_SHARE = 0.25
const shipped = (v: string): boolean => v === 'kind' || v === 'primitive'
const passes = (t: { copies: number; repos: number }): boolean =>
  t.copies >= RULE_COPIES && t.repos >= RULE_REPOS

// ---------------------------------------------------------------------------------------------
// Types and small helpers

interface Signatures {
  library: { packages: string[]; frames: Record<string, string[]> }
  kit: Record<string, string[]>
  svg: { geometryAttributes: string[]; imperativeCalls: string[] }
  canvas: { calls: string[] }
  cells: { styleKeys: string[]; sizeProps: string[] }
  mapCallees: string[]
}
interface Classified {
  id: string
  form: string
  substrate: string
  v3: string
  helpers: string[]
  devices: { present: string[]; applicable: string[] }
  note: string
}
interface Review {
  forms: string[]
  rejected: { id: string; why: string }[]
  confirmed: Classified[]
}
interface Hit {
  sig: string
  line: number
}
interface Candidate {
  repo: string
  rel: string
  id: string
  lines: number
  hits: Hit[]
  hints: string[]
}

const log = (msg: string): void => process.stderr.write(`[viz-census] ${msg}\n`)
const sha8 = (s: string): string => createHash('sha1').update(s).digest('hex').slice(0, 8)
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
const sortedArr = (xs: Iterable<string>): string[] => [...new Set(xs)].toSorted(cmp)
const ratio = (n: number, d: number): number => (d === 0 ? 0 : Number((n / d).toFixed(4)))
const readJson = <T>(name: string): T => JSON.parse(readFileSync(join(HERE, name), 'utf8')) as T

function sortedRecord<T>(m: Map<string, T> | Record<string, T>): Record<string, T> {
  const entries = m instanceof Map ? [...m.entries()] : Object.entries(m)
  entries.sort((a, b) => cmp(a[0], b[0]))
  return Object.fromEntries(entries)
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const s = xs.toSorted((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// ---------------------------------------------------------------------------------------------
// File walk

interface WalkedFile {
  abs: string
  rel: string
}

function walk(root: string): WalkedFile[] {
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
      if (!e.isFile() || TEST_PATH_RE.test(rel)) continue
      if (!SOURCE_RE.test(rel) || NOT_SOURCE_RE.test(rel)) continue
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

function gitHead(root: string): string {
  try {
    const r = Bun.spawnSync(['git', 'rev-parse', '--short', 'HEAD'], { cwd: root })
    return r.exitCode === 0 ? r.stdout.toString().trim() : ''
  } catch {
    return ''
  }
}

// ---------------------------------------------------------------------------------------------
// Signature detection

const isLiteral = (e: ts.Expression): boolean =>
  ts.isStringLiteralLike(e) ||
  ts.isNumericLiteral(e) ||
  e.kind === ts.SyntaxKind.TrueKeyword ||
  e.kind === ts.SyntaxKind.FalseKeyword ||
  e.kind === ts.SyntaxKind.NullKeyword ||
  (ts.isPrefixUnaryExpression(e) && ts.isNumericLiteral(e.operand))

function hasPercent(e: ts.Expression): boolean {
  if (ts.isTemplateExpression(e)) {
    return [e.head.text, ...e.templateSpans.map((s) => s.literal.text)].some((t) => t.includes('%'))
  }
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const sides = [e.left, e.right]
    return sides.some((s) => (ts.isStringLiteralLike(s) && s.text.includes('%')) || hasPercent(s))
  }
  if (ts.isParenthesizedExpression(e)) return hasPercent(e.expression)
  return false
}

function calleeText(n: ts.Node): string | null {
  if (ts.isIdentifier(n)) return n.text
  if (!ts.isPropertyAccessExpression(n)) return null
  const base = calleeText(n.expression)
  return base === null ? n.name.text : `${base}.${n.name.text}`
}

function specText(n: ts.Expression | undefined): string | null {
  return n !== undefined && ts.isStringLiteralLike(n) ? n.text : null
}

function tagRoot(n: ts.JsxTagNameExpression): { root: string; member: string | null } | null {
  if (ts.isIdentifier(n)) return { root: n.text, member: null }
  if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression)) {
    return { root: n.expression.text, member: n.name.text }
  }
  return null
}

function packageOf(from: string, packages: string[]): string | null {
  for (const p of packages) {
    if (p.endsWith('/') ? from.startsWith(p) : from === p || from.startsWith(`${p}/`)) return p
  }
  return null
}

const isKitFamily = (family: string, from: string): boolean =>
  family === 'basalt-ui' ? from === 'basalt-ui' || from.startsWith('basalt-ui/') : from === family

interface Binding {
  from: string
  name: string
}

function bindingsOf(sf: ts.SourceFile): Map<string, Binding> {
  const out = new Map<string, Binding>()
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || st.importClause === undefined) continue
    if (st.importClause.isTypeOnly) continue
    const from = specText(st.moduleSpecifier)
    if (from === null) continue
    const clause = st.importClause
    if (clause.name !== undefined) out.set(clause.name.text, { from, name: 'default' })
    const nb = clause.namedBindings
    if (nb === undefined) continue
    if (ts.isNamespaceImport(nb)) {
      out.set(nb.name.text, { from, name: '*' })
      continue
    }
    for (const el of nb.elements) {
      if (el.isTypeOnly) continue
      out.set(el.name.text, { from, name: (el.propertyName ?? el.name).text })
    }
  }
  return out
}

function insideMapCallback(n: ts.Node, mapCallees: Set<string>): boolean {
  let cur: ts.Node | undefined = n.parent
  while (cur !== undefined) {
    if (ts.isArrowFunction(cur) || ts.isFunctionExpression(cur)) {
      const call = cur.parent
      if (call !== undefined && ts.isCallExpression(call) && call.arguments.includes(cur)) {
        const callee = calleeText(call.expression)
        const last = callee === null ? '' : callee.split('.').at(-1)
        if (callee !== null && (mapCallees.has(callee) || mapCallees.has(last ?? ''))) return true
      }
    }
    if (ts.isSourceFile(cur)) return false
    cur = cur.parent
  }
  return false
}

function subtreeHasMap(n: ts.Node, mapCallees: Set<string>): boolean {
  let found = false
  const visit = (c: ts.Node): void => {
    if (found) return
    if (ts.isCallExpression(c)) {
      const callee = calleeText(c.expression)
      const last = callee === null ? '' : callee.split('.').at(-1)
      if (callee !== null && (mapCallees.has(callee) || mapCallees.has(last ?? ''))) {
        found = true
        return
      }
    }
    ts.forEachChild(c, visit)
  }
  ts.forEachChild(n, visit)
  return found
}

function subtreeHasComputedGeometry(svg: ts.JsxElement, attrs: Set<string>): boolean {
  let found = false
  const visit = (c: ts.Node): void => {
    if (found) return
    if (ts.isJsxAttribute(c) && c.parent.parent !== svg.openingElement) {
      const name = ts.isIdentifier(c.name) ? c.name.text : c.name.name.text
      const init = c.initializer
      if (
        attrs.has(name) &&
        init !== undefined &&
        ts.isJsxExpression(init) &&
        init.expression !== undefined &&
        !isLiteral(init.expression)
      ) {
        found = true
        return
      }
    }
    ts.forEachChild(c, visit)
  }
  ts.forEachChild(svg, visit)
  return found
}

const lineOf = (sf: ts.SourceFile, n: ts.Node): number =>
  sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1

// Helper hints: lexical cues printed for the reviewer in CENSUS_NAMES mode only. The verdict reads
// the helpers of review.json, which were set by reading each module.
const HINTS: readonly (readonly [string, RegExp])[] = [
  [
    'scale',
    /\bscale(Linear|Band|Time|Utc|Log|Sqrt|Point|Ordinal|Pow)\b|\b(toX|toY|xOf|yOf|xFor|yFor|xScale|yScale)\b/,
  ],
  ['ticks', /\bticks?\b|\bniceStep\b|\bnice\(/i],
  ['polar-arc', /Math\.(cos|sin|atan2)\b|\bpolar\b|\barc\(/],
  ['packing', /\bcollid|\boverlap|\bpack(ed|ing)?\b/i],
  [
    'measure-width',
    /ResizeObserver|getBoundingClientRect|clientWidth|offsetWidth|useElementSize|useMeasure|useResizeObserver/,
  ],
  ['label-fit', /measureText|getComputedTextLength|getBBox|charWidth|CHAR_W/],
  ['hit-focus', /onPointerMove|onMouseMove|bisect|nearest|hoverIndex|activeIndex|focused?Index/],
  ['tooltip', /tooltip/i],
]

interface ScanResult {
  hits: Hit[]
  lines: number
  hints: string[]
}

function scanSource(text: string, rel: string, sig: Signatures): ScanResult {
  const kind = /\.[mc]?ts$/.test(rel) ? ts.ScriptKind.TS : ts.ScriptKind.TSX
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, kind)
  const bindings = bindingsOf(sf)
  const mapCallees = new Set(sig.mapCallees)
  const geometry = new Set(sig.svg.geometryAttributes)
  const styleKeys = new Set(sig.cells.styleKeys)
  const sizeProps = new Set(sig.cells.sizeProps)
  const imperative = new Set(sig.svg.imperativeCalls)
  const canvasCalls = new Set(sig.canvas.calls)
  const hits: Hit[] = []
  const add = (s: string, n: ts.Node): void => {
    hits.push({ sig: s, line: lineOf(sf, n) })
  }

  const libraryTag = (tag: ts.JsxTagNameExpression, n: ts.Node): void => {
    const t = tagRoot(tag)
    if (t === null) return
    const b = bindings.get(t.root)
    if (b === undefined) return
    const name = b.name === '*' ? (t.member ?? '*') : b.name
    const pkg = packageOf(b.from, sig.library.packages)
    if (pkg !== null) {
      const frame = Object.entries(sig.library.frames).find(
        ([p]) => b.from === p || b.from.startsWith(`${p}/`),
      )
      if (frame !== undefined && (frame[1].includes('*') || frame[1].includes(name))) return
      add(`library:${pkg}`, n)
      return
    }
    for (const [family, names] of Object.entries(sig.kit)) {
      if (isKitFamily(family, b.from) && names.includes(name)) add(`kit:${family}:${name}`, n)
    }
  }

  const cellAttr = (n: ts.JsxAttribute): void => {
    const name = ts.isIdentifier(n.name) ? n.name.text : n.name.name.text
    const init = n.initializer
    if (init === undefined || !ts.isJsxExpression(init) || init.expression === undefined) return
    const expr = init.expression
    const values: ts.Expression[] = []
    if (name === 'style' && ts.isObjectLiteralExpression(expr)) {
      for (const p of expr.properties) {
        if (!ts.isPropertyAssignment(p)) continue
        const key = ts.isIdentifier(p.name)
          ? p.name.text
          : ts.isStringLiteralLike(p.name)
            ? p.name.text
            : ''
        if (styleKeys.has(key) || key.startsWith('--')) values.push(p.initializer)
      }
    } else if (sizeProps.has(name)) {
      values.push(expr)
    }
    const computed = values.filter((v) => !isLiteral(v))
    if (computed.length === 0) return
    if (computed.some(hasPercent) || insideMapCallback(n, mapCallees)) add('cells', n)
  }

  const visit = (n: ts.Node): void => {
    if (ts.isJsxElement(n)) {
      const tag = n.openingElement.tagName
      if (ts.isIdentifier(tag) && tag.text === 'svg') {
        if (subtreeHasMap(n, mapCallees)) add('svg:map', n)
        else if (subtreeHasComputedGeometry(n, geometry)) add('svg:attr', n)
      }
    }
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tag = n.tagName
      if (ts.isIdentifier(tag) && tag.text === 'canvas') add('canvas', n)
      libraryTag(tag, n)
    }
    if (ts.isJsxAttribute(n)) cellAttr(n)
    if (ts.isCallExpression(n)) {
      const callee = calleeText(n.expression)
      const last = callee === null ? '' : (callee.split('.').at(-1) ?? '')
      if (imperative.has(last)) add('svg:imperative', n)
      if (canvasCalls.has(last)) add('canvas', n)
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)

  const lines = text.split('\n').filter((l) => l.trim() !== '').length
  const hints = HINTS.filter(([, re]) => re.test(text)).map(([h]) => h)
  return { hits, lines, hints }
}

// ---------------------------------------------------------------------------------------------
// Repo scan

interface RepoScan {
  id: string
  missing: boolean
  sourceFiles: number
  head: string
  candidates: Candidate[]
}

function scanRepo(id: string, root: string, sig: Signatures): RepoScan {
  const scan: RepoScan = {
    id,
    missing: !existsSync(root),
    sourceFiles: 0,
    head: '',
    candidates: [],
  }
  if (scan.missing) return scan
  scan.head = gitHead(root)
  for (const f of walk(root)) {
    scan.sourceFiles++
    let r: ScanResult
    try {
      r = scanSource(readFileSync(f.abs, 'utf8'), f.rel, sig)
    } catch {
      continue
    }
    if (r.hits.length === 0) continue
    scan.candidates.push({
      repo: id,
      rel: f.rel,
      id: sha8(`${id}:${f.rel}`),
      lines: r.lines,
      hits: r.hits,
      hints: r.hints,
    })
  }
  log(`${id}: ${scan.sourceFiles} source files, ${scan.candidates.length} candidates`)
  return scan
}

const sigFamily = (s: string): string =>
  s.startsWith('library:') ? 'library' : s.startsWith('kit:') ? 'kit' : s.split(':')[0]

function countBySignature(cands: Candidate[]): Record<string, number> {
  const m = new Map<string, number>()
  for (const c of cands) {
    for (const f of new Set(c.hits.map((h) => sigFamily(h.sig)))) m.set(f, (m.get(f) ?? 0) + 1)
  }
  return sortedRecord(m)
}

// ---------------------------------------------------------------------------------------------
// Aggregation

interface Tally {
  copies: number
  repos: number
}

function tallyBy(
  mods: { repo: string }[],
  keysOf: (m: { repo: string }) => string[],
): Map<string, { copies: number; repos: Set<string> }> {
  const out = new Map<string, { copies: number; repos: Set<string> }>()
  for (const m of mods) {
    for (const k of new Set(keysOf(m))) {
      const t = out.get(k) ?? { copies: 0, repos: new Set<string>() }
      t.copies++
      t.repos.add(m.repo)
      out.set(k, t)
    }
  }
  return out
}

const toTally = (t: { copies: number; repos: Set<string> } | undefined): Tally => ({
  copies: t?.copies ?? 0,
  repos: t?.repos.size ?? 0,
})

function main(): void {
  const sig = readJson<Signatures>('signatures.json')
  const review = readJson<Review>('review.json')
  const scans = CONSUMERS.map(([id, rel]) => scanRepo(id, join(HOME, rel), sig))
  const epos = scanRepo('epos', EPOS_ROOT, sig)

  const candidates = scans.flatMap((s) => s.candidates)
  const byId = new Map(candidates.map((c) => [c.id, c] as const))
  const rejectedIds = new Set(review.rejected.map((r) => r.id))
  const classifiedIds = new Map(review.confirmed.map((c) => [c.id, c] as const))
  const forms = new Set(review.forms)

  // Review integrity: every candidate is either rejected or classified, and every review entry
  // names a candidate of this scan. Problems are reported, never thrown, so the harness exits 0.
  const problems: string[] = []
  for (const c of candidates) {
    if (!rejectedIds.has(c.id) && !classifiedIds.has(c.id)) problems.push(`unreviewed ${c.id}`)
    if (rejectedIds.has(c.id) && classifiedIds.has(c.id)) problems.push(`both ${c.id}`)
  }
  for (const id of [...rejectedIds, ...classifiedIds.keys()]) {
    if (!byId.has(id)) problems.push(`stale ${id}`)
  }
  for (const c of review.confirmed) {
    if (!forms.has(c.form)) problems.push(`form ${c.id} ${c.form}`)
    if (!SUBSTRATES.includes(c.substrate)) problems.push(`substrate ${c.id} ${c.substrate}`)
    if (!V3_WAYS.includes(c.v3)) problems.push(`v3 ${c.id} ${c.v3}`)
    for (const h of c.helpers) if (!HELPERS.includes(h)) problems.push(`helper ${c.id} ${h}`)
    for (const d of [...c.devices.present, ...c.devices.applicable]) {
      if (!DEVICES.includes(d)) problems.push(`device ${c.id} ${d}`)
    }
    for (const d of c.devices.present) {
      if (!c.devices.applicable.includes(d)) problems.push(`present-not-applicable ${c.id} ${d}`)
    }
  }

  const confirmed = review.confirmed
    .filter((c) => byId.has(c.id))
    .map((c) => {
      const cand = byId.get(c.id) as Candidate
      return { ...c, repo: cand.repo, lines: cand.lines }
    })
    .toSorted((a, b) => cmp(a.id, b.id))

  const total = confirmed.length
  const count = (key: (m: (typeof confirmed)[number]) => string): Record<string, number> => {
    const m = new Map<string, number>()
    for (const c of confirmed) m.set(key(c), (m.get(key(c)) ?? 0) + 1)
    return sortedRecord(m)
  }

  // V1: modules v3 expresses only through the escape hatch, or not at all.
  const seam = confirmed.filter((c) => c.v3 === 'none' || c.v3 === 'CartesianChart.custom')
  const seamRepos = sortedArr(seam.map((c) => c.repo))
  const v1Share = ratio(seam.length, total)
  const v1 =
    v1Share >= V1_CONFIRM_SHARE || seamRepos.length >= V1_REPOS
      ? 'CONFIRMED'
      : v1Share < V1_REFUTE_SHARE && seamRepos.length < V1_REPOS
        ? 'REFUTED'
        : 'OPEN'

  // V2, the rule as fixed in the brief: a form with 3+ copies in 2+ repos whose v3 is not `kind`.
  // Two annotations read it more narrowly and never set the verdict: `exemptPrimitive` also skips
  // copies a shipped primitive draws, and `exemptCovered` then drops forms of which at least one
  // copy is drawn by a kind or a primitive (its other copies ask for more of that symbol).
  const formAll = tallyBy(confirmed, (m) => [(m as Classified).form])
  const formNotKind = tallyBy(
    confirmed.filter((c) => c.v3 !== 'kind'),
    (m) => [(m as Classified).form],
  )
  const formUnshipped = tallyBy(
    confirmed.filter((c) => !shipped(c.v3)),
    (m) => [(m as Classified).form],
  )
  const byForm: Record<string, Tally & { notKind: Tally; unshipped: Tally; covered: boolean }> = {}
  for (const f of sortedArr(formAll.keys())) {
    byForm[f] = {
      ...toTally(formAll.get(f)),
      notKind: toTally(formNotKind.get(f)),
      unshipped: toTally(formUnshipped.get(f)),
      covered: confirmed.some((c) => c.form === f && shipped(c.v3)),
    }
  }
  const v2Forms = Object.entries(byForm)
    .filter(([, t]) => passes(t.notKind))
    .map(([f]) => f)
  const v2ExemptPrimitive = Object.entries(byForm)
    .filter(([, t]) => passes(t.unshipped))
    .map(([f]) => f)
  const v2ExemptCovered = Object.entries(byForm)
    .filter(([, t]) => !t.covered && passes(t.unshipped))
    .map(([f]) => f)

  // V3: hand-written helpers with 3+ copies in 2+ repos. `handDrawnOnly` counts only modules whose
  // own marks are hand-drawn or composed (not a kind, kit mark or library), as a sensitivity.
  const helperTally = tallyBy(confirmed, (m) => (m as Classified).helpers)
  const handTally = tallyBy(
    confirmed.filter((c) => c.substrate !== 'kind' && c.substrate !== 'library'),
    (m) => (m as Classified).helpers,
  )
  const byHelper: Record<string, Tally & { handDrawnOnly: Tally }> = {}
  for (const h of HELPERS) {
    byHelper[h] = { ...toTally(helperTally.get(h)), handDrawnOnly: toTally(handTally.get(h)) }
  }
  const v3Helpers = HELPERS.filter((h) => passes(byHelper[h]))
  const v3HandDrawnOnly = HELPERS.filter((h) => passes(byHelper[h].handDrawnOnly))

  // V4: devices present in under 25% of the modules where they apply.
  const byDevice: Record<string, { present: number; applicable: number; share: number }> = {}
  for (const d of DEVICES) {
    const applicable = confirmed.filter((c) => c.devices.applicable.includes(d)).length
    const present = confirmed.filter((c) => c.devices.present.includes(d)).length
    byDevice[d] = { present, applicable, share: ratio(present, applicable) }
  }
  const v4Devices = DEVICES.filter(
    (d) => byDevice[d].applicable > 0 && byDevice[d].share < V4_SHARE,
  )

  const linesBy = (key: (c: (typeof confirmed)[number]) => string): Record<string, number> => {
    const m = new Map<string, number[]>()
    for (const c of confirmed) m.set(key(c), [...(m.get(key(c)) ?? []), c.lines])
    return sortedRecord(new Map([...m].map(([k, xs]) => [k, median(xs)] as const)))
  }

  const scanRepos: Record<string, unknown> = {}
  for (const s of scans) {
    scanRepos[s.id] = s.missing
      ? { missing: true }
      : { sourceFiles: s.sourceFiles, candidates: s.candidates.length, head: s.head }
  }

  const verdictLines = {
    V1: `V1 seam: ${v1}`,
    V2: `V2 kinds: ${v2Forms.length === 0 ? 'none' : v2Forms.join(', ')}`,
    V3: `V3 helpers: ${v3Helpers.length === 0 ? 'none' : v3Helpers.join(', ')}`,
    V4: `V4 devices: ${v4Devices.length === 0 ? 'none' : v4Devices.join(', ')}`,
  }

  const out: Record<string, unknown> = {
    harness: { name: 'viz-census', typescript: ts.version },
    scan: {
      repos: sortedRecord(scanRepos),
      candidates: candidates.length,
      bySignature: countBySignature(candidates),
    },
    review: {
      confirmed: total,
      rejected: review.rejected.filter((r) => byId.has(r.id)).length,
      problems: problems.toSorted(cmp),
    },
    total,
    byRepo: count((c) => c.repo),
    bySubstrate: count((c) => c.substrate),
    byV3: count((c) => c.v3),
    lines: {
      total: confirmed.reduce((s, c) => s + c.lines, 0),
      median: median(confirmed.map((c) => c.lines)),
      medianBySubstrate: linesBy((c) => c.substrate),
      medianByV3: linesBy((c) => c.v3),
    },
    v1: {
      share: v1Share,
      modules: seam.length,
      repos: seamRepos.length,
      repoList: seamRepos,
      byRepo: sortedRecord(
        new Map(seamRepos.map((r) => [r, seam.filter((c) => c.repo === r).length] as const)),
      ),
      byForm: sortedRecord(
        new Map(
          sortedArr(seam.map((c) => c.form)).map(
            (f) => [f, seam.filter((c) => c.form === f).length] as const,
          ),
        ),
      ),
      byWay: sortedRecord(
        new Map(
          ['CartesianChart.custom', 'none'].map(
            (w) => [w, seam.filter((c) => c.v3 === w).length] as const,
          ),
        ),
      ),
    },
    v2: {
      byForm,
      forms: v2Forms,
      annotations: { exemptPrimitive: v2ExemptPrimitive, exemptCovered: v2ExemptCovered },
    },
    v3: { byHelper, helpers: v3Helpers, handDrawnOnly: v3HandDrawnOnly },
    v4: { byDevice, devices: v4Devices },
    epos: epos.missing
      ? { available: false }
      : {
          available: true,
          sourceFiles: epos.sourceFiles,
          candidates: epos.candidates.length,
          bySignature: countBySignature(epos.candidates),
        },
    verdictLines,
  }
  if (WITH_NAMES) {
    out.names = candidates
      .toSorted((a, b) => cmp(`${a.repo}:${a.rel}`, `${b.repo}:${b.rel}`))
      .map((c) => ({
        id: c.id,
        at: `${c.repo}:${c.rel}:${c.hits[0]?.line ?? 0}`,
        lines: c.lines,
        sigs: sortedArr(c.hits.map((h) => `${h.sig}@${h.line}`)),
        hints: c.hints,
        status: rejectedIds.has(c.id) ? 'rejected' : classifiedIds.has(c.id) ? 'confirmed' : 'open',
      }))
  }
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`)
}

main()
