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
    ceiling: 123500,
    measure: async () => (await measureSource(DATA_TABLE)) - (await engineBytes()),
  },
]

export const raises: Raises = {
  'table-own': [
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
  ],
}
