# Image cost, estimate against measured (n98)

## Three lines

- Who: the owner of an image library, picking a model and a quality for the next batch.
- Question: how far did the plan's estimate miss the measured cost on each model and quality, and how much spend hides in entries with no price. The decision: which model and quality to trust the estimate on, and which gaps to price first.
- Figures: the widest miss with its distance from the overall miss (`+101%`, `+89 pts vs +12% overall`) answers the first clause; the spend of the unpriced entries at estimate (`US$1.84`, 20 of 400 entries) answers the second.

Reads from the playground DESIGN.md: identity unchanged, no deviations. Accent: the widest miss, one bar. Standard is a mid ink step, HD the dark one.

## Surface

- A grouped bar chart, one group per model, Standard and HD side by side, signed miss on y, the plan's estimate as the zero rule. The widest miss takes the accent through `highlight`.
- The spend with no price: a stat card with a meter of its share of planned spend, and a bar list of the same models in the chart's order, so one focus joins the chart and the list.
- Estimates that are not measured and the quality priced as another sit in the chart footer as two facts.

## Fixtures

- rest: five models, about 400 generations, 20 with no measured cost; Quill estimated by a placeholder, Vesper extrapolated, Lumen priced HD at the Standard rate (HD misses by about +101%).
- `?fixture=exact`: every estimate held, no unpriced entry; the zero cue (baseline ticks, US$0.00, empty meter).
- `?fixture=extreme`: Prism HD misses by +383%; the plot caps at +150% and the kit draws the caret and keeps the true value.
- `?fixture=fresh` and `?shot-state=empty`: a library with no generations.

## Read aloud

| fact                                               | every slot that says it                                            |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| widest miss, +101%                                 | figure value                                                       |
| which model and quality it is                      | figure period (on focus: the focused model's two misses)           |
| how the widest miss sits against the rest, +89 pts | figure delta (names its base, +12% overall)                        |
| each model's miss at each quality                  | bar value labels                                                   |
| the plan's estimate is zero                        | refLine "Plan estimate"                                            |
| Quill and Vesper estimates are not measured        | chart footer                                                       |
| Lumen priced HD at the Standard rate               | chart footer                                                       |
| spend with no price, US$1.84                       | stat figure                                                        |
| how many entries have no price                     | stat sub (20 of 400); per model in the bar list secondary          |
| share of planned spend                             | stat meter (5% of US$35.95 planned)                                |
| unpriced spend per model                           | bar list value                                                     |
| no generations yet, and the next step              | chart empty cause only; the stat card and the bar list hold a dash |

## One view

| part                          | question it answers                               | x,y w×h         | what it joins                                                        |
| ----------------------------- | ------------------------------------------------- | --------------- | -------------------------------------------------------------------- |
| Estimate miss chart card      | how far the estimate missed per model and quality | 0,0 2/3×1       | the one focus                                                        |
| Spend with no price stat card | how much spend has no price                       | 2/3,0 1/3×0.4   | none by design: one figure for the whole library; its sub is a total |
| Unpriced spend bar list       | which model hides it                              | 2/3,0.4 1/3×0.6 | the chart's focus, row i is model i                                  |

At 390 the parts stack in that order: the chart first, then the figure, then the list.

## Pass criteria

1. The figure carries the widest miss and names its base.
2. The plan's estimate is drawn as the zero rule.
3. Every bar carries its signed value; an over-cap bar keeps its true value beside the caret.
4. The unpriced spend and its entry count are on screen at rest, and zero reads as US$0.00.
5. Loading, empty and error keep every slot; only the chart states the empty cause.
