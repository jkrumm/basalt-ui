/** All S2 matchers: 54 standalone lint forms, each with its false-positive predicate. */
import ts from 'typescript'
import { arbPx, judge, parseClass } from './classes'
import type { ClassToken, ParsedClass } from './classes'

export interface ImportRef {
  spec: string
  typeOnly: boolean
  /** imported names ('default' / '*' for default / namespace) */
  names: string[]
  locals: string[]
}

export interface FileCtx {
  sf: ts.SourceFile
  tokens: ClassToken[]
  nodes: ts.Node[]
  imports: ImportRef[]
  comments: { text: string; pos: number }[]
  memberNames: Set<string>
}

export interface Hit {
  line: number
  col: number
  strict: boolean
  fp: boolean
}

export type Oracle = 'class-context' | 'predicate' | 'syntactic'

export interface Form {
  id: string
  oracle: Oracle
  detect(ctx: FileCtx): Hit[]
  isFalsePositive(hit: Hit): boolean
}

// ---------------------------------------------------------------------------------------------
// context

const strLit = (n: ts.Node | undefined): string | null =>
  n && ts.isStringLiteralLike(n) ? n.text : null

function importOf(n: ts.Node): ImportRef | null {
  if (ts.isImportDeclaration(n)) {
    const spec = strLit(n.moduleSpecifier)
    if (spec === null) return null
    const c = n.importClause
    const names: string[] = []
    const locals: string[] = []
    if (c?.name) {
      names.push('default')
      locals.push(c.name.text)
    }
    const nb = c?.namedBindings
    if (nb && ts.isNamespaceImport(nb)) {
      names.push('*')
      locals.push(nb.name.text)
    }
    if (nb && ts.isNamedImports(nb)) {
      for (const el of nb.elements) {
        names.push((el.propertyName ?? el.name).text)
        locals.push(el.name.text)
      }
    }
    const allTyped =
      !!c &&
      (c.isTypeOnly ||
        (!c.name &&
          !!nb &&
          ts.isNamedImports(nb) &&
          nb.elements.length > 0 &&
          nb.elements.every((e) => e.isTypeOnly)))
    return { spec, typeOnly: allTyped, names, locals }
  }
  if (!ts.isCallExpression(n) || n.arguments.length === 0) return null
  const isDynamic = n.expression.kind === ts.SyntaxKind.ImportKeyword
  const isRequire = ts.isIdentifier(n.expression) && n.expression.text === 'require'
  const spec = strLit(n.arguments[0])
  if (spec === null || !(isDynamic || isRequire)) return null
  return { spec, typeOnly: false, names: [], locals: [] }
}

function memberName(n: ts.Node): string | null {
  const named =
    ts.isPropertyAssignment(n) ||
    ts.isMethodDeclaration(n) ||
    ts.isPropertyDeclaration(n) ||
    ts.isPropertySignature(n) ||
    ts.isMethodSignature(n) ||
    ts.isShorthandPropertyAssignment(n)
  if (!named) return null
  return ts.isIdentifier(n.name) || ts.isStringLiteral(n.name) ? n.name.text : null
}

export function buildCtx(sf: ts.SourceFile, tokens: ClassToken[]): FileCtx {
  const nodes: ts.Node[] = []
  const walk = (n: ts.Node): void => {
    nodes.push(n)
    ts.forEachChild(n, walk)
  }
  walk(sf)
  const imports: ImportRef[] = []
  const memberNames = new Set<string>()
  const commentMap = new Map<number, { text: string; pos: number }>()
  const take = (ranges: ts.CommentRange[] | undefined): void => {
    for (const r of ranges ?? []) {
      commentMap.set(r.pos, { text: sf.text.slice(r.pos, r.end), pos: r.pos })
    }
  }
  for (const n of nodes) {
    const imp = importOf(n)
    if (imp) imports.push(imp)
    const m = memberName(n)
    if (m) memberNames.add(m)
    take(ts.getLeadingCommentRanges(sf.text, n.pos))
    take(ts.getTrailingCommentRanges(sf.text, n.end))
  }
  const comments = [...commentMap.values()].toSorted((a, b) => a.pos - b.pos)
  return { sf, tokens, nodes, imports, comments, memberNames }
}

// ---------------------------------------------------------------------------------------------
// helpers

