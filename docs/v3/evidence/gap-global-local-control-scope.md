# Gap: global / page / widget / local control scope (v3 input)

Date 2026-11-09. Brief: `.claude/plans/v3/BRIEF.md` ("site-wide controls and local controls bound to the router", "rich cards that carry their own controls or bind to global ones", "inner sidebars and controls for sub-items"). Tags: **F** = observed (code read, test run, tsc), **J** = my judgement, **U** = unverified. Evidence read: `self-controls-forms.md`, `self-shell-nav.md`, `self-state-runtime.md`, `ext-state-persistence.md`, `ext-tanstack-ecosystem.md`, `ext-dense-ui-benchmark.md` (3.4, 3.5, 3.8), `shadcn-epos-teamchat.md`, `shadcn-factory-console.md`, `consumer-shutterflow.md`, `consumer-weatherorb.md`, `packages/basalt-ui/src/router-tanstack/search-store.ts`.

## 0. Headline

1. **F** The model works on stock TanStack Router: root `validateSearch` + `search.middlewares` for globals, page-owned `w.<widget>.<field>` URL keys for widget overrides, `<Link>` for navigation-shaped sub-items. 37 tests and `tsc` pass (section 4). No storage read in `validateSearch`, no `Function.toString`, no `useState` filter.
2. **F** Three router traps the 2.x store never hit because it avoided them by accident: middleware ORDER (`[retain, strip]` leaks `regions=%5B%5D` into every link), `delete key` does not clear a retained key (only an explicit `undefined`/default does), and a function validator typed `(raw: Record<string, unknown>) => X` makes every key REQUIRED on a typed `Link` (section 5). The v3 store must emit a Standard Schema object with `types.input` partial, and fix the order.
3. **J** Law: `widget override > URL value (global or page) > static fallback`, per key, tile-wins; sets AND-combine. Remembered per-user values are NOT a resolution layer: they are one client-only redirect per document (section 6.1).
4. **J** Inner sidebars are neither a shell region nor app-owned: sub-item nav is a **page primitive** (Link list bound to a push-history field); the page-owned sidebar section becomes **route data** (`staticData`), not a portal. `PageBar`/`PageAside` stay claims only for **dynamic content**; every data-only slot (filters, tabs, sync, sidebar blocks) moves to route-declared data, which is SSR-correct (server HTML test).

## 1. Prototype, environment, how to rerun

Scratch app, outside the repo, nothing tracked: `/tmp/scope-proto` (may be cleaned; the API is reproduced in section 3). Code-based routes (no file routes, no codegen), memory history, no dev server.

| Item                                          | Version / fact                                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `@tanstack/react-router`                      | 1.170.46 (router-core 1.171.39 resolved)                                                           |
| react / react-dom / zod / vitest / typescript | 19.x / 19.x / 4.6.7 / 5.1.0 / 7.0.2                                                                |
| Run                                           | `cd /tmp/scope-proto && npx tsc -p . && npx vitest run`                                            |
| Size                                          | `src/controls.ts` 341 lines (codecs ~60, types ~70), `surfaces.tsx` 86, `app.tsx` ~270, tests ~620 |

Files: `src/controls.ts` (core), `src/surfaces.tsx` (FilterSpec + 3 surfaces), `src/app.tsx` (routes, shell, cards), `test/{controls,ssr.node,hydrate,middleware-order,definition}.test.ts(x)`, `test/types.check.tsx` (compile-only).

## 2. The scope model

Two axes. **Scope** = where state lives. **Home** = where it renders (law C1, unchanged: page bar, section/card header, form row, aside, sheet).

| Scope                             | Declared on                | Lives in                                                                    | Resolution                   | History  | Retained across routes     | Example                         |
| --------------------------------- | -------------------------- | --------------------------------------------------------------------------- | ---------------------------- | -------- | -------------------------- | ------------------------------- |
| global                            | root route                 | URL (`?range=7d`)                                                           | URL > fallback               | replace  | yes (`retainSearchParams`) | range, env, regions             |
| page                              | page route                 | URL                                                                         | URL > fallback               | replace  | no                         | tab, q                          |
| widget                            | page route, via `widgets:` | URL, key `w.<id>.<field>`                                                   | override > global > fallback | replace  | no                         | latency card range              |
| sub-item (inner sidebar)          | page route                 | URL                                                                         | URL > fallback               | **push** | no                         | settings section, selected item |
| device pref / synced pref / draft | not router                 | `createPersistedState`, `createSyncedState` (ext-state-persistence 5.2-5.5) | n/a                          | n/a      | n/a                        | density, theme                  |

