/**
 * The `basalt/data-primitive` clause that gr-3b's forms do not carry (live-realtime 4.6): a literal
 * `staleTime: 'static'` inside a `liveQuery` argument. A query with a `'static'` observer is immune
 * to `invalidateQueries` and `refetchQueries`, so the same options object used in a loader and a
 * component silently ignores a push, a global refresh and a deploy. `liveQuery(..., 'static')`
 * maps the class to `Infinity` instead.
 *
 * `refetchInterval`, `refetchIntervalInBackground`, `new EventSource` and timer-driven invalidation
 * stay gr-3b's forms in `data-primitive.ts`; this file adds no duplicate of them. Syntactic only:
 * the options must be written in the call (an object literal, `queryOptions({...})` or a spread of
 * either); an identifier handed in is out of reach.
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

/** A non-computed `staleTime: 'static'` property. */
function isStaticStaleTime(node: Node): boolean {
  if (node.type !== 'Property' || node['computed'] === true) return false
  const key = node['key']
  const keyName =
    isNode(key) && key.type === 'Literal' && typeof key['value'] === 'string'
      ? key['value']
      : nameOf(key)
  const value = node['value']
  return (
    keyName === 'staleTime' &&
    isNode(value) &&
    value.type === 'Literal' &&
    value['value'] === 'static'
  )
}

/** Every `staleTime: 'static'` property under `root`, skipping the `parent` back-reference. */
function staticStaleTimes(root: Node): Node[] {
  const found: Node[] = []
  const stack: Node[] = [root]
  while (stack.length > 0) {
    const node = stack.pop() as Node
    if (isStaticStaleTime(node)) found.push(node)
    for (const [key, value] of Object.entries(node)) {
      if (key === 'parent' || key === 'loc' || key === 'range') continue
      if (Array.isArray(value)) stack.push(...value.filter(isNode))
      else if (isNode(value)) stack.push(value)
    }
  }
  return found
}

export const liveStaticStale: AstForm = {
  id: 'live-static-stale-time',
  detect: ({ report }): Visitor => ({
    CallExpression(node) {
      if (!isLiveQueryCall(node)) return
      const [options] = Array.isArray(node['arguments']) ? node['arguments'].filter(isNode) : []
      if (!options) return
      for (const property of staticStaleTimes(options)) report(property, "staleTime: 'static'")
    },
  }),
  fix: "Declare a one-shot query with liveQuery(queryOptions, 'static') (the class is staleTime Infinity); a literal staleTime 'static' makes the query immune to invalidateQueries, so a pushed invalidation, a global refresh and a deploy never reach it",
  next: "Use the 'standard' class when the data should refresh on focus",
  fixture: 'structure-rest/data-primitive-live-static-stale-time.tsx',
}

/** The forms this file adds to `data-primitive`, spread into its entry. */
export const dataPrimitiveLiveForms: readonly AstForm[] = [liveStaticStale]