const at = (ctx: FileCtx, n: ts.Node, fp = false): Hit => {
  const p = ctx.sf.getLineAndCharacterOfPosition(n.getStart(ctx.sf))
  return { line: p.line + 1, col: p.character + 1, strict: true, fp }
}

const opening = (n: ts.Node): ts.JsxOpeningLikeElement | null =>
  ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n) ? n : null

const tagOf = (el: ts.JsxOpeningLikeElement): string => el.tagName.getText()

function attrOf(el: ts.JsxOpeningLikeElement, name: string): ts.JsxAttribute | undefined {
  for (const a of el.attributes.properties) {
    if (ts.isJsxAttribute(a) && ts.isIdentifier(a.name) && a.name.text === name) return a
  }
  return undefined
}

function attrLiteral(el: ts.JsxOpeningLikeElement, name: string): string | null {
  const init = attrOf(el, name)?.initializer
  if (!init) return null
  return strLit(init) ?? (ts.isJsxExpression(init) ? strLit(init.expression) : null)
}

const some = (n: ts.Node, pred: (x: ts.Node) => boolean): boolean =>
  pred(n) || !!ts.forEachChild(n, (c) => (some(c, pred) ? true : undefined))

const calleeName = (call: ts.CallExpression): string => {
  const c = call.expression
  if (ts.isIdentifier(c)) return c.text
  return ts.isPropertyAccessExpression(c) ? c.name.text : ''
}

const isFn = (n: ts.Node | undefined): n is ts.ArrowFunction | ts.FunctionExpression =>
  !!n && (ts.isArrowFunction(n) || ts.isFunctionExpression(n))

// ---------------------------------------------------------------------------------------------
// form builders

function classForm(
  id: string,
  test: (p: ParsedClass, t: ClassToken) => boolean,
  extraFp: (p: ParsedClass, t: ClassToken) => boolean = () => false,
): Form {
  return {
    id,
    oracle: 'class-context',
    detect(ctx) {
      const hits: Hit[] = []
      for (const t of ctx.tokens) {
        const p = parseClass(t.text)
        if (!test(p, t)) continue
        hits.push({ line: t.line, col: t.col, strict: t.strict, fp: extraFp(p, t) })
      }
      return hits
    },
    isFalsePositive: (h) => !h.strict || h.fp,
  }
}

function astForm(
  id: string,
  oracle: 'predicate' | 'syntactic',
  detect: (ctx: FileCtx) => Hit[],
): Form {
  return { id, oracle, detect, isFalsePositive: (h) => h.fp }
}

/** One hit per node for which `test` returns false (no hit) or a fp flag. */
function nodeForm(
  id: string,
  oracle: 'predicate' | 'syntactic',
  test: (n: ts.Node, ctx: FileCtx) => boolean | { fp: boolean },
): Form {
  return astForm(id, oracle, (ctx) => {
    const hits: Hit[] = []
    for (const n of ctx.nodes) {
      const r = test(n, ctx)
      if (r === false) continue
      hits.push(at(ctx, n, r === true ? false : r.fp))
    }
    return hits
  })
}

function importForm(
  id: string,
  oracle: 'predicate' | 'syntactic',
  test: (i: ImportRef) => boolean,
  fp: (i: ImportRef) => boolean = () => false,
): Form {
  return astForm(id, oracle, (ctx) => {
    const hits: Hit[] = []
    for (const n of ctx.nodes) {
      const i = importOf(n)
      if (i && test(i)) hits.push(at(ctx, n, fp(i)))
    }
    return hits
  })
}

const SIZE_KW = /^(?:xs|sm|base|md|lg|xl|[2-9]xl|micro|display)$/
const COLOUR_FAMILY =
  '(?:text|bg|border|ring|outline|divide|from|via|to|fill|stroke|decoration|shadow|accent|caret)'
const BLACK_WHITE_RE = new RegExp(`^${COLOUR_FAMILY}-(?:black|white)$`)
const SURFACE = new Set(['bg-card', 'bg-inset', 'shadow-card', 'rounded-card'])
const COLOUR_RE = new RegExp(
  `^${COLOUR_FAMILY}-(?:(?:brand-fill|on-brand|brand|good|warn|bad|info|destructive|ring|line|chart-\\d+|seq-\\d+)(?:-tint)?|\\(--vx-.*)$`,
)