- **J** The benchmark's "widget = local state, cannot write the URL" (`ext-dense-ui-benchmark.md:102-104`) is refined, not followed: the owner asked for a stable per-widget URL key, and a shared dashboard link must reproduce an overridden card. A widget override is a page-owned URL key; what stays true is that a widget can never change a GLOBAL (it writes only its own `w.` key).
- **J** Remembered values (last env, last range) are device preferences with a client-only entry redirect, not a URL layer.

## 3. API sketch (what the prototype implements)

```ts
// controls.ts
const globals = defineControls({ id: 'globals', scope: 'global', fields: {
  range:   field.enum(['1h','24h','7d','30d'], '24h'),
  env:     field.enum(['prod','staging','dev'], 'prod'),
  regions: field.multi(['eu','us','ap']),            // empty = all; merge = intersection
}})
const overview = defineControls({ id: 'overview', scope: 'page',
  fields:  { tab: field.enum(['all','errors'], 'all'), q: field.string('') },
  widgets: { latency: { range: globals.field.range, regions: globals.field.regions },   // inherits these
             errors:  { range: globals.field.range } } })
const settings = defineControls({ id: 'settings', scope: 'page',
  fields: { section: field.enum(['general','billing','members'], 'general', { history: 'push' }), item: field.string('') } })

// routes
createRootRoute({ validateSearch: globals.validateSearch, search: { middlewares: globals.middlewares } })
createRoute({ path: '/overview', validateSearch: overview.validateSearch, search: { middlewares: overview.middlewares },
              staticData: { filters: [tabSpec] } })
createRoute({ path: '/settings', validateSearch: settings.extend(z.object({ extra: z.string().optional() })), ... })
```

Types (all **F**, compiled): `validateSearch: StandardSchema<Partial<Out>, Out>` with a symbol brand `[OWNER]: string[]`; `Out = Values<F> & WidgetSearch<W>` where `WidgetSearch` maps `{ latency: { range } }` to the template-literal key `` `w.latency.range`?: Range ``.

```ts
type ControlState<T> = {
  value: T
  source: 'own' | 'inherited' | 'override'
  inherited: T | undefined
  set(v: T): void
  reset(): void
}
type ControlHandle<T> = { key: string; codec: Codec<T>; use(): ControlState<T> }
type FieldHandle<T> = ControlHandle<T> & { useValue(): T; link(next: T): LinkWrite } // link = {to:'.', search, replace, resetScroll:false}
globals.middlewares // [stripSearchParams(defaults), retainSearchParams(keys)]  (ORDER matters, F)
overview.widget.latency.range.use() // ControlState: widget handle
overview.useOverrides() // { keys, widgets, clearAll() }
overview.useActiveCount() / useReset()
```

Card API (typed data, never children; extends law C13): `<ChartCard controls={[spec(overview.widget.latency.range, 'Range', 'latency.range')]}>`. `FilterSpec<T> = { id, label, handle: ControlHandle<T>, options: {value: T, label}[] }`. One spec renders as `pill` (page bar), `row` (sheet/aside), `card` (compact + override cue); the HOME provides the surface via context, there is no `variant` prop (`ControlView` in `surfaces.tsx`). A plain field reports `source: 'own'`; a widget field reports `inherited | override`; the same `ControlView` renders both, which is why the cue cannot be forgotten by a page author.

Data-only slot: `staticData: { filters?: FilterSpec<any>[] }` (module augmentation of `StaticDataRouteOption`), read by the shell via `useMatches({ select: ms => ms.at(-1)?.staticData.filters })`.

## 4. Proof: requirement to test to result

All 37 tests pass; `tsc -p .` exit 0 (includes `test/types.check.tsx`, where every `@ts-expect-error` row is consumed). A negative control exists for the hydration detector.

