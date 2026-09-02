# Aside Spec — archetypes, proposal detail, waves (2026-09-02)

> Archived 2026-09-02 — lifted from `docs/ASIDE-SPEC.md` §1/§3/§4 to keep the live spec to its
> doctrine (§0) and evidence ledger (§2). Historical execution record: archetypes are reference
> material for the original design pass, the proposal sketch is now shipped API (read the source
> for the current shape), and the waves table is a changelog. Not maintained.

## 1. Archetypes (from the reference screenshots)

| Archetype          | Reference                   | Rows                                                                                                                | basalt today                                              | Gap                                                                                                   |
| ------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Facet filter panel | Foundry "Shipments Filters" | mono micro group label · checkbox rows with count + proportional bar · a search select · a range histogram          | `MultiSelectFilter` (pill), `Bars`                        | no `FacetList` control (counts + bars bound to `field.multi`); no panel-width histogram kind (G6)     |
| Inspector          | Photomator / Lightroom      | collapsible group with a header switch · label-above slider rows with a mono readout · tinted section chrome        | `Section` (collapsible, persisted), raw `Slider`/`Switch` | no inspector row primitive (G4); `field.number` carries no `step` (G7); no header-switch on `Section` |
| Config panel       | Foundry time-series search  | segmented tri-state rows · labelled token chips · disclosure rows `> Automations` · a dependency list at the bottom | `ToggleFilter`, `SelectFilter` in a `Section` body        | controls in a section BODY are outside every home and no guard sees it (G5)                           |

## 2. Evidence — the CBBI page ledger

Verbatim from the implementer's return on 2026-08-28; file:line in `apps/playground/src/demo/cbbi/`.

| Id  | Finding                                                                                                                                                                                                                                                                                                                                            | Done instead                                                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | No log y-scale in the chart layer (`AxisConfig` linear-only, `CartesianChart` → `scaleLinear`) — CLOSED: `AxisConfig.scale: 'log'` shipped (`CartesianChart.tsx`), 1-2-5 tick law via `logTickValues`/`niceLogDomain` (`charts/layout/log-ticks.ts`), `/cbbi` consumes it through a scale filter (`CbbiPage.tsx`) instead of a hand-rolled `log10` | plotted `log10(price)`, inverted in the tick formatter; ticks land on unround dollars — superseded, kept for provenance                                                                                                                               |
| G2  | `DualPanel` cannot express price-over-confidence: bottom pane is a signed histogram, no 0..1 line, no zones, no log top                                                                                                                                                                                                                            | two stacked `ChartCard`s sharing the page cursor (`CbbiPage.tsx:385`)                                                                                                                                                                                 |
| G3  | Zones and multi-series are split across kinds (`ZonedLine` = one series, `MultiLine` = zones)                                                                                                                                                                                                                                                      | `MultiLine` for official + reweighted, `ZonedLine` for small multiples                                                                                                                                                                                |
| G4  | Panel rows cannot be side-by-side at ~260px (label + switch + slider + readout → ~90px track, < 12px per step)                                                                                                                                                                                                                                     | every metric row is label-above, two lines (`CbbiPanel.tsx:9`)                                                                                                                                                                                        |
| G5  | Controls outside a home have no law and no guard: basalt controls in a `Section` body pass `control-outside-home` because it only matches raw Mantine tags                                                                                                                                                                                         | used them, no waiver needed — the finding (`CbbiPanel.tsx:13`)                                                                                                                                                                                        |
| G6  | A cartesian chart at panel width is a different chart: 20 `Bars` at 260px → ~13px slots, colliding ticks                                                                                                                                                                                                                                           | kept verbatim to make it visible (`CbbiPanel.tsx:19`)                                                                                                                                                                                                 |
| G7  | `field.number` republishes `min`/`max` but no `step`                                                                                                                                                                                                                                                                                               | shared const at the `Slider` (`cbbi-store.ts:27`)                                                                                                                                                                                                     |
| G8  | `BarAction` has `onClick` / `link` / `Anchor` but no `href` — an external destination cannot be declared                                                                                                                                                                                                                                           | secondary with `window.open` (`CbbiPage.tsx:142`) — the pseudo-action was deleted 2026-08-30 (the About anchor is the link); the gap stays open with no consumer asking for `href`                                                                    |
| G9  | `basalt-ui/query` re-exports hooks but no result types                                                                                                                                                                                                                                                                                             | type-only import from `@tanstack/react-query` (`cbbi-query.ts:15`)                                                                                                                                                                                    |
| G10 | Playground mounts no app-wide `QueryClientProvider`                                                                                                                                                                                                                                                                                                | page-local client, recreated per route mount (`CbbiPage.tsx:110`)                                                                                                                                                                                     |
| G11 | Spacing is inconsistent across tiers: `Section`, `StatCard`, `ChartCard` each own their inset, panel rows own none; no vertical-rhythm token, `gap={14}` pinned by hand                                                                                                                                                                            | `gap="sm"` — the theme scale, no 14px token exists by design. The hand-pinned `14` is gone from every playground page (12 sites); the panel rows own their own inset now (`--vx-space-row-inset-y`), so the page half of G11 is a token, not a number |
| G12 | Below `sm` the two-column `Flex` needs `align={{ base: 'stretch', sm: 'flex-start' }}` or both columns shrink to content width; undocumented                                                                                                                                                                                                       | one line that decides the mobile layout (`CbbiPage.tsx:233`)                                                                                                                                                                                          |
| G13 | Panel width is a raw `300` + `flexShrink: 0`; no aside token, no region, no min-width floor — at ~640px main is narrower than the panel                                                                                                                                                                                                            | (`CbbiPage.tsx:261`)                                                                                                                                                                                                                                  |
| G14 | Membership of ONE key in a `field.multi` has no bound control: no `MembershipToggle`, and `field.multi` publishes no `has`/`toggle` handle, so the include switch on a composition row writes the whole array by hand — and `Switch` is not in the guard's raw tag set, so no lane sees it                                                         | raw `<Switch>` in the row's `end`, wired to `setEnabled(kept)` (`CbbiPanel.tsx:135`)                                                                                                                                                                  |

