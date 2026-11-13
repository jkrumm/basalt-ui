/**
 * The two detectors the class family cannot express as one pattern: the JS media-query form of
 * `viewport-keyed` (an AST form) and the profile gate for `tw-off-law` forms that exist only from
 * `parts` upward (guardrails section 4, row 6: "(b, c, h) parts+; rest bridge+").
 */
import type { FormContext, Node, Visitor } from '../../factory'
import { classStringVisitor, classTokens } from '../../factory'
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
 * `viewport-keyed`, JS form: a media query whose literal text names a `width`. Reduced-motion,
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
  }
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
export function partsOnly({ pattern, ...base }: ClassForm): AstForm {
  return {
    ...base,
    detect: ({ context, report }) =>
      classStringVisitor((node, text) => {
        if (isBridge(context.options)) return
        for (const token of classTokens(text)) if (pattern.test(token)) report(node, token)
      }),
  }
}