const importIs = (i: ImportRef, re: RegExp): boolean => re.test(i.spec)
const importNames = (i: ImportRef, names: string[]): boolean =>
  i.names.some((n) => names.includes(n))
const importBoundary = (id: string, re: RegExp): Form =>
  importForm(
    `import-boundary/${id}`,
    'predicate',
    (i) => importIs(i, re),
    (i) => i.typeOnly,
  )

const MARKS = new Set(['rect', 'circle', 'path', 'line', 'g', 'polyline', 'polygon', 'text'])
const HEX_RE = /\B#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/i
const FN_COLOUR_RE = /(?:rgb|rgba|hsl|hsla|oklch|oklab|color-mix)\(/
const SAFE_ATTRS = /^(?:href|to|id|htmlFor|name|key|value|aria-.*)$/
const SAFE_CALLS = new Set([
  'querySelector',
  'querySelectorAll',
  'getElementById',
  'scrollIntoView',
])

function colourLiteralFp(n: ts.Node, text: string): boolean {
  if (text.includes('://')) return true
  const holder = ts.isJsxExpression(n.parent) ? n.parent : n
  const attr = holder.parent
  if (ts.isJsxAttribute(attr) && ts.isIdentifier(attr.name) && SAFE_ATTRS.test(attr.name.text)) {
    return true
  }
  const call = n.parent
  return ts.isCallExpression(call) && call.arguments[0] === n && SAFE_CALLS.has(calleeName(call))
}

const isString = (n: ts.Node): boolean =>
  ts.isStringLiteral(n) ||
  ts.isNoSubstitutionTemplateLiteral(n) ||
  ts.isTemplateHead(n) ||
  ts.isTemplateMiddle(n) ||
  ts.isTemplateTail(n)

function insideFn(n: ts.Node, name: string): boolean {
  for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
    const named = (ts.isFunctionDeclaration(p) || ts.isVariableDeclaration(p)) && p.name
    if (named && ts.isIdentifier(named) && named.text === name) return true
  }
  return false
}

function validateSearchReads(fn: ts.Node): boolean {
  const globals = new Set(['window', 'document', 'localStorage', 'sessionStorage', 'Date'])
  return some(fn, (x) => {
    if (ts.isIdentifier(x) && globals.has(x.text)) {
      return !(ts.isPropertyAccessExpression(x.parent) && x.parent.name === x)
    }
    return ts.isPropertyAccessExpression(x) && x.getText() === 'Math.random'
  })
}

const isSearch = (e: ts.Node | undefined): boolean =>
  !!e && ts.isIdentifier(e) && e.text === 'search'

function returnsSearch(fn: ts.ArrowFunction | ts.FunctionExpression): boolean {
  const destructured = fn.parameters.some(
    (p) =>
      ts.isObjectBindingPattern(p.name) &&
      p.name.elements.some((e) => ts.isIdentifier(e.name) && e.name.text === 'search'),
  )
  if (!destructured) return false
  if (!ts.isBlock(fn.body)) return isSearch(fn.body)
  return some(fn.body, (x) => ts.isReturnStatement(x) && isSearch(x.expression))
}

// ---------------------------------------------------------------------------------------------
// the forms

