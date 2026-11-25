/**
 * `basalt/data-primitive` (guardrails section 4, row 12): the ways an app re-builds freshness,
 * transport or persistence by hand (eight here, plus the live clause in `data-primitive-live.ts`). Six freshness stacks in argo (25 sites), 38 deprecated Query
 * fetches, an rb 401 loop at ~1000 req/s from a hand poll and linewatch's "0 of 30 expected cycles"
 * are the records. Every form is syntactic: no type information, no import-provenance engine.
 *
 * A plain `setInterval` is deliberately not a form (4 of 5 console hits are legitimate); a timer
 * is flagged only when its callback refetches. Raw `WebSocket` outside a seam is the same form as
 * `EventSource`: the contract ships no client, so the message names `createChannel` and the seam.
 *
 * Known limits: `reader-loop` reads a `for await` over a `.body` member or a `.body.pipeThrough(…)`
 * chain (a decoded body), inline or through a `const` or `let` bound to one (top level or block, by
 * spelling) or rooted in a stream parameter (one typed `ReadableStream`, or untyped and named `body`
 * or `stream`: a helper handed the body; a `body` destructured from a parameter, `({ body }: Response)`, counts), a `.pipeTo(new WritableStream(…))`
 * on a chain rooted in `.body`, a `getReader()` read in a
 * loop and a `getReader()` whose reader is read inside a named function that refers to itself (a
 * `read().then(function pump() { … read().then(pump) })` or a recursive async function); a pump split
 * across two functions, a parameter's `.pipeThrough(…)` or `.getReader()` that is never looped on
 * here, and a caller handing the body to a helper in another file are out of reach. `timer-refetch` reads any `.invalidate()` / `invalidateQueries` /
 * `refetchQueries` / `refetch` call in a timer callback (`setInterval`, `setTimeout`, or a
 * `useInterval` / `useIntervalEffect` hook by callee name), router invalidation included, and a timer
 * handed one of those names by reference (`setInterval(refetch, 5000)`, `setInterval(query.refetch, 5000)`);
 * a timer that calls a named wrapper which invalidates (`setInterval(refresh, 5000)`) is not followed.
 * `reader-loop` also reads a reader taken through an optional chain (`res.body?.getReader()`), as it
 * reads one through `!`.
 * `unseamed-transport` reads `EventSource` and `WebSocket`, not a client library's connect call:
 * `io()` from `socket.io-client`, `new Pusher()` from `pusher-js` and `Ably` are reported at their import by
 * `import-boundary` (`data-library`), as is `swr`;
 * SWR's `refreshInterval` key still reports here as a `refetch-interval`.
 */
import type { FormContext, Node, Visitor } from '../../factory'
import { isTestFile, mergeVisitors } from '../../factory'
import type { AstForm } from '../../rule-table'
import { defineRules } from '../../rule-table'
import { dataPrimitiveLiveForms } from './data-primitive-live'

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

/** TanStack Query's polling keys, and SWR's `refreshInterval` (the import itself is import-boundary's). */
const REFETCH_INTERVAL_KEYS: ReadonlySet<string> = new Set([
  'refetchInterval',
  'refetchIntervalInBackground',
  'refreshInterval',
])

