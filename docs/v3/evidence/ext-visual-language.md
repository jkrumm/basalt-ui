# v3 visual language

Status: proposal. Nothing here has been rendered; every target below is computed, not looked at. It needs the `basalt-design` screenshot loop before it becomes law.
Legend: **[O]** observed (pixel-sampled, or read at the cited file:line). **[J]** my judgement.
Method [O]: PNG/JPG converted with `sips`, then sampled in a throwaway script importing basalt's own `tokens/hct.ts` and `tokens/oklab.ts`, so HCT figures here are the engine's own. `x-reference.jpg` is treated as a @2x capture (4096 px wide): that assumption yields 36 px buttons and tiles, which is Tailwind's `h-9`/`size-9`, so css px below are ±1. Font sizes are inferred from glyph height at an assumed 0.72 em digit height, ±1 px.

## 1. Verdict

- [O] The references agree on anatomy and disagree on almost nothing else: a ringed shell holding bands, a flush inset panel, one achromatic ramp, colour on small marks only. `herdr-...224613846000.png` is a lower-resolution crop of `x-reference.jpg` (identical tones, §3), so there are **three** independent designs, not four.
- [J] Adopt the anatomy. Do not adopt the darkness, the hues, or the 15 px softness wholesale.
- [J] The largest change from today is structural, not chromatic: today's output has a 0.016 OKLCH-L step between card and page in dark (§10), which is why the console's inset barely reads. The ramp needs bigger steps more than it needs warmth.
- [J] Everything stays derived: four surface roles, three inks and a ring from one neutral hue + chroma and two level knobs. Fewer tokens than today (10 surface keys, `derive.ts:273-285`).

## 2. Image by image

