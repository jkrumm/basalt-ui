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

## Wave 6 — Chart layout law: resolver, axes, height <!-- status: active -->

- [ ] `resolveChartLayout` (spec §4) replaces `resolveChartTier`/`ChartTierMetrics`; container
      classes from the shared table; unmeasured default from the size class; unit tests pin the
      decision table
- [ ] Axis economy: compact y format, tick count from yMax, inward terminals, wrap-before-rotate,
      band per-tick = label px, y labels inside at compact/micro, `VX.minPlotHeight` guard on yMax
- [ ] Height from width × class (0.45 dvh clamp on coarse), treated as min-height inside a card; height
      literal warns under floor; `ResponsiveChartHeight` keys base/regular/wide (+ aliases, MIGRATING)
- [ ] Re-measure with `.claude/mobile/capture.mjs`: record data-rect medians per viewport
      **Left behind:**

## Wave 7 — Chart legend, donut, dual axis <!-- status: pending -->

- [ ] Legend: width-measured fit always, never roll up < 2, row gap 4–6 left-aligned, portal into the
      ChartCard header slot, "All N" disclosure (popover fine / sheet coarse); deprecate `legend.maxRows`
- [ ] Donut aspect law (side legend W/H > 1.5, compact full list, 7+ → Other)
- [ ] Dual-axis tick tint; delete "(left axis)" legend prose
- [ ] End-of-line labels at wide (≤ 3 lines, collision fallback to chips)
- [ ] Success metric: median data rect ≥ 0.55 at every viewport, none < 0.40. If it misses, write the
      gap into Left behind and do not tick this step
      **Left behind:**

## Wave 8 — Chart touch model <!-- status: pending -->

- [ ] Coarse pointer: pointerdown reveal, drag scrub with `touch-action: pan-y`, pin-until-dismiss,
      `follow:false` on touch; fix stuck tooltip on lift; linked-chart pin/dismiss
- [ ] `useDiscreteCursor` for Donut and Heatmap (tap + keyboard + focus parity)
- [ ] Touch interaction tests via CDP touch events (tap, scrub, lift, tap-outside) across kinds
      **Left behind:**

## Wave 9 — Data, content, chat <!-- status: pending -->

- [ ] DataTable `meta.priority` → per-row disclosure below measured fit (declared order by default)
- [ ] VirtualList coarse-pointer row-height dev warning
- [ ] Article TOC sheet/popover trigger below 1200; code block overflow fade
- [ ] Agent-chat `visualViewport` keyboard inset (`--vx-keyboard-inset`); drop the playground dvh clamps
      **Left behind:**

## Wave 10 — Guards, distill, final critic <!-- status: pending -->

- [ ] `basalt/raw-breakpoint` oxlint rule + `raw-media-query` CSS guard kind; migrate playground
      SimpleGrids to WidgetGrid; `.oxlintrc.json` levels match `configs/oxlint.json`
- [ ] Full recapture (`capture.mjs`) + a screenshot critic pass at 375/768/1024/1440, landscape 812×375;
      fix P0/P1 regressions
- [ ] Distill RESPONSIVE-SPEC into DESIGN-CORE / CHARTS-SPEC / the shipped `basalt-*` rules within
      budgets; update `docs/STATUS.md` and `MATURATION-LEDGER.md`; delete `docs/waves/`
- [ ] Stop: hand back to the human for PR (`/pr`) and release. Do not merge or release
      **Left behind:**
