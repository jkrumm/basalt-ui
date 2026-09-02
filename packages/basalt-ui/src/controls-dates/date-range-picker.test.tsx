/**
 * `DateRangePicker` — F-ERR-1: a missing `value` used to surface from inside the read as
 * `undefined is not an object (evaluating 'value.from')`, caught by `BasaltErrorBoundary` into a
 * blank subtree. `assertRequiredProps` names the component and the prop instead.
 */
import { MantineProvider } from '@mantine/core'
import { render } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { DateRangePicker } from './date-range-picker'
import type { RangeCustomPickerProps } from '../controls/range-filter'

describe('DateRangePicker', () => {
  test('a missing `value` throws a named message, not a raw TypeError', () => {
    expect(() => {
      render(
        <MantineProvider>
          <DateRangePicker {...({ onChange: () => {} } as unknown as RangeCustomPickerProps)} />
        </MantineProvider>,
      )
    }).toThrow('[basalt] DateRangePicker: prop "value" is required')
  })

  test('renders with a value present', () => {
    render(
      <MantineProvider>
        <DateRangePicker value={{ from: '2026-01-01', to: '2026-01-10' }} onChange={() => {}} />
      </MantineProvider>,
    )
  })
})