G1–G3 and G8–G10 are chart/battery gaps the page surfaced and belong to their own modules; the
aside effort proper is G4–G7, G11–G13 and G14.

## 3. Proposal (sketch — API to be settled against a second consumer)

```ts
// BasaltShell — the region. Off by default; a route opts in by rendering <PageAside>.
aside?: { width?: number /* default 300 */; min?: number /* main column floor, G13 */; storageKey?: string }

// Route level — portalled into AppShell.Aside, symmetric to PageBar row 1. One per page.
<PageAside title="Filters" persistKey="cbbi">           // fold at basalt:aside:<key>
```

**`aside.width`/`aside.min` above are not built, on purpose — not a gap.** The shipped shell
(`src/shell/index.tsx` ~:391) hard-codes the width off the density-derived step tokens
(`step.appShellAsideWidth`/`appShellAsideRailWidth`) with no `BasaltShellProps` prop for either
number, "the same way it decides its page bar" — the ROUTE, not a shell prop, owns the region's
size, so there is no main-column floor to configure. `Histogram` and `MembershipToggle` (wave 3,
§4) are genuinely unbuilt, not deferred-by-shell-design: both wait on a second consumer page (argo)
exercising the aside, per §0's evidence-first sequencing — neither has a call site yet.

```ts
  <Section title="Composition">
    <PanelRow label="Pi Cycle Top" hint="…" readout={ratio(v)}>       // label-above, 2-line, mono readout (G4)
      <SliderControl field={w.PiCycle} label="Pi Cycle Top" />        // ctl tier, step from the field (G7)
    </PanelRow>
  </Section>
  <Section title="Origin">
    <MultiSelectFilter field={store.field.origin} label="Origin"      // checkbox · count · bar (Foundry)
                       counts={countsByOrigin} />
  </Section>
  <Section title="Distribution">
    <Histogram data={bins} />                                         // panel-width kind: no axes, sparse ticks (G6)
  </Section>
</PageAside>
```

- The row primitive is **`PanelRow`**, not `AsideRow`: it is the `panel` SURFACE's row and it is
  legal in a section body anywhere, so naming it after the region it was drawn for would have been
  the narrower of the two truths.
- There is no separate **`FacetList`** export. The counted, barred checkbox list is
  `MultiSelectFilter`'s panel form, reached with `counts` (+ `max`, default 6, past which the rest
  fold behind `Show N more`) — a list of counted checkboxes not bound to a `field.multi` is a
  hand-rolled filter, so the counts are a prop on the control that already owns the set.
