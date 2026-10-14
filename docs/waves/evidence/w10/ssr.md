# Wave 10 — streaming SSR lane, baseline on master @ af79408

`make evidence LABEL=w10-ssr LANES=ssr` (re-run with a new label after the chart render-cost and
SSR-contract PRs land; no edits needed). Raw runs: `.evidence/<label>/ssr.json`. The partial-run
summary lands at `docs/waves/evidence/w2/<label>.ssr.md`.

## What it measures

A fixture app (`scripts/evidence/ssr-fixture/`) on `Bun.serve`, built from `packages/basalt-ui/dist`:
`BasaltProvider` + a TanStack Router instance, the dashboard's shapes (KPI row of `StatCard`s, a `Lines`
chart, a `Bars` chart, a `BasaltDataTable`). The shell holds no promise; each section has an unawaited
loader promise (150 / 300 / 450 / 600 ms) read through `<Await>` inside `<Suspense>`, whose fallback is a
fixed-height box. Two measurements, median of 5 runs after a warm-up:

- **server** — `fetch` + per-chunk timing, no browser: shell flush, per-section completion, chunk count.
- **browser** — real Chrome, fresh context per run, 1x and 4x CPU: TTFB, FCP, shell visible, per-section
  _in DOM_ (streamed content present, still in React's hidden `S:n` div) and _revealed_ (outside every
  `[hidden]` ancestor), CLS, hydration (mark before `hydrateRoot` → first effect after commit), console errors.

## Baseline

| Metric                                          | Value                           | Unit   |
| ----------------------------------------------- | ------------------------------- | ------ |
| server: shell flush                             | 7.6                             | ms     |
| server: kpis / trend / mix / table complete     | 155.4 / 308 / 457.3 / 612.9     | ms     |
| server: stream chunks                           | 5                               | chunks |
| server: document size                           | 70882                           | bytes  |
| browser 1x: TTFB                                | 4                               | ms     |
| browser 1x: FCP                                 | 80                              | ms     |
| browser 1x: shell visible                       | 11.6                            | ms     |
| browser 1x: kpis / trend / mix / table in DOM   | 156 / 306.2 / 457 / 610.7       | ms     |
| browser 1x: kpis / trend / mix / table revealed | 375.7 / 375.7 / 1041.2 / 1041.2 | ms     |
| browser 1x: hydration start / duration          | 656.4 / 13.3                    | ms     |
| browser 1x: CLS                                 | 0                               | score  |
| browser 4x: TTFB                                | 6.1                             | ms     |
| browser 4x: FCP                                 | 256                             | ms     |
| browser 4x: shell visible                       | 122.4                           | ms     |
| browser 4x: kpis / trend / mix / table revealed | 252.1 / 534.8 / 553.6 / 1579.4  | ms     |
| browser 4x: hydration start / duration          | 847.5 / 127.4                   | ms     |
| browser 4x: CLS                                 | 0                               | score  |
| console errors, all runs                        | 0                               |        |

Full table (every metric, both throttles): the `ssr` section of the evidence summary.

## Findings

1. **Router SSR streaming works without TanStack Start** (`@tanstack/react-router` 1.170.38,
   `@tanstack/router-core` 1.171.32, `react-dom` 19.3.0). The pair `createRequestHandler` + `renderRouterToStream`
   (both from `@tanstack/react-router/ssr/server`) is what `defaultStreamHandler` composes; the fixture passes
   its own `children` instead of `RouterServer`. Shell flush is 7.6 ms with four unawaited loader promises,
   so **router issue #7094 does not reproduce here** (see finding 3 for the only buffering that did).
2. **Bots get a buffered document.** `renderRouterToStream` runs `isbot()` on the User-Agent and, for a bot,
   awaits `stream.allReady` before responding (`react-router/dist/esm/ssr/renderRouterToStream.js:13,34`).
   curl, Bun's `fetch` **and Playwright's headless Chrome (`HeadlessChrome` UA)** all count as bots: TTFB was
   ~607 ms (the slowest section) instead of 4 ms. The lane therefore sets a Chrome UA for both
   measurements. Any lab tool that does not (Lighthouse CI, headless screenshots) measures a non-streamed page.
3. **React batches Suspense reveals** (React 19.3): `$RC` queues the boundary and `$RV` applies the queue at
   `$RT + 300 − now` ms (`react-dom/cjs/react-dom-server.bun.development.js:4008`, `$RT` stamped by an rAF
   at `:3875`). Content is in the DOM at server-delay + ~5 ms; it is _visible_ ~220 ms later for the first
   batch and later still after that (1x: second batch 1041 ms; 4x spread 252–1579 ms, run-to-run jitter
   large). The batching is React's, not the app's; the second-batch delay beyond `$RT + 300` was not
   root-caused. A section's perceived time is the `revealed` row, not the loader delay.
4. **Hydration starts after the stream ends** (the fixture's `<script type="module">` is deferred until the
   document finishes parsing, 656 ms at 1x), then costs 13 ms (1x) / 127 ms (4x) for this page.
   `hydrate(router)` from `@tanstack/react-router/ssr/client` must be awaited before `hydrateRoot`
   (`react-router/dist/esm/ssr/RouterClient.js:7-13` does the same inside `<Await>`).
5. **CLS 0 with fixed-height fallbacks** (hand-measured boxes in `ssr-fixture/app.tsx`). The charts and the
   table do not reserve their own box in a fallback; the SSR-contract wave is where that moves into the package.

## Wiring facts (file:line, for the spec and the shipped rules)

- The stream transform needs the literal `</body></html>` in React's output
  (`router-core/dist/esm/ssr/htmlBoundaryScanner.js:3`), so the **document must be rendered by React**.
- `BasaltProvider` emits a palette `<style>` as a sibling of the router (`src/provider/index.tsx:258`) and
  mounts `RouterProvider` inside its own tree (`:463`): a root route that renders `<html>` would sit _inside_
  the provider. The working shape is `<Document><BasaltProvider router/></Document>` with the root route
  rendering only `<Outlet/>`, and `hydrateRoot(document, …)` on the client.
- `<Await>` adds its own `<Suspense>` only when given `fallback` (`react-router/dist/esm/awaited.js:18-25`);
  it reads the promise with React's `use` (`:8`). The fixture wraps `<Await>` in an explicit `<Suspense>`.
- `createRequestHandler` returns the `Response` (`router-core/dist/esm/ssr/createRequestHandler.js:13-54`);
  `router.load()` is awaited at `:33`, dehydration at `:37`, so only awaited loader work delays the shell.
- `sizeClassHint` accepts `'compact' | 'medium' | 'expanded'` (not `'wide'`).
