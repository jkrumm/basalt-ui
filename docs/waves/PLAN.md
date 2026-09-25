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

## Wave 2 — Foundations: the three-axis law <!-- status: active -->

- [ ] Tokens: `SIZE_CLASSES` + `CONTAINER_CLASSES` tables; derive `theme.breakpoints` from them (not
      overridable); `breakpoint-literals.test.ts` pins every CSS literal (spec §1)
- [ ] `useSizeClass()` (useSyncExternalStore) + `BasaltProvider sizeClassHint`; migrate the three
      JS viewport reads (incl. ThreadWorkspace first-frame flash); put `useBreakpoint` on notice in
      MIGRATING.md
- [ ] `--vx-hit` + the `[data-basalt-hit]::after` primitive; collapse
      `spaceTouchTarget`/`touchControlHeight`/width-keyed floors into it; `mobileNavRowHeight` 44;
      update density tests
- [ ] `data-basalt-host` on `<html>` from BasaltProvider; move `display-mode` CSS onto it
- [ ] Rewrite `DESIGN-CORE.md` §2 ¶1 as the three-axis law (fix the WCAG citations), offset by cuts
      **Left behind:**

## Wave 3 — Shell: compact / medium / expanded <!-- status: pending -->

- [ ] Shell size classes: bottom bar < 840, rail + overlay aside 840–1199, full sidebar ≥ 1200 with
      the aside docked only while main ≥ 720; persisted state distinguishes unset from explicitly false
- [ ] PageBar row-1 fold by measured width (reuse useTrackFits); icon-less secondaries fold
- [ ] Public shell bottom inset (`--app-shell-footer-offset`); toasts above the tab bar + safe area
- [ ] Landscape-phone compact header/bottom bar
- [ ] `no-horizontal-overflow.layout.test.ts` at 375/768/1024/1440; shots before/after
      **Left behind:**

## Wave 4 — Touch tier <!-- status: pending -->

- [ ] Adopt `[data-basalt-hit]` in every interactive primitive: the C1 homes, SettingsRow/FormRow
      control slot, InfoGlyph, DataTable pagination (into CtlSlot) + selection cell, legend toggles,
      mobile nav; migrate width-keyed touch `@media` rules to the pointer axis
- [ ] Hover-reveal gates in `./content` (copy button, permalinks) and any row actions
- [ ] Modal / `overlays.confirm` as a bottom sheet at compact with full-width `--vx-hit` actions
- [ ] `hit-floor.layout.test.ts` (≥ 44×44 under hasTouch on every playground route)
      **Left behind:**

## Wave 5 — Card chrome by container <!-- status: pending -->

- [ ] `container: basalt-card` on ChartCard/StatCard/Section/WidgetHeader; header rules → `@container`
      per the container-class table; subtitle → info glyph at compact; wide puts value on the title row
- [ ] KPI value never ellipsizes (cqi clamp, delta wraps first); StatGroup 1 col < 260px
- [ ] ChartCard flex column + body flex:1 (charts grow into stretched rows); internal legend slot via
      context (no new export)
- [ ] Before/after shots of /dashboard, /dashboard/revenue, /cbbi at all three viewports
      **Left behind:**

## Wave 6 — Chart layout law: resolver, axes, height <!-- status: pending -->

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
