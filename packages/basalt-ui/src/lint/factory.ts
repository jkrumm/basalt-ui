/**
 * `classPatternRule` and the rule builder: one factory turns a table entry into an oxlint JS
 * plugin rule that also runs under ESLint (guardrails sections 4, 10, 13). Class forms are tested
 * against every class token the factory finds; AST forms bring their own visitor and report
 * through the same message table, so every diagnostic names its fix and the next rung.
 *
 * Shapes a class string is read from (guardrails section 4; the template form is narrowed to class
 * contexts by `spikes/allow-padding.md`):
 *
 * - class contexts: a `className`, `class` or `*ClassName` JSX attribute, and the arguments of
 *   `cn`, `clsx`, `cx` and `cva` (base, variant values, `compoundVariants[].class`), through
 *   ternaries, `&&`, `||`, `??`, arrays and clsx-style object keys; template literals only here
 * - `[...].join(' ')`, every element
 * - object-map values and string arrays outside a class context, when the string is class-shaped
 *
 * A template literal is read with each `${...}` replaced by {@link TEMPLATE_HOLE}, so
 * `bg-${tone}-600` reaches a pattern as the token `bg-${}-600`.
 */
import type { Form, RuleEntry, RuleTable } from './rule-table'
import { isClassForm, isEnabled, PLUGIN_NAME } from './rule-table'

/** An ESTree node as oxlint and ESLint hand it over; fields are read structurally. */
export type Node = { readonly type: string; readonly [key: string]: unknown }

export type Visitor = Readonly<Record<string, (node: Node) => void>>

export type ReportDescriptor = {
  node: Node
  messageId: string
  data?: Record<string, string>
}

export type RuleContext = {
  readonly options: readonly unknown[]
  report(descriptor: ReportDescriptor): void
}

/** What an AST form's `detect` receives: `report` uses that form's message. */
export type FormContext = {
  readonly context: RuleContext
  /** `subject` is the offending text the message quotes, e.g. the call or token. */
  report(node: Node, subject: string): void
}

export type LintRule = {
  readonly meta: {
    readonly type: 'problem'
    readonly docs: { readonly description: string }
    readonly messages: Readonly<Record<string, string>>
    readonly schema: readonly unknown[]
  }
  create(context: RuleContext): Visitor
}

export type LintPlugin = {
  readonly meta: { readonly name: string }
  readonly rules: Readonly<Record<string, LintRule>>
}

export const TEMPLATE_HOLE = '${}'

/** Callees whose arguments are class strings. `twMerge` is banned by `import-boundary`. */
export const CLASS_CALLEES: ReadonlySet<string> = new Set(['cn', 'clsx', 'cx', 'cva'])

