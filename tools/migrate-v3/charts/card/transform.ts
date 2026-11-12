import { Project, ScriptKind, SyntaxKind, ts } from 'ts-morph'
import type {
  JsxAttribute,
  JsxChild,
  JsxElement,
  JsxSelfClosingElement,
  ImportSpecifier,
  Node,
  SourceFile,
} from 'ts-morph'
import { emptyReport } from '../report.ts'
import type { Flag, Report } from '../report.ts'

export type CardOptions = { file: string }
export type CardResult = Report & { text: string }

type Edit = { start: number; end: number; text: string }
type Site = JsxElement | JsxSelfClosingElement
type AttributeLike = ReturnType<
  JsxElement['getOpeningElement']
>['getAttributes'] extends () => (infer A)[]
  ? A
  : never

const project = new Project({
  useInMemoryFileSystem: true,
  skipAddingFilesFromTsConfig: true,
  compilerOptions: { jsx: ts.JsxEmit.Preserve },
})

const CARD_MODULES = new Set(['basalt-ui', 'basalt-ui/charts'])
/** Elements that are a chart: a body led by one of these goes to the `chart` slot. */
const CHART_TAGS = new Set([
  'Bars',
  'Lines',
  'Heatmap',
  'CartesianChart',
  'StackedArea',
  'DualPanel',
  'MirroredBars',
  'Scatter',
  'Sparkline',
  'BandStrip',
  'Donut',
])
/** Props v3 removed: deleted from a rewritten card and always flagged. */
const REMOVED_PROPS = [
  'placeholderHeight',
  'matchHeight',
  'deltaPeriod',
  'stateAction',
  'ghost',
  'stateNoun',
  'retrying',
  'onRetry',
] as const
/** Regular-breakpoint height at or below which a card takes `short`. */
const SHORT_MAX = 240

function cardLocals(sf: SourceFile): { card: Set<string>; dim: Set<string> } {
  const card = new Set<string>()
  const dim = new Set<string>()
  for (const decl of sf.getImportDeclarations()) {
    const fromBasalt = CARD_MODULES.has(decl.getModuleSpecifierValue())
    for (const n of decl.getNamedImports()) {
      const local = n.getAliasNode()?.getText() ?? n.getName()
      if (fromBasalt && n.getName() === 'ChartCard') card.add(local)
      // RefetchDim is an app component (argo keeps its own), so it is matched by name from any module.
      if (n.getName() === 'RefetchDim') dim.add(local)
    }
  }
  return { card, dim }
}

function unwrap(node: Node): Node {
  let n = node
  while (n.isKind(SyntaxKind.ParenthesizedExpression)) n = n.getExpression()
  return n
}

function attrExpression(attr: JsxAttribute): Node | undefined {
  const init = attr.getInitializer()
  if (!init) return undefined
  if (init.isKind(SyntaxKind.JsxExpression)) {
    const e = init.getExpression()
    return e ? unwrap(e) : undefined
  }
  return init
}

function isUndefined(n: Node): boolean {
  return n.isKind(SyntaxKind.Identifier) && n.getText() === 'undefined'
}

function isStringy(n: Node): boolean {
  return (
    n.isKind(SyntaxKind.StringLiteral) ||
    n.isKind(SyntaxKind.NoSubstitutionTemplateLiteral) ||
    n.isKind(SyntaxKind.TemplateExpression)
  )
}

function isAccess(n: Node): boolean {
  return n.isKind(SyntaxKind.Identifier) || n.isKind(SyntaxKind.PropertyAccessExpression)
}

/** `empty={...}` for an old empty reason, or null when the value cannot be read mechanically. `''` means no empty at all. */
function emptyFrom(raw: Node): string | null {
  const n = unwrap(raw)
  if (
    isUndefined(n) ||
    n.getKind() === SyntaxKind.FalseKeyword ||
    n.getKind() === SyntaxKind.NullKeyword
  )
    return ''
  if (isStringy(n)) return `empty={{ cause: ${n.getText()} }}`
  if (n.isKind(SyntaxKind.BinaryExpression)) {
    const op = n.getOperatorToken().getKind()
    if (op === SyntaxKind.AmpersandAmpersandToken)
      return `empty={${n.getLeft().getText()} ? { cause: ${n.getRight().getText()} } : null}`
    if (
      op === SyntaxKind.QuestionQuestionToken &&
      n.getRight().getKind() === SyntaxKind.FalseKeyword
    )
      return emptyFrom(n.getLeft())
    return null
  }
  if (n.isKind(SyntaxKind.ConditionalExpression)) {
    const cond = n.getCondition().getText()
    const whenTrue = unwrap(n.getWhenTrue())
    const whenFalse = unwrap(n.getWhenFalse())
    if (isUndefined(whenFalse)) return `empty={${cond} ? { cause: ${whenTrue.getText()} } : null}`
    if (isUndefined(whenTrue)) return `empty={${cond} ? null : { cause: ${whenFalse.getText()} }}`
    return null
  }
  if (isAccess(n)) return `empty={${n.getText()} ? { cause: ${n.getText()} } : null}`
  return null
}

