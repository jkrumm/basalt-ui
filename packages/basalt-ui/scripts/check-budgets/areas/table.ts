/**
 * Area: table — the `./table` subpath's size (docs/v3/concepts/data-table.md, quality-contract
 * section 6), G1 freeze (table v0). Two rows: the engine fixture (the 10 registered features over
 * `createTableHook`) and our own code on top of it. Seed: first complete build plus 5 percent, rounded
 * up to 0.5 KB, ratcheted down only. Both gzip B minus `base0`, peers bundled.
 */
import { join } from 'node:path'

import type { Raises, RowDef } from '../lib'
import { PKG_ROOT } from '../lib'
import { BASE0, bundleApp, gzipBytes } from '../provider-v3'
import { measureSource, reExportNamed } from '../ui-bundle'

const ENGINE_FIXTURE = join(PKG_ROOT, 'scripts/fixtures/table-engine.tsx')

async function engineBytes(): Promise<number> {
  const [engine, base0] = [await bundleApp(ENGINE_FIXTURE), await bundleApp(BASE0)]
  return gzipBytes(engine) - gzipBytes(base0)
}

const DATA_TABLE = [
  reExportNamed('table/parts/data-table', ['DataTable']),
  reExportNamed('table/use-data-table', ['useDataTable']),
  reExportNamed('table/core/kinds', ['col']),
].join('\n')

export const rows: readonly RowDef[] = [
  {
    id: 'table-engine',
    order: 430,
    label: 'table engine fixture, 10 features (gzip B minus base0, peers bundled)',
    // 23206 B measured (table-core 9.3.1 + React adapter, 2026-11-20); the pre-freeze guard in
    // src/table/core/features.bytes.test.ts reads 24500.
    ceiling: 24500,
    measure: engineBytes,
  },
  {
    id: 'table-own',
    order: 431,
    label: 'table own code: DataTable + useDataTable + col, minus the engine fixture (gzip B)',
    // 105583 B measured (128760 for the three symbols, minus the 23177 engine). Seeded as it stands;
    // retiring the 2.x table internals the closure still reaches is what ratchets it down.
    // 111000 -> 123000 (Issue 1146): 121455 B measured, +15.9 KB gz for the default detail sheet. A row tap
    // with no `detail` host opens a Base UI Drawer (`ui/sheet`), so the drawer and its swipe code join
    // the table's closure; the auto sheet, the Details door and the view-store hook are the rest.
    // 123000 -> 123100 (Issue 1543): +~40 B gz for `detailById`, the detail door of a record the table has not loaded.
    // 123100 -> 123500 (Issue 1541): the open-row mark (`aria-current`, the selected row state) for a `detail`
    // table and for a page-owned `activeRowId`, ~90 B gz.
    // 123500 -> 123900 (Issue 1554): +~330 B gz for the `focus` bridge (row-focus.tsx) that maps a row
    // to a chart's focus item by id and clears it on pointer leave and blur.
    // 123900 -> 124200 (Issue 1631): +~250 B gz for `filters` (page fields with a row predicate, read by
    // `useDataTable`) and `labels` on `c.text`; 124144 B measured.
    // 124200 -> 124600 (Issue 1627): +~400 B gz for the money `delta` (`currency`), the `card: 'hidden'` marker and
    // the skeleton rows of a paged table, the kit fixes of expression cycle 4.
    // 124600 -> 124800 (Issue 1872): 124705 B measured, +110 B gz over master (124595) for the error row that names
    // its panel or table, the kit fixes of expression cycle 7.
    // 124800 -> 125000 (Issue 1873): 124816 B measured, +111 B gz over master (124705) for `focusSeries` (a row
    // that stands for a chart series) and the mono entity name, the contract fields of expression cycle 7.
    // 125000 -> 125800 (Issue 2039): 125524 B measured, +524 B gz over master (125000) for the phone card's labels,
    // the 'n of m shown' cue and the full-width root, the kit fixes of expression cycle 9.
    // 125800 -> 126000 (Issue 2038): 125780 B measured, +256 B gz over master (125524) for `focusItems` (a
    // row that holds chart items of another grain) and `bodyRows` (a first load's skeleton rows), the
    // contract fields of expression cycle 9.
    // 126000 -> 155000 (Issue 2282): 154504 B measured, +28.5 KB gz over master (126000 ceiling) for the header's
    // filter door and its editors (owner review 1): the column menu opens a popover with the kind's editor, so
    // Base UI Popover, Slider, NumberField and the toggle group (Segmented), the checklist and the category
    // order list join DataTable's closure. Not lazy-loaded: this row sums every emitted chunk, so a split
    // would move the bytes, not drop them, and the first open would wait on a fetch.
    // 155000 -> 156500 (Issue 2314): 155942 B measured for nested rows (owner review 1): `nested.parentOf`,
    // the tree item model, the indent and chevron lead, the treegrid row attributes and Right/Left keys.
    // 156500 -> 157200 (Issue 2409): 157138 B measured, +~640 B gz for the 720 px card step, the trailing
    // filler column, the framed table's head in empty and error and the one-line meter, the kit fixes of
    // expression cycle 11.
    // 157200 -> 158500 (Issue 2418): 158030 B measured, +~890 B gz over master (157138) for the header at rest
    // (owner review 2): the filter button and the menu shown at rest, `headerIcon` and the cells' `icon`, search
    // over every column's shown text, and the toolbar's current view with Save beside it.
    // 158500 -> 160500 (Issue 2439): 160334 B measured, +~2300 B gz over master (158030) for the grid look
    // (owner review 2): `look: 'grid'` with its cell keyboard, movable columns (the Display list's drag and
    // keys, the menu's Move left and Move right) and a reader's pins, all in the display state and saved views.
    // 160500 -> 163500 (Issue 2428): 163022 B measured, +~2.7 KB gz over master (160334) from the ui parts the header's filter editors
    // share (owner review 2 forms): Combobox's create row, Select options with an icon and a description,
    // Input's start and end, the Button spinner, the read-only looks.
    // 163500 -> 163800 (Issue 2500): 163623 B measured, +~120 B gz for `phone: 'columns'`, the plan's kept
    // columns and the details door for the columns a phone row leaves (expression cycle 14 contract).
    // 163800 -> 164100 (Issue 2785): 163919 B measured, +~120 B gz from `Meter`, which `c.meter` cells draw:
    // its `caption`, `ticks` and `cause` (expression cycle 18 contract).
    // 164100 -> 167600 (Issue 2854): 167517 B measured after review fixes (167192 at first landing), +~3.3 KB gz over master (163919) for the view lane
    // (bench-table-view): the header's resize separator, a reader's group-by and footer summaries (the column
    // menu's labelled summary group, the footer's stepping cells), the body row height, row numbers and the
    // pinned edge, all in the display state and saved views. A submenu with radio items cost 1.85 KB more and went.
    ceiling: 167600,
    measure: async () => (await measureSource(DATA_TABLE)) - (await engineBytes()),
  },
]

