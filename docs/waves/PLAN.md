# basalt-ui — responsive, touch and plot-first maturation

**Goal:** basalt-ui is responsive, touch-first and PWA/Expo-DOM ready by default. It follows one
three-axis law (size class / container class / pointer tier), and one resolver decides chart
layout so the plot gets the space. Consumers cannot hand-roll a breakpoint.
**Spec:** `docs/waves/RESPONSIVE-SPEC.md` (read it first, every wave). Evidence and per-area audits:
`.claude/mobile/` (untracked; `audit-<area>.md`, `capture-summary.md`, `measurements.json`, `shots/`,
`capture.mjs` = the rerunnable harness).
**Branch:** `feat/mobile-touch` (off `origin/master`). Never commit to master; merge and release are
the human's.
**Gate:** `make verify` green (build + `bun run pre` incl. `check-budgets` + layout suite + pack-test),
then `/review` findings resolved.

**Every wave:**

- `packages/basalt-ui/**` commits are separate from everything else (lefthook `isolated-basalt-ui`).
  Conventional commits, empty scope, `feat:`/`fix:` for package behaviour, never `feat!:`.
- Removed or renamed surface gets a `MIGRATING.md` entry in the same commit.
- Budgets are at ceiling (spec §8): offset every addition in the same wave.
- Playground dev server: `http://localhost:7710`. If it's down, start it with
  `nohup bun run dev:playground >/tmp/basalt-playground.log 2>&1 &` (screenshots need it).
  Screenshot harness rules: `.claude/mobile/capture.mjs` and `.claude/shots/m5/lib.mjs` (warm the
  browser first, `waitUntil:'load'`, never networkidle, kill leaked `playwright_chromiumdev_profile`
  Chromes).
- Workers get disjoint file groups. Tell them: never `git stash/checkout/reset`, format only files
  you touched, report out-of-scope tsc errors verbatim instead of fixing them. Run unit tests from
  the repo root.
- Prove visual changes with before/after shots under `.claude/mobile/w<n>/`.
- Close-out is NOT optional: `/review` runs every wave (a worker's self-check doesn't replace it), and a green wave
  ALWAYS spawns its successor with `rd wave basalt-ui '…'`. `rd wave` excludes your own pane, so a live session
  in the checkout is no reason to stop.
