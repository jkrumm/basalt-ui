# Lift balance (expr-n92)

## Three lines

- Who: a lifter checking balance between lifts. Question: are the four pairs inside their healthy ranges, and which sits furthest out. Decision after reading: "train" the lagging lift.
- Figures: balanced pairs of the measured ones (1 of 4) and the furthest pair with its distance to a range end (70% under 0.40).
- Reads from DESIGN.md: neutral by default, one status ramp for the states that need a hand.

## Surface

- A `StatCard` answers both clauses (hero count, sub names the furthest pair with its number). A `DataPanel` holds one zoned `Meter` per pair, widest miss first, so the verdict is a word under the marker. No chart: four ratios on four scales have no shared axis, and a meter with zones is the shipped form for a ratio against a range.

## States (my own rule, the case leaves the limits open)

- Balanced: inside the range. Borderline: up to 15% past an end. Imbalanced: up to 30%. Critical: beyond. The rule sits in the card's `info` and is drawn as the meter's zones.
- Missing pair: no meter, the cause on the row. Fewer than two lifts logged: both parts empty with one sentence. Pull-up with 0 or null added weight is not measured.

## One view (1800x1200)

| part           | question                                     | x,y w x h       | joins                                     |
| -------------- | -------------------------------------------- | --------------- | ----------------------------------------- |
| Balanced pairs | how many pairs are inside, which is furthest | 276,84 369x340  | the panel's order (row 1 is the furthest) |
| Pair ratios    | where each ratio sits against its range      | 657,84 1106x340 | none; rows hold no interaction            |

The row ends flush; the stat card stretches to the panel's height (blank area under its footer, a kit gap). No tab stop in the body except the card's definition glyph, which carries the state rule.

## Fixtures

default, extreme, all-balanced, no-weight, no-data, one-lift. `?shot-state=` loading, empty, error.

## Color: meaning

- neutral grey: balanced. amber: borderline. red: imbalanced and critical (word tells which). Accent unused.

## Fact count

First run (before cuts): `4 pairs`, `4 lifts`, `3 [# below]`, `3 [# above]`, `2 [lifts logged]`; then `2 [ratio against]`. Last run: empty.

## Read aloud

- balanced count (1 of 4) | hero figure
- furthest pair and its distance | card sub
- pair name | its row title
- range | row, right end
- state word and direction | zone word under the marker
- ratio | readout under the marker, right
- state rule (15%, 30%) | info glyph
- lifts logged | footer
- pairs not measured | footer; and the cause on each unmeasured row (its reason, not its count)
- empty cause and step | one sentence, both parts
- sort | panel subtitle