const CLASS_ATTRIBUTE = /^(?:class|className|[a-z][A-Za-z0-9]*ClassName)$/
const CLASS_TOKEN = /^!?-?[a-z0-9@[(*_][^\s"'`<>{};]*$/

/** Every whitespace token looks like a utility; a URL or prose sentence does not. */
export function isClassShaped(text: string): boolean {
  const tokens = classTokens(text)
  if (tokens.length === 0 || text.includes('://')) return false
  return tokens.every((token) => CLASS_TOKEN.test(token))
}

export const classTokens = (text: string): string[] => text.split(/\s+/).filter(Boolean)

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && typeof (value as Node).type === 'string'

const child = (node: Node, key: string): Node | undefined => {
  const value = node[key]
  return isNode(value) ? value : undefined
}

const children = (node: Node, key: string): Node[] => {
  const value = node[key]
  return Array.isArray(value) ? value.filter(isNode) : []
}

const stringValue = (node: Node | undefined): string | undefined =>
  node?.type === 'Literal' && typeof node['value'] === 'string' ? node['value'] : undefined

const identifierName = (node: Node | undefined): string | undefined =>
  node?.type === 'Identifier' || node?.type === 'JSXIdentifier'
    ? (node['name'] as string)
    : undefined

const propertyKey = (property: Node): string | undefined => {
  if (property['computed'] === true) return undefined
  const key = child(property, 'key')
  return identifierName(key) ?? stringValue(key)
}

function templateText(node: Node): string {
  return children(node, 'quasis')
    .map((quasi) => {
      const value = quasi['value'] as { cooked?: string | null; raw: string }
      return value.cooked ?? value.raw
    })
    .join(TEMPLATE_HOLE)
}

const isJoinWithSpace = (call: Node): boolean => {
  const callee = child(call, 'callee')
  if (callee?.type !== 'MemberExpression' || callee['computed'] === true) return false
  if (identifierName(child(callee, 'property')) !== 'join') return false
  if (child(callee, 'object')?.type !== 'ArrayExpression') return false
  const [separator] = children(call, 'arguments')
  return stringValue(separator) === ' '
}

/**
 * The class-string walker: calls `onString` once per string node in a class shape. Visitors run
 * parent first, so a context claims its strings and containers before the generic object-map
 * and array visitors see them; nothing is reported twice.
 */
export function classStringVisitor(onString: (node: Node, text: string) => void): Visitor {
  const scanned = new WeakSet<Node>()
  const claimed = new WeakSet<Node>()

  const scan = (node: Node, text: string): void => {
    if (scanned.has(node)) return
    scanned.add(node)
    onString(node, text)
  }

  const collect = (node: Node | undefined): void => {
    if (!node) return
    switch (node.type) {
      case 'Literal': {
        const text = stringValue(node)
        if (text !== undefined) scan(node, text)
        return
      }
      case 'TemplateLiteral':
        scan(node, templateText(node))
        return
      case 'JSXExpressionContainer':
        collect(child(node, 'expression'))
        return
      case 'ConditionalExpression':
        collect(child(node, 'consequent'))
        collect(child(node, 'alternate'))
        return
      case 'LogicalExpression':
        if (node['operator'] !== '&&') collect(child(node, 'left'))
        collect(child(node, 'right'))
        return
      case 'SpreadElement':
        collect(child(node, 'argument'))
        return
      case 'ArrayExpression':
        claimed.add(node)
        for (const element of children(node, 'elements')) collect(element)
        return
      case 'ObjectExpression':
        // clsx-style `{ 'p-2': isOn }`: the keys are the classes, the values are conditions.
        claimed.add(node)
        for (const property of children(node, 'properties')) {
          const key = child(property, 'key')
          const name = propertyKey(property)
          if (key && name !== undefined) scan(key, name)
        }
        return
      default:
        // Nested `cn()` and `.join(' ')` calls are visited on their own; anything else is opaque.
        return
    }
  }

  const collectCvaConfig = (config: Node): void => {
    claimed.add(config)
    for (const property of children(config, 'properties')) {
      const value = child(property, 'value')
      if (!value) continue
      switch (propertyKey(property)) {
        case 'base':
          collect(value)
          break
        case 'variants':
          claimed.add(value)
          for (const group of children(value, 'properties')) {
            const options = child(group, 'value')
            if (options?.type !== 'ObjectExpression') continue
            claimed.add(options)
            for (const option of children(options, 'properties')) collect(child(option, 'value'))
          }
          break
        case 'compoundVariants':
          claimed.add(value)
          for (const compound of children(value, 'elements')) {
            claimed.add(compound)
            for (const field of children(compound, 'properties')) {
              const fieldValue = child(field, 'value')
              const key = propertyKey(field)
              if (key === 'class' || key === 'className') collect(fieldValue)
              else if (fieldValue) claimed.add(fieldValue)
            }
          }
          break
        default:
          // `defaultVariants` and anything else name variant options, never classes.
          claimed.add(value)
      }
    }
  }

  return {
    JSXAttribute(node) {
      const name = identifierName(child(node, 'name'))
      if (name !== undefined && CLASS_ATTRIBUTE.test(name)) collect(child(node, 'value'))
    },
    CallExpression(node) {
      const callee = identifierName(child(node, 'callee'))
      const args = children(node, 'arguments')
      if (callee === 'cva') {
        const [first, second] = args
        if (first?.type === 'ObjectExpression') collectCvaConfig(first)
        else {
          collect(first)
          if (second?.type === 'ObjectExpression') collectCvaConfig(second)
        }
        return
      }
      if (callee !== undefined && CLASS_CALLEES.has(callee)) {
        for (const arg of args) collect(arg)
        return
      }
      if (isJoinWithSpace(node)) collect(child(child(node, 'callee') as Node, 'object'))
    },
    ObjectExpression(node) {
      if (claimed.has(node)) return
      for (const property of children(node, 'properties')) {
        const value = child(property, 'value')
        const text = stringValue(value)
        if (value && text !== undefined && isClassShaped(text)) scan(value, text)
      }
    },
    ArrayExpression(node) {
      if (claimed.has(node)) return
      const strings = children(node, 'elements').filter((el) => stringValue(el) !== undefined)
      if (strings.length === 0) return
      if (!strings.every((el) => isClassShaped(stringValue(el) as string))) return
      for (const element of strings) scan(element, stringValue(element) as string)
    },
  }
}

/** Run several visitors as one: handlers for the same node type run in order. */
export function mergeVisitors(visitors: readonly Visitor[]): Visitor {
  const merged: Record<string, ((node: Node) => void)[]> = {}
  for (const visitor of visitors) {
    for (const [type, handler] of Object.entries(visitor)) (merged[type] ??= []).push(handler)
  }
  return Object.fromEntries(
    Object.entries(merged).map(([type, handlers]) => [
      type,
      (node: Node) => {
        for (const handler of handlers) handler(node)
      },
    ]),
  )
}

const sentence = (text: string): string => text.trim().replace(/[.\s]+$/, '')

/** The diagnostic for a form: the offending text, the fix, then the next rung. */
export const formMessage = (form: Form): string =>
  `\`{{subject}}\`: ${sentence(form.fix)}. Next: ${sentence(form.next)}.`

function ruleMeta(description: string, forms: readonly Form[], schema: readonly unknown[]) {
  return {
    type: 'problem' as const,
    docs: { description },
    messages: Object.fromEntries(forms.map((form) => [form.id, formMessage(form)])),
    schema,
  }
}

function createVisitor(context: RuleContext, forms: readonly Form[]): Visitor {
  const live = forms.filter(isEnabled)
  const classForms = live.filter(isClassForm)
  const visitors: Visitor[] = []
  if (classForms.length > 0) {
    visitors.push(
      classStringVisitor((node, text) => {
        for (const token of classTokens(text)) {
          for (const form of classForms) {
            if (form.pattern.test(token)) {
              context.report({ node, messageId: form.id, data: { subject: token } })
            }
          }
        }
      }),
    )
  }
  for (const form of live) {
    if (isClassForm(form)) continue
    visitors.push(
      form.detect({
        context,
        report: (node, subject) => context.report({ node, messageId: form.id, data: { subject } }),
      }),
    )
  }
  return mergeVisitors(visitors)
}

/** A standalone rule over class strings; `buildRule` composes the same walker per table entry. */
export function classPatternRule(...forms: readonly Form[]): LintRule {
  return {
    meta: ruleMeta(`Class forms: ${forms.map((form) => form.id).join(', ')}`, forms, []),
    create: (context) => createVisitor(context, forms),
  }
}

/** One table entry as one rule: its class forms through the factory, its AST forms as written. */
export function buildRule(id: string, entry: RuleEntry): LintRule {
  return {
    meta: ruleMeta(`${PLUGIN_NAME}/${id}: ${entry.defect}`, entry.forms, entry.schema ?? []),
    create: (context) => createVisitor(context, entry.forms),
  }
}

const PLUGIN_TABLES = new WeakMap<LintPlugin, RuleTable>()

/** The oxlint JS plugin (also an ESLint plugin) for a merged table. */
export function createPlugin(table: RuleTable): LintPlugin {
  const plugin: LintPlugin = {
    meta: { name: PLUGIN_NAME },
    rules: Object.fromEntries(
      Object.entries(table).map(([id, entry]) => [id, buildRule(id, entry)]),
    ),
  }
  PLUGIN_TABLES.set(plugin, table)
  return plugin
}

/**
 * The merged table a plugin was built from: how package tooling (preset generator, coverage,
 * budgets) reads ids, profiles and forms while the `./lint` subpath exports the plugin alone.
 */
export function tableOf(plugin: LintPlugin): RuleTable {
  const table = PLUGIN_TABLES.get(plugin)
  if (!table) throw new Error('tableOf: not a plugin built by createPlugin')
  return table
}
