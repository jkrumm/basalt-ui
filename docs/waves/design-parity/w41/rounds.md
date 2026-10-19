# Wave 41 — argo's friction VI: one round on S2, S3, S4 and the components

Scored with Wave 37's calibrated setup ([../w37/setup.md](../w37/setup.md)), unchanged, by three fresh `basalt-design-reviewer`
subagents (S2; S3; S4 with the components), each told to check the Wave 41 focus rows explicitly. Board:
`.design-parity/w41/r0/` (gitignored). Images never enter git.

| Route       | w40 r0 | r0 (`b9938a71`) |
| ----------- | ------ | --------------- |
| S2 training | 99     | 90              |
| S3 agents   | 98     | 89              |
| S4 spend    | 98     | 89              |
| components  | 99     | 99              |

728 shots, 0 failed, detector 100.

## Round 0 — #461, #462

The drop is scoring, not rendering: the r0 focus crops were pixel-identical to w40's, which never named them. One cause behind all
nine new P2s: a `StatCard` or strip cell (`CaptionRow`) opened its info bubble under the caption, over its own headline value and
delta (S2 sessions/volume/distance; S3 failures/fleet/dispatch-spend; S4 month-to-date/forecast/budget). #461 had cleared only
`WidgetHeader` roots. Fixed after the round by #463 (an internal `data-basalt-header-block` on the StatCard header and the strip
cell head), proven by layout cases failing first; not re-scored (one round by budget).

Fixed in r0: every `ChartCard` bubble now opens below the title and facts (S2 goal/training-load/hit-rate/readiness/top-lifts, S3
item-flow, S4 spend-over-time/distribution/by-project/top-drivers); w40's item-flow bubble over "35 closed" was a miss in w40's
summary. Carried P3s: the pending legend rows (S2 hit-rate, S3 item-flow at 390, S4 spend-over-time), the S3 failures readout on
an unmarked zero bin, the S4 tooltip over the forecast/budget crossing, the components table loading headers at 390 (Wave 42).

Not provable from shots: the slotted `Bars` chip against its ring and the plot focus ring (focus crops target the info glyph; the
playground has no slotted `Bars` strip). Both are proven by `charts-w41-chip.layout.test.ts` on argo's composition. Not scored: at
390 a strip bubble slides sideways over the neighbouring cell, and ChartCard bubbles lie over body rows (plot/list).

Against Keel: S2 close, S3 close, S4 close (the strip bubble decides it), components holds up.