export const raises: Raises = {
  'table-own': [
    {
      from: 164100,
      to: 167600,
      consumer:
        "the benchmark against Accordee (owner direction 2026-11-21, docs/v3/issues/bench/README.md decision 8): column resize, the row height as a view property and a reader's group-by and footer summaries, reversed from the kill list (Issue 2854)",
      repo: 'basalt-ui',
    },
    {
      from: 163800,
      to: 164100,
      consumer:
        "the expression cycle 18 contract (Issue 2785, Spec artifact_01a1fdd4): n87's and n91's meters printed a bare value and n92 wrote its ranges and causes as sibling text, so a Meter draws a caption, range ticks and a cause line, and the table's c.meter cells import that Meter",
      repo: 'basalt-ui',
    },
    {
      from: 163500,
      to: 163800,
      consumer:
        "the expression cycle 14 contract (Issue 2500, Spec artifact_01a1f6fb): n65's twelve friction reasons scrolled sideways at 390 and their cards ran ~1,500 px, as cycle 13's n62 windows table did, so a phone table keeps its name, answer and count as columns",
      repo: 'basalt-ui',
    },
    {
      from: 160500,
      to: 163500,
      consumer:
        "the owner's second review of the v3 playground (2026-11-19): richer form controls in the Forms gallery (apps/playground/src/routes/kit/forms), whose ui parts the table's filter editors import (Issue 2428)",
      repo: 'basalt-ui',
    },
    {
      from: 158500,
      to: 160500,
      consumer:
        "the owner's second review of the v3 playground /table (2026-11-19): a bordered grid look for working data beside the reading look, columns a reader moves and pins, kept in saved views (apps/playground/src/routes/table.tsx; Issue 2439)",
      repo: 'basalt-ui',
    },
    {
      from: 157200,
      to: 158500,
      consumer:
        "the owner's second review of the v3 playground /table (2026-11-19): sort, filter and menu in sight on every header, column icons, search that finds a status, a number or a date, and saved views named in the toolbar (apps/playground/src/routes/table.tsx; Issue 2418)",
      repo: 'basalt-ui',
    },
    {
      from: 156500,
      to: 157200,
      consumer:
        "the kit fixes of expression cycle 11 (Issue 2409): a DataTable in a half-width column (n45, n46, n47, n49, n50) turned into phone cards and a full-width one left a gap before its numbers, a framed table lost its head in empty and error (n33, n47, n48, n49) and a meter's value sat under its bar (n49)",
      repo: 'basalt-ui',
    },
    {
      from: 155000,
      to: 156500,
      consumer:
        "the owner's first review of the v3 playground /scenarios/expr-n32 (2026-11-18): a dependency tree hand-indented in a custom column; nested rows draw it, the playground's /kit/chain over one dataset (Issue 2314)",
      repo: 'basalt-ui',
    },
    {
      from: 126000,
      to: 155000,
      consumer:
        "the owner's first review of the v3 playground /table (2026-11-18): filters from the column header with range, date and enum editors, and a status column's categories the user rearranges (apps/playground/src/routes/table.tsx; Issue 2282)",
      repo: 'basalt-ui',
    },
    {
      from: 125000,
      to: 125800,
      consumer:
        "the table kit fixes of expression cycle 9: n36's phone card printed 'You' and 'Passed' with no label and n33's clipped card list gave no 'n of m shown' cue and its empty table's header row stopped short (apps/playground/src/scenarios/expr/n33, n36; Issue 2039)",
      repo: 'basalt-ui',
    },
    {
      from: 123100,
      to: 123500,
      consumer:
        "the open-row mark of `DataTable`: linewatch's outage table (web/src/components/outage-table.tsx) has a `detail` and no aside host, so the row its sheet shows is now drawn selected with `aria-current` (Issue 1541)",
      repo: 'linewatch',
    },
    {
      from: 111000,
      to: 123000,
      consumer:
        "the default detail sheet of `DataTable`: linewatch's outage table (web/src/components/outage-table.tsx) has a `detail` and no aside host, so a row tap opens the table's own sheet instead of nothing (Issue 1146)",
      repo: 'linewatch',
    },
    {
      from: 123000,
      to: 123100,
      consumer:
        "`detailById`: a table's `detailState` field that names a record the filters exclude opens it instead of clearing, the state cycle 3 orders page (apps/playground/src/cycle/state-3/OrdersPage.tsx) takes it in the next cycle, and any app whose notification or share link names a record (Issue 1543)",
      repo: 'basalt-ui',
    },
    {
      from: 123500,
      to: 123900,
      consumer:
        "`DataTable focus`: expression cycle 3's n02 (apps/playground/src/scenarios/expr/n02) swapped its table beside the stage chart for a hand-built row list to link the two, losing sort and the phone card (X3 0)",
      repo: 'basalt-ui',
    },
    {
      from: 123900,
      to: 124200,
      consumer:
        "`useDataTable filters`: dogfood cycle 2's flow overview (apps/playground/src/cycle/dogfood-2/FlowOverview.tsx) filters its table by three page fields in 11 lines and writes Clear filters in 5, the same code as cycle/state-3/OrdersPage.tsx (dogfood-2.5)",
      repo: 'basalt-ui',
    },
    {
      from: 124200,
      to: 124600,
      consumer:
        "the table kit fixes of expression cycle 4: n13's recurring-charges table (apps/playground/src/scenarios/expr/n13) hand-formatted its money change, n09's job table printed its group name on every card, and a loading table drew six rows against 18 (Issue 1627)",
      repo: 'basalt-ui',
    },
    {
      from: 124600,
      to: 124800,
      consumer:
        "the table kit fixes of expression cycle 7: n11's and n26's tables in error said 'Could not load this.' where a chart card names its title, so the error row now reads 'Could not load <panel title or table label>.' (Issue 1872)",
      repo: 'basalt-ui',
    },
    {
      from: 124800,
      to: 125000,
      consumer:
        "`DataTable focusSeries` and `c.entity` `mono`: expression cycle 7's n26 (apps/playground/src/scenarios/expr/n26) lists the four hops its chart draws as lines and could not link them (X3 0 in every round), and n24's workflow ids and n23's monitor names had no mono face (Issue 1873)",
      repo: 'basalt-ui',
    },
    {
      from: 125800,
      to: 126000,
      consumer:
        "`DataTable focusItems` and `useDataTable bodyRows`: expression cycle 9's n34 (apps/playground/src/scenarios/expr/n34) lists go windows of its hourly tide chart and could not link them (X3 0), n33 joined findings to probes by a 25-line effect, and n36 drew six loading rows against eighteen (Issue 2038)",
      repo: 'basalt-ui',
    },
  ],
}
