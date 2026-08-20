# Basalt UI — Status

> **Single source of truth for current state.** As of **2026-08-20**. The other docs in `docs/`
> are historical process artifacts or superseded scope ledgers — this file is what's true now.

**Branch:** `master` is the released 1.x line; `feat/native-mobile-nav` carries the nav rewrite
below.
**Version:** `1.18.0` on `master`, **published** to npm (Trusted Publisher OIDC) — the chart-layer
rebuild (`docs/CHARTS-SPEC.md`) shipped in 1.15.0, the first consumer-gap batch in 1.16.0, round
two in 1.17.0 and round three in 1.18.0. The nav rewrite below is the next candidate.

## TL;DR

The 1.0 Mantine pivot shipped and the 1.x line is live on npm. The theme-config surface is closed:
all four of `createBasaltTheme`'s dimensions (`derive`, `fonts`, `radius`, `density`) are released as
of 1.2.0. Current work is the nav rewrite below — the mobile bar navigates instead of raising a
drawer, and one `defineNav` definition drives both the sidebar and the bar. Framework-free token
consumption (making the `--vx-*` system usable from a static site with no React, no Mantine and no
bundler) is still open. The June-era roadmap/handover docs still phrase built work as "remaining";
that language is historical, see the banner on each.

## Adoption gap — closed in 1.7.0 (2026-08-02)

Prompted by the first outside-of-argo consumer (LineWatch). Its dashboard had grown seven
hand-rolled `<Card withBorder radius="md" padding="lg">` across six files, next to `StatCard`s —
two card idioms, visibly different borders/shadows/heights on one screen. Running `check-theme`
there for the first time reported all of it in one pass. Three separate causes, all now addressed:

1. **basalt was installed as a component library and nothing else.** No `.oxlintrc.json`, no
   `.basalt/manifest.json`, no lint script, no CI — `basalt-ui init` had never been run, so every
   enforcement mechanism the package ships was inert and nothing said so. `basaltViteConfig` now
   prints a one-time notice when no `.basalt/manifest.json` is found at or above the cwd. It is the
   only basalt seam that runs on every dev start and every build, which makes it the only place that
   can catch this while it is still cheap. Notice, never an error (`enforcementNotice: false` opts
   out) — declining the toolchain is a legitimate choice; failing a build over a missing lint preset
   would be a worse bug than the one it prevents.
2. **Two real holes in the guard.** `size="10px"` passed because `basalt/no-raw-font-size` only
   ever tested for a NUMERIC literal → new `basalt/raw-size-literal` oxlint rule (CSS-length strings
   on `size`/`fz`/`fontSize`; `warn` in the shipped preset for its grace minor). `c="yellow.7"`
   passed because no kind covered a shade-pinned Mantine color — `off-identity-accent` polices which
   hue, not which index → new `mantine-shade-index` guard kind (`warn` from 1.7.0, **promoted to
   `error` in 1.11.0**). Its grace ran across four minors rather than the doctrinal one — deferred by
   1.8.0 (shipped the same day as 1.7.0), by 1.9.0 (which carried the chart-layer batch the same
   consumer was waiting on), and then 1.10.0 shipped without the promotion at all. Promoted only
   after verifying the consumer: argo's `check-theme` reports zero violations of any kind, so nothing
   that was passing now fails. `GRACE_PERIOD_KINDS` is empty again.
3. **An expressiveness failure, which no linter could have caught.** LineWatch wrote a 35-line
   `ThresholdRail` wrapper positioning a bar over a `StatCard`'s edge, with a docblock explaining
   that `StatCard.value` is typed `string` so the number could not be tinted, and that hand-rolling a
   card would fork the one component every stat was drawn with. That is a well-behaved consumer
   hitting a wall and inventing visual vocabulary anyway. `StatCard` now takes `tone="warn" | "bad"`
   and draws the rail itself (plus a `VisuallyHidden` label — colour alone never carries a verdict).
   The lesson generalizes: a composite that cannot express a common case gets routed around by
   compliant-looking code the guard has no way to recognize, so the gap is invisible until someone
   looks at a screenshot.

   **Follow-up in 1.8.0 — the tone set is three-valued.** The same consumer hit the same wall one
   step further in: a Downtime card where **zero is the earned state**, which the two-tone set could
   only render as red (wrong) or untinted (indistinguishable from "nothing measured"). `tone` now
   takes `"good"` as well. `undefined` is unchanged and still load-bearing — it means "fine, or
   nothing measured" and stays untinted, so `good` is a positive assertion a consumer opts into, not
   a default a card without a reading can fall into. Second data point for the same lesson: the gap
   a shipped composite leaves is found by the consumer, one case at a time, not by the framework.

## Chart-layer rebuild — one mandatory cartesian primitive (2026-08-18)

Design + rationale: **`docs/CHARTS-SPEC.md`** (ground truth). Prompted by a field report from the
one consumer building charts daily: tooltips, legends and responsive sizing all needed pushing
around per chart, and nothing felt strictly wired. Diagnosis was not visx — it was that basalt's own
layer had two tiers with no rung between them, so anything that wasn't a shipped kind fell to ~130
lines of hand-rolled margin math, scales, axes, overlay and tooltip assembly, and every cartesian
kind repeated that same preamble internally.

TanStack Charts (v0.14.0, released the same month) was evaluated as a replacement and **rejected**:
it is pre-alpha, its own README says not production-ready, and there is no 1.0 date. Its
architecture is the better one — grammar of graphics, framework-neutral scene, renderer-neutral
contracts — and the four ideas worth stealing were stolen instead: measured guides, a cursor
controller separate from crosshair presentation, one responsive path, and tooltips/legends/axes as
first-class parts of the chart definition rather than per-call-site assembly. Revisit the library
itself if it reaches 1.0.

What shipped:

1. **`CartesianChart`** — the missing rung. Owns measured margins, both y scales + their domains,
   the x scale and tick thinning, grid, zones, axes, the shared cursor, the crosshair and its
   per-series dots, the hover/keyboard overlay, and the derived tooltip. A kind (or a bespoke
   chart) supplies `series` + a child that draws ONLY marks. Every single-plot cartesian kind was
   rewritten onto it, and the two bespoke playground charts collapsed with it (the dual-axis one
   from ~145 lines to 29). `DualPanel` (two panes, one x scale) and the non-cartesian
   `Heatmap`/`Donut` stay hand-composed on `ChartFrame` + `useChartCursor` + `autoMargin` — they
   share the machinery, not the single-plot assembly.
2. **Margins are measured, not tokenized.** `autoMargin` sizes each gutter from the formatted tick
   labels that will actually be painted (`measureText`, offscreen canvas, memoized, SSR fallback).
   `VX.margin` becomes a FLOOR — no chart gets tighter than before, and a wide label widens its own
   gutter instead of clipping. `chartMargin({ rightAxis })` is no longer needed: passing `y2` is
   what makes a chart dual-axis, and the right gutter follows from measurement.
3. **The cursor is shared by default.** It moved from a React context that had to be mounted to a
   module-level external store read through `useSyncExternalStore`. `ChartHoverSync` is deleted;
   `ChartCursorScope` now ISOLATES a subtree instead. Resolution is domain-aware (exact match, else
   nearest parsed date/number within one domain step), which retires the `resolveKey` escape hatch
   and the folded-domain desync recorded in the chart-layer batch below.
4. **Legends toggle.** Clicking an entry hides that series from the plot, the tooltip and the auto
   domain together (on by default at ≥2 entries; `legend={{ toggle: false }}` opts out).
5. **Tooltip and keyboard.** `ChartTooltipFloat` does portal + flip + viewport clamp +
   measure-before-show once for every chart; pointer moves are rAF-coalesced. The hover overlay is
   focusable and scrubs on ←/→, Escape clears.

**The contract is mechanically enforced, not advisory.** Two oxlint plugin rules ship with it:
`basalt/hand-rolled-plot` fails a file that renders a chart-assembly primitive (`AxisLeftNumeric`/
`AxisRightNumeric`/`AxisBottomDate`/`HoverOverlay`/`Crosshair`) without composing `CartesianChart`
— a `theme-allow` comment on the first site is how a genuinely non-single-plot shape declares
itself, and `DualPanel` carries the only one in the repo; `basalt/chart-legend-literal` fails a
hand-written `ChartLegend items={[…]}` array, since the legend must derive from the same `series`
the chart draws or it goes stale naming a series nobody plots. Both are `error` repo-local and
`warn` in the shipped consumer preset for one minor per the grace-minor doctrine — promoting them
to `error` is a one-line change in the next minor. Everything else the rebuild removed is enforced
harder than lint: the old APIs are gone, so the old patterns do not resolve.

