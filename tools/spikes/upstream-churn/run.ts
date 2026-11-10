/**
 * Spike 628 (docs/v3/ARCHITECTURE.md section 11 F8). Throwaway harness, no tests.
 *
 * Replays two upstream histories over the last N complete calendar months and counts how often the
 * source behind each of the 36 primitive modules (docs/v3/concepts/primitives-distribution.md
 * section 4) changes in a way an ejected copy would have to merge:
 *
 *   baseUi    mui/base-ui       unit = a release whose diff touches the part's source directory
 *   baseNova  shadcn-ui/ui      unit = a commit touching the primitive's authored base-nova file
 *
 * Each change is API or anatomy (the exported surface, the rendered tags, data-/aria- attributes
 * or CSS variables differ; for base-nova any non-class change) or cosmetic (everything else).
 * `changePerMonth` = anatomyChangeCount / monthsCovered.
 *
 * Prints ONE JSON object on stdout and always exits 0 (0 = the harness ran, not "hypothesis held").
 * Progress goes to stderr. Upstream clones live in the OS temp dir.
 *
 *   bun run.ts [--months 10] [--as-of YYYY-MM-DD] [--offline]
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ts from 'typescript'

const BASE_UI = {
  url: 'https://github.com/mui/base-ui.git',
  head: 'origin/master',
  src: 'packages/react/src',
}
const SHADCN = {
  url: 'https://github.com/shadcn-ui/ui.git',
  head: 'origin/main',
  ui: 'apps/v4/registry/bases/base/ui',
  style: 'apps/v4/registry/styles/style-nova.css',
}
const CACHE = join(tmpdir(), 'basalt-upstream-churn')
const MIN_MONTHS = 6
const THRESHOLD = 1.0

interface Module {
  id: string
  /** Directories under packages/react/src (the `Base UI part` column). */
  parts: string[]
  /** Files under apps/v4/registry/bases/base/ui, without extension. */
  nova: string[]
}

// Numbering follows primitives-distribution.md section 4 (rows 2-3, 7-9, 24-25, 27-29, 31-32 are
// several modules each). textarea reuses `input` through `render`, so it has no part of its own.
const MODULES: Module[] = [
  { id: 'button', parts: ['button'], nova: ['button'] },
  { id: 'input', parts: ['input'], nova: ['input', 'input-group'] },
  { id: 'textarea', parts: [], nova: ['textarea'] },
  { id: 'number-field', parts: ['number-field'], nova: [] },
  { id: 'select', parts: ['select'], nova: ['select', 'native-select'] },
  { id: 'combobox', parts: ['combobox', 'autocomplete'], nova: ['combobox'] },
  { id: 'checkbox', parts: ['checkbox', 'checkbox-group'], nova: ['checkbox'] },
  { id: 'radio-group', parts: ['radio', 'radio-group'], nova: ['radio-group'] },
  { id: 'switch', parts: ['switch'], nova: ['switch'] },
  { id: 'slider', parts: ['slider'], nova: ['slider'] },
  { id: 'segmented', parts: ['toggle-group', 'toggle'], nova: ['toggle-group', 'toggle'] },
  { id: 'field', parts: ['field', 'fieldset', 'form'], nova: ['field'] },
  { id: 'dialog', parts: ['dialog', 'alert-dialog'], nova: ['dialog', 'alert-dialog'] },
  { id: 'sheet', parts: ['drawer'], nova: ['sheet', 'drawer'] },
  { id: 'popover', parts: ['popover'], nova: ['popover'] },
  { id: 'tooltip', parts: ['tooltip'], nova: ['tooltip'] },
  { id: 'menu', parts: ['menu'], nova: ['dropdown-menu'] },
  { id: 'toast', parts: ['toast'], nova: ['toast'] },
  { id: 'tabs', parts: ['tabs'], nova: ['tabs'] },
  { id: 'accordion', parts: ['accordion'], nova: ['accordion'] },
  { id: 'collapsible', parts: ['collapsible'], nova: ['collapsible'] },
  { id: 'card', parts: [], nova: ['card'] },
  { id: 'table', parts: [], nova: ['table'] },
  { id: 'scroll-area', parts: ['scroll-area'], nova: ['scroll-area'] },
  { id: 'separator', parts: ['separator'], nova: ['separator'] },
  { id: 'skeleton', parts: [], nova: ['skeleton', 'spinner'] },
  { id: 'badge', parts: [], nova: ['badge'] },
  { id: 'status', parts: [], nova: [] },
  { id: 'alert', parts: [], nova: ['alert'] },
  { id: 'kbd', parts: [], nova: ['kbd'] },
  { id: 'progress', parts: ['progress'], nova: ['progress'] },
  { id: 'meter', parts: ['meter'], nova: [] },
  { id: 'toolbar', parts: ['toolbar'], nova: [] },
  { id: 'num', parts: [], nova: [] },
  { id: 'date-picker', parts: [], nova: ['calendar'] },
  { id: 'virtual-list', parts: [], nova: [] },
]

