# Table

A table is one `useDataTable` and one `<DataTable>`; the kinds, the tiers and the phone cards are decided for you. Props are in the generated docs: [DataTable](node_modules/basalt-ui/docs/data-table.md), [useDataTable](node_modules/basalt-ui/docs/use-data-table.md). The composed exemplar is `apps/playground/src/routes/table.tsx`: server mode with chips, facets and bulk actions, 10k virtual rows with `c.select`, and one grouped table.

Requires TanStack Table's own `table-state` skill for anything under `t.table`: this file does not restate v9.

## Pick the mode first

- Fewer than about 200 rows and all in hand: `mode: { kind: 'client' }`. Above 500 client rows add `virtual` and a fixed `height`; above that the rows belong on a server.
- The server pages and filters: `mode: { kind: 'server', rowCount }`. Pass `rowCount` as `undefined` until it is known; the table never prints "of 0". A cursor API passes `cursor` instead, never both.
- A table that mounts loading draws six skeleton rows unless the page says how many it expects: `bodyRows: 18` on `useDataTable` draws eighteen, so the frame does not jump when they arrive (one table jumped 370 px from six to eighteen; a `min-h-*` wrapper missed by the row height). A paged table caps it at the page; once rows have shown, loading keeps their height.
- Rows that never sort, filter or select are `ui/table`, not this.
- Rows under a parent row (who waits on whom, the jobs of a run) are a client table with `nested: { parentOf }`: the table draws the indent and the chevron, sorts within a level and keeps a match's path while filtering, so never indent a `c.custom` cell by hand. Rows that share a value (a floor, a state) are `group: { by }` instead. When the question is what blocks what across branches, put a [ChainView](node_modules/basalt-ui/docs/chain-view.md) over the same rows on one `useChartFocus` beside it (`/kit/chain`).

```tsx
// @check
import { col, DataTable, useDataTable } from 'basalt-ui/table'

type Booking = { id: string; payee: string; amount: number; state: string }
const c = col<Booking>()

export function Bookings({ rows }: { rows: readonly Booking[] }) {
  const t = useDataTable({
    id: 'bookings',
    label: 'Bookings',
    columns: [
      c.entity('payee', { filter: 'text' }),
      c.money('amount', { currency: 'EUR', footer: 'sum' }),
      c.status('state', { options: ['Open', 'Settled'], filter: 'multi' }),
    ],
    data: rows,
    getRowId: (row) => row.id,
    mode: { kind: 'client' },
    detail: (row) => <p>{row.payee}</p>,
  })
  return <DataTable table={t} />
}
```

## Reading or grid

- Keep the reading look for a list a reader scans, summarises and opens; pass `look: 'grid'` when the reader works the data, comparing cells across columns and down rows.
- A grid draws a rule between every two cells, compact rows and tabular figures, keeps every visible column and scrolls sideways inside its scroller with the name column pinned, so `priority` hides nothing there. Give it `height: 'fill'` or `{ maxRows }` when it holds more rows than a screen: a sideways scroller cannot stick its head to the page. The reader moves through it cell by cell with the arrow keys; a click on the name opens the row.
- Readers move columns (the Display list, the column menu) and pin them in a grid. Order and pins live with hidden columns in the display state, on the device and in a saved view, never in the URL; declare the columns in the order most readers want and never reorder `columns` in app code to fake a reader's choice.

## Kinds and priority

