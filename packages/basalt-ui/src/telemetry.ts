/**
 * The telemetry seam (V2-SPEC § 7). Basalt emits typed events through one sink,
 * `BasaltProvider telemetry`, and has no OTel dependency; the consumer maps events to its own SDK.
 *
 * Events carry ids, hashes, counts and durations only — never an error object, message, stack,
 * search param or query data. A `failed: true` event additionally carries `exception.type` and
 * `basalt.error.kind`; a `failed: false` event carries neither, and the types enforce both ways.
 */
import { createContext } from 'react'
import type { ThreadStatus } from './agent/thread'

/** Epoch ms (`performance.timeOrigin + performance.now()`). */
type At = { start: number }
/** `start` plus a duration in ms. */
type Span = At & { duration: number }

/** The error family, or an `AgentError` kind (W8) — closed. */
type ErrorKind =
  | 'route'
  | 'query'
  | 'mutation'
  | 'render'
  | 'window'
  | 'unhandledrejection'
  | 'http'
  | 'stream'
  | 'server'
  | 'aborted'

type Failure = { 'exception.type': string; 'basalt.error.kind': ErrorKind }
type Ok<T, A> = Span & { type: T; failed: false; attributes: A }
type Err<T, A, S = At> = S & { type: T; failed: true; attributes: A & Failure }

type RouteAttrs = {
  'basalt.route.id': string
  'basalt.route.from': string
  /** Pathname, never search. */
  'url.path': string
}

type ChatAttrs = {
  'basalt.chat.thread_id': string
  'basalt.chat.ttft_ms': number
  'basalt.chat.parts': number
  'basalt.chat.status': ThreadStatus
}

/**
 * Closed union: switch on `type`/`failed` and end with `default: return event satisfies never`.
 *
 * @example
 * export function telemetry(e: BasaltEvent): void {
 *   const span = tracer.startSpan(e.type, { startTime: e.start, attributes: { ...e.attributes } })
 *   if (e.failed) span.setStatus({ code: SpanStatusCode.ERROR })
 *   span.end('duration' in e ? e.start + e.duration : e.start)
 * }
 */
export type BasaltEvent =
  | Ok<'route.navigate', RouteAttrs>
  | Err<'route.error', { 'basalt.route.id': string }>
  | Err<
      'query.error',
      {
        /** `groupingId(queryHash)`: an opaque grouping id, not the key. */ 'basalt.query.hash': string
        'basalt.query.failure_count': number
      }
    >
  | Err<
      'mutation.error',
      {
        /** `groupingId(JSON.stringify(key))`: an opaque grouping id, not the key. */ 'basalt.mutation.key': string
      }
    >
  | Err<'render.error', { 'basalt.error.boundary': 'root' }>
  | Err<'window.error', { 'basalt.error.source': 'error' | 'unhandledrejection' }>
  | Ok<'chat.turn', ChatAttrs>
  | Err<'chat.turn', ChatAttrs, Span>

/** W3C trace-context request headers a sink contributes to one chat turn's request. */
export type TraceHeaders = {
  readonly traceparent: string
  readonly tracestate?: string | undefined
}

/**
 * How a traced chat turn ended: its `chat.turn` event fired (`settled`/`failed`), or `stopped` — a
 * `stop()`, an unmount or a newer run taking the thread over — which emits no event. The one
 * lifecycle vocabulary of the run records too.
 */
export type ChatTurnEnd = 'settled' | 'failed' | 'stopped'

/** The turn a sink is asked to trace. */
type ChatTurnInit = { readonly threadId: string; readonly messageId: string }

/**
 * What a sink returns from `startChatTurn`. `settle` runs once, synchronously, right after the
 * turn's `chat.turn` event (`settled`/`failed`), or when the turn is cut short (`stopped`) — the
 * point to end a span opened in `startChatTurn`. It runs even when `headers` is absent or
 * malformed (dropped, the request goes out untraced), so the span never leaks.
 */
export type ChatTurnTrace = {
  readonly headers?: TraceHeaders | undefined
  readonly settle?: ((end: ChatTurnEnd) => void) | undefined
}