// ---------------------------------------------------------------- git

function git(dir: string, args: string[], input?: string): Buffer {
  return execFileSync('git', args, {
    cwd: dir,
    input,
    maxBuffer: 1 << 30,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

const gitText = (dir: string, args: string[]): string => git(dir, args).toString('utf8').trim()

function sync(name: string, url: string, offline: boolean): string {
  const dir = join(CACHE, name)
  if (!existsSync(join(dir, '.git'))) {
    process.stderr.write(`[upstream-churn] cloning ${url}\n`)
    execFileSync('git', ['clone', '--quiet', '--no-checkout', url, dir], {
      stdio: ['ignore', 'ignore', 'inherit'],
    })
  } else if (!offline) {
    process.stderr.write(`[upstream-churn] fetching ${url}\n`)
    git(dir, ['fetch', '--quiet', '--tags', '--prune', 'origin'])
  }
  return dir
}

/** Reads `<ref>:<path>` specs through one `git cat-file --batch`; null where the object is missing. */
function readBlobs(dir: string, specs: string[]): Map<string, string | null> {
  const out = new Map<string, string | null>()
  if (specs.length === 0) return out
  const buf = git(dir, ['cat-file', '--batch'], `${specs.join('\n')}\n`)
  let at = 0
  for (const spec of specs) {
    const eol = buf.indexOf(0x0a, at)
    const header = buf.subarray(at, eol).toString('utf8')
    at = eol + 1
    if (header.endsWith(' missing')) {
      out.set(spec, null)
      continue
    }
    const size = Number(header.split(' ')[2])
    out.set(spec, buf.subarray(at, at + size).toString('utf8'))
    at += size + 1
  }
  return out
}

const isSource = (path: string): boolean =>
  /\.tsx?$/.test(path) && !/(\.test\.|\.spec\.|__tests__|\.stories\.|\/docs\/)/.test(path)

// ---------------------------------------------------------------- ast

const printer = ts.createPrinter({ removeComments: true })

function parse(text: string, name: string): ts.SourceFile {
  return ts.createSourceFile(
    name,
    text,
    ts.ScriptTarget.Latest,
    true,
    name.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
}

/**
 * Files whose exports are internal plumbing, not the part's documented API: hooks, contexts,
 * stores and utils. They still count for anatomy (a hook that sets a data attribute moves it).
 */
const isPublicFile = (path: string): boolean =>
  !/(^|\/)(store|stores|utils|internals|hooks)\//.test(path) &&
  !/\/(use[A-Z][^/]*|[^/]*(Context|Store|Provider))\.tsx?$/.test(path)

const flat = (s: string): string => s.replace(/\s+/g, ' ').trim()

function isExported(stmt: ts.Statement): boolean {
  if (ts.isExportDeclaration(stmt) || ts.isExportAssignment(stmt)) return true
  return (
    ts.canHaveModifiers(stmt) &&
    (ts.getModifiers(stmt) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  )
}

const keyName = (name: ts.PropertyName | ts.JsxAttributeName | undefined): string | undefined =>
  name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? name.text : undefined

/**
 * One line per public fact of a Base UI source file: exported declarations (function bodies and
 * initialisers dropped), then anatomy: JSX tags, `useRenderElement` tags, data-/aria-/role keys and
 * CSS-variable names anywhere in the file.
 */
function surfaceLines(text: string, name: string): string[] {
  const sf = parse(text, name)
  const print = (n: ts.Node): string =>
    flat(printer.printNode(ts.EmitHint.Unspecified, n, sf).replace(/ \| undefined/g, ''))
  const isPlain = (n: ts.Expression): boolean => {
    if (ts.isAsExpression(n) || ts.isParenthesizedExpression(n) || ts.isSatisfiesExpression(n))
      return isPlain(n.expression)
    if (ts.isArrayLiteralExpression(n)) return n.elements.every(isPlain)
    if (ts.isObjectLiteralExpression(n))
      return n.properties.every(
        (p) =>
          ts.isShorthandPropertyAssignment(p) ||
          (ts.isPropertyAssignment(p) && isPlain(p.initializer)),
      )
    return (
      ts.isStringLiteralLike(n) ||
      ts.isNumericLiteral(n) ||
      ts.isIdentifier(n) ||
      ts.isPropertyAccessExpression(n) ||
      [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(
        n.kind,
      )
    )
  }
  // Constants and plain tables keep their value; anything with behaviour keeps only its callee and type arguments.
  const valueOf = (init: ts.Expression): string => {
    if (ts.isAsExpression(init) && !isPlain(init))
      return `${valueOf(init.expression)} as ${print(init.type)}`
    if (ts.isCallExpression(init))
      return ` = ${init.expression.getText(sf)}${init.typeArguments ? `<${init.typeArguments.map(print).join(',')}>` : ''}`
    return isPlain(init) ? ` = ${print(init)}` : ''
  }
  const lines: string[] = []
  if (/(DataAttributes|CssVars)\.tsx?$/.test(name)) {
    // Enum, const or namespace: only the attribute and variable names are the contract.
    const names = (n: ts.Node): void => {
      if (ts.isStringLiteralLike(n) && /^(data-|--)/.test(n.text))
        lines.push(`${n.text.startsWith('--') ? 'cssvar' : 'attr'}:${n.text}`)
      ts.forEachChild(n, names)
    }
    names(sf)
    return lines
  }
  for (const stmt of sf.statements) {
    if (!isExported(stmt) || !isPublicFile(name)) continue
    if (ts.isFunctionDeclaration(stmt)) {
      const sig = ts.factory.updateFunctionDeclaration(
        stmt,
        stmt.modifiers,
        stmt.asteriskToken,
        stmt.name,
        stmt.typeParameters,
        stmt.parameters,
        stmt.type,
        undefined,
      )
      lines.push(`api:${print(sig)}`)
    } else if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        lines.push(
          `api:${d.name.getText(sf)}${d.type ? `: ${print(d.type)}` : ''}${d.initializer ? valueOf(d.initializer) : ''}`,
        )
      }
    } else if (ts.isClassDeclaration(stmt)) {
      lines.push(`api:class ${stmt.name?.text ?? 'default'}`)
    } else {
      lines.push(`api:${print(stmt)}`)
    }
  }
  const walk = (n: ts.Node): void => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n))
      lines.push(`tag:${n.tagName.getText(sf)}`)
    if (ts.isJsxAttribute(n)) {
      const key = keyName(n.name)
      if (key && /^(data-|aria-|role$)/.test(key)) lines.push(`attr:${key}`)
    }
    if (ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) {
      const key = keyName(n.name)
      if (key && /^(data-|aria-|role$)/.test(key)) lines.push(`attr:${key}`)
    }
    if (
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      /^use(Render|RenderElement)$/.test(n.expression.text)
    ) {
      const first = n.arguments[0]
      if (first && ts.isStringLiteralLike(first)) lines.push(`tag:${first.text}`)
    }
    if (ts.isStringLiteralLike(n)) {
      const css = /^--[\w-]+/.exec(n.text)
      if (css) lines.push(`cssvar:${css[0]}`)
    }
    ts.forEachChild(n, walk)
  }
  walk(sf)
  // Anatomy is a set: how many times a tag or attribute appears is implementation.
  return [...new Set(lines)]
}

const CLASS_FNS = new Set(['cn', 'cva', 'clsx', 'twMerge'])

/** A base-nova file with every class string blanked, directives and comments dropped. */
function withoutClassStrings(text: string, name: string): string {
  const sf = parse(text, name)
  const spans: Array<[number, number]> = []
  const walk = (n: ts.Node, inClass: boolean): void => {
    if (inClass && (ts.isStringLiteralLike(n) || ts.isTemplateExpression(n))) {
      spans.push([n.getStart(sf), n.getEnd()])
      return
    }
    if (ts.isPropertyAssignment(n)) {
      walk(n.name, false)
      walk(n.initializer, inClass)
      return
    }
    const enters =
      (ts.isCallExpression(n) &&
        ts.isIdentifier(n.expression) &&
        CLASS_FNS.has(n.expression.text)) ||
      (ts.isJsxAttribute(n) && ['className', 'class'].includes(n.name.getText(sf)))
    ts.forEachChild(n, (c) => walk(c, inClass || enters))
  }
  walk(sf, false)
  let blanked = text
  for (const [from, to] of spans.toReversed())
    blanked = `${blanked.slice(0, from)}""${blanked.slice(to)}`
  const out = parse(blanked, name)
  return out.statements
    .filter((s) => !(ts.isExpressionStatement(s) && ts.isStringLiteral(s.expression)))
    .map((s) => flat(printer.printNode(ts.EmitHint.Unspecified, s, out)))
    .join('\n')
}

const iso = (d: Date): string => d.toISOString().slice(0, 10)

// ---------------------------------------------------------------- stats

const median = (xs: number[]): number => {
  if (xs.length === 0) return 0
  const s = xs.toSorted((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
const round = (x: number): number => Math.round(x * 10000) / 10000

interface Event {
  at: string
  date: string
  kind: 'anatomy' | 'cosmetic'
  subject?: string
}
interface Primitive {
  id: string
  sources: string[]
  changeCount: number
  anatomyChangeCount: number
  cosmeticChangeCount: number
  changePerMonth: number
  allChangesPerMonth: number
  events: Event[]
}

function primitive(id: string, sources: string[], events: Event[], months: number): Primitive {
  const anatomy = events.filter((e) => e.kind === 'anatomy').length
  return {
    id,
    sources,
    changeCount: events.length,
    anatomyChangeCount: anatomy,
    cosmeticChangeCount: events.length - anatomy,
    changePerMonth: round(anatomy / months),
    allChangesPerMonth: round(events.length / months),
    events,
  }
}

function summarise(list: Primitive[]): {
  primitiveCount: number
  medianChangesPerMonth: number
  medianAllChangesPerMonth: number
  maxChangesPerMonth: number
} {
  return {
    primitiveCount: list.length,
    medianChangesPerMonth: round(median(list.map((p) => p.changePerMonth))),
    medianAllChangesPerMonth: round(median(list.map((p) => p.allChangesPerMonth))),
    maxChangesPerMonth: Math.max(0, ...list.map((p) => p.changePerMonth)),
  }
}

// ---------------------------------------------------------------- base ui

const semver = (tag: string): number[] => tag.slice(1).split('.').map(Number)
const bySemver = (a: string, b: string): number => {
  const [x, y] = [semver(a), semver(b)]
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
}

function baseUiSeries(dir: string, start: Date, end: Date, months: number) {
  const refs = gitText(dir, [
    'for-each-ref',
    '--format=%(refname:short)\t%(creatordate:iso-strict)\t%(*objectname)\t%(objectname)',
    'refs/tags/v*',
  ])
  const stable = refs
    .split('\n')
    .map((l) => l.split('\t'))
    .filter(([tag]) => /^v\d+\.\d+\.\d+$/.test(tag))
    .map(([tag, date, peeled, own]) => ({ tag, date: new Date(date), sha: peeled || own }))
    .toSorted((a, b) => bySemver(a.tag, b.tag))
  const releases = stable
    .map((r, i) => ({ ...r, prev: stable[i - 1] }))
    .filter((r) => r.date >= start && r.date < end && r.prev)
  if (releases.length === 0) throw new Error('no stable Base UI release in the window')

  const signature = new Map<string, string>()
  const surface = (ref: string, part: string): string => {
    const key = `${ref}:${part}`
    const hit = signature.get(key)
    if (hit !== undefined) return hit
    const root = `${BASE_UI.src}/${part}/`
    const files = gitText(dir, ['ls-tree', '-r', '--name-only', ref, root])
      .split('\n')
      .filter((f) => f && isSource(f))
    const blobs = readBlobs(
      dir,
      files.map((f) => `${ref}:${f}`),
    )
    const lines = files.flatMap((f) => surfaceLines(blobs.get(`${ref}:${f}`) ?? '', f))
    const sig = [...new Set(lines)].toSorted().join('\n')
    signature.set(key, sig)
    return sig
  }

  const last = releases[releases.length - 1]
  const present = (part: string): boolean =>
    gitText(dir, ['ls-tree', '--name-only', last.tag, `${BASE_UI.src}/${part}/`]) !== ''
  const list: Primitive[] = []
  for (const m of MODULES) {
    const parts = m.parts.filter(present)
    if (parts.length === 0) continue
    const events: Event[] = []
    for (const r of releases) {
      const touched = parts.filter((p) =>
        gitText(dir, ['diff', '--name-only', r.prev.tag, r.tag, '--', `${BASE_UI.src}/${p}/`])
          .split('\n')
          .some((f) => f && isSource(f)),
      )
      if (touched.length === 0) continue
      const anatomy = touched.some((p) => surface(r.prev.tag, p) !== surface(r.tag, p))
      events.push({
        at: r.tag,
        date: r.date.toISOString().slice(0, 10),
        kind: anatomy ? 'anatomy' : 'cosmetic',
      })
    }
    list.push(
      primitive(
        m.id,
        parts.map((p) => `${BASE_UI.src}/${p}`),
        events,
        months,
      ),
    )
  }
  return {
    repo: 'https://github.com/mui/base-ui',
    unit: 'a stable release whose diff against the previous stable release touches the part directory (test, docs and story files excluded)',
    classification:
      'anatomy = exported declarations, rendered tags, data-/aria-/role keys or CSS-variable names of the part differ between the two tags; cosmetic = implementation only',
    range: {
      from: { tag: releases[0].prev.tag, sha: releases[0].prev.sha },
      to: { tag: last.tag, sha: last.sha },
      releases: releases.map((r) => ({
        tag: r.tag,
        sha: r.sha,
        date: r.date.toISOString().slice(0, 10),
      })),
    },
    monthsCovered: months,
    // A primitive can change at most once per release, so this is the series' ceiling for changePerMonth.
    releasesPerMonth: round(releases.length / months),
    ...summarise(list),
    primitives: list,
  }
}

// ---------------------------------------------------------------- base-nova

const BULK_MODULES = 10

/** Sensitivity: the same medians with repo-wide sweeps (one commit moving 10+ primitives) left out. */
function excludingBulk(list: Primitive[], months: number) {
  const touched = new Map<string, { modules: number; subject?: string }>()
  for (const p of list) {
    for (const e of p.events)
      touched.set(e.at, { modules: (touched.get(e.at)?.modules ?? 0) + 1, subject: e.subject })
  }
  const bulk = [...touched].filter(([, t]) => t.modules >= BULK_MODULES)
  const skip = new Set(bulk.map(([at]) => at))
  const trimmed = list.map((p) =>
    primitive(
      p.id,
      p.sources,
      p.events.filter((e) => !skip.has(e.at)),
      months,
    ),
  )
  return {
    bulkCommits: bulk.map(([at, t]) => ({ at, modules: t.modules, subject: t.subject })),
    ...summarise(trimmed),
  }
}

function novaSeries(dir: string, start: Date, end: Date, months: number) {
  const at = (d: Date): string =>
    gitText(dir, ['rev-list', '-1', `--before=${d.toISOString()}`, SHADCN.head])
  const [from, to] = [at(start), at(end)]
  const inWindow = (iso: string): boolean => new Date(iso) >= start && new Date(iso) < end

  const list: Primitive[] = []
  for (const m of MODULES) {
    const files = m.nova
      .map((n) => `${SHADCN.ui}/${n}.tsx`)
      .filter((f) => gitText(dir, ['ls-tree', '--name-only', to, f]) !== '')
    if (files.length === 0) continue
    const commits = new Map<string, { date: string; subject: string; anatomy: boolean }>()
    const created: string[] = []
    for (const file of files) {
      const log = gitText(dir, ['log', '--no-merges', '--format=%H\t%cI\t%s', to, '--', file])
      const rows = log
        .split('\n')
        .filter(Boolean)
        .map((l) => l.split('\t'))
        .filter(([, date]) => inWindow(date))
      const blobs = readBlobs(
        dir,
        rows.flatMap(([sha]) => [`${sha}:${file}`, `${sha}^:${file}`]),
      )
      for (const [sha, date, subject] of rows) {
        const [after, before] = [blobs.get(`${sha}:${file}`), blobs.get(`${sha}^:${file}`)]
        if (before === null || before === undefined) {
          created.push(`${file.split('/').pop()}@${sha.slice(0, 8)}`)
          continue
        }
        const anatomy =
          after === null ||
          after === undefined ||
          withoutClassStrings(before, file) !== withoutClassStrings(after, file)
        const prior = commits.get(sha)
        commits.set(sha, { date, subject, anatomy: Boolean(prior?.anatomy) || anatomy })
      }
    }
    const events: Event[] = [...commits.entries()]
      .toSorted((a, b) => a[1].date.localeCompare(b[1].date))
      .map(([sha, c]) => ({
        at: sha.slice(0, 8),
        date: c.date.slice(0, 10),
        kind: c.anatomy ? 'anatomy' : 'cosmetic',
        subject: c.subject,
      }))
    const prim = primitive(m.id, files, events, months)
    list.push(created.length ? Object.assign(prim, { createdInWindow: created }) : prim)
  }
  const styleLog = gitText(dir, ['log', '--no-merges', '--format=%cI', to, '--', SHADCN.style])
    .split('\n')
    .filter(Boolean)
  return {
    repo: 'https://github.com/shadcn-ui/ui',
    unit: 'a non-merge commit on main that touches the primitive file under apps/v4/registry/bases/base/ui (creation commits are reported, not counted)',
    classification:
      'cosmetic = the file differs from its parent only in class strings (cn/cva/clsx args, className values), comments, formatting or directives; anything else is anatomy',
    range: { branch: SHADCN.head, from: { sha: from }, to: { sha: to } },
    monthsCovered: months,
    styleFile: { path: SHADCN.style, commitsInWindow: styleLog.filter(inWindow).length },
    ...summarise(list),
    excludingBulk: excludingBulk(list, months),
    primitives: list,
  }
}

// ---------------------------------------------------------------- main

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function main(): void {
  const months = Number(arg('months') ?? 10)
  if (!Number.isInteger(months) || months < MIN_MONTHS)
    throw new Error(`--months must be an integer >= ${MIN_MONTHS}`)
  const offline = process.argv.includes('--offline')
  const today = new Date()
  const asOf = arg('as-of') ? new Date(`${arg('as-of')}T00:00:00Z`) : today
  const end = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1))
  const start = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - months, 1))

  const baseUi = baseUiSeries(sync('base-ui', BASE_UI.url, offline), start, end, months)
  const baseNova = novaSeries(sync('shadcn-ui', SHADCN.url, offline), start, end, months)
  const refuted =
    baseUi.medianChangesPerMonth > THRESHOLD || baseNova.medianChangesPerMonth > THRESHOLD
  const verdict = `F8: ${refuted ? 'REFUTED' : 'PASS'}`

  process.stdout.write(
    `${JSON.stringify({
      verdict,
      rule: `REFUTED when the median over primitives of changePerMonth (anatomyChangeCount / monthsCovered) exceeds ${THRESHOLD} in either series`,
      runDate: iso(today),
      asOf: iso(asOf),
      monthsCovered: months,
      window: {
        start: iso(start),
        endExclusive: iso(end),
        lastMonth: iso(new Date(end.getTime() - 86400000)).slice(0, 7),
      },
      series: { baseUi, baseNova },
    })}\n`,
  )
}

main()
