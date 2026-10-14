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

export type Telemetry = (event: BasaltEvent) => void

export const now = (): number => performance.timeOrigin + performance.now()

/** `error.name`, `'Error'` for a non-`Error` throw. */
export const errorName = (error: unknown): string => (error instanceof Error ? error.name : 'Error')

/**
 * Wrap a sink so it is called synchronously and a throwing sink never breaks a render. No sink, no
 * events.
 */
export function createEmitter(sink: Telemetry | undefined): Telemetry {
  if (sink === undefined) return noop
  return (event) => {
    try {
      sink(event)
    } catch {
      // a throwing sink must never break the app (§ 7 delivery rules)
    }
  }
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
