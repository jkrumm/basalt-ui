# Spike: fixed layout tiers and argo's card sites (S3, S4)

Both claims are refuted as the contract stands, and each for a narrow reason. S3: the fixed kind widths hold for every column except three (the `entity` cell with its sub line, the `spark` cell at argo's geometry, and headers that carry a unit or a window), which put 71 cells over their width. S4: six of the nine card sites fit the derived card; `catalog` and `slots-list` move part of their card to the sheet, and the `tax` queue needs one-tap tag buttons that no derived place can hold.

Harness: `bun tools/spikes/table-fit/run.ts` (one JSON object on stdout, exit 0; about 2 minutes, Chrome required). Concept: `docs/v3/concepts/data-table.md` section 9, S3 and S4. The `./table` parts (`packages/basalt-ui/src/table`, at `78ed6ac3`) were read, not changed. Raw result: `tools/spikes/table-fit/results/run-1.json`; shots: `tools/spikes/table-fit/shots/`.

## Question

- **S3.** Do the fixed kind widths and the five tier steps keep every cell inside its column at container widths 500, 800, 1000, 1200 and 1800 px, against today's auto layout? Pass: no non-`scroll` cell has `scrollWidth` above `clientWidth`, and the owner accepts the tiers at 1800x1200. If it fails: a `content` width option on `text` and `entity`.
- **S4.** Does argo fit derived cards? Port the 8 `renderCard` sites and the `tax` queue; six are expected to fit title, value, meta and `edit`, catalog and slots-list to keep a meta run and move the rest to the sheet. Pass: no site needs a named slot, and the owner accepts at 390x844.

## Method

**Sites.** Synthetic copies of argo's tables, ported to `col<T>()` kinds with argo's column order, priorities and text lengths. Rows come from a seeded PRNG and invented words (`fixture/sites.tsx`); nothing is copied from argo's data. Argo's ledger is `ledger` (transactions, `BookingRow`), its text-heavy table is `slots-list`, its numeric table is `net-worth` positions. Two stress inputs are on purpose: one 72-character legal-entity merchant, and purposes up to 86 characters, which SEPA purposes reach.

| Site              | Argo source                              | Kinds                                                       |
| ----------------- | ---------------------------------------- | ----------------------------------------------------------- |
| `ledger`          | transactions, `BookingRow`               | date, entity with sub, 2x select, money, actions, selection |
| `catalog`         | `catalog-table`, `CatalogCard`           | 14 columns: entity, status, text, date, number, money       |
| `slots-list`      | `slots-list`                             | entity with 2-line sub, 5x number, 2x long text             |
| `spending`        | spending                                 | entity, 2x money, delta, `spark`                            |
| `net-worth`       | net-worth positions                      | entity with sub, number, 2x money, date                     |
| `recurring-*` (3) | recurring: subscriptions, bills, stopped | entity with sub, text, money, date                          |
| `tax`             | tax queue (not a table in argo)          | entity, money, date, text, select, actions                  |
| `spark-grid`      | `sparkline-grid-chart` (S3 only)         | entity, delta, 2x `spark` (80 px chart plus a figure)       |

**S3.** Five tables (`ledger`, `slots-list`, `net-worth`, `catalog`, `spark-grid`) at five container widths, in the shipped fixed layout and in today's auto layout (`table-layout: auto`, `<col>` widths ignored). Counted: every tier-visible `th` and `td` whose `scrollWidth` is above `clientWidth`. Each overflow carries a cause: `header`; for an entity, `name` when the name alone is wider than the cell and `sub-line` when it is not; else the kind. A second pass stacks the sub line under the name (`display: block`) to price the obvious layout fix.

**S4.** Each site is planned by `core/plan.ts` at 390 px. Every thing argo's card shows or lets a person do (`needs` in `fixture/sites.tsx`, read off the `renderCard`) is judged against the planned place:

- `ok`: lands in title, subtitle, badge, value, meta, `edit` or the kebab.
- `sheet`: lands in `detail` or `hidden`, or its text is clamped in the card.
- `slot`: no derived place can hold it (a one-tap button).
- `displaced`: lands in the wrong slot (a card whose value is not argo's value). The site is re-planned once with the value column declared first; the reorder is reported.

A site fits when nothing is `sheet`, `slot` or `displaced` and no clamped element is truncated in Chrome.

**What is the spike's own.** At this commit `table.css` only stacks the cells at the card tier, and the `select` kind renders its value as text. So the card the owner sees is written in `fixture/spike.css` on the real DOM: concept section 5 and 6's grid (title and value, subtitle and badge, one labelled two-line meta run, `edit` rows, kebab, detail not shown). The places come from the real plan; the `edit` control is a bordered 44 px box. The verdict does not rest on that CSS, only on the plan and on the clamp measurements.

**Browser.** The `chrome` channel via `playwright-core` 1.63.0 (Chrome 157), real Nunito Sans, device scale 1. Shots are the table root only, light and dark, as PNG (the largest is 132 KB), three rounds: round 1 found the row-height defect below, round 2 a selector clash in the spike CSS (the selection tick and the `select` kind share `data-kind`), round 3 cell padding.

## Measurements

### S3

Each cell is `tier and visible columns / overflowing cells (fixed) / px the auto table is wider than its container (auto)`.

| Table        | 500                   | 800                 | 1000               | 1200               | 1800             |
| ------------ | --------------------- | ------------------- | ------------------ | ------------------ | ---------------- |
| `ledger`     | card 6c / 0 / 0       | full 7c / 11 / 484  | full 7c / 6 / 284  | full 7c / 3 / 84   | full 7c / 0 / 0  |
| `slots-list` | reduced 3c / 10 / 398 | reduced 3c / 5 / 98 | reduced 3c / 2 / 0 | full 8c / 9 / 114  | full 8c / 1 / 0  |
| `net-worth`  | card 4c / 0 / 0       | full 6c / 8 / 19    | full 6c / 0 / 0    | full 6c / 0 / 0    | full 6c / 0 / 0  |
| `catalog`    | card 6c / 0 / 0       | reduced 6c / 0 / 0  | reduced 6c / 0 / 0 | reduced 6c / 0 / 0 | full 14c / 3 / 0 |
| `spark-grid` | reduced 3c / 1 / 33   | full 4c / 3 / 0     | full 4c / 3 / 0    | full 4c / 3 / 0    | full 4c / 3 / 0  |

`s3.overflowOutsideScroll` is **71**: 15 of the 25 table-and-width cells have at least one. By cause:

| Cause                                                  | Cells | Where                                                                                                        |
| ------------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------ |
| `sub-line` (entity, name fits, sub line does not)      | 38    | `ledger`, `slots-list`, `net-worth`, `catalog`                                                               |
| `name` (entity, the name alone is wider than the cell) | 20    | the same four                                                                                                |
| `spark`                                                | 8     | `spark-grid` INOL, a figure like `1.59 Excessive` beside an 80 px chart: 202 px needed, 184 planned          |
| `header`                                               | 5     | `spark-grid` `Trend, 28 d (%/mo)` on `delta`: 140 px needed, 104 planned; the head is `nowrap`, so it is cut |

No `number`, `money`, `date`, `status`, `select`, `actions` or `text` body cell overflowed at any width: the kind widths hold. `text` wraps, so it cannot. The remaining 58 cells are all one kind: `entity`, which is nowrap with a flexible width that shares what is left, not what the content needs. At `ledger` 1200 the Merchant column is 572 px and its rows need 597 to 786. With the sub line stacked under the name the count falls to 35 (`name` 16, `sub-line` 6, `spark` 8, `header` 5): stacking is not a fix, a long name or purpose still overflows a column that cannot wrap.

Against today's auto layout the failure moves rather than disappears. Auto clips the table at its container edge in 8 of the 25 cells (up to 484 px at `ledger` 800), where fixed holds the table at 100% and spills text over the neighbouring column in 15. Fixed removes the clipped table and the equal-geometry law (I8) holds; it does not remove the long string.

Kind widths against need, over all fixed measurements (`maxBodyNeedPx` is the widest cell content plus padding; headers are a range estimate and may count the sort mark):

| Kind                  | Planned px | Widest body   | Widest head |
| --------------------- | ---------- | ------------- | ----------- |
| `number`              | 104        | 93            | 108         |
| `money`               | 120        | 93            | 125         |
| `date`                | 120        | 109           | 86          |
| `status`              | 120        | 86            | 67          |
| `select`              | 152        | 109           | 76          |
| `delta`               | 104        | 144           | 140         |
| `spark`               | 184        | 202           | 192         |
| `actions`             | 44         | 52            | 69          |
| `entity` (floor)      | 168        | 786           | 88          |
| `text` (floor, wraps) | 152        | 400 unwrapped | 140         |

`CH_PX = 8` over-estimates Nunito Sans at 13 px for digits and under-estimates mixed text, so the planned widths are roomy for numbers and tight for `delta` and `spark`. A `money` header with a unit (`$ out /1M (USD)`, 125 px against 120) is the next to break; it did not overflow here.

### S4

`s4.fitCount` is **6 of 9**. Row heights are in px at 390.

| Site                      | Status            | Card places                                                                              | Row height |
| ------------------------- | ----------------- | ---------------------------------------------------------------------------------------- | ---------- |
| `ledger`                  | fit               | title merchant, value amount, meta date, 2x `edit`, kebab                                | 184 to 216 |
| `spending`                | fit               | title, value total, meta per month and change; `spark` to the sheet (not on argo's card) | 64 to 80   |
| `net-worth`               | fit after reorder | title, value, meta units, price, share, as-of                                            | 96         |
| `recurring-subscriptions` | fit after reorder | title, value per month, subtitle cadence, meta charge, next                              | 100 to 120 |
| `recurring-bills`         | fit after reorder | same                                                                                     | 100 to 120 |
| `recurring-apart`         | fit               | title, value, subtitle state, meta                                                       | 100 to 116 |
| `catalog`                 | sheet             | price in, price out, IU, routes go to `detail`; 6 meta items fit                         | 84 to 116  |
| `slots-list`              | sheet             | the two "leanest" sentences are clamped: the meta run is cut in 6 of 10 rows             | 116 to 136 |
| `tax`                     | **slot**          | one-tap tag buttons have no place                                                        | 136 to 152 |

`s4.needsSlot` is `["tax"]`. The queue's page is built on "one tap tags a booking and takes it off the list" (its own info text). The port keeps the tag select as `edit`, the category and purpose as text, and "Same merchant" as a kebab action (one tap more); the four tag buttons (`business`, `tax`, `donation`, `private`) become one select, two taps instead of one. `edit` holds at most 2 controls and the kebab is a menu, so nothing derived holds a row of buttons.

Findings beside the verdict, each measured here:

- **The plan's `value` slot goes by declaration order, not by `card`.** In argo's order `net-worth` puts `Units` (a `number`) in `value` and the actual Value in meta; `recurring` puts `Per charge` before `Per month`. `card: 'value'` on the right column does not win, because the earlier `number` already took it. `net-worth`, `recurring-subscriptions` and `recurring-bills` fit only after reordering their columns, which also reorders the desktop table.
- **The shipped card tier fixes the row at 32 px.** `table.css` sets `height: auto` in `@layer basalt.table`, and the `h-(--table-row-h)` utility on the row sits above that layer and wins. In all five S3 tables every row is taller than its box (12 of 12, 10 of 10, 9 of 9, 12 of 12, 8 of 8), so the stacked card spills over the next row. `table-v0.layout.test.ts` checks horizontal overflow only, so it passes.
- **Card height is not uniform.** The concept fixes the lines per table so virtualization stays arithmetic; here the title and the entity sub line wrap, so `ledger` rows run 184 to 216 px. The title and subtitle need a line clamp in the plan.
- **`ledger` demotes its own amount.** Date (priority 1), the identity and `money` (default priority 1) are three priority-1 columns, so the plan demotes `amount` to 2 with a dev warning.
- **The entity sub line is not styled.** The parts render it as an inline span next to the name (`Nordlicht MarktHaushalt`, see any `s3-ledger-*` shot). It needs its own line before any width question about it is final.

## Verdict

S3: REFUTED
S4: REFUTED
Owner S3: pending
Owner S4: pending
Verdict: REFUTED

**S3.** The tiers and kind widths are sound: `number`, `money`, `date`, `status`, `select`, `actions` never overflowed, and the tier steps hold the table at its container. They are refuted on three counts, in order of weight: `entity` (58 of 71 cells; a fixed or flexible width cannot hold a free-length name and sub line), `spark` at argo's geometry (8), and headers that carry a unit (5). The contract's own fallback applies to `entity`: a `content` width option. It does not apply to `text`, which wraps and never overflowed.

**S4.** The expected six fit, `catalog` and `slots-list` degrade to a meta run and the sheet exactly as expected, and the `tax` queue needs a place for a row of one-tap buttons. That is the "last resort" of section 9: a typed box slot with a fixed height, counted by `lint --stats`. It is an amendment request, not something this spike adds. The owner decides whether the queue keeps its one tap; if it does not, `tax` ports as a select and S4 passes.

Owner acceptance is pending and is the owner's alone: at 1800x1200 for S3 (`s3-<site>-w1800-<theme>`, and the four narrower widths) and at 390x844 for S4 (`s4-<site>-390x844-<theme>`, plus `s4-<site>-1800x1200-<theme>` for the table side). `v3-verdict-table` carries it with these shots.

## Then

- **`entity` wraps, or takes `content`.** The smallest change is the one the contract names: a `content` width option on `entity`, or `entity` joining `text` as a wrapping kind with the sub line on its own line (clamped to two). Either is an amendment; the harness re-runs in two minutes and should read 0 for `name` and `sub-line`.
- **`spark` and `delta` widths.** `spark` needs about 202 px for an 80 px chart plus a figure with its unit or zone (planned 184); a `delta` header carrying a unit and a window needs 140 (planned 104). Raise the two defaults, or give `spark` a `width` that includes the figure.
- **Plan: `card` before declaration order.** An explicit `card: 'value'` should be served before the defaults of earlier columns; today the app has to reorder its desktop columns to move the card's value.
- **`table.css`: the card row height.** Put `height: auto` where it beats the row utility (the `!important` the file already uses for its other fights), and add a layout assertion on row height to `table-v0.layout.test.ts`.
- **Card heights.** Clamp title and subtitle lines in the plan so a card's height is a function of the table, not of its row.
- **`tax`.** An owner decision: keep one-tap tagging (a typed box slot, amendment) or accept a select.

## Affects

- `docs/v3/concepts/data-table.md`: section 9 rows S3 and S4 get this verdict; the concept's owner edits them, and the section 13 amendment rows (a `content` option, a box slot) are requests, not edits made here.
- `v3-verdict-table` (owner acceptance at 1800x1200 and 390x844), `table-t2` (card CSS, plan order, row height).
- G5: argo's `tax` queue and its S4 port; `catalog-table` and `slots-list` lose part of their phone card to the sheet.
- Nothing else: no `package.json` or lockfile outside `tools/spikes/table-fit/package.json`.
