# Aside Spec — the right-hand panel region _(DRAFT, 2026-08-28 — nothing here is built)_

A persistent right-hand column in `BasaltShell` for the three things a page bar cannot hold: a
faceted filter panel (Foundry), a grouped inspector of sliders/switches/selects (Lightroom,
Photomator), and a stack of panel-width charts (histograms, facet bars). Evidence is
`apps/playground/src/demo/cbbi/` (route `/cbbi`, live CBBI data), whose gap ledger is §2 — ids
G1..G13 are cited below, not restated. Extends `docs/CONTROLS-SPEC.md`; laws C1–C16 stay in force.

## 0. Doctrine

- **The aside is a fourth shell REGION, not a fourth control home.** C1 keeps three homes. The
  aside hosts them: `Section` headers (home 2) and inspector rows (home 3, `SettingsRow`'s
  narrow form). A filter inside the aside is still a `FieldHandle`-bound basalt control (C2/C3).
- **This reverses the Phase-5 kill-list entry `appshell-aside-slot`** (`docs/STATUS.md` §deferred,
  `docs/archive/MATURATION-ROADMAP.md:167`). Its rationale was "do not freeze the API of an
  _unforced_ surface" — the surface is now forced by an owner request and a page that needed it
  (G5, G11, G13). The invariant is honoured, not broken.
- **Desktop and mobile are one declaration.** Below `sm` the aside IS the existing bottom
  `FilterSheet`: one `Panel (n)` pill in `PageBar` row 2 opens it, sheet rows are 44px (C15). The
  aside is the ≥ `sm` projection of that sheet, never a second tree (C9).
- **Evidence first, then spec, then guards** — the same sequence as the controls effort. Nothing
  in §3 ships until §2 has a second data point (argo or linewatch) beside CBBI.

## 1. Archetypes (from the reference screenshots)

| Archetype          | Reference                   | Rows                                                                                                                | basalt today                                              | Gap                                                                                                   |
| ------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Facet filter panel | Foundry "Shipments Filters" | mono micro group label · checkbox rows with count + proportional bar · a search select · a range histogram          | `MultiSelectFilter` (pill), `Bars`                        | no `FacetList` control (counts + bars bound to `field.multi`); no panel-width histogram kind (G6)     |
| Inspector          | Photomator / Lightroom      | collapsible group with a header switch · label-above slider rows with a mono readout · tinted section chrome        | `Section` (collapsible, persisted), raw `Slider`/`Switch` | no inspector row primitive (G4); `field.number` carries no `step` (G7); no header-switch on `Section` |
| Config panel       | Foundry time-series search  | segmented tri-state rows · labelled token chips · disclosure rows `> Automations` · a dependency list at the bottom | `ToggleFilter`, `SelectFilter` in a `Section` body        | controls in a section BODY are outside every home and no guard sees it (G5)                           |

## 2. Evidence — the CBBI page ledger

Verbatim from the implementer's return on 2026-08-28; file:line in `apps/playground/src/demo/cbbi/`.

