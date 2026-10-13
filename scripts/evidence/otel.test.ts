import { expect, test } from 'bun:test'
import { median, summarise } from './otel'
import { decodeOtlp } from './otel-receiver'

test('median handles odd, even and empty', () => {
  expect(median([3, 1, 2])).toBe(2)
  expect(median([1, 2, 3, 4])).toBe(2.5)
  expect(median([])).toBe(0)
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