Deleted outright (greenfield, one lockstep consumer, no shims): `ResponsiveChart`, `ChartHoverSync`,
`HoverContext`, `useHoverSync`, `useChartTooltip`, the tip-based `ChartTooltip` + `useTooltipStyles`,
`BarsAxisConfig`, `ZonedLineTooltipLabel`, and the whole `yDomain`/`yAutoMaxFloor`/`yAutoMinCeil`/
`yAutoPad`/`numTicksY`/`formatYTick` prop family on every kind (now one `AxisConfig` object per
axis). `Heatmap` measures itself via `ChartFrame` and takes `height`/`aspectRatio`/`fill` like every
other kind. Ships as a plain `feat:` on the 1.x line — majors stay banned.

Two regressions were caught during migration and fixed in the primitive rather than worked around
per kind: a stacked band's crosshair dot sat at its raw value instead of the cumulative band top
(now the `cursorValue` seam), and an `AxisConfig.domain` function could not see which series the
legend had hidden, so a stacked domain never shrank (the function now receives `visible`).

## Native mobile nav + one typed nav definition — `feat/native-mobile-nav` (2026-08-20)

Two changes that turned out to be one change. The mobile bottom bar stopped being a menu, and the
consumer's navigation stopped being five restatements of the same destination.

### The bar navigates

A slot is now a DESTINATION. Tapping it navigates through the consumer's router `Link` with no
overlay, no animation and nothing to dismiss — previously every tab raised a full-viewport
`Drawer`, so reaching a page took two taps and opened one overlay. The full-height mobile
`AppShell.Navbar` drawer is deleted outright (`collapsed: { mobile: true }`, permanently) and
everything it held — account, settings, theme switcher, the rest of the nav — moved into the
trailing More slot as flat rows.

Overlays now exist only where a slot genuinely holds more than one destination, and the surface is
INFERRED rather than configured: 0 rows drops the slot, 1 collapses to a plain link, ≤ 6 is a
`Menu` that pops out of the tab, more is a bottom sheet. Six is arithmetic (6 × 44px + 8px against
415px of headroom on the smallest supported viewport), which is why the menu runs `flip: false` and
can never render below the fold. Move a destination in or out of More and the surface changes
itself.

`projectMobileNav` (`src/shell/mobile-nav-model.ts`) is the pure projection that decides all of it —
no React, no Mantine, no DOM — so the whole interaction law is unit-testable with no renderer.
`MobileNav` only paints the result. Three behaviours that were bugs and are now rules:

- A **disabled** destination used to be dropped silently and shipped as a live row. It now appears
  in the overflow rendered disabled, and can never be a link slot.
- A slot's `active` now includes **nested children**, so a tab no longer goes dark when a child
  route is current. Consequence to know: re-tapping a parent tab while a child route is active
  scrolls to top (the Material/iOS pop-to-root idiom) rather than navigating to the parent.
- Every `:hover` moved behind `@media (hover: hover)`; ungated, the last-tapped row stayed lit.

Safe-area handling is the part most likely to be "fixed" back into a bug: Mantine's own
`AppShell.footer` rule already grows the footer box by `env(safe-area-inset-bottom)` AND pads its
content, so adding either to `.bar` double-counts. The one real gap is `--app-shell-footer-offset`,
set to the raw height, which leaves `AppShell.Main` short by exactly one inset — closed by
`.mainSafeArea`.

Two new density-tracked tokens (`mobileNavBarHeight` 56, `mobileNavRowHeight` 44) carry hard floors
at 48/44 in `deriveSpacing`, because the `1 + 0.1 * level` law would take them to 39/31 at level −3
and silently break the minimum touch target.

### One typed nav definition

`defineNav` / `navGroup` / `navTarget` / `flattenNav` / `useNav` (`basalt-ui/router-tanstack`)
replace the whole hand-wired nav layer. One `defineNav({ groups: [...] })` in a leaf module
produces the desktop sidebar AND the mobile bar; `useNav(NAV, { badges })` resolves active state
through `useMatchRoute` and builds each destination's anchor, returning `{ sections, mobileNav }`
to spread onto `BasaltShell`. In the reference consumer that is ~237 nav lines in `__root.tsx`
collapsing to 4 (plus a 95-line leaf), a destination stated once instead of five times, and zero
`as never` casts, zero render callbacks and zero hand-written `useMatchRoute` calls.

Route options ride inside a `link: linkOptions({...})` key rather than flat on the item. That is
not cosmetic: TanStack's `Constrain` is an ASSIGNABILITY check, and assignability does no
excess-property checking, so a flat `{ id, label, to, colour: 'red' }` compiles silently. A config
whose selling point is "typos are compile errors" cannot have a hole exactly where metadata typos
live. Compile-verified both ways.

**The risk that comes with it, stated plainly:** without the consumer's `Register` module
augmentation, `RegisteredRouter` degrades to `AnyRouter`, every `to` widens to `string`, and the
whole definition validates NOTHING while reporting zero errors. The API looks like it is working.
`agent/rules/basalt-router.md` says so, and the playground type-guard fixture is the only defence
inside this repo.

A compile-time cap on `mobile.tabs.length` was tried and **rejected**: both forms that make the
length check work silently degrade `NavTabId<G>` to `string`, killing the far more valuable id-union
validation. The cap is a runtime DEV warn in `projectMobileNav` instead.

### Migration (removed exports — no major, per the no-majors doctrine)

`renderNavLink`, `renderBreadcrumbLink` and `sidebarFooterExtra` are gone from `BasaltShellProps`,
along with the exported types `NavLinkRenderer`, `MobileNavLinkRenderer`, `BreadcrumbLinkRenderer`,
`MobileNavItem` and `MobileNavSection`. The replacement for all three callbacks is one component
seam — `SidebarItem.Anchor`, typed `NavAnchor` — and on the breadcrumb bar, `parentAnchor`.
`sidebarFooterExtra` rendered inside `mobileControls`, which was `hiddenFrom="sm"`: it was invisible
on desktop, a latent bug, and its only host is the drawer being removed. A consumer with no router
needs no migration at all — `href` + `onClick` still work.

`MobileNav`'s own props changed from `sections` to a `model` built by `projectMobileNav`; the shell
does that itself, so only a consumer composing the sub-components by hand is affected.

## Chart-API round three — `feat/follower-tooltips-and-doc-guard` (2026-08-19)

Round three is smaller and differently shaped: two filed issues, two small gaps, and one piece of
process criticism that turned out to be the most valuable item in the batch.