| Requirement                          | Test (file > case)                                                                                                                | Result                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `retainSearchParams` carries globals | controls > "link href and navigation keep range/env, drop tab and widget overrides"                                               | F: `/overview?range=7d&env=staging&tab=errors&w.latency.range=30d` links to `/settings?range=7d&env=staging`, href attribute and navigation agree                                                                                                                                                                                                                        |
| explicit default un-retains          | controls > "an explicit default resets a retained key"                                                                            | F: `navigate({to:'/settings', search:{range:'24h'}})` gives `?env=staging`                                                                                                                                                                                                                                                                                               |
| page param + retained global         | controls > "a typed Link with an unrelated page param still retains globals"                                                      | F                                                                                                                                                                                                                                                                                                                                                                        |
| defaults absent                      | controls > "global, page and widget keys appear only when they differ"                                                            | F: `range=7d` appears, picking `24h` returns the URL to `/overview`; same for `tab`; validated search is still complete (`range:'24h', env:'prod', tab:'all'`)                                                                                                                                                                                                           |
| typed Link / search                  | `types.check.tsx`                                                                                                                 | F: `<Link to="/settings" search={{range:'7d'}}/>` ok; `<Link to="/overview"/>` ok (nothing required); `range:'bogus'`, unknown key, `w.latency.range:'bogus'`, `w.nope.range`, page key on sibling route all rejected; `useSearch({from:'/overview'})` has `range`, `tab`, `regions`, optional `'w.latency.range'`; `/settings` has inherited `env` and composed `extra` |
| no navigation churn                  | controls > "each change is exactly one resolved navigation; shell/page/cards mount once"                                          | F: 3 changes, 3 resolved, mounts 1 / unmounts 0 for shell, page, both cards                                                                                                                                                                                                                                                                                              |
| no cross-render                      | controls > "a widget override re-renders neither the header pill nor the sibling card control"                                    | F with `memo` on the card; selector-based `useSearch` subscriptions. Without `memo` a page re-render (it reads `useOverrides`) cascades; that is React, not the store                                                                                                                                                                                                    |
| widget inherit / override            | controls > widget scope (7 cases)                                                                                                 | F: inherits; override wins for its card only; global change flows to the other card; reset drops the key; same-value select still pins; `Reset overrides` clears `w.*` only                                                                                                                                                                                              |
| deep-link conflict                   | controls > "deep link: override beats the global"                                                                                 | F: `?range=7d&w.latency.range=30d` shows 30d with title "Overrides global: 7d"; no redirect, no normalisation                                                                                                                                                                                                                                                            |
| invalid values                       | controls > "invalid override and invalid global fall back"                                                                        | F: `range=bogus&w.latency.range=bogus&tab=zzz` renders (status idle), values fall to the fallback                                                                                                                                                                                                                                                                        |
| sets AND-combine                     | controls > "multi fields AND-combine"                                                                                             | F: global `[eu,us]` + override `[us,ap]` gives `us`; empty global gives the override alone                                                                                                                                                                                                                                                                               |
| 3 surfaces, one state                | controls > "header pill, sheet row and card control stay in sync"                                                                 | F: a change in the sheet row updates pill and card; 3 pill / 2 row / 2 card surfaces rendered from the same specs                                                                                                                                                                                                                                                        |
| history                              | controls > "global/widget/page writes replace; Back leaves the page" ; "settings section is push"                                 | F: three replace-writes then Back lands on the previous PAGE; `section` push walks general > billing > members and Back returns billing, then bare `/settings`                                                                                                                                                                                                           |
| inner-sidebar items are links        | same                                                                                                                              | F: `href="/settings?section=billing"`, default item `href="/settings"`, `aria-current="page"` on the active one                                                                                                                                                                                                                                                          |
| portal section lifecycle             | controls > "page-owned section portal"                                                                                            | F: mounts 1, survives section/item changes, unmounts 1 on leaving the page                                                                                                                                                                                                                                                                                               |
| ownership w/o `toString`             | controls > "a route that does not run the store refuses the write"; "extend() keeps the brand; the old heuristic false-positives" | F: write from `/plain` throws `controls('settings'): 'section' written on a location whose routes do not run ...`; `extend(zod)` keeps `[OWNER]`; an impostor whose body merely names `validateSearch` matches `search-store.ts:344` but has no brand                                                                                                                    |
| SSR purity                           | `ssr.node.test` (node env, `localStorage` getter throws)                                                                          | F: `renderToString` of `/overview?range=7d&w.latency.range=30d` contains `value-latency` 30d, `value-errors` 7d, `data-source="override"`; validator deterministic, junk and non-object input never throw                                                                                                                                                                |
| hydration                            | `hydrate.test`                                                                                                                    | F: server HTML + `hydrateRoot` with `onRecoverableError`: 0 errors; negative control (HTML edited to `MISMATCH`) is flagged                                                                                                                                                                                                                                              |
| SSR of route-declared chrome         | `ssr.node.test` "route-declared (staticData) controls vs portal claims"                                                           | F: `staticData.filters` control IS in server HTML; a portal into the shell slot is NOT (target is null until commit)                                                                                                                                                                                                                                                     |
| remembered layer                     | controls > remembered (4 cases)                                                                                                   | F: bare URL adopts by replace; deep link wins; write-through updates storage; `?range=24h` explicit default beats a remembered `7d` and canonicalises to bare                                                                                                                                                                                                            |
| definition guards                    | `definition.test`                                                                                                                 | F: two stores owning one param throw; `w.` prefix reserved; reused widget id throws                                                                                                                                                                                                                                                                                      |
| codec trap                           | controls > "router JSON-parses ?item=123"                                                                                         | F: `parseSearch('?item=123')` gives the NUMBER 123; the string codec returns `'123'`                                                                                                                                                                                                                                                                                     |
| loaderDeps footgun                   | controls > "loaderDeps returning the whole search ..."                                                                            | F: loader runs 2x for 1 control change, route does NOT remount (page mounts 1, unmounts 0). Corrects the assumption that it remounts                                                                                                                                                                                                                                     |