export const refetchInterval: AstForm = {
  id: 'refetch-interval',
  detect: ({ report }): Visitor => {
    const check = (node: Node, name: string | undefined): void => {
      if (REFETCH_INTERVAL_KEYS.has(name ?? '')) report(node, name ?? '')
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

const FUNCTION_TYPES: ReadonlySet<string> = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
])

function enclosingFunction(node: Node): Node | undefined {
  for (let at = node['parent'] as Node | undefined; at; at = at['parent'] as Node | undefined) {
    if (FUNCTION_TYPES.has(at.type)) return at
  }
  return undefined
}

/** The name a function is called by: its own id, or the variable it is assigned to. */
function functionName(fn: Node): string | undefined {
  const own = nameOf(child(fn, 'id'))
  if (own !== undefined) return own
  const parent = fn['parent'] as Node | undefined
  return parent?.type === 'VariableDeclarator' ? nameOf(child(parent, 'id')) : undefined
}

/** `res.body!.pipeThrough(new TextDecoderStream()).pipeTo(new WritableStream({ … }))`: a chain rooted in `.body` that ends in a hand-written sink. */
function isBodyPipeToSink(call: Node): boolean {
  if (!isMethodCall(call, 'pipeTo')) return false
  const [sink] = nodesIn(call, 'arguments')
  if (sink?.type !== 'NewExpression' || nameOf(child(sink, 'callee')) !== 'WritableStream') {
    return false
  }
  let at: Node | undefined = child(child(call, 'callee'), 'object')
  while (at) {
    if (at.type === 'TSNonNullExpression' || at.type === 'TSAsExpression') {
      at = child(at, 'expression')
    } else if (at.type === 'ChainExpression') at = child(at, 'expression')
    else if (at.type === 'CallExpression') at = child(child(at, 'callee'), 'object')
    else if (at.type === 'MemberExpression') {
      if (at['computed'] !== true && nameOf(child(at, 'property')) === 'body') return true
      at = child(at, 'object')
    } else return false
  }
  return false
}

/** Through `!`, `as` and `?.`: the expression the wrapper holds. */
function unwrapped(node: Node | undefined): Node | undefined {
  let at = node
  while (
    at?.type === 'TSNonNullExpression' ||
    at?.type === 'TSAsExpression' ||
    at?.type === 'ChainExpression'
  ) {
    at = child(at, 'expression')
  }
  return at
}

/**
 * `res.body` or `res.body!.pipeThrough(new TextDecoderStream())…`: a body, or a pipeThrough chain
 * on one. `named` says whether a bare name is a stream (a binding of one, a stream parameter).
 */
function isBodyStream(node: Node | undefined, named: (id: Node) => boolean): boolean {
  const at = unwrapped(node)
  if (at?.type === 'Identifier') return named(at)
  if (at?.type === 'MemberExpression') {
    return at['computed'] !== true && nameOf(child(at, 'property')) === 'body'
  }
  return (
    isMethodCall(at, 'pipeThrough') && isBodyStream(child(child(at, 'callee'), 'object'), named)
  )
}

/** The bare names a stream parameter goes by when it carries no type. */
const STREAM_PARAMS: ReadonlySet<string> = new Set(['body', 'stream'])

/** A `ReadableStream` type annotation (`ReadableStream<Uint8Array>`, or one member of a union). */
function isStreamType(annotation: Node | undefined): boolean {
  const type = child(annotation, 'typeAnnotation')
  const members = type?.type === 'TSUnionType' ? nodesIn(type, 'types') : type ? [type] : []
  return members.some(
    (member) =>
      member.type === 'TSTypeReference' && nameOf(child(member, 'typeName')) === 'ReadableStream',
  )
}

/**
 * The stream parameters of a function: one typed `ReadableStream`, or untyped and named `body` or
 * `stream` (lint-10.5: a helper handed the body, the shape a refactor produces).
 */
function streamParams(fn: Node): Set<string> {
  const names = new Set<string>()
  for (const param of nodesIn(fn, 'params')) {
    const id = param.type === 'AssignmentPattern' ? child(param, 'left') : param
    if (id?.type === 'ObjectPattern') {
      // `({ body }: Response)`, `({ body: stream = fallback })`: the body of a response handed in
      for (const property of nodesIn(id, 'properties')) {
        if (property.type !== 'Property' || keyName(property) !== 'body') continue
        const value = child(property, 'value')
        const target = value?.type === 'AssignmentPattern' ? child(value, 'left') : value
        const bound = nameOf(target)
        if (bound !== undefined) names.add(bound)
      }
      continue
    }
    const name = nameOf(id)
    if (name === undefined || id === undefined) continue
    const annotation = child(id, 'typeAnnotation')
    if (annotation ? isStreamType(annotation) : STREAM_PARAMS.has(name)) names.add(name)
  }
  return names
}

/** Whether `id` names a stream parameter of a function it sits in. */
function isStreamParam(id: Node): boolean {
  const name = id['name'] as string
  for (let at = enclosingFunction(id); at; at = enclosingFunction(at)) {
    if (streamParams(at).has(name)) return true
  }
  return false
}

export const readerLoop: AstForm = {
  id: 'reader-loop',
  detect: ({ report }): Visitor => {
    // `const s = res.body!.pipeThrough(…)`, at the top level or in a block: a stream by spelling.
    const bodyStreams = new Set<string>()
    const readers = new Map<string, Node>()
    const looped = new Set<string>()
    const reads: { reader: string; fn: Node | undefined }[] = []
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
    const named = (id: Node): boolean => bodyStreams.has(id['name'] as string) || isStreamParam(id)
    return mergeVisitors([
      loops as unknown as Visitor,
      {
        ForOfStatement(node) {
          if (node['await'] !== true) return
          const source = unwrapped(child(node, 'right'))
          const name = nameOf(source)
          if (name !== undefined && source !== undefined && named(source)) {
            report(node, `for await … ${name}`)
          } else if (isBodyStream(source, named)) {
            report(
              node,
              isMethodCall(source, 'pipeThrough')
                ? 'for await … .body.pipeThrough'
                : 'for await … .body',
            )
          }
        },
        VariableDeclarator(node) {
          const parent = node['parent'] as Node | undefined
          const id = nameOf(child(node, 'id'))
          // A `let` is read as a `const` is (lint-10.5): its first value is the stream it loops on.
          if (
            (parent?.['kind'] === 'const' || parent?.['kind'] === 'let') &&
            id !== undefined &&
            isBodyStream(child(node, 'init'), named)
          ) {
            bodyStreams.add(id)
          }
          let init = child(node, 'init')
          if (init?.type === 'AwaitExpression') init = child(init, 'argument')
          // `res.body?.getReader()` is a ChainExpression around the call: read it as `res.body!.getReader()`.
          if (init?.type === 'ChainExpression') init = child(init, 'expression')
          const name = nameOf(child(node, 'id'))
          if (name !== undefined && isMethodCall(init, 'getReader')) readers.set(name, init)
        },
        CallExpression(node) {
          if (isBodyPipeToSink(node)) report(node, '.body … .pipeTo(new WritableStream)')
          if (!isMethodCall(node, 'read')) return
          const reader = nameOf(child(child(node, 'callee'), 'object'))
          if (reader === undefined) return
          reads.push({ reader, fn: enclosingFunction(node) })
          if (depth > 0) looped.add(reader)
        },
        'Program:exit'() {
          for (const { reader, fn } of reads) {
            const self = fn && functionName(fn)
            if (self === undefined || !readers.has(reader)) continue
            const refersToSelf = someDescendant(fn as Node, (inner) => {
              if (inner.type !== 'Identifier' || inner['name'] !== self) return false
              if (inner === child(fn, 'id')) return false
              // `reader.read()` names a property, not the function: only a reference counts.
              const up = inner['parent'] as Node | undefined
              const isMemberName =
                up?.type === 'MemberExpression' && up['property'] === inner && !up['computed']
              const isKey = up?.type === 'Property' && up['key'] === inner && !up['computed']
              return !isMemberName && !isKey
            })
            if (refersToSelf) looped.add(reader)
          }
          for (const [name, call] of readers) if (looped.has(name)) report(call, '.getReader()')
        },
      },
    ])
  },
  fix: 'createChannel owns fetch-SSE reading, reconnect and dedupe; pass a Transport for a custom stream',
  // A byte stream that is no event stream (a download's progress, an upload) has no channel and no
  // Transport to keep it in (lint-10.7): its rung is the reasoned line waiver.
  next: 'Keep an event stream inside the Transport adapter file; a byte stream that is no event stream (a download counting its progress, an upload) is waived on its line, with the reason',
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

function insideCreateQueryClient(node: Node): boolean {
  for (let at = node['parent'] as Node | undefined; at; at = at['parent'] as Node | undefined) {
    if (at.type === 'FunctionDeclaration' && nameOf(child(at, 'id')) === 'createQueryClient') {
      return true
    }
    if (at.type === 'VariableDeclarator' && nameOf(child(at, 'id')) === 'createQueryClient') {
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
      if (!insideCreateQueryClient(node)) report(node, 'new QueryClient')
    },
  }),
  fix: 'createQueryClient() builds the one client; create it once at the entry and hand it down in router context and QueryClientProvider',
  next: 'Extend its defaults through the options of createQueryClient',
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
  'IntervalTrack',
  'Waterfall',
  'RangeNavigator',
  'DualPanel',
  'MirroredBars',
])

