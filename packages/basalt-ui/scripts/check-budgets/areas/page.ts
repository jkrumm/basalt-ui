/**
 * Area: page — the `./page` subpath, G2 freeze (docs/v3/ARCHITECTURE.md section 3). Value symbols are
 * exact (a new one is a row here and a named consumer); the byte row is the first complete build plus
 * 5 percent, rounded up to 0.5 KB (quality-contract section 6), ratcheted down only. `../ui-bundle`
 * measures it (gzip B minus `base0`, peers bundled, whole barrel). The authored-file line budget for
 * the v3 paths of every G2 layer lives in `./shell`.
 */
import type { Raises, RowDef } from '../lib'
import { readSurface } from '../lib'
import { measureSource, reExportAll } from '../ui-bundle'

export const rows: readonly RowDef[] = [
  {
    id: 'page-symbols',
    order: 440,
    label: 'public value symbols, ./page (exact, export-surface shard)',
    ceiling: 23, // v3 peek: `Peek`
    measure: () => readSurface()['./page']?.length ?? 0,
  },
  {
    id: 'page-subpath',
    order: 441,
    label: 'page, whole barrel (gzip B minus base0, src/page, peers bundled)',
    // 107199 B measured.
    ceiling: 113000,
    measure: () => measureSource(reExportAll({ page: 'page/index' })),
  },
]

export const raises: Raises = {
  'page-symbols': [
    {
      from: 22,
      to: 23,
      consumer:
        '`Peek` from `./page`: software-factory console components/kit/peek.tsx hand-builds the non-modal record panel its lists open through one click handler',
      repo: 'software-factory',
    },
    {
      from: 21,
      to: 22,
      consumer:
        "`Facts` from `./page`: the dogfood cycle's issue inspector (apps/playground/src/cycle/dogfood-1/FlowOverview.tsx) hand-builds the label and value `dl` in its `PageAside`; every inspector body is such a list",
      repo: 'basalt-ui',
    },
  ],
}
