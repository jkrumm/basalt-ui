# Concept: tokens and visual language

Date 2026-11-09. Domain row "Tokens, static" of `ARCHITECTURE.md` section 8, realising its section 5. Tags: **F** run or read (cited), **J** judgement, **U** unverified. Slugs as in the digest. **S0** is the spike run for this document (Tailwind 4.3.4, Chrome via playwright-core, `file://`, no dev server, outside the repo). Nothing here has been seen on the owner's display: every hex is computed, and the eye items are in section 11.

## 1. Decision summary

1. **One table, one emitter.** `src/tokens/table.ts` is the only authored list. `emit.ts` generates `tokens.css`, the Tailwind bridge, the `VX` type, the name list for `check-tokens`, generated docs and migration rows. Colour stays HCT-derived with hex output (gap-token, self-tokens-theme).
2. **Two tiers, one truth.** `--vx-*` is plain CSS with no Tailwind or React. `--color-*` is a generated `@theme inline` projection carrying shadcn's semantic names, so stock class vocabulary keeps working on our values.
3. **220 public names become at most 90; 75 are booked** (section 3.2 is the single list; the 74 plus `input`, S3), 15 are reserve. The 99 per-component spacing vars die because Tailwind utilities do their job. App-owned names are declared, typed and not counted (3.8).
4. **Closed vocabulary.** `--color-*`, `--shadow-*`, `--radius-*`, `--text-*`, `--breakpoint-*` are reset first, so `bg-blue-500`, `shadow-lg`, `text-[13px]`-style alternatives either do not exist or are denied by lint.
5. **Four surfaces, one law against the parent:** inside a card, inset steps away from the ink; raised steps toward the light. Max depth two: `Card` holds `Inset`, and a third level is a `CardBand`, never a box.
6. **Warm ramp at HCT hue 70**, steel-to-confident blue one vibrancy step up (`#2e75b1`), three inks. The ink-inverted primary frees the blue for data.
7. **New here: app code carries no colour class.** Hue exists only inside primitives with a closed `tone`, the `link` utility, and chart data. That turns "colour must earn its place" from prose into `tw-off-law` plus type absence, with the denial generated from the table (section 3.5).
8. **One status word per tone.** `good`, `warn`, `bad`, `info` are ink solved to 4.5:1 on every text surface and on their own tint. The 2.x `status-*`, `*-solid`, `*-soft`, `*-ref` families collapse; chart marks and zones read the same word (3.5, sixth reason).
9. **Density is two variables, never the spacing unit:** `--spacing` stays `.25rem`; `data-density` moves `--vx-ctl-h` and `--vx-row-h`, at `<html>` or any subtree (S0). **Radius has no knob in 3.0.** Four emitted values; zero consumers used the 2.x knob (self-tokens-theme 3.4). The owner's pick edits the table. **The ladder is rem-valued** so a user's browser font size still scales type and control height (S0: root 20 px gives `text-sm` 16.25 px, `h-ctl` 35 px).
10. **What this fixes beyond the swap:** a card step that actually reads (.037 vs today's .016 OKLCH L), hand-written bridges retired (rollhook x2, console), silent value shifts made a release failure, and the accent/`accent` word collision removed.

## 2. Problem map

| Problem                    | Library@version, wiring                                                                          | IMPLEMENT                                                                                                         | GUARANTEE                                                                                                                                            | TEACH                                                   | LEAVE OPEN                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| Source of truth            | Own HCT, 0 deps (`hct.ts`, `oklab.ts`, `derive.ts`, `status-text.ts` kept)                       | `table.ts`: name, role, `{light,dark}` or scalar, bridge target, 2.x `from`                                       | `check-tokens` over `.css`, `.tsx`; `tokens:css --check`; emitter refuses a failing config                                                           | Change the look through config, never a value           | Seed, neutral, vibrancy                                |
| Tailwind bridge            | tailwindcss 4.3.5 (spikes 4.3.4), `@tailwindcss/vite`; `@theme inline` colours, `@theme` scalars | Generated `tailwind.css`, order per contract section 5                                                            | Bridge drift tests: every target emitted, resets precede definitions                                                                                 | Never hand-write `@theme`; rollhook's bridge is retired | Extra semantic colours via inline bridge onto `--vx-*` |
| shadcn names               | shadcn 4.23.0 base-nova vocabulary, no shadcn CSS import                                         | Name map section 3.2                                                                                              | `--color-accent` never the blue; `no-unknown-classes` (F7)                                                                                           | `brand` is the blue, `accent` is hover                  | Nothing                                                |
| Warm-gray image            | Own derive; neutral presets `warm`, `neutral`, `cool`                                            | Four roles, three inks, `hairline`, per-scheme chroma                                                             | Inks >=4.5 on canvas, inset, card; card vs inset >=.03 L                                                                                             | Pick a surface role, never a number                     | Preset; DPO 5 tones                                    |
| Nested surfaces            | No library; `ui/card`                                                                            | `Card`, `CardBand`, `Inset`, `IconTile`, `data-surface`, `--vx-surface`                                           | Dev assertion at depth >2 (contract 7.2); one shared left edge in layout suite; `no-restyle` denies padding                                          | Band, not box; no box in box                            | Card content                                           |
| Professional blue, primary | Own derive, fill band Y=.165                                                                     | `brand` ink solved per scheme, `brand-fill` band, `primary` = ink                                                 | `primary` type is ink; brand ink >=4.5 on canvas, inset, card; fill >=3.0 on canvas, inset                                                           | Blue is data, ink is action                             | Seed, vibrancy                                         |
| Status colour              | `status-text.ts` solver, extended tint-aware                                                     | `good`, `warn`, `bad`, `info` + `-tint`                                                                           | >=4.5 on surface and own tint; tone closed union                                                                                                     | Dot + label over pills; tone from a map, never a word   | Domain-to-tone mapping                                 |
| Earned colour              | Tailwind closed theme + oxlint 1.93.0 + @shadcn/lint 0.2.5                                       | No colour prop on chrome; primitives carry `tone`; zone A denial generated from `table.ts`                        | `tw-off-law` (zone A, fills and text), `status-fill-as-text`, `fixed-colour`, `dark-fork`, `colour-literal`, `highlight` single, `polarity` required | Six reasons, two misuse tests                           | Series colours                                         |
| Density                    | Fixed `--spacing`, `@utility h-ctl`, `min-h-row`, `size-ctl`, `size-icon`                        | `data-density` dense/normal/comfortable, on `<html>`                                                              | `no-restyle` denies `h-*`, `size-*`; `tw-off-law` ladder (integer, `.5` below 4); `app-spacing`                                                      | Density moves controls and rows, not gaps               | App's notch                                            |
| Radius, ring, shadow       | Tailwind `--radius-*`, `--shadow-*`                                                              | 14/10/8/5, `hairline` ink mix, asymmetric raised shadow                                                           | Stylelint + `no-restyle`; one of seam, ring, edge per surface (`check-tokens`)                                                                       | Depth is surface steps                                  | Nothing at 3.0                                         |
| Type                       | Tailwind `--text-*` with `--line-height`; compiled `cn` 0.5.2 (F6 may flip to `clsx`)            | Seven rem rungs                                                                                                   | `no-arbitrary-values`; coarse input computes 16                                                                                                      | Pick a rung; `text-sm` is 13                            | Fonts                                                  |
| Numerals, fonts            | `@fontsource-variable/{nunito-sans,hubot-sans,jetbrains-mono}` 5.3.0, regular deps               | `fonts.css`, Head Digits face, `Num`, `[data-numeric]`                                                            | Layout assertion on `Num` feature settings; fonts present in fixture                                                                                 | Tabular only in columns and axes                        | Family choice (fonts stay open)                        |
| Scheme                     | Own `theme-script` + `setScheme`, `@custom-variant dark`                                         | `:root[data-theme]`, read legacy key, write `basalt:scheme`, optional cookie mirror, re-apply after async restore | `dark-fork` denies `dark:` colour; doctor lints legacy selectors; golden fixture covers key, legacy, cookie                                          | One switch                                              | DPO 7                                                  |
| Retune, tenants            | `tokens:css` CLI                                                                                 | Build-time block per scope                                                                                        | Same gates run per tenant, exit 1                                                                                                                    | Config only, tenant CSS in server HTML                  | Tenant set, epos navy (DPO 16)                         |
| Static sites               | CSS entries only                                                                                 | `tokens.css`, `typography.css`, `prose.css`, `fonts.css`                                                          | Stylelint preset; `tokens` fixture has no React or Tailwind                                                                                          | Static-site reference                                   | Paper type system, layout                              |
| Email, server pages        | `tokens:css --format json`                                                                       | Resolved opaque hex per scheme; alpha mixes (hairline, hover, selected, scrim, -tint) absent, not flattened       | `--check` drift test on the share-palette fixture                                                                                                    | Mail reads hex, never `color-mix`                       | Which roles an email uses                              |
| App-owned tokens, ramps    | `src/basalt.tokens.ts`, `tokens:css --extra`                                                     | Series groups by `{hue, light, dark}` over ramps; named `vars` (3.8)                                              | `check-tokens` unions declared names; collision and dead-name reads exit 1; `series-palette` audits steps                                            | One file; shade index is rank                           | Hues, groups                                           |
| Viz tokens                 | Read by `@tanstack/charts` 1.5.0 via `VX`                                                        | `line`, `dim-bar`, `grid`, `crosshair`, `chart-1..5`, `seq-1..5`                                                  | Dim bar >=2.0, now mark >=3.0 on inset; `chart-N` on canvas and inset only; `series-palette`                                                         | Earned colour in charts                                 | Series map                                             |

## 3. The model

### 3.1 Home and pipeline

Layer 0, `src/tokens` and `src/css`, peers none, subpath only CSS entries; four value symbols in `.`: `VX`, `alpha`, `setScheme`, `cn`. `defineSeries` sits in `./charts` (charts concept). Budget: `tokens.css` is seed + 5%, full-scan CSS 12 KB gz fixture ceiling, public names 90. Line target tokens + css 1,900. Hand-rolled copies today: 6 (rollhook x2 bridges, console bridge, epos value set, jkrumm.com, shutterflow hex).
Pipeline: `table.ts` + `ramps.ts` + `derive.ts` + `status-text.ts` (authored, pure) -> `gates.ts` (contract section 5; a failure names gate, surface, ratio) -> `emit.ts` -> `tokens.css`, `tailwind.css`, `VX` types, `check-tokens` names, the zone A denial list, `docs/tokens.md`, migration rows. Emitted output is deterministic and carries the two-line provenance header that `raw-hex` keys on (self-tokens-theme d30).

### 3.2 Public names (75 of 90)

| Family                         | `--vx-*`                                                                                                                                             | n   | Tailwind projection                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------------------------------ |
| Surfaces                       | `canvas inset card raised surface`                                                                                                                   | 5   | `background`, `inset`, `card`, `popover` = raised, `surface` (current, follows nesting)                      |
| Interaction                    | `hover selected scrim`                                                                                                                               | 3   | `accent` = hover (shadcn meaning), `selected`, `scrim`                                                       |
| Line                           | `hairline input`                                                                                                                                     | 2   | `border`, `shadow-hairline`; `input` is a deliberate 52% light / 44% dark ink mix, 3:1 on every surface (S3) |
| Inks                           | `ink ink-muted ink-faint`                                                                                                                            | 3   | `foreground`, `muted-foreground`, `faint`                                                                    |
| Brand                          | `brand brand-fill on-brand`                                                                                                                          | 3   | same names; `ring` = brand                                                                                   |
| Status                         | `good warn bad info tint-pct`                                                                                                                        | 5   | same + `-tint`; `destructive` = bad                                                                          |
| Viz                            | `line dim-bar grid crosshair chart-1..5 seq-1..5`                                                                                                    | 14  | same names; `line` is the neutral data line (`VX.line` 45 reads, 3 apps)                                     |
| Shadow                         | `shadow-card shadow-raised shadow-overlay`                                                                                                           | 3   | `shadow-card`, `shadow-raised`, `shadow-overlay`                                                             |
| Radius                         | `radius-card radius-inset radius-ctrl radius-chip`                                                                                                   | 4   | `rounded-card`, `-inset`, `-ctrl`, `-chip`; `rounded-full` survives the reset (F, S0)                        |
| Size                           | `ctl-h row-h icon hit`                                                                                                                               | 4   | `h-ctl`, `size-ctl`, `min-h-row`, `size-icon`                                                                |
| Fonts 4, weights 3, type 14    | `font-sans font-head font-mono font-head-stretch`; `weight-body weight-medium weight-strong`; `text-{micro,xs,sm,md,base,lg,display}` and `-lh` each | 21  | `font-*`; `--text-*` + `--line-height`; weights serve static sites, which have no utilities                  |
| Motion 3, rhythm 4, contract 1 | `dur-fast dur-base ease`; `measure rhythm-1..3`; `contract` (value `3`)                                                                              | 8   | `duration-*`, `ease-*`; rhythm for `.vx-prose` and static sites                                              |

Tailwind-only aliases: `primary`/`primary-foreground` = ink/canvas; `secondary` = raised + `shadow-raised`, no ring (S2); `muted`/`muted-foreground` = card/ink-muted; `transparent`, `current`. Not names: axis is `ink-faint`, dot stroke is `surface`, tooltip is `raised` + `ink` + `ink-muted` + `hairline` + `shadow-overlay`; `VX` constants `dash` (`6 4`), `lineWidth`, `text.*` are not CSS vars. Alpha: `hairline`, `hover`, `selected`, `-tint` and `scrim` are pre-mixed `color-mix` values, so `/NN` on them compounds and is denied by `tw-off-law` (self-tokens-theme, Opacity).

### 3.3 Surfaces and nesting

| Role   | Dark T, hex    | Light T, hex   | Use                                     |
| ------ | -------------- | -------------- | --------------------------------------- |
| canvas | 12.5 `#23201d` | 96.5 `#f8f4f1` | Page, table head                        |
| inset  | 15 `#282522`   | 99.2 `#fefcfb` | The reading surface: data, rows, charts |
| card   | 19 `#312e2b`   | 92.5 `#ece9e6` | Ringed frame, header and footer bands   |
| raised | 24 `#3c3835`   | 100 `#ffffff`  | Controls, tiles, popovers, chips        |

```
canvas
  Card        data-surface=card, hairline, radius-card (dark: no drop)
    CardBand  header: IconTile + title + subtitle + actions; card shows through
    Inset     data-surface=inset, flush left and right, own hairline, radius-inset
      CardBand? toolbar row on the inset, hairline below
    CardBand  footer: stats only (legends live in Inset, drawn by the chart)
```

- **Why these steps.** Today's card step is .016 OKLCH L, under the read threshold (ext-visual, console says "inset barely reads"). Target .037 dark, .056 light; the x-ref is .021 and TuffUI .040.
- **The law holds against the parent, not the page** (x-ref dark, TuffUI light): inside a card, inset is the highest-contrast surface for ink in both schemes (dark 15 under 19, light 99.2 over 92.5). Against canvas the direction differs (dark inset is lighter than canvas), the step is only .021/.023 L and ungated; `Inset` on canvas carries its own hairline.
- **Card ring is an overlay.** An inset box-shadow paints under children, so a flush opaque `Inset` hides it along its span (F, Chrome run: the edge pixel under the child is the child's colour; a `::after` ring keeps it). `Card::after` (inset 0, `pointer-events: none`, radius inherit) draws the ring; a flush `Inset` draws its hairline top and bottom only. Layout suite asserts corner and edge pixels before S1.
- **`--vx-surface` is the current surface.** `Card` and `Inset` set `data-surface`; base CSS re-points the var; `--color-surface` is `@theme inline`, so `bg-surface` resolves per nesting level (F, S0: `rgb(49,46,43)` in card, `rgb(40,37,34)` nested in inset). Sticky table cells, autofill paint and chart dot strokes use it, which removes the need to know the host.
- **`Card` clips with `overflow: clip`, never `hidden`,** so a page-sticky table head inside a `Card` or `DataPanel` keeps sticking (data-table, shell S1).
- **Flush is structural.** `Card` has no horizontal padding, bands and `Inset` content own `--card-edge` (private, 16; 12 under `@narrow`). No negative margins, and tile, figure, footer label and first toolbar control share one x, asserted in the layout suite. Console misses this (14 vs 20). `--card-gutter: 0` is the one-token flush switch (DPO 5).
- **Hover and selected are ink mixes** (`color-mix` toward ink), so one value works on card and inset and cannot vanish on a light surface (self-tokens-theme, `row-surfaces.test.ts`). - A bare panel is a `Card` with padding through `CardBand`; `Inset` outside `Card` is a dev assertion, except on canvas.

Inks: ink T93/T14, muted T72/T38, faint T62/T44. Faint is excluded from raised (D 3.91). Not pure white: T93 keeps the warm image and avoids halation on 13 px rows (ext-visual 4.3). Muted sits clear of ink, so shutterflow's dark `line2` workaround for secondary text ends.

### 3.4 Blue

|           | Value                                                                                                   | Measured (F, gap-token 5, 6)                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Fill      | `#2e75b1`, tone pinned in fill band, HCT 268/38.2/47.6                                                  | White label 4.89; dark 3.31 canvas, 3.12 inset, **2.76 card**, 2.37 raised; light 4.47/4.78/4.04/4.89                          |
| Brand ink | Dark `#99c4fa`; light `#216da8` (T44.4, same hue and chroma, solved here with `hctToHex`, not the fill) | Dark 8.98/8.44/7.47/6.43, light 5.03/5.38/**4.55**/5.50 on canvas/inset/card/raised. The fill as light text was 4.47/4.78/4.04 |
| Primary   | ink on canvas                                                                                           | 11.3 to 15.3 on every surface, no constraint                                                                                   |

Decisions the numbers force:

- **`brand-fill` is legal on canvas and inset only** (gate), and `chart-1..5` share the band (`chart-1` = `brand-fill`), so charts and legend swatches stay in `Inset`; `chart-2..5` on card are not a gated pair. No `bg-brand-fill` in zone A; shutterflow gallery (13 reads) and weatherorb reach it from CSS.
- **T18 does not rescue the dark card.** gap-token offered T18 as the way to reach 3.0. Computed here with `hctToHex`: T18 `#2f2b29` gives step .026, under the contract's .03 gate. T18.5 gives .033 and fill `#357ab6` lands on exactly 3.00. So T19 stands, and blue never fills on card (DPO 5).
- **Checked state is ink-inverted, not blue** (departure from ext-visual 5.2's spending list). The fill on card fails 3.0, and "checked" is none of the earned reasons. It also needs one glyph pair and no surface logic. Blue remains for: now mark, focus ring, links, active-nav icon. Determinate progress uses `brand` (>=4.5:1 on every surface in both schemes).
- **The `accentBrightness` knob is dead on the evidence.** Positive steps drop the label under 4.5 (4.07, 3.45); negative all clamp to one value (gap-token 5). It goes, which also settles the 3.0 vs 4.5 `on-accent` mismatch: the gate is **>=4.5**, the polarity-flip constant is deleted. - `vibrancy` recentres so level 0 = today's +1. The seed contributes hue only, chroma normalised `max(seed,40)` (d4); the config is authoritative, never a hex. - Selected rows, tabs and segments are never blue (kept, `DESIGN-CORE.md:39`).

### 3.5 Earned colour, made mechanical

| Reason      | Treatment                                                                                                                                                               | Limit                                                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Now         | `brand` mark, the current bucket or playhead                                                                                                                            | One per chart: `highlight?: number`                                                                                             |
| Verdict     | Tinted delta badge                                                                                                                                                      | Needs required `polarity`; unknown is a neutral chip, never "good"                                                              |
| Status      | 6-7 px dot + ink label; `Lozenge` tint for a block                                                                                                                      | Status only where the column does not state it                                                                                  |
| Categorical | Consumer series map, 2+ series in one frame                                                                                                                             | `series-palette` audit                                                                                                          |
| Threshold   | Status of a value on a chart: mark `VX.good`/`warn`/`bad`, zone band `alpha(VX.x, .06-.12)`, reference line `alpha(VX.x, .5)` + `VX.dash` so it stays quieter than data | Inside `Inset`, one status scale per chart; 2.x `*-Solid` 91 reads and `*-Ref` 21 (argo, linewatch, weatherorb) are mostly this |
| Affordance  | Focus ring, link, active-nav icon                                                                                                                                       | Nothing else in chrome                                                                                                          |

Two misuse tests (ext-visual 5.1): remove the colour, does anything lose meaning? Could a neighbouring card have used a different hue for no reason? Attention budget: one filled badge per row or card (ext-dense).

| Rung                                     | Mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Absence; Type                            | Closed palette: no `bg-blue-500`, no `text-white`. No `color`, `tone` or hue prop on `Card`, `StatCard`, `IconTile`, `Section`; `tone` closed `neutral good warn bad info`, never a hue name; `polarity` required; `highlight` single; `footer` 2-tuple                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Lint, zone A, inside booked `tw-off-law` | The list is **generated from `table.ts`**: every bridge target resolving to brand, status, tint, chart or seq (today `brand brand-fill on-brand good warn bad info destructive ring line chart-N seq-N` and each `-tint`), so a new alias cannot slip it. Denied on `bg border ring outline divide from via to fill stroke decoration shadow accent caret` and `text`. `bg-current`, `border-current`, `ring-current`, `outline-current`, `divide-current`, `from-`, `via-`, `to-current` denied outright; `fill-current`, `stroke-current`, `text-current` stay, as no text hue exists to inherit. App links use the `link` utility. Kills tinted cells, coloured left bars and hue-per-card text (rollhook `border-l-[5px]`, console `DESIGN.md:92`). The message names `Status`, `Lozenge`, `DeltaBadge`, `Num tone`. Ejected primitives are zone S for this denial only |
| Lint, others                             | `status-fill-as-text` (fill-band tokens `brand-fill`, `chart-N`, `dim-bar` as text); `fixed-colour` (`bg-black/40`, message names `bg-scrim`); `colour-literal` (canvas, hex in TS); `dark-fork`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Escape                                   | Domain colour goes through `defineSeries`; `alpha(VX.x, n)` for SVG and canvas only; anything else is a counted waiver with a reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

Tint is 16% dark, 12% light. The solver gains card, inset and own tint as test surfaces; stock stops fail on tint (dark bad 4.05, light good 3.87) and walk to 4.51-4.55 (gap-token 8). Hue chroma stays below x-ref's 70-100 ("never playful"). `info` shares the brand hue, no fifth hue, but is solved like any status: dark = brand ink (4.62 min on tint), light T40 `#06629c` (4.53 on its tint over card, where `#216da8` gives 3.90). That gives rollhook its neutral/info/running status without adding a colour.

### 3.6 Density, radius, spacing

| `data-density`           | `--vx-ctl-h` | `--vx-row-h` |
| ------------------------ | ------------ | ------------ |
| `dense` (default, DPO 6) | 1.75rem = 28 | 2rem = 32    |
| `normal`                 | 2rem = 32    | 2.5rem = 40  |
| `comfortable`            | 2.5rem = 40  | 3rem = 48    |

- **Spacing unit fixed**, because a scaled unit gives fractional px at every non-zero level, collapses to three notches under `round()`, and traps `:root` scope (gap-token 1, tie-break digest row 9).
- **Per-subtree density works** (F, S0: html `normal` 32, nested `comfortable` 40), since `h-ctl` reads the var at the element. 3.0 uses it nowhere: per-table density has no consumer (data-table E4) and a control home picks a `size`. The mechanism stays for later, additive. - **Moved:** control and row height. **Never moved:** gaps, type, tiles, icons, hairlines. Density never comes from the viewport (M3, ext-dense). - `min-h-row` is a floor, so a two-line row (20 + 16 + 8 padding = 44) needs no separate notch. That lands on ext-visual's 44 and x-ref's 45.5, and resolves digest row 9's number conflict except the one-line 36, which becomes 32.
- Control tiers are not a system: `size="sm"` is fixed `h-6` (24, the WCAG 2.5.8 floor) for card-header menus and row actions; `CtlSlot` and `data-basalt-tier` do not return. Coarse pointer: `pointer-coarse:min-h-11` on controls, the `::after` overlay (`hit` utility) for icon-only targets in dense rows (d14); `--vx-row-h` and `--vx-hit` carry coarse values in `tokens.css` (44, today's 2.x floor), asserted in the layout suite. `comfortable` stays 48.
- Ladder: integer multipliers plus `.5` below 4; weatherorb's 24 odd-px sites migrate once (gap-token 4). Radii: card 14, inset 10, ctrl 8, chip 5; `rounded-full` only for dots, count chips and bar tracks. Flush insets are not concentric, so the nested-radius law applies only inside a control: `Segmented` track 8, indicator 5, keeping the >=3 px step (2.x D17, not ext-visual's "minus 2"). 2.x's `radius` knob is dropped (DPO 5). Ring: ink 9% dark, 12% light, inset box-shadow, never a border for depth.

### 3.7 Type and numerals

| Rung      | Size/line (rem-emitted) | Role                                                                                          |
| --------- | ----------------------- | --------------------------------------------------------------------------------------------- |
| `display` | 30/1                    | Hero figure, 600, -0.02em, proportional lining                                                |
| `lg`      | 18/24                   | Rare                                                                                          |
| `base`    | 16/24                   | iOS floor, coarse forms                                                                       |
| `md`      | 15/20                   | Card and section title (600), body                                                            |
| `sm`      | 13/20                   | Rows, sublabels, controls. Stock `text-sm` is now 13, ending console's 14 x84 vs 13 x27 split |
| `xs`      | 12/16                   | Axis, meta, badge                                                                             |
| `micro`   | 11/16                   | Mono ids, machine strings                                                                     |

Ladder law kept: adjacent rungs 1.06 to 1.17 (display excepted). Article sizes (21, 26) belong to `typography.css` and `.vx-prose`, not the UI ladder. Numerals: proportional lining by default; `tabular-nums` only in table numeric columns and axis ticks; `[data-numeric]` is the one mono + tabular contract; `Num` wraps it and owns dash-for-absent. Hubot has a slashed zero, so digits come from Nunito via the `Head Digits` unicode-range face; `font-stretch: 88%` is Hubot-only (d18). Mono drops ligatures. Mono uppercase is for instrument strings only, reversing `DESIGN-CORE.md:178`; metric captions are sentence-case sans. Input floor: `@media (pointer: coarse)` only, `max(16px, 1em) !important`, the one legitimate `!important` (gap-token 3).

### 3.8 App-owned tokens and ramps

Three apps declare their own vars (argo `paletteOptions`, `main.tsx:34`, seven groups; rb `--vx-confidence-*`; weatherorb `--vx-weatherorb-*`). The series map is consumer data, the framework owns roles and audit (consumer-argo). In argo the shade index is the meaning: rank is "three accent shades two steps apart, then greys" (`DESIGN.md:175`, owner verdict 2026-10-27), and `p(BP.blue, 3, 4)` is the sibling of `hrv`.

```ts
// src/basalt.tokens.ts: import-free data, one per app, loaded by the CLI (Bun, per its shebang; F)
export default {
  series: { series: { hrv: { hue: 'blue' }, hrvWeekly: { hue: 'blue', light: 3, dark: 4 } } }, // literal { light, dark } hex stays legal
  vars: {
    optimalZone: 'color-mix(in srgb, var(--vx-good) 10%, transparent)',
    hillshadeShadow: 'rgb(0 0 0)',
  },
}
```

| Rule            | Decision                                                                                                                                                                                                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ramps           | `ramps.ts` carries 2.x's 13 families x 5 steps hex-identical, internal: no `--vx-*`, no export, so `BP` and `p()` go and nothing shifts. `light`/`dark` default 2/3, `p()`'s defaults. No new symbol: `defineSeries` accepts the data form                                                           |
| Emit            | `tokens:css --extra src/basalt.tokens.ts --out src/styles/app-tokens.css`: `--vx-<group>-<key>` pairs per scheme, `vars` once on `:root`, a sibling `.d.ts` augmenting `BasaltRegister` as argo does by hand, `--check` byte-exact. Existing names (`--vx-usage-*`, `--vx-lp-*`) stay byte-identical |
| Registered      | `check-tokens` unions the package list with this file's names, via the manifest, so a typo still fails and `--vx-usage-x` does not                                                                                                                                                                   |
| Refused, exit 1 | A collision with 3.2; a `vars` value reading a name outside 3.2 or this file (`--vx-good-solid` fails, message names `--vx-good`)                                                                                                                                                                    |
| Not bridged     | No Tailwind utility, so zone A cannot paint with it; reaches charts, `Swatch`, MapLibre paint                                                                                                                                                                                                        |
| Audit, fixture  | `series-palette` resolves steps and audits each group (lightness, chroma, CVD, 3:1) plus monotonic lightness among siblings of one hue. The `full` fixture carries argo's `optimalZone`, `hillshade*`, `rank`                                                                                        |

## 4. Public API sketch

```css
/* consumer, profile bridge or above */
@import 'basalt-ui/tailwind.css';
@import '../.basalt/sources.css';
/* generated tailwind.css, in this order (resets after a definition wipe it: F, gap-token 2) */
@layer theme, base, basalt, components, utilities;
@import 'tailwindcss';
@import './tokens.css' layer(theme);
@import './fonts.css';
@custom-variant dark (&:where([data-theme='dark'], [data-theme='dark'] *));
@theme {
  --color-*: initial;
  --shadow-*: initial;
  --radius-*: initial;
  --text-*: initial;
  --breakpoint-*: initial;
}
@theme inline {
  --color-background: var(--vx-canvas);
  --color-card: var(--vx-card);
  --color-surface: var(--vx-surface); /* map 3.2 */
}
@theme {
  --spacing: 0.25rem;
  --breakpoint-md: 840px;
  --breakpoint-xl: 1200px;
  --container-narrow: 15rem;
  --container-regular: 30rem;
  --container-wide: 50rem;
  --text-sm: 0.8125rem;
  --text-sm--line-height: 1.25rem; /* ... */
}
@utility h-ctl {
  height: var(--vx-ctl-h);
}
@utility size-ctl {
  width: var(--vx-ctl-h);
  height: var(--vx-ctl-h);
}
@utility min-h-row {
  min-height: var(--vx-row-h);
}
@utility size-icon {
  width: var(--vx-icon);
  height: var(--vx-icon);
}
@utility focus-ring {
  &:focus-visible {
    outline: 2px solid var(--vx-brand);
    outline-offset: 2px;
  }
}
@utility link {
  color: var(--vx-brand);
  text-underline-offset: 2px;
}
/* tokens.css shape: no Tailwind, no React. Dark sits in `not print`, so printing is light with zero extra bytes (F, S0). `auto` = no attribute, the media block applies (always emitted, static-framework-free row 3) */
:root,
:root[data-theme='light'] {
  color-scheme: light;
  --vx-canvas: #f8f4f1; /* ... */
}
@media not print {
  :root[data-theme='dark'] {
    color-scheme: dark;
    --vx-canvas: #23201d; /* ... */
  }
}
@media not print {
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme]) {
      color-scheme: dark;
      --vx-canvas: #23201d; /* same dark block */
    }
  }
}
:root {
  --vx-contract: 3;
  --vx-icon: 1rem;
  --vx-hit: 1.5rem;
  --vx-surface: var(--vx-canvas); /* scalars */
}
:root,
[data-density='dense'] {
  --vx-ctl-h: 1.75rem;
  --vx-row-h: 2rem;
}
[data-density='normal'] {
  --vx-ctl-h: 2rem;
  --vx-row-h: 2.5rem;
}
[data-density='comfortable'] {
  --vx-ctl-h: 2.5rem;
  --vx-row-h: 3rem;
}
@media (pointer: coarse) {
  :root,
  [data-density='dense'],
  [data-density='normal'] {
    --vx-row-h: 2.75rem;
  }
  :root {
    --vx-hit: 2.75rem;
  }
}
```

```ts
// <html data-theme="dark" data-density="dense" lang="en">: theme-script sets data-theme pre-paint, only when absent
import { VX, alpha, setScheme } from 'basalt-ui'
VX.brand // 'var(--vx-brand)' for charts, SVG, status maps; typed from the emitter, shrunk to the census   VX.text.xs         // 12: a number, because SVG presentation attributes cannot resolve var()
alpha(VX.good, 0.3) // color-mix string, SVG and canvas only   setScheme('dark')  // writes data-theme, basalt:scheme and the declared cookie; 'auto' follows the system
setScheme() // re-reads storage and applies; call after an async restore (same-tab writes fire no storage event)
themeScript({ cookie: 'sf-color-scheme' }) // boot order localStorage, then cookie, as shutterflow does today (port-independent, ADR 0022)
```

```bash
basalt-ui tokens:css --accent '#0f8a7e' --neutral cool --vibrancy 1 --out src/styles/retune.css   # imported after tailwind.css
basalt-ui tokens:css --accent '#0f8a7e' --selector ':root[data-tenant="t2"]' --out tenants/t2.css  # 1.8 KB, must be in server HTML
basalt-ui tokens:css --out src/styles/tokens.css --check                                          # byte-exact, exit 1 on drift
basalt-ui tokens:css --format json --out src/lib/brand/tokens.json --check                        # opaque hex; hairline, hover, selected, -tint, scrim absent (opaque roles only)   # gate failure: "fill-on-inset dark 2.91 < 3.0 for --accent <hex>. Raise --vibrancy or pick another hue."
```

`--radius`, `--density`, `--brightness` and per-scheme tone flags are absent on purpose; each is additive later.
Composition: primitives get values from `h-ctl`, `rounded-ctrl`, `shadow-hairline`, `bg-secondary`; composites take none of `className`, `style`, `color`, per contract 7.2. `data-slot` names `card`, `card-band`, `inset`, `icon-tile` are in `SLOTS`. Rungs: 1 config, 2 `Lozenge`/`Status` `tone`, 5 `eject` (token and class rules stay on inside, contract 4.2).

## 5. Carries over, rewritten, dropped

| Status  | What                                                                                                                                                                                                                                                                                                                                                           | Source                       |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Keep    | HCT engine, fill band, status solver, ink floor, row-mix law, `{light,dark}` pair as the unit, `tokens:css --check` + provenance, closed name list, `series-palette`, three fonts, size classes 840/1200, container 240/480/800                                                                                                                                | self-tokens-theme (b)        |
| Rewrite | `palette.ts` + `core.ts` to one table; surfaces from 10 keys to 4; inks 4 to 3; `VX` shrinks; fills renamed by hue, 12 (11 distinct) to `chart-1..5`, the rest through `defineSeries` ramps (3.8); spacing to utilities; density from 121 vars to 2; type ladder to `--text-*`; `CtlSlot` to subtree density + `size`; `ThemeToggle` to ~60-line scheme module | self-tokens-theme (e)        |
| Drop    | Theme object (1,699 lines), theme-lab (764), the `BP` and `p()` exports, per-component spacing, mobile inset ladder (`max-md:` does it), `accentBrightness`, radius and level knobs, `MANTINE-THEMING.md`                                                                                                                                                      | self-tokens-theme, gap-token |

Lines 8,198 to ~1,900 (J), tests 5,965 to ~1,800, with theme-resolution tests replaced by table-driven ones.

**Invariants pinned in a test before the port, failing first.** Digest section 3 "Tokens" and self-tokens-theme (d):

| Invariant                                                                                                                                          | v3 form                                                                                    | Pin                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Fill band Y=.165; `clampFillTone` (d1, d3); Status solver walks tone, unreachable throws (d5)                                                      | Clamp tests every allowed surface; Adds tint surfaces                                      | `gates.test.ts` grid over seeds; Grid incl. `selected`, `hover`                    |
| Faint opaque for axis (d6); divider an ink alpha, not a hex (d7); One seam, ring or edge per surface (d8)                                          | `axis` = `ink-faint`; `hairline`; `Card` carries no `border`                               | PAIRS, polarity across presets; `check-tokens` scan of `src/ui`                    |
| Raised shadow asymmetric; "do NOT tidy" (d9); `:root[attr]` specificity (d10)                                                                      | Pair carried verbatim, S2 retests light; Tenant 0-3-0 beats default 0-2-0 (F, gap-token 8) | Value snapshot, reason comment kept; Emit test                                     |
| Unlayered CSS kills layers (d12)                                                                                                                   | Layer statement first; basalt rules in `@layer basalt`, base                               | `check-dist`: no unlayered rule                                                    |
| iOS floor, `!important` (d13); `pointer: coarse`, not `any-pointer`; `::after` (d14)                                                               | Coarse only; `pointer-coarse:` means primary (F)                                           | Built-CSS test + Chrome coarse 16; Layout hit test 44/24                           |
| Ladder 1.06-1.17; Head Digits, stretch, ligatures, numerals; autofill (d17-d20)                                                                    | Table test; `fonts.css`; autofill uses `--vx-surface`                                      | Unit, computed style, layout                                                       |
| Focus ring is ink, not fill (d21)                                                                                                                  | Solid `brand`, never `ring-ring/50` (gap-a11y)                                             | Axe + computed                                                                     |
| Literal `NODE_ENV`; resolves with no React or Tailwind; unknown var silent; stable header (d25, d26, d28, d30); Foreground is a paired token (d33) | `tokens` fixture; `check-tokens` scans `.tsx` too; `PAIRS` table                           | Shared test, pack-test, fixture, emit snapshot; Both schemes, every `*-foreground` |

Provenance warning (d31): the calibration file `derive.ts` cites no longer exists. Port numbers with their tests, not their justification, and delete the reference.

## 6. Consumers at each depth

| Profile  | Consumer, gate                                            | Entry                                                              | Gets                                                                                                                                                                                                           |
| -------- | --------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tokens` | jkrumm.com, weatherorb `/`; G0                            | `<link>` or `@import 'basalt-ui/tokens.css'`; `data-theme` in HTML | Palette, ladder, rhythm, motion, `.vx-prose`, `.vx-hairline`; `tokens:css --check`; stylelint preset. jkrumm's `#0084d1` drift ends with `--accent`. Weatherorb's `maxScripts: 0` page hardcodes the attribute |
| `bridge` | rollhook x2, console, epos probe; G0                      | `@import 'basalt-ui/tailwind.css'`                                 | Generated bridge replaces hand maps; `cn`; oxlint preset. Stock shadcn classes keep working                                                                                                                    |
| `parts`  | linewatch G1; weatherorb `/map`, image-gateway G4         | + `basalt()`, `ui/*`                                               | Density, primitives; no shell required                                                                                                                                                                         |
| `app`    | rb, obsidian G2; finances, email G3; argo, shutterflow G5 | + `./shell`                                                        | Everything; `VX` for charts                                                                                                                                                                                    |

Unified look across depths: every profile reads the same table, and `one-look` (Chrome computed-style identity on surface, ink, ladder, radii, ring and shadow) runs on all five fixtures. Zero-override consumers absorb redesign free, as rb did at 1.30.0. Shutterflow's `apps/share` mirrors nine roles as hex because mail cannot load a stylesheet, and `border` is pre-mixed, so a recipe cannot read it off the sheet: `--format json` ships (fixture: the share palette), about 30 lines over the table the emitter holds. It carries opaque roles only; alpha mixes are absent, not flattened per surface (`v3-st-2-json-emit`). `brand-fill` stays one value in both schemes, which is what keeps it legible under Gmail's inversion (`brand.md`).

## 7. State, responsive, print, a11y, i18n

- **State.** Device lane: `basalt:scheme` holds a raw `light|dark|auto` string, the one key outside the `{v,value}` envelope (DEFAULT-PENDING-OWNER; alternative: envelope), because the boot script and the 5 KB provider must not import `persisted`. The boot script reads it in try/catch, then legacy `mantine-color-scheme-value`, and writes only the new key. It acts only when `data-theme` is absent. Shutterflow's API binds a fresh port every launch, so `localStorage` resets: `themeScript({ cookie })` reads the cookie second, `setScheme` mirrors it, and `setScheme()` re-applies after `restorePrefs` (G5 day-one acceptance). The prefix keeps its server whitelist working. Golden fixture covers key, legacy and cookie reads. `data-density` is app-fixed and unpersisted.
- **Responsive.** `md` = 840, `xl` = 1200, all else dead (conditional on F7). `@narrow`, `@regular`, `@wide`; containers extended, not reset, so `max-w-*` lives. `@sm:` numeric containers denied by `tw-off-law`. Size classes stay JS-side for chrome only.
- **Browsers.** Baseline is Tailwind 4's: Chrome 111, Safari 16.4, Firefox 128 (F, tailwindcss.com/docs/compatibility, read today). `color-mix` and `@layer` assume it. Shutterflow's `minimumSystemVersion` 13.0 predates 13.3: raise it in the G5 issue or record the exception; WebKitGTK on Linux is its known weak platform (ADR 0007).
- **Print.** Light tokens by construction (above). `--vx-surface` follows. Shell unclip and break marks belong to the shell concept. - **Forced colours.** `box-shadow` is dropped, so every hairline disappears (F, S0: `none`). A base rule `[data-surface] { border: 1px solid CanvasText }` restores the frame; `focus-ring` uses `outline` and survives.
- **A11y.** Focus ring solid 2 px, offset 2, on every interactive primitive; contrast gates as stated. 1.4.12 text-spacing test added. `motion-reduce:` on motion tokens. The hairline around an input measures 1.19:1 light and 1.24:1 dark (S3), so `--vx-input` carries a heavier pair that clears 3:1 on every surface; whether SC 1.4.11 requires it for a labelled input is the owner's call. i18n: no strings here; `Num` delegates grouping to `useFormat`.

## 8. Proof

| Evidence                                                                                                                                                                                                  | Result                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bridge, utilities, closed namespaces, tenant FOUC; S0: `h-ctl`, `size-ctl`, `min-h-row` render; `data-density` at html and subtree; rem at root 20 px                                                     | F, gap-token 2, 8, 9; F: 28/32, 40/48 nested wins; 35 and 16.25                                                                                                  |
| S0: inline `--color-surface` follows nesting; dark block in `@media not print`; forced colours drop box-shadow, border twin applies; Dark card tone table (T18, T18.5, T19); light brand and `info` solve | F; emulated print only, real PDF U; F, computed with `hctToHex`, `hexToOklch`, `contrastRatio`                                                                   |
| Fleet census: every `VX.*` and `--vx-*` read in argo, shutterflow, rb, linewatch, weatherorb, rollhook, obsidian (generated sheets, worktrees, `docs/` excluded)                                          | F: 135 distinct names, 1,297 reads, every one maps in section 9 or to 3.8; 12 are template prefixes or app groups. Script becomes the T5 `migrate --check` input |
| Card ring under a flush opaque child                                                                                                                                                                      | F, Chrome: hidden with inset shadow, kept with `::after`                                                                                                         |

Shipped gates: `gates.test.ts` runs PAIRS (brand ink included) on the default seed and jkrumm's across vibrancy, while other presets get the emitter's refusal only; zone A list generated and probed (`destructive`, `ring`, `current`, `line` in fixtures); bridge drift (every target emitted, resets first, `--color-accent` not the blue, coarse input 16); `check-tokens`; emit snapshot; `tokens:css --check` on fixtures; `one-look`; print page test; forced-colours sweep; budget (90 names); `required-peers` proving `tokens` needs none; `valueShifts` release gate.

| Open spike                                                                                                                                  | Blocks                 | Cost          | Refuted if                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------- | ------------------------------------------------------------------------------------------------------- |
| S1 owner's eye: StatCard, dense table at 1800x1200 and 390x844, both schemes, real fonts                                                    | Every DPO 5 item       | 1 d, exemplar | Owner rejects: only the table changes                                                                   |
| S2 light-control ring on warm ramp (2.x comment says rings failed on zinc)                                                                  | `secondary`            | 0.5 d         | Reads as double edge: light drop-only pair, table change                                                |
| S3 Input boundary against 1.4.11                                                                                                            | `input` value          | 0.25 d        | Fails: add `--vx-input` pair                                                                            |
| S4 `tw-off-law` zone A colour denial probed over argo, console, linewatch, counting TS colour too (`c={VX.`, `color={VX.`: argo 7 and more) | Rule at error          | 0.5 d         | >1 waiver per 300 lines: re-allow `text-(good\|warn\|bad)`, then narrow to backgrounds and `border-l/r` |
| F7 (contract) `no-unknown-classes` catches dead `sm:`, `lg:`; F6 (contract) `cn` compiled vs `clsx`                                         | Breakpoint reset; `cn` | 0.5 d; 0.5 d  | Fails: keep Tailwind's scale; Per contract                                                              |

## 9. Migration

| From                                                                                                                                                                                | To                                                                                                                                                        | Kind                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `--vx-surface-bg`, `-panel`, `-elevated`, `-overlay`, `-field`, `-subtle`                                                                                                           | `canvas`, `card`, `raised`                                                                                                                                | rename; codemod from `table.ts` `from`      |
| `surface-row-hover`, `surface-panel-hover`, `-selected`; `surface-border`, `-hairline`, `divider`, `axis-stroke`; `ink2`, `muted`, `faint`, `axis`, `legend-text`, `line2` (1 read) | `hover`, `selected`; `hairline`; `ink`, `ink-muted`, `ink-faint`, `ink-faint`, `ink-muted`, `ink-muted`                                                   | rename, merge                               |
| `accent`, `accent-hover`, `accent-fill`, `on-accent`; `accent-fill-hover` (1 read)                                                                                                  | `brand`, `brand`, `brand-fill`, `on-brand`; `color-mix` in app CSS                                                                                        | rename                                      |
| `status-*`, `*-soft`                                                                                                                                                                | `good`, `warn`, `bad`, `info`, `-tint`                                                                                                                    | merge                                       |
| `*-solid` (95 reads), `*-ref` (21)                                                                                                                                                  | Chart marks and zones: `VX.good`/`warn`/`bad`, `alpha(.., .5)` + `VX.dash` for ref lines; primitives: `tone`                                              | manual per use, `valueShifts` row           |
| `neutral` (85 reads, `ink.muted` grey, not a status)                                                                                                                                | `ink-muted`; under `alpha()` by amount: `hover` (<=.10), `selected` or `hairline` (<=.22), else `ink-muted`                                               | codemod; alpha cases manual                 |
| `line`; `dashArray`, `dotStroke`; `status.excellent` (4)                                                                                                                            | `line`; `VX.dash`, `VX.surface`; app series `{ hue: 'forest' }`                                                                                           | rename                                      |
| `tooltip-bg`, `-text`, `-muted`, `-border`, `-shadow`; `radius-fine` (14), `-tight`; `radius-pill` (12); `radius-floating` (8); `shadow-ctrl`                                       | `raised`, `ink`, `ink-muted`, `hairline`, `shadow-overlay`; `chip`; `rounded-full`; `inset`; `shadow-hairline`                                            | rename; rename                              |
| `p(BP.f, l, d)` (argo 93, rb 6)                                                                                                                                                     | `{ hue: 'f', light: l, dark: d }`, same indices, hex-identical                                                                                            | codemod into `basalt.tokens.ts`             |
| `paletteOptions.groups`, `.derived`                                                                                                                                                 | `series`, `vars`, formulas rewritten to v3 names (`--vx-good`)                                                                                            | codemod + `--extra` refusal                 |
| `fill-*`, `fill-hover-*`                                                                                                                                                            | `chart-N` or `defineSeries`                                                                                                                               | manual row per use                          |
| `space-*`, `text-nano`, `-kpi`, `-h1`, `-h2`, `-xl`; `[data-mantine-color-scheme]`                                                                                                  | utilities; `micro`, `display`, content ladder; `[data-theme]`; attribute string in tests too (shutterflow 26 e2e files, app-owned helper in its G5 issue) | removed; selector, doctor lint, migrate row |
| `tokens:css --only`, `--selector-attribute`, `--light-class`, `--default-scheme`, `--media-fallback`                                                                                | `--selector`                                                                                                                                              | flag rows                                   |

`valueShifts` rows are mandatory for hue, radius (10 to 14, 6 to 8), `display`/`kpi`, control height. A migration is a visual change per app: budget baseline regeneration, since the codemod's 375/375 fidelity does not survive a scale change (digest row 11). No compat CSS; `migrate --profile tokens` handles the rename. Rollhook's 38 names are a one-shot rewrite, and its digest "~0 cost if `--vx-*` kept" no longer applies: say so in its G0 issue.

## 10. Kill list

| Killed                                                                                                                                                        | Why                                                                                                       | Instead                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `createBasaltTheme`, `theme.other`, theme-lab, `BasaltBridge` emit; Scaled `--spacing`; `radius`, level, `accentBrightness` knobs                             | 0 consumers pass options (self-tokens-theme 3.4); gap-token 1; 0 uses, brightness dead on evidence        | `tokens:css`, one playground panel; Two vars; table constants       |
| Word "accent" for blue; the `BP`, `p()` exports, `--vx-fill-*`                                                                                                | Collides with shadcn hover; a public ramp is not the API, the data form is                                | `brand`; `chart-1..5`, ramps behind `defineSeries` (3.8)            |
| `primary` as blue, blue checked, blue selection                                                                                                               | Fill fails on card; unearned                                                                              | Ink                                                                 |
| Tinted status cells, coloured left bars, hue-per-card, uppercase micro labels                                                                                 | Slop list (epos, ext-visual)                                                                              | `Status`, neutral; lint denial for the first three                  |
| `shadow-sm`, `rounded-md`, `text-[N]`, numeric containers, `dark:` colour; `sidebar-*` aliases; `@theme` by hand, the `--media-fallback` flag, `light-dark()` | Closed vocabulary; Own rail (DPO 17); generated (the fallback is always emitted); shadows are not colours | Roles; Additive if `--adopt` proves a need; emitter, `theme-script` |
| `DESIGN-CORE.md` lines 26-32, 36, 115-127, 129, 160, 177, 178, 200                                                                                            | Doctrine reversed on purpose (ext-visual 13)                                                              | Rewritten at the v3 cut                                             |

## 11. DEFAULT-PENDING-OWNER

| Item                                                       | Default taken                                                                                                                                                        | One-line alternative                                                                                   |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| DPO 5 accent; DPO 5 primary                                | B, `#2e75b1`, vibrancy +1; Ink-inverted                                                                                                                              | A steel `#4374a6` or C `#0076bf`; Blue, legal only on canvas and inset                                 |
| DPO 5 dark card; DPO 5 inset, radii                        | T19; Flush; 14/10/8/5                                                                                                                                                | T18.5 with fill `#357ab6`, zero margin at 3.00; `--card-gutter` 4 px; table edit                       |
| DPO 5 delta; DPO 5 desktop input; DPO 5 checked (new here) | Tinted badge; 13 px, coarse floor only; Ink-inverted                                                                                                                 | Text-only, today's austerity; 16 px everywhere; `bg-brand` with a dark-glyph pair                      |
| DPO 5 fonts; Radius knob (new here)                        | Nunito, Hubot, JetBrains carried; None in 3.0                                                                                                                        | A crisper grotesque closer to the x-ref; one screenshot round; `tokens:css --radius` integer, additive |
| DPO 6 density; DPO 7 scheme                                | `dense`, app-fixed. Note: 4 px under today's 32 control, and ext-visual argued to keep 32; `data-theme`, `basalt:scheme`, Lucide per contract                        | `normal`, one attribute; user setting; Class selector; keep legacy key                                 |
| DPO 16 tokens tier, navy                                   | Supported profile; `--accent` is hue-only, navy renders mid-blue; `--neutral`, `--selector` have no named consumer, deleted at G2 if the epos probe yields no tenant | Per-scheme fill tone, relaxing 3.0 for that tenant                                                     |

## 12. Factory

Each Issue <=15 files, <=1,500 lines, signal = its named check green. T1 `src/tokens/*.test.ts`: invariants pinned on 2.x, failing first. T2 `src/tokens`: table, derive changes, gates, emit. T3 `src/css`, `src/core/scheme`: CSS entries, base, fonts, scheme module, theme-script (signal: `tokens`, `bridge` fixtures). T4 `src/cli/tokens-css.ts`, `src/lint`: CLI incl. `--extra`, `--format json`, stylelint preset, `check-tokens`, generated zone A list. T5 `migrations/`, `test/fixtures`: rows, `valueShifts`, `one-look`, fleet census (signal: `migrate --check` on rollhook). `must_not_touch:` `src/ui` and composites for all, and `src/tokens/table.ts` outside T2. T1 precedes T2. S1 needs T2 and the StatCard exemplar, and precedes fan-out (contract section 8).

## 13. Contract Exceptions

**Additive clarifications**, inside their budgets: names `surface`, `scrim`, `info` + `info-tint`, `seq-1..5`, `line`, `font-head-stretch` beyond the section 5 map; `tw-off-law` gains the zone A colour denial, ceiling stays 18, 16 used; `status-fill-as-text` now means fill-band tokens as text, because `good` is a single ink.

| Contract amendment        | Change                                                                                 | Why                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Sections 4.3, 5 flag list | Add `--extra`, `--format json`; radius stays table-only                                | Argo, rb and weatherorb need the seam; the emailed hex cannot be read off the sheet |
| Section 5 gates           | Brand ink joins the >=4.5 ink gate on canvas, inset, card                              | Light brand as fill measured 4.04 on card                                           |
| Section 4.2 eject lint    | Zone A colour denial is off in ejected primitives; other token and class rules stay on | A tone table is the primitive's job, and `--adopt` files carry `bg-destructive/10`  |

**This table wins over the concept drafts; applied at integration (ARCHITECTURE section 14):** `static-framework-free` uses 3.2's names; `charts-cards-kanban` dropped `--vx-axis`, `--vx-tooltip-*`; `primitives-distribution` row 34 gives `Num` a `tone`. R1 (`divider`) is refused, `hairline` serves it; R2 adds the three weights (`font-head-stretch` was booked).

## 14. Review Log

Accepted as written: series ramps (3.8), app-token seam, census and `neutral`, sixth reason, scheme cookie, light brand ink, coarse tokens and browser baseline, card ring and surface law, footer legend, single name list.

| Finding                                  | Verdict                                                       | Reason                                                                                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zone A aliases                           | Accepted, except dropping `--color-destructive`               | Contract 5 names it, and adopted base-nova files use `bg-destructive/10`; the generated denial closes app code without breaking zone S                                              |
| `text-*` denial                          | Accepted, one premise wrong                                   | `Num` has no `tone` today (primitives row 34), so it gains one. `text-brand` needs a home with no link primitive: the `link` utility, not a 36th module                             |
| Delete `brand-fill`, `on-brand`          | Rejected; `brand-fill-hover` deleted                          | Census: `accent-fill` 23 reads, `on-accent` 8 (shutterflow gallery and share, weatherorb chips and landing). Hover has 1 read. `chart-1` stays an alias of the fill                 |
| Keep only `--accent`                     | Rejected in part; gate grid narrowed                          | Seed is hue-only, so jkrumm needs `--vibrancy` (consumer-jkrumm-com:113); the flags are in binding contract 4.3. `--neutral`, `--selector` now on notice                            |
| `tokens:json`                            | Accepted, one premise wrong                                   | Jkrumm.com and weatherorb can load the sheet; only mail cannot. The pre-mixed roles are the real reason                                                                             |
| E2e `setTheme` helper; Shutterflow floor | Rejected as a package export; Accepted, recollection narrowed | One consumer: an app-owned helper in its G5 issue, plus the selector row; Apple lists Safari 16.4 for Big Sur, Monterey, Ventura; whether a 13.0 WebView has it is U, so G5 decides |
