/**
 * `SelectFilter` — one choice, one pill (`docs/CONTROLS-SPEC.md` §3). Takes `field`, never
 * `value`/`onChange`/`size` (C2/C5): the handle owns the URL write, the localStorage mirror and the
 * option labels (`store.labels()`), so the call site is the field plus its human name.
 *
 * `options` is the escape hatch for a catalogue that only exists at runtime — the label carries live
 * data (`EUR · 1.08`), or the id set is fetched rather than declared. It OVERRIDES `field.options`
 * at render, and it is what makes the second `field` shape legal: a `StringField` handle plus
 * `options` covers an id set no enum could close over (a project picker, a device list), while a
 * `StringField` handle WITHOUT `options` stays a type error — nothing would supply the rows, so the
 * filter would render an empty popover.
 *
 * @example
 * <SelectFilter field={analytics.field.currency} label="Currency" clearable />
 *
 * @example
 * // A runtime catalogue over a closed enum — same field, live labels.
 * <SelectFilter
 *   field={analytics.field.currency}
 *   label="Currency"
 *   options={rates.map((r) => ({ value: r.code, label: `${r.code} · ${r.rate}` }))}
 * />
 *
 * @example
 * // An id set the enum cannot close over — a string field, options mandatory.
 * <SelectFilter
 *   field={dashboard.field.projectId}
 *   label="Project"
 *   options={projects.map((p) => ({ value: p.id, label: p.name, disabled: p.archived }))}
 * />
 */
import type { ReactNode } from 'react'
import type { BasaltProps } from '../common/props'
import { assertRequiredProps } from '../common/validate'
import type { EnumField, FieldHandle, StringField } from '../state'
import { EnumFilter } from './enum-filter'

/**
 * One row of a runtime catalogue. Wider than the store's own `FieldOption` by exactly one member:
 * `disabled` renders the row and refuses the selection, which a declared enum expresses by leaving
 * the value out and a live catalogue cannot (an archived project still labels the rows already
 * pointing at it).
 */
export type FilterOption = {
  readonly value: string
  readonly label: string
  readonly disabled?: boolean
}

type SelectFilterCommon = BasaltProps & {
  readonly label: string
  readonly icon?: ReactNode
  /** Adds a `Clear` action that writes the field back to its fallback. */
  readonly clearable?: boolean
}

/** A closed enum field: `options` relabels rows the field already declares, so it is optional. */
export type SelectFilterEnumProps<T extends string> = SelectFilterCommon & {
  readonly field: FieldHandle<EnumField<T>>
  /** Overrides `field.options` at render — a runtime catalogue, labels included. */
  readonly options?: readonly FilterOption[]
}

/** A string field: it declares no values, so `options` is the only row source and is required. */
export type SelectFilterStringProps = SelectFilterCommon & {
  readonly field: FieldHandle<StringField>
  /** Required here — see this type's doc. */
  readonly options: readonly FilterOption[]
}

export type SelectFilterProps<T extends string> = SelectFilterEnumProps<T> | SelectFilterStringProps

/**
 * TWO OVERLOADS, not one conditional prop type, and the reason is the error text. A union prop type
 * reports only the constituent it likes best — for a `StringField` handle passed without `options`
 * that is the enum branch, so the message reads `Type '"string"' is not assignable to type '"enum"'`
 * and never mentions the prop that would fix it. The overload form reports both halves, ending in
 * `Property 'options' is missing`, which is the actual instruction.
 */
export function SelectFilter<T extends string>(props: SelectFilterEnumProps<T>): ReactNode
export function SelectFilter(props: SelectFilterStringProps): ReactNode
export function SelectFilter<T extends string>(props: SelectFilterProps<T>): ReactNode {
  // F-ERR-1: without this, a `field` that never arrived surfaces as
  // `undefined is not an object (evaluating 'field.use')` from inside `EnumFilter`, caught by
  // `BasaltErrorBoundary` and rendered as a blank subtree. `field` is not optional in the type, so
  // this only ever fires on untyped JS, a `props` object built at runtime, or a store key that
  // resolved to nothing — all three of which the message now names.
  assertRequiredProps('SelectFilter', props, ['field'], {
    field: 'bind it to a store field (`store.field.<name>`), never a value/onChange pair.',
  })
  const { field, ...rest } = props

  // Two arms, one body — and they are not the same code to the compiler. `field.kind` is a NESTED
  // discriminant, which narrows `field` but never `props`, so each arm is what fixes the shared
  // body's value type: `string` for the string field, `T` for the enum. Written out rather than
  // cast, so widening either branch fails here instead of at a consumer's call site.
  if (field.kind === 'string') return <EnumFilter {...rest} field={field} />
  return <EnumFilter {...rest} field={field} />
}