- `PageAside`'s body IS a home: it mounts its children under `FilterSetScope surface="panel"`
  (registry `null` — no census, no `Filters (n)`, no `Reset all`), and `PanelRow` wraps its own
  slots in `CtlSlot`, so nothing inside carries a `size` (C5, closes G5 for the row case).
  the `Section`-body branch shipped in wave 4 as its OWN id,
  `basalt/bound-control-outside-home` (a level is per-id, C16 — widening `control-outside-home`
  would have landed the new form at that rule's level with no grace of its own).
- `field.number` gained `step` — resolved ONCE, in `field.number` (`int: true` with no `step`
  implies `1`), and republished on the handle beside `min`/`max`/`int`. `SliderControl` is the bound
  control (C2), `ctl` tier, and the one control that is a row on every surface.
- **`Section.switch` was NOT built.** The header switch is expressible today as
  `<Section actions={<ToggleFilter … />}>` through the existing slot, and a second, differently
  shaped control prop on `Section` would be a fourth home in all but name (C1).
- Spacing: `Section` inside an aside is flush — the aside `.body`'s own `> * + *` rule draws the
  hairline and the rhythm, because `Section` cannot know where it is mounted and a body child is
  not necessarily a `Section` at all. `Section` inside the aside renders at `WidgetHeader
tier="group"` (mono micro-label, `h3`) with a zero-gap row body — resolved from the `panel`
  surface, no prop (`docs/CONTROLS-SPEC.md` §2.2).
- Mobile: below `sm`, **with a `PageBar` that renders a row 2**, the aside projects into that row —
  one `Panel` pill (a funnel-less sidebar-right glyph) opening a `FilterSheet` titled with the
  aside's `title`, whose children mount under `surface="sheet"`. Metadata travels through the
  page-bar context; the CHILDREN portal into the sheet, so there is exactly one node at a time (C9)
  and no `ReactNode` in context state. With no row 2 to hang the pill off — and in a shell-less app
  — wave 1's in-flow rendering stays.
- Not in scope: a resizable split, a left-side aside, more than one aside per page.

## 4. Waves

| Wave                      | Delivers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Gate                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| 0                         | this page, this document                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `bun run pre` green — done                                            |
| 1                         | `aside` region + `PageAside` portal + persisted fold + in-flow mobile stacking — **delivered**                                                                                                                                                                                                                                                                                                                                                                                                               | `/cbbi` drops `PANEL_WIDTH`, `flexShrink`, the `align` line (G12/G13) |
| 2                         | `panel` surface + `PanelRow` + `SliderControl` + `field.number.step` + `MultiSelectFilter` counts/max + flush aside chrome + mobile sheet projection — **delivered, and `/cbbi` migrated onto it**: the nine composition rows are `SliderControl`s (`readout`/`end` overrides carry the reading and the include switch), `Presets`/`Diagnostics`/`Today` are `PanelRow`s over runtime-computed data, `Display` resolves its own `panel` form, and every `gap={14}` under `apps/playground/src` is `gap="sm"` | `/cbbi`'s panel has zero raw Mantine controls (G4/G5/G7/G11) — met    |
| 3                         | `Histogram` panel kind · `MembershipToggle` over one key of a `field.multi`, off a `has`/`toggle` handle on the field (G14) — **not built, on purpose**: both gate on §0's evidence-first sequencing and have no call site until a second consumer page adopts the aside, not on any technical blocker                                                                                                                                                                                                       | a second consumer page (argo) on the aside                            |
| 4                         | guards — `basalt/bound-control-outside-home` (the section-body branch as its OWN id, warn 1.28.0 → 1.30.0) + agent rule `basalt-controls.md` §aside — **delivered**; `aside-budget` not built (no measured incumbent) and `MIGRATING.md` untouched (nothing renamed)                                                                                                                                                                                                                                         | promote per C16                                                       |
| chrome round (2026-08-30) | region seams, 48px bands, head-font title, group tier, one-home rule on `/cbbi`                                                                                                                                                                                                                                                                                                                                                                                                                              | `/cbbi` desktop+mobile screenshots signed off                         |
| seam fix (2026-09-02)     | the aside header's height tracks `--basalt-page-bar-h` instead of a fixed 48px, closing the band/header seam into one line — **delivered**                                                                                                                                                                                                                                                                                                                                                                   | `/cbbi` band bottom y = aside header bottom y at 1440x900 — met       |
