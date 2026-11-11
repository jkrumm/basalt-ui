/**
 * F6 static half: every `cn(...)` call site, and whether its arguments can emit two utilities of
 * one conflict group (the question the compiled `cn` answers and `clsx` does not).
 *
 * A call is modelled as a tree: `tokens` (a class string), `seq` (emitted together), `alt`
 * (mutually exclusive branches) and `dyn` (unknown, e.g. a `className` pass-through). A conflict is
 * a pair of tokens in two children of one `seq` (or inside one string) that the compiled `cn`
 * collapses in either order. The oracle is basalt-ui's own `cn` (packages/basalt-ui/src/core/cn.ts).
 */
import ts from 'typescript'
import { cn } from '../../../packages/basalt-ui/src/core/cn'
import { calleeName } from './classes'
import { parse, siteRef } from './scan'
import type { RepoName, ScannedRepo, SiteRef, SourceFile } from './scan'

type Node =
  | { k: 'tokens'; t: string[] }
  | { k: 'seq'; c: Node[] }
  | { k: 'alt'; c: Node[] }
  | { k: 'dyn'; pass: boolean }

const EMPTY: Node = { k: 'tokens', t: [] }
const MERGERS = new Set(['cn', 'clsx', 'cx', 'twMerge', 'twJoin', 'classNames'])
const BOUGHT_RE = /(?:^|\/)components\/ui\/|^basalt-ui\/ui(?:\/|$)/

const words = (s: string): string[] => s.split(/\s+/).filter(Boolean)

/** cva definitions of a repo by variable name; shared across files (they are imported by name). */
type Cva = {
  base: Node
  groups: Map<string, Map<string, Node>>
  defaults: Map<string, string>
  compound: Node[]
}

function isPassThrough(e: ts.Expression): boolean {
  if (ts.isIdentifier(e)) return e.text === 'className' || e.text.endsWith('ClassName')
  return ts.isPropertyAccessExpression(e) && /className$/i.test(e.name.text)
}

function propName(p: ts.PropertyName): string | null {
  if (ts.isIdentifier(p) || ts.isStringLiteralLike(p) || ts.isNumericLiteral(p)) return p.text
  return null
}

class Builder {
  constructor(
    private readonly cvas: Map<string, Cva>,
    private readonly consts: Map<string, ts.Expression>,
  ) {}

