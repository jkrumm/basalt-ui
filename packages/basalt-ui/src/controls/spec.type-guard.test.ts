/**
 * Compile-time proof (checked by `tsc --noEmit`) that a card slot takes widget specs only: a spec
 * built from a global or page field fails to type-check where a widget spec is wanted. The valid
 * lines above each `@ts-expect-error` prove it fails for that reason and not everywhere.
 */
import { expect, test } from 'bun:test'
import type { StatCardProps } from '../cards/contract'
import type { ChartCardProps } from '../charts/contract'
import { defineControls, field } from '../router'
import type { FilterSpec } from './contract'
import { filterSlot } from './filter-slot'
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

// The scope survives `filterSlot`: the product of widget specs fits a card, the others do not.
const inStat = (controls: StatCardProps['controls']) => controls
const inChart = (controls: ChartCardProps['controls']) => controls

export const widgetInStat = inStat(filterSlot([widgetSpec]))
export const widgetInChart = inChart(filterSlot([widgetSpec]))
export const customInStat = inStat(filterSlot.custom(globals.field.range, 'Range', () => null))
// @ts-expect-error a global spec in a filterSlot does not fit a StatCard
export const globalInStat = inStat(filterSlot([globalSpec]))
// @ts-expect-error a page spec in a filterSlot does not fit a StatCard
export const pageInStat = inStat(filterSlot([pageSpec]))
// @ts-expect-error a mixed filterSlot does not fit a StatCard
export const mixedInStat = inStat(filterSlot([widgetSpec, globalSpec]))
// @ts-expect-error a global spec in a filterSlot does not fit a ChartCard
export const globalInChart = inChart(filterSlot([globalSpec]))

test('a card slot takes widget specs only', () => {
  expect(widgetSpec.scope).toBe('widget')
  expect(globalSpec.scope).not.toBe('widget')
})

// Every field kind `defineControls` makes: `spec` takes its handle with no cast.
const kinds = defineControls({
  id: 'kinds',
  scope: 'page',
  fields: {
    mode: field.enum(['flat', 'grouped'], 'flat'),
    tags: field.multi(['a', 'b'], []),
    text: field.string(''),
    limit: field.number({ fallback: 10, min: 0, int: true }),
    live: field.boolean(false),
    window: field.range({ presets: ['7d', '30d'], fallback: '7d', custom: true }),
  },
})

export const everyKind = [
  spec(kinds.field.mode, 'Tab'),
  spec(kinds.field.tags, 'Tags'),
  spec(kinds.field.text, 'Search'),
  spec(kinds.field.limit, 'Limit'),
  spec(kinds.field.live, 'Live'),
  spec(kinds.field.window, 'Window'),
]

export const withOptions = [
  spec(kinds.field.tags, 'Tags', { options: [{ value: 'a', label: 'A' }], clearable: true }),
  spec(kinds.field.window, 'Window', { options: [{ value: '7d', label: '7 days' }] }),
]

// @ts-expect-error a multi's options are its members, and 'nope' is not one
spec(kinds.field.tags, 'Tags', { options: [{ value: 'nope', label: 'Nope' }] })
// @ts-expect-error a range's options are its presets, and 'nope' is not one
spec(kinds.field.window, 'Window', { options: [{ value: 'nope', label: 'Nope' }] })
// @ts-expect-error an array is not a member of a multi
spec(kinds.field.tags, 'Tags', { options: [{ value: ['a'], label: 'A' }] })

test('every field kind makes a spec', () => {
  expect(everyKind.map((s) => s.handle.kind)).toEqual([
    'enum',
    'multi',
    'string',
    'number',
    'boolean',
    'range',
  ])
  expect(everyKind.every((s) => s.scope === 'page')).toBe(true)
})