1. **Follower tooltips (`tooltip.onFollow`, issue #51).** A page sharing one cursor gave every
   follower a crosshair and its own series dots but a tooltip only on the SOURCE — so hovering a
   spike moved a bare vertical line across every sibling and showed numbers on none of them. The
   reader got the position and not the reading. It was a capability REGRESSION: a consumer carried a
   hand-written synced value chip and deleted it in the 1.15.0 migration, with no supported way to
   restore it, because `CartesianChart` has no seam for a tooltip no pointer event produced. Default
   `false`; a follower always anchors to its own crosshair (there is no pointer to track), and only
   the SOURCE's tooltip is `aria-live` — N followers announcing per pointer move would be strictly
   worse than the silence being fixed.
2. **Managed-doc drift, for the second time — so this time it got a gate.** `sync` was still placing
   `basalt-design/SKILL.md` naming `ChartTooltip`, a component deleted in 1.15.0, in a file
   consumers are told not to hand-edit. 1.16.0 had fixed exactly this class in the CLAUDE.md block;
   this was the same miss one file further down, found by a human reading rather than by any gate.
   `scripts/check-agent-doc-drift.ts` now runs in CI with two complementary checks: bolded-backtick
   identifiers (the "compose this primitive" form) must exist in the export surface, and an explicit
   removed-API denylist is banned outright in any form — with a self-check that fails if a
   denylisted name ever reappears as a real export, so the list cannot silently ban a live API. Both
   historical misses were verified to fail it, each caught by the check designed for its form.
3. **`strokeOpacity` silently no-ops on bar/area swatches** — it is a stroke property, and a bar
   swatch has no stroke. Documented, with `fillOpacity` named as the equivalent. It bites the
   zone/reference-legend idiom (`mark: 'bar'`, `getValue: () => null`) specifically, where reaching
   for it looks right and does nothing.
4. **The x axis is categorical, and the docs never said so (issue #52).** `scalePoint<string>` means
   N points are N evenly spaced positions whatever the values behind the keys. Now stated
   prominently in both `CHARTS-SPEC.md` and the consumer-facing rule, with both silent consequences:
   geometry that lies about spacing for event-shaped series, and a repeated key dropping a point.
   The scale itself is NOT built — it reaches the cursor's `xScale` inversion, `XZoneRects` (bounds
   are domain keys today), the bar kinds' band width and `smartTicks`, so it is a design pass, not a
   prop. The design direction is recorded on the issue: the root problem is that `getX` serves as
   cursor key, scale domain value AND tick-label source at once; `formatX` split off the third in
   1.17.0, and `PlotContext.xPos` would split off position, after which a linear scale is an
   internal change rather than a fork of the render-prop contract.

**The process finding, which outranks all four.** A consumer observed that `autoMaxFloor`'s clamp
order had moved twice in five minors while `AxisConfig.nice` was defaulted `false` specifically to
avoid moving anything — an inconsistency in how much rendering movement a minor is allowed. Checking
the history made it worse and clearer: 1.13 was clamp-then-pad (`MultiLine.tsx:200`), the 1.15
`CartesianChart` rebuild reimplemented it as pad-then-clamp, and **nobody noticed**, because the
ordering had no test — only the padding's sign-safety did. It shipped as a silent behaviour
regression, survived a full release, and was found only when a consumer proved the divergence
numerically. So it was not policy churn; it was one unnoticed regression and one restoration. The
cost to a consumer is identical either way.

Two rules came out of it, both now in `packages/basalt-ui/CLAUDE.md` under "Shipping a rendering
change": what blast radius a minor may move (every chart → opt-in prop defaulted to the old
behaviour; only opt-in-prop users AND restoring a documented law → plain `feat:` with measured
before/after and a named opt-out), and the one that would actually have prevented this —
**a rewrite that reimplements an existing law must pin that law with a test BEFORE the rewrite.**
`padAutoLower` came through the same rebuild unchanged precisely because its law was pinned.

## Chart-API round two — `feat/chart-consumer-round-two` (2026-08-19)

1.16.0 went out and **both** consumers upgraded within a day: argo took all four reversals (chart
source 7206 → 5717 lines, −1489 total, up from −1019 at 1.15.0; the four charts forced out of the
`Bars` kind collapsed back from +77/+91/+93/+116 to +2/−16/+6/+7), and linewatch took one item and
correctly rejected the rest as not applying to it.

The value of a two-consumer round is visible in the shape of the reports. argo's is a migration
ledger — what collapsed, by how much. linewatch's is an audit against 1.16.0's SOURCE rather than
against the handover, and it found four things the handover had not mentioned because nobody had
looked. Every item below was verified in source here before being worked on; two turned out to be
worse than reported.

1. **`autoMaxFloor` was applied on the wrong side of the pad** — the one BEHAVIOUR CHANGE in this
   batch. `resolveAxisDomain` padded and then clamped the floor, while the lower bound had always
   clamped `autoMinCeil` and then padded. Two laws in one function, and argo proved the divergence
   numerically: dataMax 3.2, pad 1.1, floor 6 → 6.0 before, 6.6 now. The old law landed a winning
   floor exactly on the axis top with zero headroom, so a target line pinned to that floor sat glued
   to the plot edge — something the lower bound never did. Now `padAutoUpper(max(dataMax, floor))`,
   the exact mirror of `padAutoLower`. A consumer depending on the old ordering will see their axis
   top move.
2. **`TooltipHeader` had no formatter seam** — the highest-value find, because it is a wrong date on
   screen rather than a missing convenience. `fmtTooltipDate` regexes `YYYY-MM-DD` out of the domain
   key and builds a LOCAL `Date`, so a UTC ISO key made the header name a different day than
   `formatX`, the badge, and every sibling chart. The only workaround was carrying a local-offset ISO
   key. Now `tooltip.formatHeader`, defaulting to today's behaviour.
3. **No kind forwarded `formatX` — all six, not the one reported.** `CartesianChart` always took it;
   `Bars`/`MultiLine`/`StackedArea`/`ZonedLine`/`DualPanel` did not expose it, so the only route to a
   custom x label was pre-formatting it into the domain key — making one string serve as display
   value, scale identity and cursor key at once. This repo's own rules already warn that a truncating
   formatter then collapses two points onto one domain value and silently stops drawing one of them.
   `Heatmap` stays excluded: `colLabel`/`rowLabel` already ARE that seam.
4. **Cursor resolution was nearest-only, never containing.** For a chart whose keys are bucket
   leading edges, a hover in the back half of a bucket resolved to the FOLLOWING bucket — the shared
   crosshair one column right of the data being pointed at, reproducibly, for every back-half hover.
   Now an opt-in `cursorResolution: 'leading'` on every cartesian kind and `useChartCursor`.
5. **`getMarker` could not express a plain filled dot.** Both kinds rendered it with a punched-out
   ring, so argo's previous `fillOpacity: 0.7` circles were unreproducible after moving onto the
   kind. Return type widened with `ring` and `fillOpacity`.
6. **`role="img"` was erasing the chart's own keyboard slider.** `ChartFrame` labelled itself
   `role="img"`, and every descendant of `role="img"` is presentational per ARIA — so `HoverOverlay`'s
   `role="slider"`, the entire keyboard-scrubbing story 1.15.0 shipped, never reached the
   accessibility tree. The label announced; the control silently unreachable. Now `role="group"`.
   Worth recording how it hid: **jsdom does not implement that pruning**, so a `getByRole('slider')`
   test passes under the bug. The regression guard had to be structural, and no role-based test
   could ever have caught it.

7. **`DualPanel`'s keyboard slider was unnamed and reported no position** — found by writing the
   regression tests for item 6, not by either consumer. Its `ariaLabel` reached only `ChartFrame`'s
   outer container, never its own focusable `HoverOverlay`, and neither overlay ever received
   `valueNow`/`valueMax`/`valueText`. So a consumer passing `ariaLabel` got a labelled chart
   containing an unnamed control reporting nothing — the same class of defect as item 6, one layer
   down. It survived because every prior `DualPanel` test rendered a single chart and never needed a
   named or value-texted slider. Now at parity with `CartesianChart`; the bottom overlay stays
   pointer-only by design, and a test pins that there is exactly ONE focusable slider per chart.

Not built, deliberately: a **two-bar-pane kind with independent scales** (linewatch's throughput
chart, whose two strips genuinely have no y dimension). One consumer, one chart — this repo extracts
a kind on the third repeat, so the `theme-allow` exemption stands until a second appears.

Also corrected here: the 1.16.0 handover told argo to re-enable legend toggling on the four charts
carrying `legend={{ toggle: false }}`. linewatch pushed back correctly — `toggle: false` is a
legitimate choice when a legend is a key rather than a control, and the reversal only applies where
it was adopted BECAUSE `prependRows` could not see the hidden set.

## Chart-API consumer gaps — `feat/chart-api-consumer-gaps` (2026-08-18)

argo migrated all 38 of its charts and 7 routes onto 1.15.0's `CartesianChart` in one pass: 12
`basalt/hand-rolled-plot` violations to zero, 105 tsc errors to zero, chart source 7206 → 6187
lines, `ChartHoverSync` deleted from every route with no `ChartCursorScope` needed (page-wide
sharing is exactly what those wrappers had meant). Eleven charts collapsed by 79–263 lines each.
No margin override survived anywhere — every hand-tuned nudge was deleted and none was needed
back, which is the measured-margin claim holding up in the field.

What it also produced is the useful part: **nine places the new API could not express something,
and four charts that had to leave a shipped kind because of one of them.** Every item below is a
gap a real migration hit, not a hypothetical.

