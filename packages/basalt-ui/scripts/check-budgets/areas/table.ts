/**
 * Area: table — the `./table` subpath's size (docs/v3/concepts/data-table.md, quality-contract
 * section 6), G1 freeze (table v0). Two rows: the engine fixture (the 10 registered features over
 * `createTableHook`) and our own code on top of it. Seed: first complete build plus 5 percent, rounded
 * up to 0.5 KB, ratcheted down only. Both gzip B minus `base0`, peers bundled.
 */
import { join } from 'node:path'

import type { RowDef } from '../lib'
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
    ceiling: 111000,
    measure: async () => (await measureSource(DATA_TABLE)) - (await engineBytes()),
  },
]
