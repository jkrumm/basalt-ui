# TuffUI: how its visualizations are built

Read on 2026-11-12 at `d9c5cc3` of `github.com/yurigdesigner/tuffui` (MIT). 28 components read in full. This file records devices and numbers, no source. It feeds `docs/v3/EXPRESSION.md`.

Builders in an expression cycle do not read this file.

## Substrate

| Fact              | Value                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| Chart library     | None. Dependencies for drawing are `motion` and Radix                                                            |
| Canvas            | None                                                                                                             |
| SVG               | Anything with angles, curves or free coordinates                                                                 |
| HTML and CSS grid | Grid-shaped data: heatmap, eval cells, context cells, usage bars, the flame graph                                |
| Sizing            | A measured width (one resize hook copied into 14 files), a fixed viewBox for polar charts, or container queries  |
| Shared code       | About 120 lines: `Shell`, `Panel`, `Inset`, `ShellHeader` with an `aside` slot, five motion constants, `cn`      |
| Bespoke code      | 13,303 lines in 25 files, about 530 each                                                                         |
| Copied helpers    | The resize hook 14 times, `round` 11, `polar` 5 with two angle conventions, "nice" ticks 3 with three algorithms |
| Distribution      | A shadcn registry, one file per install, which is why helpers are copied                                         |
| Pace              | 18 commits, about two components a day                                                                           |

## The twelve devices

1. **The case's own metaphor as the form.** Stopwatch sectors for a pipeline run, a race track for competing evals, a 12-month clock face for renewals, hop rings for an incident's reach.
2. **A hero number bound to the active mark.** The centre or header number swaps to the hovered item and returns to the total.
3. **A delta against a named baseline.** "−0.8 s vs best lap", with a real minus sign, coloured only when the direction means good or bad.
4. **A colour budget.** A neutral ramp, one accent for focus or live, one status hue for the problem. Colour says state. Magnitude takes another channel: the heatmap shows volume as fill height so that red stays free for failures.
5. **Quantized marks with a unit caption.** "1 dot = 4 events". Empty slots stay visible, and any non-zero value gets at least one mark.
6. **A threshold as geometry.** Histogram bins align so the threshold falls on a bin edge; the hex grid shifts so the cut-off runs between rows. Each side is counted.
7. **Pre-annotation.** The callout already points at the latest regression or the densest bin before anyone hovers: "failing since 10:59".
8. **Direct labels with collision logic.** Two-row label packing, axis labels that drop instead of colliding, a radar radius solved to fit its labels.
9. **Live cues.** A pulse on the live end, rolling digits, stripes on a period that has not ended.
10. **Dim-the-rest focus.** Unfocused marks drop to 0.3 to 0.6 opacity. Hit areas are larger than the marks.
11. **Keyboard parity.** One tab stop per chart, arrows, Home, End and Escape, a live readout for screen readers, a hidden data table. Keyboard changes never animate.
12. **A fixed anatomy around the mark.** Header with an icon tile, title, subtitle and a status pill; one inset panel; a stat strip below whose swatches repeat the mark's colours. Tonal layers, no borders, no shadows.

Two habits sit under all twelve. Demo data is modelled on the domain and seeded: a daily traffic curve, a scripted outage with HTTP statuses. And several components prefer a fixed readout (a centre number, a split table) to a tooltip.

## Where it is weaker than basalt-ui must be

| Weakness   | Evidence                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| Scales     | Linear only, no negative domain; `dot-histogram.tsx:104` crashes on negative samples; most charts have no y axis |
| Geometry   | Text width estimated at 6.2 to 7.3 px per character; fixed plot heights and tooltip widths                       |
| Tokens     | Hex colours in 9 files; an easing used by 7 components is defined only in the site's CSS                         |
| Motion     | `run-trace.tsx:219` pulses under reduced motion; `iso-bars.tsx:472` never plays its exit                         |
| States     | No loading or error state; an empty state in 4 components                                                        |
| Locale     | en-US and UTC hard-coded                                                                                         |
| SSR        | The 14 measured charts render hidden until the client measures them                                              |
| API        | Domain-typed props, no accessors, a frame that cannot be removed                                                 |
| Safety net | No tests, no visual regression                                                                                   |

## Local material

Not in git: 35 reference shots and the full 463-line inventory under `.claude/shots/tuffui-ref/` in the main checkout on the dev host. A missing shot is re-taken from `https://tuffui.com/components/<slug>` at 1440x1000.
