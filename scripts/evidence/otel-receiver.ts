/**
 * Minimal in-process OTLP/HTTP receiver — JSON only (the playground's exporter is the JSON one),
 * no protobuf. Collects spans for the `otel` evidence lane; dies with the process that started it.
 */
export type CollectedSpan = {
  name: string
  /** Epoch ms. */
  start: number
  /** ms. */
  duration: number
  failed: boolean
  attributes: Record<string, string | number | boolean>
}

export type OtelReceiver = {
  /** Base URL without the `/v1/traces` suffix — what `window.__BASALT_OTLP__` takes. */
  url: string
  spans: () => CollectedSpan[]
  stop: () => void
}

type OtlpValue = {
  stringValue?: string
  intValue?: string | number
  doubleValue?: number
  boolValue?: boolean
}
type OtlpSpan = {
  name: string
  startTimeUnixNano: string
  endTimeUnixNano: string
  status?: { code?: number }
  attributes?: Array<{ key: string; value: OtlpValue }>
}
type OtlpBody = { resourceSpans?: Array<{ scopeSpans?: Array<{ spans?: OtlpSpan[] }> }> }

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
}

function attrValue(v: OtlpValue): string | number | boolean {
  if (v.stringValue !== undefined) return v.stringValue
  if (v.boolValue !== undefined) return v.boolValue
  if (v.intValue !== undefined) return Number(v.intValue)
  return v.doubleValue ?? ''
}

/** OTLP/HTTP JSON `resourceSpans` → flat spans. */
export function decodeOtlp(body: OtlpBody): CollectedSpan[] {
  const out: CollectedSpan[] = []
  for (const rs of body.resourceSpans ?? []) {
    for (const ss of rs.scopeSpans ?? []) {
      for (const s of ss.spans ?? []) {
        const start = Number(BigInt(s.startTimeUnixNano) / 1000n) / 1000
        const end = Number(BigInt(s.endTimeUnixNano) / 1000n) / 1000
        out.push({
          name: s.name,
          start,
          duration: end - start,
          failed: s.status?.code === 2,
          attributes: Object.fromEntries(
            (s.attributes ?? []).map((a) => [a.key, attrValue(a.value)]),
          ),
        })
      }
    }
  }
  return out
}

export function startOtelReceiver(): OtelReceiver {
  const collected: CollectedSpan[] = []
  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    async fetch(req) {
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
      if (req.method !== 'POST' || new URL(req.url).pathname !== '/v1/traces') {
        return new Response('not found', { status: 404, headers: CORS })
      }
      try {
        collected.push(...decodeOtlp((await req.json()) as OtlpBody))
      } catch {
        return new Response('bad request', { status: 400, headers: CORS })
      }
      return new Response('{}', { headers: { ...CORS, 'content-type': 'application/json' } })
    },
  })
  return {
    url: `http://127.0.0.1:${server.port}`,
    spans: () => collected,
    stop: () => void server.stop(true),
  }
}