1. **`BarsBar`/`BarsLine` could not carry `tooltip: false`** — the highest-cost one. `series.ts`
   documents `SeriesStyle.tooltip` as the replacement for the removed per-kind
   `hideBarTooltipRows`, but `Bars` gave no way to thread it, so a chart wanting one bar drawn and
   legended without a tooltip row had to leave the kind and hand-draw its rects. Four argo charts
   did, at roughly +95 lines each — the kind's whole value, lost to one missing boolean.
2. **`ChartSeries.formatValue` never saw the datum.** `(v: number) => string` cannot produce
   `97.5 kg (92.5 × 3)` or `0.123%/d · +0.4σ`, so four more charts fell back to hand-authored
   `prependRows` — reopening exactly the seam derived rows exist to close. Now `(v, d) => string`.
3. **`prependRows`/`extraRows` never saw legend state**, so a hand-authored row structurally
   desynced from toggling and the only honest repair was `legend={{ toggle: false }}` (used on four
   charts). Both now receive `(d, { visible, hidden })` — the same sets the plot draws from.
4. **No `AxisConfig.nice`.** The rebuild `nice()`s no scale and exposed no seam, so six charts
   restored rounding inside a custom `domain` function. Added, default `false`: flipping the
   default would move the domain of every already-migrated chart.
5. **No `SeriesStyle.strokeOpacity`.** A faint MA companion could only be built by baking `alpha()`
   into the color, which also dimmed the tooltip swatch and the crosshair dot. It is a MARK
   property: the plotted stroke and the legend swatch honor it (parity with `fillOpacity`), the
   12px tooltip chip and the crosshair dot deliberately do not.
6. **`DualPanel` ignored `ChartSeries.getMarker`** where `MultiLine` honors it — one chart silently
   lost its per-session dots.
7. **`DualPanel` had no `formatBar`**: `formatBottom` drove the ticks AND the histogram tooltip
   row, so a velocity reading lost a decimal and its unit. `formatBar` now owns the row only.
8. **`DualPanel`'s bottom pane had no domain config** — a lost `max(…, 0.1)` floor meant a plateau
   amplified to fill the pane. `bottomYDomain` + `bottomMaxAbsFloor`.
9. **`XZoneSpec` was centre-aligned only**, so a band was always one `step()` narrow and a
   single-sample band rendered nothing at all. `align: 'edge'` widens by half a step at each
   present bound; `'center'` stays the default.

Plus one documentation defect worth more than its size: **`basalt-ui sync` was still placing a
managed CLAUDE.md block naming "the `ChartTooltip` family, `AxisLeftNumeric`/`AxisBottomDate`" as
the primitives to compose** — pre-1.15 doctrine, in a block consumers are told not to hand-edit,
describing a component that no longer exists and a composition pattern that is now a lint error.
The rebuild updated the rules and skills and missed the template that ships beside them.

Two things argo reported that are NOT treated as gaps, recorded so they don't come back: the
pace-trend domain blowup (a zone bound of `to: 60` used as a pre-1.15 "top of axis" sentinel got
folded into the auto domain) is already answered by `resolveAxisDomain`'s documented handling —
non-finite `extraBounds` are skipped, so `Infinity` IS the sentinel; and `AxisConfig.format`
feeding both the ticks and the per-series tooltip fallback is deliberate, since a right-axis value
must never be formatted with left-axis rules — with `formatValue` now able to cite the datum, that
is the correct seam.

Every addition is optional and every default reproduces 1.15.0's rendering exactly.

## Chart-layer batch — `feat/linewatch-chart-gaps` (2026-08-02)

The same consumer (LineWatch) that prompted the adoption-gap work came back with a second field
report, this time from four rounds of UI overhaul rather than one lint run. Every item below cost
them real time or shipped a real defect. The through-line is different from last time and worth
naming: **the adoption gap was things the framework never told them; this is things the framework
could not express, or expressed in a way that silently did nothing.**

Three of them are traps rather than gaps — code that typechecks, lints, passes `check-theme`, and
renders, while being wrong:

1. **`ChartTooltip` was a `<div>` that no-opped inside `<svg>`.** Authored in an SVG tree, React
   creates it in the SVG namespace: it mounts, accepts every prop, throws nothing, and is never
   painted. One of their charts carried eight authored tooltip rows no human had ever seen. No gate
   on either side could catch it. It now portals to `document.body` (SSR-guarded), which removes the
   trap instead of warning about it — and un-breaks `position: fixed` under a transformed ancestor
   as a side effect.
2. **Cross-chart hover synced on exact string match.** A chart that folds its domain to fit a narrow
   viewport stops owning most of the keys its unfolded siblings broadcast, so the shared crosshair
   appeared on roughly one hover in three with no rule a reader could infer — worse than no shared
   cursor. `useHoverSync` now takes an optional `resolveKey`.
3. **`AxisBottomDate` hardcoded `DD.MM`,** so a 24h window printed the same label a dozen times —
   and `raw-visx-axis` makes a raw `<AxisBottom>` a build failure, so there was no supported exit.
   They pre-formatted upstream instead, which forced those labels to double as unique scale domain
   values and cascaded into the fold-key coupling in (2). One missing prop, three layers of
   consequence. It now takes a `tickFormat`.

Plus three plain gaps: `useHoverSync` rebuilt its point map on every render (the accessors now sit
in refs, matching the pattern the file already used for `ctx` and explained in a comment before
failing to apply it here); hover capture was mouse-only, so every chart was inert on touch, for a
framework that ships a `MobileNav`; and `charts/` had no Mantine-free layout primitive, so centering
anything cost a `theme-allow` inside the directory the guard exists to protect.

### `isPending` — "nothing to draw" is three states, not two

The item they rated highest-value, and the one that generalizes furthest. A chart has three empty
states: **measured and empty**, **measured and absent** (a real coverage gap), and **not asked yet**.
The `data ?? []` idiom collapses the third into the second, densifying an in-flight query into a
fully-hatched "not measured" window — a positive claim that the line was watched and carried
nothing — on every cold load and every range change. They found and fixed this class of bug in four
separate places across four review rounds and still had six chart instances without it.

`ChartPending` (+ the minimal `ChartCenter` it needed) now ships from `./charts`, with `isPending`
on `ChartFrame` and all seven kinds. It reserves the footprint and draws nothing that could be read
as a measurement — no axes, no gridlines, no hatching, no marks — and no animation, since the motion
doctrine bans idle pulsing. `ChartFrame` also drops the legend entirely while pending: a legend
naming a series with nothing yet to point at is its own small lie. This is the third data point for
the lesson the 1.7.0/1.8.0 `tone` work established — **what a shipped composite cannot express gets
routed around by compliant-looking code the guard has no way to recognize**, so the gap stays
invisible until a consumer describes it.

### Two self-inflicted findings

- **The guard told chart files to use Mantine.** `inline-display`/`raw-html-layout` name
  `Box`/`Flex`/`Grid`/`Group` as the remedy, all `@mantine/*`, all banned in the Mantine-free chart
  layer — so inside a chart file the finding was unactionable, not merely inconvenient. basalt never
  felt it because `package.json`'s `exemptRules` carried a private `primitives` self-exemption. Both
  kinds now skip chart files and **the self-exemption is deleted**, so basalt passes for the same
  reason a consumer does. This is a relaxation, so the grace-minor doctrine (which governs the guard
  getting _stricter_) does not apply and no `GRACE_PERIOD_KINDS` entry belongs with it. Same shape
  as the dogfood blind spot that let the 1.4.0 regression reach a consumer — worth watching for.
- **`init`/`sync` seeded repo-root files into a subdirectory package.** Their app is
  `repo-root/web/`; `lefthook.yml`, `.github/workflows/check.yml` and `src/query-client.ts` all
  landed where nothing reads them, and because seeds are recreated-when-missing, every upgrade put
  them back after the consumer relocated them. The `query-client.ts` seed was the harmful one — it
  shadowed a real client carrying `staleTime` and `refetchOnWindowFocus: false`, so one wrong import
  silently reinstated a refetch loop. The CLI now walks up for `.git` and skips those units with a
  printed note when the package is not the repo root. Notice, never an error.

### Held, not done

- **The horizontal stat strip** they proposed as a component: one consumer, one instance. Under this
  repo's own rule of three that is not an extraction yet.
