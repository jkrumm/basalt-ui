# Library keeper rate (expr-n71)

## Three lines

- Who: a photographer reviewing the library after a season. Question: has the keeper rate reached the 35 percent target, and how many more keepers would it take. Decision: keep rating, or stop.
- Figures that answer: the rate (30.6 %) with its signed gap to the target (-4.4 pts), and the keepers still needed (225 more, 1,560 now of 1,785).
- Reads from DESIGN.md: the kit's console look; one accent, spent on the keepers.

Assumption: "more keepers" means more of the judged photos get 4 stars or more, so the judged count stays; 35 % of 5,100 is 1,785, minus 1,560 is 225. Kept means 4 stars or more over judged; an unrated photo is not judged; a rate needs 20 judged.

## Surface

| part                            | question it answers                | x,y w×h at 1800x1200 | what it joins                                                         |
| ------------------------------- | ---------------------------------- | -------------------- | --------------------------------------------------------------------- |
| Keeper rate (StatCard + Meter)  | reached? how many more?            | 264,72 496×256       | none (the answer)                                                     |
| Star ratings (ChartCard + Bars) | where do the keepers sit           | 772,72 1004×476      | one focus with Storage                                                |
| Storage by folder (BarList)     | where do keepers and the rest live | 264,340 496×208      | rating focus: Final holds 4 and 5 stars, Staging the rest, Trash none |
| Camera bodies (BarList)         | which body drags the share         | 264,564 750×488      | own focus, drives Lenses                                              |
| Lenses (BarList)                | which lens drags the share         | 1026,564 750×488     | holds the bodies that shot it                                         |

Row 1 ends flush at 548. No part is full width for under four rows; the first 1200 px has no card-wide gap. At 390 the order is the answer card, the rating chart, storage, bodies, lenses; the rate and the 225 are in the first screen.

## Colour: meaning

- accent (brand): keeper bars and the Keepers zone, nothing else.
- amber (status): the Behind zone of the Meter, the one state that needs action.
- ink steps: every other rating bar; Not counted is a neutral tint.

## Fixtures

- default: 5,100 judged, 900 unrated, 1,560 kept, Trash empty, one lens with a single photo.
- `reached`: 1,800 of 5,100 kept, 35.3 %, 15 to spare.
- `few`: 18 judged, a rate is not measured (dash and its reason), the unrated bar is clamped by the kit with its true value.

## Fact count

First run: 17 photos, 9 kept, 7 judged, 5 target, 5 stars, 4 rating, 4 rate and eleven phrases. Last run: empty. Measures and their one word: kept photos are "keepers" (sub, zone, "keeper share"); judged is "judged"; the share is "rate" on the card and "share" in the gear lists; the goal is "target".

Read aloud, one place each: rate 30.6 (figure), gap -4.4 pts (pill), 35 % (pill label), 225 (sub), 1,560 and 1,785 (footer), 5,100 (chart figure), 6,000 (period), 900 (bar), Trash 0 B (row).

## Empty, loading, error

- Empty: one page sentence, "Nothing imported yet. Import a shoot to start rating."
- Loading: every slot is passed, labels held, values empty.
- Error: three sources (tally, camera index, storage scan), each with its own Retry that clears it.