/** A shipped chart kind, or any element named `*Chart` (an app's own wrapper, `BarChart`). */
const isChartElement = (tag: string): boolean => CHART_ELEMENTS.has(tag) || tag.endsWith('Chart')

const TYPE_WRAPPERS: ReadonlySet<string> = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSTypeAssertion',
  'TSNonNullExpression',
  'ParenthesizedExpression',
])

const unwrapTypes = (node: Node | undefined): Node | undefined => {
  let at = node
  while (at && TYPE_WRAPPERS.has(at.type)) at = child(at, 'expression')
  return at
}

/**
 * `[]`, also behind a type: `[] as Row[]`, `<Row[]>[]`, `([] satisfies Row[])`; and the same empty
 * array spelled `Array.of()`, `Array.of<Row>()`, `new Array()` or `Array()` with no arguments.
 */
const isEmptyArray = (node: Node | undefined): boolean => {
  const at = unwrapTypes(node)
  if (at?.type === 'ArrayExpression') return nodesIn(at, 'elements').length === 0
  if (at?.type !== 'CallExpression' && at?.type !== 'NewExpression') return false
  if (nodesIn(at, 'arguments').length > 0) return false
  const callee = child(at, 'callee')
  if (at.type === 'CallExpression' && callee?.type === 'MemberExpression') {
    return globalName(child(callee, 'object')) === 'Array' && methodName(at) === 'of'
  }
  return globalName(callee) === 'Array'
}

