/**
 * Class-string extraction (STRICT / LOOSE contexts), `parseClass`, the tokens-visual.md section 3
 * allowlist and the owner's value-only rubric.
 */
import ts from 'typescript'

export interface ClassToken {
  text: string
  line: number
  col: number
  /** the string sits in a STRICT class context (the oracle) */
  strict: boolean
  /** quasi ends right before `${` with a trailing `-` */
  dynamicTail: boolean
}

export interface ParsedClass {
  variants: string[]
  important: boolean
  negative: boolean
  family: string
  value: string
  modifier: string | null
  /** base without `!`, leading `-` and `/modifier` */
  core: string
}

const CLASS_FNS = new Set(['cn', 'clsx', 'cva', 'twMerge', 'twJoin', 'tv', 'classNames'])

const UTILITY_PREFIXES = [
  ...'p px py pt pr pb pl ps pe m mx my mt mr mb'.split(' '),
  ...'ml ms me gap space w h size min max text font leading'.split(' '),
  ...'bg border rounded shadow ring flex grid items justify overflow'.split(' '),
  ...'opacity z inset top left right bottom hidden block inline'.split(' '),
  ...'absolute relative fixed sticky truncate transition duration cursor'.split(' '),
  ...'select pointer whitespace object aspect col row basis grow'.split(' '),
  ...'shrink translate rotate scale fill stroke outline divide tracking'.split(' '),
  ...'uppercase lowercase'.split(' '),
]
const TW_UTILITY_RE = new RegExp(
  `^(?:[^\\s:]+:)*!?-?(?:${UTILITY_PREFIXES.join('|')})(?:[-/][^\\s]*)?!?$`,
)

// ---------------------------------------------------------------------------------------------
// extraction

type Collected = { node: ts.Node; strict: boolean }

const isStringPiece = (n: ts.Node): boolean =>
  ts.isStringLiteral(n) ||
  ts.isNoSubstitutionTemplateLiteral(n) ||
  ts.isTemplateHead(n) ||
  ts.isTemplateMiddle(n) ||
  ts.isTemplateTail(n)

function calleeName(call: ts.CallExpression): string {
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
        k === ts.SyntaxKind.QuestionQuestionToken
      if (!logical) return
      walk(e.left, strict, hop)
      return walk(e.right, strict, hop)
    }
    if (ts.isCallExpression(e)) {
      const isJoin =
        ts.isPropertyAccessExpression(e.expression) && e.expression.name.text === 'join'
      if (isJoin) return walk((e.expression as ts.PropertyAccessExpression).expression, strict, hop)
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
    const hit = strs.some((s) =>
      (s as ts.StringLiteral).text.split(/\s+/).some((t) => TW_UTILITY_RE.test(t)),
    )
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
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      if (n.expression.name.text === 'join') walk(n.expression.expression, false, false)
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
    const followedBySubst = ts.isTemplateHead(node) || ts.isTemplateMiddle(node)
    for (const m of text.matchAll(/\S+/g)) {
      const at = sf.getLineAndCharacterOfPosition(start + m.index)
      tokens.push({
        text: m[0],
        line: at.line + 1,
        col: at.character + 1,
        strict,
        dynamicTail: followedBySubst && m.index + m[0].length === text.length && m[0].endsWith('-'),
      })
    }
  }
  return tokens.toSorted((a, b) => a.line - b.line || a.col - b.col || (a.text < b.text ? -1 : 1))
}

// ---------------------------------------------------------------------------------------------
// parseClass

function splitTop(s: string, sep: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '[' || ch === '(') depth++
    if (ch === ']' || ch === ')') depth--
    if (ch === sep && depth === 0) {
      parts.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  parts.push(cur)
  return parts
}

const FAMILIES = [
  ...'gap-x gap-y gap space-x space-y inset-x inset-y inset min-w'.split(' '),
  ...'min-h max-w max-h size w h mx my mt mr mb ml ms me'.split(' '),
  ...'m px py pt pr pb pl ps pe p top right bottom left'.split(' '),
  ...'start end text font bg border ring outline divide from via'.split(' '),
  ...'to fill stroke decoration shadow accent caret rounded leading'.split(' '),
  ...'tracking overflow-x overflow-y overflow'.split(' '),
].toSorted((a, b) => b.length - a.length)

