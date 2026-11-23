# Table

A table is one `useDataTable` and one `<DataTable>`; the kinds, the tiers and the phone cards are decided for you. Props are in the generated docs: [DataTable](node_modules/basalt-ui/docs/data-table.md), [useDataTable](node_modules/basalt-ui/docs/use-data-table.md). A whole list page starts from `basalt-ui add list-page`: server mode with chips, facets and bulk actions.

Anything under `t.table` follows TanStack Table's own `table-state` skill: this file does not restate it.

## Pick the mode first

- Fewer than about 200 rows and all in hand: `mode: { kind: 'client' }`. Above 500 client rows add `virtual` and a fixed `height`; above that the rows belong on a server.
- The server pages and filters: `mode: { kind: 'server', rowCount }`. Pass `rowCount` as `undefined` until it is known; the table never prints "of 0". A cursor API passes `cursor` instead, never both.
- A table that mounts loading draws six skeleton rows unless the page says how many it expects: `bodyRows: 18` on `useDataTable` draws eighteen, so the frame does not jump when they arrive (a `min-h-*` wrapper misses by the row height). A paged table caps it at the page; once rows have shown, loading keeps their height.
- Rows that never sort, filter or select are `ui/table`, not this.
- Rows under a parent row (who waits on whom, the jobs of a run) are a client table with `nested: { parentOf }`: the table draws the indent and the chevron, sorts within a level and keeps a match's path while filtering, so never indent a `c.custom` cell by hand. Rows that share a value (a floor, a state) are `group: { by }` instead. When the question is what blocks what across branches, put a [ChainView](node_modules/basalt-ui/docs/chain-view.md) over the same rows on one `useChartFocus` beside it.

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
- Widths are the kinds': the text-like columns share the free width of their container, so a table on a padded page ends at the container's edge, while figures and dates keep their fitted width; a grid caps them at their kind's width. Never widen a column by hand to fill a page.
- Widths, the row height, a grouping and the footer summaries are the reader's too: a header's end edge resizes its column, the column menu groups by a column whose kind groups and picks a summary, a footer cell steps through them. Declare the defaults (`group`, a kind's `footer`, `rowHeight`) and never rebuild these controls; a server table neither groups nor picks a summary.
- A grid of many rows a reader counts takes `rowNumbers: true`: the tick, the number and the name stay pinned while the rest scrolls under them.
- Readers move and pin columns. Order and pins live with hidden columns in the display state, on the device and in a saved view, never in the URL; declare the columns in the order most readers want and never reorder `columns` in app code to fake a reader's choice.

## Kinds and priority

- A column is a kind (`c.entity`, `c.money`, `c.status`, `c.date`, ...); the kind sets alignment, numerals, width, sort, filter and card slot. A raw column or a free `cell` does not exist. `c.custom` is the one counted escape and must declare `sortValue`, `card` and `priority`.
- A column filters only when it opts in: `filter: 'text'` (`entity`, `text`, `link`), `filter: 'multi'` (`status`, `select`, `boolean`, `person`, `tags`; the last two list the values the rows hold), `filter: 'range'` (`number`, `money`, `delta`, `meter`; `bounds: [lo, hi]` adds a slider) and on `date`/`relativeTime`/`countdown` `filter: 'range', picker: DateRangePicker` from `basalt-ui/ui/date-picker` (passed by value, so `./table` adds no peer). A header at rest is its kind's icon and its label, plus one arrow while it sorts and one mark while it filters; a click, a tap or Enter opens its one menu (sort, filter, move, reset width, hide), so never add a header control of your own; a sortable `status` column also offers its category order, which the user rearranges and the URL carries as `rank.<col>`. A server table receives `range` as `[from, to]` (`''` an open end) and `request.ranks`, and maps both itself.
- Records, not numbers: `c.person('owner', { avatar, role })` is a 16 px face, the name and a muted role, and `c.people('team')` an avatar stack. `c.tags('labels', { tone })` is chips on one line with a `+N` for those that do not fit, any-of filtered. `c.countdown('due', { warn: 7 })` prints `26 days late` or `in 4 days` (red at or below `bad`, default overdue; amber at or below `warn`; the date past `horizon`, default 60). `c.link('site', { href, label, icon })` is quiet text; only http(s), mailto and tel become links. `c.entity` takes `image` and `ref` (a muted id beside the name); `c.title('name', { type, icons })` picks its leading icon per row from a typed map; `c.text('preview', { quiet: true })` is the muted one-line preview. Colour sits in a pill or in the countdown's text, never in a row tint; a case these cover is never a `c.custom`.
- A header is its label in the reading look, so a right-aligned label ends where its figures end and its help mark sits on the outer side of the label; the grid look draws each kind's header icon, and `headerIcons` on `useDataTable` sets either way. Give a column a `headerIcon` when the icon names its subject faster than the word, `headerIcon: false` to drop one. A `status`, `boolean`, `date` or `relativeTime` column takes a per-row `icon` as `entity` does; a status icon replaces the dot in its tone, one icon per state, so states are told apart without reading.
- `c.select` is the one inline editor: it rests as its value and draws its control while the row is hovered, focused (F2 on the row, Enter on the control) or tapped; more than one field of a row is edited in its `detail`.
- Absent values print a dash; a zero is a zero.

### Priority

- `priority` says what survives a narrow table: 1 always, 2 at reduced width, 3 at full width only. Give an identity column 1; at most two columns are 1, the rest demote in declaration order.
- Tiers are decided against the table's container, never the viewport, from the kind widths (`ch` × 8 px + 24 px per column, 44 px for an icon column). Priority 3 shows from `data-full-at`, the smallest width step that holds every visible column (steps 40 px apart up to 800 px, then 100 to 200 px apart up to 1800 px); a sum above 1800 px stays reduced. Priority 1 and 2 show from 480 px, from 700 px once they sum above 480 px, and from 800 px once they sum above 700 px; above 800 px the trailing priority 2 columns drop to 3. `shot detect` names a hidden column (`craft-6/hidden-column`), which is silent in production.
- A table that answers the question keeps the columns the question names. List them before placing the table: either the table takes the full row, or the question's columns are priority 1 (two at most) or 2, every other column is 3, and `ch` stays at what the values need so priority 1 and 2 sum to 480 px or less. A named column missing at 1800 is a finding, however wide the gaps between the columns that remain.

## Measures in a column

- A column of ages or durations (waiting for, open for, run time) is `c.meter(key, { max })` with `max` the oldest in view, so the eye reads the long ones before it reads a number. A count or a share is a `c.meter` too, a series over time a `c.spark`.
- State the rule that makes an item late where the reader meets the column: the column `header` ("Waiting, late after 48 h") or the card's context line. The row that crosses it carries its verdict word in its own column ("Stuck", "Overdue") and takes the one status hue ([chart-color](chart-color.md)).
- Work in several states is one track: `c.meter('open', { segments: [{ label: 'Running', tone: 'accent', value }, ...], max })`, each part named in the tooltip. A share of a per-row whole is `c.meter('done', { max: (row) => row.total, fraction: true })`, read `455/472` and sorted by the share.
- A median time is `c.number(key, { duration: 'ms', trend: { before, better: 'lower', against: 'the 7 days before' } })`; a count of a count is `c.number('clean', { of: (row) => row.run, warnBelow: 1 })`, read `11/12`.
- A state read at a glance is `c.status(key, { lamp: true })`: the dot alone, the word on hover. `age: { at, label }` on `number` or `status` adds a quiet age in a slot of its own. A header the reader may not know takes `help`. A spark with `value` draws its total beside the line and sorts by it.
- An ordinal (a difficulty, a level) is a mark in the cell, never a word.
- A small fixed set of named filters (All, Alerts, Moving) is the view row's counted tabs: `PageBar` `tabs` over an enum field.

## Where state lives

- `request` (search, filters, sort, page) is the query key and belongs in the URL; `display` (hidden, moved and pinned columns) is the device's. Bind `state` to a `field.composite` of a `defineControls` store, or omit it for a table that holds its own memory.
- A filter the page shares with other widgets stays a page control and reaches the table through `resetOn`; a filter that is a chip on this table stays in `request`. A second table on a page needs a `prefix` on its codec.
- One record set as a table, a list, a board or a gallery is the view's layout: `useDataTable({ layouts })` and `PageBar layout={views.layout}`, never a second table or a hand-built card grid. A chain or nested presentation is its own param, never `view`: see the `view-switch` recipe.
- A list page's saved views are tabs in its `PageBar` view row: `useTableViews(t)` gives `tabs`, `search`, `controls`, `layout`, `settings`, the `chips` of active filters and the manage-view `panel` (recipe `saved-views.md`), so the page draws one view row and no `TableToolbar`. A table in a card keeps `TableToolbar`, which draws the same views. Never rebuild a view list from page fields: the view owns columns, widths, row height, filters, sort and grouping. Saved views live on the device unless `views: { store }` hands them a `ViewStore`.
- Put `TableToolbar` over every table in a card a reader searches, filters or returns to: in client mode its search reads every column as the cell shows it. A server table receives the phrase as `q` and searches the same columns itself.
- `t.table` is the read view of what the table shows (`rows`, `matched`, `columns`) for an export or a board over the same rows.

## Phone and the 390 px check

- Below 480 px the same rows become cards: sort moves to the toolbar, selection to an explicit Select mode, the row's actions to a kebab. When slots run out the card chooses in this order: a slot a column names, then a column that draws a meter, a delta or a status, then text and number columns in declaration order; `card: 'value'` stays the override.
- `phone: 'scroll'` keeps a numeric matrix a table, and only where the first column answers the question: it pins the first column and pushes every other off screen. Otherwise `priority` keeps the answer column and drops the rest.
- A table whose phone cards run past one screen at 390 is `phone: 'columns'` (the name, the card's `value` and the first `meta` as a table, the rest in the row's details). Decide from the 390 shot, not a row count: cards of five or six lines pass one screen at about six rows. `columns` keeps three columns, so the answering column is among them: set its `priority` or a `card` slot.
- Every column that answers the question sets its `card` slot (a meter column too: `c.meter(key, { max, card })`), since a column without one takes the kit's order and can drop at 390.
- A phone card labels every value but the title with its column header, so give every column a header that reads well beside its value. A unit travels in the cell, never only in the header.
- Every column's data must be reachable on a phone. With `detail`, tapping a row opens it; with `onRowActivate`, the row navigates and a Details door opens the sheet; with neither, tapping opens the auto sheet of every column. Render the page at 390 and count: a column that appears nowhere is a defect.

## Selection

- `selection: { bulk }` adds the tick column and a bar that shows only while a row is ticked. A bulk action is `{ id, label, onClick(rows, selection), icon? }` ([BulkBar](node_modules/basalt-ui/docs/bulk-bar.md)). `getRowId` is required.
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

- A table that is the page's answer (a list page) is the one main part of a [Page](node_modules/basalt-ui/docs/page.md) `fill`: it runs to the work surface's edges under the band, with no card around it, and the page's title is its title.
- A table among other parts of a padded page is a [DataPanel](node_modules/basalt-ui/docs/data-panel.md) or a card with a title and a context line (`subtitle`: its scope and its rule), never a flush [Section](node_modules/basalt-ui/docs/section.md) with a small heading beside a card.
- A card whose state answers shows its [Status](node_modules/basalt-ui/docs/status.md) at rest, and a coloured band on a chart has a key.
- Mono goes to ids and times only: `c.entity('leader', { mono: true })` for an id column (`c.text` has no such switch), `c.date` and `c.relativeTime` take `mono` for a date that reads as a time. Never a measurement phrase or an absent value; a slot keeps one face at rest and on focus.
- A stat cell beside a long table sits in a strip sized to its content.

not guarded:

- Never hand-roll a table, a CSS-grid list that reads as one, or a card twin of a table; a gap in the kinds is reported, not rebuilt.
- Never mix `detail` with `onRowActivate`; one is the row's action.
- A table in a card or a section takes its title from that frame, not from a heading above it.