export const FORMS: readonly Form[] = [
  classForm('viewport-keyed/prefix', (p) =>
    p.variants.some((v) => /^(?:max-|min-)?(?:sm|md|lg|xl|2xl)$/.test(v)),
  ),
  classForm('viewport-keyed/arbitrary', (p) => p.variants.some((v) => /^(?:min|max)-\[/.test(v))),
  nodeForm('viewport-keyed/js', 'predicate', (n) => {
    if (!ts.isCallExpression(n) || !['matchMedia', 'useMediaQuery'].includes(calleeName(n)))
      return false
    const q = strLit(n.arguments[0])
    return { fp: q === null || !q.includes('width') }
  }),
  classForm('dark-fork/dark', (p) => p.variants.includes('dark')),
  classForm('fixed-colour/black-white', (p) => BLACK_WHITE_RE.test(p.core)),
  classForm('status-fill-as-text/text-on-fill', (p) =>
    /^text-(?:brand-fill|dim-bar|chart-\w+)$/.test(p.core),
  ),
  classForm('raw-scroll/overflow', (p) => /^overflow(?:-x|-y)?-(?:auto|scroll)$/.test(p.core)),
  classForm('tw-off-law/off-ladder', (p) => {
    const j = judge(p)
    return !!j && (j.kind === 'spacing' || j.kind === 'padding') && j.numeric && j.denied
  }),
  classForm('tw-off-law/surface-recipe', (p) => SURFACE.has(p.core)),
  classForm('tw-off-law/colour', (p) => COLOUR_RE.test(p.core)),
  classForm(
    'tw-off-law/alpha-premixed',
    (p) =>
      p.modifier !== null &&
      /^\d+$/.test(p.modifier) &&
      /-(?:hairline|hover|selected|scrim|[a-z-]+-tint)$/.test(p.core),
  ),
  classForm('tw-off-law/container-tier', (p) =>
    p.variants.some(
      (v) =>
        v.startsWith('@') &&
        !['narrow', 'regular', 'wide'].includes(v.slice(1).replace(/^(?:max|min)-/, '')),
    ),
  ),
  classForm('tw-off-law/important', (p) => p.important),
  classForm('tw-off-law/template', (_p, t) => t.dynamicTail && /[a-z]{2,}-$/.test(t.text)),
  classForm('tw-off-law/fixed-width', (p) => {
    if (p.family !== 'w' && p.family !== 'min-w') return false
    if (/^\d+(?:\.\d+)?$/.test(p.value)) return Number(p.value) > 96
    const inner = p.value.startsWith('[') ? p.value.slice(1, -1) : null
    const px = inner === null ? null : arbPx(inner)
    return px !== null && px > 384
  }),
  classForm(
    'tw-off-law/alpha-on-text',
    (p) => p.family === 'text' && p.modifier !== null && p.value !== '',
    (p) => SIZE_KW.test(p.value) || /^\[-?\.?\d/.test(p.value),
  ),
  classForm('app-spacing/space-xy', (p) => p.family === 'space-x' || p.family === 'space-y'),
  classForm(
    'app-spacing/margin',
    (p) =>
      /^(?:m|mx|my|mt|mr|mb|ml|ms|me)$/.test(p.family) &&
      p.value !== 'auto' &&
      p.value !== '' &&
      !p.negative,
  ),
  importBoundary('base-ui', /^@base-ui\/react(?:\/|$)/),
  importBoundary('radix', /^@radix-ui\//),
  importBoundary('cmdk', /^cmdk$/),
  importBoundary('sonner', /^sonner$/),
  importBoundary('streamdown', /^streamdown$/),
  importBoundary('tailwind-merge', /^tailwind-merge$/),
  importBoundary('visx', /^@visx\//),
  importForm(
    'import-boundary/use-react-table',
    'syntactic',
    (i) => i.spec === '@tanstack/react-table' && importNames(i, ['useReactTable']),
  ),
  importForm('import-boundary/ui-alias', 'syntactic', (i) => i.spec.startsWith('@/components/ui/')),
  nodeForm('import-boundary/use-chat', 'syntactic', (n) => {
    if (!ts.isCallExpression(n) || calleeName(n) !== 'useChat') return false
    const a = n.arguments[0]
    const hasChat =
      !!a &&
      ts.isObjectLiteralExpression(a) &&
      a.properties.some((p) => !!p.name && p.name.getText() === 'chat')
    return !hasChat
  }),
  importForm('import-boundary/persist', 'syntactic', (i) => {
    if (i.spec === 'zustand/middleware') return importNames(i, ['persist', 'createJSONStorage'])
    if (['usehooks-ts', 'react-use', '@uidotdev/usehooks'].includes(i.spec)) {
      return importNames(i, ['useLocalStorage', 'useSessionStorage'])
    }
    return i.spec === 'jotai/utils' && importNames(i, ['atomWithStorage'])
  }),
  nodeForm('primitive-bypass/raw-control', 'predicate', (n) => {
    const el = opening(n)
    const tag = el ? tagOf(el) : ''
    if (!el || !['button', 'input', 'select', 'textarea'].includes(tag)) return false
    const type = attrLiteral(el, 'type')
    return { fp: tag === 'input' && (type === 'hidden' || type === 'file') }
  }),
  nodeForm('primitive-bypass/input-choice', 'syntactic', (n) => {
    const el = opening(n)
    if (!el || tagOf(el) !== 'input') return false
    return ['checkbox', 'radio'].includes(attrLiteral(el, 'type') ?? '')
  }),
  nodeForm('primitive-bypass/heading', 'syntactic', (n) => {
    const el = opening(n)
    return !!el && /^h[1-6]$/.test(tagOf(el))
  }),
  nodeForm('primitive-bypass/table', 'syntactic', (n) => {
    const el = opening(n)
    return !!el && tagOf(el) === 'table'
  }),
  nodeForm('primitive-bypass/svg-marks', 'syntactic', (n) => {
    if (!ts.isJsxElement(n) || tagOf(n.openingElement) !== 'svg') return false
    return some(n, (x) => {
      if (!ts.isCallExpression(x) || calleeName(x) !== 'map' || !isFn(x.arguments[0])) return false
      return some(x.arguments[0], (y) => {
        const el = opening(y)
        return !!el && MARKS.has(tagOf(el))
      })
    })
  }),
  nodeForm('primitive-bypass/intl', 'syntactic', (n) => {
    if (ts.isNewExpression(n)) {
      const e = n.expression
      return (
        ts.isPropertyAccessExpression(e) &&
        e.expression.getText() === 'Intl' &&
        e.name.text.endsWith('Format')
      )
    }
    return (
      ts.isCallExpression(n) &&
      /^toLocale(?:Date|Time)?String$/.test(calleeName(n)) &&
      ts.isPropertyAccessExpression(n.expression)
    )
  }),
  nodeForm('primitive-bypass/role-table', 'syntactic', (n) => {
    if (!ts.isJsxAttribute(n) || n.name.getText() !== 'role') return false
    const init = n.initializer
    const v = strLit(init) ?? (init && ts.isJsxExpression(init) ? strLit(init.expression) : null)
    return v === 'table' || v === 'grid'
  }),
  nodeForm('router-search/link-search', 'syntactic', (n) => {
    const el = opening(n)
    const init = el && tagOf(el) === 'Link' ? attrOf(el, 'search')?.initializer : undefined
    return (
      !!init &&
      ts.isJsxExpression(init) &&
      !!init.expression &&
      ts.isObjectLiteralExpression(init.expression)
    )
  }),
  nodeForm('router-search/loader-deps', 'syntactic', (n) => {
    if (!ts.isPropertyAssignment(n) || n.name.getText() !== 'loaderDeps') return false
    return isFn(n.initializer) && returnsSearch(n.initializer)
  }),
  nodeForm('router-search/view-transition', 'syntactic', (n) => {
    if (!ts.isJsxElement(n) || tagOf(n.openingElement) !== 'ViewTransition') return false
    return some(n, (x) => {
      const el = opening(x)
      return !!el && tagOf(el) === 'Outlet'
    })
  }),
  nodeForm('router-search/validate-search', 'syntactic', (n) => {
    if (!ts.isPropertyAssignment(n) || n.name.getText() !== 'validateSearch') return false
    return isFn(n.initializer) && validateSearchReads(n.initializer)
  }),
  nodeForm('data-primitive/refetch-interval', 'syntactic', (n) => {
    const named = ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)
    return named && ['refetchInterval', 'refetchIntervalInBackground'].includes(n.name.getText())
  }),
  nodeForm('data-primitive/raw-stream', 'syntactic', (n, ctx) => {
    if (!ts.isNewExpression(n) || !ts.isIdentifier(n.expression)) return false
    if (!['EventSource', 'WebSocket'].includes(n.expression.text)) return false
    return !ctx.imports.some((i) => i.names.includes('Transport') || i.locals.includes('Transport'))
  }),
  nodeForm('data-primitive/get-reader', 'syntactic', (n) => {
    return (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === 'getReader'
    )
  }),
  nodeForm('data-primitive/new-query-client', 'syntactic', (n) => {
    const isNew =
      ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'QueryClient'
    return isNew && !insideFn(n, 'makeQueryClient')
  }),
  nodeForm('data-primitive/chart-fallback', 'syntactic', (n) => {
    if (!ts.isJsxAttribute(n) || n.name.getText() !== 'data') return false
    const el = n.parent.parent
    const e =
      n.initializer && ts.isJsxExpression(n.initializer) ? n.initializer.expression : undefined
    const nullish =
      !!e &&
      ts.isBinaryExpression(e) &&
      e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
    const emptyArr =
      nullish && ts.isArrayLiteralExpression(e.right) && e.right.elements.length === 0
    const el2 = opening(el)
    return emptyArr && !!el2 && tagOf(el2).endsWith('Chart')
  }),
  nodeForm('data-primitive/timer-invalidate', 'syntactic', (n) => {
    if (!ts.isCallExpression(n) || !['setInterval', 'setTimeout'].includes(calleeName(n)))
      return false
    const cb = n.arguments[0]
    if (!isFn(cb)) return false
    return some(
      cb,
      (x) =>
        ts.isCallExpression(x) &&
        ['invalidateQueries', 'refetchQueries', 'refetch'].includes(calleeName(x)),
    )
  }),
  nodeForm('data-primitive/raw-storage-write', 'predicate', (n, ctx) => {
    if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) return false
    if (!['setItem', 'removeItem', 'clear'].includes(n.expression.name.text)) return false
    const obj = n.expression.expression
    const name = ts.isIdentifier(obj)
      ? obj.text
      : ts.isPropertyAccessExpression(obj)
        ? obj.name.text
        : ''
    if (name !== 'localStorage' && name !== 'sessionStorage') return false
    return { fp: ctx.memberNames.has('getItem') && ctx.memberNames.has('setItem') }
  }),
  nodeForm('untrusted-markdown/inner-html', 'syntactic', (n) => {
    if (!ts.isJsxAttribute(n) || n.name.getText() !== 'dangerouslySetInnerHTML') return false
    const e =
      n.initializer && ts.isJsxExpression(n.initializer) ? n.initializer.expression : undefined
    if (!e || !ts.isObjectLiteralExpression(e)) return true
    const html = e.properties.find(
      (p) => ts.isPropertyAssignment(p) && p.name.getText() === '__html',
    )
    return !(html && ts.isPropertyAssignment(html) && ts.isStringLiteralLike(html.initializer))
  }),
  importForm('untrusted-markdown/rehype-raw', 'syntactic', (i) => i.spec === 'rehype-raw'),
  importForm('untrusted-markdown/mdx-evaluate', 'syntactic', (i) => {
    if (i.spec.startsWith('next-mdx-remote')) return true
    return i.spec === '@mdx-js/mdx' && importNames(i, ['evaluate', 'run'])
  }),
  nodeForm('untrusted-markdown/trusted', 'syntactic', (n) => {
    if (!ts.isJsxAttribute(n) || n.name.getText() !== 'contentTrust') return false
    const init = n.initializer
    return (
      (strLit(init) ?? (init && ts.isJsxExpression(init) ? strLit(init.expression) : null)) ===
      'trusted'
    )
  }),
  nodeForm('colour-literal/literal', 'predicate', (n) => {
    if (!isString(n)) return false
    const text = (n as ts.StringLiteral).text
    if (!HEX_RE.test(text) && !FN_COLOUR_RE.test(text)) return false
    return { fp: colourLiteralFp(n, text) }
  }),
  astForm('waiver-needs-reason/no-reason', 'syntactic', (ctx) =>
    ctx.comments
      .filter((c) => /(?:oxlint|eslint)-disable/.test(c.text) && !c.text.includes(' -- '))
      .map((c) => commentHit(ctx, c.pos)),
  ),
  astForm('waiver-needs-reason/file-level', 'syntactic', (ctx) =>
    ctx.comments
      .filter((c) => /^\/\*\s*(?:oxlint|eslint)-disable(?![-\w])/.test(c.text))
      .map((c) => commentHit(ctx, c.pos)),
  ),
]

function commentHit(ctx: FileCtx, pos: number): Hit {
  const p = ctx.sf.getLineAndCharacterOfPosition(pos)
  return { line: p.line + 1, col: p.character + 1, strict: true, fp: false }
}

export const NOT_MEASURED: readonly { form: string; reason: string }[] = [
  { form: 'import-boundary/engine-outside-subpath-list', reason: 'needs the 19-subpath list' },
  { form: 'control-home', reason: 'needs provenance' },
  { form: 'primitive-bypass/ui-table-rows-from-sort-slice', reason: 'needs data flow' },
  { form: 'primitive-bypass/chart-root-of-DataPanel', reason: 'needs data flow' },
  {
    form: 'data-primitive/deprecated-query-fetch-set',
    reason: 'set not enumerated in the concept',
  },
]