## 5. Findings that changed the design (all F, router-core 1.171.39)

1. **Middleware order.** With a validator that fills defaults, `[retainSearchParams(keys), stripSearchParams(defaults)]` yields `/b?range=7d&env=staging&regions=%5B%5D` on every bare link (array default retained). `[strip, retain]` is clean in all cases (`test/middleware-order.test.ts`, 3 cases). Not verified why only the array default leaks (U: read `searchMiddleware.js:12-33` meta handling).
2. **Clearing a retained key.** A search updater that `delete`s the key does not clear it (retain re-adds from the current search; `/b?env=staging&range=7d`). Only explicit `undefined` or the default value does (`searchMiddleware.js` `explicit` check). So every store write/reset must write `undefined`, never delete. 2.x never faced this because it had no retain.
3. **Function validator input type.** `(raw: Record<string, unknown>) => X` resolves INPUT = OUTPUT (`validators.d.ts:46`: input is the parameter type only if it extends `SearchSchemaInput`, else the output). `search-store.ts:82` has exactly this signature, so every store key is required on a typed `Link`, which is the type-level reason `search: store.linkSearch` by reference exists. `tsc` assertion: `{} extends LegacyInput` is false; for the Standard Schema form with `types.input: Partial<Out>` it is true. Code-based routes only; file routes (codegen) are U.
4. **Remembered layer vs history.** First attempt applied remembered values on every navigation. Back to a bare entry then re-applied the CURRENT preference (`/settings` came back as `/settings?range=7d`), and an explicit default mid-session was "remembered away". Fix: apply once per router/document and only when the RAW URL lacks the key (`beforeLoad` sees `location.search` raw). Pinned by "Back leaves the page".
5. **Variance trap.** `ControlHandle<'a'|'b'>` is not assignable to `ControlHandle<string>` (setter contravariant; same family as `self-state-runtime.md` invariant 13). `FilterSpec` must be generic `FilterSpec<T>` with a `spec()` helper; a `FilterSpec<string>[]` slot type needs `FilterSpec<any>[]`.
6. **Router JSON-parses search values** (`?item=123` is a number): every string codec must accept numbers.
7. **`useSearch({strict:false, select})` is enough for isolation**: each handle subscribes to one key via a primitive-returning selector; no store object, no context.
8. **Router `location.search` is the raw parse**; the validated, defaults-filled search is on `matches.at(-1).search`. A test or devtool reading `location.search` sees `{}` on a bare URL.

