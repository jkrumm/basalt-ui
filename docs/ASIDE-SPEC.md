# Aside Spec — the right-hand panel region

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
- **Desktop and mobile are one declaration.** ONE `PageAside`, one node: from `sm` up it portals
  into `AppShell.Aside`, below `sm` it renders in flow where the page wrote it — never a second
  tree (C9). Wave 1 stops there; the `Panel (n)` pill in `PageBar` row 2 opening those children as
  44px `FilterSheet` rows (C15) is wave 2, and it replaces the in-flow stacking rather than adding
  a second mount.
- **`PageAside` is law C9's ONE declared exception, and the viewport read stays in JS.** Every
  other responsive twin in the package is CSS (`visibleFrom`/`hiddenFrom` in `controls/actions.tsx`,
  `controls/view-tabs.tsx`), because there the two halves are two renderings of one stateless
  control. Here they are not: the desktop form lives inside `AppShell.Aside` and the phone form
  inside a `FilterSheet` whose Drawer unmounts its body when closed — two portal targets, never one
  node CSS could reposition between them — and the two mount their children under DIFFERENT filter
  surfaces (`panel` vs `sheet`), a React context value no CSS media query can express. A CSS-only
  twin would therefore have to render the children TWICE, and an aside's children are stateful:
  every bound control in there would subscribe to its field twice. **Single-mounting a stateful
  panel beats a CSS twin**, so the query is read through `useSyncExternalStore` — the one hook
  whose server snapshot React honours during both `renderToString` and hydration, so SSR, the
  hydration pass and the first client paint agree on which single node exists. Two consequences are
  pinned by `packages/basalt-ui/tests/layout/page-aside.layout.test.ts` in real Chrome: exactly one
  LIVE child subtree at 1440 and at 390, and exactly one MOUNT of it at each. The second half is
  why the in-flow branch inside a shell waits one commit — `PageBar` publishes its row-2 claim from
  a layout effect, so the pre-claim pass used to render the wave-1 in-flow form, mount the aside's
  children and drop them again before paint (measured: 2 mounts for one sheet).
- **Evidence first, then spec, then guards** — the same sequence as the controls effort. Nothing
  in §3 ships until §2 has a second data point (argo or linewatch) beside CBBI.
- The aside's leading edge is the REGION's seam (`AppShell.Aside`, `--vx-divider`), never the
  panel's; the panel paints only the page background. Its header is an `appShellHeaderHeight` band
  carrying the title in the head font (`--vx-text-md`/550 ink) — the title names the CONTENT
  (`"Composition"`), never the region (`"Panel"`).
- **The header's height tracks the shell's page-bar band, not a fixed 48px** (chrome round
  2026-09-02): `min-height` reads `--basalt-page-bar-h` first (`PageBar` row 2's measured height,
  published on `documentElement` — `shell/page-bar.tsx`) and falls back to `appShellHeaderHeight`
  only on a route with no `PageBar`, where there is no band seam to align to. MEASURED on `/cbbi`
  1440x900 before the fix: the band's own bottom seam sat at y87 while the header's — pinned to a
  bare 48px regardless of the band's real height — sat at y96, two hairlines nine pixels apart. The
  `+ 1px` in `page-aside.module.css`'s `min-height` calc is load-bearing, not decorative: the
  published var measures the band's row-2 CONTENT box only, while the band's own `border-bottom` is
  drawn OUTSIDE that box on an unconstrained `height: auto` element — this header is the opposite
  shape (an explicit `min-height` under the page's `box-sizing: border-box` reset, which absorbs its
  own border INSIDE the declared height), so the raw var undershoots the band's painted edge by
  exactly that border. The same `+ 1px` wraps both branches of the var/fallback, so the no-band
  case still nets out at the unchanged 48px.
- A `PageAside` child list IS the group list — no wrapper `Stack`; the body's `> * + *` rule draws
  the rhythm between direct children only.
- **The one-home law**: the bar owns what is READ — view, window, sync — and the aside owns how it
  is DRAWN and what it is MADE OF (scale, bucket, layout, bands). One home per field per viewport;
  a field bound in two homes on one viewport is a twin, C9's sibling for the bar/aside pair rather
  than the visibleFrom/hiddenFrom pair C9 already covers. A `basalt/field-bound-twice` guard is a
  wave-4 candidate — `warn` with a dated `promote` per C16 — and waits for the second consumer
  (this section's evidence rule) before it lands.

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

> §1 (archetype reference), §3 (proposal sketch — now shipped API) and §4 (waves changelog) are
> archived: `docs/archive/ASIDE-SPEC-DETAIL.md`.