type Replacement = { texts: string[] } | { flag: string }

function fromStateCall(call: Node): Replacement {
  if (!call.isKind(SyntaxKind.CallExpression))
    return { flag: 'state is a call that is not chartStateOf' }
  const [query, label] = call.getArguments()
  if (!query) return { flag: 'chartStateOf without a query' }
  const texts = [`phase={${query.getText()}}`]
  if (!label) return { texts }
  const empty = emptyFrom(label)
  if (empty === null) return { flag: 'the chartStateOf label is an expression to read' }
  if (empty) texts.push(empty)
  return { texts }
}

function fromStateObject(obj: Node): Replacement {
  if (!obj.isKind(SyntaxKind.ObjectLiteralExpression))
    return { flag: 'state is an expression to read' }
  const props = new Map<string, Node>()
  for (const p of obj.getProperties()) {
    if (p.isKind(SyntaxKind.PropertyAssignment)) {
      const init = p.getInitializer()
      if (init) props.set(p.getName(), init)
    } else if (p.isKind(SyntaxKind.ShorthandPropertyAssignment)) {
      props.set(p.getName(), p.getNameNode())
    } else {
      return { flag: 'state has a spread or a method' }
    }
  }
  const texts: string[] = []
  const pending = props.get('pending')
  const error = props.get('error')
  if (pending || error) {
    const source =
      pending && unwrap(pending).isKind(SyntaxKind.PropertyAccessExpression)
        ? unwrap(pending).getChildAtIndex(0).getText()
        : null
    const ownsError =
      source !== null &&
      error !== undefined &&
      new RegExp(
        `^${escape(source)}\\.isError\\s*\\?\\s*${escape(source)}\\.error\\s*:\\s*undefined$|^${escape(source)}\\.error\\s*\\?\\?\\s*undefined$`,
      ).test(unwrap(error).getText())
    if (!ownsError || !pending || unwrap(pending).getText() !== `${source}.isPending`)
      return { flag: 'state pending/error is not a plain query' }
    texts.push(`phase={${source}}`)
  }
  for (const key of props.keys())
    if (key !== 'pending' && key !== 'error' && key !== 'empty')
      return { flag: `state has the key ${key}` }
  const empty = props.get('empty')
  if (empty) {
    const e = emptyFrom(empty)
    if (e === null) return { flag: 'the state empty reason is an expression to read' }
    if (e) texts.push(e)
  }
  return { texts }
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stateReplacement(attr: JsxAttribute): Replacement {
  const e = attrExpression(attr)
  if (!e) return { flag: 'state has no expression' }
  if (e.isKind(SyntaxKind.CallExpression) && e.getExpression().getText() === 'chartStateOf')
    return fromStateCall(e)
  return fromStateObject(e)
}

const FACT_KEYS = new Set(['value', 'unit', 'period'])

/** A fact literal that maps as is: keys value, unit and a string period. */
function factLiteralOk(n: Node): string | null {
  if (!n.isKind(SyntaxKind.ObjectLiteralExpression)) return null
  for (const p of n.getProperties()) {
    if (
      !p.isKind(SyntaxKind.PropertyAssignment) &&
      !p.isKind(SyntaxKind.ShorthandPropertyAssignment)
    )
      return 'facts has a spread or a method'
    const name = p.getName()
    if (name === 'comparison') return 'a comparison needs a delta polarity, which is a decision'
    if (!FACT_KEYS.has(name)) return `facts has the key ${name}`
    if (name === 'period' && p.isKind(SyntaxKind.PropertyAssignment)) {
      const init = p.getInitializer()
      if (init && unwrap(init).isKind(SyntaxKind.ArrayLiteralExpression))
        return 'a period list has no place in figure.period'
    }
  }
  return null
}

function factsReplacement(attr: JsxAttribute): Replacement {
  const e = attrExpression(attr)
  if (!e) return { flag: 'facts has no expression' }
  if (e.isKind(SyntaxKind.ArrayLiteralExpression)) {
    const items = e.getElements()
    if (items.length !== 1) return { flag: 'several facts: the rest go to footer by hand' }
    if (items[0]!.isKind(SyntaxKind.SpreadElement)) return { flag: 'facts holds a spread' }
    const only = unwrap(items[0]!)
    const bad = factLiteralOk(only)
    if (bad) return { flag: bad }
    return { texts: [`figure={${only.getText()}}`] }
  }
  const bad = factLiteralOk(e)
  if (bad) return { flag: bad }
  if (/\bcomparison\b/.test(e.getText()))
    return { flag: 'a comparison needs a delta polarity, which is a decision' }
  return { texts: [`figure={${e.getText()}}`] }
}

function heightReplacement(attr: JsxAttribute): Replacement | null {
  const init = attr.getInitializer()
  if (init?.isKind(SyntaxKind.StringLiteral)) return null
  const e = attrExpression(attr)
  if (!e) return { flag: 'height has no expression' }
  let regular: number | null = null
  if (e.isKind(SyntaxKind.NumericLiteral)) regular = Number(e.getText())
  if (e.isKind(SyntaxKind.StringLiteral)) return null
  if (e.isKind(SyntaxKind.ObjectLiteralExpression)) {
    const prop = e.getProperty('regular')
    const value = prop?.isKind(SyntaxKind.PropertyAssignment) ? prop.getInitializer() : undefined
    if (value?.isKind(SyntaxKind.NumericLiteral)) regular = Number(value.getText())
  }
  if (regular === null) return { flag: 'height is not a literal number or a { regular } object' }
  return { texts: [`height="${regular <= SHORT_MAX ? 'short' : 'auto'}"`] }
}

function isBlank(c: JsxChild): boolean {
  if (c.isKind(SyntaxKind.JsxText)) return c.getText().trim() === ''
  return c.isKind(SyntaxKind.JsxExpression) && !c.getExpression()
}

function tagOf(c: JsxChild): string | null {
  if (c.isKind(SyntaxKind.JsxElement)) return c.getOpeningElement().getTagNameNode().getText()
  if (c.isKind(SyntaxKind.JsxSelfClosingElement)) return c.getTagNameNode().getText()
  return null
}

type Body =
  | { kind: 'chart'; children: JsxChild[]; chartEl: JsxChild; unwrapped: boolean }
  | { kind: 'datapanel' | 'expression' | 'empty'; reason: string }

function classifyBody(el: JsxElement, dims: Set<string>): Body {
  let children = el.getJsxChildren().filter((c) => !isBlank(c))
  let unwrapped = false
  const only = children.length === 1 ? children[0]! : undefined
  if (only?.isKind(SyntaxKind.JsxElement)) {
    const tag = tagOf(only)
    if (tag && dims.has(tag)) {
      children = only.getJsxChildren().filter((c) => !isBlank(c))
      unwrapped = true
    }
  }
  if (children.length === 0) return { kind: 'empty', reason: 'body: the card has no body' }
  if (children.some((c) => c.isKind(SyntaxKind.JsxExpression) || c.isKind(SyntaxKind.JsxText)))
    return { kind: 'expression', reason: 'body: the body is an expression or text to read' }
  const chartEl = children.find((c) => {
    const tag = tagOf(c)
    return tag !== null && CHART_TAGS.has(tag)
  })
  if (!chartEl)
    return { kind: 'datapanel', reason: 'body: not a chart, move it to DataPanel with a skeleton' }
  return { kind: 'chart', children, chartEl, unwrapped }
}

/** The chart element's own height becomes the box height; the rest of the body is verbatim. */
function bodyText(source: string, body: Extract<Body, { kind: 'chart' }>, slot: string): string {
  const first = body.children[0]!
  const last = body.children[body.children.length - 1]!
  const start = first.getStart()
  const end = last.getEnd()
  const chart = body.chartEl
  const opening = chart.isKind(SyntaxKind.JsxElement)
    ? chart.getOpeningElement()
    : (chart as JsxSelfClosingElement)
  const height = opening
    .getAttributes()
    .find(
      (a): a is JsxAttribute =>
        a.isKind(SyntaxKind.JsxAttribute) && a.getNameNode().getText() === 'height',
    )
  const edit: Edit = height
    ? { start: height.getStart(), end: height.getEnd(), text: `height={${slot}.height}` }
    : (() => {
        const args = (opening.compilerNode as ts.JsxOpeningLikeElement).typeArguments
        const at = args?.length
          ? source.indexOf('>', args[args.length - 1]!.end) + 1
          : opening.getTagNameNode().getEnd()
        return { start: at, end: at, text: ` height={${slot}.height}` }
      })()
  const inner = source.slice(start, edit.start) + edit.text + source.slice(edit.end, end)
  return body.children.length > 1 ? `<>${inner}</>` : inner
}

function lineIndent(source: string, pos: number): string {
  const lineStart = source.lastIndexOf('\n', pos - 1) + 1
  return /^[ \t]*/.exec(source.slice(lineStart))![0]
}

function siteAttributes(site: Site): AttributeLike[] {
  return (site.isKind(SyntaxKind.JsxElement) ? site.getOpeningElement() : site).getAttributes()
}

function nameOf(a: AttributeLike): string | null {
  return a.isKind(SyntaxKind.JsxAttribute) ? a.getNameNode().getText() : null
}

export function transformCards(source: string, opts: CardOptions): CardResult {
  const out: CardResult = { ...emptyReport(), text: source }
  if (!source.includes('ChartCard')) return out
  const sf = project.createSourceFile('card.tsx', source, {
    overwrite: true,
    scriptKind: ScriptKind.TSX,
  })
  const { card, dim } = cardLocals(sf)
  if (card.size === 0) return out

  const flag = (row: string, node: Node, reason: string) =>
    out.flagged.push({
      row,
      file: opts.file,
      line: node.getStartLineNumber(),
      reason,
    } satisfies Flag)
  const count = (row: string) => (out.rewritten[row] = (out.rewritten[row] ?? 0) + 1)

  const sites: Site[] = []
  sf.forEachDescendant((n) => {
    if (
      n.isKind(SyntaxKind.JsxElement) &&
      card.has(n.getOpeningElement().getTagNameNode().getText())
    )
      sites.push(n)
    if (n.isKind(SyntaxKind.JsxSelfClosingElement) && card.has(n.getTagNameNode().getText()))
      sites.push(n)
  })

  const edits: Edit[] = []
  let unwrappedDim = false
  let taken = -1
  for (const site of sites) {
    if (site.getStart() < taken) continue // a card inside a card body already rewritten
    const attrs = siteAttributes(site)
    const named = new Map<string, AttributeLike>()
    for (const a of attrs) {
      const n = nameOf(a)
      if (n) named.set(n, a)
    }
    const selfClosed = site.isKind(SyntaxKind.JsxSelfClosingElement)
    if (selfClosed && (named.has('chart') || named.has('phase'))) continue // already v3

    // Flags that hold wherever the card sits.
    for (const a of attrs) {
      if (a.isKind(SyntaxKind.JsxSpreadAttribute)) {
        if (/\b(facts|actions|state)\s*:/.test(a.getText()))
          flag('cc-expression', a, 'prop spread: the spread carries a prop v3 renamed or removed')
        continue
      }
    }
    if (named.has('actions'))
      flag(
        'cc-actions',
        named.get('actions')!,
        'actions: controls, figure, status or a series note by hand',
      )
    if (named.has('tone'))
      flag(
        'cc-tone-status',
        named.get('tone')!,
        'tone with a verdict word: status={{ tone, label }} by hand',
      )

    // The body decides whether the card is rewritten at all.
    let body: Body | null = null
    if (selfClosed) {
      const state = named.get('state')
      const e = state && state.isKind(SyntaxKind.JsxAttribute) ? attrExpression(state) : undefined
      const pendingOnly =
        e?.isKind(SyntaxKind.ObjectLiteralExpression) &&
        e.getProperties().length === 1 &&
        e.getProperties()[0]!.getText().replace(/\s+/g, '') === 'pending:true'
      if (!pendingOnly) {
        flag('cc-other-self-closed', site, 'a self-closed card that is not the pending fallback')
        flagRemoved(named, flag, true)
        continue
      }
    } else {
      body = classifyBody(site as JsxElement, dim)
      if (body.kind !== 'chart') {
        const row =
          body.kind === 'datapanel'
            ? 'cc-body-datapanel'
            : body.kind === 'expression'
              ? 'cc-expression'
              : 'cc-other-self-closed'
        flag(row, site, body.reason)
        flagRemoved(named, flag, true)
        continue
      }
    }

    // The card is rewritten from here on.
    const opening = selfClosed ? site : (site as JsxElement).getOpeningElement()
    const texts: string[] = []
    const counts: string[] = []
    for (const a of attrs) {
      const name = nameOf(a)
      if (!name || !a.isKind(SyntaxKind.JsxAttribute)) {
        texts.push(a.getText())
        continue
      }
      if ((REMOVED_PROPS as readonly string[]).includes(name)) {
        flag('cc-removed-props', a, `${name} is removed in v3 and was deleted`)
        continue
      }
      if (name === 'state' && selfClosed) {
        texts.push('phase="loading"')
        counts.push('cc-pending-loading')
        continue
      }
      const rep: Replacement | null =
        name === 'state'
          ? stateReplacement(a)
          : name === 'facts'
            ? factsReplacement(a)
            : name === 'height'
              ? heightReplacement(a)
              : null
      if (!rep) {
        texts.push(a.getText())
        continue
      }
      if ('flag' in rep) {
        flag('cc-expression', a, `prop ${name}: ${rep.flag}`)
        texts.push(a.getText())
        continue
      }
      texts.push(...rep.texts)
      counts.push(
        name === 'state' ? 'cc-state-phase' : name === 'facts' ? 'cc-facts-figure' : 'cc-height',
      )
    }

    const baseIndent = lineIndent(source, site.getStart())
    if (body?.kind === 'chart') {
      const slot = /\bbox\b/.test(
        source.slice(
          body.children[0]!.getStart(),
          body.children[body.children.length - 1]!.getEnd(),
        ),
      )
        ? 'slot'
        : 'box'
      const text = bodyText(source, body, slot)
      const multiline = text.includes('\n')
      texts.push(
        multiline
          ? `chart={(${slot}) => (\n${baseIndent}  ${text}\n${baseIndent})}`
          : `chart={(${slot}) => ${text}}`,
      )
      counts.push('cc-body-chart')
      if (body.unwrapped) unwrappedDim = true
    }

    const head = source.slice(opening.getStart(), opening.getTagNameNode().getEnd())
    const multiline = opening.getText().includes('\n') || texts.some((t) => t.includes('\n'))
    const attrText = multiline
      ? texts.map((t) => `\n${baseIndent}  ${t}`).join('') + `\n${baseIndent}/>`
      : `${texts.map((t) => ` ${t}`).join('')} />`
    edits.push({ start: site.getStart(), end: site.getEnd(), text: head + attrText })
    taken = site.getEnd()
    for (const c of counts) count(c)
  }

  let text = source
  for (const e of edits.toSorted((a, b) => b.start - a.start))
    text = text.slice(0, e.start) + e.text + text.slice(e.end)
  if (unwrappedDim) text = dropUnusedImports(text, dim)
  out.text = text
  return out
}

/** A site that is left untouched still lists its removed props. */
function flagRemoved(
  named: Map<string, AttributeLike>,
  flag: (row: string, node: Node, reason: string) => void,
  untouched: boolean,
): void {
  if (!untouched) return
  for (const name of REMOVED_PROPS) {
    const a = named.get(name)
    if (a)
      flag(
        'cc-removed-props',
        a,
        `${name} is removed in v3; the card is left untouched, delete it with the rewrite`,
      )
  }
}

/** Drops the imports of `names` that nothing in the file uses any more; a declaration left empty goes whole. */
function dropUnusedImports(text: string, names: Set<string>): string {
  const sf = project.createSourceFile('imports.tsx', text, {
    overwrite: true,
    scriptKind: ScriptKind.TSX,
  })
  const used = new Set<string>()
  sf.forEachDescendant((n) => {
    if (n.isKind(SyntaxKind.Identifier) && !n.getFirstAncestorByKind(SyntaxKind.ImportDeclaration))
      used.add(n.getText())
  })
  const unused = (n: ImportSpecifier) => {
    const local = n.getAliasNode()?.getText() ?? n.getName()
    return n.getName() === 'RefetchDim' && names.has(local) && !used.has(local)
  }
  const whole: Edit[] = []
  const partial: string[] = []
  for (const decl of sf.getImportDeclarations()) {
    const specs = decl.getNamedImports()
    const drop = specs.filter(unused)
    if (drop.length === 0) continue
    if (drop.length === specs.length && !decl.getDefaultImport() && !decl.getNamespaceImport()) {
      const end = text.indexOf('\n', decl.getEnd())
      whole.push({ start: decl.getStart(), end: end === -1 ? decl.getEnd() : end + 1, text: '' })
    } else {
      partial.push(...drop.map((n) => n.getName()))
    }
  }
  let out = text
  for (const e of whole.toSorted((a, b) => b.start - a.start))
    out = out.slice(0, e.start) + out.slice(e.end)
  if (partial.length === 0) return out
  const again = project.createSourceFile('imports.tsx', out, {
    overwrite: true,
    scriptKind: ScriptKind.TSX,
  })
  for (const decl of again.getImportDeclarations())
    for (const n of decl.getNamedImports()) if (unused(n)) n.remove()
  return again.getFullText()
}
