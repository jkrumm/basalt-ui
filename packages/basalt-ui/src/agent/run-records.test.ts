import { describe, expect, test } from 'bun:test'
import { beginRun, endRun, failedThreadIds, isLive, planStop, sweepFlushed } from './run-records'
import type { RunRecords } from './run-records'
import type { ThreadRunState } from './use-agent-thread-runs'

type Part = { id: string; type: string }
const part: Part = { id: 'p', type: 'text' }
const live = (parts: Part[] = [part]): ThreadRunState<Part> => ({ status: 'streaming', parts })
const failed: ThreadRunState<Part> = {
  status: 'error',
  parts: [],
  error: { kind: 'server', message: 'x' },
}

describe('run records', () => {
  test('a record is live until ended; endRun drops its content', () => {
    const records: RunRecords<Part> = new Map()
    const controller = new AbortController()
    const record = beginRun(records, 't', controller)
    record.parts = [part]
    expect(isLive(records, 't', controller)).toBe(true)
    endRun(record, 'settled')
    expect(isLive(records, 't', controller)).toBe(false)
    expect(record.parts).toEqual([])
  })

  test('a newer run replaces the record, so the older controller is no longer live', () => {
    const records: RunRecords<Part> = new Map()
    const first = new AbortController()
    beginRun(records, 't', first)
    beginRun(records, 't', new AbortController())
    expect(isLive(records, 't', first)).toBe(false)
  })
})

describe('planStop', () => {
  test('a live record is stopped with its own parts, not the rendered entry', () => {
    const records: RunRecords<Part> = new Map()
    const record = beginRun(records, 't', new AbortController())
    record.parts = [part, { id: 'q', type: 'text' }]
    const plan = planStop(records, 't', live([part]))
    expect(plan).toMatchObject({ kind: 'stop' })
    expect(plan.kind === 'stop' && plan.parts).toHaveLength(2)
  })

  test('an ended record: settled and stopped are no-ops, failed only dismisses', () => {
    const records: RunRecords<Part> = new Map()
    for (const [end, kind] of [
      ['settled', 'noop'],
      ['stopped', 'noop'],
      ['failed', 'dismiss'],
    ] as const) {
      endRun(beginRun(records, 't', new AbortController()), end)
      expect(planStop(records, 't', live()).kind).toBe(kind)
    }
  })

  test('no record and no entry is a no-op; a failed entry is dismissed', () => {
    const records: RunRecords<Part> = new Map()
    expect(planStop(records, 't', undefined).kind).toBe('noop')
    expect(planStop(records, 't', failed).kind).toBe('dismiss')
  })

  test('a phantom live entry is settled once: the second stop in the same tick is a no-op', () => {
    const records: RunRecords<Part> = new Map()
    const entry = live([part])
    const first = planStop(records, 't', entry)
    expect(first.kind === 'stop' && first.parts).toEqual([part])
    expect(planStop(records, 't', entry).kind).toBe('noop')
  })
})

describe('failedThreadIds / sweepFlushed', () => {
  test('failedThreadIds unions failed records with failed rendered entries', () => {
    const records: RunRecords<Part> = new Map()
    endRun(beginRun(records, 'a', new AbortController()), 'failed')
    endRun(beginRun(records, 'b', new AbortController()), 'settled')
    beginRun(records, 'c', new AbortController())
    const runs = new Map<string, ThreadRunState<Part>>([
      ['d', failed],
      ['e', live()],
    ])
    expect(failedThreadIds(records, runs).toSorted()).toEqual(['a', 'd'])
  })

  test('sweepFlushed drops terminal records once a render shows their outcome, never live ones', () => {
    const records: RunRecords<Part> = new Map()
    beginRun(records, 'live', new AbortController())
    endRun(beginRun(records, 'settled', new AbortController()), 'settled')
    endRun(beginRun(records, 'stopped', new AbortController()), 'stopped')
    endRun(beginRun(records, 'failed', new AbortController()), 'failed')

    // The settled entry is still rendered, the failure is not yet: nothing terminal is flushed.
    sweepFlushed(
      records,
      new Map([
        ['settled', live()],
        ['stopped', live()],
      ]),
    )
    expect([...records.keys()].toSorted()).toEqual(['failed', 'live', 'settled', 'stopped'])

    sweepFlushed(records, new Map([['failed', failed]]))
    expect([...records.keys()]).toEqual(['live'])
  })
})
