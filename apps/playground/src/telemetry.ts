/**
 * Consumer-side telemetry for the playground — V2-SPEC § 7's event shapes emitted by hand from what
 * 1.x exposes, mapped to OTel spans. W3 replaces the hand-rolled sources with the `telemetry` seam
 * on `BasaltProvider`; `emit` below is that seam's sink, verbatim.
 *
 * Loaded only through the guarded dynamic import in `main.tsx`, so a build without
 * `VITE_TELEMETRY=1` / `VITE_OTLP_ENDPOINT` carries none of it. The exporter URL is
 * `window.__BASALT_OTLP__` when present (runtime override, set by the evidence lane through
 * Playwright `addInitScript`), else the build-time `VITE_OTLP_ENDPOINT`.
 */
import { SpanStatusCode, trace } from '@opentelemetry/api'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import type { AnyRouter } from '@tanstack/react-router'
import type { BasaltErrorContext } from 'basalt-ui'

declare global {
  interface Window {
    // oxlint-disable-next-line no-underscore-dangle -- the runtime-override name the evidence lane sets
    __BASALT_OTLP__?: string
  }
}

type Failure = { 'exception.type': string; 'basalt.error.kind': string }

/** The § 7 union, local until W3 exports `BasaltEvent` from basalt-ui. */
type PlaygroundEvent =
  | {
      type: 'route.navigate'
      failed: false
      start: number
      duration: number
      attributes: { 'basalt.route.id': string; 'basalt.route.from': string; 'url.path': string }
    }
  | {
      type: 'query.error'
      failed: true
      start: number
      attributes: { 'basalt.query.hash': string; 'basalt.query.failure_count': number } & Failure
    }
  | {
      type: 'mutation.error'
      failed: true
      start: number
      attributes: { 'basalt.mutation.key': string } & Failure
    }
  | {
      type: 'render.error'
      failed: true
      start: number
      attributes: { 'basalt.error.boundary': 'root' } & Failure
    }
  | {
      type: 'window.error'
      failed: true
      start: number
      attributes: { 'basalt.error.source': 'error' | 'unhandledrejection' } & Failure
    }

const now = (): number => performance.timeOrigin + performance.now()
const errorName = (error: unknown): string => (error instanceof Error ? error.name : 'Error')

export type PlaygroundTelemetry = {
  /** Pass to `BasaltProvider onError` — covers `render.error` and `window.error`. */
  onError: (error: unknown, ctx: BasaltErrorContext) => void
  /** Subscribe one QueryClient's caches for `query.error` / `mutation.error`. */
  observeQueryClient: (client: import('@tanstack/react-query').QueryClient) => () => void
}

export function startTelemetry(router: AnyRouter): PlaygroundTelemetry {
  // oxlint-disable-next-line no-underscore-dangle
  const url = window.__BASALT_OTLP__ ?? import.meta.env['VITE_OTLP_ENDPOINT']
  if (!url) return { onError: () => {}, observeQueryClient: () => () => {} }

  const provider = new WebTracerProvider({
    resource: resourceFromAttributes({
      'service.name': 'basalt-playground',
      'service.version': '1.0.0',
      'deployment.environment': import.meta.env.MODE,
    }),
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({ url: `${url.replace(/\/$/, '')}/v1/traces` }),
        {
          scheduledDelayMillis: 300,
        },
      ),
    ],
  })
  provider.register()
  const tracer = trace.getTracer('basalt-ui')

  function emit(e: PlaygroundEvent): void {
    try {
      const span = tracer.startSpan(e.type, { startTime: e.start, attributes: { ...e.attributes } })
      if (e.failed) span.setStatus({ code: SpanStatusCode.ERROR })
      span.end('duration' in e ? e.start + e.duration : e.start)
    } catch {
      // a throwing sink must never break the app (§ 7 delivery rules)
    }
  }

  let pending: { start: number; from: string } | undefined
  router.subscribe('onBeforeNavigate', (ev) => {
    pending = { start: now(), from: ev.fromLocation?.pathname ?? '' }
  })
  router.subscribe('onResolved', (ev) => {
    if (!pending) return
    const { start, from } = pending
    pending = undefined
    emit({
      type: 'route.navigate',
      failed: false,
      start,
      duration: now() - start,
      attributes: {
        'basalt.route.id': router.state.matches.at(-1)?.routeId ?? 'unknown',
        'basalt.route.from': from,
        'url.path': ev.toLocation.pathname,
      },
    })
  })

  return {
    onError(error, ctx) {
      const base = { 'exception.type': errorName(error), 'basalt.error.kind': ctx.kind }
      if (ctx.kind === 'render') {
        emit({
          type: 'render.error',
          failed: true,
          start: now(),
          attributes: { ...base, 'basalt.error.boundary': 'root' },
        })
        return
      }
      emit({
        type: 'window.error',
        failed: true,
        start: now(),
        attributes: {
          ...base,
          'basalt.error.source': ctx.kind === 'window' ? 'error' : 'unhandledrejection',
        },
      })
    },
    observeQueryClient(client) {
      const offQuery = client.getQueryCache().subscribe((ev) => {
        if (ev.type !== 'updated' || ev.action.type !== 'error') return
        emit({
          type: 'query.error',
          failed: true,
          start: now(),
          attributes: {
            'basalt.query.hash': ev.query.queryHash,
            'basalt.query.failure_count': ev.query.state.fetchFailureCount,
            'exception.type': errorName(ev.action.error),
            'basalt.error.kind': 'query',
          },
        })
      })
      const offMutation = client.getMutationCache().subscribe((ev) => {
        if (ev.type !== 'updated' || ev.action.type !== 'error') return
        emit({
          type: 'mutation.error',
          failed: true,
          start: now(),
          attributes: {
            'basalt.mutation.key': JSON.stringify(ev.mutation.options.mutationKey ?? null),
            'exception.type': errorName(ev.action.error),
            'basalt.error.kind': 'mutation',
          },
        })
      })
      return () => {
        offQuery()
        offMutation()
      }
    },
  }
}
