// The compile-time regression guard for `createSearchStore` field inference — the consumer vantage
// of `range-filter.type-guard.test.tsx` (package-side, `createLocalStore`). That file pins the
// call-site half; this pins the same claim through `createSearchStore` (`basalt-ui/router-tanstack`)
// resolving through the package's dist `.d.ts`, the way an app's own store file would.
// theme-allow-file bound-control-outside-home — a compile-time-only fixture, never rendered inside
// a real page; the RangeFilter instances below exist only to pin the field-handle generic, not to
// paint a home.
import type { ReactNode } from 'react'
import { createSearchStore } from 'basalt-ui/router-tanstack'
import { field } from 'basalt-ui/state'
import { RangeFilter } from 'basalt-ui/controls'

const store = createSearchStore({
  key: 'tg-search-store',
  fields: {
    range: field.range({ presets: ['7d', '30d'], fallback: '30d' }),
    view: field.enum(['chart', 'table'], 'chart'),
  },
})

// ── 1. `store.field.x` keys are exactly the declared fields ─────────────────────────────────────

type FieldKey = keyof typeof store.field
export const k1: FieldKey = 'range'
export const k2: FieldKey = 'view'
// @ts-expect-error 'nope' was never declared as a field
export const k3: FieldKey = 'nope'

// ── 2. RangeFilter accepts the range handle, rejects the enum handle, with no cast ──────────────

export function Filters(): ReactNode {
  return (
    <>
      <RangeFilter field={store.field.range} />
      {/* @ts-expect-error an enum handle is not a range handle, whatever RangeFilter's C is */}
      <RangeFilter field={store.field.view} />
    </>
  )
}

// PROVES: `store.field` is keyed off exactly the declared field names, and RangeFilter's generic
// binding rejects a wrong-kind handle at the createSearchStore vantage — not just createLocalStore.
