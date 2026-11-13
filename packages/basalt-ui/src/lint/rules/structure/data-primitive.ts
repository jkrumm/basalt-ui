/**
 * `basalt/data-primitive` (guardrails section 4, row 12): the eight ways an app re-builds freshness,
 * transport or persistence by hand. Six freshness stacks in argo (25 sites), 38 deprecated Query
 * fetches, an rb 401 loop at ~1000 req/s from a hand poll and linewatch's "0 of 30 expected cycles"
 * are the records. Every form is syntactic: no type information, no import-provenance engine.
 *
 * A plain `setInterval` is deliberately not a form (4 of 5 console hits are legitimate); a timer
 * is flagged only when its callback refetches. Raw `WebSocket` outside a seam is the same form as
 * `EventSource`: the contract ships no client, so the message names `createChannel` and the seam.
 */
import type { FormContext, Node, Visitor } from '../../factory'
import { mergeVisitors } from '../../factory'
import type { AstForm } from '../../rule-table'
import { defineRules } from '../../rule-table'

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && typeof (value as Node).type === 'string'

const child = (node: Node | undefined, key: string): Node | undefined => {
  const value = node?.[key]
  return isNode(value) ? value : undefined
}

const nodesIn = (node: Node, key: string): Node[] => {
  const value = node[key]
  return Array.isArray(value) ? value.filter(isNode) : []
}

const nameOf = (node: Node | undefined): string | undefined =>
  node?.type === 'Identifier' || node?.type === 'JSXIdentifier'
    ? (node['name'] as string)
    : undefined

/** A property key or string literal value read as a plain name. */
const keyName = (property: Node): string | undefined => {
  if (property['computed'] === true) return undefined
  const key = child(property, 'key')
  if (key?.type === 'Literal' && typeof key['value'] === 'string') return key['value']
  return nameOf(key)
}

const GLOBAL_OBJECTS: ReadonlySet<string> = new Set(['window', 'globalThis', 'self'])

/** `Name` or `window.Name` / `globalThis.Name` / `self.Name`. */
function globalName(node: Node | undefined): string | undefined {
  if (!node) return undefined
  if (node.type === 'Identifier') return nameOf(node)
  if (node.type !== 'MemberExpression' || node['computed'] === true) return undefined
  const object = nameOf(child(node, 'object'))
  return object !== undefined && GLOBAL_OBJECTS.has(object)
    ? nameOf(child(node, 'property'))
    : undefined
}

/** The method name of `x.method(...)`, or the callee name of a bare `method(...)`. */
function methodName(call: Node): string | undefined {
  const callee = child(call, 'callee')
  if (callee?.type === 'MemberExpression' && callee['computed'] !== true) {
    return nameOf(child(callee, 'property'))
  }
  return nameOf(callee)
}

const isMethodCall = (node: Node | undefined, name: string): node is Node => {
  if (node?.type !== 'CallExpression') return false
  const callee = child(node, 'callee')
  return (
    callee?.type === 'MemberExpression' &&
    callee['computed'] !== true &&
    nameOf(child(callee, 'property')) === name
  )
}

const hasName = (node: Node, imported: string): boolean => {
  const name = child(node, 'imported')
  return name?.type === 'Literal' ? name['value'] === imported : nameOf(name) === imported
}

/** Whether the file imports (or declares) `name`: the seam that licenses its escape. */
function seamTracker(name: string): { visitor: Visitor; declared: () => boolean } {
  let declared = false
  return {
    declared: () => declared,
    visitor: {
      ImportSpecifier(node) {
        if (hasName(node, name)) declared = true
      },
      TSInterfaceDeclaration(node) {
        if (nameOf(child(node, 'id')) === name) declared = true
      },
      TSTypeAliasDeclaration(node) {
        if (nameOf(child(node, 'id')) === name) declared = true
      },
    },
  }
}

/** Depth-first walk of an AST subtree, skipping the `parent` back-reference. */
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

export const refetchInterval: AstForm = {
  id: 'refetch-interval',
  detect: ({ report }): Visitor => {
    const check = (node: Node, name: string | undefined): void => {
      if (name === 'refetchInterval' || name === 'refetchIntervalInBackground') report(node, name)
    }
    return {
      Property(node) {
        if ((node['parent'] as Node | undefined)?.type === 'ObjectExpression') {
          check(node, keyName(node))
        }
      },
      JSXAttribute: (node) => check(node, nameOf(child(node, 'name'))),
    }
  },
  fix: 'Declare freshness with liveQuery(queryOptions, class): one central timer, paused while mutating',
  next: 'createChannel when the server pushes the change',
  fixture: 'structure-rest/data-primitive-refetch-interval.tsx',
}

