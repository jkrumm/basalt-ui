/**
 * The `basalt/data-primitive` clause that gr-3b's forms do not carry (live-realtime 4.6): a literal
 * `staleTime: 'static'` inside a `liveQuery` argument, inside the options of a `useQuery`,
 * `useSuspenseQuery`, `useInfiniteQuery` or `useSuspenseInfiniteQuery` call, or in options bound to
 * a name that is then passed to `liveQuery` by name (`const opts = queryOptions({ staleTime:
 * 'static' }); liveQuery(opts, ...)`). Any `staleTime` key inside a `liveQuery` argument, or in
 * options passed to it by name, reports too, whatever its value (`Infinity`, `60 * 60 * 1000`, a
 * top-level `const FOREVER = Infinity`): the class owns `staleTime`, and the dev assert in
 * `liveQuery` throws on the key; a numeric or `Infinity` stale time in a plain `useQuery` stays legal. A plain `queryOptions({ staleTime: 'static' })` that nothing
 * in the file passes on stays legal. A query with a `'static'` observer is immune
 * to `invalidateQueries` and `refetchQueries`, so the same options object used in a loader and a
 * component silently ignores a push, a global refresh and a deploy. `liveQuery(..., 'static')`
 * maps the class to `Infinity` instead.
 *
 * `refetchInterval`, `refetchIntervalInBackground`, `new EventSource` and timer-driven invalidation
 * stay gr-3b's forms in `data-primitive.ts`; this file adds no duplicate of them. Syntactic only,
 * and one file deep. Known limits: options imported from another file, built by a helper, reached
 * through a spread of a name (`liveQuery({ ...opts }, ...)`) or handed to `useQuery` by name are out
 * of reach; a name is matched by spelling, not scope.
 */
import type { Node, Visitor } from '../../factory'
import type { AstForm } from '../../rule-table'

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && typeof (value as Node).type === 'string'

const nameOf = (node: unknown): string | undefined =>
  isNode(node) && (node.type === 'Identifier' || node.type === 'JSXIdentifier')
    ? (node['name'] as string)
    : undefined

/** `liveQuery(...)` or `ns.liveQuery(...)`. */
function isLiveQueryCall(call: Node): boolean {
  const callee = call['callee']
  if (nameOf(callee) === 'liveQuery') return true
  return (
    isNode(callee) &&
    callee.type === 'MemberExpression' &&
    callee['computed'] !== true &&
    nameOf(callee['property']) === 'liveQuery'
  )
}

const isInfinity = (value: Node): boolean =>
  nameOf(value) === 'Infinity' ||
  (value.type === 'MemberExpression' &&
    nameOf(value['object']) === 'Number' &&
    nameOf(value['property']) === 'POSITIVE_INFINITY')

/**
 * A non-computed `staleTime: 'static'` property, or any `staleTime` when `live` options are read:
 * liveQuery's dev assert throws on the key whatever its value, as the class owns it.
 */
function isStaticStaleTime(node: Node, live: boolean): boolean {
  if (node.type !== 'Property' || node['computed'] === true) return false
  const key = node['key']
  const keyName =
    isNode(key) && key.type === 'Literal' && typeof key['value'] === 'string'
      ? key['value']
      : nameOf(key)
  const value = node['value']
  if (keyName !== 'staleTime' || !isNode(value)) return false
  if (live) return true
  return value.type === 'Literal' && value['value'] === 'static'
}

/** Every `staleTime: 'static'` property under `root`, skipping the `parent` back-reference. */
function staticStaleTimes(root: Node, live = false): Node[] {
  const found: Node[] = []
  const stack: Node[] = [root]
  while (stack.length > 0) {
    const node = stack.pop() as Node
    if (isStaticStaleTime(node, live)) found.push(node)
    for (const [key, value] of Object.entries(node)) {
      if (key === 'parent' || key === 'loc' || key === 'range') continue
      if (Array.isArray(value)) stack.push(...value.filter(isNode))
      else if (isNode(value)) stack.push(value)
    }
  }
  return found
}

const staleTimeSubject = (property: Node): string => {
  const value = property['value'] as Node
  if (isInfinity(value)) return 'staleTime: Infinity inside liveQuery'
  return value.type === 'Literal' && value['value'] === 'static'
    ? "staleTime: 'static'"
    : 'staleTime inside liveQuery'
}

const QUERY_HOOKS: ReadonlySet<string> = new Set([
  'useQuery',
  'useSuspenseQuery',
  'useInfiniteQuery',
  'useSuspenseInfiniteQuery',
])

export const liveStaticStale: AstForm = {
  id: 'live-static-stale-time',
  detect: ({ report }): Visitor => {
    const staticOptions = new Map<string, Node>()
    const passed: { node: Node; name: string }[] = []
    return {
      VariableDeclarator(node) {
        const name = nameOf(node['id'])
        const init = node['init']
        if (name === undefined || !isNode(init)) return
        if (init.type === 'CallExpression' && isLiveQueryCall(init)) return
        const [property] = staticStaleTimes(init, true)
        if (property) staticOptions.set(name, property)
      },
      CallExpression(node) {
        const [options] = Array.isArray(node['arguments']) ? node['arguments'].filter(isNode) : []
        if (!options) return
        if (isLiveQueryCall(node)) {
          const name = nameOf(options)
          if (name !== undefined) passed.push({ node: options, name })
          for (const property of staticStaleTimes(options, true)) {
            report(property, staleTimeSubject(property))
          }
          return
        }
        if (!QUERY_HOOKS.has(nameOf(node['callee']) ?? '')) return
        for (const property of staticStaleTimes(options)) report(property, "staleTime: 'static'")
      },
      'Program:exit'() {
        for (const { node, name } of passed) {
          if (staticOptions.has(name)) report(node, `${name}: staleTime passed to liveQuery`)
        }
      },
    }
  },
  fix: "The freshness class owns staleTime (liveQuery throws in dev on the key): drop it and name the class, liveQuery(queryOptions, 'static') for a one-shot query (the class is staleTime Infinity); a literal staleTime 'static' makes the query immune to invalidateQueries, so a pushed invalidation, a global refresh and a deploy never reach it",
  next: "Use the 'standard' class when the data should refresh on focus",
  fixture: 'structure-rest/data-primitive-live-static-stale-time.tsx',
}

/** The forms this file adds to `data-primitive`, spread into its entry. */
export const dataPrimitiveLiveForms: readonly AstForm[] = [liveStaticStale]
