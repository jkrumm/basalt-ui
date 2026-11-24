# Harbour waves (expr-n56)

## The three lines

- Who and decision: a sailor planning to leave the harbour decides when to go (leave now, wait, or go in the calm window).
- Question: what wave height and period reach the harbour in the next 12 hours, and when is the calmest window?
- Figures that answer: peak height 2.2 m with its signed distance to the 1.5 m limit (+0.7 m), the period at the peak (10 s), the calmest window (Fri 15:00 to 18:00, 0.3 m).

## Surface

Two parts side by side at a wide container (`CardGrid min="regular"`), stacked at a narrow one. One `useChartFocus` over the 48 hourly rows joins the chart, the figure and the table; the table lists the first 12 rows by id.

| part                            | question it answers                         | x,y w×h at 1800 | what it joins                                  |
| ------------------------------- | ------------------------------------------- | --------------- | ---------------------------------------------- |
| Chart card, wave height by hour | how high, when over the limit, when calmest | 264,72 750×538  | focus: figure value, delta, period; table rows |
| Table, next 12 hours            | height, period, wind for each hour          | 1026,72 750×538 | the chart's focus, by hour id                  |

Table width: priority 1 and 2 columns are Hour (about 64 px), Height and period (about 136), Limit (88), Wind (96): about 384 px, under 480. `phone: 'scroll'` keeps it a table; without it the five-column version folded to cards at 750 px.

## Colour: meaning

- dark ink: harbour height
- pale ink: the four offshore points
- mid ink: the limit rule (dashed) and the peak rule (solid), each labelled
- red: hours above the limit (dots, table Over dot); the one status hue
- accent tint: the calmest window (the answer); no accent series

## Fixtures

- default: swell peaking at 02:00 over the limit, a zero wind at Fri 16:00 inside the calm window.
- `?fixture=calm`: every hour under the limit, wind near 0 kt.
- `?fixture=storm`: every hour over the limit, offshore points above 6 m; no calm window, footer says so.

## Fact count (rg word count of the page strings)

- First run: harbour 8, limit 6, hours 6, height 5, peak 4, offshore 4, next 4, calm 4.
- Last run: limit 6 (3 prose, 3 `LIMIT` interpolations), peak 4, offshore 4, hours 4, height 4, harbour 4, calm 4 (the remainder are series keys and identifiers inside quotes); no prose word past 3 places except the limit's value, which is data.

## Pass criteria

1. The summary figure is the peak height with its distance to the limit.
2. The limit is a drawn rule; the calmest window and the next 12 hours are zones.
3. Period and wind for each of the next 12 hours are in the table at 1800 and the period for the peak is in the figure at 390.
4. Pointing at an hour, or stepping with the arrow keys, updates the figure and lights the table row.