- A column is a kind (`c.entity`, `c.money`, `c.status`, `c.date`, ...); the kind sets alignment, numerals, width, sort, filter and card slot. A raw column or a free `cell` does not exist. `c.custom` is the one counted escape and must declare `sortValue`, `card` and `priority`.
- A column filters only when it opts in: `filter: 'text'` (`entity`, `text`), `filter: 'multi'` (`status`, `select`, `boolean`), `filter: 'range'` (`number`, `money`, `delta`, `meter`; `bounds: [lo, hi]` adds a slider) and on `date`/`relativeTime` `filter: 'range', picker: DateRangePicker` from `basalt-ui/ui/date-picker` (passed by value, so `./table` adds no peer). Every filterable header shows a filter button at rest that opens its editor in one click (the column menu's `Filter...` is the door on touch); a sortable `status` column also offers its category order, which the user rearranges and the URL carries as `rank.<col>`. A server table receives `range` as `[from, to]` (`''` an open end) and `request.ranks`, and maps both itself.
- `priority` says what survives a narrow table: 1 always, 2 at reduced width, 3 at full width only. Give an identity column 1; at most two columns are 1, the rest demote in declaration order.
- Give a column a `headerIcon` (the icon library's own component) when the icon names its subject faster than the word; a `status`, `boolean`, `date` or `relativeTime` column takes a per-row `icon` as `entity` does, and a status icon replaces the dot in its tone, so one icon per state, never one per row.
- Priority is decided against the table's container, not the viewport: priority 3 shows only from `data-full-at`, the smallest of 800, 1000, 1200, 1440 or 1800 px that holds every visible column (`ch` x 8 px + 24 px each, 44 px for an icon column), and a sum above 1800 px stays reduced; priority 1 and 2 show from 480 px, or 800 px once they sum above 480 px, and the last priority 2 columns drop to 3 while they sum above 800 px. Silent in production: `shot detect` names a hidden column (`craft-6/hidden-column`).
- A table that answers the question keeps the columns the question names. List them before placing the table: a days table lost Steps and Score and a detector table lost Open Issues in a half-width card (about 718 px), because the columns that stayed already used the 480 px that priority 1 and 2 share. Either the table takes the full row, or the question's columns are priority 1 (two at most; a third demotes) or 2 and every other column is 3, with `ch` kept to what the values need so the sum stays at or under 480 px. A column the question names that is missing at 1800 is a finding, however wide the gap between the columns that remain.
- Absent values print a dash; a zero is a zero.

## An age or a duration is a meter

- A column of ages or durations (waiting for, open for, run time) is `c.meter(key, { max })` with `max` the oldest in view, so the eye reads the long ones before it reads a number; bare text ('3 weeks ago') draws nothing to compare. `c.meter` is the column kind most often missed.
- State the rule that makes an item late where the reader meets the column: the column `header` ('Waiting, late after 48 h') or the card's context line. A threshold that lives only in the code leaves every row unexplained (a stuck rule was on no row and no caption). The row that crosses it carries its verdict word in its own column ('Stuck', 'Overdue') and takes the one status hue ([charts](charts.md)).

- A table measure draws its size: a count or a share is `c.meter(key, { max })`, a series over time `c.spark`, where twelve grey pills and numbers draw nothing to compare.
- A meter column sets `card` (`c.meter(key, { max, card })`), so the phone card keeps it: a `pools.meter('usedPct', …)` set none and lost its "Used, %" at 390. A meter column read from the page without it dropped "Median cycle, min" from the phone cards (`c.meter('cycleMin', { …, priority: 2 })`). Every column that answers the question sets its `card` slot, since a column without one takes the kit's order and can drop at 390.
- A status column draws one mark per state through its per-row `icon`, which replaces the dot: one page's "Clean", "Skipped" and "Never run" drew the same grey dot, so five states were told by reading. Pick the icon per state from the tone map you already wrote.

## Where state lives

- `request` (search, filters, sort, page) is the query key and belongs in the URL; `display` (hidden, moved and pinned columns) is the device's. Bind `state` to a `field.composite` of a `defineControls` store, or omit it for a table that holds its own memory.
- A filter the page shares with other widgets stays a page control and reaches the table through `resetOn`; a filter that is a chip on this table stays in `request`. A second table on a page needs a `prefix` on its codec.
- A presentation switch (table or cards) is its own param, never `view`: see the `view-switch` recipe.

## Phone and the 390 px check

- Below 480 px the same rows become cards: sort moves to the toolbar, selection to an explicit Select mode, the row's actions to a kebab. `phone: 'scroll'` keeps a numeric matrix a table, and only where the first column answers the question: it pins the first column and pushes every other off screen (one table lost the answer column that way). Otherwise `priority` keeps the answer column and drops the rest. A table whose phone cards run past one screen at 390 is `phone: 'columns'` (the name, the card's `value` and the first `meta` as a table, the rest in the row's details). The test is the 390 shot rather than a row count: render it and count screens; cards of five or six lines pass one screen at about six rows. Twelve messages filled three screens; tables of eight, fifteen and six rows ran 1,000 to 3,000 px under a threshold of ten. `columns` keeps three columns, so the answering column is among them (`columns` has dropped a Verdict column on one page and cut the addresses on another): set `priority` or a `card` slot on it, and every other column that answers sets a `card` slot too, so every column shows somewhere. Count the screens before choosing `columns`: an Issues table had six rows that fit one screen as cards, and `columns` dropped its loop and age; a table of seventeen rows ran about 3,300 px as cards, so `columns` was right, and its Detail and 90 d age then sat behind the row expand because neither set a `card` slot or `priority`. A table whose cards fit one screen keeps its cards; with `columns`, every answering column is among the three.
- A phone card labels every value but the title with its column header, and a headerless column with its id: the title is the only bare value, so give every column a header that reads well beside its value.
- A unit travels with its number where a phone card drops the column header: the unit in the cell, never only the header "% of lessons". A strip cell fits one line at 390, one name and a count ("Nextcloud +1"), where three names clip. An ordinal (a difficulty, a level) is a mark in the cell, not a word.
- The column that answers survives 390: a CPU column, the evidence for the load question, sat behind a sideways scroll because the page set `phone: 'scroll'` with the event name pinned first; keep the answer column with `priority`, or let the rows become cards. A strip cell fits one line at 390 with its verdict word.
- `t.table` is the read view of what the table shows (`rows`, `matched`, `columns`) for an export or a board over the same rows. Saved views live on the device unless `views: { store }` hands them a `ViewStore`.
- Put `TableToolbar` over every table a reader searches, filters or returns to: its search reads every column as the cell shows it in client mode (a status label, a formatted amount, a date), and it names the current view with a Save view button beside it. A server table receives the phrase as `q` and searches the same columns itself.
- Every column's data must be reachable on a phone. With `detail`, tapping a row opens it; with `onRowActivate`, the row navigates and a Details door opens the sheet; with neither, tapping opens the auto sheet of every column.
- Render the page at 390 wide before you stop and count the cards: a column that appears nowhere is a defect.

## Selection

- `selection: { bulk }` adds the tick column and a bar that shows only while a row is ticked. A bulk action is `{ key, label, onClick(rows, selection) }`, at most five, one primary. `getRowId` is required.
- A selection of every matching row (`selectAll`) is a snapshot of the request: it clears when the request changes.

```tsx
// @check
import { col, DataTable, useDataTable } from 'basalt-ui/table'

type Order = { id: string; customer: string; total: number }
const c = col<Order>()

export function Orders({ rows, total }: { rows: readonly Order[]; total: number | undefined }) {
  const t = useDataTable({
    id: 'orders',
    label: 'Orders',
    columns: [c.entity('customer'), c.money('total', { currency: 'EUR' })],
    data: rows,
    getRowId: (row) => row.id,
    mode: { kind: 'server', rowCount: total },
    selection: { bulk: [{ id: 'archive', label: 'Archive', onClick: (picked) => picked.length }] },
    onRowActivate: (row) => row.id,
  })
  return <DataTable table={t} />
}
```

## Anatomy of a table part

- A table that is the page's answer (a list page) is the one main part of a [Page](node_modules/basalt-ui/docs/page.md) `fill`: it runs to the work surface's edges under the band, with no card around it, and the page's title is its title. A card around it is a card on a card's own colour, a frame for nothing.
- A table among other parts of a padded page is a [DataPanel](node_modules/basalt-ui/docs/data-panel.md) or a card with a title and a context line (`subtitle`: its scope and its rule, a fact), never a flush [Section](node_modules/basalt-ui/docs/section.md) with a small heading beside a card. One page stood two tables in `Section`s with no context line, another's table was a flush small title under an uninset figure, a third's at-risk table a flush section; moving the tables into `DataPanel`s fixed the first.
- A card whose state answers shows its [Status](node_modules/basalt-ui/docs/status.md) at rest, and a coloured band on a chart has a key (one page passed `undefined` for the status and drew bands with no key).
- `c.entity` takes `mono` for an id column (`c.entity('leader', { mono: true })`), where `c.text` has no such switch. `c.date` and `c.relativeTime` take `mono` for a date that reads as a time (`c.date('at', { mono: true })`), drawn mono in the cell and on its phone card line while the label stays in the body face (a page printed 'Received: 8 Nov 2026' in the body face).
- Mono goes to ids and times only (a merge request id, a finding id, an opened timestamp), and nothing else: not a measurement phrase ('tide 2.1 m, swell 0.5 m, 6 s'), not an absent value ('None open' set mono by `subMono`). A slot keeps one face at rest and on focus: one period slot flipped from the body face to mono when focused, and another period line was one mono sentence. A time or an id in the body face is the opposite defect (opened times, ids and hours; a `BarList` label takes no mono, so the id sits in a part that does, such as a footer fact).
- A stat cell beside a long table sits in a strip sized to its content, not 750 px wide with its value and footer 700 px apart.

not guarded:

- Never hand-roll a table, a CSS-grid list that reads as one, or a card twin of a table; a gap in the kinds is reported, not rebuilt.
- Never mix `detail` with `onRowActivate`; one is the row's action.
- A table in a card or a section takes its title from that frame, not from a heading above it.
