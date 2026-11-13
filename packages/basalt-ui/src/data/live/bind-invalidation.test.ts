/**
 * bindInvalidation: the console policy and debounce suites ported onto the generic binding
 * (software-factory apps/console test/policy.test.ts, test/debounce.test.ts), plus L1 to L3 of
 * live-realtime.md section 5. A fake scheduler and `fakeChannel` throughout; the two cases that
 * need a real channel (an unparseable frame, a beat) run `createChannel` on an in-memory transport.
 */
import { queryOptions } from '@tanstack/react-query'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { createChannel } from '../../core/channel'
import type { Scheduler } from '../../core/channel'
import type { Transport, Wire } from '../../core/channel-transport'
import { fakeChannel } from '../../testing/fake-channel'
import { makeQueryClient } from '../query-client'
import { bindInvalidation } from './bind-invalidation'
import type { Affects } from './bind-invalidation'
import { liveQuery } from './live-query'

// ---- the console policy, as its adopter would write `map` --------------------------------------

type Change = {
  kind: string
  ref: string | null
  issue?: number | null
  detail?: Record<string, unknown>
}
type Key = readonly unknown[]

const KNOWN_KINDS = new Set(['issue', 'session', 'decision', 'artifact', 'errand', 'signal'])
const LISTED_KINDS = new Set(['issue', 'decision', 'artifact', 'errand', 'signal'])
const isKnown = (kind: string) => KNOWN_KINDS.has(kind)
const ISSUE_ID = /^(?:issue_)?([1-9][0-9]*)$/
const issueNumber = (id: string | null | undefined): number | null => {
  const match = id ? ISSUE_ID.exec(id) : null
  return match?.[1] ? Number(match[1]) : null
}
const changeIssue = (c: Change) => c.issue ?? issueNumber(c.ref)
const named = (c: Change, field: string) => {
  const value = c.detail?.[field]
  return typeof value === 'string' ? value : null
}
function detailAffects(c: Change, kind: 'decision' | 'artifact', id: string): boolean {
  if (!isKnown(c.kind)) return true
  if (c.kind === kind) {
    const target = named(c, kind)
    return target === null || target === id
  }
  return c.kind === 'issue'
}
const lists = (c: Change) => LISTED_KINDS.has(c.kind) || !isKnown(c.kind)
const BY_ROOT: Record<string, (c: Change, key: Key) => boolean> = {
  needs: lists,
  flow: lists,
  'issue-cards': (c) => c.kind === 'issue' || !isKnown(c.kind),
  chain: lists,
  errands: (c) => c.kind === 'errand' || !isKnown(c.kind),
  issue: (c, key) => {
    const n = changeIssue(c)
    return n === null || n === issueNumber(String(key[1]))
  },
  decision: (c, key) => detailAffects(c, 'decision', String(key[1])),
  artifact: (c, key) => detailAffects(c, 'artifact', String(key[1])),
}
const affected =
  (c: Change): ((key: QueryKey) => boolean) =>
  (key) =>
    (BY_ROOT[String(key[0])] ?? (() => true))(c, key)

const ROOTS = [
  'needs',
  'flow',
  'issue-cards',
  'chain',
  'errands',
  'issue',
  'decision',
  'artifact',
  'kpis',
  'friction',
  'finding-classes',
  'fix-commits',
] as const
const AGGREGATES = ['kpis', 'friction', 'finding-classes', 'fix-commits'] as const
type Root = (typeof ROOTS)[number]

const KEYS = {
  needs: ['needs'],
  flow: ['flow'],
  cards: ['issue-cards'],
  chain: ['chain'],
  errands: ['errands'],
  kpis: ['kpis', 7],
  friction: ['friction', 7],
  classes: ['finding-classes'],
  fixes: ['fix-commits'],
  issue12: ['issue', '12'],
  issue13: ['issue', 'issue_13'],
  decisionA: ['decision', 'dec_a'],
  decisionB: ['decision', 'dec_b'],
  artifactA: ['artifact', 'art_a', 'latest'],
  artifactB: ['artifact', 'art_b', 3],
} as const satisfies Record<string, QueryKey>
const NAMES = Object.keys(KEYS) as (keyof typeof KEYS)[]