/** `x ?? []` / `x || []` / `ok ? x : []`, or `x ?? EMPTY` where `EMPTY` is a same-file const empty array. */
/** `q.data`, `q.data!`, `q?.data` or a destructured `data` (`data as Row[]`): a query result's data. */
const isDataRead = (node: Node | undefined): boolean => {
  let at = unwrapTypes(node)
  while (at?.type === 'ChainExpression') at = unwrapTypes(child(at, 'expression'))
  if (nameOf(at) === 'data') return true
  return (
    at?.type === 'MemberExpression' &&
    at['computed'] !== true &&
    nameOf(child(at, 'property')) === 'data'
  )
}

const isFallbackExpression = (
  expression: Node | undefined,
  emptyConsts: ReadonlySet<string>,
): boolean => {
  const node = unwrapTypes(expression)
  const isEmpty = (at: Node | undefined): boolean => {
    if (isEmptyArray(at)) return true
    const name = nameOf(unwrapTypes(at))
    return name !== undefined && emptyConsts.has(name)
  }
  if (node?.type === 'ConditionalExpression') {
    // Only a query's data against an empty branch, in either branch (`q.isSuccess ? q.data : []`,
    // `isLoading ? [] : (data as Row[])`): a conditional
    // between an empty state and computed rows (`shot === 'empty' ? [] : rows`) is no fallback.
    const consequent = child(node, 'consequent')
    const alternate = child(node, 'alternate')
    return (
      (isEmpty(consequent) && isDataRead(alternate)) ||
      (isEmpty(alternate) && isDataRead(consequent))
    )
  }
  if (node?.type !== 'LogicalExpression') return false
  if (node['operator'] !== '??' && node['operator'] !== '||') return false
  return isEmpty(child(node, 'right'))
}

const isConstDeclarator = (node: Node): boolean =>
  (node['parent'] as Node | undefined)?.['kind'] === 'const'

/** What a `useMemo(() => expr)` or `useMemo(() => { return expr })` returns. */
function memoReturn(call: Node): Node | undefined {
  if (methodName(call) !== 'useMemo') return undefined
  const [factory] = nodesIn(call, 'arguments')
  if (factory?.type !== 'ArrowFunctionExpression' && factory?.type !== 'FunctionExpression') {
    return undefined
  }
  const body = child(factory, 'body')
  if (body?.type !== 'BlockStatement') return body
  const statements = nodesIn(body, 'body')
  const [only] = statements
  return statements.length === 1 && only?.type === 'ReturnStatement'
    ? child(only, 'argument')
    : undefined
}