  build(e: ts.Expression | undefined, hop = true): Node {
    if (!e) return EMPTY
    if (ts.isStringLiteralLike(e)) return { k: 'tokens', t: words(e.text) }
    if (ts.isTemplateExpression(e)) {
      const out: Node[] = []
      let dyn = false
      const piece = (text: string, cutBefore: boolean, cutAfter: boolean): void => {
        const ws = words(text)
        if (cutBefore && ws.length > 0 && !/^\s/.test(text)) {
          ws.shift()
          dyn = true
        }
        if (cutAfter && ws.length > 0 && !/\s$/.test(text)) {
          ws.pop()
          dyn = true
        }
        out.push({ k: 'tokens', t: ws })
      }
      piece(e.head.text, false, true)
      for (const span of e.templateSpans) {
        out.push(this.build(span.expression, hop))
        piece(span.literal.text, true, !ts.isTemplateTail(span.literal))
      }
      if (dyn) out.push({ k: 'dyn', pass: false })
      return { k: 'seq', c: out }
    }
    if (ts.isConditionalExpression(e))
      return { k: 'alt', c: [this.build(e.whenTrue, hop), this.build(e.whenFalse, hop)] }
    if (ts.isBinaryExpression(e)) {
      const k = e.operatorToken.kind
      if (k === ts.SyntaxKind.AmpersandAmpersandToken)
        return { k: 'alt', c: [EMPTY, this.build(e.right, hop)] }
      if (k === ts.SyntaxKind.BarBarToken || k === ts.SyntaxKind.QuestionQuestionToken)
        return { k: 'alt', c: [this.build(e.left, hop), this.build(e.right, hop)] }
      if (k === ts.SyntaxKind.PlusToken)
        return { k: 'seq', c: [this.build(e.left, hop), this.build(e.right, hop)] }
      return { k: 'dyn', pass: false }
    }
    if (ts.isArrayLiteralExpression(e))
      return { k: 'seq', c: e.elements.map((x) => this.build(x, hop)) }
    if (ts.isObjectLiteralExpression(e)) {
      const c: Node[] = []
      for (const p of e.properties) {
        if (ts.isSpreadAssignment(p)) c.push(this.build(p.expression, hop))
        else if (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) {
          const name = propName(p.name)
          c.push({ k: 'alt', c: [EMPTY, { k: 'tokens', t: name ? words(name) : [] }] })
        }
      }
      return { k: 'seq', c }
    }
    if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e))
      return this.build(e.expression, hop)
    if (ts.isSatisfiesExpression(e)) return this.build(e.expression, hop)
    if (ts.isCallExpression(e)) {
      const name = calleeName(e)
      if (MERGERS.has(name)) return { k: 'seq', c: e.arguments.map((a) => this.build(a, hop)) }
      const cva = ts.isIdentifier(e.expression) ? this.cvas.get(e.expression.text) : undefined
      if (cva) return this.callCva(cva, e)
      return { k: 'dyn', pass: false }
    }
    if (ts.isIdentifier(e)) {
      if (isPassThrough(e)) return { k: 'dyn', pass: true }
      const init = hop ? this.consts.get(e.text) : undefined
      return init ? this.build(init, false) : { k: 'dyn', pass: false }
    }
    if (isPassThrough(e)) return { k: 'dyn', pass: true }
    return { k: 'dyn', pass: false }
  }

  private callCva(cva: Cva, call: ts.CallExpression): Node {
    const arg = call.arguments[0]
    const picked = new Map<string, string | null>()
    let passClass = false
    if (arg && ts.isObjectLiteralExpression(arg)) {
      for (const p of arg.properties) {
        if (!ts.isPropertyAssignment(p) && !ts.isShorthandPropertyAssignment(p)) continue
        const name = propName(p.name)
        if (!name) continue
        if (name === 'class' || name === 'className') {
          passClass = true
          continue
        }
        const init = ts.isPropertyAssignment(p) ? p.initializer : undefined
        if (init && ts.isStringLiteralLike(init)) picked.set(name, init.text)
        else if (
          init &&
          (init.kind === ts.SyntaxKind.TrueKeyword || init.kind === ts.SyntaxKind.FalseKeyword)
        )
          picked.set(name, init.kind === ts.SyntaxKind.TrueKeyword ? 'true' : 'false')
        else picked.set(name, null)
      }
    }
    const c: Node[] = [cva.base]
    for (const [group, values] of cva.groups) {
      const sel = picked.has(group) ? picked.get(group) : (cva.defaults.get(group) ?? null)
      const chosen = sel ? values.get(sel) : undefined
      c.push(chosen ?? { k: 'alt', c: [...values.values(), EMPTY] })
    }
    c.push(...cva.compound.map((n): Node => ({ k: 'alt', c: [EMPTY, n] })))
    if (passClass) c.push({ k: 'dyn', pass: true })
    return { k: 'seq', c }
  }
}

function collectConsts(sf: ts.SourceFile): Map<string, ts.Expression> {
  const consts = new Map<string, ts.Expression>()
  const visit = (n: ts.Node): void => {
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.initializer &&
      n.parent.flags & ts.NodeFlags.Const
    )
      consts.set(n.name.text, n.initializer)
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return consts
}

