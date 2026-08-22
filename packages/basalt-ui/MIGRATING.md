# Migrating basalt-ui

`CHANGELOG.md` ships in this package and lists every release. It cannot tell you what **broke**:
semantic-release writes one line per commit, and "make the mobile bar navigate, driven by one typed
nav definition" does not say `ChartHoverSync` was deleted. This file is that half — removed and
renamed exports per minor, with the replacement.

Reconstructed from `git diff` over the published export surface across `v1.0.0..v1.19.1`, then
cross-checked against the repo's `scripts/export-surface.json` snapshot. Verified 2026-08-22.

**No majors, by policy.** A rename or a removal ships as a plain `feat:` on the 1.x line, so a minor
bump can require code changes. Skipping several at once is the expensive case — read every section
between your version and the target.

> Reading the CHANGELOG: minors and majors are `#` (h1), patches are `##` (h2). Grepping for
> `## [1.` finds only the patches.

**Minors with no public API delta:** 1.1.0, 1.3.0, 1.4.0, 1.5.0, 1.6.0, 1.7.0, 1.8.0, 1.9.0,
1.10.0, 1.13.0, 1.14.0, 1.16.0, 1.18.0 — and every patch. Additive-only subpaths: `./tokens.css`
at 1.3.0, `./agent-chat` at 1.10.0.

---

## 1.19.0 — nav

| Removed / renamed                                                 | Replacement                                                                             | Note                                                                |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `NavLinkRenderer` (type)                                          | `defineNav` + `{...useNav(NAV)}` (`basalt-ui/router-tanstack`), or `SidebarItem.Anchor` | basalt now paints every nav pixel                                   |
| `BasaltShellProps.renderNavLink`, `AppSidebarProps.renderNavLink` | same                                                                                    |                                                                     |
| `BreadcrumbLinkRenderer` (type)                                   | `AppBreadcrumbs.parentAnchor`                                                           |                                                                     |
| `BasaltShellProps.renderBreadcrumbLink`                           | same                                                                                    |                                                                     |
| `BasaltShellProps.sidebarFooterExtra`                             | `mobileNav.moreExtra`                                                                   | its only host was the mobile drawer; it rendered nowhere on desktop |
| `AppSidebarProps.footerExtra`, `AppSidebarProps.onClose`          | —                                                                                       | the full-height mobile sidebar drawer is deleted                    |
| `MobileNavItem` (type)                                            | `MobileNavSlot`                                                                         |                                                                     |
| `MobileNavSection` (type)                                         | `MobileNavGroup`                                                                        |                                                                     |
| `MobileNavLinkRenderer` (type)                                    | `MobileNavModel`                                                                        |                                                                     |
| `SidebarSection.mobileTab`                                        | `SidebarSection.mobile`: `'tab' \| 'more' \| 'hidden'` (`true`/`false` still accepted)  |                                                                     |

A consumer with no router needs no migration — `href` + `onClick` still work.

**Expect new type errors, and read them.** `renderNavLink` took `to` as an opaque value, which is
why consumers reached for `to={target.to as never}`. `defineNav` types it, so a destination missing
a required `search` now fails to compile — in one repo that surfaced two nav links that had been
shipping without required params. Fix with a click-time thunk (`search: () => Schema.parse({})`),
never `search: true`.

## 1.17.0 — behaviour only, no export removed

| Changed                                              | Effect                                                       | Opt out                          |
| ---------------------------------------------------- | ------------------------------------------------------------ | -------------------------------- |
| `resolveAxisDomain` clamps before padding, not after | the axis top moves on any chart with an `autoMaxFloor`       | lower the floor, or pin `domain` |
| `ChartFrame` `role="img"` → `role="group"`           | `role="img"` pruned the keyboard slider out of the a11y tree | —                                |

## 1.15.0 — chart layer rebuilt

The largest delta in the 1.x line. No shims were shipped.

