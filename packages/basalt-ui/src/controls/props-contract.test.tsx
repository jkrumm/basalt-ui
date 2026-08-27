/**
 * C2 and C5 as COMPILER assertions. The claim "a basalt filter has no `value`/`onChange`/`size`" is
 * only worth making if writing one fails the build, so each `@ts-expect-error` below is the actual
 * enforcement: `bunx tsc --noEmit` fails if any of them stops being an error, which is what happens
 * the moment someone widens a prop type back open.
 *
 * `tsc` covers `src/**` including test files, so this file is checked by the ordinary typecheck —
 * there is nothing extra to run and nothing to remember.
 */
import { describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { createLocalStore, field } from '../state'
import { CompareFilter } from './compare-filter'
import { MultiSelectFilter } from './multi-select-filter'
import { RangeFilter } from './range-filter'
import { SearchFilter } from './search-filter'
import { SelectFilter } from './select-filter'
import { ToggleFilter } from './toggle-filter'
import { ViewTabs } from './view-tabs'

const local = createLocalStore({
  key: 'props-contract',
  fields: {
    currency: field.enum(['USD', 'EUR'], 'USD'),
    compare: field.enum(['none', 'previous', 'year'] as const, 'none'),
    channels: field.multi(['web', 'email'], []),
    range: field.range({ presets: ['7d', '30d'], fallback: '30d', custom: true }),
    errorsOnly: field.boolean(false),
    q: field.string(),
  },
})

/** A runtime catalogue — the shape both `options` props take (`FilterOption[]`). */
const PROJECTS = [
  { value: 'argo', label: 'Argo' },
  { value: 'linewatch', label: 'Linewatch', disabled: true },
]
const CHANNELS = [{ value: 'web', label: 'web · 1.2k' }]

/** Never rendered — the file's product is the type errors below, not a DOM assertion. */
function Rejected(): ReactNode {
  return (
    <>
      {/* @ts-expect-error C2 — a filter has no `value`; the field owns it. */}
      <SelectFilter field={local.field.currency} label="Currency" value="EUR" />
      {/* @ts-expect-error C2 — nor an `onChange`; the write goes through the field. */}
      <SelectFilter field={local.field.currency} label="Currency" onChange={() => {}} />
      {/* @ts-expect-error C5 — the home sets the tier; a control carries no `size`. */}
      <SelectFilter field={local.field.currency} label="Currency" size="xs" />
      {/* @ts-expect-error C5 — nor a responsive override; the swap is the control's own. */}
      <ViewTabs field={local.field.currency} visibleFrom="sm" />
      {/* @ts-expect-error C2 — a tab is store state too. */}
      <ViewTabs field={local.field.currency} value="USD" />
      {/* @ts-expect-error a boolean field is not an enum field. */}
      <ToggleFilter field={local.field.currency} label="Errors only" />
      {/* @ts-expect-error a multi field is not an enum field. */}
      <SelectFilter field={local.field.channels} label="Channels" />
      {/* @ts-expect-error an enum field is not a range field. */}
      <RangeFilter field={local.field.currency} />
      {/* @ts-expect-error a string field is not a boolean field. */}
      <ToggleFilter field={local.field.q} label="Errors only" />
      {/* @ts-expect-error CompareFilter's enum is the three basalt names, not any enum. */}
      <CompareFilter field={local.field.currency} />
      {/* @ts-expect-error `label` is required on SelectFilter — the pill needs a name at rest. */}
      <SelectFilter field={local.field.currency} />
      {/* A string field declares no values, so `options` is the only possible row source — without
          it the popover would render empty. Two overloads rather than one union prop type precisely
          so the message names `options`; see `SelectFilter`'s own doc. */}
      {/* @ts-expect-error a string field needs `options` — nothing else can supply the rows. */}
      <SelectFilter field={local.field.q} label="Project" />
      {/* @ts-expect-error `options` does not widen a MULTI field into a single-select either. */}
      <SelectFilter field={local.field.channels} label="Channels" options={PROJECTS} />
    </>
  )
}

/** The same call sites, spelled correctly — so a type error above cannot be a false positive. */
function Accepted(): ReactNode {
  return (
    <>
      <SelectFilter field={local.field.currency} label="Currency" clearable />
      {/* A runtime catalogue over a closed enum — `options` is optional there. */}
      <SelectFilter
        field={local.field.currency}
        label="Currency"
        options={[{ value: 'USD', label: 'USD · 1.00' }]}
      />
      {/* A string field WITH options — the id set an enum cannot close over. */}
      <SelectFilter field={local.field.q} label="Project" options={PROJECTS} />
      <MultiSelectFilter field={local.field.channels} label="All channels" options={CHANNELS} />
      <CompareFilter field={local.field.compare} />
      <MultiSelectFilter field={local.field.channels} label="All channels" noun="channels" />
      <RangeFilter field={local.field.range} />
      <ToggleFilter field={local.field.errorsOnly} label="Errors only" />
      <SearchFilter field={local.field.q} placeholder="Search" />
      <ViewTabs field={local.field.currency} />
    </>
  )
}

describe('props contract', () => {
  test('both fixtures exist — tsc, not bun, is the assertion (see this file header)', () => {
    expect(typeof Rejected).toBe('function')
    expect(typeof Accepted).toBe('function')
  })
})
