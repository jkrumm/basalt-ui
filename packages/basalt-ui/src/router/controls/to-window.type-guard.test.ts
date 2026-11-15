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

const resolved = defineControls({
  id: 'to-window-resolved',
  scope: 'page',
  fields: {
    opened: field.range({
      presets: ['7d', '30d'],
      fallback: '30d',
      custom: true,
      window: {
        '7d': () => ({ from: '2026-11-08', to: '2026-11-15' }),
        '30d': () => ({ from: '2026-10-16', to: '2026-11-15' }),
      },
    }),
    tags: field.multi(['a', 'b'], []),
  },
})

/** With every preset resolved there is no `{ window }` member: the dates are read without a guard. */
export const resolvedDates = (): string => {
  const window = resolved.field.opened.toWindow({ preset: '7d' })
  return `${window.from}/${window.to}`
}

/** `useValues()` hands a range back as its `RangeValue` and a multi as its array (state-2.2). */
export const valuesFeedToWindow = (): string => {
  const values = resolved.useValues()
  const tags: readonly ('a' | 'b')[] = values.tags
  const window = resolved.field.opened.toWindow(values.opened)
  return `${window.from}${tags.length}`
}

describe('toWindow (type-guard)', () => {
  test('is a compile-time fixture: see the @ts-expect-error directives above', () => {
    expect(store.field.window.toWindow({ preset: '7d' })).toEqual({ window: '7d' })
  })
})