/** Pass 1: `const x = cva(base, config)`, by name, over the whole repo. */
function collectCvas(files: { file: SourceFile; sf: ts.SourceFile }[]): Map<string, Cva> {
  const cvas = new Map<string, Cva>()
  const none = new Builder(new Map(), new Map())
  for (const { sf } of files) {
    const visit = (n: ts.Node): void => {
      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        n.initializer &&
        ts.isCallExpression(n.initializer) &&
        calleeName(n.initializer) === 'cva'
      ) {
        const [base, config] = n.initializer.arguments
        const cva: Cva = {
          base: none.build(base),
          groups: new Map(),
          defaults: new Map(),
          compound: [],
        }
        if (config && ts.isObjectLiteralExpression(config)) {
          for (const p of config.properties) {
            if (!ts.isPropertyAssignment(p) || !ts.isObjectLiteralExpression(p.initializer)) {
              continue
            }
            const key = propName(p.name)
            if (key === 'variants') {
              for (const g of p.initializer.properties) {
                if (!ts.isPropertyAssignment(g) || !ts.isObjectLiteralExpression(g.initializer))
                  continue
                const gname = propName(g.name)
                if (!gname) continue
                const values = new Map<string, Node>()
                for (const v of g.initializer.properties) {
                  if (!ts.isPropertyAssignment(v)) continue
                  const vname = propName(v.name)
                  if (vname) values.set(vname, none.build(v.initializer))
                }
                cva.groups.set(gname, values)
              }
            } else if (key === 'defaultVariants') {
              for (const d of p.initializer.properties) {
                if (!ts.isPropertyAssignment(d)) continue
                const dn = propName(d.name)
                if (dn && ts.isStringLiteralLike(d.initializer))
                  cva.defaults.set(dn, d.initializer.text)
              }
            }
          }
          for (const p of config.properties) {
            if (
              ts.isPropertyAssignment(p) &&
              propName(p.name) === 'compoundVariants' &&
              ts.isArrayLiteralExpression(p.initializer)
            ) {
              for (const el of p.initializer.elements) {
                if (!ts.isObjectLiteralExpression(el)) continue
                for (const q of el.properties) {
                  const qn = ts.isPropertyAssignment(q) ? propName(q.name) : null
                  if (ts.isPropertyAssignment(q) && (qn === 'class' || qn === 'className'))
                    cva.compound.push(none.build(q.initializer))
                }
              }
            }
          }
        }
        cvas.set(n.name.text, cva)
      }
      ts.forEachChild(n, visit)
    }
    visit(sf)
  }
  return cvas
}

// ---------------------------------------------------------------------------------------------
// conflicts

const pairCache = new Map<string, boolean>()
let isLive: (token: string) => boolean = () => true

/** Tokens the v3 sheet emits nothing for are skipped: `cn`'s v3 theme would misgroup them. */
export function setLiveness(fn: (token: string) => boolean): void {
  isLive = fn
  pairCache.clear()
}

/**
 * `later` follows `earlier` in the emitted string; the compiled `cn` drops `earlier` while `clsx`
 * keeps both and lets stylesheet order pick the winner.
 */
function conflicts(earlier: string, later: string): boolean {
  if (earlier === later) return false
  const key = `${earlier}\0${later}`
  const hit = pairCache.get(key)
  if (hit !== undefined) return hit
  const res = isLive(earlier) && isLive(later) && cn(earlier, later) !== `${earlier} ${later}`
  pairCache.set(key, res)
  return res
}

function allTokens(n: Node, out: Set<string> = new Set()): Set<string> {
  if (n.k === 'tokens') n.t.forEach((t) => out.add(t))
  else if (n.k !== 'dyn') n.c.forEach((c) => allTokens(c, out))
  return out
}

function hasDyn(n: Node): { dyn: boolean; pass: boolean } {
  if (n.k === 'dyn') return { dyn: !n.pass, pass: n.pass }
  if (n.k === 'tokens') return { dyn: false, pass: false }
  return n.c.reduce(
    (acc, c) => {
      const r = hasDyn(c)
      return { dyn: acc.dyn || r.dyn, pass: acc.pass || r.pass }
    },
    { dyn: false, pass: false },
  )
}

export type Pair = [string, string]

function findPairs(n: Node, out: Pair[]): void {
  if (n.k === 'dyn') return
  if (n.k === 'tokens') {
    const uniq = [...new Set(n.t)]
    for (let i = 0; i < uniq.length; i++)
      for (let j = i + 1; j < uniq.length; j++)
        if (conflicts(uniq[i] as string, uniq[j] as string))
          out.push([uniq[i] as string, uniq[j] as string])
    return
  }
  if (n.k === 'alt') {
    n.c.forEach((c) => findPairs(c, out))
    return
  }
  const sets = n.c.map((c) => [...allTokens(c)])
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      for (const a of sets[i] as string[])
        for (const b of sets[j] as string[]) if (conflicts(a, b)) out.push([a, b])
    }
  }
  n.c.forEach((c) => findPairs(c, out))
}

// ---------------------------------------------------------------------------------------------
// call sites

export interface CallSite {
  repo: RepoName
  file: string
  line: number
  ui: boolean
  /** the call is the whole value of `className` on a bought primitive (no-restyle reaches it) */
  toBought: boolean
  /** an argument that the analysis cannot see into, other than a `className` pass-through */
  open: boolean
  passThrough: boolean
  viaCva: boolean
  pairs: Pair[]
}

