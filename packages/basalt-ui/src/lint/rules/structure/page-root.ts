/**
 * `basalt/page-root`: one form, `not-page`. A page component returns `Page` or `SplitPage` as its
 * root, so the gutter, the top inset and the band's claims have one owner and no page sets its own.
 * One-shot builders wrote a bare `div` with its own `gap` or `p-4`, a fragment, or a `@container`
 * wrapper around the page, from the same skill text; each drew a different page top (owner review 1).
 *
 * A component is a page when it renders a `PageBar` anywhere in its body, or when it is the
 * `component` of a route (`createFileRoute(...)({ component })`, `createRoute`, the lazy forms),
 * named or inline. The check is file-local and reads every value the component returns, through
 * `?:` and `&&`:
 *
 * - a host element (`<div>`, `<main>`, `<section>`) or a fragment reports;
 * - `Page` and `SplitPage` pass;
 * - any other component passes: a route that delegates to a page defined in another file is checked
 *   in that file, and a wrapper the rule cannot see into is not a page root it can judge.
 *
 * The escape is a line waiver with a reason on the reported root; file-level waivers are refused by
 * `waiver-needs-reason`.
 */
import { isTestFile } from '../../factory'
import type { Node, Visitor } from '../../factory'
import type { AstForm } from '../../rule-table'
import { defineRules } from '../../rule-table'

const ROUTE_FACTORIES: ReadonlySet<string> = new Set([
  'createFileRoute',
  'createLazyFileRoute',
  'createRoute',
  'createLazyRoute',
])
const FRAGMENTS: ReadonlySet<string> = new Set(['Fragment'])

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && typeof (value as Node).type === 'string'

const child = (node: Node | undefined, key: string): Node | undefined => {
  const value = node?.[key]
  return isNode(value) ? value : undefined
}

const children = (node: Node, key: string): Node[] => {
  const value = node[key]
  return Array.isArray(value) ? value.filter(isNode) : []
}

const nameOf = (node: Node | undefined): string | undefined =>
  node?.type === 'Identifier' || node?.type === 'JSXIdentifier'
    ? (node['name'] as string)
    : undefined

const isPascal = (name: string | undefined): name is string =>
  name !== undefined && /^[A-Z]/.test(name)

/** The wrappers a component is declared through: `memo(() => ...)`, `React.forwardRef(...)`. */
const WRAPPERS: ReadonlySet<string> = new Set(['memo', 'forwardRef'])

const isWrapperCall = (node: Node | undefined): boolean => {
  if (node?.type !== 'CallExpression') return false
  const callee = child(node, 'callee')
  const name =
    callee?.type === 'MemberExpression' ? nameOf(child(callee, 'property')) : nameOf(callee)
  return WRAPPERS.has(name ?? '')
}

/**
 * The name a function is declared under: its own id, the variable it is assigned to (through a
 * `memo` or `forwardRef` call), or `default` for an anonymous default export.
 */
function declaredName(node: Node): string | undefined {
  if (node.type === 'FunctionDeclaration') {
    const own = nameOf(child(node, 'id'))
    if (own !== undefined) return own
  }
  let holder = node['parent'] as Node | undefined
  if (isWrapperCall(holder)) holder = holder?.['parent'] as Node | undefined
  if (holder?.type === 'VariableDeclarator') return nameOf(child(holder, 'id'))
  if (holder?.type === 'ExportDefaultDeclaration') return 'default'
  return undefined
}

const isComponentName = (name: string | undefined): name is string =>
  name === 'default' || isPascal(name)

const isFunction = (node: Node | undefined): node is Node =>
  node?.type === 'ArrowFunctionExpression' ||
  node?.type === 'FunctionExpression' ||
  node?.type === 'FunctionDeclaration'

/** The JSX tag: `Page`, `div`, or the property of a member tag (`React.Fragment` is `Fragment`). */
const tagOf = (opening: Node | undefined): string | undefined => {
  const name = child(opening, 'name')
  if (name?.type === 'JSXMemberExpression') return nameOf(child(name, 'property'))
  return nameOf(name)
}

/** `createFileRoute('/x')({...})` and `createRoute({...})`: the route options object, if any. */
const routeOptions = (call: Node): Node | undefined => {
  const callee = child(call, 'callee')
  const factory = callee?.type === 'CallExpression' ? child(callee, 'callee') : callee
  if (!ROUTE_FACTORIES.has(nameOf(factory) ?? '')) return undefined
  const options = children(call, 'arguments')[0]
  return options?.type === 'ObjectExpression' ? options : undefined
}

