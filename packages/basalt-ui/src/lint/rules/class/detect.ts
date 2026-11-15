/**
 * The two detectors the class family cannot express as one pattern: the JS media-query form of
 * `viewport-keyed` (an AST form) and the profile gate for `tw-off-law` forms that exist only from
 * `parts` upward (guardrails section 4, row 6: "(b, c, h) parts+; rest bridge+").
 */
import type { FormContext, Node, Visitor } from '../../factory'
import { classStringVisitor, classTokens, mergeVisitors } from '../../factory'
import type { AstForm, ClassForm } from '../../rule-table'

/** Calls whose first argument is a media query string. */
const QUERY_CALLEES: ReadonlySet<string> = new Set(['matchMedia', 'useMediaQuery'])

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && typeof (value as Node).type === 'string'

const field = (node: Node, key: string): Node | undefined => {
  const value = node[key]
  return isNode(value) ? value : undefined
}

/** `matchMedia(..)`, `window.matchMedia(..)` and `useMediaQuery(..)` by their final name. */
function calleeName(call: Node): string | undefined {
  const callee = field(call, 'callee')
  if (callee?.type === 'Identifier') return callee['name'] as string
  if (callee?.type === 'MemberExpression' && callee['computed'] !== true) {
    const property = field(callee, 'property')
    return property?.type === 'Identifier' ? (property['name'] as string) : undefined
  }
  return undefined
}

/** The literal text of a string or template argument; any other argument is open (undefined). */
function literalText(arg: Node | undefined): string | undefined {
  if (arg?.type === 'Literal') return typeof arg['value'] === 'string' ? arg['value'] : undefined
  if (arg?.type !== 'TemplateLiteral') return undefined
  const quasis = Array.isArray(arg['quasis']) ? arg['quasis'].filter(isNode) : []
  return quasis
    .map((quasi) => {
      const value = quasi['value'] as { cooked?: string | null; raw: string }
      return value.cooked ?? value.raw
    })
    .join('${}')
}

/**
 * `viewport-keyed`, JS form: a media query whose literal text names a `width`, or the viewport
 * width read against a number (`window.innerWidth < 768`; an element's `clientWidth` is container-keyed). Reduced-motion,
 * colour-scheme and pointer queries are not viewport-keyed; a non-literal argument stays open
 * (S2: 8 of 28 hits remain once narrowed, all true).
 */
export function mediaQueryForm({ report }: FormContext): Visitor {
  return {
    CallExpression(node) {
      const name = calleeName(node)
      if (name === undefined || !QUERY_CALLEES.has(name)) return
      const args = Array.isArray(node['arguments']) ? node['arguments'].filter(isNode) : []
      const text = literalText(args[0])
      if (text !== undefined && /width/i.test(text)) report(node, `${name}('${text}')`)
    },
    BinaryExpression(node) {
      const subject = widthComparison(node)
      if (subject !== undefined) report(node, subject)
    },
  }
}

/** The text of a viewport-size read: `window.innerWidth`, `innerWidth`, `document.documentElement.clientWidth`. */
function viewportRead(node: Node | undefined): string | undefined {
  if (node?.type === 'Identifier') return node['name'] === 'innerWidth' ? 'innerWidth' : undefined
  if (node?.type !== 'MemberExpression' || node['computed'] === true) return undefined
  const property = field(node, 'property')
  const prop = property?.type === 'Identifier' ? (property['name'] as string) : undefined
  const object = field(node, 'object')
  if (prop === 'innerWidth' || prop === 'outerWidth') {
    return object?.type === 'Identifier' && object['name'] === 'window'
      ? `window.${prop}`
      : undefined
  }
  if (prop !== 'clientWidth' || object?.type !== 'MemberExpression') return undefined
  const root = field(object, 'object')
  const mid = field(object, 'property')
  const isDocument = root?.type === 'Identifier' && root['name'] === 'document'
  return isDocument && mid?.type === 'Identifier' && mid['name'] === 'documentElement'
    ? 'document.documentElement.clientWidth'
    : undefined
}

const WIDTH_COMPARISONS: ReadonlySet<string> = new Set(['<', '<=', '>', '>='])

/** `window.innerWidth < 768`: the viewport width against a number, on either side. */
function widthComparison(node: Node): string | undefined {
  const operator = node['operator'] as string
  if (!WIDTH_COMPARISONS.has(operator)) return undefined
  const left = field(node, 'left')
  const right = field(node, 'right')
  const leftRead = viewportRead(left)
  if (leftRead !== undefined && right?.type === 'Literal' && typeof right['value'] === 'number') {
    return `${leftRead} ${operator} ${String(right['value'])}`
  }
  const rightRead = viewportRead(right)
  if (rightRead !== undefined && left?.type === 'Literal' && typeof left['value'] === 'number') {
    return `${String(left['value'])} ${operator} ${rightRead}`
  }
  return undefined
}