- Their report reached us with item 4 missing and item 1's closing paragraph truncated — neither is
  addressed here.

### Footgun found doing this work

`bun run check-theme` — and therefore `bun run pre` — runs `bin/basalt-ui.mjs`, which imports
`../dist/cli/index.js`. It validates the last **built** dist, not the working tree. A change under
`src/guard/**` is invisible to it until `bun run build` runs, and a stale dist can report green over
source it never read. That is how the guard change above first appeared to be a no-op. Build before
trusting `check-theme` after touching `src/guard/` or `src/cli/`.

## Built (verified as-built, 2026-07-07)

- **Spine** — `surfaces.ts` (the SSOT registry), `register.ts` (`BasaltRegister`/`Slot`/`SeriesKey`/
  `AsyncState`), `state.ts` (`createPersistedState`), `guard/` (incl. the `basalt guard-hook`
  PreToolUse adapter; `GUARD_RULES` drives `checkSource`), provider freeze (`BasaltErrorBoundary` +
  `onError` + CSP nonce).
- **Seven batteries** ship as runtime subpaths: `./query`, `./router-tanstack`, `./agent`,
  `./commands`, `./forms`, `./notifications`, `./data` (split into `./data/table` +
  `./data/virtual`) — plus `./guard`, `./state`, `./connectivity`, `./llms.txt`. All 19 subpaths
  (incl. `./connectivity` and `./content`) resolve in the pack-test.
- **Charts / tokens** — config-driven chart system (legend/tooltip/crosshair), `ResponsiveChart` +
  `useChartSize`, the semantic-tier `--vx-*` token keystone, the modern-zinc palette (see
  `docs/DESIGN-SPEC.md`), motion discipline (oxlint + `check-theme` enforced).
- **Design overhaul (2026-07-11)** — the shell, charts, components (`data-table`, notifications
  bell/center), and agent-chat surfaces were restyled to `docs/DESIGN-SPEC.md`: cool zinc surfaces,
  a single saturated sky accent, split by role (SEED values ink `#0077bd`/`#8ec5ff`, fill `#0077bd`
  both schemes, white label — the derive engine now EMITS different tokens from these seeds, see the
  post-derive-engine note in `DESIGN-SPEC.md`), whisper-shadow-plus-ring depth
  (no plain hairline) — `shadow-card` for panels, `shadow-raised` for interactive controls since the
  2026-07-31 control-depth pass — 7px card radius (6px controls, after the 2026-07-15 density pass), and the
  three-font system (Nunito Sans / Hubot Sans /
  JetBrains Mono, shipped via exact-pinned `@fontsource-variable/*` deps). `DESIGN-SPEC.md` is the
  ground truth for all visual doctrine going forward; older doctrine comments describing warm-neutral
  zinc-charcoal, a muted slate-blue accent, flat/no-shadow cards, or 8px radii are superseded — see
  its "Doctrine inversions" section.
- **Enforcement** — `SURFACES` projects `gen-oxlint` + `gen-llms`; `check-coverage` (8 assertions);
  Mantine-free boundary enforced on headless surfaces; `@visx/*`-only-in-`charts` boundary.
- **Release gates** (`scripts/pack-test.sh`) — `publint --strict` + `attw` (esm-only) +
  `check-dist-layering.mjs` (7 Mantine-free subpaths + root-barrel) + 19-subpath resolution +
  tarball parity (every CLI-read source ships) + export-surface snapshot (named-export completeness).
- **CLI** — `init` · `sync` (+ `--check` drift gate) · `check-theme` · `check-coverage` · `info`
  (+ `--json`) · `doctor` (+ a 4th, warn-only check for `basaltAppPlugin`'s icon files under
  `public/`) · `guard-hook`.
- **App bootstrap** (`./vite`) — `basaltAppPlugin` joins `basaltViteConfig`: dual `theme-color` +
  anti-FOUC background derived from `SURFACE.bg`, bring-your-own icon links, `site.webmanifest`
  (served in dev too), site-wide OG/Twitter defaults, and an opt-in `serviceWorker` that lazily
  composes the optional peer `vite-plugin-pwa` and degrades to a warning when it's absent. New
  `agent/rules/basalt-app.md` covers vite-config composition and plugin ordering.
- **Agent-DX** — `llms.txt`, `AGENTS.md`, `basalt-ui info --json`, `basalt-ui doctor`; rules +
  skills + CLAUDE block placed by `basalt-ui init`/`sync` (plugin/marketplace retired in 1.0.1).
- **Resolved owner decisions** — `@visx/*` bumped alpha.11 → **4.0.0 stable** (+ `@visx/responsive`);
  `@tanstack/react-hotkeys@0.10.0` optional peer (live keybinding) shipped; `createForm` →
  `useBasaltForm` rename.
- **Maturation review executed** (see `docs/archive/MATURATION-REVIEW.md`) — the `./data` split (`./data/table`
  - `./data/virtual`), `./connectivity` registered in `SURFACES`, an accessibility wave (keyboard-
    operable chart legend, `DataTable` sort, mobile-nav `aria-current`, streaming `aria-live`), agent
    `retry(threadId)` + orphaned-in-flight-thread reconcile, and a documentation cleanup (10 planning
    docs archived to `docs/archive/`, 7 marketing orphans deleted).
- **Sidebar account** — `SidebarAccount` (a presentational footer row) + a provider-agnostic
  account contract (`BasaltAccountProps`/`State`/`Actions`) threaded optionally through
  `AppSidebar`/`BasaltShell`'s `account` prop. No better-auth dependency, no `./auth` subpath — the
  Better-Auth mapping recipe ships as JSDoc only.
- **Content surface** (`./content`, `docs/CONTENT-SPEC.md`) — complete: `Prose`/`CodeBlock`/
  `Callout`/`TableOfContents`/`ReadingProgress`/`Markdown`/`MermaidDiagram`/`mdxComponents` (stages
  1+2) plus the docs-framing layer (stage 3) — `ArticleLayout` (meta header + sticky TOC rail +
  prev/next footer), `ArticleCard`/`ArticleGrid` (overview cards), `GuideLink`/`GuideDrawer`
  (contextual help drawer), and the content-collections + TanStack Start recipe in
  `agent/rules/basalt-content.md`.

## X-bands, dual-axis margin, legend note — `feat/chart-x-bands-margin-legend-note` (2026-08-15)

Another field report, three chart-API gaps and one doc gap:

1. **Vertical time-window bands.** `ZoneRects`/`ZoneSpec` cover horizontal value bands only — a
   consumer marking a time window (not a value range) had no primitive. New `XZoneRects` +
   `type XZoneSpec` (`./charts`), wired as `xZones?: XZoneSpec[]` on `MultiLine` and `ZonedLine`
   only. Bounds are `getX` **domain keys**, not dates/timestamps (the kinds run a
   `scalePoint<string>` over the label strings) — an omitted bound is the plot edge, a key absent
   from the domain skips the band rather than clamping to one.
2. **Dual-axis margin.** `Bars` computed its right inset with an inline `Math.max`; nothing else
   could reuse it, so a dual-axis `MultiLine`/`ZonedLine` consumer hand-picked a number. New
   `chartMargin(opts?)` + `type ChartMargin` (`./tokens`, also from `./charts`) — bare call equals
   `VX.margin`, `{ rightAxis: true }` widens `right` to fit `AxisRightNumeric`'s tick labels.
   Returns a new object per call (memoize it). `Bars` now calls it internally.
3. **Muted legend qualifier.** A series invisible in the plot (flat at the domain floor, e.g. "Low
   cloud — 0% all night") had no way to say why. New `note?: string` on `SeriesStyle` (and so
   `LegendEntry`, via `deriveLegend`) — `ChartLegend` renders it, muted, after the label.
4. **Maps ambiguity, doc-only.** `@visx/geo` isn't among the 9 pinned `@visx/*` peers and
   `basalt/visx-boundary` never says maps are out of bounds — a consumer burned 20 minutes there.
   `agent/rules/basalt-charts.md` gained a "Maps are not charts" section: maps are consumer
   territory, the visx boundary constrains `@visx/*` imports only (a map library is unaffected),
   and `check-theme`'s `inline-spacing` guard is a per-line regex that still flags a map's pixel
   geometry (`fitBounds({ padding })`) even after hoisting it to a const — use `theme-allow`.

