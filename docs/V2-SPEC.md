# basalt-ui 2.0 — the contract

Ground truth for the 2.0 rewrite (`docs/waves/PLAN.md`). Each 1.x spec stays authoritative for the
1.x line (`1.x` branch) and is archived once its surface is ported here. Where this file and a 1.x
spec disagree about 2.0, this file wins.

<!-- lead: header, precedence and cross-section reconciliation -->

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
| `./styles.css`     | the one stylesheet (it `@import`s the Mantine layer bundles first, § 2)                                                                                                                                                                                                                                                                                                                                                               | all 7 app consumers                                                    | —                                 |
| `./configs/*`      | oxlint / tsconfig / lefthook / oxfmt presets                                                                                                                                                                                                                                                                                                                                                                                          | argo, linewatch, rb, image-gateway, … (`.oxlintrc.json`, `tsconfig.*`) | —                                 |

**Dropped:** `./guard` (CLI-internal), `./theme-lab` (provider-mounted in dev), `./data/virtual`,
`./llms.txt` and `./package.json` (0 imports; files stay in the tarball), `./tokens.css` (weatherorb
1.30 and rollhook 1.36 only; `basalt-ui tokens:css` emits it). Folds:

| Fold (1.x split reason)                                                                                         | 2.0                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `./controls-dates` stays separate (`./controls` must never reach `@mantine/dates`, `MAINTAINING.md` § Layering) | kept. Folding would make `@mantine/dates` + `dayjs` required peers of every `./controls` consumer and add the 3.4 KB gzip `@mantine/dates/styles.layer.css` to the one stylesheet (CSS never tree-shakes). That cost lands on four consumers for argo's 3 files                                                                              |
| `./forms` stays separate (`./controls` must never reach `@mantine/form`, same section)                          | kept. § 8 keeps `@mantine/form`; that peer stays out of `./controls`                                                                                                                                                                                                                                                                         |
| `./agent-chat` → `./agent` (`./agent` is in the Mantine-free dist-layering set; `motion` eager in the chat UI)  | Mantine is a required peer of the 2.0 framework, and no consumer imports the headless half alone (argo uses both). `src/agent/**` runtime stays Mantine-free as a repo-local lint boundary, `./agent` leaves `check-dist-layering`'s list, and `motion` becomes a required peer (§ 5). Unused chat UI tree-shakes (`sideEffects: ['*.css']`) |
| `./notifications` → `./commands` (`@mantine/notifications` was an optional peer)                                | no new peer: `BasaltProvider` mounts `Notifications`, `ModalsProvider` and `Spotlight` (§ 2), so all three are required peers of `.` already                                                                                                                                                                                                 |

**Rules.** W3 delivers the gates for all three in `check-budgets.ts`; none exists in 1.41:

- One import path per symbol: no name will appear under two subpaths (1.41 has 107 such names).
- A public symbol needs a named consumer outside `apps/playground` (charter 1). W3 adds
  `scripts/consumers.json`, keyed by symbol name (a moved symbol keeps the consumer it has under its
  1.41 specifier), and a symbol missing from it will fail the gate.
- Peers: a peer imported statically outside its own dedicated subpath, or named by a public `.d.ts`,
  is required (Hotkeys `0.13.0` exact, § 8). `optional` is for peers reached only through `import()`
  (`ai`, `remend`, `shiki`, `beautiful-mermaid`, devtools, `vite-plugin-pwa`) or only by
  `./controls-dates` / `./forms` / `./table` / `./vite`. A dist-graph walk will assert it.

**Charter 2 exceptions** (wiring, no 1.41 consumer yet): `createBasaltRouter` (router + Query
wiring, § 2), `BasaltRouterContext` (the root route's context type, § 2), `BasaltEvent` (the
telemetry seam, § 7). Each names argo as its first consumer in `v2-surface.md` § New in 2.0.