/** The options a gated rule accepts: `{ profile: 'bridge' }` switches its parts-only forms off. */
export const PROFILE_GATE_SCHEMA = {
  type: 'object',
  properties: { profile: { enum: ['bridge', 'parts'] } },
  additionalProperties: false,
} as const

const isBridge = (options: readonly unknown[]): boolean =>
  (options[0] as { profile?: string } | undefined)?.profile === 'bridge'

/**
 * A class form that runs from `parts` upward. The rule table carries a profile per rule, not per
 * form, so the form reads the rule's `profile` option and stands down for `bridge`, where its fix
 * (`Card`, `Status`, a ladder step) cannot be satisfied. The preset sets the option per profile.
 */
export function partsOnly(
  { pattern, ...base }: ClassForm,
  whole?: (tokens: readonly string[]) => string | undefined,
): AstForm {
  return {
    ...base,
    detect: ({ context, report }) =>
      classStringVisitor((node, text) => {
        if (isBridge(context.options)) return
        const tokens = classTokens(text)
        for (const token of tokens) if (pattern.test(token)) report(node, token)
        const subject = whole?.(tokens)
        if (subject !== undefined) report(node, subject)
      }),
  }
}

const RADIUS = /^rounded(?:-(?!card$|none$|full$)[a-z0-9]+)?$/
const CARD_PADDING = /^p-(?:[3-9]|\d{2,})$/

/**
 * `surface-recipe`, whole-string form: a bordered card rebuilt without a card token, a radius, a
 * bare `border` and a padding step of 3 or more in one class string. A dashed or dotted border,
 * a pill (`rounded-full`) and a lone `p-1`/`p-2` are not a card.
 */
export function borderedCard(tokens: readonly string[]): string | undefined {
  const radius = tokens.find((token) => RADIUS.test(token))
  const padding = tokens.find((token) => CARD_PADDING.test(token))
  if (radius === undefined || padding === undefined || !tokens.includes('border')) return undefined
  if (tokens.some((token) => /^border-(?:dashed|dotted)$/.test(token))) return undefined
  return `${radius} border ${padding}`
}

const nameOf = (node: Node | undefined): string | undefined =>
  node?.type === 'Identifier' || node?.type === 'JSXIdentifier'
    ? (node['name'] as string)
    : undefined

const nodesOf = (node: Node, key: string): Node[] => {
  const value = node[key]
  return Array.isArray(value) ? value.filter(isNode) : []
}

/** `focus.item(i)` as a spread attribute: the handle's name, or undefined for any other spread. */
function itemSpreadHandle(attr: Node): string | undefined {
  if (attr.type !== 'JSXSpreadAttribute') return undefined
  const call = field(attr, 'argument')
  const callee = call?.type === 'CallExpression' ? field(call, 'callee') : undefined
  if (callee?.type !== 'MemberExpression' || callee['computed'] === true) return undefined
  if (nameOf(field(callee, 'property')) !== 'item') return undefined
  return nameOf(field(callee, 'object'))
}

/**
 * `partsOnly` that stands down for the tokens `exempt` matches on a mark drawn through the
 * `useChartFocus` seam: the element, or one of its ancestors, spreads `focus.item(..)` where
 * `focus` is bound from `useChartFocus(..)` in this file. The same route `primitive-bypass` names
 * for a self-drawn mark, so the fill that mark takes is not reported (text, border and ring
 * colours still are). Purely syntactic: a handle bound elsewhere, or a mark in a child component,
 * is not seen and takes a waiver. Unlike `primitive-bypass`'s data-mark forms it does not require
 * the enclosing `focus.target` container: a seam mark's fill is legal wherever the mark is wired.
 */
export function partsOnlyExceptSeamMark(form: ClassForm, exempt: RegExp): AstForm {
  const { pattern, ...base } = form
  return {
    ...base,
    detect: ({ context, report }) => {
      const handles = new Set<string>()
      const stack: boolean[] = []
      let wired = 0
      const seam: Visitor = {
        VariableDeclarator(node) {
          const init = field(node, 'init')
          if (init?.type !== 'CallExpression') return
          if (nameOf(field(init, 'callee')) !== 'useChartFocus') return
          const name = nameOf(field(node, 'id'))
          if (name !== undefined) handles.add(name)
        },
        JSXElement(node) {
          const open = field(node, 'openingElement')
          const item = nodesOf(open ?? node, 'attributes').some((attr) => {
            const handle = itemSpreadHandle(attr)
            return handle !== undefined && handles.has(handle)
          })
          stack.push(item)
          if (item) wired += 1
        },
        'JSXElement:exit'() {
          if (stack.pop()) wired -= 1
        },
      }
      const classes = classStringVisitor((node, text) => {
        if (isBridge(context.options)) return
        for (const token of classTokens(text)) {
          if (pattern.test(token) && !(wired > 0 && exempt.test(token))) report(node, token)
        }
      })
      return mergeVisitors([seam, classes])
    },
  }
}