## 6. Answers

### 6.1 Precedence law (J, behaviour F)

For a widget field `k` of widget `w` on page `p`:

1. `w.<w>.<k>` in the URL, if it parses (override).
2. else the URL value of the inherited handle (global, or page), if it parses.
3. else the field's static fallback (a code constant; never per-user, never computed).

Rules: per key, tile-wins (PostHog: `ext-dense-ui-benchmark.md:98`, secondary source, U on primary). Scalars replace; a codec may declare `merge` (multi = intersection when both non-empty, AND-combine as PostHog filters). Invalid values drop to the next layer, never throw. An override equal to the global still pins (key presence is intent); the only exits are `reset()` and `Reset overrides`. A widget cannot write a global. Remembered per-user values enter before layer 2 only as a one-time redirect on entry (section 5.4), so a shared link is always reproducible from its URL alone.

Deep-link conflict (override and global both explicit): the override is honoured for that widget, the cue names the global value, and nothing is rewritten. J: the alternative (drop overrides on any global change) destroys saved views and contradicts Datadog/Grafana panel overrides (U on both primaries).

### 6.2 Visible cue when a widget overrides (J, mechanism F)

Three parts, all produced by the shared `ControlView`, so a page author cannot omit them:

- **On the control**: `data-source="override"`, a `Local` badge, accessible title `Overrides global: <value>`, and a reset button labelled `Reset <label> to global` (card surface). The sheet/row surface adds the sentence and a `Use global` button.
- **On the page**: a count of overriding widgets next to the global filters with `Reset overrides` (`useOverrides()`), so overrides are discoverable without scanning cards.
- **In data**: charts/tables whose scope differs from the page title should print the effective range in the card facts (`ChartCard facts`), not only in the control. U: visual design (colour, placement) is for the design waves; the rule is "never colour alone" (Carbon 3-of-4 cues, benchmark 3.9).

### 6.3 Type of the widget-control API on cards (F)

`ControlState<T>` (value, source, inherited, set, reset) from `widgetHandle.use()`; cards take `controls: FilterSpec<T>[]` as typed data (<= 2 recommended, J), never a `ReactNode`, in the existing header `actions` home. The card body reads the effective value from the same handle. Binding a card to a global instead of a widget override = pass the global handle (`globals.field.range`) itself; its `source` is `own` and no cue appears.

### 6.4 One `FilterSpec` on header, sheet and card (F)

`FilterSpec<T>` (id, label, handle, options) is data. The HOME supplies the surface through context: header `pill`, mobile sheet and aside `row`, card `compact`. The census (`Filters (n)`, `Reset all`) derives from handles (`useActiveCount`, `useReset`), not from child registration, which deletes the registry and the double mount (`self-controls-forms.md` rows 6, 7, 13). Test: a change made in the sheet row is visible in pill and card, and no surface remounts. Sheet and aside are the same `row` surface (2.x already renders them identically, `self-controls-forms.md` row 3). Note for the controls wave: a widget handle's `isDefault` is "no override", not "equals global".

### 6.5 Inner sidebars (J, built on F)

| Kind                                           | What it is                                                                                                                                                                              | Where it lives                                                      | Why                                                                                                                                                                              |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sub-item nav (settings sections, detail panes) | `<Link {...field.link(v)} aria-current>` list bound to a `history:'push'` page field, in a page layout primitive (`SplitPage`/`InnerNav`), collapsing to Select/Tabs by container query | **page primitive**, not a shell region                              | shutterflow hand-built `?section=` over 11 sections and found "no inner-sidebar primitive" (`consumer-shutterflow.md:50`); Back must walk sections (test); links give real hrefs |
| Aside / inspector                              | right region, claim + portal                                                                                                                                                            | **shell region** (existing `PageAside`)                             | owns dynamic body; keep (`self-shell-nav.md` rows 22-24)                                                                                                                         |
| Page-owned sidebar section (console)           | filter-like block shown in the nav sidebar                                                                                                                                              | **route data** (`staticData.sidebar: SidebarBlock[]`), not a portal | SSR test: the portal section is absent from server HTML; data is present. Needs a named consumer to ship (adopt-or-delete): console is outside basalt today, so 3.0 may defer it |
| Pane content                                   | whatever the section edits                                                                                                                                                              | app-owned                                                           |                                                                                                                                                                                  |

