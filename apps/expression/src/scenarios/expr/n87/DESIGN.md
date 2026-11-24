# Photo library, wipe check (expr-n87)

## Three lines

- Who and what: a photo owner after a big import, about to wipe a card. Question: is it safe to wipe, meaning is every final photo backed up, is any raw orphaned, is anything waiting. Decision: wipe or wait.
- Figures that answer: unsynced finals (the hero, with its verdict "Not safe to wipe"), orphaned raws, expired trash, sidecar errors. The library size and last reindex open the page.
- Reads from `DESIGN.md`: none in this trial; the kit's defaults stand.

## Surface

Summary line (library size, last reindex; on a failed library load the failure sentence with its Retry), then one strip of four cards (one per clause of the question, the third clause split into its two kinds), then one table of the things that wait. The strip is four cells, so it needs no table view of its own; the table lists the items behind the last two cells.

## One view (1800x1200)

| part                     | question                                       | x,y w×h          | joins                                                                                   |
| ------------------------ | ---------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------- |
| Summary                  | how big is the library, how fresh is the index | 264,72 1512×44   | none, it is context                                                                     |
| Unsynced finals          | is every final backed up                       | 264,132 368×190  | none, a count of photos, not items                                                      |
| Orphaned raws            | are raws orphaned                              | 645,132 368×190  | none                                                                                    |
| Expired trash            | is trash overdue                               | 1026,132 368×190 | the table's trash rows (same count)                                                     |
| Sidecar errors           | are sidecars unreadable                        | 1407,132 368×190 | the table's sidecar rows (100 of 150)                                                   |
| Waiting to be dealt with | which items wait                               | 264,338 1512×690 | the two cells above; priority 1 and 2 columns sum 70 ch, far under 480 px at full width |

## Fixtures

`?fixture=` fresh (every count zero), unavailable (raw archive offline), counting (raw check running); `?shot-state=` loading, empty (the fresh library), error (four sources, four retries).

## Records line

Four measure cells, not five: the strip stays a strip.

## Read aloud

| fact                              | slot                                                       |
| --------------------------------- | ---------------------------------------------------------- |
| 5,000 photos and 1,200 in staging | summary sentence                                           |
| last reindex time                 | summary fact                                               |
| 12 finals not backed up           | the first figure                                           |
| 3,788 of 3,800 backed up          | the first cell's meter (the baseline: the share backed up) |
| Cloud's oldest unsynced, 40 days  | the "Cloud, oldest" row                                    |
| NAS is in sync                    | the NAS row                                                |
| the wipe verdict                  | the first cell's status                                    |
| 37 orphaned raws                  | the second figure                                          |
| 2.1 GB of them                    | the second cell's "Size" row                               |
| 3 trash entries past retention    | the third figure                                           |
| 30-day retention                  | the third cell's "Retention" row                           |
| 150 unreadable sidecars           | the fourth figure                                          |
| 100 listed                        | the fourth cell's meter text                               |
| why the raw figure is a dash      | the second cell's sub, in the two fixtures that have it    |
| the empty sentence                | the table, once                                            |

Helpers: `size()` is called once; `targetRow()` once per target and each prints a different target; `FAILURE` is read in the error arms (one per source) and once in the summary fact; `KIND_LABEL` once. The four sidecar reasons repeat across the fixture rows, no other string does.

## Fact count

First run: `7 trash`, `5 sidecar`, `4 lower`, `4 better`, `4 library`, `4 final`, `4 answer`, `2 [trash entries]`. Round 1 run: empty.

Measures and their words: backup is "unsynced"/"not safe to wipe" (one measure, one word each for count and verdict); expired trash is "expired trash" in the label, the subtitle says "entries to empty"; sidecars are "sidecar errors" in the label and "files" elsewhere, since the file is the row's noun.
