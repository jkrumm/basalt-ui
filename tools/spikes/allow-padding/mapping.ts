/** Reproduces the Mantine-prop -> Tailwind-class emit of the (unbuilt) codemod. */
import ts from 'typescript'

const SPACE: Record<string, string> = {}
const PAIRS = 'gap:gap spacing:gap rowGap:gap-y verticalSpacing:gap-y columnGap:gap-x w:w h:h'
for (const pair of `${PAIRS} miw:min-w mih:min-h maw:max-w mah:max-h`.split(' ')) {
  const [prop, cls] = pair.split(':')
  SPACE[prop as string] = cls as string
}
for (const side of ['', 't', 'b', 'l', 'r', 'x', 'y', 's', 'e']) {
  SPACE[`m${side}`] = `m${side}`
  SPACE[`p${side}`] = `p${side}`
}
const TOKEN_PX: Record<string, number> = { xs: 10, sm: 12, md: 16, lg: 20, xl: 32 }
const FZ_TOKENS = new Set(Object.keys(TOKEN_PX))
const WEIGHTS = 'thin extralight light normal medium semibold bold extrabold black'.split(' ')
type Leaf = number | string | null // null = non-literal

function leaves(e: ts.Node): Leaf[] {
  if (ts.isJsxExpression(e)) return e.expression ? leaves(e.expression) : []
  if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e)) return leaves(e.expression)
  if (ts.isStringLiteralLike(e)) return [e.text]
  if (ts.isNumericLiteral(e)) return [Number(e.text)]
  if (ts.isPrefixUnaryExpression(e) && e.operator === ts.SyntaxKind.MinusToken) {
    return ts.isNumericLiteral(e.operand) ? [-Number(e.operand.text)] : [null]
  }
  if (ts.isConditionalExpression(e)) return [...leaves(e.whenTrue), ...leaves(e.whenFalse)]
  if (!ts.isObjectLiteralExpression(e)) return [null]
  return e.properties.flatMap((p) => (ts.isPropertyAssignment(p) ? leaves(p.initializer) : [null]))
}

function toPx(v: number | string): number | null {
  if (typeof v === 'number') return v
  const token = TOKEN_PX[v]
  if (token !== undefined) return token
  const m = /^(-?\d*\.?\d+)(px|rem)?$/.exec(v)
  return m?.[1] ? Number(m[1]) * (m[2] === 'rem' ? 16 : 1) : null
}

function spaceClass(prefix: string, v: Leaf): string | null {
  if (v === 'auto') return null
  if (v === null) return `${prefix}-[dynamic]`
  const px = toPx(v)
  if (px === null) return `${prefix}-[${v}]`
  return `${px < 0 ? '-' : ''}${prefix}-${Math.abs(px) / 4}`
}

function fzClass(v: Leaf): string {
  if (v === null) return 'text-[dynamic]'
  if (typeof v === 'number' || /^\d+(\.\d+)?$/.test(v)) return `text-[${v}px]`
  return FZ_TOKENS.has(v) ? `text-${v}` : `text-[${v}]`
}

function fwClass(v: Leaf): string {
  if (v === null) return 'font-[dynamic]'
  const n = v === 'bold' ? 700 : v === 'normal' ? 400 : Number(v)
  const name = WEIGHTS[n / 100 - 1]
  return Number.isInteger(n / 100) && name ? `font-${name}` : `font-[${v}]`
}

export function emit(el: ts.JsxOpeningLikeElement): { cls: string; node: ts.Node }[] {
  const attrs = new Map<string, ts.JsxAttribute>()
  for (const a of el.attributes.properties) {
    if (ts.isJsxAttribute(a)) attrs.set(a.name.getText(), a)
  }
  const lhInit = attrs.get('lh')?.initializer
  const lhMod = attrs.has('lh') ? `/[${(lhInit && leaves(lhInit)[0]) ?? 'dynamic'}]` : ''
  const isText = el.tagName.getText() === 'Text'
  const out: { cls: string; node: ts.Node }[] = []
  for (const [name, attr] of attrs) {
    for (const v of attr.initializer ? leaves(attr.initializer) : [null]) {
      const isFz = name === 'fz' || (name === 'size' && isText)
      const space = SPACE[name]
      const cls = space ? spaceClass(space, v) : isFz ? fzClass(v) + lhMod : null
      const finalCls = name === 'fw' ? fwClass(v) : cls
      if (finalCls) out.push({ cls: finalCls, node: attr })
    }
  }
  return out
}
