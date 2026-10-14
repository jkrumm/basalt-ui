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
  | Err<'query.error', { 'basalt.query.hash': string; 'basalt.query.failure_count': number }>
  | Err<'mutation.error', { 'basalt.mutation.key': string }>
  | Err<'render.error', { 'basalt.error.boundary': 'root' }>
  | Err<'window.error', { 'basalt.error.source': 'error' | 'unhandledrejection' }>
  | Ok<'chat.turn', ChatAttrs>
  | Err<'chat.turn', ChatAttrs, Span>

/** W3C trace-context request headers a sink contributes to one chat turn's request. */
export type TraceHeaders = {
  readonly traceparent: string
  readonly tracestate?: string | undefined
}

/** How a traced chat turn ended: its `chat.turn` event fired (`settled`/`failed`) or it was cut short. */
export type ChatTurnEnd = 'settled' | 'failed' | 'stopped'

/**
 * What a sink returns from `startChatTurn`. `settle` runs once, synchronously, right after the
 * turn's `chat.turn` event (`settled`/`failed`), or when a `stop()`/unmount cuts the turn short
 * (`stopped`, which emits no event) — the point to end a span opened in `startChatTurn`.
 */
export type ChatTurnTrace = {
  readonly headers: TraceHeaders
  readonly settle?: ((end: ChatTurnEnd) => void) | undefined
}

/**
 * The event sink. It may carry one optional hook, `startChatTurn`, called when a new chat turn
 * begins (not on a resume): open your span there and return its `traceparent` (and `tracestate`)
 * and `aiSdkTransport` sends them with that turn's request to the chat endpoint — never anywhere
 * else. A sink without the hook, or no sink, changes nothing on the wire. basalt has no OTel
 * dependency; the hook is where the consumer's SDK does the work.
 *
 * @example
 * export const telemetry: Telemetry = Object.assign(onEvent, {
 *   startChatTurn({ threadId }) {
 *     const span = tracer.startSpan('chat.turn', { attributes: { 'basalt.chat.thread_id': threadId } })
 *     const carrier: Record<string, string> = {}
 *     propagation.inject(trace.setSpan(context.active(), span), carrier)
 *     return { headers: { traceparent: carrier.traceparent ?? '', tracestate: carrier.tracestate }, settle: () => span.end() }
 *   },
 * })
 */
export type Telemetry = ((event: BasaltEvent) => void) & {
  readonly startChatTurn?:
    | ((turn: {
        readonly threadId: string
        readonly messageId: string
      }) => ChatTurnTrace | undefined)
    | undefined
}

export const now = (): number => performance.timeOrigin + performance.now()

/** `error.name`, `'Error'` for a non-`Error` throw. */
export const errorName = (error: unknown): string => (error instanceof Error ? error.name : 'Error')

/**
 * Wrap a sink so it is called synchronously and a throwing sink never breaks a render. No sink, no
 * events.
 */
export function createEmitter(sink: Telemetry | undefined): Telemetry {
  if (sink === undefined) return noop
  return createLiveEmitter(() => sink)
}

/** `createEmitter` over a sink read at call time (a ref), so a swapped sink is never stale. */
export function createLiveEmitter(read: () => Telemetry | undefined): Telemetry {
  const emit = (event: BasaltEvent): void => {
    try {
      read()?.(event)
    } catch {
      // a throwing sink must never break the app (§ 7 delivery rules)
    }
  }
  return Object.assign(emit, {
    startChatTurn(turn: { readonly threadId: string; readonly messageId: string }) {
      try {
        const trace = read()?.startChatTurn?.(turn)
        // A malformed carrier is dropped: no header is better than a corrupt one.
        return typeof trace?.headers.traceparent === 'string' && trace.headers.traceparent !== ''
          ? trace
          : undefined
      } catch {
        return undefined
      }
    },
  })
}

function noop(): void {}

/**
 * The provider's wrapped emitter, for hooks that emit their own events (`useAgentThreadRuns`'
 * `chat.turn`). `undefined` outside a `BasaltProvider`, where such a hook emits nothing.
 */
export const TelemetryContext = createContext<Telemetry | undefined>(undefined)

/** The event sink of the provider mounted on a router, read by `createBasaltRouter`'s `onCatch`. */
const routerSinks = new WeakMap<object, Telemetry>()

export function bindRouterTelemetry(router: object, emit: Telemetry): () => void {
  routerSinks.set(router, emit)
  return () => {
    if (routerSinks.get(router) === emit) routerSinks.delete(router)
  }
}

export function routerTelemetry(router: object): Telemetry {
  return routerSinks.get(router) ?? noop
}
