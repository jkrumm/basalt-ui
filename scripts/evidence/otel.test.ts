import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chatTurns, relative } from './chat-turn-trace'
import { assertSpansObserved, summarise } from './otel'
import { decodeOtlp } from './otel-receiver'
import { median } from './perf-util'

test('median handles odd, even and empty', () => {
  expect(median([3, 1, 2])).toBe(2)
  expect(median([1, 2, 3, 4])).toBe(2.5)
  expect(median([])).toBeNaN()
})

test('assertSpansObserved throws on zero spans only', () => {
  expect(() => assertSpansObserved(0)).toThrow('VITE_TELEMETRY=1')
  expect(() => assertSpansObserved(1)).not.toThrow()
})

test('receiver answers 400 to a malformed body and keeps serving', async () => {
  // The root bunfig preloads happy-dom, which replaces `Request`/`fetch` — run outside the repo.
  const entry = join(import.meta.dirname, 'otel-receiver.ts')
  const script = `
    import { startOtelReceiver } from ${JSON.stringify(entry)}
    const r = startOtelReceiver()
    const bad = { resourceSpans: [{ scopeSpans: [{ spans: [{ name: 'x' }] }] }] }
    const post = async (body) =>
      (await fetch(r.url + '/v1/traces', { method: 'POST', body })).status
    console.log(JSON.stringify([
      await post('not json'),
      await post(JSON.stringify(bad)),
      await post('{}'),
      r.spans().length,
    ]))
    r.stop()`
  const dir = mkdtempSync(join(tmpdir(), 'otel-test-'))
  try {
    const proc = Bun.spawn(['bun', '-e', script], { cwd: dir, stdout: 'pipe' })
    expect(JSON.parse(await new Response(proc.stdout).text())).toEqual([400, 400, 200, 0])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

const span = (name: string, failed = false, duration = 1) => ({
  name,
  start: 0,
  duration,
  failed,
  attributes: {},
})

test('summarise counts per type, sorted, and counts failed spans', () => {
  const s = summarise([
    span('route.navigate', false, 5),
    span('window.error', true),
    span('route.navigate'),
  ])
  expect(Object.keys(s.counts)).toEqual(['route.navigate', 'window.error'])
  expect(s.counts['route.navigate']).toBe(2)
  expect(s.navigateDurations).toEqual([5, 1])
  expect(s.errors).toBe(1)
})

test('decodeOtlp flattens an OTLP/HTTP JSON export', () => {
  const spans = decodeOtlp({
    resourceSpans: [
      {
        scopeSpans: [
          {
            spans: [
              {
                name: 'route.navigate',
                startTimeUnixNano: '1000000000',
                endTimeUnixNano: '1012500000',
                status: { code: 2 },
                attributes: [{ key: 'url.path', value: { stringValue: '/x' } }],
              },
            ],
          },
        ],
      },
    ],
  })
  expect(spans).toEqual([
    {
      name: 'route.navigate',
      start: 1000,
      duration: 12.5,
      failed: true,
      attributes: { 'url.path': '/x' },
    },
  ])
})

test('chatTurns splits chat.turn spans by outcome; relative drops the absolute clock', () => {
  const spans = [
    { ...span('route.navigate'), start: 1000 },
    { ...span('chat.turn'), start: 1500 },
    { ...span('chat.turn', true), start: 1600 },
  ]
  const turns = chatTurns(spans)
  expect(turns.ok).toHaveLength(1)
  expect(turns.failed).toHaveLength(1)
  expect(relative(spans).map((s) => s.startMs)).toEqual([0, 500, 600])
})