### 6.6 Do `PageBar` and `PageAside` stay portal claims? (J)

Split by content type. **Data-only slots** (`filters`, `tabs`, `sync`, sidebar blocks; all already typed data, law C13/C6) become route-declared: `staticData` read by the shell. F: SSR-correct, no layout-effect publication, no one-commit wait, so the bug class in `self-shell-nav.md` section 4.3 (items 9, 20, 21: double mount, claim identity, late publish) cannot occur for them. **Dynamic slots** (`actions` with page-state closures, `PageAside` body, `Section` content) stay claims (portal). This answers `self-shell-nav.md` section 6 question 3 with "both, split by whether the slot is data". Limits: `staticData` is static, so options that depend on route params/loader data must come from the handle's hooks (they do: handles are hooks); nested layouts need a merge rule (prototype: leaf wins, U). The `PageBar` still exists as a region and as the home for `actions`.

### 6.7 What replaces `Function.toString` (F, `search-store.ts:340-347`)

A symbol brand on the validator object: `validateSearch[OWNER] = [storeId]`, preserved by `store.extend(schema)` (composition with zod works, tested). Ownership check = any matched route's `options.validateSearch[OWNER]` includes the store id. Failure is loud: dev throws (the message names store, key and fix), prod refuses the write instead of planting an unvalidated param. Removes: presence-key detection (`:371`), the "persist-only write from a foreign route" lane, the dev `foreignParam` warning effect (`:410-420`), and the `runsStore` heuristic. Caveat: the brand proves some matched route runs the store, not that the field's route is the one the user is on (a global store always passes, correctly). Under file routes the brand survives codegen (the validator object is imported as is; U).

### 6.8 SSR, back/forward (F)

- `validateSearch` is a pure Standard Schema validator: tested in a node environment where `localStorage` throws. The `hydrationDone`/`$_TSR` machinery (`search-store.ts:113-121`, `:368`, `:384-406`) and the module flag are deleted, not ported (the ext-tanstack hazard 1 is real: `$_TSR` lifetime is router-owned).
- Remembered values: one client-only `beforeLoad` redirect with `replace`, once per router. For SSR-rendered prefs a cookie read in a server function is the documented alternative (U, not built).
- History: replace for global, page and widget (a context switch should not bloat Back); push for sub-item nav (Back walks sections). J on the global default: Grafana/Datadog behaviour for time range is U (not read at primary level). Per-field `history` stays a codec option (already the 2.x lane).

## 7. Four questions