/** Depth-first walk of a subtree, skipping the `parent` back-reference. */
function someDescendant(root: Node, test: (node: Node) => boolean): boolean {
  const stack: Node[] = [root]
  while (stack.length > 0) {
    const node = stack.pop() as Node
    if (test(node)) return true
    for (const [key, value] of Object.entries(node)) {
      if (key === 'parent' || key === 'loc' || key === 'range') continue
      if (Array.isArray(value)) stack.push(...value.filter(isNode))
      else if (isNode(value)) stack.push(value)
    }
  }
  return false
}

const rendersPageBar = (fn: Node): boolean =>
  someDescendant(fn, (node) => node.type === 'JSXOpeningElement' && tagOf(node) === 'PageBar')

/** The roots a returned value can render: both arms of `?:`, the right of `&&` and `??`. */
function rootsOf(value: Node | undefined): Node[] {
  if (value === undefined) return []
  if (value.type === 'ConditionalExpression') {
    return [...rootsOf(child(value, 'consequent')), ...rootsOf(child(value, 'alternate'))]
  }
  if (value.type === 'LogicalExpression') return rootsOf(child(value, 'right'))
  if (value.type === 'JSXElement' || value.type === 'JSXFragment') return [value]
  return []
}

/** The reported node and its subject when the root is not a page root, else `undefined`. */
function offence(root: Node): { node: Node; subject: string } | undefined {
  if (root.type === 'JSXFragment') {
    return { node: child(root, 'openingFragment') ?? root, subject: '<>' }
  }
  const opening = child(root, 'openingElement')
  const tag = tagOf(opening)
  if (tag === undefined || opening === undefined) return undefined
  if (FRAGMENTS.has(tag)) return { node: opening, subject: `<${tag}>` }
  if (isPascal(tag)) return undefined
  return { node: opening, subject: `<${tag}>` }
}

type Component = { node: Node; name: string | undefined; returns: Node[] }

const notPage: AstForm = {
  id: 'not-page',
  fix: 'Return <Page> (or <SplitPage>) as the root of the page and drop the wrapper: Page owns the gutter, the top inset and the PageBar claim, so no page sets its own padding or gap',
  next: 'A wrapper the page needs (a provider, a form) goes inside Page; a screen that is not a page renders no PageBar and is no route component',
  fixture: 'page-root/not-page.tsx',
  detect: ({ context, report }): Visitor => {
    // Test scaffolding (a router harness, a fixture page) is not a page, as in the sibling rules.
    if (isTestFile(context)) return {}
    const components = new Map<Node, Component>()
    const stack: Node[] = []
    const routeNames = new Set<string>()
    const routeFns = new Set<Node>()

    const enter = (node: Node): void => {
      stack.push(node)
      const parent = node['parent'] as Node | undefined
      const name = declaredName(node)
      const inlineRoute =
        parent?.type === 'Property' && nameOf(child(parent, 'key')) === 'component'
      if (!isComponentName(name) && !inlineRoute) return
      const body = child(node, 'body')
      const returns = body !== undefined && body.type !== 'BlockStatement' ? [body] : []
      components.set(node, { node, name, returns })
    }
    const exit = (): void => {
      stack.pop()
    }

    return {
      FunctionDeclaration: enter,
      'FunctionDeclaration:exit': exit,
      FunctionExpression: enter,
      'FunctionExpression:exit': exit,
      ArrowFunctionExpression: enter,
      'ArrowFunctionExpression:exit': exit,
      ReturnStatement(node) {
        const owner = stack.at(-1)
        const argument = child(node, 'argument')
        if (owner === undefined || argument === undefined) return
        components.get(owner)?.returns.push(argument)
      },
      CallExpression(node) {
        const options = routeOptions(node)
        if (options === undefined) return
        for (const property of children(options, 'properties')) {
          if (property.type !== 'Property' || nameOf(child(property, 'key')) !== 'component') {
            continue
          }
          const value = child(property, 'value')
          const name = nameOf(value)
          if (name !== undefined) routeNames.add(name)
          else if (isFunction(value)) routeFns.add(value)
        }
      },
      'Program:exit'() {
        for (const component of components.values()) {
          const routed =
            routeFns.has(component.node) ||
            (component.name !== undefined && routeNames.has(component.name))
          if (!routed && !rendersPageBar(component.node)) continue
          for (const value of component.returns) {
            for (const root of rootsOf(value)) {
              const hit = offence(root)
              if (hit !== undefined) report(hit.node, hit.subject)
            }
          }
        }
      },
    }
  },
}

export const pageRootRules = defineRules({
  'page-root': {
    family: 'structure',
    profiles: ['app'],
    defect:
      'owner review 1: 24 of 44 expression scenarios with a PageBar rendered a bare div root with their own gap or padding, so gutter and top inset differed page by page',
    forms: [notPage],
  },
})