/**
 * The event sink. It may carry one optional hook, `startChatTurn`, called when a new chat turn
 * begins (not on a resume): open your span there and return its `traceparent` (and `tracestate`)
 * and `aiSdkTransport` sends them with that turn's request to the chat endpoint — never anywhere
 * else. A sink without the hook, or no sink, changes nothing on the wire. basalt has no OTel
 * dependency; the hook is where the consumer's SDK does the work.
 *
 * A fetch instrumentation (OTel web, HyperDX) overwrites the returned `traceparent` on same-origin
 * requests with its own fetch span, so the API span lands in a separate trace. Either exclude the
 * chat URL from the instrumentation (`ignoreUrls` in HyperDX and in OTel's fetch instrumentation),
 * or make the turn span the active context around the request.
 *
 * @example
 * export const telemetry: Telemetry = Object.assign(onEvent, {
 *   startChatTurn({ threadId }) {
 *     const span = tracer.startSpan('chat.turn', {
 *       attributes: { 'basalt.chat.thread_id': threadId },
 *     })
 *     const carrier: Record<string, string> = {}
 *     propagation.inject(trace.setSpan(context.active(), span), carrier)
 *     return {
 *       headers: { traceparent: carrier.traceparent ?? '', tracestate: carrier.tracestate },
 *       settle(end) {
 *         if (end === 'failed') span.setStatus({ code: SpanStatusCode.ERROR })
 *         span.end()
 *       },
 *     }
 *   },
 * })
 */
export type Telemetry = ((event: BasaltEvent) => void) & {
  readonly startChatTurn?: ((turn: ChatTurnInit) => ChatTurnTrace | undefined) | undefined
}

export const now = (): number => performance.timeOrigin + performance.now()

/**
 * An opaque grouping id (32-bit djb2, hex) for a query or mutation key, so events from one key group
 * together and the key's segments (ids, slugs) stay out of the event. NOT a privacy guarantee: it is
 * non-cryptographic and a short or guessable key can be recovered by trying candidates.
 */
export function groupingId(value: string): string {
  let h = 5381
  for (let i = 0; i < value.length; i++) h = (h * 33) ^ value.charCodeAt(i)
  return (h >>> 0).toString(16)
}

/**
 * The sink an unset `telemetry` gets outside production: query and mutation failures, which nothing
 * else surfaces (route, render and window errors already log themselves). Ids and error names only.
 */
export const devConsoleSink: Telemetry = (event) => {
  if (event.type === 'query.error' || event.type === 'mutation.error')
    console.error(`[basalt] ${event.type}`, event.attributes)
}

/** `error.name`, `'Error'` for a non-`Error` throw. */
export const errorName = (error: unknown): string => (error instanceof Error ? error.name : 'Error')

/**
 * The wrapped emitter over a sink read at call time (a ref), so a swapped sink is never stale. It is
 * called synchronously and a throwing sink never breaks a render; no sink, no events. Its
 * `startChatTurn` forwards the sink's hook; the hook's consumer validates the headers.
 */
export function createLiveEmitter(read: () => Telemetry | undefined): Telemetry {
  const emit = (event: BasaltEvent): void => {
    try {
      read()?.(event)
    } catch {
      // a throwing sink must never break the app (§ 7 delivery rules)
    }
  }
  return Object.assign(emit, {
    startChatTurn(turn: ChatTurnInit): ChatTurnTrace | undefined {
      try {
        return read()?.startChatTurn?.(turn)
      } catch {
        return undefined
      }
    },
  })
}

/**
 * The provider's wrapped emitter, for hooks that emit their own events (`useAgentThreadRuns`'
 * `chat.turn`). `undefined` outside a `BasaltProvider`, where such a hook emits nothing.
 */
export const TelemetryContext = createContext<Telemetry | undefined>(undefined)

/**
 * On `context.__basalt` of a `basaltRouterOptions` router: where its `defaultOnCatch` reports to.
 * The factory and `bindRouteError` are the only two places that know this key.
 */
export type RouterHook = { onRouteError?: ((error: unknown) => void) | undefined }

function hookOf(context: unknown): RouterHook | undefined {
  if (typeof context !== 'object' || context === null || !('__basalt' in context)) return undefined
  const hook = context.__basalt
  return typeof hook === 'object' && hook !== null ? hook : undefined
}

/**
 * Points the router's `route.error` hook at `handler` (the provider's emitter); returns the unbind.
 * The binding happens in the provider's effect, so a route error thrown before the first provider
 * effect (a loader failing during the initial load) is logged in dev but not emitted. A router
 * without the hook was not built with `basaltRouterOptions`: nothing is bound and dev warns.
 */
export function bindRouteError(
  router: { options: { context?: unknown } },
  handler: (error: unknown) => void,
): () => void {
  const hook = hookOf(router.options.context)
  if (!hook) {
    if (process.env.NODE_ENV !== 'production')
      console.warn(
        '[basalt] route.error telemetry is off: the router was not built with `basaltRouterOptions()` (or `createBasaltRouter`).',
      )
    return () => {}
  }
  hook.onRouteError = handler
  return () => {
    if (hook.onRouteError === handler) hook.onRouteError = undefined
  }
}