## Derive engine — "one accent in, calculated palette out" (stages 1-3, done)

The shipped palette is GENERATED, not hand-authored. `tokens/derive.ts` (a ported, calibration-
checked HCT derivation) computes the accent family, the 12 categorical fills, the surface stops,
the ink ramp, and the status solids from one seed hex + five bounded knobs; `tokens/palette.ts`
builds `ACCENT`/`FILL`/`SURFACE`/`INK`/the status hues from `deriveTokens(DEFAULT_DERIVE_CONFIG)`
once at module load (seed `#0077bd`, `neutral: 'zinc'`, all level knobs at 0; vibrancy centers on
`x0.72` chroma — one step above the original muted `x0.6` center). Shipped:

- **Generator** — `tokens/{derive,hct}.ts`: the HCT math (zero-dependency sRGB↔HCT + a 16-iteration
  gamut-mapping chroma search) and the derivation laws (the Y=0.165 fill-luminance band, the
  3.0:1 `onAccent` contrast floor, the vibrancy/brightness/surface-level knob mappings).
- **Generated palette** — `tokens/palette.ts` computes `ACCENT`/`FILL`/`SURFACE`/`INK`/status from
  the generator at the new baseline (e.g. `ACCENT.accentFill` = `#4374a6`, `SURFACE.bg` =
  `#f2f2f5`/`#27272a`) instead of hand-picked hexes; the chart-chrome opacity ramps
  (`NEUTRAL.axis`/`grid`/`tooltip*`) now key off the derived ink hex too, not a frozen pre-
  derivation approximation.
- **Consumer API** — `createBasaltTheme(overrides?, { derive: { accent, neutral, lightLevel,
darkLevel, vibrancy, accentBrightness } })`. Omitted knobs fall back to the shipped default per-
  knob; the default (or a `derive` that resolves back to it) stays on the pre-baked static
  `baseTheme` — zero extra derivation work.
- **`DeriveControls`** (`theme-lab`) — the DEV-tool live-tuning panel for the same six knobs,
  persisted to its own localStorage key. Not the production path — that's `createBasaltTheme`'s
  `derive` option — but a faithful one: it applies a config through BOTH halves of the theme (a
  cascade-winning `<style>` tag for the `--vx-*` vars, plus a real rebuilt theme object; see
  "Honest theme lab" below).
- **Non-color dimensions (step 2)** — the same options object (never a second config surface)
  gained `fonts: { sans?, head?, mono? }` (pure pass-through to the `--basalt-font-*` vars,
  enforced by the new `raw-font-family` guard kind) and `radius` (integer −5..+5; law: card =
  7 + level, ctrl = 6 + level, clamped ≥ 0, offset tiers + anchored Mantine scale stops follow —
  `deriveRadius(level)`, level 0 byte-identical to the pre-knob values, locked by
  `theme/radius.test.ts`). Every theme/component/CSS-module radius literal was tokenized onto
  `--vx-radius-{card,ctrl,tight,fine,floating}` first (no-visual-change refactor), then the knob
  landed; `basalt.rawRadius` guard is ON. `legendText`'s light value now derives from the ink hex
  like the sibling chart-chrome ramps. `DeriveControls` gained a Radius slider (persisted-state
  v2).
- **Density dimension (step 3)** — a fourth theme dimension (the third non-color one) joins the
  options object:
  `createBasaltTheme(overrides?, { derive, fonts, radius, density })`. `density` is an integer
  −3..+3 (level 0 = today's values, byte-identical, with ONE deliberate exception — see below) —
  narrower than `radius`'s −5..+5 on purpose: it retunes every density-TRACKING spacing token
  together (the `SPACE_FIXED` structurals below are exempt by design) via
  `deriveSpacing(level)`, a multiplier law (`1 + 0.1 * level`, rounded, floored at 1) for
  anchors/scale-stops/one-offs, plus an independent, gentler additive law — its OWN hand-picked
  coefficient (`ROW_LINE_HEIGHT_STEP`), not derived from the multiplier's own coefficient, which a
  prior version of this law incorrectly claimed — for the NavLink row line-height, which would
  overshoot the readable range under the multiplier. The ±3/0.1 range reproduces the exact same
  `0.7..1.30` multiplier envelope as an earlier ±5/0.06 shape at fewer, more meaningful notches — the
  wider range left 41-43 of the 108 spacing values byte-identical to level 0 at one notch of movement
  (uniform over-quantization, not a single dead zone), which the narrower range corrects; see
  `deriveSpacing`'s JSDoc (`tokens/palette.ts`) and the "Fix 7" relation tests in
  `theme/density-relations.test.ts`. Landed in
  two prep commits first (no-visual-change refactors, byte-identical, locked by
  `theme/spacing.test.ts`): `tokens/palette.ts` gained `SPACE` (semantic anchors — the `6px 10px`
  row inset, the 4px vertical rhythm, input height), `SPACE_SCALE` (the Mantine `xs`/`sm`/`md`/
  `lg`/`xl` spacing scale, kept independent of `SPACE` even where a level-0 number coincides — an
  anchor is one component's inset, a scale stop is the app-wide generic rhythm), `SPACE_STEP`
  (named one-offs, including six chart-chrome constants — legend gap, the four plot-area margins,
  dot radius — that track density; stroke weights don't), and `SPACE_FIXED` (density-EXEMPT
  structurals — hairlines, the reading-progress bar height — deliberately never emitted as a
  `--vx-*` var). A CSS-module sweep then routed 114 hardcoded spacing declarations across 15 files
  (prose and the app sidebar accounting for nearly half) onto `--vx-space-*`, one named token per
  site, byte-identical. `DeriveControls` gained a Density slider (persisted-state v4 — bumped from
  v3 when `deriveSpacing`'s accepted range narrowed to `[-3, 3]`, so a stale out-of-range `density`
  from an earlier session falls back to the default state instead of reaching `deriveSpacing` and
  throwing at render). **The one level-0 exception**: `SPACE_STEP.stickyHeaderClearance` is
  RESPONSIVE, not a single value — a desktop (`>= sm`) value (`appShellHeaderHeight + stackMd`, 60
  at level 0) and a mobile (`< sm`) `stickyHeaderClearanceMobile` sibling
  (`appShellHeaderMobileHeight + stackMd`, 108 at level 0), each clearing only its own AppShell
  header instead of one value tuned against either the wrong header or an over-cleared common
  (desktop) path — see `deriveSpacing`'s JSDoc (third bullet) and `docs/CONTENT-SPEC.md` §5 for the
  full rationale and the `./content` ↔ `BasaltShell` coupling this creates.
- **Theme-lab prune** — `COLOR_GROUPS` used to expose a swatch for every derived color, which is
  dead weight now the palette is generated: hand-tuning a hex the derive engine owns and
  regenerates on the next config change. Classified against `buildPaletteData` rather than by group
  name: Accent/Fills/Ink/Semantic (wholly derived) were dropped; Status/Neutral/Surface keep only
  their hand-authored members (status `excellent`/`neutral`, `line`/`line2`/`dotStroke`, surface
  `overlay`). `COLOR_GROUPS` is now a six-token structural inspector, not an identity tuner —
  identity/color tuning lives in `DeriveControls` alone. Export surface unchanged (same name, same
  subpath); the playground's Theme-lab panel copy was updated to match.
- **Enforcement** — `basalt-ui check-theme` wired into the repo's own `bun run pre` (root
  `package.json`) and into `lefthook.yml`'s staged pre-commit (`packages/basalt-ui/src/**` glob);
  `tokens/derive.ts` + `tokens/hct.ts` are in the package's `basalt.exempt` list (they ARE the
  generator/calibrated-constant source, alongside `palette.ts`/`theme/index.ts`) so the `raw-hex`
  guard rule doesn't fire on their calibrated literals.
