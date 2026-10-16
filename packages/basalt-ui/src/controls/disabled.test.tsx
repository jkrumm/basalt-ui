/**
 * `disabled` (shared `FilterBase`) is honoured by every filter that has something to disable: the
 * pill form cannot be pressed, the panel form's control is inert.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { createLocalStore, field } from '../state'
import type { FieldHandle } from '../state'
import type { RangeField } from '../state/fields'
import { FilterSetScope } from './filter-context'
import { MultiSelectFilter } from './multi-select-filter'
import { NumberFilter } from './number-filter'
import { RangeFilter } from './range-filter'
import type { RangeCustomPickerProps } from './range-filter'
import { SelectFilter } from './select-filter'
import { ViewTabs } from './view-tabs'

const store = createLocalStore({
  key: 'disabled-probe',
  fields: {
    currency: field.enum(['EUR', 'USD'] as const, 'EUR'),
    channels: field.multi(['web', 'email'], []),
    nights: field.number({ fallback: 2, min: 1, max: 14, int: true }),
    tab: field.enum(['a', 'b'] as const, 'a'),
  },
})
const rangeStore = createLocalStore({
  key: 'disabled-probe-range',
  fields: { range: field.range({ presets: ['7d', '30d'], fallback: '30d' }) },
})

function mount(surface: 'pill' | 'panel', node: ReactNode): void {
  render(
    <MantineProvider>
      <FilterSetScope surface={surface} registry={null}>
        {node}
      </FilterSetScope>
    </MantineProvider>,
  )
}

const pill = (name: string): HTMLButtonElement =>
  screen.getByRole('button', { name }) as HTMLButtonElement

afterEach(cleanup)

describe('disabled — pill surface', () => {
  test('SelectFilter: the pill is disabled and never opens', () => {
    mount('pill', <SelectFilter field={store.field.currency} label="Currency" disabled />)
    expect(pill('EUR').disabled).toBe(true)
    fireEvent.click(pill('EUR'))
    expect(screen.queryByRole('radio', { name: 'USD', hidden: true })).toBeNull()
  })

  test('MultiSelectFilter', () => {
    mount('pill', <MultiSelectFilter field={store.field.channels} label="Channels" disabled />)
    expect(pill('Channels').disabled).toBe(true)
  })

  test('NumberFilter (stepper form)', () => {
    mount('pill', <NumberFilter field={store.field.nights} label="Nights" disabled />)
    expect(pill('2').disabled).toBe(true)
  })

  test('RangeFilter', () => {
    mount('pill', <RangeFilter field={rangeStore.field.range} disabled />)
    expect(pill('30d').disabled).toBe(true)
  })
})

describe('disabled — panel surface', () => {
  test('SelectFilter: the choice track is inert', () => {
    mount('panel', <SelectFilter field={store.field.currency} label="Currency" disabled />)
    for (const radio of screen.getAllByRole('radio', { hidden: true })) {
      expect((radio as HTMLInputElement).disabled).toBe(true)
    }
  })

  test('MultiSelectFilter: the facet fieldset is disabled', () => {
    mount('panel', <MultiSelectFilter field={store.field.channels} label="Channels" disabled />)
    const set = screen.getByRole('group', { hidden: true }) as HTMLFieldSetElement
    expect(set.disabled).toBe(true)
  })

  test('NumberFilter: the input is disabled', () => {
    mount('panel', <NumberFilter field={store.field.nights} label="Nights" disabled />)
    expect((screen.getByRole('textbox', { hidden: true }) as HTMLInputElement).disabled).toBe(true)
  })

  test('ViewTabs: the track is inert', () => {
    mount('panel', <ViewTabs field={store.field.tab} disabled />)
    for (const radio of screen.getAllByRole('radio', { hidden: true })) {
      expect((radio as HTMLInputElement).disabled).toBe(true)
    }
  })
})

describe('disabled — injected and facet controls cannot change the value', () => {
  test('RangeFilter: the custom picker reports into the void', () => {
    const writes: unknown[] = []
    const handle = {
      kind: 'range',
      fallback: { preset: '30d' },
      options: [
        { value: '30d', label: '30d' },
        { value: 'custom', label: 'custom' },
      ],
      use: () => [
        { preset: 'custom', from: '2026-03-01', to: '2026-03-02' },
        (next: unknown) => writes.push(next),
      ],
      isDefault: () => false,
      clear: () => {},
    } as unknown as FieldHandle<RangeField<'30d', true>>
    function Picker({ onChange }: RangeCustomPickerProps): ReactNode {
      return (
        <button
          type="button"
          onClick={() => {
            onChange({ from: '2026-04-01', to: '2026-04-02' })
          }}
        >
          pick april
        </button>
      )
    }
    mount('panel', <RangeFilter field={handle} customPicker={Picker} disabled />)
    fireEvent.click(screen.getByRole('button', { name: 'pick april', hidden: true }))
    expect(writes).toEqual([])
  })

  test('MultiSelectFilter: clicking a facet does not select it', () => {
    mount('panel', <MultiSelectFilter field={store.field.channels} label="Channels" disabled />)
    const web = screen.getByRole('checkbox', { name: 'web', hidden: true }) as HTMLInputElement
    fireEvent.click(web)
    expect(web.checked).toBe(false)
  })
})
