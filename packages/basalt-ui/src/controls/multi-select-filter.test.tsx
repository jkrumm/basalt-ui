/**
 * `MultiSelectFilter` — the popover row's coarse-pointer hit gap (code-foundations F1). The
 * Checkbox.Group Stack shares the exact same `gap={2}` defect `select-filter.test.tsx` pins for
 * `SelectFilter`'s Radio.Group — see that file for the full derivation.
 */
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { createLocalStore, field } from '../state'
import { MultiSelectFilter } from './multi-select-filter'

const store = createLocalStore({
  key: 'multi-select-filter-props',
  fields: { channels: field.multi(['web', 'app'], []) },
})

describe('the popover row gap clears the 44px coarse hit floor (code-foundations F1)', () => {
  test('the Checkbox.Group Stack no longer caps `--vx-hit-gap` at a 2px literal', async () => {
    render(
      <MantineProvider>
        <MultiSelectFilter field={store.field.channels} label="Channels" />
      </MantineProvider>,
    )
    // Undocked from FilterSet, the default surface is the pill's own Popover — its dropdown (and
    // the Stack inside it) mounts asynchronously (floating-ui) once the pill is clicked open.
    // Empty selection → the pill reads the filter's own name.
    fireEvent.click(screen.getByRole('button', { name: 'Channels' }))
    const stack = await waitFor(() => {
      const el = document.querySelector('.mantine-Stack-root') as HTMLElement | null
      if (el === null) throw new Error('Stack not mounted yet')
      return el
    })
    expect(stack.style.getPropertyValue('--stack-gap')).not.toBe('0.125rem')
    expect(stack.style.getPropertyValue('--vx-hit-gap')).toBe('var(--stack-gap)')
  })
})
