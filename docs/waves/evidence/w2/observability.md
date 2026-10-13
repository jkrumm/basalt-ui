# W2 observability decision

## Verdict

V2-SPEC § 7 is **adopted as written**, with two W2-only departures that live in the playground's
consumer-side `telemetry.ts` and disappear when W3 builds the seam. Nothing in § 7 is amended.

| W2 departure                                                                           | Reason                                                                                                                            |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Events are hand-emitted from today's sources, not from `BasaltProvider telemetry`      | the seam does not exist in 1.41; `emit` in `telemetry.ts` is the § 7 sink verbatim, so W3 swaps the sources and keeps the mapping |
| `render.error` and `window.error` both come from `BasaltProvider onError` (`ctx.kind`) | 1.41's provider already installs the `window` `error` / `unhandledrejection` listeners; adding our own would double-count         |

`route.error` is not emitted (needs `createBasaltRouter`'s `defaultOnCatch`, W3). `query.error` /
`mutation.error` ship as `observeQueryClient(client)`, but the playground's two query pages each own a
private `QueryClient` and are outside W2's file set, so the baseline records 0 of them by
construction. W3 gets one app-level client via `createBasaltRouter({ query })`.

## What ships

- `apps/playground/src/telemetry.ts`: `startTelemetry(router)` returns `{ onError, observeQueryClient }`.
  OTel web tracer (`@opentelemetry/sdk-trace-web`, `BatchSpanProcessor`, OTLP/HTTP **JSON** exporter)
  with `service.name=basalt-playground`, `service.version`, `deployment.environment`.
- `main.tsx` loads it through a guarded dynamic import. Verified: a build without either flag
  contains no `telemetry` chunk and no `__BASALT_OTLP__` string.
- Exact-pinned playground devDependencies (all past the 3-day `minimumReleaseAge`):
  `@opentelemetry/api` 1.9.1, `sdk-trace-web` 2.12.0, `sdk-trace-base` 2.12.0,
  `exporter-trace-otlp-http` 0.223.0, `resources` 2.12.0.

## Activation

| Flag                            | Where                      | Effect                                                                               |
| ------------------------------- | -------------------------- | ------------------------------------------------------------------------------------ |
| `VITE_TELEMETRY=1`              | build time                 | bundles the telemetry chunk; endpoint comes from the runtime override                |
| `VITE_OTLP_ENDPOINT=<base url>` | build time                 | bundles it and bakes the endpoint in (`<base>/v1/traces`)                            |
| `window.__BASALT_OTLP__`        | runtime, before app script | overrides the endpoint; the evidence lane sets it through Playwright `addInitScript` |

**`scripts/evidence/index.ts` must build the playground with `VITE_TELEMETRY=1`** (e.g.
`VITE_TELEMETRY=1 bun run build` in `apps/playground`). Without it the `otel` lane sees zero spans.
The flag is harmless to the other lanes' route-chunk gzip numbers except that it adds one lazy chunk
(`telemetry-*.js`); `index.ts` should exclude it from the per-route chunk table, or build twice.

## Evidence lane

`scripts/evidence/otel.ts` (`export const otel: Lane`) builds nothing. Per run it opens a fresh
context (1280x800, DPR 1), loads `baseUrl`, then clicks the in-app nav link for a fixed list of 11
routes (real SPA navigation, no reloads). `otel-receiver.ts` is a `Bun.serve` OTLP/HTTP JSON receiver
on a random localhost port, with CORS for the exporter's preflight. Reported: span counts per type
(median of N=3 runs), p50 `route.navigate` duration (median of per-run p50s, ms), errors seen (expect
0), page errors, routes with no visible link. Counts are deterministic (12 `route.navigate` per run:
11 clicks plus the initial resolve); durations are not, and are the only noisy row (observed p50
41-60 ms across four local runs).

## Local collector

The mini's ClickStack/HyperDX OTLP endpoint was probed with `curl --max-time 3 POST
localhost:4318/v1/traces`: unreachable from this worktree session (no listener). It is **not
required**: the lane always uses its own in-process receiver. To also see the traces in HyperDX, a
consumer build sets `VITE_OTLP_ENDPOINT=http://<collector-host>:4318` (the collector must allow the
page origin in its CORS config).

## Consumer wiring

```ts
// main.tsx
const telemetry = import.meta.env['VITE_OTLP_ENDPOINT']
  ? (await import('./telemetry')).startTelemetry(router)
  : undefined
// <BasaltProvider onError={(e, ctx) => telemetry?.onError(e, ctx)}>
// <QueryClientProvider client={qc}> + telemetry?.observeQueryClient(qc)
```

Gate with a literal `import.meta.env` check so the bundler drops the dynamic import. After W3, replace
the `onError` and subscriptions with `BasaltProvider telemetry={emit}`.

## Open for W3 / W11

- `route.navigate.attributes['basalt.route.id']` is the deepest match's `routeId` at `onResolved`.
- Whether `@hyperdx/browser` registers the global tracer provider (spec open item) is not tested here.
