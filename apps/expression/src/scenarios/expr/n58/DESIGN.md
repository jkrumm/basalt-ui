# API credit, cycle to date

## The three lines

- Who opens this page: the owner, who pays for three API credit pools.
- The question: will each pool be spent before it expires, and which source spends the most this week.
- The decision, in one verb: slow (the source that drains a pool), or leave (a pool that ends with credit unspent).
- The figures that answer: the Team pool's empty date with its days early (the hero), each pool's outlook and unspent dollars (the table), the top source's week with the change that doubled it (the second hero).
- Identity and deviations: the playground's stock identity; no deviation.

## Surface

- Left column, pools: a chart of the share of each pool used by cycle day, dashed to expiry at the last 3 days' rate, one answer written at the end of each drawn line, and under it the pool table (outlook and unspent, the used share in the name's sub line).
- Right column, sources: a chart of dollars an hour for Review bot (dark ink) against every other source summed (pale), and under it the ranked table (week, change, billed to; machine and model in the name's mono sub line).
- Shared: each chart's focus drives its table through focusSeries, so a row dims the other line; the pool chart reads both pools for one day, the source chart both lines for one hour.
- At 390 the columns stack, pool chart and pool rows first. Both tables fold to cards, every column on a card. The Team caption on the plot is dropped there (the hero says the date) and the Research caption shortens to its dollars.
- Errors: one banner holds the cause and the one Retry; the four frames draw their own error line without a Retry.

## Datasets

- Pools (3): size, cycle start and end, spend since the cycle start. The Batch pool has 12 hours of data, so it has no projection, no line and no focus step; its table row says "Too early".
- Spend (hourly, 30 days, six sources, machine, model; 5,052 rows): the past week by the hour in the chart, the week and the machine and model in the table.
- Review bot doubles in the last 3 days (+127 %); one hour is US$3.58 against a US$1.00 cap; zero hours are the nights. The drained fixture has one US$100 hour.

## One color, one meaning

- blue: the Team pool alone (line, dashed carry-on).
- red (status): a pool that runs out or is empty, the one state that needs action; the pill beside it is the same fact's rate.
- dark ink: Research pool and Review bot; pale ink: the other sources; dashed rule: pool size and expiry. Every other pill is neutral.

## One view at 1800x1200 (measured from the shot)

| part              | question it answers                      | x,y w x h        | what it joins               |
| ----------------- | ---------------------------------------- | ---------------- | --------------------------- |
| Pool chart card   | will each pool run out before expiry     | 264,72 748x538   | pool rows                   |
| Pools table       | outlook and unspent per pool             | 264,626 748x236  | pool chart focus (series)   |
| Source chart card | which source spends most, did one double | 1028,72 748x538  | source rows                 |
| Sources table     | the week's ranking, machine and model    | 1028,626 748x316 | source chart focus (series) |

- Pools columns 168 + 120 + 168 = 456 px; Sources 168 + 144 + 136 + 152 = 600 px (priority 1 and 2 sum 448). Both fit the 748 px cell.
- No two parts answer one question in two rows, no part is full width, no gap is as wide as a card. The lower right ends 80 px under the lower left, a table of six rows against three; the body keeps one blank row under the pools.

## Facts, one place each

| fact                         | words                   | places after        |
| ---------------------------- | ----------------------- | ------------------- |
| the Team pool empties 27 Nov | out 27 Nov              | 2 (hero, mark)      |
| days early                   | days early              | 1                   |
| rate against before          | +37 % vs before         | 1                   |
| the last 3 days carry on     | last 3 days             | 1                   |
| the week's top source        | Review bot, US$27       | 2 (hero, first row) |
| doubled                      | +127 % vs 4 days before | 2 (pill, cell)      |
| Research unspent             | US$12                   | 2 (mark, row)       |
| the capped hour              | US$3.58                 | 1 (caret)           |
| the cap                      | Over US$1.00            | 1                   |
| 12 hours of data             | 12 h of data            | 1                   |
| UTC                          | UTC                     | 1                   |

## Word count

- Round 0 first run: pool 11, header 7, name 6, label 6, source 5, hour 5, days 5, cycle 5, spend 4, last 4, credit 4.
- Round 1 last run: header 4, the table option key `header:` the command reads as text between two quoted strings, not a viewer string.

## Pass criteria

1. The hero names the pool and the date it empties; the dashed line meets 100 % at that date and its end says so.
2. Each pool shows its outlook and unspent dollars; the Batch pool says "Too early".
3. The top source is the hero and the first row; Review bot's rise is a pill with its base and a darker line.
4. The one extreme hour is capped at US$1.00 with the kit's caret and its true value, named in the footer.
5. Loading draws every slot; empty names its cause; error is one banner and one Retry.
6. Light and dark, 1800 and 390, and a keyboard frame after two arrows with no page error.

## Kit gaps met

- A line chart's end labels sit up to about 110 px from their dot with no leader, and `chartLabels.place` dropped the Research caption next to the Team one, so the two pool answers are text marks offset by hand.
- A `DataTable` in a 748 px cell holds only 600 px of columns at full width: a fifth column pushes a priority 3 column off screen, so machine and model sit in the name's sub line.
- A `DataPanel` body sized in rows keeps one blank row at 1800; one row fewer cuts the last row.
- Each frame draws its own error arm; the kit has no page-level error source.
- A phone table card drops a meter column, so the used share is in the name's sub line.
