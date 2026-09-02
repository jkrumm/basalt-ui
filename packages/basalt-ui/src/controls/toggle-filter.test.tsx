/**
 * `ToggleFilter` on the panel/sheet surface — the row whose control rides the label line
 * (`docs/CONTROLS-SPEC.md` §3). `PanelRow`'s label used to be a bare `<span>`, which meant only the
 * `Switch` itself was a click target; this pins the label back as an activating target.
 *
 * The fixture is a `createLocalStore`, never `createSearchStore` — the field vocabulary is
 * identical and the local store needs no router (same rationale as `select-filter.test.tsx`).
 */
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { createLocalStore, field } from '../state'
import { FilterSetScope } from './filter-context'
import { ToggleFilter } from './toggle-filter'

const store = createLocalStore({
  key: 'toggle-filter-panel',
  fields: { errorsOnly: field.boolean(false) },
})

function mount(node: ReactNode): void {
  render(
    <MantineProvider>
      <FilterSetScope surface="panel" registry={null}>
        {node}
      </FilterSetScope>
    </MantineProvider>,
  )
}

describe('ToggleFilter — panel surface', () => {
  test('clicking the label text toggles the switch', () => {
    mount(<ToggleFilter field={store.field.errorsOnly} label="Errors only" />)

    const switchInput = screen.getByRole('switch', {
      name: 'Errors only',
      hidden: true,
    }) as HTMLInputElement
    expect(switchInput.checked).toBe(false)

    fireEvent.click(screen.getByText('Errors only'))

    expect(switchInput.checked).toBe(true)
  })
})
