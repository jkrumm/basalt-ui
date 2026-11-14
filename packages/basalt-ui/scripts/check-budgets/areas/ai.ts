/**
 * Area: ai — the generative catalog engine (`src/ai/catalog`: `defineBlock`, `defineCatalog`,
 * `validate`, `Block`). docs/v3/concepts/ai-mdx.md P6 holds the engine to 250 lines; this row
 * counts every line, doc comments included, so it is gated at the landed value and ratchets down.
 */
import { join } from 'node:path'

import { PKG_ROOT, totalLines, walkFiles } from '../lib'
import type { RowDef } from '../lib'

export const rows: readonly RowDef[] = [
  {
    id: 'ai-catalog-lines',
    order: 170,
    label: 'catalog engine lines (src/ai/catalog, tests excluded)',
    ceiling: 341, // landed (Issue 1161): validate 144, block 113, define 84; 240 lines of code against the P6 target of 250
    measure: () =>
      totalLines(
        walkFiles(join(PKG_ROOT, 'src/ai/catalog'), /\.tsx?$/).filter(
          (path) => !/\.test\.tsx?$/.test(path),
        ),
      ),
  },
]
