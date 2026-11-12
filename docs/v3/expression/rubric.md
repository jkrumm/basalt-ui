# Expression rubric

For the reviewer only. Score each item 0 to 3 from the shots and the scenario source, and cite a shot or a `file:line` for every score under 3.

| Score | Meaning                                      |
| ----- | -------------------------------------------- |
| 0     | Absent, or wrong                             |
| 1     | Attempted; a viewer still has to work for it |
| 2     | Works; a designer would change one thing     |
| 3     | Nothing to change                            |

`n/a` is allowed where the case has no such thing (no baseline in the data, nothing live). An `n/a` item leaves the sum and the maximum.

## Case fit (the reference sets the bar)

| Id  | Item                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | **Form.** The shape of the visualization follows from the case's question. A generic chart that merely holds the data scores 1 at most |
| F2  | **Answer at rest.** The case's question is answered without hover: a hero number, and an annotation on the mark that matters           |
| F3  | **Baseline.** Every headline value stands against its target, best, budget or previous period, as a signed delta or as geometry        |
| F4  | **Colour budget.** Neutral by default, one accent, one status hue. Colour encodes state or category, never magnitude alone             |
| F5  | **Honest marks.** Quantized marks carry a unit caption; thresholds sit on mark boundaries; a non-zero value is never invisible         |
| F6  | **Labels.** Marks are labelled directly where space allows; no label collides, clips or repeats an axis                                |
| F7  | **Focus and readout.** Pointing at a mark dims the rest and updates one readout; the readout returns to the total                      |
| F8  | **Anatomy.** Title, context line, status and stat strip sit in the kit's card anatomy, and the strip's swatches match the marks        |

## Contract (basalt-ui sets the bar, above the reference)

| Id  | Item                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- |
| K1  | **Scales.** Zero, one item, negative where the domain allows it, and the fixture's extreme all render without overlap or a broken axis |
| K2  | **States.** Loading keeps the loaded height; empty says what is missing and what to do; error names the failure                        |
| K3  | **Keyboard.** One tab stop, arrow keys move the focus mark, the readout is announced, focus is visible                                 |
| K4  | **Tokens.** No colour literal, no off-scale spacing or type size, tabular numerals on every changing number                            |
| K5  | **Responsive.** At 390x844 the question is still answered at rest, with no horizontal scroll inside the card                           |
| K6  | **First paint and motion.** No layout jump after measuring; nothing animates under reduced motion; server and client render the same   |

## Score and verdict

`score = 100 × sum / (3 × items scored)`, rounded.

Severity of a lost point, for the findings table: a 0 on F1, F2 or any K item is P1. Any other 0 or 1 is P2. A 2 is P3.

For a referenced case, also state which of the two answers the case's question faster for a first-time viewer, in one sentence with the reason: `build`, `tie` or `reference`. Judge the question, not the styling.

Report per case: the item scores with citations, the score, the verdict, and the devices from this list the build reached: metaphor, hero number, baseline delta, colour budget, quantized marks, threshold geometry, pre-annotation, direct labels, live cue, dim-the-rest, keyboard parity, anatomy.
