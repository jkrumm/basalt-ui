# Spec review (expr-n55)

## The three lines

- Who opens this page: the factory owner, reviewing one Spec. The question: how many revisions did it take, how long did each verdict wait, which annotations are still unanswered. The decision: chase a reply.
- Figures that answer it, each a number at rest in the strip: 5 revisions (verdict on the last: Looks good), 26 h longest verdict wait against a 4.5 h median, 4 of 14 annotations unanswered.
- Reads from DESIGN.md: the basalt identity unchanged; one status hue (amber) for the one state that needs action, an unanswered annotation. Everything else is ink.

## Surface

Parts: three stat cells, a revisions table with the wait as a meter, an annotations table. The strip and the revisions table stack in the left column and the annotations table fills the right, at the page's `@wide` container; at 390 they stack in that order. All three read one `useChartFocus` over the five revisions: pointing at or stepping to a revision row focuses it, the annotation rows of that revision stay lit and the rest dim, and the cells follow (wait, unanswered scope). Pointing at an annotation row holds its revision (`focusItems.holds`). The two long tables keep the kit's own phone cards, so every row is reachable at 390.

## One view, 1800x1200

| part                                      | question it answers                                     | x,y w×h         | joins                                          |
| ----------------------------------------- | ------------------------------------------------------- | --------------- | ---------------------------------------------- |
| Revisions, Verdict wait, Unanswered cells | how many, how long, how many unanswered                 | 264,72 750×148  | the revision focus (wait and unanswered scope) |
| Revisions table                           | what each revision was and how long its verdict waited  | 264,232 750×280 | the focus, by row                              |
| Annotations table                         | which annotations are unanswered, and on which revision | 1026,72 750×568 | the focus, by revision (holds)                 |

Table sums at the half-width cell: priority 1 and 2 columns are entity 18ch, meter 14ch and status 12ch, (18 + 14 + 12) × 8 + 3 × 24 = 424 px, under 480. The size has no column of its own for that reason (see the workaround marker in the page source).

## Fixtures

- Default: the extreme is revision 2, whose verdict waited 26 h against 1.5 to 7 for the others; four annotations are unanswered, one with a 130-character note.
- `?fixture=answered`: every annotation has its reply, so the unanswered figure is a measured 0 and nothing takes the status hue.
- `?shot-state=loading|empty|error`: loading holds both tables at their row counts and the cells at their tracks; empty prints dashes and one sentence per table; error is the kit's arm with Retry.

## Color: meaning

- amber: an annotation with no reply. Nothing else takes a hue; verdicts, replies and the meters sit in ink steps.

## Pass criteria

1. The strip states the revision count, the longest wait and the unanswered count at rest.
2. The 26 h wait is the longest meter on its revision's row, and the median stands beside it as the baseline.
3. The unanswered annotations are the first four rows and the only rows with a hue.
4. Pointing at a revision lights its annotations; stepping with the arrow keys announces the revision's wait and unanswered count.
5. Loading, empty and error keep the strip and the tables in their places.

## Fact count

First run (before the first cut): wait 7, annotations 6, revision 5, unanswered 4, revisions 4. Last run (words of the page's own strings four or more times): wait 6, annotations 6, revision 5, unanswered 4, revisions 4; the remaining hits are code keys and the accessible names of the tables, and each visible word names a different row or column.