// ---- harness -----------------------------------------------------------------------------------

function fakeScheduler() {
  let now = 0
  let next = 0
  const timers = new Map<number, { at: number; run: () => void }>()
  const scheduler: Scheduler = {
    set(run, ms) {
      timers.set(++next, { at: now + ms, run })
      return next
    },
    clear: (h) => void timers.delete(h as number),
    now: () => now,
  }
  const advance = (ms: number) => {
    const target = now + ms
    for (;;) {
      const due = [...timers].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0]
      if (!due) break
      timers.delete(due[0])
      now = due[1].at
      due[1].run()
    }
    now = target
  }
  return { scheduler, advance, pending: () => timers.size }
}

const settle = async () => {
  for (let i = 0; i < 4; i++) await new Promise<void>((r) => setImmediate(r))
}

async function world(
  keys: Record<string, QueryKey> = KEYS,
  extra: { class?: 'pushed' | 'standard'; only?: string[] } = {},
) {
  const client = makeQueryClient()
  for (const [name, queryKey] of Object.entries(keys)) {
    if (extra.only && !extra.only.includes(name)) continue
    const options =
      extra.class === 'standard'
        ? liveQuery(queryOptions({ queryKey, queryFn: () => name }), 'standard')
        : liveQuery(queryOptions({ queryKey, queryFn: () => name }), {
            class: 'pushed',
            fallback: 15_000,
            safety: 60_000,
          })
    await client.fetchQuery(options)
  }
  const invalidated = (): string[] =>
    Object.entries(keys)
      .filter(([, key]) => client.getQueryState(key)?.isInvalidated)
      .map(([name]) => name)
  const clean = () => {
    for (const [name, key] of Object.entries(keys)) client.setQueryData(key, name)
  }
  return { client, invalidated, clean }
}

let stops: (() => void)[] = []
afterEach(() => {
  for (const stop of stops) stop()
  stops = []
})

async function bound(
  over: Partial<Parameters<typeof bindInvalidation<Change | null, Root>>[2]> = {},
) {
  const w = await world()
  const clock = fakeScheduler()
  const channel = fakeChannel<Change | null>()
  const live = bindInvalidation<Change | null, Root>(w.client, channel, {
    roots: ROOTS,
    aggregates: AGGREGATES,
    map: (c) => (c === null ? 'all' : affected(c)),
    scheduler: clock.scheduler,
    ...over,
  })
  stops.push(live.start())
  w.clean() // the boot join of the first greeting is not under test here
  const hits = (frame: Change | null) => {
    w.clean()
    channel.emit(frame)
    clock.advance(10_000)
    return w.invalidated()
  }
  return { ...w, clock, channel, live, hits }
}

// ---- ported policy suite -----------------------------------------------------------------------