export const unseamedTransport: AstForm = {
  id: 'unseamed-transport',
  detect: ({ report }): Visitor => {
    const transport = seamTracker('Transport')
    const pending: { node: Node; subject: string }[] = []
    return mergeVisitors([
      transport.visitor,
      {
        NewExpression(node) {
          const name = globalName(child(node, 'callee'))
          if (name === 'EventSource' || name === 'WebSocket') pending.push({ node, subject: name })
        },
        'Program:exit'() {
          if (transport.declared()) return
          for (const { node, subject } of pending) report(node, `new ${subject}`)
        },
      },
    ])
  },
  fix: 'Open the stream with createChannel and give it the connection through the Transport seam: only a file that imports the Transport type may construct one',
  next: 'Implement Transport in its own adapter file that imports the type',
  fixture: 'structure-rest/data-primitive-unseamed-transport.tsx',
}

const LOOP_TYPES = [
  'WhileStatement',
  'DoWhileStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
]

export const readerLoop: AstForm = {
  id: 'reader-loop',
  detect: ({ report }): Visitor => {
    const readers = new Map<string, Node>()
    const looped = new Set<string>()
    let depth = 0
    const loops: Record<string, () => void> = {}
    for (const type of LOOP_TYPES) {
      loops[type] = () => {
        depth += 1
      }
      loops[`${type}:exit`] = () => {
        depth -= 1
      }
    }
    return mergeVisitors([
      loops as unknown as Visitor,
      {
        VariableDeclarator(node) {
          let init = child(node, 'init')
          if (init?.type === 'AwaitExpression') init = child(init, 'argument')
          const name = nameOf(child(node, 'id'))
          if (name !== undefined && isMethodCall(init, 'getReader')) readers.set(name, init)
        },
        CallExpression(node) {
          if (depth === 0 || !isMethodCall(node, 'read')) return
          const reader = nameOf(child(child(node, 'callee'), 'object'))
          if (reader !== undefined) looped.add(reader)
        },
        'Program:exit'() {
          for (const [name, call] of readers) if (looped.has(name)) report(call, '.getReader()')
        },
      },
    ])
  },
  fix: 'createChannel owns fetch-SSE reading, reconnect and dedupe; pass a Transport for a custom stream',
  next: 'Keep the byte stream inside the Transport adapter file',
  fixture: 'structure-rest/data-primitive-reader-loop.tsx',
}

const DEPRECATED_FETCH: ReadonlySet<string> = new Set([
  'ensureQueryData',
  'prefetchQuery',
  'fetchQuery',
  'ensureInfiniteQueryData',
  'prefetchInfiniteQuery',
  'fetchInfiniteQuery',
])

export const deprecatedFetch: AstForm = {
  id: 'deprecated-fetch',
  detect: ({ report }): Visitor => ({
    CallExpression(node) {
      const callee = child(node, 'callee')
      if (callee?.type !== 'MemberExpression') return
      const name = methodName(node)
      if (name !== undefined && DEPRECATED_FETCH.has(name)) report(node, `${name}()`)
    },
  }),
  fix: 'queryClient.query() replaces ensureQueryData, prefetchQuery and fetchQuery (deprecated since Query 5.102)',
  next: 'A loader returns the promise from queryClient.query()',
  fixture: 'structure-rest/data-primitive-deprecated-fetch.tsx',
}

function insideMakeQueryClient(node: Node): boolean {
  for (let at = node['parent'] as Node | undefined; at; at = at['parent'] as Node | undefined) {
    if (at.type === 'FunctionDeclaration' && nameOf(child(at, 'id')) === 'makeQueryClient') {
      return true
    }
    if (at.type === 'VariableDeclarator' && nameOf(child(at, 'id')) === 'makeQueryClient') {
      return true
    }
  }
  return false
}

export const queryClientSingleton: AstForm = {
  id: 'query-client-singleton',
  detect: ({ report }): Visitor => ({
    NewExpression(node) {
      if (nameOf(child(node, 'callee')) !== 'QueryClient') return
      if (!insideMakeQueryClient(node)) report(node, 'new QueryClient')
    },
  }),
  fix: 'makeQueryClient() builds the one client; createBasaltRouter owns it and hands it down in router context',
  next: 'Extend its defaults through the query option of createBasaltRouter',
  fixture: 'structure-rest/data-primitive-query-client-singleton.tsx',
}

const CHART_ELEMENTS: ReadonlySet<string> = new Set([
  'CartesianChart',
  'Lines',
  'Bars',
  'StackedArea',
  'Sparkline',
  'MiniBars',
  'Donut',
  'Heatmap',
  'DualPanel',
  'MirroredBars',
])

