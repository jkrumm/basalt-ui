/**
 * `basalt/motion-literal` (Issue 2529): a duration, delay, spring or easing typed as a literal in
 * app code. The motion scale in `basalt-ui/tokens` (MOTION_DURATION, MOTION_EASE_*, MOTION_SPRING,
 * staggerDelay) and the presets in `basalt-ui/motion` decide every timing; a literal beside them
 * drifts silently when the scale moves. Two forms: a motion option object (a `transition` prop or
 * key, or the options of `animate(...)`) and a style-object timing string (`transition`,
 * `animation` and their longhands, camelCase or kebab). A `var(--basalt-*)` reference passes: the
 * stylesheet owns its times. Zero passes (`duration: 0`, `'0s'`): it is the reduced-motion end state.
 *
 * Test files (`*.test.*`, `*.spec.*`) are exempt: a spec drives the timing it asserts.
 *
 * Known limit: a timing that reaches an option through a variable (`const d = 0.3`, then
 * `duration: d`) is not read; only the option's own literal is.
 */
import type { AstForm } from '../../rule-table'
import { defineRules } from '../../rule-table'
import type { Node } from '../../factory'
import { isTestFile } from '../../factory'

type Report = (node: Node, subject: string) => void

/** Option keys a tween or a spring reads as a number: a duration, a delay, the spring's terms. */
const TIMING_NUMBER_KEYS: ReadonlySet<string> = new Set([
  'duration',
  'delay',
  'visualDuration',
  'stiffness',
  'damping',
  'mass',
  'bounce',
  'restDelta',
  'restSpeed',
])

/** Style-object keys that carry a time or an easing, in camelCase; a kebab or quoted key folds to it. */
const STYLE_TIMING_KEYS: ReadonlySet<string> = new Set([
  'transition',
  'transitionDuration',
  'transitionDelay',
  'transitionTimingFunction',
  'animation',
  'animationDuration',
  'animationDelay',
  'animationTimingFunction',
])

/** A CSS time such as `300ms`, `.3s` or `1.5s`; the zero check is the caller's. */
const CSS_TIME = /(?<![\w.])-?(?:\d+\.\d+|\.\d+|\d+)m?s(?![\w-])/g
const CSS_EASE_FUNCTION = /(?<![\w-])(?:cubic-bezier|steps)\(/
const CSS_EASE_KEYWORD = /(?<![\w-])(?:ease|ease-in|ease-out|ease-in-out|linear)(?![\w-])/

const child = (node: Node, key: string): Node | undefined => node[key] as Node | undefined

const childrenOf = (node: Node, key: string): Node[] =>
  ((node[key] as (Node | null)[] | undefined) ?? []).filter((item): item is Node => item !== null)

const identifierName = (node: Node | undefined): string | undefined =>
  node?.type === 'Identifier' ? (node['name'] as string) : undefined

const keyName = (property: Node): string | undefined => {
  const key = child(property, 'key')
  if (!key || property['computed']) return undefined
  if (key.type === 'Identifier') return key['name'] as string
  return typeof key['value'] === 'string' ? key['value'] : undefined
}

const camelCase = (name: string): string =>
  name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())

/** A non-zero number literal, signed or not, as the text the message quotes. */
function numberText(node: Node | undefined): string | undefined {
  const negative = node?.type === 'UnaryExpression' && node['operator'] === '-'
  const literal = negative ? child(node as Node, 'argument') : node
  if (literal?.type !== 'Literal') return undefined
  const value = literal['value']
  if (typeof value !== 'number' || value === 0) return undefined
  return `${negative ? '-' : ''}${value}`
}

/** An easing that is a bezier array of numbers, or a named easing string. */
function easeText(node: Node): string | undefined {
  if (node.type === 'Literal') {
    return typeof node['value'] === 'string' ? JSON.stringify(node['value']) : undefined
  }
  if (node.type !== 'ArrayExpression') return undefined
  const items = childrenOf(node, 'elements')
  const numeric =
    items.length > 0 &&
    items.every((item) => item.type === 'Literal' && typeof item['value'] === 'number')
  return numeric ? `[${items.map((item) => String(item['value'])).join(', ')}]` : undefined
}