| Removed / renamed                                                                                                                                                    | Replacement                                                                                       | Note                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `ChartHoverSync`, `ChartHoverSyncProps`                                                                                                                              | `globalCursorStore` / `createCursorStore` / `useChartCursor` / `useCursorState` — **no provider** | `ChartCursorScope` now _isolates_ a subtree; it is the inverse of the old provider, not a rename |
| `HoverContext`, `HoverCtx`, `useHoverSync`, `DEFAULT_NO_OP_SET_HOVER`                                                                                                | `useChartCursor`, `useCursorState`, `CursorState`, `CursorStore`                                  | context → `useSyncExternalStore`                                                                 |
| `ResponsiveChart`, `ResponsiveChartProps`                                                                                                                            | `CartesianChart` / `CartesianChartProps` (+ `autoMargin`, `PlotContext`, `PlotRect`)              | now mandatory for every single-plot cartesian chart, enforced by `basalt/hand-rolled-plot`       |
| `ChartTooltip` (tip-based), `useChartTooltip`, `useTooltipStyles`                                                                                                    | `ChartTooltipFloat` + the `tooltip: CartesianTooltipConfig` prop                                  | portal / flip / clamp done once                                                                  |
| `BarsAxisConfig`                                                                                                                                                     | `AxisConfig` + `resolveAxisDomain`                                                                |                                                                                                  |
| `ZonedLineTooltipLabel`                                                                                                                                              | `tooltip` config on the kind                                                                      |                                                                                                  |
| `ZonedLine`/`MultiLine`: `yDomain`, `yAutoPad`, `yAutoMaxFloor`, `yAutoMinCeil`, `numTicksY`, `formatYTick`                                                          | one `y?: AxisConfig<T>`                                                                           | `y` is **optional** where `yDomain` was required                                                 |
| `ZonedLine`/`MultiLine`: `formatValue`, `tooltipLabel`, `renderExtraTooltipRows`                                                                                     | `tooltip?: CartesianTooltipConfig`                                                                | **not** `y` — these are tooltip concerns                                                         |
| `ZonedLine`/`MultiLine`: `numTicksX`                                                                                                                                 | `xTicks`                                                                                          | `xZones` added alongside                                                                         |
| `Bars`: `formatValue`, `hideBarTooltipRows`, `leftAxis`, `rightAxis`, `marginLeft`, `numTicksX`, `tooltipLabel`, `renderExtraTooltipRows`, `renderPrefixTooltipRows` | `y` / `y2` (`AxisConfig`), `tooltip`, `SeriesStyle.tooltip`, measured `autoMargin`                | passing `y2` is what makes a chart dual-axis; `chartMargin({ rightAxis })` is gone               |
| `StackedArea`: `formatValue`, `numTicksX`, `numTicksY`, `yAutoMaxFloor`, `yLabel`                                                                                    | `y`, `tooltip`, `xTicks`                                                                          |                                                                                                  |
| `Heatmap.width`                                                                                                                                                      | measures itself; takes `height` / `aspectRatio` / `fill`                                          |                                                                                                  |

## 1.12.0 — agent-chat, behaviour only

| Changed                                                                    | Effect                                                                                                                                              |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `streaming` no longer selects the image allowlist                          | **security-relevant.** Model output must now pass `contentTrust="untrusted"`; leaving it unset silently reopens prompt-injection image exfiltration |
| consumer `rehypePlugins` output is now sanitized, `clobberPrefix` is empty | a consumer injecting non-default elements must pass a matching `sanitizeSchema`                                                                     |

## 1.11.0 — agent parts

Semver-breaking in a minor; the commit body says so.

| Removed / renamed                                        | Replacement                                                                                           | Note                                                                                        |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `ToolCallPart` flat `{ type, toolName, input, output? }` | `ToolCallPart` as a 7-arm union discriminated on `state` (`input-streaming` … `output-error`)         | mirrors the AI SDK v7 lifecycle                                                             |
| the error field named `error`                            | `errorText`                                                                                           | the SDK union has no `error`                                                                |
| flattened approval fields                                | nested `approval: ToolApproval`, carried verbatim                                                     | flattening dropped `isAutomatic` / `signature`                                              |
| —                                                        | every `AgentPart` now extends `PartBase` with a **required `id`**; `withPartIds` mints them on drafts | a 1.10-shaped part rehydrated from localStorage no longer throws, but id-less parts collide |
| `ToolChip` threw `assertNever` on an unknown state       | now falls back instead of throwing                                                                    |                                                                                             |