function importMap(sf: ts.SourceFile): Map<string, string> {
  const map = new Map<string, string>()
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue
    const spec = st.moduleSpecifier.text
    const clause = st.importClause
    if (!clause) continue
    if (clause.name) map.set(clause.name.text, spec)
    const nb = clause.namedBindings
    if (nb && ts.isNamedImports(nb)) nb.elements.forEach((el) => map.set(el.name.text, spec))
    if (nb && ts.isNamespaceImport(nb)) map.set(nb.name.text, spec)
  }
  return map
}

function tagRoot(tag: ts.JsxTagNameExpression): string {
  if (ts.isIdentifier(tag)) return tag.text
  if (ts.isPropertyAccessExpression(tag)) return tagRoot(tag.expression as ts.JsxTagNameExpression)
  return ''
}

function usesCva(e: ts.Node, cvas: Map<string, Cva>): boolean {
  let found = false
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && cvas.has(n.expression.text))
      found = true
    ts.forEachChild(n, visit)
  }
  visit(e)
  return found
}

export function analyseCalls(repo: ScannedRepo): CallSite[] {
  const parsed = repo.files.map((file) => ({ file, sf: parse(file) }))
  const cvas = collectCvas(parsed)
  const sites: CallSite[] = []
  for (const { file, sf } of parsed) {
    const builder = new Builder(cvas, collectConsts(sf))
    const imports = importMap(sf)
    const visit = (n: ts.Node): void => {
      if (ts.isCallExpression(n) && calleeName(n) === 'cn' && ts.isIdentifier(n.expression)) {
        const tree: Node = { k: 'seq', c: n.arguments.map((a) => builder.build(a)) }
        const pairs: Pair[] = []
        findPairs(tree, pairs)
        const flags = hasDyn(tree)
        // className={cn(...)} directly on a bought primitive
        let toBought = false
        const attr = n.parent
        if (
          ts.isJsxExpression(attr) &&
          ts.isJsxAttribute(attr.parent) &&
          attr.parent.name.getText(sf) === 'className'
        ) {
          const el = attr.parent.parent.parent
          if (ts.isJsxOpeningElement(el) || ts.isJsxSelfClosingElement(el)) {
            const spec = imports.get(tagRoot(el.tagName))
            toBought = spec !== undefined && BOUGHT_RE.test(spec.replace(/^@\//, ''))
          }
        }
        const at = sf.getLineAndCharacterOfPosition(n.getStart(sf))
        sites.push({
          repo: repo.def.name,
          file: file.rel,
          line: at.line + 1,
          ui: file.ui,
          toBought,
          open: flags.dyn,
          passThrough: flags.pass,
          viaCva: usesCva(n, cvas),
          pairs: pairs.toSorted((a, b) => (a.join() < b.join() ? -1 : 1)),
        })
      }
      ts.forEachChild(n, visit)
    }
    visit(sf)
  }
  return sites
}

export interface F6Repo {
  sites: number
  inUiFiles: number
  withConflict: number
  coveredByNoRestyle: number
  beyondNoRestyle: number
  beyondInUiFiles: number
  beyondViaCva: number
  beyondStatic: number
  openCalls: number
  passThroughCalls: number
  refs: SiteRef[]
}

export function summariseRepo(repo: ScannedRepo, sites: CallSite[]): F6Repo {
  const withConflict = sites.filter((s) => s.pairs.length > 0)
  const beyond = withConflict.filter((s) => !s.toBought)
  const refs = beyond.flatMap((s) => {
    const r = siteRef(s.repo, repo.visibility, s.file, s.line)
    return r ? [r] : []
  })
  return {
    sites: sites.length,
    inUiFiles: sites.filter((s) => s.ui).length,
    withConflict: withConflict.length,
    coveredByNoRestyle: withConflict.length - beyond.length,
    beyondNoRestyle: beyond.length,
    beyondInUiFiles: beyond.filter((s) => s.ui).length,
    beyondViaCva: beyond.filter((s) => s.viaCva).length,
    beyondStatic: beyond.filter((s) => !s.viaCva).length,
    openCalls: sites.filter((s) => s.open).length,
    passThroughCalls: sites.filter((s) => s.passThrough).length,
    refs,
  }
}