describe('policy: which pushed queries a frame alters', () => {
  test('an Issue event alters the lists, the aggregates and its own page, not another Issue', async () => {
    const { hits } = await bound()
    const names = hits({ kind: 'issue', ref: 'issue_12' })
    for (const n of ['needs', 'flow', 'chain', 'kpis', 'issue12', 'cards'] as const)
      expect(names).toContain(n)
    for (const n of ['issue13', 'errands'] as const) expect(names).not.toContain(n)
  })

  test('the Issue titles are refetched by an Issue change, not by a hook event', async () => {
    const { hits } = await bound()
    expect(hits({ kind: 'issue', ref: 'issue_12' })).toContain('cards')
    expect(hits({ kind: 'session', ref: 'issue_12' })).not.toContain('cards')
  })

  test('a session event leaves needs, flow and chain alone', async () => {
    const { hits } = await bound()
    const names = hits({ kind: 'session', ref: 'issue_13' })
    expect(names).toEqual(expect.arrayContaining(['issue13', 'kpis', 'friction']))
    for (const n of ['needs', 'flow', 'chain', 'issue12', 'artifactA'] as const)
      expect(names).not.toContain(n)
  })

  test('a Decision answered alters needs and that Decision, not another', async () => {
    const { hits } = await bound()
    const names = hits({ kind: 'decision', ref: 'issue_12', detail: { decision: 'dec_a' } })
    expect(names).toContain('needs')
    expect(names).toContain('decisionA')
    expect(names).not.toContain('decisionB')
    expect(names).not.toContain('artifactA')
  })

  test('an artifact change names its artifact; one that names none alters every artifact', async () => {
    const { hits } = await bound()
    const one = hits({ kind: 'artifact', ref: 'issue_12', detail: { artifact: 'art_b' } })
    expect(one).toEqual(expect.arrayContaining(['artifactB', 'needs', 'issue12']))
    expect(one).not.toContain('artifactA')
    expect(hits({ kind: 'artifact', ref: null })).toEqual(
      expect.arrayContaining(['artifactA', 'artifactB']),
    )
  })

  test('an Errand alters the Errands and needs', async () => {
    const { hits } = await bound()
    expect(hits({ kind: 'errand', ref: null, detail: { errand: 'e1' } })).toEqual(
      expect.arrayContaining(['errands', 'needs', 'issue12', 'issue13']),
    )
  })

  test('a frame of an unknown kind alters every pushed query', async () => {
    const { hits } = await bound()
    expect(hits({ kind: 'banana', ref: null }).sort()).toEqual([...NAMES].sort())
  })

  test('a query that is not pushed is never invalidated, whatever the frame', async () => {
    const w = await world({ ...KEYS, since: ['since'] }, { only: ['since'], class: 'standard' })
    const clock = fakeScheduler()
    const channel = fakeChannel<Change | null>()
    for (const [name, queryKey] of Object.entries(KEYS)) {
      await w.client.fetchQuery(
        liveQuery(queryOptions({ queryKey, queryFn: () => name }), {
          class: 'pushed',
          fallback: 1,
          safety: 2,
        }),
      )
    }
    stops.push(
      bindInvalidation<Change | null, Root>(w.client, channel, {
        roots: ROOTS,
        map: () => 'all',
        scheduler: clock.scheduler,
      }).start(),
    )
    w.client.setQueryData(['since'], 'since')
    channel.emit({ kind: 'issue', ref: null })
    clock.advance(10_000)
    expect(w.client.getQueryState(['since'])?.isInvalidated).toBe(false)
    expect(w.client.getQueryState(['needs'])?.isInvalidated).toBe(true)
  })

  test('the aggregates are the slow tier', async () => {
    const { clock, channel, invalidated, clean } = await bound()
    clean()
    channel.emit({ kind: 'issue', ref: 'issue_12' })
    clock.advance(250)
    expect(invalidated()).toContain('needs')
    expect(invalidated()).not.toContain('kpis')
    clock.advance(1_750)
    expect(invalidated()).toContain('kpis')
  })

  test('a root name, a list of roots and "none" map as written', async () => {
    const w = await bound({
      map: (c) => (c?.kind === 'a' ? 'needs' : c?.kind === 'b' ? ['flow', 'chain'] : 'none'),
    })
    expect(w.hits({ kind: 'a', ref: null })).toEqual(['needs'])
    expect(w.hits({ kind: 'b', ref: null }).sort()).toEqual(['chain', 'flow'])
    expect(w.hits({ kind: 'c', ref: null })).toEqual([])
  })
})

// ---- ported debounce suite, on the tiers -------------------------------------------------------

