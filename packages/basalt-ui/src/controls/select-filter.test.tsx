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
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { createLocalStore, field } from '../state'
import { FilterSet } from './filter-set'
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

describe('a call-site fallback (`withFallback`) reaches the control, not just the hook', () => {
  type Lift = 'squat' | 'bench' | 'deadlift'
  const lifts = createLocalStore({
    key: 'select-filter-leader',
    fields: { exercise: field.enum(['squat', 'bench', 'deadlift'], 'squat') },
  })

  function Probe({ leader }: { leader: Lift }): ReactNode {
    const handle = lifts.field.exercise.withFallback(leader)
    const [value] = handle.use()
    return (
      <>
        <output data-testid="hook">{value}</output>
        <SelectFilter field={handle} label="Lift" />
      </>
    )
  }

  const pill = (name: string) => screen.getByRole('button', { name })
  const hook = () => screen.getByTestId('hook').textContent
  /** The CHECKED radio in the open popover — the control's selected state, not just a pill label. */
  const selected = async (): Promise<string | undefined> => {
    const radios = await screen.findAllByRole('radio')
    return radios.find((r) => (r as HTMLInputElement).checked)?.getAttribute('value') ?? undefined
  }

  test('unset: hook and control agree on the leader, and nothing is persisted', async () => {
    localStorage.clear()
    mount(<Probe leader="bench" />)
    expect(hook()).toBe('bench')
    fireEvent.click(pill('bench'))
    expect(await selected()).toBe('bench')
    expect(localStorage.getItem('basalt:select-filter-leader')).toBeNull()
    expect(lifts.readStored()).toEqual({})
  })

  test('a leader change while unset moves both', () => {
    localStorage.clear()
    const { rerender } = render(
      <MantineProvider>
        <Probe leader="bench" />
      </MantineProvider>,
    )
    rerender(
      <MantineProvider>
        <Probe leader="deadlift" />
      </MantineProvider>,
    )
    expect(hook()).toBe('deadlift')
    expect(pill('deadlift')).toBeDefined()
  })

  test('set → both show the stored value; reset → both return to the call-site fallback', async () => {
    localStorage.clear()
    mount(<Probe leader="bench" />)
    fireEvent.click(pill('bench'))
    fireEvent.click(await screen.findByLabelText('squat'))
    await waitFor(() => expect(hook()).toBe('squat'))
    expect(pill('squat')).toBeDefined()
    expect(localStorage.getItem('basalt:select-filter-leader')).not.toBeNull()

    act(() => {
      lifts.field.exercise.clear()
    })
    await waitFor(() => expect(hook()).toBe('bench'))
    expect(pill('bench')).toBeDefined()
    expect(lifts.readStored()).toEqual({})
  })

  test('a stored value off the fallback is an active filter; Reset all returns to the fallback', async () => {
    localStorage.clear()
    const handle = lifts.field.exercise.withFallback('bench')
    expect(handle.isDefault('squat')).toBe(false)
    expect(handle.isDefault('bench')).toBe(true)

    localStorage.setItem(
      'basalt:select-filter-leader',
      JSON.stringify({ v: 1, value: { exercise: 'squat' } }),
    )
    mount(
      <FilterSet>
        <SelectFilter field={handle} label="Lift" />
        <SelectFilter field={store.field.currency} label="Currency" />
      </FilterSet>,
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Filters (1)' })).toBeDefined())
    fireEvent.click(screen.getByRole('button', { name: 'Filters (1)' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Reset all', hidden: true }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Filters' })).toBeDefined())
    expect(lifts.readStored()).toEqual({})
  })
})
