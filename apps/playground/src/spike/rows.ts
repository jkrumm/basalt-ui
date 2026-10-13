// Spike fixture (W1 ledger): a DataTable-shaped row set. Evidence, not product.
export type SpikeRow = {
  id: string
  name: string
  team: 'core' | 'data' | 'infra'
  revenue: number
  updated: Date
}

const TEAMS = ['core', 'data', 'infra'] as const

export const SPIKE_ROWS: SpikeRow[] = Array.from({ length: 200 }, (_, i) => ({
  id: `r${i}`,
  name: `Project ${(i * 7919) % 200}`,
  team: TEAMS[i % 3] ?? 'core',
  revenue: (i * 104729) % 10_000,
  updated: new Date(Date.UTC(2026, 0, 1 + (i % 300))),
}))
