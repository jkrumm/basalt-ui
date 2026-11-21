/** Seeded photo library for scenario expr-n87: the same numbers on every load, four named variants. */

/** The raw archive check ends in a count, in no answer, or has not finished. */
export type RawArchive =
  | { state: 'ready'; orphaned: number; bytes: number }
  | { state: 'unavailable' }
  | { state: 'counting' }

export type SyncTarget = { name: string; unsynced: number; oldestDays: number }

export type WaitingKind = 'trash' | 'sidecar'

/** One thing that waits: a trash entry past retention or an unreadable sidecar file. */
export type Waiting = {
  id: string
  kind: WaitingKind
  name: string
  detail: string
  /** Days in the trash; a sidecar has none. */
  days: number | undefined
}

export type Library = {
  finals: number
  staging: number
  /** Epoch ms of the last reindex; `undefined` before the first one. */
  reindexedAt: number | undefined
  archive: RawArchive
  targets: readonly [SyncTarget, SyncTarget]
  /** Every unreadable sidecar; `waiting` lists the first of them. */
  unreadable: number
  waiting: readonly Waiting[]
}

/** The page's clock: 21 Nov 2026, 09:30 UTC. */
export const NOW = Date.UTC(2026, 10, 21, 9, 30)

/** Days a trash entry is kept before it is past retention. */
export const RETENTION_DAYS = 30

const REASONS = [
  'Truncated XML',
  'Unknown encoding',
  'Locked by another app',
  'Version newer than the library',
] as const

/** mulberry32: a small seeded generator, so the lists never change between loads. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pad = (n: number, width: number) => String(n).padStart(width, '0')

/** Trash entries oldest first, then `listed` sidecars in path order. */
function makeWaiting(trash: number, listed: number): readonly Waiting[] {
  const next = seeded(8701)
  const trashed: Waiting[] = Array.from({ length: trash }, (_, i) => {
    const days = RETENTION_DAYS + 4 + Math.floor(next() * 22) + i
    return {
      id: `trash-${i}`,
      kind: 'trash' as const,
      name: `2026/09/IMG_${pad(1000 + Math.floor(next() * 800), 4)}.jpg`,
      detail: `${(18 + next() * 14).toFixed(1)} MB`,
      days,
    }
  }).sort((a, b) => b.days - a.days)
  const sidecars: Waiting[] = Array.from({ length: listed }, (_, i) => {
    const month = 8 + Math.floor((i * 4) / Math.max(listed, 1))
    const shot = 2000 + Math.floor(next() * 7000)
    return {
      id: `sidecar-${i}`,
      kind: 'sidecar' as const,
      name: `2026/${pad(month, 2)}/IMG_${pad(shot, 4)}.xmp`,
      detail: REASONS[Math.floor(next() * REASONS.length)] ?? REASONS[0],
      days: undefined,
    }
  }).sort((a, b) => a.name.localeCompare(b.name))
  return [...trashed, ...sidecars]
}

const REINDEXED_AT = NOW - 3 * 3_600_000 - 20 * 60_000

/** A big import landed: 12 finals behind on one target, 37 orphaned raws, 3 trash entries, 150 sidecars. */
const IMPORT: Library = {
  finals: 3800,
  staging: 1200,
  reindexedAt: REINDEXED_AT,
  archive: { state: 'ready', orphaned: 37, bytes: 2_100_000_000 },
  targets: [
    { name: 'NAS', unsynced: 0, oldestDays: 0 },
    { name: 'Cloud', unsynced: 12, oldestDays: 40 },
  ],
  unreadable: 150,
  waiting: makeWaiting(3, 100),
}

/** A fresh library: every count is a zero. */
const FRESH: Library = {
  finals: 0,
  staging: 0,
  reindexedAt: undefined,
  archive: { state: 'ready', orphaned: 0, bytes: 0 },
  targets: [
    { name: 'NAS', unsynced: 0, oldestDays: 0 },
    { name: 'Cloud', unsynced: 0, oldestDays: 0 },
  ],
  unreadable: 0,
  waiting: [],
}

const LIBRARIES: Readonly<Record<string, Library>> = {
  fresh: FRESH,
  unavailable: { ...IMPORT, archive: { state: 'unavailable' } },
  counting: { ...IMPORT, archive: { state: 'counting' } },
}

/** `?fixture=` names: `fresh`, `unavailable`, `counting`; anything else is the post-import library. */
export function libraryFor(fixture: string | undefined): Library {
  return (fixture !== undefined ? LIBRARIES[fixture] : undefined) ?? IMPORT
}

/** Finals missing from at least one target: the most any one target lacks. */
export const unsyncedFinals = (lib: Library): number =>
  Math.max(...lib.targets.map((t) => t.unsynced))
