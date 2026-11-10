# Spike: token surfaces (S2 ring, S3 input boundary)

Both spikes refute the concept default. The light `secondary` ring adds a second edge on every warm-ramp surface, and the hairline input boundary measures 1.19:1 light and 1.24:1 dark, against a 3.00:1 bar. The table changes both name are under Then.

Harness: `bun tools/spikes/token-surfaces/run.ts` (one JSON object on stdout, always exit 0). Concept: `docs/v3/concepts/tokens-visual.md` section 8, S2 and S3.

## Question

- **S2.** Does the light `secondary` (`raised` fill plus `hairline` ring) read as a double edge on the warm ramp? The 2.x comment says rings failed on zinc. Refuted if it does: a light drop-only pair, a table change.
- **S3.** Does the input boundary, `--color-input` = the hairline, meet WCAG 2.2 SC 1.4.11 against the surface it sits on? The concept measured about 1.3:1 and never audited it. Refuted if it fails: add a `--vx-input` pair.

The 3.00:1 bar is this Issue's conservative reading of SC 1.4.11. The concept did not audit whether a labelled, bordered input needs it, so a waiver as not applicable is the owner's call, not this spike's.

## Method

Colours are the warm ramp of concept section 3.3. Section 3 gives no hex for the hairline, so the spike uses the ink alpha the evidence defines: 9% light, 8% dark (`evidence/self-tokens-theme.md` item 7, carried as `--vx-hairline` by `static-framework-free.md`). Ink is T14 light and T93 dark with the canvas's hue and chroma, `#262321` and `#efeae6`. The boundary pixel is that ink alpha composited over the surface, per 8-bit sRGB channel, which is what `color-mix(in srgb, ink N%, transparent)` paints. Ratios come from `contrastRatio` in `src/tokens/hct.ts`, read only.

**S2, rule fixed before measuring.**

- Chrome (the `chrome` channel via playwright-core, as the layout harness does), 2x device scale, light scheme.
- A 120 by 32 button, radius 6, `raised` fill, at an integer css position, rendered with and without `box-shadow: 0 0 0 1px <hairline>` (outside placement).
- The pixel column through the button's centre, 6 device rows (3 css px) centred on the top edge.
- `edgeSteps` is the number of adjacent-pixel steps of 0.02 or more in relative luminance.
- Headline surface is `card` (where control bands live, and the only surface where both the fill step and the ring are real); `canvas` and `inset` are reported alongside.
- `ringVsSurface` is the ring pixel against the surface behind the control. `ringVsHairline` is the ring pixel against the other hairline a control meets on a card, the `Inset`'s own (hairline over `inset`).
- Rendered ring pixels were compared to the computed ones and match on all three surfaces.

**S3.** The boundary (hairline over surface S) against S, for S in canvas, inset, card, raised, both schemes. `s3.light` and `s3.dark` are the minima. `alphaFor3` is informational: the smallest ink alpha that reaches 3.00:1.

## Measurements

**S2, light, with ring on `card`.** Column, in relative luminance, top to bottom: `0.818, 0.683, 0.683, 1, 1, 1` (card, ring, ring, fill). Without the ring: `0.818, 0.818, 0.818, 1, 1, 1`.

| Quantity                 | Value                 |
| ------------------------ | --------------------- |
| `s2.ringVsSurface`       | 1.19                  |
| `s2.ringVsHairline`      | 1.18                  |
| `s2.edgeSteps` with ring | 2 (0.1356 and 0.3174) |
| `edgeSteps` without ring | 1 (0.1818)            |

| Surface | Steps with ring    | Steps without ring |
| ------- | ------------------ | ------------------ |
| canvas  | 2 (0.1523, 0.2422) | 1 (0.0899)         |
| inset   | 2 (0.1651, 0.1885) | 1 (0.0234)         |
| card    | 2 (0.1356, 0.3174) | 1 (0.1818)         |

**S3, boundary against surface (ratio).**

| Scheme | canvas | inset | card | raised | min  |
| ------ | ------ | ----- | ---- | ------ | ---- |
| light  | 1.19   | 1.19  | 1.19 | 1.19   | 1.19 |
| dark   | 1.24   | 1.25  | 1.25 | 1.24   | 1.24 |

Ink alpha that reaches 3.00:1 (`alphaFor3`): light 0.48 to 0.50, dark 0.36 to 0.41, depending on surface. Today's 9% and 8% are about a fifth of that.

Caveat on S2. A one-pixel ring of any visible colour has two sides, so a window that spans the whole ring sees a step down and a step up. The metric therefore answers "does the ring add an edge beyond the fill step", which is the question as filed, but it does not say how loud that edge is. On `inset` the no-ring baseline is a single 0.0234 step: there the ring is the only edge, not a second one.

## Verdict

S2: REFUTED
S3: REFUTED

Verdict: REFUTED

S2 by the rule: two steps, both at or above 0.04 (0.1356 and 0.3174 on `card`; the same on `canvas` and `inset`). S3 by the rule: 1.19 and 1.24, both under 3.00.

## Then

`tok-t2` takes the following into the table. This spike names the changes and makes none.

- **S2.** Take the light drop-only pair for `secondary`: the `raised` fill with a shadow and no ring, as the 2.x palette does (`palette.ts` light card shadow carries the ring, raised is drop only). The ring on `inset` and `canvas` is closer to a plain outline than a second edge, so the owner may still prefer to keep it there; that is a judgement on the rendered artifact (`v3-verdict-statcard`, non-blocking), not a measurement.
- **S3.** Add a `--vx-input` pair (light and dark) and point `--color-input` at it. The boundary needs roughly 50% ink light and 41% dark to clear 3.00:1 on the worst surface, a much heavier line than the 9%/8% hairline, so the pair is a deliberate value, not a scaled hairline. Whether a labelled bordered input needs 3.00:1 at all is the owner's call (waiver as not applicable); if waived, S3 stays on the hairline and the 1.19 and 1.24 above go into the concept as the known figures.

## Affects

- `docs/v3/concepts/tokens-visual.md`: section 3.2 (`secondary` alias, `Line` row, 74 of 90 names, adding `input` makes 75), section 7 (the U risk on the input hairline) and section 8 (S2 and S3 rows). Frozen here; changed by `tok-t2`.
- `tok-t2-table` (blocked on both spikes).
- The 90-name budget: `--vx-input` costs one name.
- Gates: a `--vx-input` pair needs a PAIRS entry against the four surfaces in both schemes.

Proof shots at 1800x1200 and 390x844, light and dark, are under `tools/spikes/token-surfaces/shots/`. Each panel shows a ringed secondary, a plain secondary and an input boundary on one surface.
