/**
 * `basalt/color-literal` (guardrails section 4, row 14): a hex or color function written as a
 * string in TS. The regex guard it replaces had an escape hatch, which is why shutterflow carried
 * 11 canvas waivers; an AST rule reads strings and template quasis and nothing else. Deep-rendering
 * files take one file-level waiver on a path in `manifest.deepRender` (`waiver-needs-reason`).
 *
 * `color(display-p3 0.1 0.5 0.9)` (a `color()` over a color space) reads as `oklch(` does.
 *
 * A function that wraps a token (`rgb(var(--basalt-x) / 50%)`) is not a literal and passes;
 * CSS relative color syntax (`rgb(from var(--basalt-x) r g b / 50%)`, `oklch(from …)`, `color(from …)`)
 * is the alpha the `alpha(BASALT.x, n)` helper owns and reports; `color-mix` and `light-dark` are the
 * stylesheet's, not this rule's.
 *
 * `basalt.tokens.ts`, the series file `tokens:css --extra` reads, is the one file that writes raw
 * color pairs, and is not read at all.
 *
 * A CSS named color (`'white'`, `'steelblue'`) is a literal where it is written into a color slot:
 * a canvas `strokeStyle`, `fillStyle` or `shadowColor` assignment, a style-object key such as
 * `color`, `backgroundColor`, `fill` or `stroke`, or an SVG `fill` / `stroke` attribute (through a
 * ternary or `||` too). The same word anywhere else is a plain string. `transparent`, `inherit`,
 * `currentColor` and `none` are keywords, not colors, and pass.
 *
 * A bare `hsl(var(--border))`, `rgb(var(--x))` or `oklch(var(--x))` over a variable that is not a
 * `--basalt-` token is the shadcn v3 idiom the stylesheet's `function-disallowed-list` bans, and reports.
 * A `*-color` key (`'line-color'`, `'fill-color'`, a maplibre paint object) is a color slot.
 *
 * A `#` plus digits string under a reference key (`ref`, `id`, `issue`, `number`, `ticket`, or a
 * compound such as `issueRef`, `rowId`, `issueNumber`) is an Issue reference and passes; the same
 * string under `color` or `fill` still reports. An anchor under a link key (`href`, `to`, `hash`,
 * as a property or a JSX attribute: `{ href: '#add' }`, `<a href="#cafe">`) is a fragment and
 * passes, a hex-shaped one included: `{ from: '#fff', to: '#000' }` reports only `#fff`, since
 * `#add` and `#000` are the same shape.
 *
 * Known limit: a named color that reaches its slot through a variable or a function result is not
 * read (`const c = 'white'; ctx.fillStyle = c` reports nothing: only the slot's own literal is). A
 * short hex-alphabet fragment (`'#feed'`, `'#cafe'`) is indistinguishable from a
 * color by syntax alone outside a link key. `url(#id)` and `url('#id')` pass; a selector string of
 * that shape takes a per-line waiver with a reason.
 */
import type { AstForm } from '../../rule-table'
import { defineRules } from '../../rule-table'
import type { Node } from '../../factory'
import { isSeriesFile, isTestFile } from '../../factory'