- **Guard dogfooding wave (rides with the density PR)** — the package now runs five guard kinds it
  previously exempted itself from: `raw-surface`, `raw-spacing`, `inline-spacing`, and the
  `inline-display`/`raw-html-layout` layout-primitive pair (two kinds, one category — they share an
  `exemptRules` opt-out below). No new rule kinds — these already
  shipped; what changed is that basalt-ui itself is now scanned by them, which surfaced and cleared
  the last raw literals in its own source. Two things fell out of it: **`exemptRules`**
  (`Partial<Record<GuardKind, string[]>>` on `GuardConfig`) — the missing seam between whole-file
  `exempt` (skips every rule) and hardcoded `appliesTo` (per-kind path scoping in the registry),
  applied as one post-filter so it covers the inline-handled kinds too, empty by default; and **15
  new tokens** — 14 `--vx-space-*` one-offs (agent rail/code/error/message/transcript insets, badge
  inset, stat-card gap, virtual-list row inset), each seeded into `SPACE_STEP_BASE` at its shipped
  px so level 0 is byte-identical and the value now tracks density instead of freezing, plus a fixed
  `--vx-radius-pill` (9999px, level-invariant). The headless layers (`agent/`, `charts/`) declare
  themselves exempt from the layout-primitive rules via `exemptRules` — their remedy points at a
  Mantine `<Flex>`/`<Center>` they cannot import under the Mantine-free contract. A handful of
  irreducible sites (sub-scale opticals below the token floor, a Badge `styles.label` part, two
  `motion.span` glyph wrappers) keep a documented `theme-allow`.
- **Honest theme lab (rides with the density PR)** — `DeriveControls` applied a config through an
  injected `<style>` tag alone, which can only reach CSS custom properties. The Radius/Density knobs
  also control plain numbers baked into the theme OBJECT by `buildTheme`: `theme.radius` and
  `theme.spacing` (the generic Mantine `xs`..`xl` scales — every `p="md"`/`gap="sm"` in an app) plus
  `defaultProps.radius` on Badge/SegmentedControl/Progress/Tooltip/Popover/Modal/Notification,
  `Progress.size` and `Timeline.bulletSize`. A `<style>` tag cannot reach a number inside a JS object,
  so the sliders moved the CSS-var surfaces (the CSS-module-heavy app sidebar most of all) and left
  plain Mantine layout at level 0 — the tool under-reported its own knobs UNEVENLY across surfaces,
  which is exactly the reading a retune is judged by, so any by-eye measurement taken through it was
  half blind (a `-2` radius read on the sidebar alone, a sidebar-wants-`-1`/rest-wants-`+1` density
  split that may be the instrument rather than the design). `BasaltProvider` now reads the same
  persisted store and rebuilds a real theme via `createBasaltTheme(undefined, { derive, radius,
density })`. Three pieces: the state moved to `theme-lab/derive-state.ts` (deliberately Mantine-free
  — the root layer must not pull the panel UI into every consumer's chunk for six lines of state, and
  one store instance means the CSS half and the object half can never disagree);
  `provider/lab-theme.ts` merges only the config's DELTA against the shipped base
  (`themeOverrideDelta`), because `BasaltProvider`'s contract is consumer-overrides-win-last and the
  documented mount hands it a COMPLETE `createBasaltTheme()` carrying every level-0 number — a
  whole-theme merge would clobber the lab back to level 0 in one direction and eat the consumer's own
  overrides in the other; function-valued fields are skipped (`buildTheme` allocates fresh
  `vars`/`classNames` closures per call and none of them closes over a radius/spacing value). The
  delta also carries `other.basaltDerive`/`basaltRadius`/`basaltDensity`, so `BasaltBridge`'s existing
  injection emits the matching `--vx-*` CSS off the running theme. **No shipped default moved, and the
  production path pays nothing**: the store subscription is gated to DEV builds at module scope
  (`process.env.NODE_ENV !== 'production'` picking one of two `use*` implementations — a per-render
  ternary would be a `react/rules-of-hooks` error), since `BasaltProvider` is the mandatory `.` entry
  and must not cost every consumer a localStorage read plus a permanent `storage` listener to answer a
  question that is always "no" there; a bundler drops the dev implementation and its
  `theme-lab/derive-state` import outright. Even in a dev build, with the "Apply" switch off — or in
  any app that never mounts the panel, since nothing else writes that key — the provider returns
  `createBasaltTheme(theme)` verbatim, and an active override at level 0 yields an empty delta. The
  cost of the gate: the sliders are inert in a production BUILD of a dev app (`vite build && vite
preview`) — run the playground through its dev server. Two things previously documented as part of the gap never were: Card/Paper resolve their
  radius through `var(--vx-radius-card)` in `styles.root`, and the Input/Button/ActionIcon `size="md"`
  heights read `--vx-space-*-height` via each component's `vars` — the CSS half always covered both.
  Pinned by `provider/lab-theme.test.ts` (16 tests) + `theme-lab/derive-state.test.ts` (6, for the
  store-to-override projection both halves share — the `applied` gate the "production untouched" claim
  rests on, and that no state-only key leaks into `theme.other.basaltDerive`).
- **Level-0 spacing retune (rides with the density PR)** — the first retune taken with a trustworthy
  instrument, applied to the BASE tables so level 0 stays the shipped identity and the knob keeps its
  full ±3 travel around it. No default level, no second knob — the knob's zero IS the identity.
  Components roomier: `SPACE_SCALE_BASE` 10/12/16/18/24 → **11/13/18/20/26** (~+10%), the app-wide
  rhythm every `p=`/`m=`/`gap=` resolves through, including the Card/Paper `p="xs"`/`p="sm"` inset
  idiom. Sidebar tighter (~−15%) across 13 gap/inset one-offs (`sidebarRegionGap` 12→10,
  `sidebarSectionGap` 15→12, `sidebarChildListIndent` 17→15, …). Three deliberate exclusions: sidebar
  SIZES are not spacing (`sidebarAvatarSize`, `sidebarSearchTriggerHeight`, the two Menu widths stay —
  shrinking them is a dimension change); the 4px stack rhythm stays 4/8/12/16/24, being the grid the
  scale sits on (moving it reshapes every Prose/Callout/ArticleCard margin); and `SPACE.rowInsetX`/
  `rowInsetY` stay 10/6, since that anchor is shared by the sidebar NavLink AND every Menu item, so
  tightening it for the sidebar tightens menus app-wide — the opposite direction from the rest. If the
  sidebar still reads loose, that anchor is the next lever, and the honest conclusion then is that the
  NavLink row inset is wrong everywhere rather than that the sidebar needs a private copy. Two
  consequences, both recorded at the source rather than papered over. `SPACE_SCALE` no longer coincides
  with the anchor group at level 0 (`xs`/`sm`/`md`/`xl` used to equal `rowInsetX`/`stackMd`/`stackLg`/
  `stackXl`) — always a coincidence, never a law, and this is what proves the two groups move
  independently, so the doc comments and `tokens/density.test.ts`'s independence assertion are updated
  to the stronger form. And `appShellHeaderMobileHeight` went 96 → **97**: it is documented as a SUM
  (row 1 + `SPACE_SCALE.sm` + `appHeaderMobileActionsHeight`), so raising the `sm` addend without
  raising the total took the pixel out of row 1 instead — surfacing as row 1's WCAG 2.5.8 target-size
  budget at density −3 going flush against its 22px floor. Restoring the sum restores the 1px margin
  (budgets 23/26/28/32/36/38/41 across the range). Both that constant's JSDoc and the assertion that
  measures it now name the real fix: compute the header from its addends the way
  `stickyHeaderClearance*` already is, so the drift becomes impossible rather than re-tuned — a
  follow-up only because it moves every non-zero level's value. `theme/spacing.test.ts`'s doc header
  was rewritten to match its actual job: it locks the CURRENT identity, updating it is how a deliberate
  retune lands AND how a regression would hide, so a diff to it must be a decision taken on purpose in
  the same commit as the base-table edit.

**Known limitations:**

- `accentHover`'s dark-mode hue drifts from the legacy hand-tuned value by ΔE≈5.9 (perceptible but
  minor) — a calibration gap, not a regression, tracked for a future re-tune.
- A handful of structural tokens stay non-derived by design: `SHADOW.*`, `SURFACE.overlay`/
  `divider`, the raw `BP` hue ramps, and `STATUS.excellent`/`neutral`.
- Mantine's `theme.colors.dark` tuple is generator-derived (`buildDarkTuple`, `theme/index.ts`) for
  every config, including the shipped default — the previous pinned `basaltDark` literal (hand-
  tuned, pre-derive-engine) is gone; a small visible dark-mode shift is expected and accepted.
