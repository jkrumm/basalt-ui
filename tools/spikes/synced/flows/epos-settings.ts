// fallow-ignore-file
import type { Transport } from '../core'

// Per-field settings; the server stores each key on its own.
export type EposState = { theme: string; send_key: string; level: string; density: string }
export const EPOS_INITIAL: EposState = {
  theme: 'system',
  send_key: 'enter',
  level: 'novice',
  density: 'comfortable',
}
const KEYS = ['theme', 'send_key', 'level', 'density'] as const

// GET returns the fields (plus extras this transport ignores), PUT takes a patch of only the changed
// fields and answers `{}`: no rev, no updated_at. So `save` SYNTHESISES its result: the merged value
// and a local counter as rev. The never-revert guard (the file's client-side per-field `changedAt`)
// lives in the core, not here.
export function eposSettings(owner: () => string | null): Transport<EposState> {
  let counter = 0
  const call = async (
    method: 'GET' | 'PUT',
    body?: Partial<EposState>,
  ): Promise<Record<string, string>> => {
    const res = await fetch('/settings', {
      method,
      headers: { 'x-owner': owner() ?? '', 'content-type': 'application/json' },
      ...(body && { body: JSON.stringify(body) }),
    })
    return (await res.json()) as Record<string, string>
  }
  return {
    async load() {
      const row = await call('GET')
      return { value: Object.fromEntries(KEYS.map((k) => [k, row[k]])) as EposState, rev: null }
    },
    async save(patch, base) {
      await call('PUT', patch)
      return { value: { ...(base.value ?? EPOS_INITIAL), ...patch }, rev: String(++counter) }
    },
  }
}
