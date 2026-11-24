/**
 * Compile-time guard of `CartesianChart.custom`: `build` returns the engine's marks, so a value that
 * is no mark does not compile. tsc is the test; the runtime body only keeps bun from skipping.
 */
import { describe, expect, test } from 'bun:test'
import { text } from '@tanstack/charts/text'
import type { CustomMarks } from './contract'

type Row = { at: number; v: number }

export const ok: CustomMarks<Row>['build'] = (plot) => [
  text(plot.rows('v'), { x: (r) => r.at, y: (r) => r.v, text: (r) => String(r.v) }),
]

// @ts-expect-error a plain object is no engine mark
export const notAMark: CustomMarks<Row>['build'] = () => [{ kind: 'line', points: [] }]

// @ts-expect-error a string is no engine mark
export const aString: CustomMarks<Row>['build'] = () => ['line']

describe('custom marks type guard', () => {
  test('compiles only engine marks', () => {
    expect(typeof ok).toBe('function')
  })
})
