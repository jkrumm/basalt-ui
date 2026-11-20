# Expression cycle 15 rubric rescore

Issue 2576. The cycle-15 `rubric` finding .4 and the three split readings are written into `rubric.md` and into the shipped reviewer (`packages/basalt-ui/agent/reviewer/rubric.md`):

- **Charge once, across every item** (.4). The item whose row names a defect owns it; a second item charges only what it loses beyond that. K5 charges a 390 frame only for what is lost beyond the label F6 charged.
- **K3** (n70 3, n73 2). Keys that scroll the focused chart and its ring out of the viewport at 390 cost K3 one point on every case whose 390 keyboard frame shows it, and no other item charges it.
- **X5** (n69 3, n73 2). A `StatGroup` strip (`variant="strip"`) is a flat card: X5 2 at most on every case. The `cards` variant or an inset figure meets it.
- **K2** (n69 3, n73 2). A group's error frame that leaves a cell blank, with no cause and no Retry while another cell shows its banner, is a K2 defect, 2 at most.

A fresh reviewer per case then scored n69, n70 and n73 from the round-0 shots and source (`.evidence/v3-shots/expression-15/r0` and `src-r0` in the main checkout), with the cycle-15 reviewer prompt plus a block that quotes the four readings and the rubric path pointed at this tree. Round 0 is the round every split was scored in: n73's round 1 repaired the strip variant and gave each card its own Retry, so it holds no evidence of the splits. Each reviewer opened no earlier score file. The prompts are `reviewer-prompt-n69-r0-rescore-2576.md`, `-n70-` and `-n73-`, and the reports `reports/n69-r0-rescore-2576.md`, `n70-` and `n73-`, in that directory. One caveat: the rubric's own cycle citations name the earlier split, and n70's reviewer saw them, so it knew the earlier reading; its K3 2 rests on the shot it cites (`scenarios-expr-n70--focus--light--390x844.png`, the page scrolled about 165 px and the ring cut at the top).

## Named items

| Case | Item | Round 0 | Rescore | Why                                                                                                                                                                                            |
| ---- | ---- | ------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| n69  | K5   | 2       | 3       | the 390 grid with no cell values is F6's (F6 2 again); the strip and the table still answer at rest, so K5 loses nothing                                                                       |
| n69  | X5   | 3       | 2       | `StatGroup variant="strip"` (ExprN69.tsx:312) is flat with no inset, 2 at most                                                                                                                 |
| n69  | K2   | 3       | 2       | the error frame shows "Could not load answers. Retry" on Next lead while Fills before reset and Unused on average stay blank (ExprN69.tsx:357, :371; `shot-state-error--light--1800x1200.png`) |
| n70  | K3   | 3       | 2       | the first ArrowRight at 390 scrolls the page about 165 px and the chart's ring is cut at the top (`focus--light--390x844.png`), the kit gap n73 was charged for                                |
| n73  | K3   | 2       | 2       | holds: the 390 focus frame shows the page on the joined table, the chart and its ring out of view                                                                                              |
| n73  | X5   | 2       | 2       | holds: `variant="strip"` (ExprN73.tsx:119), 2 at most                                                                                                                                          |
| n73  | K2   | 2       | 2       | holds: "Slipped share" and "Last session" blank in the error frame while "Due now" shows its banner                                                                                            |

All six pairs now agree: the same behaviour scores the same on both cases of each split, and n69's K5 no longer repeats the F6 charge.

## Sums

| Case | Round 0 (all items, F K X, F K) | Rescore                  | Cap                                                            |
| ---- | ------------------------------- | ------------------------ | -------------------------------------------------------------- |
| n69  | 58/66 (88), 50/57, 38/42        | 58/66 (88), 50/57, 39/42 | none before, none after                                        |
| n70  | 58/66 (88), 50/57, 37/42        | 60/66 (91), 53/57, 40/42 | none before, none after                                        |
| n73  | 55/66 (83), 48/57, 36/42        | 55/66 (83), 48/57, 36/42 | 79 (capped by R2 1) before; 79 (capped by F4 1 and R2 1) after |

n69's sum holds at 58 because K5 (+1) offsets X5 and K2 (-2) and F1 (+1). Items other than the named ones moved between two reviewers on the same shots, and none is the rubric's change: n69 F1 2 to 3; n70 F1 2 to 3, F2 2 to 3, F6 1 to 2, F7 2 to 3 and R3 3 to 2; n73 F4 2 to 1, F5 3 to 2, F6 2 to 3 and F8 2 to 3.

## Reading the result

- The rubric row is met: each split now has one reading, with the cycle-15 cases cited, and fresh reviewers reproduce it on the cases that split.
- n73's F4 moved from 2 to 1 between the two reviewers: it counts the Confidence dots of the due table as a second accent class beside the highlighted bars. That is the F4 counting rule at work on a different reviewer's read, not this Issue's change, and it joins the F4 split of cycle 15 if the next cycle sees it again.
- The shipped reviewer carries the same four readings in its own items: Scoring (charge once), Craft 7 (keys at 390), Expression 4 (the flat strip) and Communication 6 (the blank cell). Its rubric has no inset item, so the flat strip fails there only through the stat-row rule.
