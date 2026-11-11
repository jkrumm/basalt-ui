/**
 * Class-string extraction: every whitespace-separated piece of a string that sits in a class
 * context (`className`, `cn`/`clsx`/`cva`/`tv`/`twMerge` arguments, class-shaped arrays, `.join(' ')`,
 * template literals). `strict` marks the first kind; the rest is the lint's wider reach.
 */
import ts from 'typescript'

export interface ClassToken {
  text: string
  line: number
  col: number
  strict: boolean
  /** a template piece cut by `${`: the token is partial and not a class */
  partial: boolean
}

export const CLASS_FNS = new Set([
  'cn',
  'clsx',
  'cva',
  'twMerge',
  'twJoin',
  'tv',
  'classNames',
  'cx',
])

const UTILITY_HEADS =
  'p px py pt pr pb pl ps pe m mx my mt mr mb ml ms me gap space w h size min max text font leading bg border rounded shadow ring flex grid items justify overflow opacity z inset top left right bottom hidden block inline absolute relative fixed sticky truncate transition duration cursor select pointer whitespace object aspect col row basis grow shrink translate rotate scale fill stroke outline divide tracking uppercase lowercase'.split(
    ' ',
  )
const TW_UTILITY_RE = new RegExp(
  `^(?:[^\\s:]+:)*!?-?(?:${UTILITY_HEADS.join('|')})(?:[-/][^\\s]*)?!?$`,
)

type Collected = { node: ts.Node; strict: boolean }

const isStringPiece = (n: ts.Node): boolean =>
  ts.isStringLiteral(n) ||
  ts.isNoSubstitutionTemplateLiteral(n) ||
  ts.isTemplateHead(n) ||
  ts.isTemplateMiddle(n) ||
  ts.isTemplateTail(n)

export function calleeName(call: ts.CallExpression): string {
  const c = call.expression
  if (ts.isIdentifier(c)) return c.text
  return ts.isPropertyAccessExpression(c) ? c.name.text : ''
}

export function extractTokens(sf: ts.SourceFile): ClassToken[] {
  const found = new Map<number, Collected>()
  const consts = new Map<string, ts.Expression>()
  const add = (node: ts.Node, strict: boolean): void => {
    const prev = found.get(node.pos)
    if (!prev) found.set(node.pos, { node, strict })
    else if (strict) prev.strict = true
  }

  const walk = (e: ts.Node | undefined, strict: boolean, hop: boolean): void => {
    if (!e) return
    if (isStringPiece(e)) return add(e, strict)
    if (ts.isTemplateExpression(e)) {
      add(e.head, strict)
      for (const span of e.templateSpans) {
        walk(span.expression, strict, hop)
        add(span.literal, strict)
      }
      return
    }
    if (ts.isArrayLiteralExpression(e)) return e.elements.forEach((x) => walk(x, strict, hop))
    if (ts.isObjectLiteralExpression(e)) {
      for (const p of e.properties) {
        if (ts.isSpreadAssignment(p)) walk(p.expression, strict, hop)
        if (!ts.isPropertyAssignment(p)) continue
        if (ts.isStringLiteral(p.name)) add(p.name, strict)
        walk(p.initializer, strict, hop)
      }
      return
    }
    if (ts.isConditionalExpression(e)) {
      walk(e.whenTrue, strict, hop)
      return walk(e.whenFalse, strict, hop)
    }
    if (ts.isBinaryExpression(e)) {
      const k = e.operatorToken.kind
      const logical =
        k === ts.SyntaxKind.AmpersandAmpersandToken ||
        k === ts.SyntaxKind.BarBarToken ||
        k === ts.SyntaxKind.QuestionQuestionToken ||
        k === ts.SyntaxKind.PlusToken
      if (!logical) return
      walk(e.left, strict, hop)
      return walk(e.right, strict, hop)
    }
    if (ts.isCallExpression(e)) {
      if (ts.isPropertyAccessExpression(e.expression) && e.expression.name.text === 'join')
        return walk(e.expression.expression, strict, hop)
      if (CLASS_FNS.has(calleeName(e))) e.arguments.forEach((a) => walk(a, strict, hop))
      return
    }
    if (
      ts.isParenthesizedExpression(e) ||
      ts.isAsExpression(e) ||
      ts.isSatisfiesExpression(e) ||
      ts.isNonNullExpression(e) ||
      ts.isJsxExpression(e)
    ) {
      return walk(e.expression, strict, hop)
    }
    if (ts.isIdentifier(e) && hop) walk(consts.get(e.text), strict, false)
  }

  const looseStrings = (arr: ts.ArrayLiteralExpression): void => {
    const strs = arr.elements.filter((x) => ts.isStringLiteralLike(x))
    if (strs.length < 2) return
    const hit = strs.some((s) => s.text.split(/\s+/).some((t) => TW_UTILITY_RE.test(t)))
    if (hit) strs.forEach((s) => add(s, false))
  }

  const collectConsts = (n: ts.Node): void => {
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.initializer &&
      n.parent.flags & ts.NodeFlags.Const
    ) {
      consts.set(n.name.text, n.initializer)
    }
    ts.forEachChild(n, collectConsts)
  }
  collectConsts(sf)

  const visit = (n: ts.Node): void => {
    if (ts.isJsxAttribute(n) && ts.isIdentifier(n.name)) {
      const name = n.name.text
      if (name === 'className' || name === 'class' || name.endsWith('ClassName')) {
        walk(n.initializer, true, true)
      }
    }
    if (ts.isCallExpression(n) && CLASS_FNS.has(calleeName(n))) {
      n.arguments.forEach((a) => walk(a, true, true))
    }
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === 'join'
    ) {
      walk(n.expression.expression, false, false)
    }
    if (ts.isArrayLiteralExpression(n)) looseStrings(n)
    if (ts.isTemplateExpression(n)) walk(n, false, false)
    if (ts.isNoSubstitutionTemplateLiteral(n)) add(n, false)
    ts.forEachChild(n, visit)
  }
  visit(sf)

  const tokens: ClassToken[] = []
  for (const { node, strict } of found.values()) {
    const text = (node as ts.StringLiteral).text
    const start = node.getStart(sf) + 1
    const cutAfter = ts.isTemplateHead(node) || ts.isTemplateMiddle(node)
    const cutBefore = ts.isTemplateMiddle(node) || ts.isTemplateTail(node)
    for (const m of text.matchAll(/\S+/g)) {
      const at = sf.getLineAndCharacterOfPosition(start + m.index)
      const last = m.index + m[0].length === text.length
      const partial = (cutAfter && last) || (cutBefore && m.index === 0)
      tokens.push({ text: m[0], line: at.line + 1, col: at.character + 1, strict, partial })
    }
  }
  return tokens.toSorted((a, b) => a.line - b.line || a.col - b.col || (a.text < b.text ? -1 : 1))
}
