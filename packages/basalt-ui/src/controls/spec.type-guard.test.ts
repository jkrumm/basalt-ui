/**
 * Compile-time proof (checked by `tsc --noEmit`) that a card slot takes widget specs only: a spec
 * built from a global or page field fails to type-check where a widget spec is wanted. The valid
 * lines above each `@ts-expect-error` prove it fails for that reason and not everywhere.
 */
import { expect, test } from 'bun:test'
import { defineControls, field } from '../router'
import type { FilterSpec } from './contract'
import { spec } from './spec'

const globals = defineControls({
  id: 'globals',
  scope: 'global',
  fields: { range: field.enum(['24h', '7d'], '24h'), q: field.string('') },
})

const overview = defineControls({
  id: 'overview',
  scope: 'page',
  fields: { tab: field.enum(['all', 'errors'], 'all') },
  widgets: { latency: { range: globals.field.range } },
})

// oxlint-disable-next-line typescript/no-explicit-any -- the concept's `FilterSpec<any>[]`: handles of different `T` share a list
type CardSlot = readonly FilterSpec<any, 'widget'>[]
// oxlint-disable-next-line typescript/no-explicit-any -- as above
type PageSlot = readonly FilterSpec<any, 'global' | 'page'>[]

const widgetSpec = spec(overview.widget.latency.range, 'Range')
const globalSpec = spec(globals.field.range, 'Range')
const pageSpec = spec(overview.field.tab, 'Tab', { as: 'segmented' })

export const card: CardSlot = [widgetSpec]
export const page: PageSlot = [globalSpec, pageSpec]

// @ts-expect-error a global spec does not fit a card slot
export const globalInCard: CardSlot = [globalSpec]
// @ts-expect-error a page spec does not fit a card slot
export const pageInCard: CardSlot = [pageSpec]
// @ts-expect-error a widget spec is not a page-level spec
export const widgetInPage: PageSlot = [widgetSpec]

test('a card slot takes widget specs only', () => {
  expect(widgetSpec.scope).toBe('widget')
  expect(globalSpec.scope).not.toBe('widget')
})
