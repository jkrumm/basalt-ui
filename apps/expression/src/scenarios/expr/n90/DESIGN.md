# Remote test steps (expr-n90)

## Three lines

- Who: the factory owner. Question: do the test steps meant for the remote host stay there, why did the local machine take any back, and is a hold blocking a step. Decision: leave, free a remote slot, or release the hold.
- Figures that answer: 80 % stayed remote of 525 runs (the first clause), 103 taken back with the reason split no room 56, faster 27, free slot 20 (the second), a 47 min hold against a 60 min limit on `integration-api` after 3 disagreements (the third).
- Identity: the default basalt identity; no deviation. Accent = a run that stayed remote.

## Surface

Strip of three cells answers the three clauses. Below, the step list (what each step did) sits beside the pressure chart (why the local host took runs back); the dots on the chart are the no-room runs, and the list joins them with `focusItems`: pointing at a step lights the samples where that step found no room, pointing at a sample lights the steps that did.

## One view (1800x1200)

| part                      | question                                          | x,y w×h          | joins                                              |
| ------------------------- | ------------------------------------------------- | ---------------- | -------------------------------------------------- |
| Stayed remote cell        | do the steps stay remote                          | 264,72 496×230   | none (figure + daily trend)                        |
| Taken back cell           | how many came back, and why                       | 772,72 496×230   | none (figure + three reasons)                      |
| Held now cell             | is a hold blocking a step                         | 1280,72 496×230  | none (figure + meter against the limit)            |
| Where steps ran (BarList) | which step ran where, which was held or never ran | 264,318 750×538  | the one focus, by `focusItems` over samples        |
| Slot pressure (ChartCard) | why did the local host take runs back             | 1026,318 750×538 | the one focus; figure `period` and `status` follow |

Known kit gap seen: a band of about 110 px under the step list at 1800, the list's card stretched to the chart card's height.

## Color: meaning

- blue: a run that stayed remote
- dark ink: no room on the remote host (bar segment, chart dots, legend)
- mid ink: faster local; pale ink: free local slot
- red: held (bar segment, status dot)
- grey line: pressure; dark dashed line: baseline

## Fixtures

`week` (default), `calm` (no no-room run, no hold, low pressure), `crowded` (pressure pinned near 100 %, thousands of runs, a 190 min hold past its 60 min limit).

## Fact count

First run, before the cut: `13 remote, 9 runs, 6 step, 5 slots, 5 full, 5 busy, 5 [remote full], 4 held, 4 days, 4 baseline, 4 [7 days], 4 [# runs], [test steps], [taken back], [step ran], [stayed remote], [slots busy], [runs remote], [remote test], [log did], [busy slots], [busy #]`. Last run: empty.

Measures and their words: runs (never "placements"); taken back (title, the list's sort is "share"); no room (legend, rows, chart dots, status); held (kind, cell, row word); pressure and busy slots (title, y title, status).

## Read aloud

Each fact ends in one slot.

| fact                                | slot                                                                             |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| 80 % stayed remote                  | Stayed remote cell figure                                                        |
| 525 runs                            | Stayed remote cell unit                                                          |
| 85 % the week before                | Stayed remote pill                                                               |
| 103 taken back                      | Taken back cell figure                                                           |
| 56 no room, 27 faster, 20 free slot | Taken back cell rows (the list draws each as a segment per step, not as a total) |
| 84 the week before                  | Taken back pill                                                                  |
| 47 min held                         | Held cell figure                                                                 |
| 60 min limit                        | Held cell meter caption                                                          |
| the held step, 3 disagreements      | Held cell rows                                                                   |
| blocking                            | Held cell status                                                                 |
| a step's runs and where they ran    | step list bar and its total                                                      |
| never ran, held                     | step list row word                                                               |
| peak 100 %, 59 % baseline           | pressure figure and pill                                                         |
| the time of the peak                | pressure figure period                                                           |
| no room: 18                         | pressure status                                                                  |
| 102 of 240 over baseline            | pressure footer                                                                  |
| 60 % default baseline, first day    | pressure zone caption                                                            |

Greps: `rg -n 'KIND_LABEL' ` reads each label from one constant; `roomText(` is one helper read for the status at rest and on focus and for the announcement (focus shows a sample's own count). The focused sample's pressure, time and no-room count replace the rest values in the same slots.
