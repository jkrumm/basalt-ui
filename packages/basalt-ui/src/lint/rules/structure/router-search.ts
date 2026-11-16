/**
 * `basalt/router-search` (guardrails section 4, row 11): three forms.
 *
 * - `literal-search`: `search=` on a `Link` or a `Navigate` (TanStack's redirect component) whose
 *   value is an object literal, or a function returning one; the same value as the `search` of
 *   `navigate({ ... })` (`navigate`, `x.navigate`, so `router.navigate` and a `useNavigate()` result bound to that name) or of
 *   `redirect({ ... })` (`throw redirect(...)` in `beforeLoad`; `redirect` or `x.redirect`). A literal pins a default and hits the router traps reproduced on Router 1.170.46;
 *   the link of a store-backed route is `field.link()`.
 *   A `?` in the literal text of `to` (a `Link`/`Navigate` attribute, or `navigate({ to })` /
 *   `redirect({ to })`; string or template) and a `history.pushState` / `replaceState` (also
 *   `window.history.`, `globalThis.history.`) whose URL argument holds a `?` are the same form: the query is
 *   written by hand. A URL built by concatenation or held in a variable is not read.
 * - `loader-deps-search`: `loaderDeps: ({ search }) => search`, `=> ({ search })`,
 *   `=> ({ ...search })` and `(opts) => ({ ...opts.search })`, and the rest of a destructured search returned or spread
 *   (`({ search: { page, ...rest } }) => ({ page, ...rest })`). Returning the whole search re-runs the loader on every param (argo
 *   `strength-tracker.tsx:53`); the deps are the keys it reads.
 * - `validate-search-pure`: an inline `validateSearch` that reads `window`, `document`,
 *   `localStorage`, `sessionStorage`, `location`, `navigator`, `performance` (`performance.now()`), `Math.random`, `crypto.randomUUID()` / `crypto.getRandomValues()` (also on `globalThis` or `window`) or the clock (`new Date()` with no argument,
 *   `Date.now()`, `Date()`), through a Zod `.default(() => new Date())` too. `new Date(input)`
 *   and `Date.parse` are pure and pass. A validator named by reference is not read: the rule is
 *   file-local. A name bound in the file (a parameter, a variable, a function or an import above
 *   the read, such as `({ location }) =>` or `const location = useLocation()`) is not the global
 *   and passes; `globalThis.location` and a binding made by a hoisted `var` in a nested block are
 *   not read.
 *
 * Known limits: `Navigate` or `Link` imported under another name, a `useNavigate()` result bound
 * to another name (`const go = useNavigate()`), a `search` object built in a variable before the
 * call, and a `loaderDeps` that spreads a copy of search (`const s = search; ({ ...s })`) are not read: the rule is file-local and names, not
 * flow. A `search` key of a `navigate` argument that is itself a variable passes.
 *
 * The `<ViewTransition>` around `Outlet` form of the original row was removed on 2026-11-11 (zero
 * consumer hits, allow-padding S2); the router's `defaultViewTransition` owns it.
 */
import type { Node, Visitor } from '../../factory'
import type { AstForm } from '../../rule-table'
import { defineRules } from '../../rule-table'

const IMPURE_GLOBALS: ReadonlySet<string> = new Set([
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'location',
  'navigator',
  'performance',
])

/** The names a binding pattern declares: `a`, `{ a, b: c, ...d }`, `[a, , b]`, `a = 1`. */
function patternNames(pattern: Node | undefined, into: Set<string>): void {
  if (!pattern) return
  if (pattern.type === 'Identifier') into.add(pattern['name'] as string)
  else if (pattern.type === 'ObjectPattern') {
    for (const property of children(pattern, 'properties')) {
      patternNames(property.type === 'Property' ? child(property, 'value') : property, into)
    }
  } else if (pattern.type === 'ArrayPattern') {
    for (const element of children(pattern, 'elements')) patternNames(element, into)
  } else if (pattern.type === 'AssignmentPattern') patternNames(child(pattern, 'left'), into)
  else if (pattern.type === 'RestElement') patternNames(child(pattern, 'argument'), into)
}

