/**
 * `SelectFilter` — the one bound control `common-props.test.tsx` does not carry, because it is the
 * only filter that is a pure DELEGATE: it validates, splits the two `field` shapes and renders an
 * `EnumFilter`. Both halves of the `common/props` + `common/validate` contract have to survive that
 * hop, and neither is visible from `EnumFilter`'s own tests.
 *
 * The fixture is a `createLocalStore`, never `createSearchStore` — the field vocabulary is
 * identical and the local store needs no router.
 */
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { createLocalStore, field } from '../state'
import { SelectFilter } from './select-filter'
import type { SelectFilterEnumProps } from './select-filter'

const store = createLocalStore({
  key: 'select-filter-props',
  fields: {
    currency: field.enum(['USD', 'EUR'], 'USD'),
    projectId: field.string(),
  },
})

const PROJECTS = [
  { value: 'argo', label: 'argo' },
  { value: 'linewatch', label: 'linewatch' },
]

function mount(node: ReactNode): void {
  render(<MantineProvider>{node}</MantineProvider>)
}

describe('className lands on the root', () => {
  test('the enum arm forwards it through to EnumFilter', () => {
    mount(
      <SelectFilter field={store.field.currency} label="Currency" className="probe-select-enum" />,
    )
    expect(document.querySelector('.probe-select-enum')).not.toBeNull()
  })

  test('the string arm forwards it too — both overloads share one body', () => {
    mount(
      <SelectFilter
        field={store.field.projectId}
        label="Project"
        options={PROJECTS}
        className="probe-select-string"
      />,
    )
    expect(document.querySelector('.probe-select-string')).not.toBeNull()
  })
})

describe('a missing `field` throws a named message, not a raw TypeError', () => {
  test('SelectFilter names itself, the prop and the remedy', () => {
    expect(() => {
      mount(
        <SelectFilter {...({ label: 'Currency' } as unknown as SelectFilterEnumProps<string>)} />,
      )
    }).toThrow(
      '[basalt] SelectFilter: prop "field" is required — bind it to a store field ' +
        '(`store.field.<name>`), never a value/onChange pair.',
    )
  })
})

describe('the popover row gap clears the 44px coarse hit floor (code-foundations F1)', () => {
  test('the Radio.Group Stack no longer caps `--vx-hit-gap` at a 2px literal', async () => {
    render(
      <MantineProvider>
        <SelectFilter field={store.field.currency} label="Currency" />
      </MantineProvider>,
    )
    // Undocked from FilterSet, the default surface is the pill's own Popover — its dropdown
    // (and the Stack inside it) mounts asynchronously (floating-ui) once the pill is clicked open.
    fireEvent.click(screen.getByRole('button', { name: 'USD' }))
    const stack = await waitFor(() => {
      const el = document.querySelector('.mantine-Stack-root') as HTMLElement | null
      if (el === null) throw new Error('Stack not mounted yet')
      return el
    })
    // Was `gap={2}` → `--stack-gap: 0.125rem`, capping the coarse-pointer overlay at ~4px of the 44.
    expect(stack.style.getPropertyValue('--stack-gap')).not.toBe('0.125rem')
    expect(stack.style.getPropertyValue('--vx-hit-gap')).toBe('var(--stack-gap)')
  })
})
