// fallow-ignore-file
import type { Transport } from '../core'

// Synthetic whole-state shape; the flow is one document the server stores as a unit.
export type GymState = { unit: string; restSec: number; barKg: number; note: string }
export const GYM_INITIAL: GymState = { unit: 'kg', restSec: 90, barKg: 20, note: '' }

type Row = { state: GymState | null; updated_at: string | null }

// Whole-state GET/PUT, server stamps updated_at (the rev), last write wins, no 409.
export function argoGym(owner: () => string | null): Transport<GymState> {
  const call = async (method: 'GET' | 'PUT', body?: GymState): Promise<Row> => {
    const res = await fetch('/gym', {
      method,
      headers: { 'x-owner': owner() ?? '', 'content-type': 'application/json' },
      ...(body && { body: JSON.stringify(body) }),
    })
    return (await res.json()) as Row
  }
  return {
    async load() {
      const row = await call('GET')
      return { value: row.state, rev: row.updated_at }
    },
    async save(patch, base) {
      const row = await call('PUT', { ...(base.value ?? GYM_INITIAL), ...patch })
      return { value: row.state as GymState, rev: row.updated_at as string }
    },
  }
}