| Image                                                                                                                                                        | What it is                                                                     | Take                                                                                                                                                                                                                                                                                                                          | Do not take                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `herdr-paste-...119995289000.png` (390x289)                                                                                                                  | The factory console StatCard, on today's tokens ("Shipped this week 388 +378") | The anatomy the owner named: icon tile + title + subtitle, inset with figure, delta pill, comparison line, bars with three x labels, two-stat footer. One pale blue "now" bar over quiet bars: the single best statement of "colour is earned"                                                                                | Its surface step: inset `#27272a` is the page colour under shell `#2b2b2e` [O], 1.9 tones apart. The console's own evidence calls this subtle (`shadcn-factory-console.md:128`). Full-pill delta                                                |
| `herdr-paste-...152866180000.png` (698x427)                                                                                                                  | Podcast player card                                                            | Flush inner panel with its own ring between dark bands. Mono uppercase for machine strings only (`PLANET MONEY`, `05:12 / 18:15`, `11 MIN LEFT`). Waveform obeys the highlight law: played segment coloured, rest neutral, a playhead tick. A hairline inside the panel separating transport meta. Divider ticks in a toolbar | **Orange** accent, star, slider. Inner panel lighter than shell (`#171717` on `#101010`), which reverses the x-ref direction. Huge outlined pause pill                                                                                          |
| `herdr-paste-...224613846000.png` (1193x907)                                                                                                                 | Crop of the x-reference                                                        | Nothing additional [O]                                                                                                                                                                                                                                                                                                        | Treating it as a second data point                                                                                                                                                                                                              |
| `x-reference.jpg` (4096x2518)                                                                                                                                | Hotel PMS dashboard: KPI row, Room Board, Guest Worklist                       | Everything in §4-§8: band/inset rhythm, one shared left edge, ringed controls, dim-at-28 % bars with one lit bar, dashed future, delta badge vs neutral chip, status dot + label rows, id chip, group rows with micro-meter, legend footer band, count chips in segments, inverted primary                                    | **Purple** bookings and purple/amber KPI bars. Hue-per-card. Pure achromatic ramp at T5-10 (too dark for this brief). Pure white ink (T100). Near-black table well (T2.7). Hatching as a default texture (allowed only for "not available", §8) |
| TuffUI (https://tuffui.com/, registry JSON at `/r/{theme,surface,status-pill,segmented-control,action-button,stat-grid}.json`, fetched 2026-11-09, MIT) [O]: |

- Dark `surface .212 / inset .172 / raised .265` OKLCH L, chroma 0; light `.948 / 1 / .912`, hue 286 chroma .002-.003. Steps of .04-.05: more than twice today's.
- The light inset is **white** on a tinted shell, and light raised goes _darker_. That is the same law as §4.1.
- Shell `rounded-[1.375rem] p-1.5`, Panel `rounded-2xl`, IconTile `size-9 rounded-xl bg-foreground/[0.06]`; borderless.
- Status pill `bg-{tone}/15`, 20 or 24 px; neutral is `foreground/[0.07]`. Mono `Tag` is h-5, `rounded-md`, 11 px.
- Primary button is **silver**, not brand. `quiet` and `danger` variants; danger is tint + tone text.
- [J] Take the tint recipe, the neutral chip and the light-inset inversion. Reject its 22 px radii and gradients (button fills are `linear-gradient`) as too soft and too ornamental for a data-dense product.

## 3. Measured reference values [O]

| Surface                                                                                                                                                              | x-ref                                                                                            | HCT T                                                                                           | OKLCH L                                  | Note                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------- |
| App canvas                                                                                                                                                           | `#121212`                                                                                        | 5.5                                                                                             | .182                                     | Chroma 0 everywhere |
| Inset (data panel, toolbar, rows)                                                                                                                                    | `#171717`                                                                                        | 7.7                                                                                             | .205                                     |                     |
| Shell (header/footer bands)                                                                                                                                          | `#1c1c1c`                                                                                        | 10.3                                                                                            | .226                                     |                     |
| Icon tile, menu button                                                                                                                                               | `#262626`                                                                                        | 15.2                                                                                            | .269                                     |                     |
| Table head well                                                                                                                                                      | `#0a0a0a`                                                                                        | 2.7                                                                                             | .145                                     | Darker than canvas  |
| Ink                                                                                                                                                                  | Value                                                                                            | Where                                                                                           |
| -                                                                                                                                                                    | -                                                                                                | -                                                                                               |
| Primary                                                                                                                                                              | `#ffffff` T100                                                                                   | Title, figure, row name, footer value                                                           |
| Secondary                                                                                                                                                            | `#afafaf`-`#b5b5b5` T71.5-73.7                                                                   | Subtitle, comparison line, axis, footer label, header cell, sublabel: **one** ink for all of it |
| Colour                                                                                                                                                               | Value                                                                                            | Derived fact                                                                                    |
| -                                                                                                                                                                    | -                                                                                                | -                                                                                               |
| Green mark                                                                                                                                                           | `#00c883` HCT 158/62/71.5                                                                        | Dashed future `#007e53`: same hue dimmed                                                        |
| Delta tint on inset                                                                                                                                                  | `#0c3628`                                                                                        | About 17.5 % of the mark over `#171717`                                                         |
| Green booking bar                                                                                                                                                    | `#12382b`                                                                                        | Same tint family, ink label                                                                     |
| Amber lit bar / dim bar                                                                                                                                              | `#f0b100` / `#554311`                                                                            | Dim = lit at **28.6 %**                                                                         |
| Purple lit / dim                                                                                                                                                     | `#8d51ff` / `#38275b`                                                                            | Dim = lit at **28 %**                                                                           |
| Status dots                                                                                                                                                          | amber `#ffaa00`, red `#ff5c64`, green `#00c682`, violet `#8748ff`                                | About 7 css px                                                                                  |
| Geometry (css px)                                                                                                                                                    | x-ref                                                                                            | Console (`stat-card.tsx`)                                                                       | Today (basalt)                           |
| -                                                                                                                                                                    | -                                                                                                | -                                                                                               | -                                        |
| Shell radius                                                                                                                                                         | ~15 (arc fit on 30 orig px)                                                                      | 10 (`:113` `rounded-xl` via bridge `index.css:42`)                                              | card 10 (`tokens.css:4`)                 |
| Inset radius                                                                                                                                                         | ~10 (arc fit on 20 orig px)                                                                      | 6 (`:133`, `index.css:41`)                                                                      | "inset = control" (`DESIGN-CORE.md:160`) |
| Control radius                                                                                                                                                       | ~8-9                                                                                             | 6                                                                                               | ctrl 6 (`tokens.css:5`)                  |
| Delta badge radius / height                                                                                                                                          | ~4-5 / ~22                                                                                       | full pill / 24 (`:61`)                                                                          | no surface (`delta-badge.tsx:1-5`)       |
| Shell-to-inset gutter                                                                                                                                                | **0**: ring then inset directly at the left edge                                                 | 4 (`:113` `p-1`)                                                                                | n/a                                      |
| Ring                                                                                                                                                                 | 1 px, `#2a2a2a` on canvas (white ~10 %), `#2f2f2f` on shell (~8.4 %)                             | shell only, 4 % white (`tokens.css:118`)                                                        | same                                     |
| Header band / footer band                                                                                                                                            | 56 / ~31                                                                                         | 44 / ~34 (`:119-120`, `:158`)                                                                   | n/a                                      |
| Content left edge                                                                                                                                                    | Tile, figure, footer label, board title, "Today" all at the **same x**, 19.5 from the shell edge | 14 header and footer vs 20 body (`p-1` + `:119`, `:133`, `:158`): not aligned                   | n/a                                      |
| Card gap / section gap                                                                                                                                               | 18.5 / 18.5                                                                                      | n/a                                                                                             | 12 (`DESIGN-CORE.md:157`)                |
| Row                                                                                                                                                                  | 45.5 (two lines)                                                                                 | min 36 (`issue-row.tsx:28`)                                                                     | sm 13/20                                 |
| Control height                                                                                                                                                       | ~36                                                                                              | 32 (`ui/button.tsx:22`)                                                                         | ctl 32 (`tokens.css:17`)                 |
| Hero figure                                                                                                                                                          | ~30 (21.5 digit height)                                                                          | 30 (`--vx-text-display`)                                                                        | kpi 22 (`DESIGN-CORE.md:163`)            |
| Title / row text / meta                                                                                                                                              | ~15 / ~14 / ~13-14                                                                               | 15 / 13 / 12                                                                                    | 15 / 13 / 12                             |
| Not measurable from images: typeface identity (a neutral grotesque, not Nunito), and any light-mode value. No reference shows a light scheme except TuffUI's tokens. |

## 4. The surface model

### 4.1 One law

[J] **Inset steps away from the ink; raised steps toward the light.** The inset is the reading surface, so it is always the surface with the highest ink contrast within a shell. This single rule produces dark (inset darker than shell) and light (inset whiter than shell), matching x-ref in dark and TuffUI in light, and it removes the "two recipes per scheme".

```
canvas
  Shell            ring, no drop in dark
    Band           header: tile + title + subtitle + actions (no fill, shell shows)
    Inset          flush left and right, own ring, radius-inset; the data
      Band?        toolbar row sitting on the inset, hairline below
    Band           footer: stats or legend (shell shows)
```

- **Flush, gutter 0.** [O] Both x-ref and the podcast card; [J] it also spends no width on a 280 px card, and it is the only variant that holds a full-bleed table. The console's `p-1` is the outlier.
- **One shared left edge**: tile, figure, footer label, board title and toolbar's first control start at the same x. Console misses this (14 vs 20). This is cheap and is much of why x-ref looks ordered.
- **Max depth 2**: shell, inset. Nothing nests a shell in an inset. A third level is a band, not a box.
- A Shell with no header and no footer is not a shell. It collapses to a plain Inset-on-canvas panel.

### 4.2 Warm-gray ramp, targets

[J] HCT hue 70. Chroma 2.6 dark, 1.9 light, about 1 for the near-white inset. Constant-chroma `stone` (hue 70, chroma 4, `derive.ts:268`) computes to `#2a2520`, OKLCH C .0118, nearly twice Tailwind stone-900's .006 (`tailwindcss@4.3.4 theme.css:271`): that reads brown, not warm. The targets below match stone's chroma range.

| Role                                                                                                                                                                                                                                                  | Dark T  | Dark                  | Dark OKLCH    | Light T  | Light                 | Light OKLCH   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------- | ------------- | -------- | --------------------- | ------------- |
| canvas (also table head)                                                                                                                                                                                                                              | 12.5    | `#23201d`             | .246 .0072 67 | 96.5     | `#f8f4f1`             | .969 .0059 60 |
| inset                                                                                                                                                                                                                                                 | 15      | `#282522`             | .267 .0071 68 | 99.2     | `#fefcfb`             | .992 .0025 49 |
| shell                                                                                                                                                                                                                                                 | 19      | `#312e2b`             | .303 .0069 68 | 92.5     | `#ece9e6`             | .936 .0052 68 |
| raised (control, tile)                                                                                                                                                                                                                                | 24      | `#3c3835`             | .344 .0076 59 | 100      | `#ffffff`             | 1 0 -         |
| ring, over canvas / over shell                                                                                                                                                                                                                        | ink 9 % | `#35322f` / `#423f3c` |               | ink 12 % | `#dfdbd8` / `#d4d1ce` |               |
| Facts about those values [O, computed]: dark inset-to-shell step .036 OKLCH L (x-ref .021, today .016, TuffUI .040); light step .056; shell vs canvas .057 dark. Hue reads 59-74 at T<20 because 8-bit hex quantizes low chroma: rounding, not drift. |

- [J] **Why T12.5-24, not x-ref's T5-15.** The brief says "not too dark"; today's T15.7-17.6 is the range the owner already lives in. Canvas drops slightly so the shell can rise, and the whole range remains above x-ref's near-black.
- [J] Light is **not** near-white everywhere: shell T92.5 makes the frame visibly tinted while the data stays on near-white. Today's light (T95.6 and T98.3) is the washed-out half of the problem.
- [J] Table head reuses canvas. x-ref's darker-than-everything well (T2.7) is one more token for a small effect.
- Hover and selected stay the existing mix-toward-ink law (`derive.ts:313-316`, `:485-490`).

### 4.3 Inks

[O] Today's dark has four stops crowded at the top: 91 / 88.2 / 85 / 68.6, so three of the four are barely distinguishable. x-ref uses effectively two. [J] v3 ships **three**.

| Ink                                                                                                                                                                                           | Dark          | Light         | Use                                                                    | Lowest contrast on a text surface |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------- | ---------------------------------------------------------------------- | --------------------------------- |
| ink                                                                                                                                                                                           | T93 `#eeeae7` | T14 `#262321` | Titles, figures, row primary                                           | D 9.71 raised, L 12.91 shell      |
| muted                                                                                                                                                                                         | T72 `#b3b0ad` | T38 `#5c5956` | Subtitle, sublabel, axis, footer label, header cell                    | D 5.38 raised, L 5.75 shell       |
| faint                                                                                                                                                                                         | T62 `#999593` | T44 `#6b6865` | Disabled, weekend head, deemphasized meta; **inset/canvas/shell only** | D 4.55 shell, L 4.58 shell        |
| [J] Not pure white: T93 keeps the warm image and avoids halation on 13 px dense rows. The gate is ≥4.5 on canvas, inset, shell for all inks; faint is not allowed on raised (D 3.91, L 5.54). |

### 4.4 Radii, ring, shadow

| Token                | Value | Basis                                                       |
| -------------------- | ----- | ----------------------------------------------------------- |
| shell                | 14    | [O] x-ref ~15, console 10; [J] 16 reads soft at 280 px wide |
| inset                | 10    | [O] x-ref ~10                                               |
| ctrl, tile           | 8     | [O] x-ref 8-9                                               |
| chip, delta, id chip | 5     | [O] x-ref 4-5                                               |

- [J] Flush insets are not concentric with the shell (their corners are not at the shell's corners), so no concentric law.
- [J] Ring = ink-mixed 1 px inset box-shadow, keeping "ring in the shadow, never a border" (`DESIGN-CORE.md:115`), at 9 % dark and 12 % light. Today's dark 4 % (`palette.ts:102`) is under half of x-ref's 8.4-10 %: on the new steps a ring that weak disappears.
- [J] Drop shadow only on floating layers and a whisper under a shell in light. Dark shells cast nothing.

### 4.5 Spacing and density

[J] 4 px base; the `density` knob stays (-3..3). Level 0 targets:

| Item                                                                                                                       | Value                                     | vs x-ref      |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------- |
| Left edge (all bands and inset)                                                                                            | 16; 12 in a compact container             | 19.5: density |
| Header band                                                                                                                | 52 (tile 32)                              | 56            |
| Inset padding                                                                                                              | 14 y, 16 x                                | ~16-20        |
| Footer band                                                                                                                | 36                                        | ~31           |
| Toolbar band                                                                                                               | 48                                        | 56            |
| Table head                                                                                                                 | 32                                        | 36            |
| Row, one line / two lines                                                                                                  | 36 / 44                                   | - / 45.5      |
| Card gap / section gap                                                                                                     | 12 / 16                                   | 18.5          |
| Controls                                                                                                                   | ctl 32, dense 28 fine pointers, 44 coarse | ~36           |
| [J] x-ref is looser than a data-dense product wants. Keep our 32 and 13 px; the look comes from the anatomy, not the size. |

### 4.6 Typography

| Role                       | Spec                                               | Note                                        |
| -------------------------- | -------------------------------------------------- | ------------------------------------------- |
| Hero figure                | 30/1, sans 600, -0.02em, proportional lining       | [O] console `:135`; raises today's `kpi` 22 |
| Card / section title       | 15/20, 600, tight                                  | [O] console `:124`                          |
| Rows, sublabel, comparison | 13/20                                              | [O] console                                 |
| Axis, meta, badge          | 12/16, `tabular-nums` on axis                      | [O] console `:143`                          |
| Mono                       | 11-12, ids, timestamps, durations, machine strings | [O] podcast                                 |

- [J] **Five sizes, no more** (30, 15, 13, 12, 11 mono). The console's own review flagged about five type sizes (`shadcn-factory-console.md:128`), and the x-ref holds to about that.
- [J] Reverse `DESIGN-CORE.md:178` "metric captions are mono uppercase": x-ref's labels are sentence-case sans. Mono uppercase is for instrument strings only, where the podcast shows it working.
- [J] The fonts carry over (brief). But note the x-ref's grotesque is crisper than Nunito Sans: this is the one gap tokens cannot close. The console dropped Hubot for headings (`index.css:49`). Worth one screenshot round.

## 5. Colour

### 5.1 When colour is earned

Today's three reasons stand (`DESIGN-CORE.md:91-96`). [J] Add a fourth, which every reference uses and the doctrine only half-admits via "leader bar in meters" (`:36`):

| Reason                                                                                                                                                                                                                                                   | Treatment                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **Now** (current bucket, playhead, active point)                                                                                                                                                                                                         | Accent mark, exactly one per chart       |
| **Trend verdict** (a delta with a declared polarity)                                                                                                                                                                                                     | Tinted badge                             |
| **Status** (good/warn/bad state)                                                                                                                                                                                                                         | Dot + neutral label, or tint for a block |
| **Categorical** (2+ series in one frame)                                                                                                                                                                                                                 | Consumer's series map                    |
| none                                                                                                                                                                                                                                                     | Neutral                                  |
| Two tests that catch misuse [J]: _remove the colour; does anything lose meaning?_ and _could a neighbouring card have used a different hue for no reason?_ The x-ref fails the second on purpose (purple arrivals, amber departures); we do not copy it. |

### 5.2 The blue

[O] Seed `#0077bd` is HCT 268/44, but the shipped fill is `#4374a6` at chroma 31.8, because the law applies ×0.72 (`derive.ts:184,405`). `DESIGN-CORE.md:27` still calls this "saturated sky-blue": it is a muted steel, and the prose is wrong.
[O] At the fill band (T47.6), hues 245-258 clip at chroma 34-40; hue 262-272 reach 44. [J] Stay on the seed's hue 268 and move the vibrancy default up one step:

|                                                                                                                                                                                                                                                | Light fill / both-scheme fill                 | Dark ink                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------ |
| Today                                                                                                                                                                                                                                          | `#4374a6` oklch(.547 .095 250), 4.90 on white | `#a2c3f0`                |
| **v3 target (vibrancy +1, chroma ~38)**                                                                                                                                                                                                        | `#2f75b1` oklch(.547 .117 248), 4.88 on white | ~`#97c4fc`, 8.4 on inset |
| Ceiling (vibrancy +2, chroma ~44)                                                                                                                                                                                                              | `#0076bb` oklch(.547 .138 245)                | -                        |
| [J] Chroma 38 reads as a confident professional blue on warm gray; the ceiling starts to read as a consumer link blue. Warm neutrals also make a blue look more saturated than the same blue on zinc, so one step is probably enough.          |
| [O] Fill contrast on the new surfaces: inset 3.12 dark, 4.77 light; **shell 2.76 dark, below the 3.0 floor**. `clampFillTone` checks page backgrounds only (`derive.ts:414-426`). So the fill floor must test every surface a fill may sit on. |
| Spending the blue, in order: the now mark; focus ring; links; active-nav icon; checked state; determinate progress. Never a selected row or tab fill (kept: `DESIGN-CORE.md:39`).                                                              |

### 5.3 Status

Keep the hues and the solver (`status-text.ts:15-25,79-87`); targets already sit near x-ref's marks at lower chroma, which suits the brief ("never playful"). [O] Good is HCT 152/53/70 dark against x-ref 158/62/71.5.
**Required engine change [O]:** the solver tests text against surfaces (`status-text.ts:28-39`) but not against its own tint, which is where a delta badge paints it. Computed on the new insets:

| Tone on its tint                                                                                                                                                                                                       | Dark 16 % | Light 12 % | Light 16 % |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------- | ---------- |
| good                                                                                                                                                                                                                   | 4.96      | 4.53       | 4.26       |
| warn                                                                                                                                                                                                                   | 5.24      | 4.50       | 4.23       |
| bad                                                                                                                                                                                                                    | 4.73      | 4.57       | 4.29       |
| [J] Tint is **16 % dark, 12 % light**; add both as solver surfaces so the tone walks further if a retune requires it. x-ref's ~17.5 % is the dark upper bound. Console's flat 12 % (`tone.ts:14`) is too weak in dark. |
| Do not copy: x-ref's status red and violet at chroma 70-100; the orange; the purple. Purple "Confirmed" maps to the accent or neutral tint in our language.                                                            |

## 6. Delta badge

- 20-22 px high, radius 5, 12 px medium, `tabular-nums`, 4-6 px padding, 12-14 px arrow (bold), `gap-1`.
- Three states, one component:
  | State | Trigger | Look | |-|-|-|
  | Verdict good/bad | `polarity` declared and value non-zero | Tone tint, tone text, no ring |
  | No verdict | `polarity="neutral"` (arrivals +8 is not good or bad) | Chip: raised fill, ring, ink text |
  | Zero | value 0 | Chip, muted text, minus glyph |
- [O] x-ref does exactly this: Occupancy `+21.4pt` is tinted, Arrivals `+8` is a neutral chip.
- [J] **`polarity` is required, no default.** The console defaults `higherIsBetter = true` (`stat-card.tsx:47`), and today's `DeltaBadge` defaults to `'up-good'` (`delta-badge.tsx:79`): both turn "unknown" into "good" silently. A required prop is the cheapest guarantee in this document.
- [J] Arrow is direction, tone is verdict, kept separate (already so in `delta-badge.tsx:11`).
- Colour text on tint reverses `DESIGN-CORE.md:177` and `:200`; see §13.

## 7. Sparkline and bar encodings

All TanStack Charts kinds (brief). The console's hand-drawn `Sparkline`/`MiniBars` are the spec, not the implementation.

| Encoding  | Law                                                                                                                                                   |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bars      | Dim bars are ink at **34 % dark, 38 % light** (2.75:1 and 2.26:1 on inset). One bar lit                                                               |
| Lit bar   | Accent: `#97c4fc`-class ink dark, fill light. Defaults to the last bar or the "now" index                                                             |
| Bar shape | Rounded data end radius 3-4, square baseline (`mini-bars.tsx:22-25`), max 24 px, gap 2-4                                                              |
| Line      | 1.5-2 px; **neutral by default** (`DESIGN-CORE.md:54`), tone only when the card states a verdict                                                      |
| Area      | Single-hue vertical gradient fading to 0, not flat. [O] x-ref fades; the console's flat 10 % is called out as a gap (`shadcn-factory-console.md:128`) |
| Future    | Same colour dashed `4 4`, no area, dimmed; x label dashed-underlined [O] (`stat-card.tsx:151`)                                                        |

- [J] x-ref's 28 % gives 2.29:1 dark and, at 30 %, only 1.87:1 light. I raise it to clear ≥2:1 in both. Below 3:1 is acceptable only because each mini chart carries a tooltip plus hidden table (`README.md:9-12`); the gate should say this explicitly.
- [J] Exactly **one** highlight index: type it as `highlight?: number`, never an array.

## 8. Rows, boards, controls

### 8.1 Table row (x-ref's Room Board left half)

| Slot                                                                                                                                                                                               | Treatment                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Entity                                                                                                                                                                                             | Id chip (ring, 5 radius, 12 px; sans or mono), then two lines: name (ink 13), sublabel (muted 12-13) |
| Status                                                                                                                                                                                             | **6-7 px dot + ink label**: no pill, no tinted cell                                                  |
| Money / number                                                                                                                                                                                     | Right-aligned, tabular, ink                                                                          |
| Row action                                                                                                                                                                                         | Bare ⋯, shown at rest in x-ref; [J] hover-reveal on fine pointer, always on coarse                   |
| Divider                                                                                                                                                                                            | Hairline at low alpha between rows; never zebra                                                      |
| Head                                                                                                                                                                                               | Canvas fill, muted 12-13, no bold                                                                    |
| Group row                                                                                                                                                                                          | Chevron, group name (500), count (muted), optional micro-meter + `4/5`                               |
| [J] The dot + label pattern is the highest-value row idea: a table of tinted status pills is the fastest route to the "AI-generated" look, and the dot keeps status scannable at almost no chroma. |

### 8.2 Band toolbars

Left: time nav (`Today`, unit select, prev/next, range label). Right: search, `Filters`, active-date button. Fixed in x-ref as a band, not floating; every control in it is the same height and the same style. Maps to existing `PageBar`/`FilterSet` homes (`.claude/rules/basalt-controls.md:35-38`).

### 8.3 Timeline board [J]

Tonal bars (status tint ~18-20 %, **ink label**, 5 radius, ~70 % of row height); hatch only for "unavailable"; legend in the footer band. Do not ship this as a framework composite yet (§9).

### 8.4 Segmented control

[O] x-ref: 36 px track, ring, radius ~10, joined segments with a ring divider, active `#373737`, count chip in a segment. [J]:

- Track: control height, inset 2 px, ring, radius ctrl. Indicator: raised + ring, radius ctrl minus 2.
- Active ink, medium weight; inactive muted. No colour. Selection is never the accent (`DESIGN-CORE.md:39`).
- Count chip: 18-20 high, radius full (the only circle in the system besides dots), ring, 12 px tabular.
- Indicator may slide with a motion token on pointer changes, and jumps instantly on keyboard (TuffUI's rule is correct).

### 8.5 Buttons

| Tier                                                                                                                                                          | Look                                                                    | Rule                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------- |
| Primary                                                                                                                                                       | **Ink-inverted** (owner decision, §14): ink fill, canvas-coloured label | At most one per region              |
| Secondary                                                                                                                                                     | Raised fill + ring, ink label                                           | Default for actions                 |
| Ghost                                                                                                                                                         | No fill, muted label, hover raised                                      | Icon rows, menus                    |
| Danger                                                                                                                                                        | Bad tint + bad text                                                     | Destructive only; never a solid red |
| Icon-only uses the same tiers. [O] x-ref: `Reserve Room` near-white on dark, `Block Room` ringed; TuffUI primary is silver. Icons 16, 6 px gap, `ctl` height. |

## 9. Framework composites

| Pattern                                                         | Verdict                            | Implementation note                                                                       |
| --------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `Shell`, `Band`, `Inset`, `IconTile`                            | **Framework primitives**           | All composites compose these; consumers can too                                           |
| `StatCard`                                                      | **Composite**                      | Console anatomy, `polarity`, one `highlight`, `futureFrom`, `chart` slot                  |
| `DeltaBadge`                                                    | **Composite**                      | §6, reworked                                                                              |
| `MiniBars`, `Sparkline`                                         | **Chart kinds on TanStack Charts** | Shared hover/keyboard/hidden-table contract                                               |
| `DataPanel` (header band + toolbar band + body + legend footer) | **Composite**                      | The Room Board frame without the board; hosts tables, charts, boards                      |
| `Status` (dot + label), `IdChip`, count chip                    | **Primitives**                     | Tone from an explicit map, never derived from a word (`tone.ts:1`, `lozenge.tsx:21`)      |
| `Segmented` with counts                                         | **Control**                        | Bound to a store field as today                                                           |
| Column kinds: `entity`, `status`, `number`, `money`             | **Table**                          | Row anatomy of §8.1 as column kinds (exist today, `.claude/rules/basalt-batteries.md:31`) |
| Timeline / room board                                           | **Not framework**                  | No named consumer; the adopt-or-delete doctrine says wait. Teach it in a skill            |

## 10. Honest comparison with today

|                     | Today (zinc/sky output) [O]             | Target [J]                    | Who wins and why                                                   |
| ------------------- | --------------------------------------- | ----------------------------- | ------------------------------------------------------------------ |
| Neutral             | T15.7/17.6, hue 291, chroma 2: cool     | Hue 70, warm                  | Brief                                                              |
| Card vs page, dark  | .016 OKLCH L                            | .036 inset to shell           | v3; today's step is below what reads                               |
| Card vs page, light | T95.6 to T98.3                          | T92.5 shell, near-white inset | v3; today is washed out                                            |
| Nesting             | None in the token model; `Card.Section` | Shell/Band/Inset              | v3                                                                 |
| Accent              | Steel `#4374a6`; docs call it sky       | `#2f75b1`, same hue           | v3, modestly                                                       |
| Radii               | 10 / 6                                  | 14 / 10 / 8                   | Taste call; today reads sharper, v3 reads closer to the references |
| Delta               | Text only: quiet, disciplined           | Tinted badge                  | Owner's call; today's is arguably the more austere                 |
| Derivation          | HCT engine with solved contrast         | Same engine                   | **Today's strongest asset; references have nothing like it**       |

## 11. How it stays derivable

The seed/knob engine survives. It changes constants and roles, not its model.

| Knob                                                                                                                                                                                                                                                                                                                            | v3                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accent`                                                                                                                                                                                                                                                                                                                        | Unchanged (`#0077bd`, only hue used, `derive.ts:20-25`)                                                                                                                                                              |
| `neutral`                                                                                                                                                                                                                                                                                                                       | Presets become `warm` (new default), `neutral` (reference-exact, chroma 0), `cool` (today's zinc); drop `stone`/`slate`. Each is `{hue, chroma: {dark, light}}`, because constant chroma is what makes `stone` brown |
| `lightLevel` / `darkLevel`                                                                                                                                                                                                                                                                                                      | Unchanged; shifts every role. Drop the baked `+2` so the table above is level 0                                                                                                                                      |
| `vibrancy`                                                                                                                                                                                                                                                                                                                      | Unchanged; recenter so level 0 = today's +1 (×0.864)                                                                                                                                                                 |
| `accentBrightness`                                                                                                                                                                                                                                                                                                              | Unchanged                                                                                                                                                                                                            |
| `radius`                                                                                                                                                                                                                                                                                                                        | Anchors become shell/inset/ctrl/chip (14/10/8/5 + level)                                                                                                                                                             |
| `density`, `fonts`                                                                                                                                                                                                                                                                                                              | Unchanged                                                                                                                                                                                                            |
| Roles [J]: `SURFACE_TONE` shrinks from 8 authored stops (`derive.ts:287-308`) to canvas, inset, shell, raised. `panelHover`, `subtle`, `elevated`, `field` and the two border stops collapse into raised, ink-mix, or the ring. Ring = `color-mix` of ink, so no new hex exists. Three inks replace four (`derive.ts:328-335`). |
| Laws to add, each a test in `tokens/`, computed for every knob level, in the same style as the existing derive grid:                                                                                                                                                                                                            |
| Gate                                                                                                                                                                                                                                                                                                                            | Threshold                                                                                                                                                                                                            |
| -                                                                                                                                                                                                                                                                                                                               | -                                                                                                                                                                                                                    |
| Every ink on canvas, inset, shell                                                                                                                                                                                                                                                                                               | ≥4.5 (faint excluded from raised)                                                                                                                                                                                    |
| Status text on surface and on own tint                                                                                                                                                                                                                                                                                          | ≥4.5, solved                                                                                                                                                                                                         |
| Accent fill on every surface it may occupy                                                                                                                                                                                                                                                                                      | ≥3.0, or the fill is not allowed there                                                                                                                                                                               |
| Shell vs inset step                                                                                                                                                                                                                                                                                                             | ≥.03 OKLCH L in both schemes                                                                                                                                                                                         |
| Dim bar on inset                                                                                                                                                                                                                                                                                                                | ≥2.0                                                                                                                                                                                                                 |
| Now mark on inset                                                                                                                                                                                                                                                                                                               | ≥3.0                                                                                                                                                                                                                 |
| Output format: keep hex from HCT (tone is WCAG luminance, `derive.ts:102-105`; OKLCH lacks that). Tailwind and shadcn accept it unchanged. OKLCH is the human-readable report format only.                                                                                                                                      |

## 12. The four questions

|                | Answer                                                                                                                                                                                                                                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Implement**  | Four-role ramp + three inks + ring in `derive.ts`; Shell/Band/Inset primitives; StatCard, DeltaBadge, DataPanel, Status, IdChip, Segmented; MiniBars/Sparkline on TanStack Charts; table column kinds following §8.1                                                                                                                                                           |
| **Guarantee**  | Derivation gates (§11). `polarity` required; `highlight` single-valued. Lints: raw `rounded-*`, `shadow-*`, `border-*`, `bg-*` on composites; raw Tailwind palette classes (`bg-blue-500`); `Inset` outside `Shell`; `Shell` nested in `Shell` or `Inset`; `accentFill` outside the allowed list; one primary per region. Screenshot reviewer scores against the reference set |
| **Teach**      | `basalt-design` gains: the four reasons for colour with the two misuse tests; StatCard anatomy; dot + label over pills; "what the references do that we do not". Anti-defaults list: hue-per-card, tinted status cells, coloured left bars (console `DESIGN.md:92`), serif/mono display figures                                                                                |
| **Leave open** | Accent seed, neutral preset, levels, vibrancy, radius, density, fonts; series colours; icons; footer pairs; card `chart` slot; timeline boards and any domain visual                                                                                                                                                                                                           |

## 13. Doctrine that must change on purpose

| Today                                                                                                                                                                                                    | Change                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DESIGN-CORE.md:26-32` zinc identity, "saturated sky-blue"                                                                                                                                               | Warm neutral; describe the real blue                                                                                                                                                                                            |
| `DESIGN-CORE.md:36` accent on primary buttons                                                                                                                                                            | Pending owner decision (below)                                                                                                                                                                                                  |
| `DESIGN-CORE.md:115-127` elevation tiers                                                                                                                                                                 | Replace with §4.1                                                                                                                                                                                                               |
| `DESIGN-CORE.md:129,160` radius 10/6, "tighter than the reference"                                                                                                                                       | §4.4                                                                                                                                                                                                                            |
| `DESIGN-CORE.md:177,200` "deltas are text colour, never a fill"                                                                                                                                          | Reversed by the brief's delta badge                                                                                                                                                                                             |
| `DESIGN-CORE.md:178` mono uppercase captions                                                                                                                                                             | Sans sentence case; mono for machine strings                                                                                                                                                                                    |
| `palette.ts:115-133` light controls carry no edge ("both shapes have been tried")                                                                                                                        | **Risk**: the x-ref look needs ringed light controls, which this comment says failed on zinc. Re-test on the warm ramp before concluding. It may stand, in which case light controls get drop-only and the ring stays on shells |
| Carry unchanged: the five principles (`DESIGN-CORE.md:49-64`), three-tier tokens, accent never marks selection, neutral single-series sparkline, `alpha()` over `rgba()`, the three-axis responsive law. |

## 14. Open decisions and risks

- **Primary button: ink-inverted or blue.** Both references that show a primary use ink or silver, and it frees the blue for data; it also sidesteps the dark-shell 2.76 fill failure. It reverses `DESIGN-CORE.md:36` and argo's current look. My tendency: ink-inverted.
- **Flush inset vs the console's 4 px gutter.** Tendency: flush. If the owner prefers the console's rim, it is one token.
- **Dark level.** T12.5/15/19 is computed from the brief's words. The owner should pick by eye; `darkLevel` moves it.
- Risk: no target here has been seen on a screen. Warmth at low chroma especially may read differently on the owner's 1800x1200 display than the arithmetic suggests.