describe('debounce: the list tier is 250 ms with a 1 s ceiling', () => {
  const stream = async () => {
    const b = await bound({ aggregates: [] })
    const flushes = spyOn(b.client, 'invalidateQueries')
    flushes.mockClear()
    return { ...b, flushes }
  }

  test('a burst of changes invalidates once, after the last one', async () => {
    const { clock, channel, flushes } = await stream()
    channel.emit({ kind: 'issue', ref: null })
    clock.advance(200)
    channel.emit({ kind: 'issue', ref: null })
    clock.advance(200)
    expect(flushes).toHaveBeenCalledTimes(0)
    clock.advance(50)
    expect(flushes).toHaveBeenCalledTimes(1)
    clock.advance(1_000)
    expect(flushes).toHaveBeenCalledTimes(1)
  })

  test('a later change starts a new run; stopping drops the pending one', async () => {
    const { clock, channel, flushes } = await stream()
    channel.emit({ kind: 'issue', ref: null })
    clock.advance(250)
    channel.emit({ kind: 'issue', ref: null })
    stops.pop()?.()
    clock.advance(1_000)
    expect(flushes).toHaveBeenCalledTimes(1)
  })

  test('L1: a steady stream still refetches every ceiling (1 s) and cannot starve it', async () => {
    const { clock, channel, flushes } = await stream()
    for (let i = 0; i < 9; i++) {
      channel.emit({ kind: 'issue', ref: null })
      clock.advance(100)
    }
    expect(flushes).toHaveBeenCalledTimes(0)
    channel.emit({ kind: 'issue', ref: null })
    clock.advance(100)
    expect(flushes).toHaveBeenCalledTimes(1)
    for (let i = 0; i < 10; i++) {
      channel.emit({ kind: 'issue', ref: null })
      clock.advance(100)
    }
    expect(flushes).toHaveBeenCalledTimes(2)
  })

  test('a burst that pauses runs once, on the trailing edge, and the ceiling does not fire again', async () => {
    const { clock, channel, flushes } = await stream()
    channel.emit({ kind: 'issue', ref: null })
    clock.advance(100)
    channel.emit({ kind: 'issue', ref: null })
    clock.advance(250)
    expect(flushes).toHaveBeenCalledTimes(1)
    clock.advance(5_000)
    expect(flushes).toHaveBeenCalledTimes(1)
  })

  test('the aggregate tier waits 2 s and has a 10 s ceiling', async () => {
    const b = await bound()
    const flushes = spyOn(b.client, 'invalidateQueries')
    flushes.mockClear()
    for (let i = 0; i < 100; i++) {
      b.channel.emit({ kind: 'issue', ref: null })
      b.clock.advance(100)
    }
    // 10 s of a steady stream: ten list flushes and the aggregate ceiling, none starved
    expect(flushes.mock.calls.length).toBeGreaterThanOrEqual(11)
    expect(b.invalidated()).toContain('kpis')
  })
})

// ---- L2: unparseable frames, beats -------------------------------------------------------------

function pipe() {
  const queue: Wire[] = []
  let wake: (() => void) | undefined
  const transport: Transport = async function* ({ signal }) {
    for (;;) {
      while (queue.length === 0) {
        await new Promise<void>((r) => {
          wake = r
          signal.addEventListener('abort', () => r(), { once: true })
        })
        if (signal.aborted) return
      }
      yield queue.shift()!
    }
  }
  return {
    transport,
    push(event: string, data: string, id?: string) {
      queue.push(
        id === undefined ? { kind: 'frame', event, data } : { kind: 'frame', event, data, id },
      )
      wake?.()
    },
  }
}