const HEX = /(?<!url\(['"]?)(?<![\w&#-])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi
const COLOR_FUNCTION =
  /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*(?:[-+.\d]|none\b|\$\{\})/i
/** `rgb(from var(--basalt-x) r g b / 50%)`: CSS relative color syntax, the alpha `alpha(BASALT.x, n)` owns. */
const RELATIVE_COLOR = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(\s*from\s/i
/** `color(display-p3 0.1 0.5 0.9)`: the CSS `color()` function over a color space. */
const COLOR_SPACE_FUNCTION =
  /(?<![\w-])color\(\s*(?:srgb(?:-linear)?|display-p3|a98-rgb|prophoto-rgb|rec2020|xyz(?:-d50|-d65)?)\s/i

/** `#123` in prose is an issue number, not a color; a bare `'#123'` string still is one. */
const isIssueReference = (match: string, text: string): boolean =>
  /^#\d{3,4}$/.test(match) && text.trim() !== match

const NON_TOKEN_VAR_FUNCTION =
  /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*var\(\s*--(?!basalt-)[\w-]+\s*(?:,[^)]*)?\)\s*\)/i

const REFERENCE_KEY = /^(?:ref|id|issue|number|ticket)$|(?:Ref|Id|Issue|Number|Ticket)$/

const LINK_KEY = /^(?:href|to|hash)$/

function literalIn(text: string): string | undefined {
  const fn = COLOR_FUNCTION.exec(text) ?? COLOR_SPACE_FUNCTION.exec(text)
  if (fn) return `${fn[0].replace(/\(.*$/s, '')}()`
  const relative = RELATIVE_COLOR.exec(text)
  if (relative) return `${relative[0].replace(/\(.*$/s, '')}(from …)`
  const bare = NON_TOKEN_VAR_FUNCTION.exec(text)
  if (bare) return `${bare[0].replace(/\(.*$/s, '')}(var())`
  for (const hex of text.matchAll(HEX)) {
    if (!isIssueReference(hex[0], text)) return hex[0]
  }
  return undefined
}

const templateText = (node: Node): string =>
  (Array.isArray(node['quasis']) ? (node['quasis'] as Node[]) : [])
    .map((quasi) => {
      const value = quasi['value'] as { cooked?: string | null; raw: string }
      return value.cooked ?? value.raw
    })
    .join('${}')

/** `{ ref: '#657' }`: the string is the value of a reference-named property. */
function isReferenceValue(node: Node): boolean {
  const property = parentOf(node)
  if (property?.type !== 'Property' || property['value'] !== node) return false
  return REFERENCE_KEY.test(keyName(property) ?? '')
}

/** `{ href: '#add' }` or `<a href="#add">`: an anchor fragment under a link key. */
function isAnchorValue(node: Node): boolean {
  const parent = parentOf(node)
  if (parent?.type === 'Property' && parent['value'] === node) {
    return LINK_KEY.test(keyName(parent) ?? '')
  }
  if (parent?.type !== 'JSXAttribute') return false
  const name = parent['name'] as Node
  return name.type === 'JSXIdentifier' && LINK_KEY.test(name['name'] as string)
}

const isModuleSource = (node: Node): boolean => {
  const parent = node['parent'] as Node | undefined
  return (
    parent?.type === 'ImportDeclaration' ||
    parent?.type === 'ExportAllDeclaration' ||
    parent?.type === 'ExportNamedDeclaration'
  )
}

const NAMED_COLORS: ReadonlySet<string> = new Set(
  (
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet ' +
    'brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan ' +
    'darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta ' +
    'darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue ' +
    'darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey ' +
    'dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray ' +
    'green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush ' +
    'lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray ' +
    'lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray ' +
    'lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon ' +
    'mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue ' +
    'mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin ' +
    'navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen ' +
    'paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple ' +
    'rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna ' +
    'silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle ' +
    'tomato turquoise violet wheat white whitesmoke yellow yellowgreen'
  ).split(' '),
)

const COLOR_SLOTS: ReadonlySet<string> = new Set([
  'strokeStyle',
  'fillStyle',
  'shadowColor',
  'color',
  'backgroundColor',
  'borderColor',
  'outlineColor',
  'caretColor',
  'fill',
  'stroke',
  'background',
])
const COLOR_ATTRIBUTES: ReadonlySet<string> = new Set([
  'fill',
  'stroke',
  'stopColor',
  'floodColor',
  'lightingColor',
])

const parentOf = (node: Node): Node | undefined => node['parent'] as Node | undefined

const keyName = (property: Node): string | undefined => {
  const key = property['key'] as Node | undefined
  if (!key || property['computed']) return undefined
  if (key.type === 'Identifier') return key['name'] as string
  return typeof key['value'] === 'string' ? key['value'] : undefined
}

/** True when a string is written into a color slot: `ctx.fillStyle = …`, `{ color: … }`, `<rect fill=… />`. */
function inColorSlot(literal: Node): boolean {
  let at = literal
  let up = parentOf(at)
  while (
    up &&
    up['test'] !== at &&
    (up.type === 'ConditionalExpression' ||
      up.type === 'LogicalExpression' ||
      up.type === 'TSAsExpression' ||
      up.type === 'JSXExpressionContainer')
  ) {
    at = up
    up = parentOf(at)
  }
  if (up?.type === 'AssignmentExpression' && up['right'] === at) {
    const left = up['left'] as Node
    if (left.type !== 'MemberExpression' || left['computed']) return false
    return COLOR_SLOTS.has(((left['property'] as Node)['name'] as string | undefined) ?? '')
  }
  if (up?.type === 'Property' && up['value'] === at) {
    const key = keyName(up) ?? ''
    return COLOR_SLOTS.has(key) || key.endsWith('-color')
  }
  if (up?.type !== 'JSXAttribute') return false
  const name = up['name'] as Node
  return name.type === 'JSXIdentifier' && COLOR_ATTRIBUTES.has(name['name'] as string)
}

const namedColorIn = (literal: Node, text: string): string | undefined =>
  NAMED_COLORS.has(text.trim().toLowerCase()) && inColorSlot(literal) ? text.trim() : undefined

export const colorLiteralForm: AstForm = {
  id: 'color-literal',
  detect: ({ context, report }) =>
    isSeriesFile(context)
      ? {}
      : {
          Literal(node) {
            const text = node['value']
            if (typeof text !== 'string' || isModuleSource(node)) return
            // A test passes a color word as input (`{ color: 'red' }`); a hex is still a literal there.
            if (/^#\d{3,4}$/.test(text.trim()) && isReferenceValue(node)) return
            if (/^#[\w-]+$/.test(text.trim()) && isAnchorValue(node)) return
            const found =
              literalIn(text) ?? (isTestFile(context) ? undefined : namedColorIn(node, text))
            if (found) report(node, found)
          },
          TemplateLiteral(node) {
            const found = literalIn(templateText(node))
            if (found) report(node, found)
          },
        },
  fix: 'A BASALT.* token, alpha(BASALT.x, n) or the series file (src/basalt.tokens.ts); a deep-rendering file takes a reasoned file waiver',
  next: 'A canvas renderer lists its file in manifest.deepRender and waives color-literal once with -- <why>; a series color goes in basalt.tokens.ts, never a waiver',
  fixture: 'structure-rest/color-literal.tsx',
}

export const colorLiteralRules = defineRules({
  'color-literal': {
    family: 'structure',
    profiles: ['bridge', 'parts', 'app', 'site'],
    defect:
      '11 shutterflow canvas waivers (overlay.ts 10, Stage.tsx 1); the regex guard gave the escape and an AST rule replaces it',
    forms: [colorLiteralForm],
  },
})
