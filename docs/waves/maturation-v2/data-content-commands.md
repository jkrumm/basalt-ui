# v2 audit: data-content-commands

Scope: `src/table/**`, `src/content/**`, `src/agent/**` (runtime + chat UI), `src/commands/**`, `src/theme-lab/**`, `src/dev-dock.tsx`. Paths below are relative to `packages/basalt-ui/`. Audited at origin/master `ccd09d72`. PRs #285 and #286 are not re-reported.

## Adopt-or-delete verdict (consumer evidence)

Counted by import and by prop use in argo, linewatch, rb, basalt-ui-obsidian, rollhook and weatherorb `w37/basalt-2`.

| Surface                                                                                     | Real consumer outside playground                                     | Verdict                                                                    |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `./table` `BasaltDataTable`                                                                 | argo only (9 call sites). weatherorb: zero tables                    | Keep, but ~20 of ~45 props have no consumer (see 3)                        |
| `./commands` defineCommands, overlays.confirm, setColorScheme, toggleSidebar, ShortcutsHelp | argo (weatherorb: none)                                              | Keep                                                                       |
| `./commands` defineOverlays/`overlays.open`                                                 | argo, one overlay (ShortcutsHelp)                                    | Thin; see 7                                                                |
| `./commands` defineNotifications/emit/NotificationBell                                      | argo (7 kinds, all `{intent, passthrough toMessage}`, zero `action`) | Keep emit; the `action`/Inbox machinery has no consumer (8)                |
| `./content` Markdown, sanitize, fenceRenderers                                              | argo (chat), basalt-ui-obsidian                                      | Keep                                                                       |
| `./content` Callout, Prose, TableOfContents, GuideLink                                      | linewatch, rb                                                        | Keep                                                                       |
| `./content` ArticleLayout                                                                   | basalt-ui-obsidian only                                              | Keep; fix measure/i18n (19)                                                |
| `./agent` runtime + chat UI                                                                 | argo hermes-chat only                                                | Keep; the runtime is well tested, the seams around it leak (6, 15, 17, 18) |
| `theme-lab` `DeriveControls`                                                                | NONE: not mounted anywhere, not even the dock                        | Delete or mount (1)                                                        |
| `theme-lab` `ThemeLabControls`                                                              | dock only, mounted without its icon props                            | Fix or delete (1)                                                          |
| `dev-dock`                                                                                  | provider (dev only)                                                  | Keep, small fixes (26)                                                     |

## Findings (ranked)

### 1. [major, dead-code/wiring] The derive theme lab has no UI; the dock theme tool renders icon-less buttons

Evidence: `src/theme-lab/index.tsx:56` re-exports `DeriveControls`; grep for `<DeriveControls` across `src` and `apps` returns nothing. `src/dev-dock.tsx:56,118-122` mounts only `ThemeLabControls`. `src/provider/lab-theme.ts:132,176-180` subscribes (dev) to the derive store that only `DeriveControls` can write, so every dev app runs a `localStorage` listener and theme merge for a store nobody can edit. `ThemeLabControls` takes `copyIcon`, `resetIcon`, `onCopy` (`index.tsx:107-116`), but the provider mounts `<LazyDevDock tool onClose router/>` with no `themeLab` prop (`provider/index.tsx:532-537`), so "Copy JSON" and "Reset all" are empty `ActionIcon`s and `onCopy` never fires. MIGRATING.md:621-634 says these were "deleted, provider-internal". The 231-line `derive-controls.tsx`, `derive-state.ts` and its docs describe an "Apply" switch that is unreachable. `theme/index.ts:1545,1579,1602` and `boot.ts:6-17` still point at `basalt-ui/theme-lab`, a subpath that no longer exists.
Proposal: decide once. Either mount `DeriveControls` in the dock `theme` tool (it is the high-value half), or delete `derive-controls.tsx`, `derive-state.ts`, `lab-theme.ts`'s store subscription and `useLabTheme`'s dev branch (net about -600 lines incl. tests). Either way drop the `ThemeLabControls` icon/`onCopy` props (use inline SVG like `NotificationBell`) and rewrite the three stale `theme/index.ts` JSDoc references. Delete the public re-exports in `theme-lab/index.tsx` (`applyOverrides`, `readVar`, ...): no subpath exports them.
Breaking: no (dev-only). Consumers: none use it; argo no longer imports `applyOverrides`.

