/**
 * Consumer-side telemetry for the playground — the `telemetry` sink `BasaltProvider` takes
 * (V2-SPEC § 7), mapped to OTel spans.
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
import type { BasaltEvent } from 'basalt-ui'

declare global {
  interface Window {
    // oxlint-disable-next-line no-underscore-dangle -- the runtime-override name the evidence lane sets
    __BASALT_OTLP__?: string
  }
}

// Defined by `basaltViteConfig` (see vite.config.ts); same local declaration as routes/__root.tsx.
declare const __APP_VERSION__: string

// oxlint-disable-next-line no-underscore-dangle
const url = window.__BASALT_OTLP__ ?? import.meta.env['VITE_OTLP_ENDPOINT']

if (url) {
  new WebTracerProvider({
    resource: resourceFromAttributes({
      'service.name': 'basalt-playground',
      'service.version': __APP_VERSION__,
      'deployment.environment': import.meta.env.MODE,
    }),
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({ url: `${url.replace(/\/$/, '')}/v1/traces` }),
        { scheduledDelayMillis: 300 },
      ),
    ],
  }).register()
}

const tracer = trace.getTracer('basalt-ui')

export function telemetry(e: BasaltEvent): void {
  const span = tracer.startSpan(e.type, { startTime: e.start, attributes: { ...e.attributes } })
  if (e.failed) span.setStatus({ code: SpanStatusCode.ERROR })
  span.end('duration' in e ? e.start + e.duration : e.start)
}