function timingOptionsIn(options: Node, report: Report): void {
  for (const property of childrenOf(options, 'properties')) {
    const name = keyName(property)
    const value = child(property, 'value')
    if (name === undefined || !value) continue
    if (name === 'ease') {
      const text = easeText(value)
      if (text !== undefined) report(value, `ease: ${text}`)
      continue
    }
    const text = TIMING_NUMBER_KEYS.has(name) ? numberText(value) : undefined
    if (text !== undefined) report(value, `${name}: ${text}`)
  }
}

/** The text of a string literal or of a template, holes as ${}; undefined for any other node. */
function stringText(node: Node | undefined): string | undefined {
  if (node?.type === 'Literal') {
    return typeof node['value'] === 'string' ? node['value'] : undefined
  }
  if (node?.type !== 'TemplateLiteral') return undefined
  return childrenOf(node, 'quasis')
    .map((quasi) => {
      const value = quasi['value'] as { cooked?: string | null; raw: string }
      return value.cooked ?? value.raw
    })
    .join('${}')
}

/** The first timing in a style string that is not zero: a time, a bezier or steps, an easing keyword. */
function timingIn(text: string): string | undefined {
  for (const time of text.matchAll(CSS_TIME)) {
    if (Number.parseFloat(time[0]) !== 0) return time[0]
  }
  const fn = CSS_EASE_FUNCTION.exec(text)
  if (fn) return `${fn[0].slice(0, -1)}()`
  return CSS_EASE_KEYWORD.exec(text)?.[0]
}

const FIX =
  'Time it from basalt-ui/tokens (MOTION_DURATION, MOTION_EASE_*, MOTION_SPRING, staggerDelay), a preset from basalt-ui/motion (useMotionPreset), or var(--basalt-dur-*) / var(--basalt-ease-*) in CSS'
const NEXT =
  'A new step in the motion scale in tokens/motion.ts when no step fits; a reasoned per-line waiver only for a timing the scale cannot express'

export const objectLiteralForm: AstForm = {
  id: 'object-literal',
  fix: FIX,
  next: NEXT,
  fixture: 'motion-literal/object-literal.tsx',
  detect: ({ context, report }) => {
    if (isTestFile(context)) return {}
    return {
      JSXAttribute(node) {
        if (child(node, 'name')?.['name'] !== 'transition') return
        const value = child(node, 'value')
        const expression =
          value?.type === 'JSXExpressionContainer' ? child(value, 'expression') : undefined
        if (expression?.type === 'ObjectExpression') timingOptionsIn(expression, report)
      },
      Property(node) {
        if (keyName(node) !== 'transition') return
        const value = child(node, 'value')
        if (value?.type === 'ObjectExpression') timingOptionsIn(value, report)
      },
      CallExpression(node) {
        if (identifierName(child(node, 'callee')) !== 'animate') return
        for (const argument of childrenOf(node, 'arguments')) {
          if (argument.type === 'ObjectExpression') timingOptionsIn(argument, report)
        }
      },
    }
  },
}

export const styleLiteralForm: AstForm = {
  id: 'css-literal',
  fix: FIX,
  next: NEXT,
  fixture: 'motion-literal/css-literal.tsx',
  detect: ({ context, report }) => {
    if (isTestFile(context)) return {}
    return {
      Property(node) {
        const name = keyName(node)
        if (name === undefined || !STYLE_TIMING_KEYS.has(camelCase(name))) return
        const value = child(node, 'value')
        const text = stringText(value)
        const found = text === undefined ? undefined : timingIn(text)
        if (found !== undefined && value) report(value, found)
      },
    }
  },
}

export const motionLiteralRules = defineRules({
  'motion-literal': {
    family: 'structure',
    profiles: ['bridge', 'parts', 'app'],
    defect:
      'Issue 2529: durations and easings were typed per component, so a change to the motion scale reached some of the app and not the rest',
    forms: [objectLiteralForm, styleLiteralForm],
  },
})