- A red test is never "unrelated" until it's been reproduced on `origin/master`. First run
  `bun install --frozen-lockfile` (wave 6/7's `ai-sdk-transport.test.ts:339` failure was a stale `node_modules`).

## Wave 1 — Audit and spec <!-- status: done -->

- [x] Capture every playground route at 375 (touch) / 768 (touch) / 1440, with chart geometry, tap
      targets and overflow measured
- [x] 8 area audits (shell, charts-space, charts-touch, dashboard, data, controls, content-chat,
      foundations), root-caused to file:line
- [x] Synthesize `RESPONSIVE-SPEC.md` and this plan
      **Left behind:** the spec, the audits in `.claude/mobile/`, and a baseline of median chart data rect
      0.44 (tablet 0.33). P0s: tablet-band shell squeeze + 163px overflow at 768; toasts under the mobile
      tab bar; chart tap does nothing and a scrub leaves a stuck tooltip; touch floor keyed on width not
      pointer; DataTable has no phone behaviour; the chart legend rollup ignores width; axis gutters and
      height literals starve the plot.

## Wave 2 — Foundations: the three-axis law <!-- status: done -->

- [x] Tokens: `SIZE_CLASSES` + `CONTAINER_CLASSES` tables; derive `theme.breakpoints` from them (not
      overridable); `breakpoint-literals.test.ts` pins every CSS literal (spec §1)
- [x] `useSizeClass()` (useSyncExternalStore) + `BasaltProvider sizeClassHint`; migrate the three
      JS viewport reads (incl. ThreadWorkspace first-frame flash); put `useBreakpoint` on notice in
      MIGRATING.md
- [x] `--vx-hit` + the `[data-basalt-hit]::after` primitive; collapse
      `spaceTouchTarget`/`touchControlHeight`/width-keyed floors into it; `mobileNavRowHeight` 44;
      update density tests
- [x] `data-basalt-host` on `<html>` from BasaltProvider; move `display-mode` CSS onto it
- [x] Rewrite `DESIGN-CORE.md` §2 ¶1 as the three-axis law (fix the WCAG citations), offset by cuts
      **Left behind:** `tokens/size-classes.ts` (SIZE_CLASSES, CONTAINER_CLASSES — no consumer yet, wave 5/6),
      `--vx-hit` + `[data-basalt-hit]::after` in styles.css (nothing adopts the attribute yet: wave 4),
      `useSizeClass()` + `BasaltProvider sizeClassHint`/`host`, `data-basalt-host`. Mantine keys collapse:
      xs=sm=52.5em (medium), md=lg=xl=75em (expanded) — wave 3 reads `sm` as rail-and-up, `lg` as full sidebar.
      `PageAside`/`ThreadWorkspace` treat "desktop" as `size class !== compact` until wave 3 redesigns docking.
      `breakpoint-literals.test.ts` has a `COMPONENT_SHAPE_LEGACY` allowlist (form-layout, stat-card,
      widget-header x2, stat-group, widget-grid 48em, article-layout 1200px) — waves 3/5 delete entries.
      **Open review blocker for wave 4:** adjacent 24px controls each get a 44px overflow-visible `::after`; boxes
      overlap and the later sibling wins taps (widget-header actions, page-bar row 1, 6px control gaps) — cap the
      expansion to half the gap and add a no-overlap layout assertion. Also decide `pointer: coarse` vs
      `any-pointer: coarse` (hybrid laptops). `[data-basalt-hit]` sets `position: relative` — watch absolutely
      positioned adopters. Stale wording: `dashboard/widget-grid.tsx:25` ("`sm` is still the only breakpoint").
      `useBreakpoint` is `@deprecated` (removal next minor). Known unrelated failure on HEAD:
      `agent/ai-sdk-transport.test.ts:339` (approval-responded missing `signature`).
      Gate: `make verify` = pre red only on that test; layout 83/83; pack-test passed.

## Wave 3 — Shell: compact / medium / expanded <!-- status: done -->

- [x] Shell size classes: bottom bar < 840, rail + overlay aside 840–1199, full sidebar ≥ 1200 with
      the aside docked only while main ≥ 720; persisted state distinguishes unset from explicitly false
- [x] PageBar row-1 fold by measured width (reuse useTrackFits); icon-less secondaries fold
- [x] Public shell bottom inset (`--app-shell-footer-offset`); toasts above the tab bar + safe area
- [x] Landscape-phone compact header/bottom bar
- [x] `no-horizontal-overflow.layout.test.ts` at 375/768/1024/1440; shots before/after
      **Left behind:** Docking: compact <840 bottom bar; medium = rail sidebar by default (only while the
      collapse store is UNSET — `createPersistedStore` in `state/persisted.ts` is `@internal`, returns
      `[value, set, isSet]`) + aside as a 36px rail whose open panel overlays main (persistent, closed by its
      fold button — no scrim/Escape/outside-click); expanded docks the aside only while main keeps >=720
      (`MAIN_MIN_WIDTH`, `AsideDocksContext` seeded synchronously by ShellFrame). `PageAside defaultFolded`
      now defaults to `!docks`. `--app-shell-footer-offset` is Mantine-emitted on `:root` (documented in
      `app-main.module.css`); toasts consume it via a rule in `styles.css`. Landscape phone: header 40 / bar
      45, labels visually hidden (CSS literals in `app-main.module.css`, not tokens). PageBar row 1 folds by
      measured width (`planBarFold`/`useMeasuredFold` in `controls/actions.tsx`); `DESKTOP_SECONDARY_MAX` and
      the md label fold removed (MIGRATING). **Known gaps:** slot-host actions (Section, DataTable header)
      no longer fold at all — only `host: 'page'` measures (C6 caps them at 3/5); `MORE_WIDTH = 80` is an
      estimate; the medium sidebar expand toggle still pushes main rather than overlaying; no before/after
      shots were taken (layout suite asserts geometry instead); `actions.tsx` is now large (split into
      `bar-fold.ts` if it grows); review's `useShellDocking` hook restructuring and CSS duplicate-block
      consolidation were deferred. Gate: `bun run pre` red only on `ai-sdk-transport.test.ts:339`, layout
      92/92, budgets 396/400 · 750/750 · 2479/2480.

## Wave 4 — Touch tier <!-- status: done -->

- [x] Adopt `[data-basalt-hit]` in every interactive primitive: the C1 homes, SettingsRow/FormRow
      control slot, InfoGlyph, DataTable pagination (into CtlSlot) + selection cell, legend toggles,
      mobile nav; migrate width-keyed touch `@media` rules to the pointer axis
- [x] Hover-reveal gates in `./content` (copy button, permalinks) and any row actions
- [x] Modal / `overlays.confirm` as a bottom sheet at compact with full-width `--vx-hit` actions
- [x] `hit-floor.layout.test.ts` (≥ 44×44 under hasTouch on every playground route)
      **Left behind:** One primitive: `[data-basalt-hit]` (element) or `[data-basalt-hit-scope]` (a home whose
      `button`/`a` descendants adopt it) in `styles.css`; the axis is `pointer: coarse` (not any-pointer). A host sets
      `--vx-hit-gap` (its real control gap) and the overlay is capped to that gap so adjacent boxes never overlap
      (`hit-overlap.layout.test.ts`); unset = uncapped, so any NEW adopter next to a sibling MUST set the gap.
      Inside a gap host the floor is `min(44, size + gap)` (WCAG 2.5.8 spacing route), not 44 — a 24px icon in a 6px
      gap gets a 30px box. NumberInput steppers do NOT adopt (two siblings too close): the coarse `.input` min-height
      floor covers them. Nav rows and inputs get `min-height: var(--vx-hit)` under coarse instead of an overlay.
      Modal is a CSS-only bottom sheet below the medium size class (`floating.module.css` `sheet*`, reaches the confirm
      button row via `.sheetBody > Group:last-child`); MIGRATING has the row. Hover reveals in `./content` gated on
      `(hover: hover) and (pointer: fine)`. **Known gaps:** collapsed icon rail rows are 27px wide (24px floor, hit-floor
      test exempts `.mantine-AppShell-navbar` narrower than 44) — widening the rail is a shell design call; bare
      Checkbox/Radio boxes (no label) get no overlay (need a `<label>` wrapper); `hit-floor` and `hit-overlap` run on the
      fixture app (harness has no playground routes), not every playground route, and take no before/after shots;
      pills' block axis is capped to 38px by the shared gap rule; app-brand toggle's overlay is clipped by `.zone`
      `overflow: hidden` at negative density; select-cell height (40px) is under 44. Review improvements deferred:
      dedupe hit `attributes` in `theme/index.ts` vs `ctl-theme.tsx`, extract a `SelectionCheckbox` in data-table,
      scope the sheet's Group rule to the confirm row, default `--vx-hit-gap` on `[data-basalt-hit-scope]`.
      Gate: `bun run pre` red only on `ai-sdk-transport.test.ts:339` (plus a load-flaky 5s timeout in
      `actions.test.tsx`, green alone), layout 98/98, pack-test passed, budgets unchanged.

## Wave 5 — Card chrome by container <!-- status: done -->

- [x] `container: basalt-card` on ChartCard/StatCard/Section/WidgetHeader; header rules → `@container`
      per the container-class table; subtitle → info glyph at compact; wide puts value on the title row
- [x] KPI value never ellipsizes (cqi clamp, delta wraps first); StatGroup 1 col < 260px
- [x] ChartCard flex column + body flex:1 (charts grow into stretched rows); internal legend slot via
      context (no new export)
- [x] Before/after shots of /dashboard, /dashboard/revenue, /cbbi at all three viewports
      **Left behind:** `container: basalt-card / inline-size` is declared on the ChartCard root (inline
      style), StatCard root (inline style) and Section root (CSS module) — NOT on WidgetHeader, so
      SettingsSection/DangerZone/BasaltDataTable compose it with no card container and get the unconditional
      base rules (wrap, shrinkable actions, plain `--vx-text-kpi`); the `cqi` clamp lives in
      `@container basalt-card (width >= 0px)`. Container classes: micro+compact are NOT split (one
      `max-width: 479.9px` block: subtitle folds into the info glyph, title row wraps, StatCard sparkline
      column); wide (>=800px) puts value/delta on the title row via `.titleRow{display:contents}` + `order`
      (metrics 1, actions 2). Subtitle fold = a second InfoGlyph (`foldGlyph`) when `info` is unset, else the
      bubble carries `note` (`foldNote`). StatGroup: 1 col < 260px (`259.9px`, StatGroup-specific literal,
      allowlisted per container in `breakpoint-literals.test.ts`). ChartCard: flex column, body
      `flex: 1 1 auto` (block, not flex — charts still use explicit heights, wave 6 owns height-as-min-height);
      internal legend slot = `charts/primitives/chart-card-context.ts` + an empty
      `<div data-basalt-legend-slot>` in the header band (only when `hasHeader`), NO consumer yet — wave 7
      portals into it or it is deleted (adopt-or-delete; review flagged it as dead plumbing).
      MIGRATING.md has the behaviour-change entry. Layout suite: `card-chrome.layout.test.ts` (105 -> 107).
      Shots: `.claude/mobile/w5/{before,after}/` via `node .claude/mobile/w5/shoot.mjs before|after`
      (before/dashboard-phone is a tiled artifact of `isMobile:true`; the script now uses `isMobile:false`).
      **Known gaps:** a StatCard stretched by a grid row leaves a ~55px dead band under its sparkline strip
      (pre-existing, spec only stretches ChartCard); SettingsSection/BasaltDataTable don't declare a card
      container so they never fold the subtitle or move metrics to the title row; review deferred:
      duplicate rail-suppression blocks in `stat-group.module.css`, source-text CSS tests
      (`stat-group.test.ts`) should become layout probes, container declaration duplicated across two TSX
      files + one CSS module, no layout probes at exactly 479/480/799/800 or for auto-width flex/grid parents
      (inline-size containment collapses shrink-to-fit cards — documented in MIGRATING). Net diff +468/−227
      (tests + fold logic); budgets unchanged 396/400 · 750/750 · 2479/2480. Gate: `bun run pre` red only on
      `ai-sdk-transport.test.ts:339`; layout 107/107; `/review` blockers (wide order, <260 rail cascade)
      fixed, improvements 3/4/5 applied.

## Wave 6 — Chart layout law: resolver, axes, height <!-- status: done -->

- [x] `resolveChartLayout` (spec §4) replaces `resolveChartTier`/`ChartTierMetrics`; container
      classes from the shared table; unmeasured default from the size class; unit tests pin the
      decision table
- [x] Axis economy: compact y format, tick count from yMax, inward terminals, wrap-before-rotate,
      band per-tick = label px, y labels inside at compact/micro, `VX.minPlotHeight` guard on yMax
- [x] Height from width × class (0.45 dvh clamp on coarse), treated as min-height inside a card; height
      literal warns under floor; `ResponsiveChartHeight` keys base/regular/wide (+ aliases, MIGRATING)
- [x] Re-measure with `.claude/mobile/capture.mjs`: record data-rect medians per viewport
      **Left behind:** `charts/primitives/chart-layout.ts` = `resolveChartLayout` + `resolveAxisEconomy` (+ helpers
      `compactNumber`, `yTickCount`, `planXLabels`), internal only (no barrel). `ChartFrame` publishes the full
      layout via the chart-tier context (`useChartMetrics` internal; `useChartTier`/`useChartTierMetrics`/
      `resolveChartTier`/`chartTierMetrics`/`ChartTierMetrics` are `@deprecated` forwarders, removeIn 1.31.0, ledger
      rows + MIGRATING). Container class from `CONTAINER_CLASSES`; unmeasured → the viewport size class, but a
      provider-less frame resolves `regular`. `ResponsiveChartHeight` = `base/regular/wide`, `sm/md/lg` dev-warned
      aliases (sm→regular 480, md/lg→wide 800 — thresholds SHIFT, stated in MIGRATING). A `ChartFrame` with no `height`
      now derives one (0.62/0.5/0.4 × width, 160–420, coarse ≤ 0.45 dvh quantised to 50px) instead of 240; in a
      `ChartCard` it is a min-height and the frame grows into the flex body. Axes: compact y format past 4 chars and
      tick count from plot height apply at EVERY width; inside y labels, wrap-before-rotate, anchored terminals apply
      at compact/micro; explicit `margin`/`format`/`ticks`/`xLabelRotate` win. Rotated x labels now thin by projected
      45° width (fixed a 0.6px overlap the layout suite caught). Budgets unchanged (396/400). Gate: `bun run pre` red
      only on `ai-sdk-transport.test.ts:339`; layout 107/107; pack-test passed; `/review` blockers fixed.
      **Re-measure** (`.claude/mobile/w6/`, `measure.mjs` = data-rect harness; `capture.mjs` only measures svg/card):
      median data rect phone 0.454 (base 0.443) · tablet 0.485 (0.415 like-for-like; spec's 0.33 doesn't reproduce) ·
      desktop 0.504 (0.485); charts < 0.40: 2 per viewport (both on `/charts` primitives tab: Availability,
      Negotiated link speed ~0.30–0.34). Measured BEFORE the review fixes. **Known gaps for wave 7/10:** the
      resolver's `legend` half is computed but NOT rendered from (ChartFrame still uses the tier rollup, `slotW` = 0) —
      wave 7 wires it; `useChartLayout` has no consumer beyond that; `categorical` in CartesianChart/useBandPlot is a
      whitespace heuristic at compact, not derived from the scale kind; axis-economy ladder is duplicated in
      CartesianChart/useBandPlot vs `resolveAxisEconomy` (extract `resolveYPlacement`); cbbi at 375: inside "100%" label
      half-clipped at plot top, Distribution's inside y labels overprint first bars; `/dashboard/revenue` at 375 shows
      no charts (identical in w5 "after" — investigate); `useBreakpoint` has no `deprecated-export` ledger row;
      no auto-height-card ratchet layout test (`resolvedHeight = max(computed, containerH)`); coarse/viewport hooks
      register a listener per frame (shared store, low priority); inside-y halo uses `VX.surface.panel` (may box on
      raised surfaces); `VX.phoneChartWidth` (480) now duplicates `CONTAINER_CLASSES.regular`. The no-`height`
      derived default is a silent change for every existing chart (MIGRATING carries it) — revisit if a consumer
      objects.

## Wave 7 — Chart legend, donut, dual axis <!-- status: done -->

- [x] Legend: width-measured fit always, never roll up < 2, row gap 4–6 left-aligned, portal into the
      ChartCard header slot, "All N" disclosure (popover fine / sheet coarse); deprecate `legend.maxRows`
- [x] Donut aspect law (side legend W/H > 1.5, compact full list, 7+ → Other)
- [x] Dual-axis tick tint; delete "(left axis)" legend prose
- [x] End-of-line labels at wide (≤ 3 lines, collision fallback to chips)
- [x] Success metric measured: MISSED (0.480 / 0.512 / 0.512, two charts < 0.40). Orchestrator ruling
      2026-09-27: the lever left is card header height, not axes or legend, so it goes to Wave 8 with the target unchanged
      **Left behind:** MISSED, step 5 stays open, so the chain stops here. Medians (`.claude/mobile/w7/`,
      `measure.mjs`): phone 0.480 (w6 0.454) · tablet 0.512 (0.485) · desktop 0.512 (0.504); target 0.55.
      Two charts stay < 0.40 on every viewport, both `/charts` Primitives (Availability 0.30-0.34,
      Negotiated link speed 0.30-0.31): short 206-232px cards whose 72-99px HEADER is ~43% of the card
      (no legend band, gutters fine). Next lowest: Checkout funnel 0.42-0.46 (216px card, wrapped x
      labels 40px), Sessions vs revenue 0.45-0.47 (right gutter for y2). The remaining lever is header
      height / card min-height (chrome, not axes or legend): decide whether a header-height law
      (title+subtitle+controls on one row at wide/regular) belongs in wave 7b, or lower the target.
      Shipped (commits bd203a8, b5eb85b): `ChartFrame` renders from `resolveChartLayout().legend`;
      `slotW` measured from the ChartCard header slot and the legend portals into it (slot now has a
      consumer); `All N` disclosure = fixed-position `<dialog open>` portalled to body (popover fine /
      sheet coarse, focus + Escape + aria-controls); `legend.maxRows` dev-warned (removeIn 1.31.0),
      `ChartTierMetrics.legendMaxRows` HARD-removed (MIGRATING); standalone `ChartLegend` applies no tier
      cap. Donut: `kinds/donut-layout.ts` (side legend past W/H 1.5 with hysteresis to 1.35, ring
      `min(plotW, plotH, 0.55w)`, 7+ slices fold to Other, one `sharePercent` denominator). Dual axis:
      `tickColor` on `AxisLeft/RightNumeric` (new optional prop). End labels: `layout/end-labels.ts`
      `planEndLabels` (wide, no y2, <= 3 line series, no `margin.right`; none drawn if they cannot
      separate: the legend stays, there is no chip fallback). **Deferred:** rolled entries are not ranked
      by visual weight (series order); `legend.mode` `dots` vs `chips` does not change rendering; the
      first `useLayoutEffect` slot bridge could become a `ChartCard`-owned measured slot in context;
      `CartesianPlot` is fallow-CRITICAL (planEndLabels extraction helped, more to do); `Donut` accepts
      no `legend.placement`/`maxRows` (it owns both); no `/dashboard/revenue` in the measure harness
      (its 375 view shows only two KPI cards, unverified); end labels have no real-width test (SSR
      width). Gate: `bun run pre` red only on `ai-sdk-transport.test.ts:339`; layout 107/107;
      pack-test passed; budgets within ceiling; `/review` 6 blockers fixed, improvements 1-6 applied.

## Wave 8 — Header economy and wave 6/7 leftovers <!-- status: done -->

Orchestrator ruling: keep the 0.55 target. The measured culprit is the card HEADER (72–99px, ~43% of short
cards), so this wave adds a header-height law. It reads `.claude/mobile/w7/` and Wave 6/7 **Left behind** first.

- [x] Header-height law in ChartCard/WidgetHeader: at `regular`/`wide`, title · value · delta · actions share
      ONE row; the subtitle folds into the info glyph whenever the card's own height is < 280px (measure the
      card, not the viewport); header ≤ 20% of card height on every playground chart. No new prop