| Budget (`check-budgets.ts`)              | 1.41                | 2.0 target                                                |
| ---------------------------------------- | ------------------- | --------------------------------------------------------- |
| public value symbols                     | 395                 | ≤ 140 (non-chart 92 + § 9's chart allowance 48)           |
| barrel type exports, non-chart (W3 adds) | 517 (448 non-chart) | ≤ 60 (40 kept); chart types count against § 9's allowance |
| published subpaths                       | 24                  | 15                                                        |
| shipped rule lines (`agent/rules/*.md`)  | 750                 | ≤ 450                                                     |

**Open:**

- § 9's chart symbol count against the 48 allowance; the lead reconciles the total ceiling.
- `./styles.css` importing Mantine's layer CSS: W3's pack-test proves it, or 1.x's CSS order stays.

## 2. Provider and wiring

One `BasaltProvider` owns the whole provider tree, the router included. The consumer writes the
route tree, the nav, and the registries (commands, notifications). 1.x left argo 220 lines of wiring
(`main.tsx` 61 + `__root.tsx` 159); the target below is 25 lines of code.

| Basalt wires                                                                                                                                                                                                                                                   | Where                                                                                                                | Replaces in 1.x                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `MantineProvider` + theme (`theme` defaults to `createBasaltTheme()`, § 4) + resolver + palette `<style>`                                                                                                                                                      | `BasaltProvider`                                                                                                     | unchanged                                                                        |
| `createRouter` with `context.queryClient`, `defaultPreload: 'intent'`, `defaultPreloadStaleTime: 0` (Query owns freshness), `scrollRestoration: true`, `defaultPendingComponent`, `defaultErrorComponent`, `defaultNotFoundComponent`, `defaultOnCatch` → § 7  | `createBasaltRouter({ routeTree, context?, query? })`                                                                | argo `lib/router.ts`, `__root.tpl`, `QueryState`/`LoadingState`/`ErrorState`     |
| `QueryClient` with 1.x defaults (`staleTime` 30 s, `gcTime` 5 min, `retry` 2, no refetch on focus; `src/query-client.ts`), merged with `query: QueryClientConfig`; one client per `createBasaltRouter` call, so an SSR entry gets one per request              | `createBasaltRouter`                                                                                                 | `createBasaltQueryClient`, `query-client.ts.tpl`                                 |
| `QueryClientProvider` > `ModalsProvider` (wrapping, real context) > `RouterProvider`; `Notifications` and `Spotlight` as siblings                                                                                                                              | `BasaltProvider router={router}`                                                                                     | `BasaltOverlays`, the `provider-above-router` rule                               |
| hotkeys from the `defineCommands` registry: `@tanstack/react-hotkeys` `0.13.0` exact is a required peer (its `Hotkey` types `CommandDef.shortcut`); the runtime loads through `import()` in the provider, off first paint (§ 8)                                | `BasaltProvider`                                                                                                     | `useCommandHotkeys`, `toHotkeyBindings`                                          |
| Spotlight actions from the command registry plus `flattenNav`                                                                                                                                                                                                  | `BasaltProvider`                                                                                                     | `toSpotlightActions`, `basaltSpotlight`                                          |
| root error boundary (`fallback` prop), `window` `error`/`unhandledrejection` listeners, all routed to `telemetry` (§ 7)                                                                                                                                        | `BasaltProvider`                                                                                                     | `BasaltErrorBoundary`, `onError`                                                 |
| dev dock (router + query devtools, theme lab, persisted lab overrides applied) and three Spotlight commands `dev.router` / `dev.query` / `dev.theme`; `BasaltDevDock` is the one dock, mounted here and not exported (§ 8 rejects the TanStack Devtools shell) | `BasaltProvider`, behind a literal `process.env.NODE_ENV !== 'production'` check at the `lazy(() => import(…))` site | `BasaltDevDock`, `BasaltQueryDevtools`, argo's `applyOverrides(loadOverrides())` |
| nav → sidebar + mobile bar + breadcrumbs                                                                                                                                                                                                                       | `BasaltShell nav={NAV}`                                                                                              | `useNav` spread, `useRouterBreadcrumbs`                                          |
| route-change transition (§ 5)                                                                                                                                                                                                                                  | `BasaltShell` main region                                                                                            | —                                                                                |

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

**Open:**

- `ModalsProvider` wrapping (not beside) the tree: W3 measures `modals.*` re-renders first.

## 3. Strictness

Wrong usage fails `tsc` first and lint second; prose-only rules do not ship (charter 5). The types
assume the `configs/tsconfig.base.json` preset (`strict`, `exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`); `doctor` fails when the app's tsconfig does not extend it.

**Type errors**

| Mistake                                              | 1.41 enforcement                                                   | 2.0 type                                                                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| a filter/tab given `value`, `onChange` or `size`     | props absent (excess-property check)                               | kept, plus named slots `value?: never; onChange?: never; size?: never`, so the error names the mistake                                                 |
| `PageBar` > 5 actions or ≠ 1 primary; `Section` > 3  | `basalt/page-bar-budget` lint                                      | `actions: [P] \| [P, M] \| [P, M, M] \| [P, M, M, M] \| [P, M, M, M, M]` (`P` = `{ primary: true }`, `M` = `{ primary?: false }`); `Section` caps at 3 |
| theme knob out of range                              | `radius?: number`, `density?: number` (`theme/index.ts:1578,1601`) | `radius?: -5 \| … \| 5`, `density?: -3 \| … \| 3`                                                                                                      |
| series group key retyped wrong (`'x'` vs `'x-'`)     | silent: refs to undeclared vars (`basalt-tokens.md`)               | `groupTokens` returns a branded `SeriesGroup`; `paletteOptions.groups` takes `SeriesGroup[]`, so no key is written twice                               |
| nav defined without the `Register` augmentation      | prose ("validates NOTHING")                                        | `defineNav`'s parameter becomes the string literal `'basalt: declare Register { router }'` while `RegisteredRouter` is `AnyRouter`                     |
| router-driven view transitions next to React's (§ 5) | —                                                                  | `createBasaltRouter` options carry `defaultViewTransition?: never`                                                                                     |
| a closed union switched non-exhaustively             | `assertNever` export + rule text                                   | `AgentPart`, `ThreadStatus`, `AgentError`, `BasaltEvent` are closed; a switch ends `default: return x satisfies never`                                 |
| hand-built theme, second resolver, sub-shell mounts  | exports + `hand-rolled-shell`                                      | unrepresentable: `cssVariablesResolver`, `baseTheme`, `AppSidebar`, `MobileNav`, `AppBreadcrumbs` are not exported                                     |
| provider below the router, overlays mounted twice    | `basalt/provider-above-router`, `BasaltOverlays`                   | unrepresentable: `BasaltProvider` mounts `RouterProvider` and every overlay (§ 2)                                                                      |

**Lint at `error` in 2.0** (`configs/oxlint-basalt.json`, the dogfood levels in `/.oxlintrc.json`
match them). These carry over unchanged: `no-raw-font-size`, `raw-size-literal`, `card-inset`,
`hand-rolled-shell` (raw `AppShell.*` only), `raw-scroll-container`, `hand-rolled-filter`,
`control-outside-home`, `bound-control-outside-home`, `control-size-literal`, `in-body-page-title`,
`responsive-twin`, `search-literal-link`, `use-search-from-literal`, `query-fn-unwrap`,
`ai-sdk-major`, `raw-breakpoint`. These change:

- `shadow-basalt-export` moves from warn to error.
- `forms-field-key` stays (`@mantine/form`, § 8).
- `agent-no-raw-usechat` widens to the `Chat` class (`@ai-sdk/react` `dist/index.d.ts:90`).

These are new:

- `router-view-transition` bans `viewTransition` on `Link`/`navigate` and
  `document.startViewTransition` in app code.
- `no-dev-helper` (repo-local) requires dev-only `import()`s to be gated by a literal
  `process.env.NODE_ENV` read.

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

One mechanism per surface; React owns every view transition. Every router navigation already runs
in `React.startTransition` (`@tanstack/react-router` 1.170.38 `Transitioner.js:20`), so
`<ViewTransition>` fires on it. `defaultViewTransition` calls `document.startViewTransition` itself
(`router-core` 1.171.32 `router.js:490-505`), and React interrupts a non-React transition, so the
router path is banned (§ 3). `<ViewTransition>` is stable in 19.3 and `<Activity>` since 19.2
(`@types/react` 19.3.0 `index.d.ts:2002-2101`); plain `setState` never activates it (react.dev).

| Surface                                    | Mechanism                                                                                                                                   | Why this one                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| route change                               | `<ViewTransition key={leafRouteId} enter="basalt-route-in" exit="basalt-route-out" update="none">` around the shell's main slot             | navigations are already transitions; keying by route id means search-only navigations (filters, tabs, pagination) do not animate |
| aside open/close                           | fold setter inside `startTransition` + `<ViewTransition>` on the aside region; body under `<Activity mode={folded ? 'hidden' : 'visible'}>` | `Activity` keeps scroll and inputs across folds without a remount                                                                |
| tab swap (`ViewTabs`)                      | none: instant swap                                                                                                                          | a same-route navigation; motion delays reading a data view (DESIGN-CORE restraint)                                               |
| chat thread swap (`ThreadFeedRow` expand)  | open/close inside `startTransition` + `<ViewTransition>`; the expanded body under `<Activity>`                                              | replaces 1.x's hand-rolled keep-mounted row and motion in `thread-detail-panel.tsx`                                              |
| modal, drawer, popover, menu               | Mantine `transitionProps` (theme default, Mantine `respectReducedMotion`)                                                                   | Mantine owns portal mount/unmount; a view transition would snapshot the page                                                     |
| list insert / reorder (feed rows, history) | `motion/react` `layout` + `AnimatePresence`                                                                                                 | streamed inserts are urgent `setState`, which never activates `<ViewTransition>`                                                 |
| theme toggle icon                          | CSS transition                                                                                                                              | motion was overkill (`theme/theme-toggle.tsx`)                                                                                   |

**`motion` survives only for list insert/reorder.** Of its three 1.41 import sites, `theme-toggle.tsx`
drops it, `thread-detail-panel.tsx` is deleted, and `thread-feed.tsx` keeps it. That makes `motion` a required peer of `./agent` (§ 1 peer rule), bumped to 14 (W3).

**Reduced motion**, one switch per mechanism, all driven by the OS setting:

- `styles.css` sets `animation: none` on `::view-transition-group(*)`, `-old(*)` and `-new(*)`
  under `prefers-reduced-motion: reduce`. React does not do this itself (react.dev).
- The provider mounts `<MotionConfig reducedMotion="user">` (motion 14 `ReducedMotionConfig`:
  `'always' | 'never' | 'user'`).
- The base theme sets Mantine's `respectReducedMotion: true`.

**Accepted:** Back/Forward through `popstate` does not animate, because React skips it (react.dev).

**Open:**

- How `<ViewTransition>` falls back when `document.startViewTransition` is missing: commit without
  animation is reported only by a third-party guide. W7 records the behaviour per browser in its
  evidence.

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
| `throttle`         | `useAgentThreadRuns({ throttle })` in ms batches part commits, with the semantics of `useChat`'s stable `throttle` (`@ai-sdk/react` `dist/index.d.ts:119`; `experimental_throttle` is deprecated). W8 sets the default from commit counts                                                                                                                                         |
| `ai` major         | `ai-sdk-major` + `doctor` `ai-major-parity` stay. argo's skew (dashboard `ai` 7.0.107, api 5.0.196) is decision D3 (§ 8)                                                                                                                                                                                                                                                          |
| streaming markdown | `<Markdown streaming contentTrust="untrusted">` for every model output. Settled blocks are memoized; the tail is repaired by remend (lazy). remend 1.4 emits `![alt](streamdown:incomplete-image)` (`remend` 1.4.0 `dist/index.d.ts:2,36`). `content/url-hardening.ts` treats it exactly like `streamdown:incomplete-link`: alt text, never an `<img src>`                        |
| code and diagrams  | shiki ^4.5 and beautiful-mermaid are lazy fence renderers. `CodeBlock`/`MermaidDiagram` stop being public, so a fence is the only entry                                                                                                                                                                                                                                           |
| peers              | `ai`, `remend`, `shiki`, `@shikijs/*` and `beautiful-mermaid` stay optional because they are reached only through `import()` (§ 1)                                                                                                                                                                                                                                                |

## 7. Observability

Basalt emits typed events through one seam, `BasaltProvider telemetry?: (event: BasaltEvent) => void`,
and has no OTel dependency. The consumer maps events to its own SDK. `onError` and
`BasaltErrorContext` are replaced by this seam.

```ts
type At = { start: number } // epoch ms (performance.timeOrigin + performance.now())
type Span = At & { duration: number } // ms
type Failure = { 'exception.type': string; 'basalt.error.kind': ErrorKind } // family or AgentError['kind']
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

- `service.name` follows the fleet's kebab `<project>-<component>` convention: `argo-dashboard` and
  `argo-api` today (argo `lib/hyperdx.ts`, `api/.env.local.tpl`), `basalt-playground` for W2, with
  `service.version` and `deployment.environment`. argo's browser SDK (`@hyperdx/browser` ^0.23.1)
  already traces `fetch` and propagates `traceparent` to `/api/`.
- W2 wires the playground with the OTel web tracer SDK, exporting OTLP/HTTP to the local
  collector's `:4318/v1/traces`. Package versions are pinned from `npm view` in W2's evidence.

**Open:**

- Does `@hyperdx/browser` register the global `@opentelemetry/api` tracer provider, so argo can use
  the adapter unchanged? W11 verifies; otherwise argo maps to `HyperDX.addAction`.
- `chat.turn` fires after the turn, so it cannot parent the chat `fetch` span. W8 joins on
  `basalt.chat.thread_id`, which argo's `hermes.stream-lifecycle` span must carry too.

## 8. Library adoption ledger

Charter point 3 decides each row: a library is adopted only on evidence. Evidence lives in
`docs/waves/evidence/w1/ledger.md`, and the spike is `spike/w1-ledger` @ `5f8e614`, never merged.
Versions are `npm view` as of 2026-10-13. Bytes are gzip from the isolated Vite lib build, with React
and Mantine external. LOC counts non-comment lines.

| Library                               | Latest                     | Stability                       | Verdict           | 2.0 surface                                                              | Evidence                                                                                                                                                                                                                                             | argo use case                                                          | Pin · upgrade test                                                                                                                                                                                                                            |
| ------------------------------------- | -------------------------- | ------------------------------- | ----------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Table (`@tanstack/react-table`)       | 9.3.1 (tested 9.2.8)       | stable major                    | **adopt** (W6)    | `./table`                                                                | spike on 9.2.8: parity 5/5; v9 22 668 B vs v8 15 699 B (+4 070 B once Store dedupes); `createTableHook` +655 B; LOC 156 (102 + the 54-line `tableFeatures` set) vs 108                                                                               | 8 tables via `createColumnHelper` (`agents-table.tsx:2` …)             | peer `9.2.8` exact · before any 9.3.x bump, re-run `table-parity`, `table-v9-nosortfns`, `table-v9.type-guard` and the byte build against the candidate                                                                                       |
| Store (`@tanstack/react-store`)       | 0.11.2 (1.0.0-alpha.0 out) | pre-1.0                         | **reject**        | none (stays transitive)                                                  | no spike: `./state`'s core is a 30-line listener set (`state/fields.ts:860-890`); Store is 2 899 B, already shipped by Router                                                                                                                        | zustand ×3 (`src/lib/store.ts:25`) stays consumer-owned                | — · one `react-store` copy in the pack-test tree (`bun pm ls`)                                                                                                                                                                                |
| Pacer (`@tanstack/react-pacer`)       | 0.24.1                     | pre-1.0                         | **reject**        | none (`@mantine/hooks` `useDebouncedCallback`)                           | spike: parity 3/3; Pacer +4 548 B (+1 497 B store-shared), Mantine −21 B; LOC Pacer 28 / incumbent 27 / Mantine 25                                                                                                                                   | hand-rolled debounces (`diagram-shared.tsx:7`, `workout-draft.ts:174`) | —                                                                                                                                                                                                                                             |
| DB (`@tanstack/react-db`)             | 0.5.8 (db 0.13.0)          | pre-1.0                         | **reject**        | none                                                                     | no spike: argo has no push or sync channel (`gym.ts:22`), so collections would wrap the same polling queries                                                                                                                                         | none; `ThreadsStore` (`threads-store.ts:1`) is `./agent` surface       | —                                                                                                                                                                                                                                             |
| Devtools (`@tanstack/react-devtools`) | 0.10.13 (devtools 0.15.0)  | pre-1.0                         | **reject**        | `BasaltDevDock` stays the one mount; `BasaltQueryDevtools` deleted (§ 1) | no spike: the shell renders with `solid-js` + `goober` and pulls `@neodrag/* 3.0.0-next.11`; the dock already hosts router, query and theme lab                                                                                                      | dock only (`__root.tsx:155`)                                           | —                                                                                                                                                                                                                                             |
| Hotkeys (`@tanstack/react-hotkeys`)   | 0.13.0 (core 0.11.0)       | pre-1.0                         | **adopt** (W3/W6) | `./commands`                                                             | incumbent-peer upgrade, a documented exception to the demo leg: the type spike shows 0.10 → 0.13 widens and the mirrored types fail on **both**; keyboard-dispatch test 2/2 on 0.10 and 0.13; lazy `import()` chunk 5 794 → 7 195 B, off first paint | `defineCommands` `Mod+B`, `Mod+/` (`src/lib/commands.tsx:86-112`)      | **required** peer `0.13.0` exact, type-level (the public `.d.ts` types `shortcut` as its `Hotkey`); runtime lazy via `import()` in `BasaltProvider` · before any bump, re-run `hotkeys.type-guard` + `hotkeys-dispatch` against the candidate |
| Form (`@tanstack/react-form`)         | 1.33.5 (2.0.0-alpha.2 out) | stable, next major in alpha     | **reject**        | `./forms` stays on `@mantine/form`                                       | no spike: `@mantine/form` binds Mantine inputs natively (`key` + `getInputProps`, guarded by `basalt/forms-field-key`); 2.0 alpha means 1.x churn                                                                                                    | 2 sites (`auth-gate.tsx:22`, `issues-section.tsx:311`)                 | —                                                                                                                                                                                                                                             |
| AI (`@tanstack/ai`)                   | 0.68.0 (ai-react 0.30.3)   | pre-1.0, 13 releases in 30 days | **reject**        | `./agent` stays on AI SDK 7                                              | no spike: speaks AG-UI (`@ag-ui/core` dep), while argo's server emits AI SDK v5 UI-message streams; D3 locks that server                                                                                                                             | Hermes chat (`hermes-transport.ts:1`, `aiSdkTransport`)                | — · `ai` stays the `./agent` peer                                                                                                                                                                                                             |

argo paths are relative to `apps/dashboard/` (argo @ `95d63d6`).

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
  - The peer is required at the type level. basalt's public `.d.ts` types `shortcut` as the
    peer's `Hotkey`, and § 1's peer rule makes such a peer required. The runtime stays lazy:
    `BasaltProvider` (§ 2) loads it with `import()`, off first paint (the provider-only budget is
    18 927 / 19 000 B), so the lazy-chunk bytes are the cost that matches the wiring.
  - Asymmetry: every 2.0 consumer installs Hotkeys, because `BasaltProvider` reaches it. Only
    `./table` consumers install Table.
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
  and Pacer all depend on `@tanstack/react-store ^0.11`. The cost is paid once if the tree dedupes.
  The spike lockfile held 0.11.0 and 0.11.2, which made a second `with-selector` chunk. basalt
  re-exports no Store symbol and does not surface `table.Subscribe`/`table.atoms`.
  `state/fields.ts` (1,147 lines) resolves URL ⊳ localStorage ⊳ fallback lanes, which Store does not
  do.
- **AI: D3 decides it.** Moving the client to TanStack AI means an AG-UI producer, which is the
  server migration D3 (`argo:docs/HERMES-CHAT-V2.md:52`) exists to avoid. W8 drops "TanStack AI per
  the ledger".

### Verdicts to apply mechanically (`⟂ § 8` lines in § 1 / § 2 / § 6)

| Where | Line resolves to                                                                                                                                                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| § 1   | `./table`: `BasaltDataTable`, `createColumnHelper` (basalt-owned, 1 generic). No `useTable`, `createTableHook`, `tableFeatures`, `flexRender` or row-model re-export                                                                        |
| § 1   | `./commands`: `HotkeyBinding` deleted; `toHotkeyBindings()` returns the peer's `UseHotkeyDefinition[]`                                                                                                                                      |
| § 1   | `BasaltQueryDevtools` deleted, folded into `BasaltDevDock` (§ 1 records it)                                                                                                                                                                 |
| § 1   | no direct `@tanstack/{store,react-store,pacer,react-pacer,db,react-db,devtools,react-devtools,react-form,ai,ai-react}` peer, dependency or symbol; the transitive `react-store` (Router, Table, Hotkeys) stays                              |
| § 2   | peers: `@tanstack/react-table 9.2.8` exact (required by `./table` only), `@tanstack/react-hotkeys 0.13.0` exact (**required** for every consumer per § 1's peer rule, type-level; runtime loaded lazily by `BasaltProvider` via `import()`) |
| § 2   | devtools mount = `BasaltDevDock` (router + query + theme lab), lazy and dev-only; no TanStack Devtools shell                                                                                                                                |
| § 6   | chat runtime = AI SDK 7 (`ai`, `@ai-sdk/react`); no TanStack AI adapter or transport                                                                                                                                                        |

**Open:**

1. Is Table v9's +4 070 B (+6 969 B if `react-store` does not dedupe) accepted as a W6 regression,
   or must W6 offset it elsewhere in `./table`?

## 9. Charts

<!-- owner: v2-charts -->

## 10. Open questions

<!-- lead: collected from every section -->
