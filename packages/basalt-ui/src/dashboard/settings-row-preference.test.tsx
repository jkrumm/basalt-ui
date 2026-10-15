/**
 * The canonical SettingsRow preference (rule `basalt-controls.md` § Homes): a Mantine control in
 * `control=` whose value/onChange come from a `createLocalStore` field's `.use()`. Rendered, not
 * claimed — the same snippet the `basalt-design` skill shows.
 */
import { MantineProvider, Select } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test } from 'bun:test'
import { createLocalStore, field } from '../state/fields'
import { SettingsRow } from './settings-section'

const prefs = createLocalStore({
  key: 'settings-row-pref',
  fields: { unit: field.enum(['km', 'mi'], 'km') },
})

function UnitRow() {
  const [unit, setUnit] = prefs.field.unit.use()
  return (
    <SettingsRow
      label="Distance unit"
      control={
        <Select
          aria-label="Distance unit"
          data={['km', 'mi']}
          value={unit}
          onChange={(v) => v !== null && setUnit(v as 'km' | 'mi')}
        />
      }
    />
  )
}

beforeEach(() => localStorage.clear())

test('a settings-row Select reads and persists a createLocalStore field', () => {
  render(
    <MantineProvider>
      <UnitRow />
    </MantineProvider>,
  )
  const input = screen.getAllByDisplayValue('km')[0] as HTMLInputElement
  expect(input.value).toBe('km')
  fireEvent.click(input)
  fireEvent.click(screen.getByRole('option', { name: 'mi', hidden: true }))
  expect(input.value).toBe('mi')
  expect(localStorage.getItem('basalt:settings-row-pref')).toContain('"unit":"mi"')
})
