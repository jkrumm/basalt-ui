# Wave 39 — argo's friction IV: rounds on S2, S3, S4 and the components

Scored with Wave 37's calibrated setup ([../w37/setup.md](../w37/setup.md)), unchanged, by three fresh `basalt-design-reviewer`
subagents per round (S2; S3; S4 with the components), each told to check the Wave 39 focus rows explicitly. Boards:
`.design-parity/w39/r<n>/` (gitignored). Images never enter git.

| Route       | w38 r4 | r0 (`370a1887`) | r1 (`afad8fbb`) | r2 (`99f3ffcf`) |
| ----------- | ------ | --------------- | --------------- | --------------- |
| S2 training | 93     | 100             | 99              | 99              |
| S3 agents   | 94     | 96              | 98              | 98              |
| S4 spend    | 99     | 98              | 97              | 98              |
| components  | 99     | 96              | 96              | 99              |

All three rounds: 728 shots, 0 failed, detector 100.

## Round 0 — baseline (master after #442–#444)

S2 passes (its r4 items fixed by #444). Open: the S3 strip ~20 px ragged at 1440 (P2) and its failures readout with no marked bin
(P3); the S4 strip ragged (P3) and spend-over-time loading without its legend row (P3); the components table error void (P2,
playground) and its 390 loading headers (P3, Wave 40). None of argo's Wave 39 rows reproduce on the playground (no narrow-span
zoned Meter at 390, no `+N` fold, no tooltip leaving a card), so those are proven by layout tests on argo's compositions instead.

## Round 1 — #448–#451

Fixed: the S3 strip anatomy (#449). New: the S2 goal Meter's start figure took a second caption row at 390 (#451 leaking into the
caption row; fixed by #454). Still open: the S4 strip ~18 px ragged (a Meter with captions above its track; fixed by #455), the
failures readout, the loading legend rows (S4 spend-over-time; item-flow at 390 named now), the table void.

## Round 2 — #452–#455, close-out

Fixed: the goal caption row, the S4 strip, the table error void. No P0, P1 or P2 on any route. Remaining, all P3, all named:

- a pending `ChartCard` has no legend row (S2 hit-rate, S4 spend-over-time, S3 item-flow at 390) — ruled out of this wave: a
  `ghostLegend` prop was rejected (a second description of the chart), and letting the chart child draw its own pending body needs
  every chart in a card to tolerate pending data;
- the S3 failures readout shows no mark for a zero bin in the hover crop, although #452 adds a hover-only baseline marker — check
  the shot's hover target before the next round;
- the S4 spend-over-time tooltip covers the forecast/budget crossing at 15–18 Oct;
- the components table loading headers wrap at 390 (Wave 40).

Against Keel: S2 close (r0: holds up), S3 close, S4 close, components holds up.
