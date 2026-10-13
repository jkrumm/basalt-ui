import { createFileRoute } from '@tanstack/react-router'
import { SpikeLedgerPage } from '../spike/SpikeLedgerPage'

export const Route = createFileRoute('/spike-ledger')({
  staticData: { title: 'Spike: ledger' },
  component: SpikeLedgerPage,
})
