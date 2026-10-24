# Expression trial v7 (Wave 53)

**Why it ran:** #555 changed shipped guidance (the `basalt-charts` rule's `formatX` line), so the trial re-tests it.

**Setup:** v6's, unchanged ([../w52/expression-trial-v6.md](../w52/expression-trial-v6.md)): `scripts/trial-data.ts`
(seed 50) and [../w50/trial-prompt.md](../w50/trial-prompt.md) as committed, a `mktemp -d` app outside every repo, a
tarball packed from `master` at `b94c96e2` (#555, #556), `basalt-ui init`. A fresh headless Claude Code on Sonnet
(`claude -p --model sonnet`, `CLAUDE_CODE_SUBAGENT_MODEL=sonnet`), ~6 min of API time. Scored by a fresh
`basalt-design-reviewer` on Sonnet over `basalt-ui shot /overview` of the final build: 106 shots, 0 failed; `shot
detect` 100, 0 findings.

## Result

| Question                    | Answer                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| Dates                       | `date(d, { format: 'medium', timeZone: 'UTC' })` from `basalt-ui/format`: the new rule line |
| `dist` look-ups             | 10 (v6 9)                                                                                   |
| Calibrated score (argo bar) | **~85** (v6 58), **provisional**: the scorer opened the 5 sheets and 4 page shots, 9 of 106 |

| Severity | basalt | app | total |
| -------- | ------ | --- | ----- |
| P1       | 0      | 0   | 0     |
| P2       | 1      | 0   | 1     |
| P3       | 4      | 4   | 8     |

v6: P1 0, P2 4 (basalt 2, app 2), P3 13 (7/6). Rows 212 and 213 fixed in v7's crops; 216 fixed on the axis and
summary (`Oct 4`, no `Sept`), its tooltip residual is row 221. Row 217 (the first-point focus tooltip over the line's
opening) persists.

## Basalt-owned findings (ledger rows 219–222)

| #   | Finding                                                                                                                        | Severity |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 219 | A pending `ChartCard` around a `Meter`/`BarList`/`EventList` with no `placeholderHeight` shows the generic bar ghost (~230 px) | P2       |
| 220 | The empty and error bodies of such a card keep chart height around an ~85 px figure                                            | P3       |
| 221 | The tooltip header keeps the long form "Mon, Sep 21, 2026" beside the short axis and summary form                              | P3       |
| 222 | A 60-day time axis at 390 prints only "Sep" and "Oct", no day anchor                                                           | P3       |
| 217 | (carried) the first-point focus tooltip hides the line's opening segment                                                       | P3       |

App-owned: kind and note folded into one title string, a seconds-precision stamp per log row, "12 coffees" passed as
the facts period, a stretched Products card.
