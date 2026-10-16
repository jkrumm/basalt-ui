# v2 audit: provider-wiring

Scope: src/provider/**, src/state.ts + src/state/**, src/query-client.ts, src/telemetry.ts, src/register.ts, src/router-tanstack/**, src/vite-boot.ts. Base: master at ccd09d72. Not reported (in flight): #285 (Spotlight/modals/hotkeys gated on define*), #286 (doctor pathless provider, typed root-context doctor check, motion caret).

Consumers read: argo (main.tsx, lib/router.ts, lib/telemetry.ts, routes/__root.tsx, lib/window-stores.ts), linewatch, rb (lib/router.tsx, tests), basalt-ui-obsidian (demo main.tsx), weatherorb w37/basalt-2 (providers.tsx, router.tsx, query-client.ts). rollhook has no BasaltProvider usage on master.

Overall: the mount path (createBasaltRouter + BasaltProvider router=) is excellent: linewatch is 2 files, 3 lines. The embedded/Start path, the root-context typing, the test story, and telemetry are where every consumer still hand-wires. The 2.0 leftovers are mostly module-level singletons and test-driven exports.

## Findings (ranked)

### provider-01 (major, wiring, breaking: no) Embedded mode gets none of createBasaltRouter's wiring, and the pieces are not public

Evidence: create-router.tsx:96-137 owns defaultPreload, defaultPreloadStaleTime, scrollRestoration, pending/error/notFound components, defaultOnCatch (the only emitter of `route.error`), the view transition and the QueryClient. query-client.ts:16 `makeQueryClient` is not exported from index.ts (only `unwrap`, index.ts:50). weatherorb w37/basalt-2 `query-client.ts` copy-pastes the defaults ("The defaults are 1.41's ... ones (gone in 2.x)") and `router.tsx` sets only `scrollRestoration` + `context`. provider/index.tsx:427-436 `readQueryClient` is a runtime-only check on `Partial<BasaltRouterContext>`.
Wrong: a Start app silently loses intent preloading with Query-owned freshness, route pending/error/not-found UI, `route.error` telemetry (routerSinks WeakMap only fed by createBasaltRouter's onCatch, telemetry.ts:167-178) and the route view transition. It also forks the query defaults, so they drift on the next default change.
Proposal: export `basaltRouterOptions({ query?, context? })` returning `{ context: { ...context, queryClient }, defaultPreload, defaultPreloadStaleTime, scrollRestoration, defaultPending/Error/NotFoundComponent, defaultOnCatch, defaultViewTransition }`. `createBasaltRouter` becomes `createRouter({ routeTree, ...basaltRouterOptions(opts) })` plus the brand; Start's `getRouter()` spreads the same. Type embedded `children` mode on `useRouter()` having `BasaltRouterContext`. onCatch must reach the emitter without the router having been created by createBasaltRouter (see provider-10).
Consumers: weatherorb (direct); argo/rb/linewatch/obsidian unaffected.

### provider-02 (major, perf, breaking: no) Every nav anchor remounts on every navigation

Evidence: router-tanstack/use-nav.ts:167 defines `const Anchor: NavAnchor = (props) => createElement(Link, ...)` inside `toSidebarItem`, inside a `useMemo` whose deps include `href` (use-nav.ts:218, "the one value that always does move"). The shell consumes it as a component type: shell/app-breadcrumbs.tsx:86 `component={parentAnchor}`, shell/app-mobile-nav.tsx:267 `component: row.Anchor`, and the sidebar rows the same way.
Wrong: each navigation produces new function identities, so React unmounts and remounts every sidebar/mobile link (and the breadcrumb anchor). Consequences: lost focus on the clicked link (keyboard users land on body), restarted Tooltip/hover state, re-run `Link` preload subscriptions, needless DOM churn on the hottest component of the app.
Proposal: make `Anchor` identity stable per item (module-level `makeAnchor(link)` cache keyed by `config` item via WeakMap) and keep `active` as plain data (`SidebarItem.active` already carries it). The anchor must not close over `activeOptions`/`isActiveOverride` per navigation; pass `data-basalt-current` via props, which the existing `aria-current` prop path already does. Add a test: render shell, navigate, assert the same DOM node instance.
Consumers: argo, linewatch, rb, obsidian (everything with a nav).

### provider-03 (major, api, breaking: yes) Root route context is declared three times and checked nowhere at the type level

Evidence: create-router.tsx:99-103 takes `context?: TContext` but TContext is never related to the route tree. argo routes/__root.tsx:21 and rb lib/router.tsx:19 each hand-write `createRootRouteWithContext<BasaltRouterContext>()`. argo's JSDoc example (create-router.tsx:93-94) shows `context: { auth }` but the root route would need `BasaltRouterContext & { auth }` declared separately; nothing ties them. (#286 adds the doctor check; this is the type-level half.)
Wrong: a root route created with `createRootRoute()` (no context type) compiles, and `context.queryClient` in a loader is then an `any`/missing property error far from the cause; extra context can be passed that no route can read.
Proposal: ship `createBasaltRootRoute<TExtra extends object = {}>(options)` = `createRootRouteWithContext<BasaltRouterContext & TExtra>()(options)`, and constrain `createBasaltRouter<TRouteTree>` so `context` must equal `TRouteTree['types']['routerContext']` minus `queryClient` (derive TContext from the tree, drop the free generic). Drop `BasaltRouterContext` from the public docs in favour of the helper (keep the type export, it is used by embedded hosts).
Consumers: argo, rb (explicit); linewatch/obsidian use file routes (generated root also needs the helper in `routes/__root.tsx`; `init` template should emit it).

### provider-04 (major, api, breaking: no) createBasaltRouter is a closed options bag; consumers cannot test against it or configure history/basepath

Evidence: create-router.tsx:99-107 accepts only routeTree/context/query. rb has three test files that hand-roll `createRouter({ routeTree, history: createMemoryHistory(...) })` inside a bare `MantineProvider` (rb features/knot-detail/page.test.tsx:23-37, content-blocks.test.tsx:39, course/page.test.tsx:27) because BasaltProvider requires the brand and no memory history can be injected. provider/test-router.tsx is the repo's own private harness. `defaultViewTransition?: never` (create-router.tsx:106) is a one-off typed guard for one managed key.
Proposal: accept the rest of TanStack's router options with every basalt-managed key typed `never` (`Omit<RouterConstructorOptions, 'routeTree' | 'context' | 'defaultOnCatch' | ...> & { [K in Managed]?: never }`) so `history`, `basepath`, `trailingSlash`, `parseSearch`/`stringifySearch` pass through. Ship `basalt-ui/testing` `renderWithBasalt(ui, { route, history })` (promote test-router.tsx), deleting rb's three harnesses. Replace the single-key `never` with the managed-key set.
Consumers: rb (tests), any future hash-history app (obsidian plugin context).

### provider-05 (major, ssr, breaking: no) `validateSearch` reads localStorage, so server and client validate differently

Evidence: search-store.ts:355-358 `validateSearch` calls `core.readRecord()` (fields.ts:986 -> `readPersistedValue`, persisted.ts:291-303, which swallows the SSR `ReferenceError` and returns null). On the server the stored layer is empty; on the client the same URL resolves a different search object.
Wrong: TanStack docs treat `validateSearch` as pure. Under Start (weatherorb), the SSR-matched search and the client re-validation can disagree, so a loader keyed on `loaderDeps: ({search}) => search` runs with different deps on hydration, and the dev-only warnings (search-store.ts:361+) are the only signal. Nothing in the store doc, V2-SPEC section 2 SSR paragraph or basalt-state.md states that search stores are client-only.
Proposal: split the resolution: `validateSearch` is pure (URL ⊳ fallback, plus a `typeof window` gate so the stored layer can never apply on the server), and the stored layer is applied by `linkSearch`/redirect-on-miss (`beforeLoad`) on the client only. State the SSR contract in basalt-state.md and add a Start-style test (`renderToString` + hydrate) to search-store.router.test.tsx.
Consumers: weatherorb (Start); argo/rb/linewatch are SPA so unaffected.

### provider-06 (major, bug, breaking: no) `clear()` navigation closure is registered during render

Evidence: search-store.ts:308 `const urlClear = new Map`, :380 `urlClear.set(entry.name, ...)` inside `urlUse`, which is a hook body (:371). `clearFor` (:468) reads whichever render wrote last.
Wrong: side effect in render. Concurrent/StrictMode discarded renders register closures; with two mounts on different routes the "last render wins" closure may capture a `validated=false` from a foreign route, making `clear()` a silent mirror-only clear. A field no mount has read silently no-ops its URL half (documented, still a trap).
Proposal: have the URL lane navigate imperatively through a router handle: BasaltProvider already knows the router (provider/index.tsx:485), register it in a leaf bridge like `shell-bridge` (or read `router` from `useRouter` inside `field.use()` and return `clear` as the third tuple element, deleting the map). Then `clear()` works from event handlers anywhere and `validated` is computed at call time from `router.state.location.search`.
Consumers: argo (window-stores.ts, 5+ pages), rb library store.

### provider-07 (major, bug, breaking: no) "Route owns the field" is a presence heuristic

Evidence: search-store.ts:379 and :518 `Object.hasOwn(search, entry.codec.primary)`; the header documents the honest limit (lines 21-29: two stores with the same param name on overlapping routes read as one owner). `useCurrentSearch` (:~236) reads `useSearch({ strict: false })`, the merged search of every match.
Wrong: a different store, a hand-rolled schema (argo routes/astro-window.tsx composes the store with zod), or a layout route validating `range` makes a foreign write navigate and pollute the URL; the opposite error is a composed `validateSearch` that omits an optional key silently demoting the setter to persist-only.
Proposal: decide ownership exactly: match `router.state.matches` and test `match.route.options.validateSearch === store.validateSearch` (or a `store.validateSearch.owner` brand that a `store.compose(zodSchema)` helper preserves). Delete the presence heuristic and the explanatory paragraph. Provide `store.validateWith(schema)` since composing is the documented shape for argo.
Consumers: argo (composed astro-window), any app with layout+child search.

### provider-08 (major, dx, breaking: no) Every consumer hand-writes its telemetry sink; argo maintains a 70-line OTel adapter

Evidence: argo lib/telemetry.ts (openTurns map, span-per-event mapping, hand-built traceparent, OTel API pin comment); obsidian main.tsx:24-29 console sink; telemetry.ts:96-124 ships the recipe only as JSDoc. linewatch and rb pass no sink at all, so their route/query/render errors vanish in production.
Proposal: ship two tiny structural adapters from `.` (still zero OTel dependency): `consoleTelemetry()` (obsidian is the named consumer) and `otelTelemetry(tracer)` taking a structurally typed minimal Tracer (`startSpan`, `SpanStatusCode`) that implements the event-to-span mapping and the `startChatTurn`/`settle` pairing; argo is the named consumer and deletes 70 lines. Default `BasaltProvider` in dev to `consoleTelemetry` when `telemetry` is unset so dev errors are visible (currently only `console.error` in a few branches).
Budget: +2 exports needs the adopt-or-delete note in MIGRATING (both have named consumers).
Consumers: argo, obsidian; rb/linewatch gain error visibility.

### provider-09 (major, bug, breaking: no) Telemetry privacy contract is broken by the mutation key

Evidence: telemetry.ts:5-6 says events never carry search params or query data; provider/index.tsx:403 emits `'basalt.mutation.key': JSON.stringify(ev.mutation.options.mutationKey ?? null)`. Mutation keys routinely embed ids/slugs (`['knot', slug, 'update']`). The query event uses `queryHash` (also a stringification of the key, but typed as a hash in the attribute name).
Proposal: hash both (same djb2/fnv helper) or emit only the key's first segment (`'basalt.mutation.scope'`). Type the attribute name accordingly; add a test that no event attribute value contains a raw key segment.
Consumers: argo (HyperDX).

### provider-10 (minor, layering, breaking: no) Three mechanisms plumb one emitter

Evidence: `TelemetryContext` (telemetry.ts:164), the `routerSinks` WeakMap with `bindRouterTelemetry`/`routerTelemetry` (:167-178, bound in provider/index.tsx:357), and the `sinkRef` + `createLiveEmitter` (provider/index.tsx:475-479). `route.error` is the only event that needs the WeakMap (the router is created before any provider exists).
Proposal: make `basaltRouterOptions` (provider-01) own a router-scoped emitter created with the router (`createLiveEmitter` over a settable sink held in the router's own context, `context.__basalt.emit`), and let the provider only set its sink. Deletes the WeakMap and the bind/unbind pair; embedded mode gets `route.error` for free.

### provider-11 (minor, dx, breaking: no) Query defaults are one-size and the 401 plumbing is hand-wired twice

Evidence: query-client.ts:8-13 `retry: 2` retries 4xx; argo lib/router.ts:15-33 overrides `retry` with a 401-aware function and registers the same `onUnauthorized` on both `QueryCache` and `MutationCache`; rb router.tsx sets `retry: false` and re-passes `refetchOnWindowFocus: false`, which is already the default. `unwrap` throws the raw `error` (query-client.ts:93) typed `unknown`, so a retry predicate cannot classify it.
Proposal: (a) default `retry` to `(n, error) => n < 2 && !isClientError(error)`; (b) `unwrap` throws a branded `HttpError`-shaped value when `error.status` exists, and export `isHttpError(error, status?)`; (c) add `createBasaltRouter({ onError })`, one global handler wired to both caches, deleting argo's duplicated cache construction.

### provider-12 (minor, dx, breaking: no) `unwrap` guards are loose

Evidence: query-client.ts:71 `response instanceof Promise` misses non-native thenables; :93 `if (error) throw error` ignores falsy-but-present errors (`0`, `''`); file header says "unwrap plus the QueryClient factory" and the 40-line JSDoc re-tells TS-history (":40-57") better kept in a type test. The `unwrap` home is the query client module although it has no query dependency.
Proposal: `typeof response.then === 'function'`, `error !== null && error !== undefined`, move `unwrap` to its own `unwrap.ts`, trim JSDoc to behaviour + one example (the type fixtures already pin it).

### provider-13 (minor, dead-code, breaking: yes) `useBasaltNav().isActive` has no consumer and a second active-state definition

Evidence: router-tanstack/index.ts:38-51 string-prefix `isActive` vs use-nav.ts:100-135 matchRoute-based winner/ancestor model (case, params, trailing slash semantics differ). Only consumer: obsidian routes/__root.tsx:60 reads `currentPath` only; no consumer calls `isActive`.
Proposal: delete `useBasaltNav` (obsidian uses `useLocation({ select: l => l.pathname })`), and with it the index.ts barrel body (the file then only holds the `StaticDataRouteOption` augmentation). Adopt-or-delete: no named consumer for `isActive`. Net-negative.

### provider-14 (minor, api, breaking: yes) `injectPalette` and `nonce` are misleading knobs

Evidence: provider/index.tsx:65-69 `injectPalette` also gates fonts, radius and density CSS (composed at :284-289); :78-81 `nonce` covers only the `<style>`, with Mantine's `getStyleNonce` required separately via `...rest`.
Proposal: replace `injectPalette: boolean` with `tokensCss?: 'inline' | 'external'` (documented as all token CSS) and derive `getStyleNonce` from `nonce` unless the consumer passed one. No consumer sets `injectPalette=false`; weatherorb (SSR) is the likely future user.

### provider-15 (minor, docs, breaking: no) Defaults restated by consumers; default color scheme has two sources of truth

Evidence: provider default `defaultColorScheme = 'dark'` (index.tsx:462); rb main.tsx and obsidian main.tsx and argo main.tsx all pass `defaultColorScheme="dark"` (the default). vite.ts:246-250 `colorScheme` must be "whatever the app passes as defaultColorScheme" and vite-boot.ts:33 hardcodes Mantine's storage key, so a custom `colorSchemeManager` through `...rest` silently breaks the boot script (vite.ts:267 documents it).
Proposal: omit the prop from the init template and basalt-app skill; make `basaltAppPlugin` define `__BASALT_COLOR_SCHEME__` that the provider reads as its default (one source), and have the provider omit `colorSchemeManager` from `...rest` (Omit it in `BasaltProviderCommonProps`, like `cssVariablesResolver`).

### provider-16 (minor, api, breaking: no) Test-driven exports and an unexported props type

Evidence: provider/index.tsx exports `RootBoundary` (:153), `composeInjectedCss` (:193), `useHostAttribute` (:221) only for tests; the file is 556 lines mixing boundary, host attribute, bridge, three telemetry hooks, dev dock. `BasaltProviderProps` is not exported from the root barrel (index.ts:9 exports only the component), so a consumer wrapper cannot type its props (weatherorb re-declares `Readonly<{ children }>`).
Proposal: split into `root-boundary.tsx`, `host-attribute.ts`, `telemetry-sources.ts`, `palette-style.tsx`; keep tests importing from those. Export `type BasaltProviderProps`.

### provider-17 (minor, layering, breaking: no) Module-level singleton registries are last-wins and leak across requests/tests

Evidence: `activeNav` (nav.ts:180), `activeCommands` (define-commands.ts:112), `activeOverlays` (define-overlays.ts:135), shell-bridge refs, `providerMounts`/`hostAttributeMounts` counters (provider/index.tsx:210, 310), `routerSinks`. `routeViewTransition` reads `getActiveNav()` at transition time (route-transition.ts).
Wrong: under Start/SSR a module-scope registry is shared across requests (benign for static `defineNav`, wrong the moment a definition depends on request data); tests that mount two providers clobber each other; HMR re-evaluating `nav.tsx` swaps the registry while an old provider reads the new one.
Proposal (owner decision, trade-off: loses the zero-wiring win): let `createBasaltRouter({ routeTree, nav, commands, overlays })` take the definitions and carry them in router context; BasaltProvider reads them from `router`. `defineX` stay pure identity builders. At minimum document last-wins and add `resetBasaltRegistries()` for tests. Interacts with #285 (which keys on "ran"), so sequence after it.

### provider-18 (minor, a11y/typing, breaking: no) Basalt violates its own `as never` rule

Evidence: provider/spotlight-actions.tsx:57 `router.navigate(item.link as never)`; use-nav.ts:174 `Link as ElementType`; basalt-state.md:38 and the nav doctrine say never silence nav type errors with `as never`. obsidian copies the pattern (routes/__root.tsx:56, lib/vault-search-spotlight.tsx:150).
Proposal: export a typed `navigateTo(router, link: AnyNavLink)` helper from nav.ts (single documented cast), use it in spotlight-actions, and recommend it in the obsidian migration; add an oxlint `no-as-never-in-nav` check to the basalt plugin.

### provider-19 (minor, perf, breaking: no) Spotlight actions are built on mount and again on every open

Evidence: provider/index.tsx:493-499 `useEffect(() => { if (spotlight) refreshActions() })` runs `buildSpotlightActions` (reads `navigator` via `detectMac`, iterates all commands) on mount, then `onSpotlightOpen={refreshActions}` (:545) rebuilds on every open. The mount-time call exists only so the first render is non-empty, which the open callback already covers.
Proposal: drop the mount effect, build in `onSpotlightOpen` only (Mantine fills actions before first paint of the modal); saves a state update and a full provider re-render at boot. Re-verify once #285 lands, as it reshapes this block.

### provider-20 (minor, docs, breaking: no) Docs and comments disagree with the code

Evidence: V2-SPEC section 2 row (line 93) says `defineCommands` registers the hotkeys `import()` loader and `.` never references the peer, but provider/hotkeys.ts:1-8 says "`defineCommands` has no loader-registration seam yet" and imports `@tanstack/react-hotkeys` directly in the provider. register.ts:38-40 says `router`, `query` and `state` slots "remain advisory" though no such slot exists in BasaltRegister consumers. register.ts is a grab-bag: slot machinery, `AsyncState`/`assertNever` (not exported from any barrel; used inside agent/fence-block only), Standard Schema vendoring, and the `__APP_VERSION__` global (register.ts:205).
Proposal: fix V2-SPEC to the actual seam (or build the seam; #285 may), delete the advisory sentence, move `AsyncState`/`assertNever` into `common/` (or delete if internal-only) and `StandardSchemaV1` into `schema.ts`, keep register.ts to `BasaltRegister` + `Slot` + `SeriesKey`. `check-agent-doc-drift` should cover V2-SPEC section 2 row claims about `defineCommands`.

### provider-21 (minor, dead-code, breaking: no) createSearchStore wrapper, mutable `labels`, and a closure doing too much

Evidence: search-store.ts:601-605 `createSearchStore` only calls `buildSearchStore` (shallow wrapper; rename and drop one). `labels` (:567-570) is typed as a chainable returning `SearchStore<S>` but mutates `core` labels and returns the same object, so two chained calls silently merge. The closure holds five independent dev-warning state sets (:267-272) in a 605-line function.
Proposal: collapse to one exported `createSearchStore`; make labels a definition-time option (`labels: {...}`) per the "call it once" comment; extract `search-store-warnings.ts` (the five warn functions + sets) so the store body is the lane logic only.

### provider-22 (minor, test, breaking: no) Search-store tests are three overlapping suites with no SSR coverage

Evidence: search-store.test.ts (578), search-store.router.test.tsx (1156), state/fields.test.tsx (772), external-field.test.tsx. No test renders under `renderToString` + hydration; the SSR claim lives in persisted.ts:4 only.
Proposal: add one boundary test per lane via `renderWithBasalt` (provider-04) asserting server HTML equals first client render, and trim the router suite where it asserts the warn-once bookkeeping rather than behaviour.

## Quick-win ordering

1. provider-02 (remount bug, tiny fix, high user impact)
2. provider-01 + provider-10 + provider-03 (one wave: router options factory, root helper, emitter ownership)
3. provider-05/06/07 (search-store correctness) in one wave
4. provider-08/09 (telemetry adapters, privacy)
5. provider-04 (passthrough options + `basalt-ui/testing`), then 11-22 as a net-negative cleanup wave (13, 16, 20, 21 delete more than they add).