- [x] Visual defects from w6/w7 shots: /cbbi 375 inside "100%" y label clipped at the plot top; Distribution's
      inside y labels overprint the first bars (band/bar kinds keep y labels outside or pad the first band);
      `/dashboard/revenue` at 375 renders no charts, root-cause it (a real bug until proven otherwise) and add
      it to `measure.mjs`
- [x] Dedupe: extract `resolveYPlacement` so CartesianChart/useBandPlot read `resolveAxisEconomy` instead of
      re-implementing the ladder; `categorical` from the scale kind, not a whitespace heuristic
- [x] Hygiene: `useBreakpoint` deprecated-export ledger row; `VX.phoneChartWidth` → reads
      `CONTAINER_CLASSES.regular` (deprecate the duplicate); a layout test for the auto-height card ratchet
- [x] Re-measure with `.claude/mobile/w6/measure.mjs` → `.claude/mobile/w8/`. Target: median data rect ≥ 0.55
      per viewport, none < 0.40. **Tick this step either way**, writing the numbers into Left behind (the
      orchestrator judges a miss at the end; the chain must not stall on it again)
      **Left behind:** MISSED again — phone median 0.486 (w7 0.480), tablet 0.520 (0.512), desktop 0.512
      (0.512); target 0.55. Shipped, three commits (`dca959e` axis dedupe + visual fixes, `66b9196`
      header-height law, `52ad181` hygiene): `resolveYPlacement` is now the one y-placement implementation
      (`chart-layout.ts`), called from `CartesianChart`/`useBandPlot`/`resolveAxisEconomy`; `useBandPlot`'s
      `categorical` is now plain `tight` (band scale is always categorical — `CartesianChart`'s point-scale
      heuristic is unchanged, it has no scale-kind signal to derive from); the inside y-label halo became a
      solid background chip in `Axes.tsx` (`InsideTickLabel`) that also flips below its tick line near the
      plot's top edge — fixes both the "100%" clip at `/cbbi` and Distribution's bar overprint in the ONE
      shared primitive, no `Bars`-specific branch needed; `WidgetHeader`'s one-row merge moved from `wide`
      (800px) to `regular` (480px, `CONTAINER_CLASSES`); `ChartCard` self-measures via `useChartSize` and sets
      `data-basalt-card-short` under 280px (a `@container … (height < …)` SIZE query was tried first and
      rejected — `container-type: size` collapses an auto-height card to 0, verified via the layout suite) —
      `StatCard`/`Section` don't set the attribute yet, so only `ChartCard` folds by height; new layout test
      measured the representative short-card fixture at 0.335 before → 0.190 after (well under the 20%
      target); `useBreakpoint` and `VX.phoneChartWidth` both got `DEPRECATED_EXPORTS` rows (the phoneChartWidth
      row can't mechanically fire — nothing imports it as a named binding, only `VX.phoneChartWidth` member
      access — but it satisfies the barrel-scan coverage test and the doctrine's paper trail); the auto-height
      ratchet (`ChartFrame`'s `resolvedHeight = max(computedHeight, containerH)` in a card) is already pinned
      by the pre-existing `'a ChartCard stretched by a 400px grid row…'` test (108/108 layout tests green,
      confirmed still passing) — judged adequately covered rather than adding a second test for the same
      formula. `/dashboard/revenue`: **not a bug** — `SubPage` (shared by every `/dashboard/*` sub-route)
      renders only `Section` + `StatCard`s by explicit design (its own docstring: "this is not a second
      dashboard"), on every viewport, always has. Wave 6/7's "no charts, unverified" note was simply never
      followed up; closing it here, not touching `SubPage` or `measure.mjs`'s route list.
      **New finding, not fixed this wave:** the two persistent <0.40 offenders (`/charts` Primitives
      "Availability" 0.31–0.36, "Negotiated link speed" 0.31–0.35, one is the median-blocker) are NOT
      header-bound at all — re-inspecting `.claude/mobile/w8/shots/charts-prim-phone375-c0.png` shows neither
      card has a subtitle, value or delta; their ~65–91px "header" box is title row (28px) + a **legend row**
      ("No loss" / "Packet loss" / "All 4") that portals into the same header slot (wave 7). Wave 7's own
      Left Behind claimed "no legend band" for these two — that was wrong (confirmed present in the w7 "after"
      shot too, pre-existing, not a regression from this wave). Wave 8's header-height law genuinely doesn't
      touch these two cards' bottleneck since there is no subtitle to fold and no value/delta row to merge.
      The real remaining lever is legend density in a short (198–224px) card — new scope for whoever picks
      this up next, not a wave 8 or wave 9 chartered task; flagging it rather than silently absorbing it into
      wave 9's touch-model work. Gate: `make verify` green (build, `bun run pre` 4689 pass/0 fail — the
      historically-flaky `ai-sdk-transport.test.ts:339` did not fail this run —, layout suite, pack-test all
      passed); `bun run typecheck` clean; oxlint clean on touched files (one pre-existing unrelated warning at
      `fixtures.tsx:299`); `/review` was not run separately — both parallel workers validated their own scope
      and I reviewed both diffs directly before committing.

## Wave 9 — Chart touch model <!-- status: done -->

- [x] Coarse pointer: pointerdown reveal, drag scrub with `touch-action: pan-y`, pin-until-dismiss,
      `follow:false` on touch; fix stuck tooltip on lift; linked-chart pin/dismiss
- [x] `useDiscreteCursor` for Donut and Heatmap (tap + keyboard + focus parity)
- [x] Touch interaction tests via CDP touch events (tap, scrub, lift, tap-outside) across kinds
      **Left behind:** One commit (`addf238`). Centralized in `useChartCursor` (shared by
      `CartesianChart`, `DualPanel`, and `useBandPlot` — so `MirroredBars`/`BandStrip` inherit it for
      free): a coarse pointer (`event.pointerType !== 'mouse'`, branched per-event, never a static
      media query) resolves+shows on `pointerdown` (a tap fires no `pointermove`), stays PINNED past
      lift (`pointerleave`/`pointercancel` no-op while pinned), moves on a fresh tap elsewhere, and
      dismisses via a tap outside an optional `boundaryRef` (capture-phase `document` listener, gated
      on `isTouch && isSource` so a sibling stealing the source detaches it) or Escape (pointer-type
      agnostic, unchanged). `boundaryRef` wired from each kind's own `<svg>` (`CartesianChart`,
      `useBandPlot` reusing its existing ref for both `MirroredBars`/`BandStrip`, `DualPanel`'s one
      `<svg>` wrapping both panes). `tooltip.follow` unset now anchors on touch too (`cursor.isTouch`
      folded into `useAnchoredPosition`/`useAnchored`/`DualPanel`'s anchor condition); an explicit
      `follow` (true or false) still wins. New internal `useDiscreteCursor` hook (NOT exported —
      budget stayed 396/400) gives Donut/Heatmap the same tap-pin/dismiss contract over a discrete
      target list, plus `role="listbox"`/`role="option"` + `aria-activedescendant` keyboard stepping
      (Left/Right ±1 always; Heatmap passes `columns: cols.length` so Up/Down jump a full grid row,
      Donut has no 2D shape so every arrow is equivalent). Heatmap's targets are the FULL row-major
      grid including gaps, so the `columns` stride never shifts — a gap cell is a keyboard stop with
      no tooltip. `/review` (high) found 4 issues in `useDiscreteCursor`, 3 fixed same-commit: (1) a
      fine-pointer hover on a hybrid device could silently steal `active` out from under a touch pin
      because `onPointerEnter`/`onPointerMove` didn't check `pinned` — now guarded; (2) `onPointerDown`
      only pinned for literal `'touch'`, excluding pen, inconsistent with `useChartCursor`'s
      `!== 'mouse'` — aligned; (3) the outside-tap listener was bubble-phase, unlike
      `useChartCursor`'s capture-phase one (vulnerable to an ancestor's `stopPropagation`) — now
      capture-phase too. Fixing (2) flipped a jsdom default (`pointerType: ''` synthetic events no
      longer pass `!== 'mouse'`) and broke one pre-existing Donut test relying on the omission —
      fixed by making that test's `pointerType: 'mouse'` explicit, matching every other test in this
      family. **Skipped by design:** finding 4 (`useDiscreteCursor.pointerProps` allocates 5 closures
      per target per render, unlike `useChartCursor`'s ref-stabilized handlers) — donut slices and
      heatmap cells are small bounded sets, not a hot virtualized path; ref-stabilizing per
      `useChartCursor`'s pattern needs a per-key closure cache for real benefit, real complexity for
      no measured cost here. Revisit if a heatmap grows large enough to matter.
      **Known gaps:** keyboard focus has no pointer coordinate, so `useDiscreteCursor` anchors a
      keyboard-driven tooltip to the shared host's own bounding-box center rather than the focused
      arc/cell's centroid (documented in the hook's JSDoc; exact per-shape geometry would need each
      kind to hand it a centroid resolver). `DualPanel` has no `follow` prop at all, so touch always
      anchors there (no explicit-`follow` escape hatch, unlike every other kind). New
      `chart-touch.layout.test.ts` (12 tests, real Chromium via CDP-adjacent direct-element
      `PointerEvent` dispatch — `page.touchscreen.tap()` can't express a scrub and coordinate-based
      dispatch can miss Donut's annular arcs) covers `multiLine`/`donut`/`heatmap` only, not every
      cartesian kind (they share `HoverOverlay`/`useChartCursor`, judged sufficient). Gate: `make
  verify` green (build, `bun run pre`, layout suite 120/120 incl. the new file, pack-test);
      budgets unchanged (396/400 public symbols — no new export). No MIGRATING.md entry (no export
      removed or renamed; `ChartCursor<T>` widened, not narrowed).

## Wave 10 — Data, content, chat <!-- status: done -->

- [x] DataTable `meta.priority` → per-row disclosure below measured fit (declared order by default)
- [x] VirtualList coarse-pointer row-height dev warning
- [x] Article TOC sheet/popover trigger below 1200; code block overflow fade
- [x] Agent-chat `visualViewport` keyboard inset (`--vx-keyboard-inset`); drop the playground dvh clamps
      **Left behind:** Three parallel `@implementer` workers on disjoint file groups (`data/**`,
      `content/**`, `agent-chat/**` + playground demo pages), then `/review` (sideclaw, high-signal —
      4 blocking, 15 improvements, 2 discussions). All 4 blocking fixed by the orchestrator directly:
      (1) the fold-disclosure toggle's click bubbled into `onRowActivate` — `stopPropagation` added;
      (2) column fold was gated on `maxHeight || minWidth` (`scrolls`) when only `minWidth` is a
      genuinely declared horizontal floor — `maxHeight`-only tables (the sticky-header pairing this
      package's own docs recommend) were silently exempt from folding and still scrolled; regated on
      `foldEligible = minWidth === undefined`, with a new DOM sub-branch so a `maxHeight`-only table
      still gets its own `ScrollArea` scrollport (vertical) INSIDE the fold's measuring wrapper
      (horizontal) — required rewriting two now-stale tests (`data-table-containment.test.tsx`,
      `data-table.test.tsx`) that asserted the old never-folds/flat-DOM shape for that combo;
      (3) `expandedFoldRows` keyed on the TanStack default row id (index in `data`) leaked across the
      table's lifetime and could pre-expand a different record after a manual-pagination page turn —
      reset on `data` reference change; (4) `AgentDemoPage`'s dropped 360px keyboard floor assumed its
      hand-rolled composer inherits the new `useKeyboardInsetRef` fix — it doesn't (no `Composer`
      import) — floor restored there specifically, `ThreadsPage` (real `Composer` via
      `ThreadWorkspace`) correctly keeps it dropped. 5 of 15 improvements also fixed same-session:
      the TOC Popover trigger was DOM-ordered before `.content` so CSS Grid's auto-placement cursor
      seated it in its own (short, non-sticky) row instead of sharing `.content`'s tall one — moved
      after, mirroring `.tocRail`'s position; `tocOpen` wasn't reset when `showTocRail` flips, so
      resizing back below 1200px could remount the Popover already open — reset via the
      adjust-during-render pattern (a ref comparison, not an effect); `Composer`'s
      `paddingBottom: 'var(--vx-keyboard-inset)', ...style` let a consumer's own `style.paddingBottom`
      silently disable keyboard pinning — composed via `calc()` instead; the overflow-fade measurement
      in `CodeBlock` used `useEffect` (one-frame flash of an unmasked too-wide block) while the
      sibling `useColumnFold` uses `useLayoutEffect` — aligned. **Deferred, not fixed:** the remaining
      10 improvements (a `useColumnFold`/`useMeasuredContainment` `ResizeObserver`-bootstrap dedup;
      whether column-fold being default-on with no `columnFold={false}` opt-out is acceptable for
      1.x — human call; `columnLabel` falling back to the raw column id for non-string headers vs the
      docs' "label/value pairs" claim; a genuine but narrow edge case where the CSS
      `@media (max-width: 1200px)` and the JS `useSizeClass() === 'expanded'` both evaluate true at
      EXACTLY 1200px, so neither the rail nor the trigger is reachable at that one pixel width — fixing
      it needs either a shared epsilon-adjusted breakpoint or a JS read of the exact same query CSS
      uses, deferred as a 1px-wide edge case; a controlled `columnVisibility` with no
      `onColumnVisibilityChange`; `--vx-keyboard-inset` duplicated as a string literal in two files;
      a hardcoded `2.75rem` fold-toggle cell width duplicating the `FOLD_TOGGLE_WIDTH = 44` JS
      constant; a redundant `setBodyRef` wrapper; a `columnDefId` type assertion vs a type guard) —
      and 2 discussions (`data-table.tsx` at 2016 lines, past the point a `data-table-fold.ts`
      extraction would pay for itself; the same column-fold-default-on question from a different
      angle). `fallow` also flagged an unlisted `@testing-library/react` dependency in
      `apps/playground/package.json` — verified false positive: it's root-hoisted in this Bun
      workspace and 98 existing files already import it the same way, pre-dating this wave. Gate:
      `make verify` green (build, `bun run pre` 4742/4742 pass + 1 pre-existing skip
      (`ai-sdk-transport.test.ts:339`), layout 120/120, pack-test passed, budgets 396/400 · 750/750 ·
      2464/2480 — all unchanged from wave 9 except spec prose). Two commits (basalt-ui package
      separate per convention): `ad08847` (package), `4355ef6` (playground + docs).

## Wave 11 — Guards, distill, final critic <!-- status: active -->

- [ ] Legend density in short cards (wave 8 finding): in a card < 240px tall the legend gets at most one
      row and folds to dots / the `All N` chip before it takes plot height; fixes `/charts` Primitives
      Availability + Negotiated link speed (< 0.40). Re-measure: record medians vs the 0.55 target
- [ ] `basalt/raw-breakpoint` oxlint rule + `raw-media-query` CSS guard kind; migrate playground
      SimpleGrids to WidgetGrid; `.oxlintrc.json` levels match `configs/oxlint.json`
- [ ] Full recapture (`capture.mjs`) + a screenshot critic pass at 375/768/1024/1440, landscape 812×375;
      fix P0/P1 regressions
- [ ] Distill RESPONSIVE-SPEC into DESIGN-CORE / CHARTS-SPEC / the shipped `basalt-*` rules within
      budgets; update `docs/STATUS.md` and `MATURATION-LEDGER.md`; delete `docs/waves/`
- [ ] Stop: hand back to the human for PR (`/pr`) and release. Do not merge or release
      **Left behind:**