| Area                      | IMPLEMENT                                                                                                                                                                                                                                               | GUARANTEE                                                                                                                                                                                                                                                                                           | TEACH                                                                                                                          | LEAVE OPEN                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Global controls**       | `defineControls({scope:'global'})`; root `validateSearch` + `[strip, retain]` middlewares; shell renders `globalControls: FilterSpec[]` (data, replaces filter use of `globalActions`); entry redirect for remembered values; `useActiveCount/useReset` | types: only the root route can take `scope:'global'` (store id must be on the root validator; add a dev check); definition throws on a param owned twice; middleware order fixed inside `middlewares` (consumers never write it); test pack: retain, explicit default, strip, SSR purity, hydration | `basalt-state` table "which scope"; recipe "add a global control" (5 lines); the retained-key/`undefined` trap                 | which globals exist, their names and defaults, whether to remember them, cookie mirror for SSR                                       |
| **Local (page) controls** | `defineControls({scope:'page'})`, `store.validateSearch`, `store.extend(schema)`, `Link` via `field.link`, `staticData.filters/tabs/sync`                                                                                                               | branded validator; dev throw on foreign-route write; `validate-search-pure` (no `window`/`localStorage`/`Date.now` in a validator or codec); no-`useState`-for-filter (exists); `loader-deps-narrow` (loader re-runs per change, tested)                                                            | rule `basalt-state` (rewrite for scopes); skill section "page state"                                                           | param names, extra params via zod, history per field                                                                                 |
| **Widget controls**       | `widgets:` on a page store, `ControlState`, `FilterSpec` + `ControlView` card surface, `useOverrides`                                                                                                                                                   | cue produced by `ControlView` only; lint `widget-handle-hand-rendered` (a raw `Select`/`input` bound to a widget handle outside `ControlView`, replaces the benchmark's `override-without-indicator`); widget ids literal and app-unique (definition throw); max overrides per page is U            | skill "where does this state live" (global / page / widget / local / device / synced / draft), precedence law in one paragraph | which fields are overridable, `merge` for custom codecs, card placement (<=2 controls)                                               |
| **Inner sidebars**        | page primitive `SplitPage`/`InnerNav` (Link list + container-query collapse); `staticData.sidebar` for page-owned nav section (deferred until a named consumer)                                                                                         | `push` history required by type for a field used in `InnerNav` (`history:'push'` literal); items must be links (no `onClick`-only nav); `responsive-twin`; container queries inside panes (no `md:` in aside bodies, benchmark 3.8)                                                                 | `basalt-app` "settings page" recipe; `PageAside` vs `InnerNav` decision table                                                  | section list, pane content, whether panes reset scroll (`link()` currently passes `resetScroll:false`; for panes probably `true`, U) |

## 8. Risks, unverified, owner decisions

**U (not done):**

- Real browsers: Back/forward and scroll restoration were exercised with memory history only; `resetScroll:false` on pane switches is untested.
- File-based routes + codegen with `search.middlewares`, branded validators and `types.input` (prototype is code-based).
- TanStack Start server path (only `renderToString` after `router.load()`); `ssr:false` routes and streaming.
- Cost: every handle runs a selector per navigation; 10 widgets x 3 fields = 30 selectors, unmeasured. `Link preload` with middleware unmeasured.
- Typical widget URL length with many overrides (a cap or a "saved view id" fallback may be needed).
- Datadog/Grafana/PostHog precedence statements come from `ext-dense-ui-benchmark.md`, not re-read at the primary source here.
- `staticData` merge rule for nested layouts; `staticData` typing under many routes.
- The reason `[retain, strip]` leaks only the array default (section 5.1).

**Owner decisions (real forks):**

1. Global history default: replace (this prototype) or push for range/env. Tendency: replace; global is context, Back should leave the page.
2. Widget overrides in the URL (this prototype, as the brief says) vs a `saved view` indirection if URLs get long. Tendency: URL now, measure.
3. Ship `staticData.sidebar` (page-owned nav section) in 3.0 or defer for lack of an in-repo consumer. Tendency: defer; build `InnerNav` first (shutterflow is the named consumer).
4. Remember-on-entry for globals: ship the redirect helper or leave to the consumer. Tendency: ship (3 apps hand-rolled variants), default off.

**Carry-over to v3 (concepts to keep):** `FieldHandle`-only controls; `retainSearchParams` globals; default-absent URL; widget override with cue + reset; one `FilterSpec` for three surfaces; `Link`-based sub-item nav; derived census; branded ownership.
**Drop:** `Function.toString` ownership, presence-key detection, persist-only foreign-route lane, `hydrationDone`/`$_TSR` sniff, storage read inside `validateSearch`, `search: store.linkSearch` by reference (typed `Link` input makes it unnecessary; keep the lint only for literals pinning defaults), child-registration census, `PageBar` claims for data-only slots.

## 9. Sources

- Repo: `packages/basalt-ui/src/router-tanstack/search-store.ts` (`:82` validator signature, `:113-121` hydration flag, `:331-347` stored layer and `Function.toString`, `:368-371` presence ownership, `:408-420` dev foreign-param effect, `:430-434` persist-only lane).
- Installed (read): `@tanstack/router-core` 1.171.39 `searchMiddleware.js` (retain/strip/explicit/removed meta), `router.js` (`getSearchMiddlewares`, `validateSearch` accepting `~standard`), `validators.d.ts:46-47` (input resolution); `@tanstack/react-router` 1.170.46.
- Evidence files listed in the header; consumer facts via `consumer-shutterflow.md:47-57,97`, `shadcn-factory-console.md:69-74`, `consumer-weatherorb.md:101`.
- No web research was needed; no external page was fetched.
