/**
 * Compile-time proof (checked by `tsc --noEmit`) that a home takes a known home name and no
 * `variant`, that a slot refuses a spec list of the wrong shape, and that `filterSlot.custom` hands
 * `render` the handle's own value type. The valid lines prove each `@ts-expect-error` fails for that
 * reason and not everywhere.
 */
import { expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { ControlHome } from './control-home'
import { memoryHandle } from './control-view.handles'
import { filterSlot } from './filter-slot'
import { spec } from './spec'

const text = memoryHandle('tg.q', 'x', { kind: 'string' })

export const ok: ReactElement = <ControlHome home="aside">{null}</ControlHome>

// @ts-expect-error a home name outside the ten is not a home
export const unknownHome: ReactElement = <ControlHome home="sidebar">{null}</ControlHome>
// @ts-expect-error a home has no variant prop: the home decides the presentation
export const variant: ReactElement = <ControlHome home="aside" variant="pill" />
// @ts-expect-error the home is required
export const noHome: ReactElement = <ControlHome>{null}</ControlHome>

export const slot = filterSlot([spec(text, 'Search')])
// @ts-expect-error a slot takes specs, not bare handles
export const bare = filterSlot([text])

export const custom = filterSlot.custom(text, 'Search', ({ value }) => value.toUpperCase())
// @ts-expect-error the value is the handle's `string`, not a number
export const wrongValue = filterSlot.custom(text, 'Search', ({ value }) => value.toFixed(0))

test('the guards compile', () => {
  expect(slot.count).toBe(1)
  expect(custom.count).toBe(1)
})