### 2. [major, api] `BasaltDataTable`'s pagination contract is a runtime throw, not a type

Evidence: `table/data-table.tsx:1300-1398` (`manualPaginationBreaches`, `enforceManualPaginationContract`) throws in dev and degrades in prod when `manualPagination` is set without `rowCount`/`pageCount`, without `manualSorting` or `enableSorting={false}`, or `enableGlobalFilter`/`facets` without `manualFiltering`, or without `enablePagination`. The JSDoc (`:678-715`) documents four of sixteen invalid combinations. `isLoading` + `query` both set is a second runtime warning (`:1537-1553`), `stickyHeaderOffset` beside `maxHeight`/`minWidth` a third, `stickyHeader` without `maxHeight` a fourth.
Proposal: replace the flat booleans with discriminated unions so the invalid state does not type-check:
`pagination?: false | { mode: 'client'; pageSize?; pageSizeOptions? } | { mode: 'server'; rowCount: number; onChange; initial? }`, `sorting?: false | { mode: 'client'|'server', initial?, onChange? }`, `filtering` likewise. Server mode then requires the sibling decisions at compile time. Drop `isLoading` and `skeletonRows` (superseded by `query`, per its own doc) and fold `stickyHeaderOffset` into a `sticky?: boolean | { offset }` that is only allowed without `maxHeight`. Delete `enforceManualPaginationContract`, `reportedBreaches`, `BREACH_REMEDY` (about 100 lines) and the `useValidateProps` block.
Breaking: yes (argo `walking-pad/session-history.tsx` uses `enablePagination manualPagination rowCount initialPagination onPaginationChange`; migrate to the union). Consumers: argo.

### 3. [major, dead-code/perf] About 20 `BasaltDataTable` props and a third of the implementation have no consumer

Evidence: argo (the only consumer) passes only `title subtitle data columns getRowId stickyHeader emptyState renderCard onRowActivate striped highlightOnHover withRowBorders verticalSpacing horizontalSpacing enableSorting={false} maxHeight enablePagination manualPagination rowCount initialPagination onPaginationChange rowActions`. Unused: `facets` (190 lines, `data-table.tsx:126-315`), `enableGlobalFilter` + debounced search, `enablePinning`/`initialColumnPinning` (`:1027-1077`), `enableRowSelection`/`rowSelection`/`bulkActions`/`BulkActionBar` (`:316-363,481`), `manualSorting`, `manualFiltering`, `initialSorting`/`onSortingChange`, `initialGlobalFilter`, `onColumnFiltersChange`, `isLoading`, `skeletonRows`, `query` (outside the narratives section), `actions`, `minWidth`, `stickyHeaderOffset`, `rowLabel`, `pageSizeOptions`, `pageCount`, `classNames`. `table-features.ts:64-78` registers sorting, filtering, global filter, pagination, selection, sizing, pinning and visibility features and all row models unconditionally, so the bundle pays for all of them. The file is 2158 lines, 845 of them comments (40%), one component with about 45 props and nine concerns (facets, selection, row actions, fold, containment, cards, pager, toolbar, skeleton).
Proposal: apply "adopt-or-delete" per CONSOLIDATION doctrine: keep `onRowActivate`, `renderCard`, `rowActions`, `query`, server pagination, fold, containment; delete facets, global filter, pinning, selection and bulk bar unless a named consumer exists in the brief (they can return behind a second subpath when one does). Then split the file: `use-data-table.ts` (state plus TanStack wiring), `table-body.tsx`, `pager.tsx`, `toolbar.tsx`. Drop `columnPinningFeature`/`rowSelectionFeature`/`columnFilteringFeature` from `basaltTableFeatures`. Net-negative by roughly 900 lines.
Breaking: yes for the deleted props; no consumer touches them. Consumers: argo (none of the deleted props), weatherorb (no tables).

### 4. [major, guard/security] `Markdown` defaults `contentTrust` to trusted for text that is usually model output, and nothing guards it

