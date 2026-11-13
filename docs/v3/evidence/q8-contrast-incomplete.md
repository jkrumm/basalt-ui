# Q8: colour-contrast `incomplete` nodes, sampled from rendered pixels

Source: `tools/spikes/motion-contrast/run.ts` (two runs, byte-identical stdout, `tools/spikes/motion-contrast/results/`). Verdict doc: `docs/v3/spikes/motion-contrast.md`.

## Counts

| Field             | Value                                                 |
| ----------------- | ----------------------------------------------------- |
| population        | 2,221 axe `color-contrast` `incomplete` nodes         |
| sampled           | 2,207                                                 |
| pass              | 1,948                                                 |
| fail              | 259                                                   |
| unresolved        | 14 (all `zero-sized`: empty inputs, axe `emptyValue`) |
| incompleteCeiling | 2,333 (2,221 x 1.05, rounded up)                      |

The population is **below the filed 3,694**: axe `color-contrast` only, page scan only (no overlays opened), over the 2.x playground's routes x the `BASALT_MATRIX=full` cells (1800x1200 and 390x844, light and dark, plus the 390 dark pseudo-locale cell). The filed 3,694 was counted across other specs. The ceiling above is for this population; the axe gate's ceiling on the count is set from it.

axe `messageKey` of the population: `elmPartiallyObscured` 1,105; `imgNode` 803; `shortTextContent` 138; `bgGradient` 51; `bgOverlap` 35; `nonBmp` 63; `emptyValue` 14; `equalRatio` 12.

## Method

Per node: scroll it into view, make its text (and descendants') transparent, screenshot the union of its text-node rects, take as background the pixel whose luminance is farthest from the text colour, ratio = contrastRatio(text colour composited at its alpha and ancestor opacity over that pixel, that pixel). `pass` >= 4.5 (>= 3.0 for large text: 24 px, or 18.66 px bold); SVG text reads `fill`. `unresolved`: zero-sized, off-screen, over video or canvas, gradient text, animating, frame or shadow targets. The farthest pixel is the worst case inside the text rect, so a `pass` holds for every pixel behind the text.

## Failing nodes by owner

The run's JSON carries the aggregates (`failsByRoute`, `failsByColours`) and the first 20 failing nodes; the per-owner rows below come from the run's stderr, one `q8 fail <route> | <cell> | <target> | <fg> on <bg> = <ratio>` line per node, which is not committed. Re-run `bun tools/spikes/motion-contrast/run.ts 2>q8.log` to regenerate it.

| Colours (text on background)                            | Ratio        | Nodes | Where                                                                                                     | Owner                                                                                            |
| ------------------------------------------------------- | ------------ | ----- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `#a7a7aa` on `#fafafd`                                  | 2.30         | 114   | `/charts` light, desktop + phone: every axis tick label (`--vx-axis`)                                     | charts: the axis text token needs >= 4.5 on the card surface                                     |
| `#a7a7aa` on `#f2f2f5`                                  | 2.15         | 46    | `/gallery` (42), `/scenarios/s1-ops` phone table heads (4)                                                | tokens: muted text on the page surface; table head                                               |
| `#d4d4d8` on `#f2f2f5`                                  | 1.25 to 1.62 | 33    | `/gallery`                                                                                                | legacy 2.x gallery                                                                               |
| `#262629` on `#2b2b2e`, `#2a2a2d`                       | 1.05 to 1.07 | 24    | `/gallery` light cell, dark ink on dark fill (Mantine scheme not following)                               | legacy 2.x gallery                                                                               |
| `#a7a7aa` on `#2b2b2e`                                  | 3.80         | 10    | `/gallery` dark                                                                                           | legacy 2.x gallery                                                                               |
| `#52c07c` on `#f2f2f5`                                  | 2.05         | 9     | `/gallery` (status green as text)                                                                         | legacy 2.x gallery                                                                               |
| `#fe8178` on `#f2f2f5`                                  | 2.18         | 4     | `/gallery`                                                                                                | legacy 2.x gallery                                                                               |
| `#5190f7` on `#2f3a35`                                  | 3.76         | 2     | `/gallery`                                                                                                | legacy 2.x gallery                                                                               |
| `#ffffff` on `#f2f2f5`, `#a1a1a5` on `#f2f2f5`          | 1.12, 2.30   | 3     | `/gallery`                                                                                                | legacy 2.x gallery                                                                               |
| `#5190f7` on `#2b2b2e`                                  | 4.49         | 2     | `/overview` dark and light cell: SVG text `var(--vx-demo-sessions)`                                       | charts: series colour 0.01 under 4.5                                                             |
| text colour equals sampled pixel (`#262629`, `#e5e5e9`) | 1.00         | 12    | `/`, `/shell`, `/scenarios/s1-ops`: the rail `shell-rail-avatar` initials and the account `sr-only` label | shell: the text sits on a pixel of its own colour; inspect on the rail before trusting the ratio |

`/gallery` is the 2.x specimen page the matrix already lists as known (`known.ts`); 127 of the 259 fails are on it and go with the legacy barrel. The 132 outside it belong to charts (116: axis ticks, series text), tokens (the muted text step, 4 table heads) and shell (12).

## Consequence

`q8.fail` is 259, so the hypothesis "no incomplete node fails" is refuted: the `incomplete` count cannot stand as a bare ceiling. Coverage of colour-contrast stays "not covered" and the ceiling (2,333) holds only until the failing owners above fix their tokens; the axe gate should also carry the `--vx-axis` and muted-text findings as known entries.