/**
 * An empty array standing in for a query's data on a chart (a shipped kind, or any element named
 * `*Chart`): written in the prop (`data={q.data ?? []}`, or a conditional between a `.data` read
 * and an empty array, `q.isSuccess ? q.data : []`; an empty state against computed rows,
 * `shot === 'empty' ? [] : rows`, passes), hoisted (`const rows = q.data ?? []` then `data={rows}`), a destructure
 * default off a call (`const { data = [] } = useRuns()` then `data={data}`), a same-file `const`
 * empty array (`q.data ?? EMPTY`), or the same fallback returned by a `useMemo` (an expression
 * body or a single `return`); each reads through `as`, `satisfies`, `!` and parentheses
 * (`data={(q.data ?? []) as Row[]}`). A name is matched by spelling, not scope. Known limit: a fallback
 * that reaches the chart through a helper, a prop or another file is out of reach, and a
 * `useMemo` with more than one statement is not followed.
 */
export const chartDataFallback: AstForm = {
  id: 'chart-data-fallback',
  detect: ({ report }): Visitor => {
    const emptyConsts = new Set<string>()
    // A name bound to an expression that is a fallback when it tests as one; `undefined` is a
    // destructure default, which always is.
    const sources = new Map<string, Node | undefined>()
    const inline: { node: Node; value: Node }[] = []
    const named: { node: Node; name: string }[] = []
    return {
      VariableDeclarator(node) {
        const id = child(node, 'id')
        const init = child(node, 'init')
        const name = nameOf(id)
        if (name !== undefined && init) {
          if (isConstDeclarator(node) && isEmptyArray(init)) emptyConsts.add(name)
          sources.set(name, init.type === 'CallExpression' ? (memoReturn(init) ?? init) : init)
        }
        if (id?.type !== 'ObjectPattern' || init?.type !== 'CallExpression') return
        for (const prop of nodesIn(id, 'properties')) {
          const value = child(prop, 'value')
          if (value?.type !== 'AssignmentPattern' || !isEmptyArray(child(value, 'right'))) continue
          const local = nameOf(child(value, 'left'))
          if (local !== undefined) sources.set(local, undefined)
        }
      },
      JSXAttribute(node) {
        if (nameOf(child(node, 'name')) !== 'data') return
        const element = child(node['parent'] as Node, 'name')
        const tag = nameOf(element)
        if (tag === undefined || !isChartElement(tag)) return
        const value = unwrapTypes(child(child(node, 'value'), 'expression'))
        if (value?.type === 'LogicalExpression' || value?.type === 'ConditionalExpression') {
          inline.push({ node, value })
        }
        const name = nameOf(value)
        if (name !== undefined) named.push({ node, name })
      },
      'Program:exit'() {
        for (const { node, value } of inline) {
          if (isFallbackExpression(value, emptyConsts)) {
            report(node, `data={… ${value['operator'] ?? '?:'} []}`)
          }
        }
        for (const { node, name } of named) {
          if (!sources.has(name)) continue
          const source = sources.get(name)
          if (source === undefined || isFallbackExpression(source, emptyConsts)) {
            report(node, `data={${name}} (an empty-array fallback)`)
          }
        }
      },
    }
  },
  fix: 'Pass the query through state (phase, pending, error, empty) and the real data; a fallback array paints an empty chart as a loaded one',
  next: 'A streamed chart suspends on the same chart with state pending',
  fixture: 'structure-rest/data-primitive-chart-data-fallback.tsx',
}

const REFETCH_CALLS: ReadonlySet<string> = new Set([
  'invalidate',
  'invalidateQueries',
  'refetchQueries',
  'refetch',
])

const INTERVAL_HOOKS: ReadonlySet<string> = new Set(['useInterval', 'useIntervalEffect'])

