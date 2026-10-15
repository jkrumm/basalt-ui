# basalt-ui 2.0 — the contract

Ground truth for the 2.0 rewrite (`docs/waves/PLAN.md`). `master` is the only line: 1.x is frozen
at `v1.41.0`. `DESIGN-CORE.md`, `MANTINE-THEMING.md`, `CONTROLS-SPEC.md` and `ASIDE-SPEC.md` stay live
for what this file does not restate (law, method, homes, stores, guards); their 1.x names and import
paths read through `MIGRATING.md` § 2.0.0. For 2.0 work this file wins over every one of them.
Release doctrine (the one sanctioned major): `packages/basalt-ui/MAINTAINING.md` § The one sanctioned
major.

## 1. Public surface

2.0 ships 15 subpaths (1.41: 24) and 92 non-chart value symbols (1.41: 294 non-chart of 395). Per-symbol
verdicts and consumers: `docs/waves/v2-surface.md` (W3's deletion checklist, `MIGRATING.md` § 2.0's
source); method and counts: `docs/waves/evidence/w1/core.md`.

| 2.0 subpath        | Symbol groups                                                                                                                                                                                                                                                                                                                                                                                                                         | Named consumer                                                         | Folds in (1.41)                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------- |
| `.`                | wiring (`BasaltProvider`, `createBasaltTheme`, `createBasaltRouter`, `unwrap`); shell + nav (`BasaltShell`, `PageBar`, `PageAside`, `PageTitle`, `ThemeToggle`, `defineNav`, `navGroup`, `navTarget`, `flattenNav`, `useBasaltNav`, `useSizeClass`, `useCoarsePointer`, `scrollParentOf`); dashboard (`Section`, `WidgetHeader`, `StatCard`, `StatGroup`, `DeltaBadge`, `EmptyState`, `SettingsSection`, `SettingsRow`, `DangerZone`) | argo `main.tsx`, `routes/__root.tsx`; rb; basalt-ui-obsidian           | nav half of `./router-tanstack`   |
| `./tokens`         | `VX`, `alpha`, series (`defineSeries`, `seriesTokens`, `groupTokens`, `buildPaletteCss`), layout (`BP`, `p`, `CONTAINER_*`)                                                                                                                                                                                                                                                                                                           | argo, rb, weatherorb                                                   | —                                 |
| `./charts`         | § 9                                                                                                                                                                                                                                                                                                                                                                                                                                   | § 9                                                                    | —                                 |
| `./controls`       | filters + `ViewTabs`, `SyncButton`, `FormRow`, `FormGroup`                                                                                                                                                                                                                                                                                                                                                                            | argo, linewatch, rb, email-gateway, image-gateway                      | —                                 |
| `./controls-dates` | `DateRangePicker`                                                                                                                                                                                                                                                                                                                                                                                                                     | argo `routes/strength-tracker.tsx`                                     | —                                 |
| `./forms`          | `useBasaltForm`, `inputProps`, `fieldKey` on `@mantine/form` (§ 8)                                                                                                                                                                                                                                                                                                                                                                    | argo `lib/auth-gate.tsx`                                               | —                                 |
| `./state`          | `field`, `createSearchStore`, `createLocalStore`, `createPersistedState`                                                                                                                                                                                                                                                                                                                                                              | argo `lib/window-stores.ts`, linewatch, email-gateway                  | store half of `./router-tanstack` |
| `./table`          | `BasaltDataTable`, basalt-owned `createColumnHelper<Row>()`; Table v9, peer `9.2.8` exact (§ 8)                                                                                                                                                                                                                                                                                                                                       | argo `features/warden/issues-section.tsx`                              | `./data/table` (renamed)          |
| `./format`         | `integer`, `money`, `percent`, `durationClock`, `relativeTime`, `weekday`, `km`, `kcal`                                                                                                                                                                                                                                                                                                                                               | argo, image-gateway                                                    | —                                 |
| `./commands`       | `defineCommands`, `defineOverlays`, `overlays`, `setColorScheme`, `toggleSidebar`, `ShortcutsHelp`, `defineNotifications`, `emit`, `NotificationBell`                                                                                                                                                                                                                                                                                 | argo `lib/commands.tsx`, `lib/notifications.ts`                        | `./notifications`                 |
| `./agent`          | `aiSdkTransport`, `useAgentThreadRuns`, `parseAgentPart`, `ThreadFeed`, `ThreadFeedRow`, `Composer`, `ToolChip`                                                                                                                                                                                                                                                                                                                       | argo `features/hermes-chat/*`                                          | `./agent-chat`                    |
| `./content`        | `Prose`, `Markdown`, `settledOnly`, `mergeSanitizeSchema`, `Callout`, `TableOfContents`, `ArticleLayout`, `GuideLink`                                                                                                                                                                                                                                                                                                                 | rb, basalt-ui-obsidian, linewatch, argo                                | —                                 |
| `./vite`           | `basaltViteConfig`, `basaltAppPlugin`                                                                                                                                                                                                                                                                                                                                                                                                 | all 7 app consumers                                                    | —                                 |
| `./styles.css`     | the one stylesheet (it `@import`s the Mantine layer bundles first, § 1 Open)                                                                                                                                                                                                                                                                                                                                                          | all 7 app consumers                                                    | —                                 |
| `./configs/*`      | oxlint / tsconfig / lefthook / oxfmt presets                                                                                                                                                                                                                                                                                                                                                                                          | argo, linewatch, rb, image-gateway, … (`.oxlintrc.json`, `tsconfig.*`) | —                                 |

**Dropped:** `./guard` (CLI-internal), `./theme-lab` (provider-mounted in dev), `./data/virtual`,
`./llms.txt` and `./package.json` (0 imports; files stay in the tarball), `./tokens.css` (weatherorb
1.30 and rollhook 1.36 only; `basalt-ui tokens:css` emits it). Folds:

| Fold (1.x split reason)                                                                                         | 2.0                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `./controls-dates` stays separate (`./controls` must never reach `@mantine/dates`, `MAINTAINING.md` § Layering) | kept. Folding would make `@mantine/dates` + `dayjs` required peers of every `./controls` consumer and add the 3.4 KB gzip `@mantine/dates/styles.layer.css` to the one stylesheet (CSS never tree-shakes). That cost lands on four consumers for argo's 3 files                                                                                             |
| `./forms` stays separate (`./controls` must never reach `@mantine/form`, same section)                          | kept. § 8 keeps `@mantine/form`; that peer stays out of `./controls`                                                                                                                                                                                                                                                                                        |
| `./agent-chat` → `./agent` (`./agent` is in the Mantine-free dist-layering set; `motion` eager in the chat UI)  | Mantine is a required peer of the 2.0 framework, and no consumer imports the headless half alone (argo uses both). `src/agent/**` runtime stays Mantine-free as a repo-local lint boundary, `./agent` leaves `check-dist-layering`'s list, and `motion` becomes subpath-required for `./agent` (§ 5). Unused chat UI tree-shakes (`sideEffects: ['*.css']`) |
| `./notifications` → `./commands` (`@mantine/notifications` was an optional peer)                                | no new peer: `BasaltProvider` mounts `Notifications`, `ModalsProvider` and `Spotlight` (§ 2), so all three are required peers of `.` already                                                                                                                                                                                                                |

**Rules.** W3 delivers the gates for all three in `check-budgets.ts`; none exists in 1.41:

- One import path per symbol: no name will appear under two subpaths (1.41 has 107 such names).
- A public symbol needs a named consumer outside `apps/playground` (charter 1). W3 adds
  `scripts/consumers.json`, keyed by symbol name (a moved symbol keeps the consumer it has under its
  1.41 specifier), and a symbol missing from it will fail the gate.
- Peers, defined once here. W3's dist-graph and `.d.ts` walk will assert all three classes:
  - **Required:** every consumer installs it, because `.` or `./styles.css` imports it statically
    or names it. These are `react`, `react-dom`, `@mantine/{core,hooks,modals,notifications,spotlight}`,
    `@tanstack/react-router`, `@tanstack/react-query` and the three `@fontsource-variable/*`.
  - **Subpath-required:** a peer named by a subpath's public `.d.ts`, or imported statically by it,
    is required for that subpath's consumers and stays `optional` in `package.json`. `./commands`:
    `@tanstack/react-hotkeys` `0.13.0` exact; `./agent`: `ai`, `@ai-sdk/provider`, `motion`; `./table`:
    `@tanstack/react-table` `9.2.8` exact; `./forms`: `@mantine/form`; `./controls-dates`:
    `@mantine/dates`, `dayjs`; `./content`: `react-markdown` (`MarkdownComponents`); `./vite`: `vite`;
    `./charts`: § 9.
  - **Optional:** lazy (`import()`), in no public type, degrades when missing: `remend`, `shiki`,
    `@shikijs/*`, `beautiful-mermaid`, `remark-gfm`, `rehype-sanitize`, both devtools, `vite-plugin-pwa`.
    `doctor` `subpath-peers` names the lazy ones a subpath needs in full (`./content`: `shiki`,
    `@shikijs/*`). `.`'s `.d.ts` reaches no subpath-required peer; nothing imports `@ai-sdk/react`.

