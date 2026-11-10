/**
 * Type-level proof for S1. This file is compiled by `tsc --noEmit -p .` and never imported at
 * runtime. Each `@ts-expect-error` must error; if one stops erroring tsc reports TS2578 and the
 * acceptance command fails. The unmarked lines must compile.
 */
import { Link } from '@tanstack/react-router'
import type { SearchMiddleware } from '@tanstack/react-router'
import { BRAND, brandOf } from './controls'
import type { Branded, ControlsValidator } from './controls'
import { fin, garmin, gym, globals } from './stores'
import './router'

// ------------------------------------------------------------------ branded validator

type FinValidator = typeof fin.validateSearch
const asBranded = (v: Branded<'finance'>): Branded<'finance'> => v

asBranded(fin.validateSearch)
// extend() keeps the brand (and the id literal)
asBranded(fin.extend({ '~standard': { version: 1, vendor: 'x', validate: (v) => ({ value: v }) } }))

// A hand wrapper over the store's validator is a function: it has no brand.
const wrapped = (raw: Record<string, unknown>) =>
  fin.validateSearch['~standard'].validate(raw).value
// @ts-expect-error a hand wrapper loses the brand
asBranded(wrapped)

// A different store's validator is not this store's brand.
// @ts-expect-error brand id is the literal "garmin", not "finance"
asBranded(garmin.validateSearch)

// The brand is a typed symbol property, not a string key anyone can forge by accident.
// @ts-expect-error a plain object with a string "brand" key is not branded
asBranded({ brand: { id: 'finance', scope: 'page' } })

const scope: 'page' = fin.validateSearch[BRAND].scope
const globalScope: 'global' = globals.validateSearch[BRAND].scope
// @ts-expect-error a page store's scope is not "global"
const notGlobal: 'global' = fin.validateSearch[BRAND].scope
void [scope, globalScope, notGlobal, brandOf]

// ------------------------------------------------------------------ types.input (typed Link)

type FinInput = FinValidator['~standard']['types']['input']
const partial: FinInput = {} // every key optional: a Link needs none
void partial

export function Links() {
  return (
    <>
      <Link to="/finance/spending" />
      <Link to="/finance/spending" search={{ month: '2025-01', sort: 'amount', page: 2 }} />
      <Link to="/finance/tax" search={{ uncategorized: true }} />
      <Link to="/garmin-health" search={{ tab: 'sleep', item: 'abc' }} />
      <Link to="/gym" search={{ exercises: ['squat'], done: false }} />
      <Link to="/" search={{ range: '7d', regions: ['eu'] }} />
      <Link to="/gym" {...gym.field.exercises.link(['squat', 'row'])} />
      {/* @ts-expect-error types.input rejects an undeclared key */}
      <Link to="/finance/spending" search={{ nope: 1 }} />
      {/* @ts-expect-error a child inheriting the layout validator rejects an undeclared key too */}
      <Link to="/finance/" search={{ nope: 1 }} />
      {/* @ts-expect-error month is an enum of ISO months */}
      <Link to="/finance/spending" search={{ month: '2099-01' }} />
      {/* @ts-expect-error page is a number */}
      <Link to="/finance/spending" search={{ page: 'two' }} />
      {/* @ts-expect-error uncategorized is a boolean */}
      <Link to="/finance/tax" search={{ uncategorized: 'yes' }} />
      {/* @ts-expect-error exercises is a multi of the declared members */}
      <Link to="/gym" search={{ exercises: ['unknown'] }} />
      {/* @ts-expect-error a finance key does not exist on /gym */}
      <Link to="/gym" search={{ month: '2025-01' }} />
    </>
  )
}

// field.link(v) is typed by the field's value
// @ts-expect-error 'bogus' is not a member of the sort enum
fin.field.sort.link('bogus')
// @ts-expect-error a boolean field takes a boolean
globals.field.compact.link('true')
fin.field.sort.link('amount')

// range handle: toWindow is typed and only on a range
const window = garmin.field.window.toWindow({ preset: '7d', from: '', to: '' })
void window
// @ts-expect-error an unknown preset is not a RangeValue
garmin.field.window.toWindow({ preset: '1y', from: '', to: '' })
// @ts-expect-error toWindow exists only on a range handle
void fin.field.month.toWindow

// ------------------------------------------------------------------ definition-time shape

// @ts-expect-error a ControlsValidator cannot be built without a brand
const forged: ControlsValidator<'x', 'page', object, object> = {
  '~standard': {
    version: 1,
    vendor: 'basalt',
    validate: (v) => ({ value: v as object }),
    types: { input: {}, output: {} },
  },
}
void forged

// ------------------------------------------------------------------ search.middlewares typing

// A route's middleware array is typed by its FULL search (own validator plus every parent's).
type FullSearch = { month: string; range: string }
const mountable: SearchMiddleware<FullSearch>[] = fin.middlewares
declare const typedByOwnSearch: SearchMiddleware<{ month: string }>[]
// @ts-expect-error a middleware typed by the store's own search is not assignable under a parent
const notMountable: SearchMiddleware<FullSearch>[] = typedByOwnSearch
void [mountable, notMountable]
