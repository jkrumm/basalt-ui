// Spike (W1 ledger): one route mounting the v9 table and the Pacer-backed search draft, so the
// playground build measures what adopting both would add. Evidence, not product.
import { TextInput } from '@mantine/core'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useDebouncedFieldPacer } from './debounce-pacer'
import { SPIKE_ROWS } from './rows'
import { SpikeTableV9 } from './table-v9-use'

export function SpikeLedgerPage(): ReactNode {
  const [q, setQ] = useState('')
  const draft = useDebouncedFieldPacer(q, setQ)
  return (
    <>
      <TextInput value={draft.value} onChange={(e) => draft.set(e.currentTarget.value)} />
      <SpikeTableV9 data={SPIKE_ROWS.filter((r) => r.name.includes(q))} />
    </>
  )
}