**Charter 2 exceptions** (wiring, no 1.41 consumer yet): `createBasaltRouter` (router + Query
wiring, § 2), `BasaltRouterContext` (the root route's context type, § 2), `BasaltEvent` (the
telemetry seam, § 7). Each names argo as its first consumer in `v2-surface.md` § New in 2.0.

| Budget (`check-budgets.ts`)              | 1.41                       | 2.0 target                                                                                |
| ---------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------- |
| public value symbols                     | 395                        | ≤ 140 (non-chart 92 + § 9's chart allowance 48); gated at 92 + charts' landed 97 until W4 |
| barrel type exports, non-chart (W3 adds) | 517 (447 = 517 − 70 → § 9) | ≤ 60 (40 kept); chart types count against § 9's allowance                                 |
| published subpaths                       | 24                         | 15                                                                                        |
| shipped rule lines (`agent/rules/*.md`)  | 750                        | ≤ 450; landed 277 in W9 and gated there                                                   |

**Open:**

- `./styles.css` importing Mantine's layer CSS: W3's pack-test proves it, or 1.x's CSS order stays.

## 2. Provider and wiring

`BasaltProvider` has two peer modes. **Mount** (`router`): it owns the whole provider tree, the router included. **Embedded** (`children`): it owns everything but the router, inside a host router such as Start's.
The consumer writes the route tree, the nav, and the registries (commands, notifications). 1.x left argo 220 lines of wiring
(`main.tsx` 61 + `__root.tsx` 159); the target below is 25 lines of code.

| Basalt wires                                                                                                                                                                                                                                                                                   | Where                                                                                                                | Replaces in 1.x                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `MantineProvider` + theme (`theme` defaults to `createBasaltTheme()`, § 4) + resolver + palette `<style>`                                                                                                                                                                                      | `BasaltProvider`                                                                                                     | unchanged                                                                        |
| `createRouter` with `context.queryClient`, `defaultPreload: 'intent'`, `defaultPreloadStaleTime: 0` (Query owns freshness), `scrollRestoration: true`, `defaultPendingComponent`, `defaultErrorComponent`, `defaultNotFoundComponent`, `defaultOnCatch` → § 7                                  | `createBasaltRouter({ routeTree, context?, query? })`                                                                | argo `lib/router.ts`, `__root.tpl`, `QueryState`/`LoadingState`/`ErrorState`     |
| `QueryClient` with 1.x defaults (`staleTime` 30 s, `gcTime` 5 min, `retry` 2, no refetch on focus; `src/query-client.ts`), merged with `query: QueryClientConfig`; one client per `createBasaltRouter` call, so an SSR entry gets one per request                                              | `createBasaltRouter`                                                                                                 | `createBasaltQueryClient`, `query-client.ts.tpl`                                 |
| `QueryClientProvider` > `ModalsProvider` (wrapping, real context) > `RouterProvider`; `Notifications` and `Spotlight` as siblings                                                                                                                                                              | `BasaltProvider router={router}`; embedded: `children`, router from `useRouter()`                                    | `BasaltOverlays`, the `provider-above-router` rule                               |
| hotkeys from the `defineCommands` registry, only when one exists: `defineCommands` (`./commands`, where `@tanstack/react-hotkeys` is subpath-required for `CommandDef.shortcut`) registers the `import()` loader, so `.` never references the peer and its runtime stays off first paint (§ 8) | `BasaltProvider`                                                                                                     | `useCommandHotkeys`, `toHotkeyBindings`                                          |
| Spotlight actions from the command registry plus `flattenNav`                                                                                                                                                                                                                                  | `BasaltProvider`                                                                                                     | `toSpotlightActions`, `basaltSpotlight`                                          |
| root error boundary (`fallback` prop), `window` `error`/`unhandledrejection` listeners, all routed to `telemetry` (§ 7)                                                                                                                                                                        | `BasaltProvider`                                                                                                     | `BasaltErrorBoundary`, `onError`                                                 |
| dev dock (router + query devtools, theme lab, persisted lab overrides applied) and three Spotlight commands `dev.router` / `dev.query` / `dev.theme`; `BasaltDevDock` is the one dock, mounted here and not exported (§ 8 rejects the TanStack Devtools shell)                                 | `BasaltProvider`, behind a literal `process.env.NODE_ENV !== 'production'` check at the `lazy(() => import(…))` site | `BasaltDevDock`, `BasaltQueryDevtools`, argo's `applyOverrides(loadOverrides())` |
| nav → sidebar + mobile bar + breadcrumbs                                                                                                                                                                                                                                                       | `BasaltShell nav={NAV}`                                                                                              | `useNav` spread, `useRouterBreadcrumbs`                                          |
| route-change transition (§ 5)                                                                                                                                                                                                                                                                  | `BasaltShell` main region                                                                                            | —                                                                                |

The dev gate is a literal `process.env.NODE_ENV` read, so production drops the branch (an `isDev()`
helper shipped the theme lab into weatherorb's first paint). TanStack Store is never exposed and
`./forms` stays on `@mantine/form` (§ 8).

`src/main.tsx` (15 lines of code):

```tsx
import 'basalt-ui/styles.css'
import { createRoot } from 'react-dom/client'
import { BasaltProvider, createBasaltRouter } from 'basalt-ui'
import { routeTree } from './routeTree.gen'
import { telemetry } from './lib/telemetry'
import './lib/commands'

const router = createBasaltRouter({ routeTree })
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <BasaltProvider router={router} telemetry={telemetry} />,
)
```

`src/routes/__root.tsx` (10 lines of code):

```tsx
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { BasaltShell, type BasaltRouterContext } from 'basalt-ui'
import { NAV } from '../lib/nav'

export const Route = createRootRouteWithContext<BasaltRouterContext>()({
  component: () => (
    <BasaltShell brand={{ name: 'Argo' }} nav={NAV}>
      <Outlet />
    </BasaltShell>
  ),
})
```

Extra context (argo's auth) extends `BasaltRouterContext` and goes in `createBasaltRouter({ context
})`. argo's 401 handling stays its own `query: { queryCache }`; basalt subscribes to it (§ 7).

**Server rendering (W10)**: router streaming, no RSC; basalt ships no Start integration. A Start app owns its router and embeds the provider in its root route component as `<BasaltProvider><Outlet /></BasaltProvider>` (router via `useRouter()`, `context.queryClient` from its `getRouter()`); `router` and `children` are exclusive, and `sync`/`init` seed no router files there. The shell holds no promise, a slow section is
an unawaited loader promise in `<Await>` + `<Suspense>` (fallback § 9.7). See `waves/evidence/w10/ssr.md`.

**Open:**

- `ModalsProvider` wrapping (not beside) the tree: W3 measures `modals.*` re-renders first.

## 3. Strictness

Wrong usage fails `tsc` first and lint second; prose-only rules do not ship (charter 5). The types
assume the `configs/tsconfig.base.json` preset (`strict`, `exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`); `doctor` fails when the app's tsconfig does not extend it.

**Type errors**

| Mistake                                             | 1.41 enforcement                                                   | 2.0 type                                                                                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| a filter/tab given `value`, `onChange` or `size`    | props absent (excess-property check)                               | kept, plus named slots `value?: never; onChange?: never; size?: never`, so the error names the mistake                                                 |
| `PageBar` > 5 actions or ≠ 1 primary; `Section` > 3 | `basalt/page-bar-budget` lint                                      | `actions: [P] \| [P, M] \| [P, M, M] \| [P, M, M, M] \| [P, M, M, M, M]` (`P` = `{ primary: true }`, `M` = `{ primary?: false }`); `Section` caps at 3 |
| theme knob out of range                             | `radius?: number`, `density?: number` (`theme/index.ts:1578,1601`) | `radius?: -5 \| … \| 5`, `density?: -3 \| … \| 3`                                                                                                      |
| series group key retyped wrong (`'x'` vs `'x-'`)    | silent: refs to undeclared vars (`basalt-tokens.md`)               | `groupTokens` returns a branded `SeriesGroup`; `paletteOptions.groups` takes `SeriesGroup[]`, so no key is written twice                               |
| nav defined without the `Register` augmentation     | prose ("validates NOTHING")                                        | `defineNav`'s parameter becomes the string literal `'basalt: declare Register { router }'` while `RegisteredRouter` is `AnyRouter`                     |
| a consumer-set router view transition (§ 5)         | —                                                                  | `createBasaltRouter` sets `defaultViewTransition` itself; its options carry `defaultViewTransition?: never`                                            |
| a closed union switched non-exhaustively            | `assertNever` export + rule text                                   | `AgentPart`, `ThreadStatus`, `AgentError`, `BasaltEvent` are closed; a switch ends `default: return x satisfies never`                                 |
| hand-built theme, second resolver, sub-shell mounts | exports + `hand-rolled-shell`                                      | unrepresentable: `cssVariablesResolver`, `baseTheme`, `AppSidebar`, `MobileNav`, `AppBreadcrumbs` are not exported                                     |
| provider below the router, overlays mounted twice   | `basalt/provider-above-router`, `BasaltOverlays`                   | unrepresentable: `BasaltProvider` mounts `RouterProvider` and every overlay (§ 2)                                                                      |

**Lint at `error` in 2.0** (`configs/oxlint-basalt.json`, the dogfood levels in `/.oxlintrc.json`
match them). These carry over unchanged: `no-raw-font-size`, `raw-size-literal`, `card-inset`,
`hand-rolled-shell` (raw `AppShell.*` only), `raw-scroll-container`, `hand-rolled-filter`,
`control-outside-home`, `bound-control-outside-home`, `control-size-literal`, `in-body-page-title`,
`responsive-twin`, `search-literal-link`, `use-search-from-literal`, `query-fn-unwrap`,
`ai-sdk-major`, `raw-breakpoint`, `forms-field-key` (`@mantine/form`, § 8). `shadow-basalt-export`
moves from warn to error; `agent-no-raw-usechat` widens to the `Chat` class (`@ai-sdk/react`
`dist/index.d.ts:90`). New: `no-dev-helper` (repo-local) requires a literal `process.env.NODE_ENV`
gate on dev-only `import()`s. W10: `route-view-transition` bans `<ViewTransition>` around `<Outlet>` (§ 5).

All 28 `check-theme` guard kinds are already `error` (`src/guard/index.ts:937`, empty
`GRACE_PERIOD_KINDS`) and carry over, except `raw-visx-axis` and `chart-missing-aria-label`, which
go → § 9.

| 1.x rule dies                                                                                       | Because 2.0 makes the concern unrepresentable                                                                             |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `provider-above-router`                                                                             | the provider mounts the router                                                                                            |
| `page-bar-budget`                                                                                   | the actions tuple type                                                                                                    |
| `agent-resume-guard`                                                                                | `resumeStream` is only reachable on `useChat`/`Chat`, both banned by the widened `agent-no-raw-usechat`                   |
| `deprecated-export`                                                                                 | 2.0.0 ships no deprecations; every removal is a `MIGRATING.md` § 2.0 row. The rule returns with the first 2.x deprecation |
| `visx-boundary`, `visx-tooltip`, `hand-rolled-plot`, `chart-in-raw-surface`, `chart-legend-literal` | chart layer: § 9 decides                                                                                                  |

**Carried forward:**

- Adopt-or-delete: a symbol without a `scripts/consumers.json` entry fails `check-budgets` (§ 1).
- C16 grace: from 2.0.0 every rule lands at `error`, because the major is the channel. The
  warn-then-promote path (C16) applies again to rules added after 2.0.0.
- Budgets: § 1 table.

## 4. Tokens and theme

The law does not change: `docs/DESIGN-CORE.md`, the three-tier `--vx-*` system, the generated
palette (`src/tokens/derive.ts`), and `createBasaltTheme(overrides?, { derive, fonts, radius,
density })`. 2.0 changes only the surface around it:

| 1.41                                                                                                                | 2.0                                                                         |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| every consumer passes `theme={createBasaltTheme()}` (7 of 7, all bare)                                              | `BasaltProvider theme` is optional and defaults to that call                |
| `createBasaltTheme(_, { inputs: 'desktop' })`, an undocumented fifth dimension (`theme/index.ts:1617`), 0 consumers | deleted, four dimensions                                                    |
| `radius`/`density` typed `number`; `paletteOptions.groups` string-keyed                                             | literal-union knobs; `SeriesGroup[]` (§ 3)                                  |
| `./tokens.css` export; `build{Fonts,Radius,Density}Css`, `derive*`, `DEFAULT_DERIVE_CONFIG` public                  | internal to the provider and the CLI; `basalt-ui tokens:css` emits the file |
| theme lab on `./theme-lab`                                                                                          | dev-only, mounted by the provider (§ 2)                                     |

`injectPalette` and `nonce` stay for SSR head injection. The `--vx-*` → chart theme bridge is § 9.

## 5. Transitions

One mechanism per surface. **Route changes are the router's** (owner, 2026-10-14; a React `<ViewTransition>`
never fires on its SyncLane commit, W7 0/12): `defaultViewTransition: { types }` from nav order, `false` on
first load and search/hash-only, set only where `:active-view-transition-type()` works (Chrome 125 / Safari
18.2 / Firefox 147); only `basalt-main` moves; skip rejections (#7733) are swallowed. `<ViewTransition>` stays
for in-page changes (plain `setState` never fires it). Evidence: `waves/evidence/w10/transitions.md`.

| Surface                                    | Mechanism                                                                                                                                                              | Why this one                                                                                              |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| route change                               | router `defaultViewTransition` with nav-order `types` (above); `basalt/route-view-transition` bans `<ViewTransition>` around `<Outlet>`                                | the router owns the commit, so only its own transition fires (W10: 12/12)                                 |
| aside open/close                           | fold setter inside `startTransition` + `<ViewTransition>` on the aside region; body under `<Activity mode={folded ? 'hidden' : 'visible'}>`                            | `Activity` keeps scroll and inputs across folds without a remount                                         |
| tab swap (`ViewTabs`)                      | none: instant swap                                                                                                                                                     | a same-route navigation; motion delays reading a data view (DESIGN-CORE restraint)                        |
| chat thread swap (`ThreadFeedRow` expand)  | none: lazy first mount, then kept mounted with plain-CSS `display: none`; no `Activity` (hidden `Activity` re-fires every transcript effect) and no `<ViewTransition>` | `thread-feed-row.tsx` owns show/hide so a Mantine `keepMountedMode` default change cannot replay a stream |
| modal, drawer, popover, menu               | Mantine `transitionProps` (theme default, Mantine `respectReducedMotion`)                                                                                              | Mantine owns portal mount/unmount; a view transition would snapshot the page                              |
| list insert / reorder (feed rows, history) | `motion/react` `layout` + `AnimatePresence`                                                                                                                            | streamed inserts are urgent `setState`, which never activates `<ViewTransition>`                          |
| theme toggle icon                          | CSS transition                                                                                                                                                         | motion was overkill (`theme/theme-toggle.tsx`)                                                            |

**`motion` survives only for list insert/reorder.** Of its three 1.41 import sites, `theme-toggle.tsx`
drops it, `thread-detail-panel.tsx` is deleted, and `thread-feed.tsx` keeps it. That makes `motion` subpath-required for `./agent` (§ 1), bumped to 14 (W3).

**Reduced motion**, one switch per mechanism, all driven by the OS setting:

- `styles.css` sets `animation: none` on `::view-transition-group(*)`, `-old(*)` and `-new(*)`
  under `prefers-reduced-motion: reduce`. React does not do this itself (react.dev).
- `ThreadFeed` mounts `<MotionConfig reducedMotion="user">` (motion 14 `ReducedMotionConfig`:
  `'always' | 'never' | 'user'`); the provider does not, so the root never reaches `motion`.
- The base theme sets Mantine's `respectReducedMotion: true`.

**Accepted:** Back/Forward through `popstate` is unmeasured (router #2983 says it does not animate).

**Open:**

- With `document.startViewTransition` deleted (Chrome 155) the aside folds and expands without
  error and React commits without animation (W7 evidence). Safari and Firefox are not observed.

## 6. AI and content

Written against AI SDK 7 (`ai` 7.0.138, `@ai-sdk/react` 4.0.141); § 8 rejects TanStack AI.
`./agent` reads the stream itself (`readUIMessageStream` over a `ChatTransport`,
`src/agent/ai-sdk-transport.ts:341-365`). It does not call `useChat`, so every `useChat` semantic below
is re-stated as basalt's own contract.

| Concern            | 2.0 contract                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| transport seam     | `aiSdkTransport({ api, headers?, credentials?, fetch? })` or `aiSdkTransport({ transport })`, where `transport` is any AI SDK `ChatTransport<UIMessage>`. `WebSocketChatTransport` (`ai` `dist/index.d.ts:6500`) plugs in there: documented, never wrapped. `edenTransport` is deleted. The `forThread(id)` binding stays (`ai-sdk-transport.ts:95,444`; argo `chat-page.tsx:81`) |
| status             | `ThreadRunState.status` gains `'submitted'`, held from send until the first content part (text, reasoning, tool). 1.41 sets `'streaming'` with `parts: []` (`use-agent-thread-runs.ts:626`). This mirrors `ChatStatus` `'submitted' \| 'streaming' \| 'ready' \| 'error'` (`ai` `dist/index.d.ts:5985`); `chat.turn` TTFT (§ 7) is measured at that edge                          |
| errors             | `ThreadRunState.error: AgentError`, a closed union: `{ kind: 'http'; status }` · `{ kind: 'stream'; chunkType; chunkId }` (from `UIMessageStreamError`, `ai` `dist/index.d.ts:8282`) · `{ kind: 'server'; message }` (an `error` chunk) · `{ kind: 'aborted' }`. argo's body parsing (`hermes-transport.ts:111-136`) becomes a `kind` switch                                      |
| `ReasoningLevel`   | the provider's own type, `LanguageModelV4CallOptions['reasoning']` = `'provider-default' \| 'none' \| 'minimal' \| 'low' \| 'medium' \| 'high' \| 'xhigh' \| 'max'` (`@ai-sdk/provider` 4.0.27 `dist/index.d.ts:1563`), never a basalt copy. Any basalt label map is `Record<ReasoningLevel, string>`, so a new level is a type error                                             |
| `throttle`         | `useAgentThreadRuns({ throttle })` in ms batches part commits, with the semantics of `useChat`'s stable `throttle` (`@ai-sdk/react` `dist/index.d.ts:119`; `experimental_throttle` is deprecated). Default 100 ms (235 → 125 commits per reply, [sweep](waves/evidence/w8/chat-profile-sweep.md))                                                                                 |
| `ai` major         | `ai-sdk-major` + `doctor` `ai-major-parity` stay. argo's skew (dashboard `ai` 7.0.107, api 5.0.196) is decision D3 (§ 8)                                                                                                                                                                                                                                                          |
| streaming markdown | `<Markdown streaming contentTrust="untrusted">` for every model output. Settled blocks are memoized; the tail is repaired by remend (lazy). remend 1.4 emits `![alt](streamdown:incomplete-image)` (`remend` 1.4.0 `dist/index.d.ts:2,36`). `content/url-hardening.ts` treats it exactly like `streamdown:incomplete-link`: alt text, never an `<img src>`                        |
| code and diagrams  | shiki ^4.5 and beautiful-mermaid are lazy fence renderers. `CodeBlock`/`MermaidDiagram` stop being public, so a fence is the only entry                                                                                                                                                                                                                                           |
| peers              | `ai` (`aiSdkTransport` names `ChatTransport<UIMessage>`) and `@ai-sdk/provider` (`ReasoningLevel`) are subpath-required for `./agent`; `@ai-sdk/react` is never imported. `remend`, `shiki`, `@shikijs/*` and `beautiful-mermaid` stay optional (§ 1)                                                                                                                             |

## 7. Observability

Basalt emits typed events through one seam, `BasaltProvider telemetry?: (event: BasaltEvent) => void`,
and has no OTel dependency. The consumer maps events to its own SDK. `onError` and
`BasaltErrorContext` are replaced by this seam.

```ts
type At = { start: number } // epoch ms (performance.timeOrigin + performance.now())
type Span = At & { duration: number } // ms
type Failure = { 'exception.type': string; 'basalt.error.kind': ErrorKind } // family or an AgentError kind, as literals
type Ok<T, A> = Span & { type: T; failed: false; attributes: A }
type Err<T, A, S = At> = S & { type: T; failed: true; attributes: A & Failure }

type BasaltEvent =
  | Ok<'route.navigate', RouteAttrs>
  | Err<'route.error', { 'basalt.route.id': string }>
  | Err<'query.error', { 'basalt.query.hash': string; 'basalt.query.failure_count': number }>
  | Err<'mutation.error', { 'basalt.mutation.key': string }>
  | Err<'render.error', { 'basalt.error.boundary': 'root' }>
  | Err<'window.error', { 'basalt.error.source': 'error' | 'unhandledrejection' }>
  | Ok<'chat.turn', ChatAttrs>
  | Err<'chat.turn', ChatAttrs, Span>
```

| `type`                          | Source (where W3 wires it)                                                                                                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `route.navigate`                | `router.subscribe('onBeforeNavigate')` → `'onResolved'` (router-core `router.d.ts:433-449`). `RouteAttrs`: `basalt.route.id`, `basalt.route.from`, `url.path` (pathname, never search) |
| `route.error`                   | router `defaultOnCatch` (`@tanstack/react-router` `dist/esm/router.d.ts:66`), set by `createBasaltRouter`                                                                              |
| `query.error`, `mutation.error` | `queryCache` / `mutationCache` `.subscribe`, `type: 'updated'` with `action.type: 'error'` (query-core `NotifyEventQueryUpdated`)                                                      |
| `render.error`, `window.error`  | the provider's root boundary; `window` `error` / `unhandledrejection`                                                                                                                  |
| `chat.turn`                     | `useAgentThreadRuns`, on settle. `ChatAttrs`: `basalt.chat.thread_id`, `basalt.chat.ttft_ms`, `basalt.chat.parts`, `basalt.chat.status` (`ThreadStatus`)                               |

Delivery rules:

- The sink is called synchronously and wrapped in `try/catch`, so a throwing sink never breaks a
  render.
- Events carry ids, hashes, counts and durations only; never an error object, message, stack,
  search param or query data. A `failed: true` event additionally carries `exception.type`
  (`error.name`, `'Error'` for a non-`Error` throw) and `basalt.error.kind`; a `failed: false`
  event carries neither, and the types enforce both directions.
- Raw errors stay with the consumer's own handlers: `QueryCache`/`MutationCache` `onError` via
  `createBasaltRouter({ query })`, a route `errorComponent`, `BasaltProvider fallback={(error) => …}`,
  `useAgentThreadRuns({ onError })`.
- No sink, no events; dev still `console.error`s raw errors behind a literal `NODE_ENV` check.

**Consumer wiring.** This is argo's `lib/telemetry.ts` and the W2 playground's, verbatim:

```ts
import { SpanStatusCode, trace } from '@opentelemetry/api'
import type { BasaltEvent } from 'basalt-ui'

const tracer = trace.getTracer('basalt-ui')

export function telemetry(e: BasaltEvent): void {
  const span = tracer.startSpan(e.type, { startTime: e.start, attributes: { ...e.attributes } })
  if (e.failed) span.setStatus({ code: SpanStatusCode.ERROR })
  span.end('duration' in e ? e.start + e.duration : e.start)
}
```

Resource and SDK:

- `service.name` is the fleet's kebab `<project>-<component>` (`argo-dashboard`, `argo-api`;
  `basalt-playground` for W2), plus `service.version` and `deployment.environment`. argo's
  `@hyperdx/browser` ^0.23.1 already traces `fetch` and propagates `traceparent` to `/api/`.
- W2: OTel web tracer SDK → OTLP/HTTP `:4318/v1/traces` on the local collector, pinned via `npm view`.

**Open:**

- Does `@hyperdx/browser` register the global `@opentelemetry/api` tracer provider, so argo can use
  the adapter unchanged? W12 verifies; otherwise argo maps to `HyperDX.addAction`.
- A sink's `startChatTurn` opens the turn before the request and its `traceparent` rides the chat
  request (2.5.0), so the API span parents under it; `basalt.chat.thread_id` stays the join key.

## 8. Library adoption ledger

Charter point 3 decides each row: a library is adopted only on evidence. Evidence lives in
`docs/waves/evidence/w1/ledger.md`, and the spike is `spike/w1-ledger` @ `5f8e614`, never merged.
Versions are `npm view` as of 2026-10-13. Bytes are gzip from the isolated Vite lib build, with React
and Mantine external. LOC counts non-comment lines.

| Library                               | Latest                     | Stability                       | Verdict           | 2.0 surface                                                              | Evidence                                                                                                                                                                                                                                                | argo use case                                                          | Pin · upgrade test                                                                                                                                                                                                                                                                     |
| ------------------------------------- | -------------------------- | ------------------------------- | ----------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Table (`@tanstack/react-table`)       | 9.3.1 (tested 9.2.8)       | stable major                    | **adopt** (W6)    | `./table`                                                                | spike on 9.2.8: parity 5/5; v9 22 668 B vs v8 15 699 B (+4 070 B once Store dedupes); `createTableHook` +655 B; LOC 156 (102 + the 54-line `tableFeatures` set) vs 108. Landed: `./table` + Router +3 429 B, playground +2 673 B (`w6/store-dedupe.md`) | 8 tables via `createColumnHelper` (`agents-table.tsx:2` …)             | peer `9.2.8` exact · before any 9.3.x bump, re-run `table-parity`, `table-v9-nosortfns`, `table-v9.type-guard` and the byte build against the candidate                                                                                                                                |
| Store (`@tanstack/react-store`)       | 0.11.2 (1.0.0-alpha.0 out) | pre-1.0                         | **reject**        | none (stays transitive)                                                  | no spike: `./state`'s core is a 30-line listener set (`state/fields.ts:860-890`); Store is 2 899 B, already shipped by Router. Shared: one engine copy in the built bundle, a nested 0.11.0 makes two (+1 626 B)                                        | zustand ×3 (`src/lib/store.ts:25`) stays consumer-owned                | — · one `react-store` copy in the pack-test tree (`bun pm ls`) and one engine in the bundle (`scripts/evidence/store-dedupe.ts`)                                                                                                                                                       |
| Pacer (`@tanstack/react-pacer`)       | 0.24.1                     | pre-1.0                         | **reject**        | none (`@mantine/hooks` `useDebouncedCallback`)                           | spike: parity 3/3; Pacer +4 548 B (+1 497 B store-shared), Mantine −21 B; LOC Pacer 28 / incumbent 27 / Mantine 25                                                                                                                                      | hand-rolled debounces (`diagram-shared.tsx:7`, `workout-draft.ts:174`) | —                                                                                                                                                                                                                                                                                      |
| DB (`@tanstack/react-db`)             | 0.5.8 (db 0.13.0)          | pre-1.0                         | **reject**        | none                                                                     | no spike: argo has no push or sync channel (`gym.ts:22`), so collections would wrap the same polling queries                                                                                                                                            | none; `ThreadsStore` (`threads-store.ts:1`) is `./agent` surface       | —                                                                                                                                                                                                                                                                                      |
| Devtools (`@tanstack/react-devtools`) | 0.10.13 (devtools 0.15.0)  | pre-1.0                         | **reject**        | `BasaltDevDock` stays the one mount; `BasaltQueryDevtools` deleted (§ 1) | no spike: the shell renders with `solid-js` + `goober` and pulls `@neodrag/* 3.0.0-next.11`; the dock already hosts router, query and theme lab                                                                                                         | dock only (`__root.tsx:155`)                                           | —                                                                                                                                                                                                                                                                                      |
| Hotkeys (`@tanstack/react-hotkeys`)   | 0.13.0 (core 0.11.0)       | pre-1.0                         | **adopt** (W3/W6) | `./commands`                                                             | incumbent-peer upgrade, a documented exception to the demo leg: the type spike shows 0.10 → 0.13 widens and the mirrored types fail on **both**; keyboard-dispatch test 2/2 on 0.10 and 0.13; lazy `import()` chunk 5 794 → 7 195 B, off first paint    | `defineCommands` `Mod+B`, `Mod+/` (`src/lib/commands.tsx:86-112`)      | peer `0.13.0` exact, subpath-required for `./commands` (§ 1: `CommandDef.shortcut` is its `Hotkey`); runtime loaded through `defineCommands`' `import()` loader, only when a registry exists · before any bump, re-run `hotkeys.type-guard` + `hotkeys-dispatch` against the candidate |
| Form (`@tanstack/react-form`)         | 1.33.5 (2.0.0-alpha.2 out) | stable, next major in alpha     | **reject**        | `./forms` stays on `@mantine/form`                                       | no spike: `@mantine/form` binds Mantine inputs natively (`key` + `getInputProps`, guarded by `basalt/forms-field-key`); 2.0 alpha means 1.x churn                                                                                                       | 2 sites (`auth-gate.tsx:22`, `issues-section.tsx:311`)                 | —                                                                                                                                                                                                                                                                                      |
| AI (`@tanstack/ai`)                   | 0.68.0 (ai-react 0.30.3)   | pre-1.0, 13 releases in 30 days | **reject**        | `./agent` stays on AI SDK 7                                              | no spike: speaks AG-UI (`@ag-ui/core` dep), while argo's server emits AI SDK v5 UI-message streams; D3 locks that server                                                                                                                                | Hermes chat (`hermes-transport.ts:1`, `aiSdkTransport`)                | — · `ai` stays the `./agent` peer                                                                                                                                                                                                                                                      |

argo paths are relative to `apps/dashboard/` (argo @ `95d63d6`). Mantine 9.7.1 overlaps `useAppShellResize`, `EmptyState`, `DataList`, `Toolbar`, `ActionBar`: all **reject**, none deletes basalt code (`docs/waves/evidence/w7/adopt-or-delete.md`).

### Rationale (non-obvious verdicts)

- **Table: hide `createTableHook`; keep one helper.** `createTableHook` exists for several tables
  that share features and registered components. basalt has one table component, so the factory buys
  nothing and costs +655 B. The table owns one module-scope `tableFeatures` set over `useTable`. The
  `createColumnHelper` re-export becomes basalt's own function with the same name and the same
  one-generic call (`createColumnHelper<Row>()`). It returns `ColumnHelper<BasaltTableFeatures, Row>`,
  because v9's raw helper needs `<TFeatures, TData>`, a generic no consumer should spell. argo's 8
  call sites keep their import and call shape.
- **Table: why adopt at +4 kB.** v8's last release was 8.21.3 on 2025-04-14, and v9 has been GA since
  2026-08-04. v9 makes the per-table `columnMeta: metaHelper<…>()` slot available, which keeps the
  `meta: { aling }` compile error without the global `declare module '@tanstack/react-table'` that 1.x
  leaks into every consumer (`data-table.tsx:117`). That is charter point 1. The +4 070 B is a W6
  regression to beat or accept in its **Left behind**.
- **Table: pin what was tested.** 9.3.1 (published 2026-10-12) is inside `~/.bunfig.toml`'s 3-day
  `minimumReleaseAge` until 2026-10-15, so every number above is 9.2.8. The upgrade test is the gate
  for 9.3.x.
- **Table: three migration traps the spike hit.**
  - v9 sorts strings as `basic` unless `sortFns` registers `alphanumeric`, `text` and `datetime`
    (negative control: `Project 10` before `Project 2`), and the only signal is a dev warning.
  - Column `getStart`/`getAfter` and header `getStart` are declared on `columnSizingFeature`, not
    `columnPinningFeature` (`table-core@9.2.8`
    `dist/features/column-sizing/columnSizingFeature.types.d.ts:108,120,134`). Sticky pinning
    therefore needs `columnSizingFeature` registered.
  - Pinning is logical (`start`/`end`), so `data-table.tsx:934,941,1486` change.
- **Hotkeys: adopt, and stop mirroring.** The audit's "never imported, types mirrored" design is
  already broken: `hotkey: string` is not a `RegisterableHotkey` on 0.10.0 either, so
  `toHotkeyBindings()` → `useHotkeys()` never compiled. `as unknown as PeerModule`
  (`useCommandHotkeys.ts:74`) hides the same failure.
  - 2.0 deletes `HotkeyBinding`, `PeerModule` and `HotkeyHandle`, takes `import type` from the
    pinned peer, and types `CommandDef.shortcut` as the peer's `Hotkey`, which makes `'Cmd+B'` a
    compile error.
  - The peer is subpath-required for `./commands` (§ 1): its public `.d.ts` types `shortcut` as
    the peer's `Hotkey`. `.` never names it. `defineCommands` registers an `import()` loader, so the
    runtime loads only when a registry exists and stays off first paint (the provider-only budget
    is 18 927 / 19 000 B); the lazy-chunk bytes are the cost that matches the wiring.
  - Scope: only `./commands` consumers install Hotkeys, as only `./table` consumers install Table.
  - 0.13 is ESM-only, which suits basalt's ESM-only build.
  - With Store shared the delta grows (+1 567 B against +1 401 B). 0.10 bundles Store 0.11.0
    (1 950 B) and 0.13 bundles 0.11.2 (1 784 B), and the 166 B smaller Store offsets part of
    Hotkeys' own growth.
- **Pacer: the incumbent is Mantine, not basalt.** basalt and argo only debounce. `@mantine/hooks`
  9.3.0 (as resolved in `master`'s `bun.lock:733`) gives `useDebouncedCallback` with
  `flush`/`cancel`/`isPending` plus `flushOnUnmount`/`maxWait` options
  (`lib/use-debounced-callback/use-debounced-callback.d.ts:1-11`). It is always installed, because
  `@mantine/core` 9.3.0 (`bun.lock:727`) peers `@mantine/hooks` exactly (`9.3.0`) and
  non-optionally, and 9.7.2 on npm keeps that peer. Pacer's differentiators (rate-limit, queue,
  batch, async retry) have no caller. One way to debounce: SearchFilter, `useFormDraft` autosave and
  DataTable's global search (undebounced today, `data-table.tsx:1865`) move to the Mantine hook.
- **Store: already present, never exposed.** Router 1.170 (`bun.lock:1107`), Table v9, Hotkeys 0.13
  and Pacer all depend on `@tanstack/react-store ^0.11`. The cost is paid once if the tree dedupes (proven: `w6/store-dedupe.md`).
  The spike lockfile held 0.11.0 and 0.11.2, which made a second `with-selector` chunk. basalt
  re-exports no Store symbol and does not surface `table.Subscribe`/`table.atoms`.
  `state/fields.ts` (1,147 lines) resolves URL ⊳ localStorage ⊳ fallback lanes, which Store does not
  do.
- **AI: D3 decides it.** Moving the client to TanStack AI means an AG-UI producer, which is the
  server migration D3 (`argo:docs/HERMES-CHAT-V2.md:52`) exists to avoid. W8 drops "TanStack AI per
  the ledger".

### Former `⟂ § 8` markers (resolved)

| Where | Line resolves to                                                                                                                                                                                                                                                |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| § 1   | `./table`: `BasaltDataTable`, `createColumnHelper` (basalt-owned, 1 generic). No `useTable`, `createTableHook`, `tableFeatures`, `flexRender` or row-model re-export                                                                                            |
| § 1   | `./commands`: `HotkeyBinding` and `toHotkeyBindings` deleted as public exports; the projector is provider-internal, loaded through the loader `defineCommands` registers                                                                                        |
| § 1   | `BasaltQueryDevtools` deleted, folded into `BasaltDevDock` (§ 1 records it)                                                                                                                                                                                     |
| § 1   | no direct `@tanstack/{store,react-store,pacer,react-pacer,db,react-db,devtools,react-devtools,react-form,ai,ai-react}` peer, dependency or symbol; the transitive `react-store` (Router, Table, Hotkeys) stays                                                  |
| § 2   | peers: `@tanstack/react-table 9.2.8` exact (subpath-required for `./table`), `@tanstack/react-hotkeys 0.13.0` exact (subpath-required for `./commands` per § 1, type-level; runtime loaded through `import()` only when `defineCommands` registered a registry) |
| § 2   | devtools mount = `BasaltDevDock` (router + query + theme lab), lazy and dev-only; no TanStack Devtools shell                                                                                                                                                    |
| § 6   | chat runtime = AI SDK 7 (`ai` + `@ai-sdk/provider` types, subpath-required for `./agent`; basalt never imports `@ai-sdk/react`); no TanStack AI adapter or transport                                                                                            |

**Open:**

1. ~~Accept Table v9's +4 070 B?~~ **Resolved:** accepted on condition of one shared Store copy, proven in
   `docs/waves/evidence/w6/store-dedupe.md` (+3 429 B with Router, +2 673 B playground); guards: pack-test, `store-dedupe.ts`.

## 9. Charts

Engine: `@tanstack/charts` **1.1.0** and `d3-scale` **4.0.2**, exact optional peers of `./charts`
(bun's isolated linker hides TanStack's own `d3-scale`). visx is gone: no dependency, peer or
re-export. Evidence: `spike/w1-charts` @ `f74f671`, `docs/waves/evidence/w1/charts.md`. Inventory
(59 production charts) and the 1.x → 2.0 symbol map: `docs/waves/v2-chart-inventory.md`.

**Upgrade test** (W4-gated): chart + layout suites pass unmodified, per-kind `make evidence` (W2)
gzip moves ≤ 5 %. W4 ports the spike's 12 tests (version compat included); until then, the evidence
file's reproduce commands are the proof.

### 9.1 Ownership

| Concern                                                            | Owner    | How                                                 |
| ------------------------------------------------------------------ | -------- | --------------------------------------------------- |
| Marks, scales, scene, SVG, reconciliation, motion                  | TanStack | definition → keyed scene                            |
| Margins and tick collision                                         | TanStack | measured guide solve + `tickLabels.thin`            |
| Pointer/keyboard focus, crosshair, tooltip surface, SSR, hydration | TanStack | DOM host behind `@tanstack/charts/react`            |
| y/y2 domains (auto rule, floors, pad, hidden series)               | basalt   | configured scale instances; TanStack never infers y |
| x scale choice, cursor groups, cursor resolution                   | basalt   | § 9.4                                               |
| Series, zones, x-zones, thresholds, ref lines                      | basalt   | compiled to marks, fixed paint order                |
| Theme                                                              | basalt   | § 9.5                                               |
| Legend, height law, `state`, `ChartCard` slots                     | basalt   | the host (HTML, Mantine-free)                       |
| Tooltip content                                                    | basalt   | structured rows; the surface is TanStack's          |

### 9.2 The composition rung

`CartesianChart` stays the one cartesian rung and changes nature: a **definition compiler plus one
host**, not an SVG assembly. Every cartesian kind is `CartesianChart` with fixed `marks`.

```tsx
import { lineY } from '@tanstack/charts/line'
;<CartesianChart
  ariaLabel="Load" // required by the type
  data={rows}
  x={(d) => d.at} // Date | number | string, § 9.4
  series={[{ key: 'load', label: 'Load', color: VX.line, getValue: (d) => d.load }]}
  y={{ domain: [0, 100], format: fmtCompact }}
  zones={zones} // + xZones, refLines, y2, legend, height, state, cursorGroup
  marks={(plot) => [lineY(plot.rows('load'), { x: 'x', y: 'y' })]}
  tooltip={{ rows: (d, { visible, hidden }) => [{ label: 'Target', value: '70' }] }}
/>
```

| Layer (private)           | Contract                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `compileCartesian(props)` | pure, React-free → `ResponsiveChartDefinition<Row<T>, X, number, 'dom'>`, return type annotated (inferred TanStack types fail declaration emit: TS2883/TS4058)           |
| `sizing.ts`               | pure `resolveChartSize` (measured width → container class → height) plus `useChartSize`; `INITIAL_WIDTH` 640; knows no engine, legend or card                            |
| `host.tsx`                | the bare engine mount and the only importer of `@tanstack/charts/react`; a definition, a size and an `ariaLabel`                                                         |
| `CartesianRung`           | in `CartesianChart.tsx`: the derived legend, the `state` placeholders, and the hand-off of a `placement: 'header'` legend to `ChartCard` through context, with no portal |

- `marks(plot)` returns TanStack marks imported from the allowed subpaths (§ 9.8; basalt
  re-exports none). `plot.rows(key)` is `{ x, y, series, datum }[]`, a `null` y kept as a gap.
  Hidden series emit no rows, so a legend toggle hides plot, tooltip and auto domain together.
  `plot.plotWidth`/`plotHeight` are the laid-out plot in px (the frame until measured), `plot.data` all rows.
- Paint order is fixed: zones, x-zones (`decorative`) → `marks` → ref lines → crosshair.
- Exported types include `ChartMarks` and `ChartX`; `SeriesKey` lives on `.` only.
- `DualPanel`/`MirroredBars`: `composeViews` + `grid` + `alignX` (one host, one tooltip). `Donut`:
  `polar`. `Sparkline`: `guides: false, margin: 0`. Formatters: `./format` only.

### 9.3 Kinds

| 2.0              | 1.x                                                   | Charts | Must support                                                                                                      |
| ---------------- | ----------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| `CartesianChart` | `CartesianChart`, bespoke `ChartFrame` bodies         | 13     | numeric x, `areaY` y1/y2 bands, `vector` glyphs, `rect`/`ruleX` annotations, `tickY` whiskers, step curves        |
| `Lines`          | `ZonedLine` + `MultiLine`, line-only `CartesianChart` | 16     | n series, `area` gradient, `thresholds` (Date/number x only), markers, overlay/reference roles, dash, curve, `y2` |
| `Bars`           | `Bars`                                                | 9      | stacked/grouped/normalised, ± bars, overlay lines on `y`/`y2`, opacity fn, `scaleBand` over `Date`/string         |
| `StackedArea`    | `StackedArea`                                         | 3      | dynamic keys + color fn, `y.format`                                                                               |
| `DualPanel`      | `DualPanel`                                           | 2      | fill-between (`differenceY`), ± bars, `topFraction`, per-pane domains                                             |
| `MirroredBars`   | `MirroredBars`                                        | 1      | per-pane domains, absent fraction, `fold`                                                                         |
| `BandStrip`      | `BandStrip`                                           | 2      | state fills, `fold`, absent state, transition markers                                                             |
| `Donut`          | `Donut`                                               | 1      | center labels, `colorForKey`, ≤ 6 slices + Other                                                                  |
| `Heatmap`        | `Heatmap` (0 uses)                                    | 3      | `cell` band × band, absolute intensity, absent state, `colorGradientLegend`, per-cell rows, no cursor             |
| `Sparkline`      | `LineSparkline` + `BarSparkline`                      | 9      | `mark: 'line' \| 'bar'`, emphasise last, width optional (host measures)                                           |

- Merged: `ZonedLine` + `MultiLine` → `Lines` (zones, x-zones, ref lines and `y2` moved to the rung;
  only thresholds and area differed); the two sparklines → `Sparkline`. No new kinds: bands and
  ribbons (4 charts, 2 repos) are one `areaY` with `y1`/`y2`, a mark.
- `Heatmap` replaces argo's time-of-day grid and linewatch's `CategoryGrid` (×2).

### 9.4 x scales, cursor, tooltip

| `x` returns | Line/area kinds                                 | Bar kinds           |
| ----------- | ----------------------------------------------- | ------------------- |
| `Date`      | `scaleUtc`, proportional (closes 1.x issue #52) | `scaleBand<Date>`   |
| `number`    | `scaleLinear`                                   | `scaleBand<number>` |
| `string`    | `scalePoint`                                    | `scaleBand`         |

**Cursor**

- One `createChartCursor()` per group in a module map, no provider. `'default'` is shared;
  `cursorGroup="…"` isolates (replaces `ChartCursorScope`).
- `chartCursor(group?)` → the controller, for app sync (named consumer: weatherorb's timeline):
  `useSyncExternalStore(controller.subscribe, controller.getState, () => null)`. It is `getState`;
  TanStack has no `getSnapshot`.
- Teardown (W4; not spiked): a refcount per group of live `subscribe` registrations. The last
  unsubscribe drops the entry; `getState` on a missing group returns `null` without creating one.
- **Client-only by construction**, so no state crosses concurrent SSR requests.
  - Without `window`, `chartCursor()` returns an inert controller (null, no-op set/subscribe) and
    creates no map entry. Bindings resolve their controller per call, not at compile time.
  - The engine reads no binding on the server: SSR runs `adapter.prerender()` only, and
    `mountChartRenderer` (`dist/renderer.js:51`) consumes the binding from a layout effect.
  - Proven by spike test `SSR cursor isolation`.
- Binding `{ use: cursorHost, mode: 'focus', match: 'x' }` (+ `pin`, § 9.6) on a per-chart **view**
  keyed by `chartId` (`useId`). It is identity-preserving, because TanStack clears only the object a
  host published:
  - it stamps the states this chart publishes (a `WeakMap`);
  - it snaps a foreign value onto this chart's keys, because TanStack matches exactly.
    `cursorResolution` is `'nearest'` (the default), `'leading'` or `'exact'`; strings are exact.
- Charts whose x value types differ never sync (the 1.x `DomainKind` partition).
- `Date` x labels (ticks and tooltip title) format in UTC, to match `scaleUtc`.

**Tooltip**

- Surface: TanStack's tooltip + `portal` (the Popover top layer, or `position: fixed` under `body`).
- Content is a compiled `content(points) → { title, rows }`. `title` is `formatHeader(x)`. Rows are
  one per visible series, then `tooltip.rows(d, { visible, hidden })` → `ChartTooltipRow[]`, which
  replaces `TooltipRow`, `label`, `prependRows` and `extraRows`. `tooltip={false}` disables it.
- **Source-only by default.** The crosshair paints on every chart in the group (the 1.x law). Only
  the chart under the pointer or keyboard focus shows a tooltip and a live region.
  - A 1.1.0 host shows a tooltip only for a resolved focus point. It resolves a shared state's
    point through the definition's focus strategy; the crosshair needs no point.
  - basalt therefore wraps the public `group-x` strategy (`resolveChartFocusStrategy`,
    `@tanstack/charts/cursor/host`): `group` returns `[]` while the state isn't this chart's stamp,
    so unstamped programmatic states show only the crosshair.
- `tooltip.onFollow: true` opts a follower back in (7 of 59 charts). Spike: 1 tooltip, 2 with
  `onFollow`; the engine trace is in the evidence file.

### 9.5 Theme bridge

The definition's `theme` and guide options:

| Key                         | Value                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| `theme.foreground`          | `var(--vx-ink2)`                                                                                    |
| `theme.muted` (tick labels) | `var(--vx-axis)`; `tickLabels.opacity: 1`                                                           |
| `theme.grid`                | `var(--vx-grid)`; `grid.strokeOpacity: 1` (the token is pre-mixed; TanStack's 0.11 would dilute it) |
| `theme.background`          | `transparent`                                                                                       |
| `theme.palette`             | `var(--ts-chart-1)` … `var(--ts-chart-6)`                                                           |
| axis line (W4, not spiked)  | `var(--vx-axis-stroke)`                                                                             |
| crosshair (W4, not spiked)  | `var(--vx-crosshair)`                                                                               |
| dash (W4, not spiked)       | `VX.dashArray`                                                                                      |

The charts layer emits these as one `:root` block (`chartEngineCss()`, appended to `styles.css`);
`buildPaletteCss` stays engine-agnostic. The host is no option: the portal's fallback reparents the
tooltip under `<body>` (spike). Inheritance from `:root` is a W4 layout-suite assertion in Chrome.

| `--ts-chart-…`                                                | value                                                                                                      |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `1` … `6`                                                     | `var(--vx-line)`, `--vx-accent`, `--vx-fill-cyan`, `--vx-fill-orange`, `--vx-fill-grape`, `--vx-fill-lime` |
| `tooltip-background`                                          | `var(--vx-tooltip-bg)`                                                                                     |
| `tooltip-color`                                               | `var(--vx-tooltip-text)`                                                                                   |
| `tooltip-border`                                              | `var(--vx-tooltip-border)`                                                                                 |
| `tooltip-shadow`                                              | `var(--vx-tooltip-shadow)`                                                                                 |
| `tooltip-border-radius`                                       | `var(--vx-radius-ctrl)`                                                                                    |
| `crosshair-label-halo`, `crosshair-marker-fill`, `focus-fill` | `var(--vx-surface-panel)`                                                                                  |

- The host sets `color: var(--vx-axis)` (`currentColor` = axis ink) and pins
  `font-family: var(--basalt-font-mono)` (tick labels in mono, the 1.x look). Series
  paint is `ChartSeries.color` (`VX.*` or a consumer series token); `raw-hex`/`raw-color-fn` cover
  mark paint. The spike asserts zero TanStack default hexes in the SSR output.

### 9.6 Responsive and plot-first mobile

`useChartSize` measures the width and resolves the container class (`resolveContainerClass`, the 1.x
three-axis law's only chart axis). The compiled `chart: ({ width }) => spec` reads the same class:

| Class         | y axis                                                 | Ticks x / y | Font         | Legend              |
| ------------- | ------------------------------------------------------ | ----------- | ------------ | ------------------- |
| micro < 240   | none                                                   | 2 / —       | `TEXT.nano`  | none                |
| compact < 480 | labels inside the plot                                 | 3 / 3       | `TEXT.nano`  | dots                |
| regular < 800 | outside                                                | 5 / 5       | `TEXT.micro` | chips               |
| wide          | outside; `Lines` end labels when ≤ 3 lines and no `y2` | 6 / 5       | `TEXT.micro` | chips or end labels |

- The height law (width × class ratio, 160–420, ≤ 45 svh on a coarse pointer) is CSS since W10:
  `ChartBox` container queries fix the box before JS, so hydration moves nothing (CLS 0).
- Tick labels never rotate; collision is `tickLabels.thin`. Touch: `pin` is on for coarse pointers only (tap pins and
  unpins) and the host sets `touch-action: pan-y`. W4 proves both, and y labels inside the plot.

### 9.7 a11y and SSR

- `ariaLabel: string` is required on every kind. Keyboard: TanStack's first-party focus (`tabIndex
  0`; ←/→, Home/End; Enter/Space pins; Escape) replaces `HoverOverlay`'s `role="slider"`.
- SSR: `renderToString` emits the full accessible SVG at `initialWidth` (spike). Hydration adopts
  it; `idPrefix` comes from `useId`. The engine's React-free `renderChartSvg` stays unexposed until
  a consumer names it.
- W10: pending state is the streamed fallback; a `barY` needs `z`/`color`/`layout` or `y1` (else N×N; `barMark`).

### 9.8 Boundary and lint (every rule at `error`)

`src/charts/**` imports only `@tanstack/charts/*`, `d3-scale`, `react`, `../tokens`, `../format`
and `../common`. Two W4 exceptions: curves are in-house (`curves.ts`, so no `d3-shape` peer), and
`ChartCard` imports `../dashboard/widget-header` (Mantine-free).

`basalt/chart-engine-boundary`:

- `@visx/*` is banned everywhere.
- Outside basalt, `@tanstack/charts` is an **allowlist**: `/line`, `/area`, `/area-x`, `/bar`,
  `/rect`, `/rule`, `/dot`, `/tick`, `/text`, `/vector`, `/link`, `/arrow`, `/difference`,
  `/stack`, `/scales/*`, `/transform/*`, `/mark/decorative`, `/d3/shape` and `/types`.
- Everything else is an error: the bare root (it re-exports `defineChart`, `createChartRuntime`,
  `mountChart`, `renderChartSvg`, `createMark`) and any new engine subpath.

| 1.x                                                                   | 2.0                                                                                                       |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `basalt/visx-boundary`, `basalt/visx-tooltip`                         | `basalt/chart-engine-boundary`, above                                                                     |
| `basalt/hand-rolled-plot`                                             | deleted: with hosts banned, a plot without the rung cannot render                                         |
| `raw-visx-axis` guard                                                 | deleted: there is no axis component to hand-roll                                                          |
| `basalt/chart-legend-literal`                                         | deleted with the public `ChartLegend`                                                                     |
| `chart-missing-aria-label` guard                                      | deleted: required prop                                                                                    |
| `basalt/token-layer-boundary` (repo-only)                             | kept: no `@mantine/*` in `src/charts/**` or `src/tokens/**`                                               |
| —                                                                     | repo-only `basalt/chart-host-single`: `@tanstack/charts/react` is imported by `src/charts/host.tsx` alone |
| `chart-in-raw-surface`, `unknown-vx-token`, `raw-hex`, `raw-color-fn` | kept                                                                                                      |

### 9.9 Cost

`ZonedLine` + engine, gzip, `react` external: 57 642 B (visx) → 72 114 B (+25.1 %). All other
numbers and the commands: `docs/waves/evidence/w1/charts.md`.

**Accepted** (owner, 2026-10-13): the first chart's +14.5 KB gzip, for SSR, a11y and the marks.

**Accepted** (lead, W5, 2026-10-14; supersedes the +14.5 KB figure above): the real first-chart cost, `Lines` +31.5 KB over 1.x `ZonedLine`
(`/charts` 129.9 KB beyond initial against 81.7 KB, `./charts` itself −32 %). Update p50 and first paint @1x are flat to 1.41 (−21 % update at W4); basalt's own 17.8 KB is the trim candidate if a later wave needs bytes.

**Resolved (W5):** the absent state is a flat `--vx-neutral` fill, no custom hatch mark. The flat fill stays for partial absence too. `BandSpan.absentFraction` + `BandStrip.absentState` paint a folded band's unmeasured share flat from its right edge, legended, with a "Not measured" tooltip row. It differs from zero/low by `VX.neutral` hue against the state fills in both schemes, and by legend, tooltip and a fixed edge, not colour alone; hatch needs an SVG `<pattern>` decorative rects cannot carry. Stacked `Bars`
on a log axis throws in dev and logs once in production, as 1.x did. `StackedArea` rejects
`y.scale` in its type.

**Resolved (W4): legend hover emphasis.** The definition is rebuilt per legend hover. Mark `states`
can neither show legend-only entries nor drop hidden series from the y domain.

### 9.10 Law carried over from 1.x

Engine-independent. The 1.x text is under `docs/archive/`. Everything here is true of the shipped
rung and the nine kinds.

**Series and colour**

- `series` is the one source of the mark, the legend entry and the tooltip row; a chart cannot show a
  row it does not draw. `ChartSeries.formatValue` is `(v, d)`, so a row can cite the datum.
- Series colour is consumer domain data: one guard-exempt file per app, `defineSeries` →
  `seriesTokens` / `groupTokens` → `buildPaletteCss` (§ 4). There is no `VX.series`. A new colour is
  a `{light,dark}` pair in the palette data, its `--vx-*` var and a `VX.*` ref; never a raw hex.
  Scheme change is pure CSS, with no re-render.
- `null` is a gap, never a zero: lines break, no tooltip row, out of the domain. A series whose
  `getValue` is always `null` is a legend-only entry.
- `y.scale: 'log'` floors at the smallest positive visible value; `nice` is off by default; the auto
  max floor clamps before padding.
- A series keyed by a bucket's leading edge (a Monday, a 1st) takes `cursorResolution="leading"`.

**Extracting a kind (Rule of Three)**

| Situation                                 | Do                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| Fits a shipped kind                       | Use it                                                                         |
| Second instance of a shape without a kind | Extract it, migrate both call sites; ship the "still cannot express" list      |
| Genuinely unique                          | Stay bespoke: `CartesianChart` with consumer `marks`, in the page's chart file |
| Doesn't fit the rung                      | Add a kind; never loosen the rung, never a `<Chart type config>` switch        |

A kind is proven by porting a real consumer's call sites, not by a demo page.

**Height and chrome**

- `height` is a number (fixed) or `{ base, regular, wide }` (`base` below regular). Unstated, it is
  width × class ratio (§ 9.6). On a coarse pointer every height, a literal included, is capped at 45 %
  of the viewport.
- `ChartCard` (`BasaltProps`, `classNames` `root|header|body`) folds its header when the chart states ≤ 180 px
  (CSS, W10); a non-chart body is still measured (< 280 px, hysteresis 24 px).

**Legend**

- Derived from `series`. Toggle is on at ≥ 2 entries (`legend.toggle` overrides); a click hides the
  series from the plot, the tooltip and the auto domain together. `legend={false}` removes it.
- `placement`: `bottom` (default), `top`, or `header` (drawn by the chart at the top of the card body,
  so it is in the server HTML; W10). `groups` separates series | overlay | reference.
- Hovering an entry emphasises its series (§ 9.9, resolved).

**State**

- `state?: { pending?, error?, empty? }`, in the rung and in `ChartCard`; precedence is fixed,
  **pending → error → empty**, so a refetch over a stale error is pending. `pending` is an
  `aria-busy` `<output>`, `error` a `role="alert"` block, `empty` an `<output>` (`true` or its label).
- Never fake an empty dataset for a pending query: `data ?? []` turns "not asked" into "measured
  and absent".
- Every `./format` formatter (`percent`, `money`, …) returns `NON_FINITE` (an em dash) for `NaN`,
  `±Infinity` and `Invalid Date`.

No kind is exempt from the rung's host: `basalt/hand-rolled-plot` is deleted (§ 9.8).

## 10. Open questions

Index of every section's **Open** list; the section holds the detail. Owner calls first, then the wave
that settles each engineering question.

| #   | Question                                                                        | Section  | Settled by             |
| --- | ------------------------------------------------------------------------------- | -------- | ---------------------- |
| 1   | Accept the engine's +14.5 KB gzip on the first chart for SSR, a11y, marks?      | § 9.9    | accepted; W5: +31.5 KB |
| 2   | Accept Table v9's +4 070 B (+6 969 B without Store dedupe), or offset in W6?    | § 8 Open | accepted: shared Store |
| 3   | `./styles.css` importing Mantine's layer CSS resolves in a scratch install      | § 1 Open | W3 pack-test           |
| 4   | `ModalsProvider` wrapping the tree: `modals.*` re-render cost                   | § 2 Open | W3                     |
| 5   | `<ViewTransition>` fallback without `document.startViewTransition`              | § 5 Open | W7 evidence            |
| 6   | `@hyperdx/browser` registers the global OTel tracer provider?                   | § 7 Open | W12                    |
| 7   | resolved in 2.5.0: `startChatTurn` propagates `traceparent`; join key unchanged | § 7 Open | W14                    |
| 8   | Absent-state hatch: custom mark or flat `--vx-neutral` fill                     | § 9.9    | settled W5: flat fill  |
| 9   | Legend hover emphasis: rebuild per hover or mark `states`                       | § 9.9    | settled W4: rebuild    |
| 10  | Stacked `Bars` on a log axis: throw in dev, or document the gap                 | § 9.9    | settled W5: throw      |

Resolved by the lead in W1: § 9 keeps 8 1.x value names and adds a handful (`Lines`, `Sparkline`,
`chartCursor`, …), well inside § 1's 48 allowance, so the ≤ 140 value ceiling stands; W3 sets the
budget to the landed count. Follower tooltips are source-only by default (§ 9.4). Peers
have two senses (§ 1). `./controls-dates` and `./forms` stay separate subpaths.
