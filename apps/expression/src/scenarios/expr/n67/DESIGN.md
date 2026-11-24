# Training block, last 90 days (expr-n67)

## Three lines

- Who opens it, the question, the decision: a lifter after a 13-week block asks whether each main lift is still rising and whether the training load matched recovery; the decision is to keep the plan, deload or change the stalled lift.
- The figures that answer: "3 of 4 lifts rising" with the stalled lift named in its pill (Press 0.0 kg, last 5 weeks); "2 weeks ahead" with the worst week in its pill (+36 pts, 19 Oct).
- What it reads from DESIGN.md: no repo-level file is read here (the trial fences writes to this directory); the shipped Identity applies unchanged.

## Datasets

| Dataset           | Shape                            | Form                                           | Why                                                           |
| ----------------- | -------------------------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| e1RM per lift     | 4 lifts x 90 days, null off days | `Lines`, gain since first session, window zone | the question is the slope of the last 5 weeks                 |
| Session intensity | 0-100 per session day            | dots in `CartesianChart`                       | one scale with recovery, so a dot over the line is a mismatch |
| Recovery          | 0-100 daily                      | line in the same plot                          | same scale as intensity                                       |
| Weekly volume     | kg per week, one zero week       | step line with area, upper pane on the same x  | a week is one value over its 7 days                           |
| Weeks             | 13 rows                          | `DataTable` with `focusItems` holds            | verdict per week, joins both charts                           |

## Surface (1800x1200)

| Part                         | Question                  | x,y w x h        | Joins                                                  |
| ---------------------------- | ------------------------- | ---------------- | ------------------------------------------------------ |
| Lifts card                   | is each lift still rising | 264,72 750x564   | one day focus with the load card and the table         |
| Load card (two panes, one x) | did load match recovery   | 1026,72 750x564  | same focus, one cursor                                 |
| Weeks table                  | which weeks ran ahead     | 264,652 1512x532 | `focusItems` holds the 7 days of a week in both charts |

No part answers the same question twice, no gap wider than a card, every part joins the one focus. At 390 the cards stack and the weeks table drops, since its verdict is the zone on the load chart and its volume, intensity and recovery are the three drawn series.

## Color: meaning

- blue: the lift that stopped rising (Press line, end label, legend swatch); the only accent.
- status red (tint, dot, pill): weeks where intensity ran ahead of recovery.
- dark to pale ink: Squat, Deadlift, Bench in the lifts card.
- darkest ink: recovery line; mid ink: session intensity dots and the weekly volume line; dashed mid ink: the start rule.
- neutral tint: the shaded last 5 weeks and the no-training week.

## Empty sentences

- Lifts card: "No session is logged yet. Log one to draw the trends."
- Load card and weeks table: "No reading is synced yet. Sync the tracker and the table fills."
- Error: "Could not load <title>" from the card, cause "The training log did not answer.", one Retry (the kit draws it on the first card only).

## Fact count

First run, before the cuts: recovery 11, weeks 7, training 7, intensity 7, volume 6, session 6, week 5, lift 4, last 4, days 4, ahead 4; phrases: session intensity 3, weekly volume 2, training block 2, rep max 2, recovery score 2, last weeks 2, first session 2, 90 days 2. Last run: empty print.

One word per measure: weekly volume (kg), session intensity (score), recovery (score), gain (kg above the first session), ahead (intensity over recovery by more than 15 points).

| Fact             | Words                 | Places after                  |
| ---------------- | --------------------- | ----------------------------- |
| lifts rising     | "3 of 4 lifts rising" | 1 (hero)                      |
| the stalled lift | "Press, last 5 weeks" | pill, plus its blue end label |
| the window       | "Last 5 weeks"        | zone label, pill base         |
| the ahead rule   | "more than 15 points" | 1 (subtitle)                  |
| worst week       | "worst week, 19 Oct"  | 1 (pill)                      |
| lowest day       | "Lowest score"        | 1 (footer)                    |

## Pass criteria

1. The hero of each card is the answer and names its base in the pill.
2. The stalled lift is the one blue line, named at its end.
3. The window and the ahead weeks are drawn zones, not footer text.
4. The zero week draws a zone labelled "No training" and a zero row, the extreme (squat +49 kg, a 57,370 kg week) draws the kit's off-scale caret with its true value.
5. Loading, empty and error keep the card heights; the keyboard steps a day and a week.
