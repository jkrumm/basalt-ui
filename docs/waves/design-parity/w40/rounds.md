# Wave 40 — argo's friction V: one round on S2, S3, S4 and the components

Scored with Wave 37's calibrated setup ([../w37/setup.md](../w37/setup.md)), unchanged, by three fresh `basalt-design-reviewer`
subagents (S2; S3; S4 with the components), each told to check the Wave 40 focus rows explicitly. Board:
`.design-parity/w40/r0/` (gitignored). Images never enter git.

| Route       | w39 r2 | r0 (`7ab0de3d`) |
| ----------- | ------ | --------------- |
| S2 training | 99     | 99              |
| S3 agents   | 98     | 98              |
| S4 spend    | 98     | 98              |
| components  | 99     | 99              |

728 shots, 0 failed, detector 100.

## Round 0 — #457, #458, close-out

No new defect; fixed 0, every item carried from w39 r2, all P3: the pending `ChartCard` legend row (S2 hit-rate, S3 item-flow at
390, S4 spend-over-time), the S3 failures readout on an unmarked zero bin, the S4 spend-over-time tooltip over the forecast/budget
crossing, the components table loading headers at 390 (Wave 42).

Focus rows: the Agents oldest-wait Meter at 390 shows `Warn 24 h` and `Abandoned at 7 d` a clear gap apart (S3); tooltips stay
below the headline facts (S2 hit-rate, S3 item-flow, S4 spend-over-time). Not provable from shots: the slotted `Bars` chip
against its focus ring (focus crops target the info icon) and the hosted Sparkline readout at 390 (mobile hover is skipped);
both are proven by layout tests (`charts-w39-readout`, `strip-anatomy-w39`).

Against Keel: S2 close, S3 close, S4 close, components holds up.
