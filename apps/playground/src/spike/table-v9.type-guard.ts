// Spike (W1 ledger): the per-table `columnMeta` slot keeps today's typo guard WITHOUT the global
// `declare module` augmentation — each line below must fail to compile.
import type { SpikeRow } from './rows'
import { createColumnHelper } from './table-v9-features'

const col = createColumnHelper<SpikeRow>()
// @ts-expect-error — misspelled meta key
col.accessor('revenue', { meta: { aling: 'right' } })
// @ts-expect-error — wrong meta value
col.accessor('revenue', { meta: { align: 'end' } })
// @ts-expect-error — unknown accessor key
col.accessor('nope', {})