| Id  | Finding                                                                                                                                                                 | Done instead                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| G1  | No log y-scale in the chart layer (`AxisConfig` linear-only, `CartesianChart` → `scaleLinear`)                                                                          | plotted `log10(price)`, inverted in the tick formatter; ticks land on unround dollars (`CbbiPage.tsx:288`) |
| G2  | `DualPanel` cannot express price-over-confidence: bottom pane is a signed histogram, no 0..1 line, no zones, no log top                                                 | two stacked `ChartCard`s sharing the page cursor (`CbbiPage.tsx:385`)                                      |
| G3  | Zones and multi-series are split across kinds (`ZonedLine` = one series, `MultiLine` = zones)                                                                           | `MultiLine` for official + reweighted, `ZonedLine` for small multiples                                     |
| G4  | Panel rows cannot be side-by-side at ~260px (label + switch + slider + readout → ~90px track, < 12px per step)                                                          | every metric row is label-above, two lines (`CbbiPanel.tsx:9`)                                             |
| G5  | Controls outside a home have no law and no guard: basalt controls in a `Section` body pass `control-outside-home` because it only matches raw Mantine tags              | used them, no waiver needed — the finding (`CbbiPanel.tsx:13`)                                             |
| G6  | A cartesian chart at panel width is a different chart: 20 `Bars` at 260px → ~13px slots, colliding ticks                                                                | kept verbatim to make it visible (`CbbiPanel.tsx:19`)                                                      |
| G7  | `field.number` republishes `min`/`max` but no `step`                                                                                                                    | shared const at the `Slider` (`cbbi-store.ts:27`)                                                          |
| G8  | `BarAction` has `onClick` / `link` / `Anchor` but no `href` — an external destination cannot be declared                                                                | secondary with `window.open` (`CbbiPage.tsx:142`)                                                          |
| G9  | `basalt-ui/query` re-exports hooks but no result types                                                                                                                  | type-only import from `@tanstack/react-query` (`cbbi-query.ts:15`)                                         |
| G10 | Playground mounts no app-wide `QueryClientProvider`                                                                                                                     | page-local client, recreated per route mount (`CbbiPage.tsx:110`)                                          |
| G11 | Spacing is inconsistent across tiers: `Section`, `StatCard`, `ChartCard` each own their inset, panel rows own none; no vertical-rhythm token, `gap={14}` pinned by hand | as `DashboardPage` does                                                                                    |
| G12 | Below `sm` the two-column `Flex` needs `align={{ base: 'stretch', sm: 'flex-start' }}` or both columns shrink to content width; undocumented                            | one line that decides the mobile layout (`CbbiPage.tsx:233`)                                               |
| G13 | Panel width is a raw `300` + `flexShrink: 0`; no aside token, no region, no min-width floor — at ~640px main is narrower than the panel                                 | (`CbbiPage.tsx:261`)                                                                                       |

G1–G3 and G8–G10 are chart/battery gaps the page surfaced and belong to their own modules; the
aside effort proper is G4–G7 and G11–G13.

## 3. Proposal (sketch — API to be settled against a second consumer)

```ts
// BasaltShell — the region. Off by default; a route opts in by rendering <PageAside>.
aside?: { width?: number /* default 300 */; min?: number /* main column floor, G13 */; storageKey?: string }

// Route level — portalled into AppShell.Aside, symmetric to PageBar row 1. One per page.
<PageAside title="Filters" persistKey="cbbi">           // fold at basalt:aside:<key>
  <Section title="Composition" collapsible switch={field.boolean}>  // header switch (inspector archetype)
    <AsideRow label="Pi Cycle Top" hint="…" readout={ratio(v)}>      // label-above, 2-line, mono readout (G4)
      <SliderControl field={w.PiCycle} />                             // ctl tier, step from the field (G7)
    </AsideRow>
  </Section>
  <Section title="Origin">
    <FacetList field={store.field.origin} counts={countsByOrigin} />  // checkbox · count · bar (Foundry)
  </Section>
  <Section title="Distribution">
    <Histogram data={bins} />                                         // panel-width kind: no axes, sparse ticks (G6)
  </Section>
</PageAside>
```

- `PageAside`'s body is a home: `AsideRow.children` and `Section.filters` are slot props, so
  `hand-rolled-filter` and `control-size-literal` reach it (closes G5). `control-outside-home`
  gains a `Section`-body branch.
- `field.number` gains `step`; `SliderControl` is the bound control (C2), `ctl` tier.
- Spacing: one `--vx-space-stack` rhythm token replaces the pinned `gap={14}` on every page (G11);
  `Section` inside an aside drops its card inset (flush, hairline-separated — Lightroom, not cards).
- Mobile: `PageAside` renders nothing below `sm`; `PageBar` row 2 gets a `Panel (n)` pill whose
  sheet is the aside's children projected as 44px rows — the same `FilterSheet`.
- Not in scope: a resizable split, a left-side aside, more than one aside per page.

## 4. Waves

| Wave | Delivers                                                                                                                    | Gate                                                                  |
| ---- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 0    | this page, this document                                                                                                    | `bun run pre` green — done                                            |
| 1    | `aside` region + `PageAside` portal + persisted fold + mobile sheet projection                                              | `/cbbi` drops `PANEL_WIDTH`, `flexShrink`, the `align` line (G12/G13) |
| 2    | `AsideRow`, `SliderControl`, `field.number.step`, `Section.switch`, flush aside chrome, rhythm token                        | `/cbbi`'s panel has zero raw Mantine controls (G4/G5/G7/G11)          |
| 3    | `FacetList`, `Histogram` panel kind                                                                                         | a second consumer page (argo) on the aside                            |
| 4    | guards (`control-outside-home` section-body branch, `aside-budget`), agent rule `basalt-controls.md` §aside, `MIGRATING.md` | promote per C16                                                       |
