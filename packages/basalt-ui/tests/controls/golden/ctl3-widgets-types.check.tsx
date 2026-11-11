/**
 * Type-level proof for widget scope, compiled by the package `tsc` and never run. Each
 * `@ts-expect-error` must error (an unused one is TS2578); unmarked lines must compile.
 */
import { defineControls } from '../../../src/router/controls/define'
import { field } from '../../../src/router/controls/field'
import type { WidgetHandle } from '../../../src/router/controls/widgets'

const globals = defineControls({
  id: 'ctl3-types-globals',
  scope: 'global',
  fields: {
    range: field.enum(['1h', '24h', '7d'], '24h'),
    regions: field.multi(['eu', 'us'], []),
    window: field.range({ presets: ['24h', '7d'], fallback: '24h' }),
    n: field.number({ fallback: 1 }),
  },
})

const ok = defineControls({
  id: 'ctl3-types-ok',
  scope: 'page',
  fields: {},
  widgets: {
    latency: { range: globals.field.range, n: globals.field.n },
    errors: { range: globals.field.range },
  },
})

// The widget handle is typed by the bound field, and its link writes the `w.` key.
const handle: WidgetHandle<'1h' | '24h' | '7d', 'enum'> = ok.widget.latency.range
ok.widget.latency.range.link('7d')
// @ts-expect-error 'bogus' is not a member of the range enum
ok.widget.latency.range.link('bogus')
// @ts-expect-error a widget that was not declared has no handle
void ok.widget.nope
// @ts-expect-error a field that was not declared has no handle
void ok.widget.errors.n

// The validated search carries the optional override keys, typed.
type Input = (typeof ok.validateSearch)['~standard']['types']['input']
const input: Input = { 'w.latency.range': '7d' }
// @ts-expect-error an override key takes the bound field's members
const badInput: Input = { 'w.latency.range': 'bogus' }
// @ts-expect-error an undeclared widget key is rejected
const unknownInput: Input = { 'w.nope.range': '7d' }
void [handle, input, badInput, unknownInput]

// A global handle is not a widget handle.
const takesWidget = (handle: WidgetHandle<'1h' | '24h' | '7d', 'enum'>): string => handle.key
takesWidget(ok.widget.latency.range)
// @ts-expect-error a global handle cannot stand in for a widget handle
takesWidget(globals.field.range)

// A multi or range field cannot be a widget field.
defineControls({
  id: 'ctl3-types-multi',
  scope: 'page',
  fields: {},
  // @ts-expect-error multi is not a scalar kind
  widgets: { w: { regions: globals.field.regions } },
})
defineControls({
  id: 'ctl3-types-range',
  scope: 'page',
  fields: {},
  // @ts-expect-error range is not a scalar kind
  widgets: { w: { window: globals.field.window } },
})

// At most two fields per widget.
defineControls({
  id: 'ctl3-types-three',
  scope: 'page',
  fields: {},
  // @ts-expect-error a widget with three fields
  widgets: { w: { a: globals.field.range, b: globals.field.n, c: globals.field.range } },
})
defineControls({
  id: 'ctl3-types-two',
  scope: 'page',
  fields: {},
  widgets: { w: { a: globals.field.range, b: globals.field.n } },
})

// `useOverrides` reports keys and widgets.
const overrides = ok.useOverrides()
const keys: readonly string[] = overrides.keys
const widgets: readonly string[] = overrides.widgets
overrides.clearAll()
void [keys, widgets]