- The accent fill's page-contrast floor (3.0:1 against BOTH derived page backgrounds) is now a
  clamped law: `derive.ts`'s `clampFillTone` steps the `accentBrightness`-shifted fill tone back
  toward the band centre until it clears the floor on both schemes, so the knob saturates rather
  than violating 3.0:1 at the extremes.
- `stone`/`slate`/`neutral` are spec'd `NEUTRAL_PRESETS` entries (hue/chroma pairs) but have no
  calibration data behind them — only `zinc` is calibrated against the framework's original
  hand-tuned identity.
- Chart constants (`VX.legendGap`/`margin`/`dotR`) are single-sourced off `SPACE_STEP`'s
  `chartLegendGap`/`chartMargin*`/`chartDotR` keys, but — unlike every other density-tracking
  one-off — deliberately have NO `--vx-space-*` CSS var (visx SVG props read plain JS numbers, not
  `var()` strings, so a declaration would have zero consumers). `VX` is built ONCE at module load
  from the frozen level-0 `SPACE_STEP` snapshot, so it never re-reads a `density` option at all —
  this is the one case that fails BOTH paths, including the PRODUCTION
  `createBasaltTheme(undefined, { density })` one, not merely the dev slider (see `deriveSpacing`'s JSDoc, `tokens/palette.ts`, for
  the full accounting of what tracks density end to end and what doesn't).

## Open — framework-free token consumption (`feat/framework-free-tokens`)

Driven by jkrumm.com, which evaluated 1.2.0 and hand-ported the hexes rather than installing the
package. The capability was there — `buildPaletteCss` already ran framework-free under Node and Bun;
the blockers were packaging and ergonomics. Five additive changes, every one defaulting to today's
exact output:

1. **Golden fixture** — `buildPaletteCss()` pinned byte-for-byte (9718 bytes, 248 lines, 197
   variables). The regression gate the rest land against.
2. **Selector options** — `scheme` / `defaultScheme` / `mediaFallback` on `BuildPaletteOpts`. Any of
   them moves the emitted per-scheme selector from `html[…]` (0-1-1) to `:root[…]` (0-2-0); the
   no-options path stays on the legacy literal.
3. **Optional peers** — the five remaining required peers (`react`, `react-dom`, `@mantine/core`,
   `@mantine/hooks`, `@tanstack/react-query`) are now `optional`, so a tokens-only install carries
   no React. They stay in `peerDependencies`, which is what preserves the version-mismatch warning.
4. **`dist/tokens.css` + `basalt-ui tokens:css`** — the prebuilt stylesheet as a published subpath,
   plus a CLI that re-emits it with the options above. `bunx` it once and carry no dependency at all.
5. **`only: 'core'`** — drops the 95 component-named `--vx-space-*` one-offs, 197 variables → 102.
   Partition derived from the `SPACE` key set, not a maintained list.

Plus two `styles.css` reach fixes (the unlayered `!important` print rule matched a consumer's own
landmarks; the heading `font-stretch` is now a `--basalt-font-head-stretch` knob) and
`docs/FRAMEWORK-FREE.md`.

**Follow-ups this work deliberately did NOT fold in:**

- **Expose `buildPaletteData` / `PaletteData`.** `deriveRadius` and `deriveSpacing` are public, but
  the color derivation runs through `createBasaltTheme` (React + Mantine), so a framework-free
  consumer can retune radius and density and **cannot retune the accent**. Real gap.
- **A plain-class `dist/content.css`.** The prose language is CSS-modules-scoped and reachable only
  through React components. Larger design question.
- **Reconcile the accent drift.** `docs/DESIGN-SPEC.md` states `#0077bd` / `#8ec5ff`; the emitter
  produces `#4374a6` / `#a2c3f0`, because chroma is scaled by `max(seedChroma, 40) × 0.72` at
  vibrancy 0. `theme/contrast.test.ts` pins the drifted values, so this is known rather than
  accidental — but a consumer reading the spec gets a different palette than one calling the
  emitter. Decide which is authoritative. This is the one item here that would visibly move existing
  consumers' pixels, which is why it stays separate.
- **`--basalt-font-head-stretch` as a `createBasaltTheme({ fonts })` option.** The knob exists in
  CSS; reaching it from the theme config would make it a real dimension like the rest.

## Validation

Last verified green **2026-07-27** on `feat/framework-free-tokens` — `bun test`: 968 pass / 54
files, `bun run pre` (fmt/lint/typecheck/check-theme), and the full pack-test (`./tokens.css`
resolves from a scratch install; tarball parity now asserts every file-valued export ships).
**A final re-verification (`bun run pre` + `bun test` + pack-test) runs before ship** if further
commits land.

## Deferred by design — do NOT build for 1.0

Intentional cut-line calls, not gaps:

- **tsdown migration** — NO-GO for 1.0 (swapping the tsc declaration emitter on a type-spine
  package; owner may override).
- **Phase-5 kill-list** — bottom-sheet, runtime hooks, canvas-line-kind, appshell-aside-slot,
  `create-basalt-app`, dtcg-interchange, `@mantine/dropzone`, full `<Chat>`/voice. Advisory-only.
  (The PWA vite helper on this list shipped — see `basaltAppPlugin` in the "Built" section above.)
- **`no-explicit-any` → error escalation**, **`./state` static-lint globs** (would over-reach into
  consumer state files), **controlled `DataTable` sorting** prop.
- **`@example` JSDoc markdown-compile harness** (the playground demos already are canonical
  compiling examples).
- **`react-perf` lint** — dropped after evidence (141 false-positive warnings on idiomatic
  Mantine/visx; React Compiler supersedes manual memoization).
- **3 `@deprecated` back-compat aliases** — `state.ts` legacy connectivity export, `ZonedLine`/`Bars`
  `ZoneSpec` aliases — remove at the next major.

## Not part of this refactor

**argo consumer-side migration is a separate repo task** (`~/SourceRoot/argo`) and is **not done**.
This refactor only extracted read-only _from_ argo _into_ basalt-ui. The BLUEPRINT S0–S5 argo plan
is superseded as basalt-ui's roadmap — do not execute it here.

**Update 2026-07-11:** the argo consumer migration referenced above has since run to completion,
end-to-end, against this branch (`file:`-linked, unpublished) — provider/theme/series foundation,
all chart features, the app shell, and the query/forms/notifications/commands batteries. Distilled
feedback from that run lives in `docs/ARGO-MIGRATION-LEARNINGS.md`; consult it before touching CLI
packaging, the charts/tokens API, the shell, or the batteries above.

## Doc map (post-reconciliation)

- **Living reference** (current, maintained alongside the code) — **`STATUS.md`** (this file,
  single source of truth), `DESIGN-SPEC.md` (2026-07 visual identity, supersedes older doctrine —
  see its "Doctrine inversions" section), `DESIGN-CORE.md`, `MANTINE-THEMING.md`,
  `FRAMEWORK-FREE.md` (consuming the token system with no React/Mantine/bundler).
- **`docs/archive/`** — superseded scope ledgers and historical process artifacts, kept for
  provenance only:
  - Executed ledger — `MATURATION-REVIEW.md` (the maturation quality ledger; its phases are
    executed, kept for provenance).
  - Superseded scope ledgers — `MATURATION-ROADMAP.md`, `ENFORCEMENT-HARDENING.md`,
    `INTEGRATION-DX.md`. Their phases are built except the finish line above; per-phase
    "proposal/remaining" language is historical.
  - Superseded plan — `BLUEPRINT.md` (S0–S5 = argo-consumer migration, do not execute here).
  - Historical process artifacts (phase complete) — `ONE-ZERO-DRIVE-HANDOVER.md`,
    `EXECUTION-HANDOVER.md`, `PHASE-1-HANDOVER.md`, `PHASE-1-GROUNDING.md`, `PHASE-1-DESIGN.md`,
    `PHASE-1-IMPLEMENT-HANDOVER.md`.
- **Deleted** — 7 orphaned pre-pivot marketing/tooling docs (`BRAND_VOICE.md`,
  `brand_context.yaml`, `llm.md`, `prose/PROSE_TRANSITION.md`, `prose/tailwind_prose.md`,
  `prose/prose_styles.js`, `research/DARK_MODE_IMPLEMENTATION.md`) — zero references repo-wide,
  described dead Tailwind/Astro tooling that doesn't survive the marketing rebuild.
