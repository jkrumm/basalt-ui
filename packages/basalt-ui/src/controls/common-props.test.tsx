/**
 * The `common/props` + `common/validate` adoption across `./controls` (isomorphic findings (a) and
 * (c) — `.claude/maturation/isomorphic-findings.md`): every composite here forwards `className` to
 * its own root, and every bound control throws a NAMED message when `field` never arrived instead
 * of a raw `TypeError` from inside the read.
 */
import { Button, MantineProvider } from '@mantine/core'
import { render } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { createLocalStore, field } from '../state'
import { ActionGroup, OverflowMenu } from './actions'
import { CompareFilter } from './compare-filter'
import type { CompareFilterProps } from './compare-filter'
import { ControlGroup } from './control-group'
import { FilterSet } from './filter-set'
import { MultiSelectFilter } from './multi-select-filter'
import type { MultiSelectFilterProps } from './multi-select-filter'
import { NumberFilter } from './number-filter'
import type { NumberFilterProps } from './number-filter'
import { RangeFilter } from './range-filter'
import type { RangeFilterProps } from './range-filter'
import { SearchFilter } from './search-filter'
import type { SearchFilterProps } from './search-filter'
import { SliderControl } from './slider-control'
import type { SliderControlProps } from './slider-control'
import { SyncButton } from './sync-button'
import { ToggleFilter } from './toggle-filter'
import type { ToggleFilterProps } from './toggle-filter'
import { ViewTabs } from './view-tabs'
import type { ViewTabsProps } from './view-tabs'

const store = createLocalStore({
  key: 'controls-common-props',
  fields: {
    currency: field.enum(['USD', 'EUR'], 'USD'),
    compare: field.enum(['none', 'previous', 'year'] as const, 'none'),
    channels: field.multi(['web', 'email'], []),
    range: field.range({ presets: ['7d', '30d'], fallback: '30d', custom: true }),
    errorsOnly: field.boolean(false),
    q: field.string(),
    nights: field.number({ fallback: 2, min: 1, max: 14, int: true }),
  },
})

function mount(node: ReactNode): void {
  render(<MantineProvider>{node}</MantineProvider>)
}

function hasClass(className: string): boolean {
  return document.querySelector(`.${className}`) !== null
}

describe('className lands on the root', () => {
  test('ControlGroup', () => {
    mount(
      <ControlGroup className="probe-control-group">
        <Button>A</Button>
      </ControlGroup>,
    )
    expect(hasClass('probe-control-group')).toBe(true)
  })

  test('ActionGroup', () => {
    mount(<ActionGroup secondary={[{ key: 'a', label: 'A' }]} className="probe-action-group" />)
    expect(hasClass('probe-action-group')).toBe(true)
  })

  test('OverflowMenu', () => {
    mount(<OverflowMenu actions={[{ key: 'a', label: 'A' }]} className="probe-overflow-menu" />)
    expect(hasClass('probe-overflow-menu')).toBe(true)
  })

  test('SyncButton', () => {
    mount(
      <SyncButton syncing={false} onSync={() => {}} scope="page" className="probe-sync-button" />,
    )
    expect(hasClass('probe-sync-button')).toBe(true)
  })

  test('FilterSet', () => {
    mount(
      <FilterSet className="probe-filter-set">
        <ToggleFilter field={store.field.errorsOnly} label="Errors only" />
      </FilterSet>,
    )
    expect(hasClass('probe-filter-set')).toBe(true)
  })

  test('CompareFilter', () => {
    mount(<CompareFilter field={store.field.compare} className="probe-compare-filter" />)
    expect(hasClass('probe-compare-filter')).toBe(true)
  })

  test('MultiSelectFilter', () => {
    mount(
      <MultiSelectFilter
        field={store.field.channels}
        label="Channels"
        className="probe-multi-select-filter"
      />,
    )
    expect(hasClass('probe-multi-select-filter')).toBe(true)
  })

  test('NumberFilter', () => {
    mount(
      <NumberFilter field={store.field.nights} label="Nights" className="probe-number-filter" />,
    )
    expect(hasClass('probe-number-filter')).toBe(true)
  })

  test('RangeFilter', () => {
    mount(<RangeFilter field={store.field.range} className="probe-range-filter" />)
    expect(hasClass('probe-range-filter')).toBe(true)
  })

  test('SearchFilter', () => {
    mount(<SearchFilter field={store.field.q} className="probe-search-filter" />)
    expect(hasClass('probe-search-filter')).toBe(true)
  })

  test('SliderControl', () => {
    mount(
      <SliderControl field={store.field.nights} label="Nights" className="probe-slider-control" />,
    )
    expect(hasClass('probe-slider-control')).toBe(true)
  })

  test('ToggleFilter', () => {
    mount(
      <ToggleFilter
        field={store.field.errorsOnly}
        label="Errors only"
        className="probe-toggle-filter"
      />,
    )
    expect(hasClass('probe-toggle-filter')).toBe(true)
  })

  test('ViewTabs', () => {
    mount(<ViewTabs field={store.field.currency} className="probe-view-tabs" />)
    expect(hasClass('probe-view-tabs')).toBe(true)
  })
})

describe('a missing `field` throws a named message, not a raw TypeError', () => {
  test('CompareFilter', () => {
    expect(() => {
      mount(<CompareFilter {...({ label: 'Compare' } as unknown as CompareFilterProps)} />)
    }).toThrow('[basalt] CompareFilter: prop "field" is required')
  })

  test('MultiSelectFilter', () => {
    expect(() => {
      mount(
        <MultiSelectFilter
          {...({ label: 'Channels' } as unknown as MultiSelectFilterProps<string>)}
        />,
      )
    }).toThrow('[basalt] MultiSelectFilter: prop "field" is required')
  })

  test('NumberFilter', () => {
    expect(() => {
      mount(<NumberFilter {...({ label: 'Nights' } as unknown as NumberFilterProps)} />)
    }).toThrow('[basalt] NumberFilter: prop "field" is required')
  })

  test('RangeFilter', () => {
    expect(() => {
      mount(<RangeFilter {...({} as unknown as RangeFilterProps<string>)} />)
    }).toThrow('[basalt] RangeFilter: prop "field" is required')
  })

  test('SearchFilter', () => {
    expect(() => {
      mount(<SearchFilter {...({} as unknown as SearchFilterProps)} />)
    }).toThrow('[basalt] SearchFilter: prop "field" is required')
  })

  test('SliderControl', () => {
    expect(() => {
      mount(<SliderControl {...({ label: 'Nights' } as unknown as SliderControlProps)} />)
    }).toThrow('[basalt] SliderControl: prop "field" is required')
  })

  test('ToggleFilter', () => {
    expect(() => {
      mount(<ToggleFilter {...({ label: 'Errors only' } as unknown as ToggleFilterProps)} />)
    }).toThrow('[basalt] ToggleFilter: prop "field" is required')
  })

  test('ViewTabs', () => {
    expect(() => {
      mount(<ViewTabs {...({} as unknown as ViewTabsProps<string>)} />)
    }).toThrow('[basalt] ViewTabs: prop "field" is required')
  })
})