const isEmptyArray = (node: Node | undefined): boolean =>
  node?.type === 'ArrayExpression' && nodesIn(node, 'elements').length === 0

export const chartDataFallback: AstForm = {
  id: 'chart-data-fallback',
  detect: ({ report }): Visitor => ({
    JSXAttribute(node) {
      if (nameOf(child(node, 'name')) !== 'data') return
      const element = child(node['parent'] as Node, 'name')
      const tag = nameOf(element)
      if (tag === undefined || !CHART_ELEMENTS.has(tag)) return
      const value = child(child(node, 'value'), 'expression')
      if (value?.type !== 'LogicalExpression') return
      if (value['operator'] !== '??' && value['operator'] !== '||') return
      if (isEmptyArray(child(value, 'right'))) report(node, `data={… ${value['operator']} []}`)
    },
  }),
  fix: 'Pass the query through state (phase, pending, error, empty) and the real data; a fallback array paints an empty chart as a loaded one',
  next: 'A streamed chart suspends on the same chart with state pending',
  fixture: 'structure-rest/data-primitive-chart-data-fallback.tsx',
}

const REFETCH_CALLS: ReadonlySet<string> = new Set([
  'invalidateQueries',
  'refetchQueries',
  'refetch',
])

export const timerRefetch: AstForm = {
  id: 'timer-refetch',
  detect: ({ report }: FormContext): Visitor => ({
    CallExpression(node) {
      const timer = globalName(child(node, 'callee'))
      if (timer !== 'setInterval' && timer !== 'setTimeout') return
      const [callback] = nodesIn(node, 'arguments')
      if (callback?.type !== 'ArrowFunctionExpression' && callback?.type !== 'FunctionExpression') {
        return
      }
      const refetches = someDescendant(callback, (inner) => {
        if (inner.type !== 'CallExpression') return false
        const name = methodName(inner)
        return name !== undefined && REFETCH_CALLS.has(name)
      })
      if (refetches) report(node, `${timer}(… refetch)`)
    },
  }),
  fix: 'liveQuery(queryOptions, class) owns the timer, pauses while mutating and stops in the background',
  next: 'createChannel when the server can push the change',
  fixture: 'structure-rest/data-primitive-timer-refetch.tsx',
}

const STORAGE_OBJECTS: ReadonlySet<string> = new Set(['localStorage', 'sessionStorage'])
const STORAGE_WRITES: ReadonlySet<string> = new Set(['setItem', 'removeItem', 'clear'])

/** `localStorage` or `window.localStorage` (and the session twin). */
const storageName = (node: Node | undefined): string | undefined => {
  const name = globalName(node)
  return name !== undefined && STORAGE_OBJECTS.has(name) ? name : undefined
}

export const rawStorageWrite: AstForm = {
  id: 'raw-storage-write',
  detect: ({ report }): Visitor => {
    const adapter = seamTracker('StorageLike')
    const pending: { node: Node; subject: string }[] = []
    return mergeVisitors([
      adapter.visitor,
      {
        CallExpression(node) {
          const callee = child(node, 'callee')
          if (callee?.type !== 'MemberExpression') return
          const storage = storageName(child(callee, 'object'))
          const method = methodName(node)
          if (storage !== undefined && method !== undefined && STORAGE_WRITES.has(method)) {
            pending.push({ node, subject: `${storage}.${method}()` })
          }
        },
        AssignmentExpression(node) {
          const target = child(node, 'left')
          const storage =
            target?.type === 'MemberExpression' ? storageName(child(target, 'object')) : undefined
          if (storage !== undefined) pending.push({ node, subject: `${storage} assignment` })
        },
        'Program:exit'() {
          if (adapter.declared()) return
          for (const { node, subject } of pending) report(node, subject)
        },
      },
    ])
  },
  fix: 'Persist through a createLocalStore field or createPersistedState, which write through the StorageLike seam',
  next: 'Implement StorageLike in its own adapter file that imports the type',
  fixture: 'structure-rest/data-primitive-raw-storage-write.tsx',
}

export const dataPrimitiveRules = defineRules({
  'data-primitive': {
    family: 'structure',
    profiles: ['parts', 'app'],
    defect:
      'six freshness stacks over 25 argo sites; 38 deprecated argo Query sites; an rb 401 loop at ~1000 req/s from a hand poll; linewatch "0 of 30 expected cycles"',
    forms: [
      refetchInterval,
      unseamedTransport,
      readerLoop,
      deprecatedFetch,
      queryClientSingleton,
      chartDataFallback,
      timerRefetch,
      rawStorageWrite,
    ],
  },
})