describe('L2: unparseable frames and beats', () => {
  const schema = {
    '~standard': {
      validate: (v: unknown) => {
        const data = (v as { data?: unknown }).data
        return typeof data === 'object' && data !== null && 'kind' in data
          ? { value: data as Change }
          : { issues: [{ message: 'not a change' }] }
      },
    },
  }

  async function wired() {
    const clock = fakeScheduler()
    const wire = pipe()
    const channel = createChannel<Change>({
      transport: wire.transport,
      greeting: 'hello',
      beats: ['heartbeat'],
      schema,
      scheduler: clock.scheduler,
    })
    const w = await world()
    const map = spyOn({ map: (c: Change): Affects<Root> => affected(c) }, 'map')
    stops.push(
      bindInvalidation<Change, Root>(w.client, channel, {
        roots: ROOTS,
        aggregates: AGGREGATES,
        greeting: 'hello',
        map,
        scheduler: clock.scheduler,
      }).start(),
    )
    wire.push('hello', '{}')
    await settle()
    w.clean()
    return { ...w, clock, wire, map }
  }

  test('an unparseable frame invalidates all pushed queries, never nothing', async () => {
    const { wire, clock, invalidated, map } = await wired()
    wire.push('issue', 'not json')
    await settle()
    clock.advance(10_000)
    expect(invalidated().sort()).toEqual([...NAMES].sort())
    expect(map).not.toHaveBeenCalled()
  })

  test('a beat event never reaches map and invalidates nothing', async () => {
    const { wire, clock, invalidated, map } = await wired()
    wire.push('heartbeat', '{"kind":"issue"}')
    await settle()
    clock.advance(10_000)
    expect(map).not.toHaveBeenCalled()
    expect(invalidated()).toEqual([])
  })

  test('the greeting frame is a connection signal, not a change', async () => {
    const { map } = await wired()
    expect(map).not.toHaveBeenCalled()
  })

  test('a frame map throws on invalidates all pushed queries', async () => {
    const w = await bound({
      map: () => {
        throw new Error('boom')
      },
    })
    const err = spyOn(console, 'error').mockImplementation(() => {})
    expect(w.hits({ kind: 'issue', ref: null }).sort()).toEqual([...NAMES].sort())
    err.mockRestore()
  })
})

// ---- L3: greeting and gaps ---------------------------------------------------------------------