## 1.0.0 — the Mantine pivot

| Removed / renamed                                                                             | Replacement                                                               | Note                                                                             |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `./css` subpath (877 lines: 307 custom props, 19 utilities, a reset, the Tailwind entrypoint) | `basalt-ui tokens:css` / `basalt-ui/tokens.css` — **but only from 1.3.0** | between 1.0.0 and 1.2.x the only CSS door was `styles.css` + `buildPaletteCss()` |
| `./starlight` subpath                                                                         | —                                                                         | no replacement                                                                   |
| the OKLCH foundation palette, ShadCN/Tremor/Starlight doctrine                                | the three-tier `--vx-*` system                                            | see `docs/FRAMEWORK-FREE.md` for the token-only route                            |

Names that have no 1.x equivalent: the `--chart-blue-1..8` sequential ramp (1.x is categorical
`--vx-fill-*` only), the default font stacks as a token (they live in `styles.css`), `purple` as a
text color, `black`, `blue-400`/`green-400`.

## 1.0.1 — CLI binary renamed

`basalt` → **`basalt-ui`**. Never `bunx basalt`.

---

## Lint and guard rules that tightened

Two independent mechanisms. `GuardKind` severities (`basalt-ui check-theme`) default to `error` and
are downgraded only by `GRACE_PERIOD_KINDS`, which is currently empty. `basalt/*` oxlint rule
severities live in `configs/oxlint.json` and have no grace-tracking at all.

| Rule                               | Landed           | Became `error`                     |
| ---------------------------------- | ---------------- | ---------------------------------- |
| `mantine-shade-index` (guard kind) | 1.7.0 as `warn`  | **1.11.0**                         |
| `basalt/raw-scroll-container`      | ≤1.2.0 as `off`  | `warn` 1.10.0 → **`error` 1.13.0** |
| `basalt/ai-sdk-major`              | 1.10.0 as `warn` | **1.13.0**                         |
| `basalt/agent-no-raw-usechat`      | 1.10.0 as `warn` | **1.13.0**                         |
| `basalt/agent-resume-guard`        | 1.10.0 as `warn` | **1.13.0**                         |
| `basalt/raw-size-literal`          | 1.7.0 as `warn`  | **still `warn` at 1.19.1**         |
| `basalt/hand-rolled-plot`          | 1.15.0 as `warn` | **still `warn` at 1.19.1**         |
| `basalt/chart-legend-literal`      | 1.15.0 as `warn` | **still `warn` at 1.19.1**         |

`card-with-border`, `inline-display`, `raw-html-layout`, `raw-form-control`, `raw-font-family` and
the other original guard kinds have been `error` since before 1.2.0 — they never had a grace minor.
Guard findings only gained a severity field at all in 1.4.0; before that every finding was fatal.

**Rule-id rename at 1.1.0:** `basalt/import-boundary` split into `basalt/visx-boundary`,
`basalt/visx-tooltip` and `basalt/token-layer-boundary` (the last is repo-local and deliberately not
in the shipped preset). A config still naming `import-boundary` after 1.1.0 disables nothing.

## Deprecated, not yet removed

The 32 camelCase `--vx-*` aliases deprecated in 1.5.0 are **still emitted at 1.19.1**.
`buildPaletteCss({ legacyAliases: false })` / `tokens:css --no-legacy-aliases` opts out now; a later
minor flips the default.

## Not verified

- Props declared inline on a component (`function X({ a }: { a: string })`) rather than on an
  exported type are outside the diff method used here. Spot checks on the shell and charts modules
  found none, but the negative is unproven.
- `AppBreadcrumbs.parentAnchor` as the replacement for `renderBreadcrumbLink` comes from the 1.19.0
  commit body, not from a diffable exported type — `AppBreadcrumbsProps` is not in the public export
  set at either tag.