/** True when `name` is declared by a parameter, a variable, a function or an import above `node`. */
function isLocallyBound(node: Node, name: string): boolean {
  for (let up = node['parent'] as Node | undefined; up; up = up['parent'] as Node | undefined) {
    const names = new Set<string>()
    if (up.type === 'ArrowFunctionExpression' || up.type === 'FunctionExpression') {
      for (const param of children(up, 'params')) patternNames(param, names)
    } else if (up.type === 'CatchClause') patternNames(child(up, 'param'), names)
    else if (up.type === 'BlockStatement' || up.type === 'Program') {
      for (const statement of children(up, 'body')) {
        const declaration =
          (statement.type === 'ExportNamedDeclaration'
            ? child(statement, 'declaration')
            : undefined) ?? statement
        if (declaration.type === 'VariableDeclaration') {
          for (const d of children(declaration, 'declarations')) patternNames(child(d, 'id'), names)
        } else if (declaration.type === 'FunctionDeclaration') {
          patternNames(child(declaration, 'id'), names)
        } else if (declaration.type === 'ImportDeclaration') {
          for (const spec of children(declaration, 'specifiers')) {
            patternNames(child(spec, 'local'), names)
          }
        }
      }
    }
    if (names.has(name)) return true
  }
  return false
}

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

const nameOf = (node: Node | undefined): string | undefined =>
  node?.type === 'Identifier' || node?.type === 'JSXIdentifier'
    ? (node['name'] as string)
    : undefined

const stringValue = (node: Node | undefined): string | undefined =>
  node?.type === 'Literal' && typeof node['value'] === 'string' ? node['value'] : undefined

const isFunction = (node: Node | undefined): node is Node =>
  node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression'

/** An object property's static key. */
const keyOf = (property: Node): string | undefined => {
  if (property['computed'] === true) return undefined
  const key = child(property, 'key')
  return nameOf(key) ?? stringValue(key)
}

const NESTED_FUNCTIONS: ReadonlySet<string> = new Set([
  'ArrowFunctionExpression',
  'FunctionExpression',
  'FunctionDeclaration',
])

