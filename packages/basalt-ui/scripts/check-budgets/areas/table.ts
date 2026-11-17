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
    // 23177 B measured (table-core 9.2.8 + React adapter); the pre-freeze guard in
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
    ceiling: 126000,
    measure: async () => (await measureSource(DATA_TABLE)) - (await engineBytes()),
  },
]

export const raises: Raises = {
  'table-own': [
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