export function parseClass(token: string): ParsedClass {
  const segs = splitTop(token, ':')
  const variants = segs.slice(0, -1)
  let base = segs[segs.length - 1] ?? ''
  const important = base.startsWith('!') || base.endsWith('!')
  base = base.replace(/^!/, '').replace(/!$/, '')
  const negative = base.startsWith('-')
  if (negative) base = base.slice(1)
  const slash = splitTop(base, '/')
  const modifier = slash.length > 1 ? (slash[slash.length - 1] ?? null) : null
  const core = modifier === null ? base : slash.slice(0, -1).join('/')
  const family = FAMILIES.find((f) => core.startsWith(`${f}-`)) ?? ''
  return {
    variants,
    important,
    negative,
    family,
    value: family ? core.slice(family.length + 1) : core,
    modifier,
    core,
  }
}

// ---------------------------------------------------------------------------------------------
// allowlist (tokens-visual.md section 3) and px resolution

export type Kind = 'type' | 'weight' | 'spacing' | 'padding'

export interface Judgement {
  kind: Kind
  /** null = unresolvable ("unclear") */
  px: number | null
  /** fails the allowlist */
  denied: boolean
  /** the value was a plain number (not arbitrary, not `px`) */
  numeric: boolean
}

const TYPE_ALLOWED: Record<string, number> = {
  micro: 11,
  xs: 12,
  sm: 13,
  md: 15,
  base: 16,
  lg: 18,
  display: 30,
}
const TYPE_DENIED: Record<string, number> = {
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
  '6xl': 60,
  '7xl': 72,
  '8xl': 96,
  '9xl': 128,
}
const WEIGHT_ALLOWED: Record<string, number> = { normal: 400, medium: 500, semibold: 600 }
const WEIGHT_DENIED: Record<string, number> = {
  thin: 100,
  extralight: 200,
  light: 300,
  bold: 700,
  extrabold: 800,
  black: 900,
}
const PADDING = new Set(['p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'ps', 'pe'])
const SPACING = new Set([
  ...'m mx my mt mr mb ml ms me gap gap-x gap-y space-x'.split(' '),
  ...'space-y inset inset-x inset-y top right bottom left start end'.split(' '),
  ...'w h size min-w min-h max-w max-h'.split(' '),
])
const HALF_STEPS = new Set([0.5, 1.5, 2.5, 3.5])
const NUM_RE = /^\d+(?:\.\d+)?$/

/** px of an arbitrary value body (no brackets); `em` is taken as 16px per em. */
export function arbPx(inner: string): number | null {
  const m = /^(-?\d*\.?\d+)(px|rem|em)?$/.exec(inner)
  if (!m?.[1] || m[2] === undefined) return null
  return Number(m[1]) * (m[2] === 'px' ? 1 : 16)
}

const brackets = (v: string): string | null =>
  v.startsWith('[') && v.endsWith(']') ? v.slice(1, -1) : null

function judgeType(p: ParsedClass): Judgement | null {
  const kw = p.value
  const named = TYPE_ALLOWED[kw] ?? TYPE_DENIED[kw]
  if (named !== undefined) {
    const allowed = kw in TYPE_ALLOWED && p.modifier === null
    return { kind: 'type', px: named, denied: !allowed, numeric: false }
  }
  const inner = brackets(kw)
  if (inner === null) return null
  const unclear: Judgement = { kind: 'type', px: null, denied: true, numeric: false }
  if (inner.startsWith('length:var(')) return null
  if (inner === 'dynamic' || inner.startsWith('length:')) return unclear
  if (/^(?:calc|clamp|min|max)\(/.test(inner)) return unclear
  if (!/^-?\.?\d/.test(inner)) return null
  return { kind: 'type', px: arbPx(inner), denied: true, numeric: false }
}

function judgeWeight(p: ParsedClass): Judgement | null {
  const named = WEIGHT_ALLOWED[p.value] ?? WEIGHT_DENIED[p.value]
  if (named !== undefined) {
    return { kind: 'weight', px: named, denied: !(p.value in WEIGHT_ALLOWED), numeric: false }
  }
  const inner = brackets(p.value)
  if (inner === 'dynamic') return { kind: 'weight', px: null, denied: true, numeric: false }
  if (inner === null || !NUM_RE.test(inner)) return null
  return { kind: 'weight', px: Number(inner), denied: true, numeric: false }
}

function judgeSpacing(p: ParsedClass): Judgement | null {
  const kind: Kind = PADDING.has(p.family) ? 'padding' : 'spacing'
  const v = p.value
  if (p.modifier !== null) return null
  if (v === 'px') return { kind, px: 1, denied: true, numeric: false }
  const inner = brackets(v)
  if (inner !== null) {
    return { kind, px: arbPx(inner), denied: true, numeric: false }
  }
  if (v.startsWith('(')) return { kind, px: null, denied: true, numeric: false }
  if (!NUM_RE.test(v)) return null
  const n = Number(v)
  const onLadder = Number.isInteger(n) || HALF_STEPS.has(n)
  return { kind, px: n * 4, denied: !onLadder, numeric: true }
}

export function judge(p: ParsedClass): Judgement | null {
  if (p.family === 'text') return judgeType(p)
  if (p.family === 'font') return judgeWeight(p)
  if (PADDING.has(p.family) || SPACING.has(p.family)) return judgeSpacing(p)
  return null
}

// ---------------------------------------------------------------------------------------------
// rubric

export const RUBRIC =
  'A denied site is "genuine need" iff its px value equals NO allowed value and the nearest ' +
  'allowed step is MORE than one rung away; otherwise "no need"; px = null ("unclear") counts as ' +
  'need. Allowed values: spacing = multiples of 4 plus 2,6,10,14; type {11,12,13,15,16,18,30}; ' +
  'weight {400,500,600}. For v not allowed: lo/hi = adjacent allowed neighbours, dist = distance ' +
  'to the nearer one, rung = hi-lo of those neighbours. Inside the ladder dist <= rung/2 so it is ' +
  'never over one rung (no need). Beyond an end of a bounded ladder (type <11 or >30, weight <400 ' +
  'or >600): rung = gap of the two outermost steps on that side (type low 11->12 = 1, type high ' +
  '18->30 = 12, weight 100 both ends); need iff dist > rung. Spacing is unbounded above and floors ' +
  'at 0. Reason per site: equals-allowed | within-rung | beyond-end | unclear.'

export type Reason = 'equals-allowed' | 'within-rung' | 'beyond-end' | 'unclear'
export const REASONS: readonly Reason[] = ['equals-allowed', 'within-rung', 'beyond-end', 'unclear']

const TYPE_LADDER = [11, 12, 13, 15, 16, 18, 30]
const WEIGHT_LADDER = [400, 500, 600]

function ladderFor(kind: Kind, v: number): number[] {
  if (kind === 'type') return TYPE_LADDER
  if (kind === 'weight') return WEIGHT_LADDER
  const ladder = [0, 2, 4, 6, 8, 10, 12, 14, 16]
  for (let s = 20; s <= Math.ceil(v / 4) * 4 + 4; s += 4) ladder.push(s)
  return ladder
}

export function rubric(kind: Kind, px: number | null): { need: boolean; reason: Reason } {
  if (px === null) return { need: true, reason: 'unclear' }
  const v = Math.abs(px)
  const ladder = ladderFor(kind, v)
  if (ladder.some((a) => Math.abs(a - v) < 1e-9)) return { need: false, reason: 'equals-allowed' }
  const first = ladder[0] ?? 0
  const last = ladder[ladder.length - 1] ?? 0
  if (v >= first && v <= last) return { need: false, reason: 'within-rung' }
  if (v < first) {
    const rung = (ladder[1] ?? first) - first
    return { need: first - v > rung, reason: 'beyond-end' }
  }
  const rung = last - (ladder[ladder.length - 2] ?? last)
  return { need: v - last > rung, reason: 'beyond-end' }
}