describe('L3: the first greeting joins boot, a later one is a gap', () => {
  test('the first live joins in-flight boot fetches (cancelRefetch false)', async () => {
    const w = await world()
    const channel = fakeChannel<Change | null>()
    const spy = spyOn(w.client, 'invalidateQueries')
    stops.push(
      bindInvalidation<Change | null, Root>(w.client, channel, {
        roots: ROOTS,
        map: () => 'all',
        scheduler: fakeScheduler().scheduler,
      }).start(),
    )
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]?.[1]).toEqual({ cancelRefetch: false })
  })

  test('a second greeting applies onGap, default all', async () => {
    const { channel, clock, invalidated, clean } = await bound()
    clean()
    channel.drop()
    channel.setStatus('live')
    clock.advance(10_000)
    expect(invalidated().sort()).toEqual([...NAMES].sort())
  })

  test('onGap can be a predicate that spares a root', async () => {
    const { channel, clock, invalidated, clean } = await bound({
      onGap: (key) => key[0] !== 'needs',
    })
    clean()
    channel.drop()
    channel.setStatus('live')
    clock.advance(10_000)
    expect(invalidated()).not.toContain('needs')
    expect(invalidated()).toContain('flow')
  })

  test('a 410 or a cursorless reconnect (a reset) applies onGap too', async () => {
    const { channel, clock, invalidated, clean } = await bound({ onGap: 'flow' })
    clean()
    channel.reset('expired')
    clock.advance(10_000)
    expect(invalidated()).toEqual(['flow'])
    clean()
    channel.reset('gap')
    clock.advance(10_000)
    expect(invalidated()).toEqual(['flow'])
  })

  test('a reset and the greeting that follows coalesce into one flush', async () => {
    const b = await bound({ aggregates: [] })
    const spy = spyOn(b.client, 'invalidateQueries')
    spy.mockClear()
    b.channel.drop()
    b.channel.reset('expired')
    b.channel.setStatus('live')
    b.clock.advance(10_000)
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

// ---- lifecycle and dev errors ------------------------------------------------------------------

describe('start, stop and roots', () => {
  test('start() twice leaves one subscription; the returned stop removes it', async () => {
    const w = await world()
    const channel = fakeChannel<Change | null>()
    let subscriptions = 0
    let open = 0
    const subscribe = channel.subscribe.bind(channel)
    channel.subscribe = (on) => {
      subscriptions++
      open++
      const off = subscribe(on)
      return () => {
        open--
        off()
      }
    }
    const live = bindInvalidation<Change | null, Root>(w.client, channel, {
      roots: ROOTS,
      map: () => 'all',
      scheduler: fakeScheduler().scheduler,
    })
    const stop = live.start()
    expect(live.start()).toBe(stop)
    expect(subscriptions).toBe(1)
    expect(open).toBe(1)
    stop()
    expect(open).toBe(0)
    const again = live.start()
    expect(subscriptions).toBe(2)
    again()
  })

  test('nothing is pending after stop', async () => {
    const w = await world()
    const clock = fakeScheduler()
    const channel = fakeChannel<Change | null>()
    const stop = bindInvalidation<Change | null, Root>(w.client, channel, {
      roots: ROOTS,
      aggregates: AGGREGATES,
      map: () => 'all',
      scheduler: clock.scheduler,
    }).start()
    channel.emit({ kind: 'issue', ref: null })
    stop()
    expect(clock.pending()).toBe(0)
  })

  test('one channel per QueryClient', async () => {
    const w = await world()
    const options = {
      roots: ROOTS,
      map: () => 'all' as const,
      scheduler: fakeScheduler().scheduler,
    }
    stops.push(bindInvalidation<Change | null, Root>(w.client, fakeChannel(), options).start())
    expect(() =>
      bindInvalidation<Change | null, Root>(w.client, fakeChannel(), options).start(),
    ).toThrow(/already has a bound channel/)
  })

  test('a pushed query outside roots is a dev error', async () => {
    const w = await world({ stray: ['stray'] })
    const bind = (client: QueryClient) =>
      bindInvalidation<Change | null, Root>(client, fakeChannel(), {
        roots: ROOTS,
        map: () => 'all',
        scheduler: fakeScheduler().scheduler,
      })
    expect(() => bind(w.client).start()).toThrow(/outside `roots`/)

    const late = await world({})
    stops.push(bind(late.client).start())
    const err = spyOn(console, 'error').mockImplementation(() => {})
    await late.client.fetchQuery(
      liveQuery(queryOptions({ queryKey: ['stray'], queryFn: () => 1 }), {
        class: 'pushed',
        fallback: 1,
        safety: 2,
      }),
    )
    expect(err).toHaveBeenCalledTimes(1)
    err.mockRestore()
  })

  test('a live stream moves pushed queries to their safety poll; stop releases it', async () => {
    const w = await world()
    const channel = fakeChannel<Change | null>()
    const stop = bindInvalidation<Change | null, Root>(w.client, channel, {
      roots: ROOTS,
      map: () => 'all',
      scheduler: fakeScheduler().scheduler,
    }).start()
    const live = await import('./live-query-runtime')
    const query = w.client.getQueryCache().find({ queryKey: ['needs'] })!
    expect(live.isStreamLive(query)).toBe(true)
    stop()
    expect(live.isStreamLive(query)).toBe(false)
  })

  test('patch runs for a valid frame before map', async () => {
    const order: string[] = []
    const w = await bound({
      patch: () => void order.push('patch'),
      map: () => {
        order.push('map')
        return 'none'
      },
    })
    w.hits({ kind: 'job', ref: null })
    expect(order).toEqual(['patch', 'map'])
  })
})