Evidence: `content/markdown.tsx:612` `contentTrust = 'trusted'`; image prefixes `['https://','/']` for trusted (`:586-587`). The rule "Render model or agent output with `contentTrust="untrusted"`" lives only in prose (`agent/rules/basalt-batteries.md`, Content section); the generated coverage header on that file says `not guarded: —`, yet no oxlint rule or guard kind exists for it (`configs/oxlint-basalt.json` has none). The chat renderer pins it correctly (`agent/chat/thread-message.tsx:102`) but argo re-renders text through its own `Markdown` (`hermes-chat/markdown-part.tsx`) and must remember the pin.
Proposal: make `contentTrust` required (no default) on `Markdown` — a two-word literal at each call site is cheaper than the silent default — or, if a default stays, add `basalt/markdown-content-trust` (flag `<Markdown streaming>` or any `<Markdown>` without `contentTrust` inside files that import `basalt-ui/agent`). Correct the coverage header to list it under "not guarded" until then.
Breaking: yes (compile error at four call sites: rb, obsidian, argo, linewatch via Callout? no, only Markdown callers). Consumers: argo, obsidian.

### 5. [major, guard/security] The sanitizer is an optional peer that fails open, and missing peers degrade silently in production

Evidence: `content/markdown.tsx:236-247` — a missing `rehype-sanitize` only `console.warn`s outside production, then `composeRehypePlugins` returns the consumer plugins unsanitized (`:316-318`). `:354-356` — a missing `react-markdown`/`remark-gfm` (or any chunk-load failure) is swallowed by `.catch(() => PlainTextFallback)` with no warning at all; `loadRemend` (`:407-413`) likewise. The 40-line doc on `withSingleClobberLayer` shows the layer is security-critical, yet its presence depends on `bun add`.
Proposal: make `rehype-sanitize` a non-optional peer of `./content` (it is 40 kB, shared with react-markdown's tree), or at minimum refuse to render when `rehypePlugins` is non-empty and the sanitizer is absent (throw a `[basalt]` named error via `missingLayer`). Add a dev warning for the other two swallowed imports so "my markdown renders as raw text" has a message.
Breaking: no for consumers who already install it (argo, obsidian do). Consumers: none affected.

### 6. [major, wiring] The chat UI cannot be handed a markdown configuration; argo overrides the whole `text` renderer to reach it

Evidence: `agent/chat/thread-message.tsx:101-105` hardcodes `<Markdown streaming contentTrust="untrusted" density="chat">`. argo `hermes-chat/markdown-part.tsx:11-18` documents the workaround ("ThreadTranscript ... expose no markdown-config prop ... overriding the `text` part renderer is the documented workaround") and re-implements the whole text part to pass `fenceRenderers`, `sanitizeSchema` and `components`, plus an `as MarkdownComponents` cast for custom tags (`:39`).
Proposal: add `markdown?: Pick<MarkdownProps, 'fenceRenderers' | 'sanitizeSchema' | 'components' | 'allowedLinkPrefixes' | 'allowedImagePrefixes'>` to `ThreadFeed` and `ThreadFeedRow` (forwarded through the existing context), and widen `MarkdownComponents` with an `{ [tag: string]: ComponentType<any> }` arm so a sanitize-admitted custom tag needs no cast. Keep `contentTrust="untrusted"` non-overridable here.
Breaking: no (additive); lets argo delete about 60 lines of renderer plumbing. Consumers: argo.

### 7. [major, bug/dead-code] `overlays` treats `@mantine/modals` as optional, but it is a required peer; `open` fails silently and renders outside React

Evidence: `commands/define-overlays.ts:35-48` lazy-imports `@mantine/modals` "because it is an OPTIONAL peer", yet `package.json` lists it as a non-optional peer and `provider/index.tsx:15` imports `ModalsProvider` statically. So the `modals === undefined` branches (`:244-253`) and the async `loadModals()` indirection are dead. `overlays.open` (`:352-365`) no-ops silently when the key, the provider or the peer is missing, while `confirm` on the same object throws a named error (inconsistent). `open` calls `spec.render(props)` eagerly inside a `.then` (`:359-363`), i.e. outside any React render, so a `render` that uses a hook throws "Invalid hook call"; the type `render: (props: P) => ReactNode` and the doc ("put its component in a `*-modal.tsx`") invite exactly that. `open` is also microtask-async for no reason.
Proposal: import `modals` statically, make `open`/`confirm` synchronous where possible, check `mountedModalsProviders` in `open` and throw the same `missingLayer` error, and change the registry entry to `component: ComponentType<P>` (rendered as an element, so hooks work). With only one real overlay in argo (ShortcutsHelp), also ask whether `defineOverlays` earns its slot at all: `overlays.confirm` is the real use (5 call sites). Candidate: delete `defineOverlays`/`overlays.open`/`OverlayMap`/`Overlay`/`defineOverlay` (about 170 lines) and keep `confirm`/`confirmDelete` as plain exports.
Breaking: yes if deleted/changed (argo `lib/commands.tsx` registers one overlay). Consumers: argo.

### 8. [major, dead-code] The notification `action`/Inbox machinery has no consumer; the history store duplicates `createPersistedState`

Evidence: argo `lib/notifications.ts` registers 7 kinds, every one `{ intent, toMessage: passthrough }`, no `action`. `define-notifications.ts:44-47,200-211` (`NotificationAction`, `resolveAction`), `store.ts` (`NotificationActionRef`, `needsAttention`, `inbox`, `dismiss`, `dismissAll`, `dismissedAt`) and `center.tsx` (Inbox/All `SegmentedControl`, dismiss vs remove semantics) exist for actionable notifications. `store.ts:99-146` hand-rolls a versioned `{ v, value }` envelope, `storage` listener and `useSyncExternalStore`, which `state/persisted` already provides (`theme-lab/derive-state.ts:36` uses it), without item validation (`readStorage` casts to `NotificationHistoryState`). `NotificationSpec` has no `title`, so argo passes `title` per call (its own header comment complains).
Proposal: until an action consumer exists, delete `action`, `resolveAction`, `needsAttention`/Inbox and the dismiss/remove split; the centre becomes one list with "Clear". Build the store on `createPersistedState` with a Standard Schema item validator. Add `title?: ReactNode | ((payload: P) => ReactNode)` to `NotificationSpec`. Consider whether a registry is justified at all: seven kinds that are all `{intent, message}` argue for `notify.success(msg)`/`notify.error(msg)`; keep the typed registry only if kinds carry payload shapes (none do in argo).
Breaking: yes (store key version bump). Consumers: argo (emit only).

### 9. [minor, naming] Three severity vocabularies in sibling APIs

Evidence: `Callout kind: 'info'|'good'|'warn'|'bad'` (`content/callout.tsx:21`), `NotificationIntent 'success'|'error'|'warning'|'info'` (`notifications/store.ts:40-52` with an explanatory comment admitting the mismatch with `Tone 'good'|'warn'|'bad'`), `ConfirmOptions.danger` boolean (`define-overlays.ts:190`). `INTENT_COLOR` is defined twice (`notify.tsx:24`, `center.tsx:52`) mapping to raw Mantine colour names `'green'|'red'|'yellow'|'blue'`.
Proposal: one `Tone` vocabulary (`info|good|warn|bad`) for `Callout`, `emit` intent, `NotificationBell` accents and `ConfirmOptions.tone: 'default'|'bad'`; one shared `toneColor` map reading the `--vx-status-*` tokens instead of Mantine hues.
Breaking: yes (argo uses `intent: 'success'|'error'|'warning'|'info'` 7 times; linewatch/rb use Callout kinds already in the Tone set). Consumers: argo.

### 10. [minor, dead-code/api] Singular `define*` helpers, a "1.0" placeholder and unexported public types

Evidence: `defineCommand` (`define-commands.ts:150`), `defineOverlay` (`define-overlays.ts:173`), `defineNotification` (`define-notifications.ts:129`) and `toShortcutList`/`ShortcutEntry` are not on `commands/index.ts` and have no importer outside tests; each carries a WARNING paragraph that it "does NOT register". `CommandRunContext` says "Minimal for 1.0; extend in 1.x" (`:27`), is the type of `Command.run`'s parameter, and is not exported; the same for `ConfirmOptions`, `Overlay`, `NotificationSpec`, `NotificationAction`, `NotificationBellProps`, `ShortcutsHelpProps`.
Proposal: delete the three singular helpers (use `satisfies Command`), delete or inline `CommandRunContext` (`close` is never read by a consumer), and export the public types that appear in signatures. A type that appears in a public signature but is not importable forces `Parameters<typeof ...>` gymnastics.
Breaking: no. Consumers: none.

### 11. [minor, wiring] Four module-global registries with no collision or ordering diagnostics

Evidence: `activeCommands` (`define-commands.ts:~120`), `activeOverlays` (`define-overlays.ts:135`), `activeRegistry` (`define-notifications.ts:151`), plus `colorSchemeSetterRef`/`sidebarToggleRef` (`shell-bridge.ts:36-37`); all are "last call wins". argo's header (`lib/commands.tsx:1-12`) documents the manual contract ("imported eagerly before BasaltProvider mounts") and an explicit `: void` annotation to dodge a type cycle between `commands` and `overlays` slots. `emit(kind)` with a kind not in the runtime registry silently shows the kind string as the message (`define-notifications.ts:~189`); `emit` with an un-annotated spec accepts `payload?: unknown` so a wrong payload type-checks (`EmitArgs`).
Proposal: dev-warn when a `defineX` is called twice with different maps (HMR aside, that is a bug) and when `emit`/`overlays.open`/`setColorScheme` runs before the registry exists, instead of falling through to the kind string. Longer term, one `defineBasalt({ commands, overlays, notifications })` call keyed on one `BasaltRegister` augmentation removes the three module stashes and the cycle workaround.
Breaking: no for the warnings. Consumers: argo.

### 12. [minor, a11y/bug] `NotificationBell` hover-open fights its own click toggle; items are mouse-only

Evidence: `notifications/bell.tsx:61-66,89-94`: `onMouseEnter` opens after 150 ms and `onClick={toggle}` flips, so hover-then-click closes the popover the user meant to open; on touch, the emulated mouseenter plus click does the same. `center.tsx:99-105`: an unread item is a `Box onClick` with no role, tabindex or key handler, so a keyboard user can only "Mark all read". The bell hardcodes `color-mix(in srgb, var(--vx-ink) 8%, transparent)` and `var(--basalt-font-mono)` instead of tokens. `center.tsx:39-47` re-implements relative time while `format/date.ts:68` exports `relativeTime` and `agent/chat/relative-time.ts` is a third copy.
Proposal: click-only popover (drop the hover timers), make `markRead` fire on item focus/activation via a real button, and use `format`'s `relativeTime` (delete the two copies). Replace the raw colour string with `VX.*`.
Breaking: no. Consumers: argo (one bell).

### 13. [minor, dx] `ShortcutsHelp` needs hand wiring and renders a frozen snapshot

Evidence: argo `lib/commands.tsx:25-62` registers an overlay, a command and a `Mod+/` shortcut, then augments two register slots, just to show `<ShortcutsHelp/>`. `ShortcutsHelp.tsx:77` calls `toShortcutList()` in render (non-reactive; `when()` read at render time, `projectors.ts` doc admits late-registered commands never appear). Index `key={i}` on `Kbd`, raw `c="var(--vx-faint)"` and `ff="monospace"` next to an imported `VX`.
Proposal: ship a built-in `help:shortcuts` Spotlight entry and `Mod+/` binding that opens `ShortcutsHelp` in a `modals.open` (opt-out), so the typical app wires nothing. Subscribe to the registry (a version counter) for reactivity.
Breaking: no. Consumers: argo can delete its overlay and one command.

### 14. [minor, docs] Comment mass and changelog narrative live in source

Evidence: comment-line share: `data-table.tsx` 845/2158, `thread-message.tsx` 458/1216, `use-agent-thread-runs.ts` 383/968, `composer.tsx` 274/648, `virtualize.ts` 132/180 (a 60-line module header explaining virtual-core internals), `define-overlays.ts` 223/392. Many are release narrative: "`false` by default since this minor (it was `true`)" (`data-table.tsx:~940`), "(Before 1.25.0 this tracked `data.length` alone...)" (`:~575`), "The sliders used to move the CSS-var surfaces..." (`derive-controls.tsx`), "(it did NOT before...)" (`theme-lab/index.tsx:9-12`).
Proposal: JSDoc states the current contract only; history goes to MIGRATING/CHANGELOG, design rationale of non-obvious mechanisms (virtual-core clobber, hast-util-sanitize traps) to MAINTAINING.md with a one-line `@see`. `check-agent-doc-drift` could cap JSDoc lines per exported symbol.
Breaking: no. Consumers: none.

### 15. [major, api] `Composer` and `ThreadFeedRow` encode run state as parallel booleans/props

Evidence: `agent/chat/composer.tsx:304-313`: `streaming`, `allowSubmitWhileStreaming`, `onStop`, `disabled` (four props, `showStop`/`inputDisabled` derived inside; `onStop` without `streaming` is inert, the defect `thread-feed-row.tsx:248-252` documents it hit once). `thread-feed-row.tsx`: `liveParts` + `liveStatus` are two props that must agree (`:~101-103`); `onSend` + `onStop` + `composerProps` (a fourth escape hatch with an `Omit` of three keys).
Proposal: `Composer status: 'idle'|'submitted'|'streaming'|'disabled'` with `onStop` required only when stoppable (union); `ThreadFeedRow live?: { status: 'submitted'|'streaming'|'error'; parts }`. Drop `allowSubmitWhileStreaming` unless argo uses it (grep: no).
Breaking: yes. Consumers: argo `hermes-row.tsx`, `chat-page.tsx`.

### 16. [minor, wiring] Consumers re-derive liveness that the runtime already owns

Evidence: argo `hermes-chat/run-liveness.ts:7-9` `isLiveRun(run)` re-implements `isLive`/`isLiveStatus` which exist in `agent/run-records.ts` and `agent/thread.ts:127` but are not exported (`thread.ts:116` says so; `StreamStatus` and `LiveRunStatus` too). The shipped rule (`basalt-batteries.md`, Agent) tells every consumer to hand-write `runs.get(id)?.status === 'submitted' || ... 'streaming'`.
Proposal: export `isLiveRun(run: ThreadRunState | undefined)` and `StreamStatus`; change the rule to point at it. Also have `useAgentThreadRuns` return `liveIds: ReadonlySet<string>` since argo derives `settledRunIds` from diffs of exactly that.
Breaking: no. Consumers: argo.

### 17. [major, layering] "agent never imports content" is stated as lint-enforced, but the chat UI imports `Markdown`

Evidence: `content/markdown.tsx:3-6` says `agent/**` "deliberately ships no renderer of its own, since `agent/** -> content` is lint-blocked by design"; `agent/chat/thread-message.tsx:48-49` imports `../../content/markdown` and `../../content/copy-action`. The `./agent` surface (`surfaces.ts`, optionalPeers) omits `react-markdown`, `remark-gfm`, `rehype-sanitize`, `remend`, `shiki` that importing the chat UI pulls in transitively. `agent/index.ts:2-6` claims "importing this module does not resolve" the optional peers, but `thread-feed.tsx:22` imports `motion/react` eagerly (surfaces.ts admits "motion is subpath-required").
Proposal: pick one truth. Recommend: chat UI may import content (it does, and should); delete the false claims in `markdown.tsx`, list content's peers and `motion` under `./agent` `optionalPeers`, and make `motion` a lazy import or a real peer note in the doctor.
Breaking: no. Consumers: argo (installs everything).

### 18. [minor, wiring] `ToolChip` renders raw tool input/output; argo wraps it for redaction

Evidence: argo `hermes-chat/secret-redaction.ts` (header: "basalt's own frozen ToolChip renders a tool call's real input/output/errorText verbatim") and `thread-renderers.tsx` run every tool part through `redactPartSecrets` before `<ToolChip/>`. `tool-chip.tsx` has no `formatValue`/`redact` seam.
Proposal: add `renderValue?: (value: unknown, kind: 'input'|'output'|'error') => ReactNode` (or `redact?: (value: unknown) => unknown`) to `ToolChip` and the `tool` part renderer so redaction is part of the contract, not a wrapper. Add a dev note in the Agent rule that tool payloads are shown verbatim.
Breaking: no. Consumers: argo.

### 19. [minor, api] `ArticleLayout` hard-codes English and a CSS-variable-only measure

Evidence: `content/article-layout.tsx:~118-218`: "Previous", "Next", "On this page", "min read" are literals, while a `locale` prop exists only for the date; `GuideDrawer` has "Open full page", `GuideLink` "Guide". basalt-ui-obsidian `render/note-view.tsx:14-28` sets `--vx-prose-measure: 68ch` through an inline style hack because there is no `measure` prop (the file's comment: 72ch measured at 82-86 characters/line). `renderLink` is hand-passed in every consumer with a router, with a duplicated `defaultRenderLink` in `guide.tsx:23` and `article-layout.tsx`. Its only consumer needed a hand-rolled duplicate-H1 suppression (test names in obsidian `render-note-view.test.tsx`).
Proposal: `labels?: Partial<{previous,next,onThisPage,minRead(n)}>` replacing `locale`-only i18n; `measure?: \`${number}ch\``on`ArticleLayout`/`Prose`; resolve links through the router context (`router-tanstack`'s `Link`) by default when `BasaltProvider`has a router;`dedupeTitle?: boolean`to drop a leading body`h1`equal to`meta.title`. Share one `defaultRenderLink`.
Breaking: no (additive); `locale`can be folded into`labels`/`Intl`. Consumers: obsidian.

### 20. [minor, api/docs] `TableOfContents.levels`, `GuideDrawer` content and missing exports

Evidence: `content/toc.tsx:51` `levels?: readonly [number, number]` reads like a range but `collectHeadings` joins the two values into `h2[id],h3[id]`, so `[2,4]` collects h2 and h4 only; any number is accepted. The doc example imports `headingSlug` from `basalt-ui/content` (`toc.tsx:30`), which `content/index.ts` does not export (nor `SlugTracker`); `GuideDrawer` is documented as public (`guide.tsx:1`) and not exported. `GuideDrawerProps`/`GuideLinkProps` document `children` and `markdown` as "mutually exclusive (markdown wins if both given)" — a representable invalid state.
Proposal: `levels?: ReadonlyArray<2|3|4|5|6>` (or `{ min, max }`); `body: { markdown: string } | { children: ReactNode }` as a union; export `headingSlug`, or fix the example; either export or drop `GuideDrawer`.
Breaking: yes (mild). Consumers: rb (TableOfContents), linewatch (GuideLink children form).

### 21. [minor, naming] Content components diverge from the `BasaltProps` convention used elsewhere

Evidence: `Prose`, `Markdown`, `TableOfContents`, `ArticleLayout` declare `readonly` fields and their own `className`/`style` (`prose.tsx:22-30`, `markdown.tsx:97-170`, `toc.tsx:45-56`, `article-layout.tsx:49-70`), while `Callout`, `GuideLink`, `ShortcutsHelp`, `NotificationBell` use `BasaltProps`. `TableOfContents` takes no `style`. Props in `agent/chat` use `x?: T | undefined` (exactOptional style) while commands use `x?: T`.
Proposal: one props idiom (`BasaltProps &`, no `readonly` on props, a lint rule or `satisfies` helper to hold it). Also lets the repeated `...(x !== undefined && { x })` forwarding (`markdown.tsx` BlockProps/BodyProps/BridgeProps/`SettledBody`, five copies of the same six props) collapse into one `pipeline` object memoised once.
Breaking: no. Consumers: none.

### 22. [minor, docs] Stale references in docs and comments

Evidence: `query-branch.ts:2` ("`./data`'s two containers"; `BasaltVirtualList` and `./data` are gone); `markdown.tsx:9,353` and `highlighter.ts:2` cite `agent/streaming-markdown.tsx` (does not exist); `markdown.tsx:5` cites `agent/rules/basalt-content.md` (shipped rules are batteries, charts, controls, mantine, state, tokens); `thread-message.tsx:6-22` says it lives in `agent-chat/` and shows `import { ThreadTranscript } from 'basalt-ui'` (not exported from the root or `./agent`); argo `threads-store.ts` header cites a `createThreadsStore` reference implementation and `agent/adapter.ts`, neither of which exists in `src/agent` (`thread.ts` exports types and `isLiveStatus` only), so consumers must write a `ThreadsStore` from scratch; `define-notifications.ts:136-151` has the `defineNotifications` JSDoc attached to the `activeRegistry` variable and the function undocumented; `boot.ts:6-9` says every consumer's `main.tsx` calls `applyOverrides(loadOverrides())` "see README".
Proposal: sweep and fix; extend `check-agent-doc-drift.ts` to flag references to non-existent `src/` paths and to subpaths missing from `package.json` exports (it demonstrably does not catch `basalt-ui/theme-lab` or `./data`). Ship a reference `ThreadsStore` (an in-memory or `createPersistedState` one), since argo's 400-line `threads-store.ts` exists only because none ships.
Breaking: no. Consumers: argo benefits.

### 23. [major, guard] No guard stops a consumer bypassing the typed seams in this area

Evidence: `configs/oxlint-basalt.json` has no rule for importing `@mantine/notifications`, `@mantine/modals` (`modals.open`, `openConfirmModal`), or `@mantine/spotlight` directly (bypassing `emit`/`overlays`/`defineCommands`), for a raw Mantine `<Table>` (the `raw-scroll-container` rule only notes `<Table>` in a message), for `react-markdown` imported directly (bypasses the sanitizer and URL hardening), or for `dangerouslySetInnerHTML`. argo's `vega-lite-diagram.tsx:168-172` ships exactly that, justified by a comment copied from `mermaid.tsx:124`. `surfaces.ts` lists `pluginRules: []` for `./commands`, `./table` and `./content`.
Proposal: add `basalt/no-direct-mantine-notifications-modals` (allow inside `basalt-ui` only), `basalt/no-raw-markdown-renderer` (`react-markdown`, `dangerouslySetInnerHTML` of non-basalt strings), and `basalt/raw-table` (Mantine `Table` outside `BasaltDataTable`, with `theme-allow` waiver). Export a `SafeSvg` (the mermaid sanitiser plus `dangerouslySetInnerHTML` in one place) so vega-lite-style fence renderers do not each re-justify raw HTML.
Breaking: no (new `error` rules; would flag nothing in argo except the vega diagram). Consumers: argo.

### 24. [minor, perf/ssr] Module-level side effects at import time

Evidence: `notifications/store.ts:132` `let state = readStorage()` and `window.addEventListener('storage', ...)` (`:141`) run at import of `./commands`, i.e. for every app that imports `emit`, even if no bell is mounted; `store.ts` is read in module scope so a bfcache/extension race reads stale data. `shell-bridge.ts` and the registries are likewise import-time singletons. The notify dedup map (`notify.tsx:49`) is also global with no test reset.
Proposal: lazy-init the store on first `subscribe`/`add`; export a `__resetForTests` or tie the state to a `createStore()` instance the provider owns.
Breaking: no. Consumers: none.

### 25. [minor, test] Tests assert implementation shape in places and the biggest file has duplicated suites

Evidence: `table/data-table.test.tsx` (1324 lines) and `data-table-containment.test.tsx` (726) test the dev-throw wording of the pagination contract (the thing finding 2 deletes), and `theme-lab/theme-lab.test.ts:25-32` asserts `buildPaletteCss` contains each tunable name — a contract on strings, not on the tool; no test mounts the dock theme tool with the provider (which is how finding 1 shipped). `content/markdown.test.tsx` documents (`markdown.tsx:140-148`) that a raw `<script>` test would pass without the sanitizer.
Proposal: add one provider-level test per dev tool (dock opens `theme`, buttons have accessible names), move contract tests to the type level (`.type-guard.test.ts`) when finding 2 lands, and keep sanitize tests at the plugin-injected-node level only.
Breaking: no. Consumers: none.

### 26. [minor, a11y/dx] Dev dock lacks semantics and uses magic numbers

Evidence: `dev-dock.tsx:94-110` a fixed `42vh` bottom panel, `zIndex: 400`, raw `'var(--mantine-color-body)'`/`var(--vx-shadow-overlay)` strings, no landmark/`role="region"` or label, no resize, no Escape-to-close, and it overlays page content with no inset. `Object.assign(Lazy..., { displayName })` is repeated three times. The theme-lab Slider/ColorInput groups use `w={300}` inside a full-width dock (`index.tsx:~125`).
Proposal: `role="region" aria-label`, Escape closes, a z-index token, `VX` references, one `lazyNamed()` helper. Optionally reserve `padding-bottom` on `<body>` while open.
Breaking: no. Consumers: none.
