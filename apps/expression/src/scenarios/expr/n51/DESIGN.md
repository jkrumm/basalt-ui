# Card charges, last 30 days

## Three lines

- Who: a household scanning the month's card statement. Question: which charges are unusual for their merchant, and which are still uncategorised. Decision: dispute, or categorise.
- Figures: 6 unusual (hero, with the amount above usual and the base of 391 charges); 20 uncategorised with their sum (footer); the repeat charge named in the footer and on the mark. Unusual means 2x the merchant's 12-month median or more, or a repeat of the same amount by the same merchant on one day.
- Reads from DESIGN.md: the basalt identity, no deviation. The accent is spent on unusual charges.

## Surface

A chart card (every charge against its merchant's median) beside a table of the charges to check, on one chart focus. At 390 they stack, chart first.

| part                   | question it answers                                                        | x,y w x h at 1800 | joins                                                                                      |
| ---------------------- | -------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------ |
| chart card             | which charges are far from their merchant's median, which have no category | 264,72 748x538    | the one focus (hero, dim, table rows)                                                      |
| charges-to-check table | which exact charges to act on, and what each cost                          | 1028,72 748x544   | `DataTable focus` by charge id; the table holds only flagged rows, the chart draws all 391 |

Table width: priority 1 and 2 columns (merchant with date, amount, vs usual) hold the table at 748 px; a fourth priority 2 column folds it into cards. The check and category columns are priority 3, so they show on the phone cards and at full width.

## Datasets

| dataset                                                                | shape                                                | form                                        | why                                                                     |
| ---------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| 391 charges, date, merchant, amount, category or none, merchant median | points on a time axis, one value (times median) each | dot chart, `CartesianChart`, y capped at 4x | the reader finds the outliers; the 10x charge is the kit's capped caret |
| the flagged subset                                                     | rows with several attributes                         | `DataTable` in a `DataPanel`                | exact amounts and dates                                                 |

## Colour: meaning

- accent blue: charge unusual for its merchant (dots, the zone above 2x)
- pale ink: charge in range
- dark ink ring: charge with no category
- mid ink rule: the 1x median and the 2x line
- no status hue is spent

## Fixtures

- default: 391 charges, one 10x charge (capped), one merchant charged twice in a day, one 0.00 charge, one charge both unusual and uncategorised.
- `?fixture=calm`: nothing unusual and nothing uncategorised; the hero and the footer read zero and the table says why it is empty.

## Fact count

First run (4 or more): charges 9, unusual 8, merchant 8, median 7, uncategorised 6, range 5, check 5. Last run: charges 7, merchant 6, unusual 5, uncategorised 5, median 5, repeat 4, check 4, category 4. What remains is code (series keys, `d.merchant`, template variables); in the prose each word stands three times or fewer. Each fact has one place: the unusual count is the hero, the rule is the 2x line label, the repeat is the footer and its mark, the uncategorised count is the footer.
