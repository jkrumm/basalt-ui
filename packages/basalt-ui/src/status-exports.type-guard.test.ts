/**
 * Compile-time and runtime proof that the root barrel exports the status mark: `StatusDot` and
 * `StatusVerdict` with their props types (argo warden/agents status chips). Without the barrel
 * export `tsc --noEmit` fails on the import below, and the runtime assertions fail with it.
 */
import { describe, expect, test } from 'bun:test'
import { StatusDot, StatusVerdict } from './index'
import type { StatusDotProps, StatusVerdictProps } from './index'

describe('root barrel status exports', () => {
  test('StatusDot and StatusVerdict are components', () => {
    expect(typeof StatusDot).toBe('function')
    expect(typeof StatusVerdict).toBe('function')
  })

  test('props types are reachable from the root', () => {
    const dot: StatusDotProps = { color: 'red' }
    const verdict: StatusVerdictProps = { color: 'red', word: 'Over', phrase: 'Over budget' }
    expect([dot.color, verdict.word]).toEqual(['red', 'Over'])
  })
})
