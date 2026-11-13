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
    ceiling: 351, // landed (v3-ai-i4): validate 149, block 118, define 81; P6 target 250 of code
    measure: () =>
      totalLines(
        walkFiles(join(PKG_ROOT, 'src/ai/catalog'), /\.tsx?$/).filter(
          (path) => !/\.test\.tsx?$/.test(path),
        ),
      ),
  },
]
