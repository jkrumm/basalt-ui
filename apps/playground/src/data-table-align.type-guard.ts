// Proves the two ways `meta.align` can be named wrong are BOTH compile errors, not silent
// left-alignment. The module augmentation in basalt-ui/data/table closes `ColumnMeta`, so an
// unknown key trips the excess-property check and a wrong value trips the union.
import { createColumnHelper } from 'basalt-ui/data/table'

type Row = { name: string; cost: number }
const col = createColumnHelper<Row>()

export const ok = col.accessor('cost', { header: 'Cost', meta: { align: 'right' } })

export const typoKey = col.accessor('cost', {
  header: 'Cost',
  // @ts-expect-error `aling` is not a ColumnMeta key — a typo must not silently left-align money
  meta: { aling: 'right' },
})

export const typoValue = col.accessor('cost', {
  header: 'Cost',
  // @ts-expect-error 'end' is not a DataTableAlign — the CSS word is not the token
  meta: { align: 'end' },
})
// PROVES: a misnamed alignment key or value fails tsc; a wrong VALUE reaching runtime throws.
