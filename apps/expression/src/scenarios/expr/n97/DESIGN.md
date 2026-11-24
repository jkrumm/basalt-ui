# Photo culling (expression n97)

## Question

- Who opens it: a photographer who shoots in bursts.
- The question: in which period did rating fall furthest behind shooting, and how many photos have no capture time.
- Decision: go back to the burst and rate it.
- Figures: the run of periods that fell furthest behind (hero, with its share rated against the usual share), and the photos with no capture time (footer fact, with the window before as the second fact: zero, so no percent change is drawn).
- Identity from the playground; no narrowing deviation.

## Surface

One card holds the whole question: the bars are shots per period split into kept, rejected and unrated; the run over three times the usual unrated carries the accent and its counts; the lighter bar is the period still open; the undated photos belong to no period, so they cannot be a mark and are the footer's first fact.

## One view

| part                        | question it answers                                   | x,y w x h (1800) | what it joins                                                                                                 |
| --------------------------- | ----------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------- |
| Rating behind shooting card | which period fell behind, how many photos are undated | 264,72 1512x585  | one `useChartFocus` over the periods: arrows and pointer step the bars, the period slot reads the focused one |

No table: a table of the periods would restate the bars. The empty space under the card is the page, not a gap inside it.

## Read aloud

| fact                                | every slot that says it                                          |
| ----------------------------------- | ---------------------------------------------------------------- |
| the furthest-behind run             | hero value (Jun-Aug); accent bars                                |
| shots left unrated in the run       | period slot (rest), bar labels on the accent bars (a count each) |
| share rated against usual           | delta pill                                                       |
| the open period                     | subtitle                                                         |
| undated photos                      | footer fact                                                      |
| undated in the window before        | footer fact                                                      |
| what unrated, kept and rejected are | legend                                                           |
| the unit                            | y axis title                                                     |

Unrated also appears in the legend (the name of the grey segment) and in the focus readout, which replaces the rest reading while a bar is focused.

## Color: meaning

- accent: the unrated shots of the run that fell furthest behind (one meaning)
- dark ink: kept; mid ink: rejected; pale ink: unrated outside the run
- no status hue: a rated share under usual is shown by the delta pill's polarity only

## Pass criteria

1. The hero names the run and its pill names the base (the usual share).
2. The accent bars carry their unrated count on the mark.
3. The undated count and its prior window of 0 are at rest in the footer at 1800 and 390.
4. Loading, empty and error hold the card's height and footer labels.
5. `?fixture=days` draws 30 days by day; `?fixture=clear` has no undated photo.
