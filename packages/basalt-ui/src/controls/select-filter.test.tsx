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
import { render } from '@testing-library/react'
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