/** The expression a function returns: an arrow's expression body, or its returns. */
function returned(fn: Node): Node[] {
  const body = child(fn, 'body')
  if (body?.type !== 'BlockStatement') return body ? [body] : []
  const found: Node[] = []
  const stack: Node[] = [...children(body, 'body')]
  while (stack.length > 0) {
    const node = stack.pop() as Node
    if (node.type === 'ReturnStatement') {
      const argument = child(node, 'argument')
      if (argument) found.push(argument)
    } else if (!NESTED_FUNCTIONS.has(node.type)) {
      for (const [key, value] of Object.entries(node)) {
        if (key === 'parent' || key === 'loc' || key === 'range') continue
        if (Array.isArray(value)) stack.push(...value.filter(isNode))
        else if (isNode(value)) stack.push(value)
      }
    }
  }
  return found
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

const isLiteralSearch = (expression: Node): boolean =>
  expression.type === 'ObjectExpression' ||
  (isFunction(expression) && returned(expression).some((r) => r.type === 'ObjectExpression'))

/** `navigate(...)` / `redirect(...)`, bare or `x.`-qualified, not `x['navigate']`; the callee name. */
const navigationCallee = (node: Node): 'navigate' | 'redirect' | undefined => {
  const callee = child(node, 'callee')
  const name =
    callee?.type === 'MemberExpression'
      ? callee['computed'] === true
        ? undefined
        : nameOf(child(callee, 'property'))
      : nameOf(callee)
  return name === 'navigate' || name === 'redirect' ? name : undefined
}

/** A string literal or a template literal whose fixed text holds a `?`: a query written into a URL. */
const holdsQuery = (node: Node | undefined): boolean => {
  if (!node) return false
  if (node.type === 'TemplateLiteral') {
    return children(node, 'quasis').some((quasi) => {
      const cooked = (quasi['value'] as { cooked?: string | null } | undefined)?.cooked
      return typeof cooked === 'string' && cooked.includes('?')
    })
  }
  return stringValue(node)?.includes('?') === true
}

/** `history.x(...)`, `window.history.x(...)`, `globalThis.history.x(...)`, `x` named by the caller. */
const isHistoryMethod = (node: Node, methods: ReadonlySet<string>): boolean => {
  const callee = child(node, 'callee')
  if (callee?.type !== 'MemberExpression' || callee['computed'] === true) return false
  if (!methods.has(nameOf(child(callee, 'property')) ?? '')) return false
  const holder = child(callee, 'object')
  if (nameOf(holder) === 'history') return true
  return (
    holder?.type === 'MemberExpression' &&
    holder['computed'] !== true &&
    nameOf(child(holder, 'property')) === 'history' &&
    ['window', 'globalThis'].includes(nameOf(child(holder, 'object')) ?? '')
  )
}

const HISTORY_WRITES: ReadonlySet<string> = new Set(['pushState', 'replaceState'])

const LINK_COMPONENTS: ReadonlySet<string> = new Set(['Link', 'Navigate'])

const literalSearch: AstForm = {
  id: 'literal-search',
  fix: 'Build the search from the route store: search={field.link()} on a Link, search: field.link(value) in navigate(), which keeps the keys the route owns',
  next: 'navTarget(...) for a nav row; a counted line waiver where no field owns the key',
  fixture: 'router-search/literal-search.tsx',
  detect: ({ report }): Visitor => ({
    JSXAttribute(node) {
      if (nameOf(child(node, 'name')) !== 'search') return
      const opening = node['parent'] as Node | undefined
      if (
        opening?.type !== 'JSXOpeningElement' ||
        !LINK_COMPONENTS.has(nameOf(child(opening, 'name')) ?? '')
      ) {
        return
      }
      const value = child(node, 'value')
      const expression =
        value?.type === 'JSXExpressionContainer' ? child(value, 'expression') : undefined
      if (!expression) return
      if (isLiteralSearch(expression)) report(node, 'search={{ … }}')
    },
    JSXOpeningElement(node) {
      if (!LINK_COMPONENTS.has(nameOf(child(node, 'name')) ?? '')) return
      const to = children(node, 'attributes').find(
        (attribute) =>
          attribute.type === 'JSXAttribute' && nameOf(child(attribute, 'name')) === 'to',
      )
      const value = to ? child(to, 'value') : undefined
      const target = value?.type === 'JSXExpressionContainer' ? child(value, 'expression') : value
      if (to && holdsQuery(target)) report(to, 'a query in `to`')
    },
    CallExpression(node) {
      if (isHistoryMethod(node, HISTORY_WRITES)) {
        const url = children(node, 'arguments')[2]
        if (url && holdsQuery(url)) report(node, 'history.pushState with a query')
        return
      }
      const callee = navigationCallee(node)
      if (!callee) return
      const [options] = children(node, 'arguments')
      if (options?.type !== 'ObjectExpression') return
      const to = children(options, 'properties').find(
        (property) => property.type === 'Property' && keyOf(property) === 'to',
      )
      if (to && holdsQuery(child(to, 'value'))) report(to, `${callee}({ to: '…?…' })`)
      const search = children(options, 'properties').find(
        (property) => property.type === 'Property' && keyOf(property) === 'search',
      )
      const value = search ? child(search, 'value') : undefined
      if (search && value && isLiteralSearch(value)) report(search, `${callee}({ search: { … } })`)
    },
  }),
}

/**
 * The names a loaderDeps function binds its search to: `({ search })`, `({ search: s })`,
 * `(opts)`, and the rest of a destructured search (`({ search: { page, ...rest } })`), which holds
 * every key but the ones named beside it.
 */
function searchBinding(fn: Node): { name: string } | { object: string } | undefined {
  const [param] = children(fn, 'params')
  if (param?.type === 'Identifier') return { object: param['name'] as string }
  if (param?.type !== 'ObjectPattern') return undefined
  for (const property of children(param, 'properties')) {
    if (property.type !== 'Property' || keyOf(property) !== 'search') continue
    const value = child(property, 'value')
    const target = value?.type === 'AssignmentPattern' ? child(value, 'left') : value
    const name = nameOf(target) ?? restName(target)
    if (name !== undefined) return { name }
  }
  return undefined
}

/** The name of an object pattern's rest element: `rest` of `{ page, ...rest }`. */
function restName(pattern: Node | undefined): string | undefined {
  if (pattern?.type !== 'ObjectPattern') return undefined
  const rest = children(pattern, 'properties').find((property) => property.type === 'RestElement')
  return rest ? nameOf(child(rest, 'argument')) : undefined
}

const isWholeSearch = (
  expression: Node,
  binding: { name: string } | { object: string },
): boolean => {
  const isSearch = (node: Node | undefined): boolean =>
    node !== undefined &&
    ('name' in binding
      ? nameOf(node) === binding.name
      : node.type === 'MemberExpression' &&
        node['computed'] !== true &&
        nameOf(child(node, 'object')) === binding.object &&
        nameOf(child(node, 'property')) === 'search')
  if (isSearch(expression)) return true
  // `({ search }) => ({ search })`: the whole search under a key is the same dependency
  // and `({ ...search })`, `({ ...opts.search })` copy it key for key
  return (
    expression.type === 'ObjectExpression' &&
    children(expression, 'properties').some((property) =>
      property.type === 'SpreadElement'
        ? isSearch(child(property, 'argument'))
        : property.type === 'Property' && isSearch(child(property, 'value')),
    )
  )
}

const loaderDepsSearch: AstForm = {
  id: 'loader-deps-search',
  fix: 'Return only the keys the loader reads: loaderDeps: ({ search }) => ({ range: search.range })',
  next: 'A store-backed route reads its keys through its field handles',
  fixture: 'router-search/loader-deps-search.tsx',
  detect: ({ report }): Visitor => ({
    Property(node) {
      if (keyOf(node) !== 'loaderDeps') return
      const fn = child(node, 'value')
      if (!isFunction(fn)) return
      const binding = searchBinding(fn)
      if (binding && returned(fn).some((r) => isWholeSearch(r, binding))) {
        report(node, 'loaderDeps: the whole search')
      }
    },
  }),
}

/** The impure read a validator holds, named for the message, or undefined when it is pure. */
function impureRead(root: Node): string | undefined {
  let found: string | undefined
  someDescendant(root, (node) => {
    if (node.type === 'MemberExpression' && node['computed'] !== true) {
      const object = nameOf(child(node, 'object'))
      const property = nameOf(child(node, 'property'))
      if (object === 'Math' && property === 'random') found = 'Math.random'
      else if (object === 'Date' && property === 'now') found = 'Date.now'
      else if (property === 'randomUUID' || property === 'getRandomValues') {
        // `crypto.x`, `globalThis.crypto.x`, `window.crypto.x`
        const holder = child(node, 'object')
        const isCrypto =
          object === 'crypto' ||
          (holder?.type === 'MemberExpression' &&
            nameOf(child(holder, 'property')) === 'crypto' &&
            (nameOf(child(holder, 'object')) === 'globalThis' ||
              nameOf(child(holder, 'object')) === 'window'))
        if (isCrypto) found = `crypto.${property}`
      }
    } else if (
      node.type === 'Identifier' &&
      IMPURE_GLOBALS.has(node['name'] as string) &&
      !isLocallyBound(node, node['name'] as string)
    ) {
      const parent = node['parent'] as Node | undefined
      const isKey =
        (parent?.type === 'MemberExpression' &&
          parent['computed'] !== true &&
          child(parent, 'property') === node) ||
        (parent?.type === 'Property' &&
          parent['computed'] !== true &&
          child(parent, 'key') === node)
      if (!isKey) found = node['name'] as string
    } else if (
      (node.type === 'NewExpression' || node.type === 'CallExpression') &&
      nameOf(child(node, 'callee')) === 'Date' &&
      children(node, 'arguments').length === 0
    ) {
      found = 'Date'
    }
    return found !== undefined
  })
  return found
}

const validateSearchPure: AstForm = {
  id: 'validate-search-pure',
  fix: 'Make the validator a pure function of its input; a default that reads the clock or storage is a field fallback or computed in the component',
  next: 'A validator shared across routes is declared once and passed by reference',
  fixture: 'router-search/validate-search-pure.tsx',
  detect: ({ report }): Visitor => ({
    Property(node) {
      if (keyOf(node) !== 'validateSearch') return
      const value = child(node, 'value')
      if (!value || value.type === 'Identifier') return
      const read = impureRead(value)
      if (read !== undefined) report(node, `validateSearch reads ${read}`)
    },
  }),
}

export const routerSearchRules = defineRules({
  'router-search': {
    family: 'structure',
    profiles: ['parts', 'app'],
    defect:
      'argo strength-tracker.tsx:53 re-runs the loader on every search param; literal search hits traps reproduced on Router 1.170.46',
    forms: [literalSearch, loaderDepsSearch, validateSearchPure],
  },
})
