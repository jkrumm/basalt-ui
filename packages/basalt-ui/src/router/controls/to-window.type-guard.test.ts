/**
 * Compile-time proof (state-1.18): `toWindow` never returns `{ window: 'custom' }`, so a consumer
 * indexes a preset table with `window` and handles no `custom` case. The URL codec already reads a
 * custom range without both dates as the fallback; the window now does too.
 */
import { describe, expect, test } from 'bun:test'
import { defineControls } from './define'
import { field } from './field'

const store = defineControls({
  id: 'to-window-guard',
  scope: 'page',
  fields: {
    window: field.range({ presets: ['7d', '30d'], fallback: '30d', custom: true }),
  },
})

const DAYS: Record<'7d' | '30d', number> = { '7d': 7, '30d': 30 }

export const days = (): number => {
  const window = store.field.window.toWindow({ preset: '7d' })
  if ('from' in window) return 0
  return DAYS[window.window]
}

export const customRefused = (): void => {
  const window = store.field.window.toWindow({ preset: '7d' })
  // @ts-expect-error `custom` is a `{ from, to }`, never a `window`
  const bad: { window: 'custom' } = window
  void bad
}

describe('toWindow (type-guard)', () => {
  test('is a compile-time fixture: see the @ts-expect-error directives above', () => {
    expect(store.field.window.toWindow({ preset: '7d' })).toEqual({ window: '7d' })
  })
})
