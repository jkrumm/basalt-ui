# n88: review seats, last 30 days

## Question

- Who: the factory owner. Question: do new Issues start on the light seat? Decision: start or hold.
- Figures: first-pass rate (light against lead), cost per Issue on each seat, the move-up share against its break-even.
- Identity from the playground `DESIGN.md`; no narrowing deviation.

## One view (1800x1200)

| part                           | question                                                | x,y w x h        | joins                                                                                       |
| ------------------------------ | ------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------- |
| First-pass rate card           | does the light seat pass as often                       | 264,72 1004x585  | the one focus over 30 days (marks, figure period and status)                                |
| Cost per Issue card            | what an Issue costs on the light seat, against the lead | 1280,72 496x286  | the lead's cost is its dotted reference line; no focus (running cost, no list at its grain) |
| Moved up card                  | has it earned its move-up share                         | 1280,371 496x286 | break-even is a held "Not measured" footer fact                                             |
| Regressions and refusals table | what the rows above do not say, per seat                | 264,672 1004x208 | `focusSeries`: a seat row lights its line                                                   |
| Costliest Issues bars          | the extreme Issue behind a mean                         | 1280,672 496x208 | `focusItems`: an Issue lights its day                                                       |

No two parts answer one question; the table keeps only the measures no figure says. Five columns sum to under 800 px at its width.

## Accent and colour

- accent: the light seat (two chart lines only, the series blue). Everything else is ink steps.
- blue: the light seat. dark ink: the lead seat. No status hue is spent: no state on the page needs action, every pill is neutral.
- Records line: the table holds two records, so no card grid needs a table twin.

## Fact count

- First run printed 20 seat, 11 light, 11 lead, 8 issues, 4 share, 4 seats, 4 review, 4 rate, 4 issue and a dozen phrases; the cut strings are the pill labels, the footer labels, the window sentence, "both seats", "break-even share", "first pass" and the aria labels.
- Last run prints only the entity names: 10 lead, 8 light, 6 seat, 3 [light seat]. They name the two seats (series labels, page title, subtitles) and are not repeated facts.
- Measures and the one word each: first-pass rate ("first-pass", "passed first time"), cost per Issue ("cost"), move-up share ("moved up"), reviews as Issues ("Issues"; "reviews" only in the empty sentence), cycle ("cycle").

## Read aloud

| fact                                          | slot                                               |
| --------------------------------------------- | -------------------------------------------------- |
| window, last 30 days                          | page title                                         |
| light seat first-pass rate 78%                | figure of the rate card                            |
| 5 pts under the lead                          | pill of the rate card                              |
| lead seat first-pass rate 83%                 | footer of the rate card                            |
| 46 of 60 Issues have a result                 | status of the rate card at rest                    |
| no light rate in the first week               | zone caption on the chart                          |
| light seat cost US$0.44                       | figure of the cost card                            |
| 76% under the lead                            | pill of the cost card                              |
| lead seat cost US$1.82                        | footer of the cost card (the dotted line draws it) |
| 18% moved up, 11 of 60                        | figure and sub of the moved-up card                |
| break-even not measured, and why              | footer value and the info text                     |
| Issues, regressions, refusals, cycle per seat | table only                                         |
| costliest Issue US$11.60, 4 attempts          | bar list only                                      |
| empty cause                                   | one sentence, passed to every part                 |

Helpers: `pct` and `reading` feed the announcement and the status on focus (same slot); `signed` feeds the rate pill only. No label map.