const refetchesIn = (callback: Node | undefined): boolean => {
  if (callback?.type === 'Identifier') return REFETCH_CALLS.has(callback['name'] as string)
  if (callback?.type === 'MemberExpression') {
    return (
      callback['computed'] !== true && REFETCH_CALLS.has(nameOf(child(callback, 'property')) ?? '')
    )
  }
  if (callback?.type !== 'ArrowFunctionExpression' && callback?.type !== 'FunctionExpression') {
    return false
  }
  return someDescendant(callback, (inner) => {
    if (inner.type !== 'CallExpression') return false
    const name = methodName(inner)
    return name !== undefined && REFETCH_CALLS.has(name)
  })
}

export const timerRefetch: AstForm = {
  id: 'timer-refetch',
  detect: ({ report }: FormContext): Visitor => ({
    CallExpression(node) {
      const [callback] = nodesIn(node, 'arguments')
      const hook = methodName(node)
      if (hook !== undefined && INTERVAL_HOOKS.has(hook)) {
        if (refetchesIn(callback)) report(node, `${hook}(… refetch)`)
        return
      }
      const timer = globalName(child(node, 'callee'))
      if (timer !== 'setInterval' && timer !== 'setTimeout') return
      if (refetchesIn(callback)) report(node, `${timer}(… refetch)`)
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

/** A storage, or a conditional with a storage branch (`typeof window !== 'undefined' ? window.localStorage : null`). */
const storageOrGuarded = (node: Node | undefined): string | undefined => {
  const at = unwrapTypes(node)
  if (at?.type !== 'ConditionalExpression') return storageName(at)
  return storageOrGuarded(child(at, 'consequent')) ?? storageOrGuarded(child(at, 'alternate'))
}

/**
 * A write in a test file (`*.test.*`, `*.spec.*`) seeds storage for a read and passes. A `const`
 * alias of the storage global (`const store = window.localStorage`) is followed within the file,
 * by spelling, also one bound to a conditional with a storage branch (`const guarded = typeof window !==
 * 'undefined' ? window.localStorage : null`); a storage reached through a parameter, a property or another file is out of reach.
 * `clear()` wipes every key, which `persisted` has no call for: reset the owner's keys with
 * `persisted.clearOwner(owner)` or each field with its own `reset()`.
 */
export const rawStorageWrite: AstForm = {
  id: 'raw-storage-write',
  detect: ({ context, report }): Visitor => {
    if (isTestFile(context)) return {}
    const adapter = seamTracker('StorageLike')
    const aliases = new Map<string, string>()
    const pending: { node: Node; object: Node; method: string | undefined }[] = []
    const resolve = (object: Node | undefined): string | undefined => {
      const direct = storageName(object)
      if (direct !== undefined) return direct
      const alias = object?.type === 'Identifier' ? nameOf(object) : undefined
      return alias === undefined ? undefined : aliases.get(alias)
    }
    return mergeVisitors([
      adapter.visitor,
      {
        VariableDeclarator(node) {
          const alias = nameOf(child(node, 'id'))
          const storage = storageOrGuarded(child(node, 'init'))
          if (alias !== undefined && storage !== undefined && isConstDeclarator(node)) {
            aliases.set(alias, storage)
          }
        },
        CallExpression(node) {
          const callee = child(node, 'callee')
          const object = child(callee, 'object')
          if (callee?.type !== 'MemberExpression' || !object) return
          const method = methodName(node)
          if (method !== undefined && STORAGE_WRITES.has(method)) {
            pending.push({ node, object, method })
          }
        },
        AssignmentExpression(node) {
          const target = child(node, 'left')
          const object = target?.type === 'MemberExpression' ? child(target, 'object') : undefined
          if (object) pending.push({ node, object, method: undefined })
        },
        'Program:exit'() {
          if (adapter.declared()) return
          for (const { node, object, method } of pending) {
            const storage = resolve(object)
            if (storage === undefined) continue
            report(node, method === undefined ? `${storage} assignment` : `${storage}.${method}()`)
          }
        },
      },
    ])
  },
  fix: 'Persist through persisted(key) from basalt-ui or a store field, which write through the StorageLike seam; a sign-out wipe is persisted.clearOwner(owner), not clear()',
  next: 'persisted.setStorage selects the app-wide backend; implement StorageLike in its own adapter file that imports the type',
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
      ...dataPrimitiveLiveForms,
    ],
  },
})
