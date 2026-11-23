import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import {
  NativeSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  selectParts,
} from './select'

afterEach(cleanup)

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma', disabled: true },
]

function Mark(props: {
  className?: string
  'aria-hidden'?: boolean | 'true' | 'false'
}): ReactElement {
  return <svg data-testid="mark" className={props.className} aria-hidden={props['aria-hidden']} />
}

function Controlled(): ReactElement {
  const [value, setValue] = useState('a')
  return (
    <NativeSelect aria-label="Status" options={OPTIONS} value={value} onValueChange={setValue} />
  )
}

const slots = (root: ParentNode): string[] =>
  [...root.querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot') ?? '')

function Form(): ReactElement {
  return <Select aria-label="Stage" options={OPTIONS} defaultValue="b" className="w-40" />
}

describe('select module', () => {
  test('the options form renders with no provider and the trigger shows the selected label', () => {
    const { container, getByRole } = render(<Form />)
    expect(slots(container)).toEqual(['select', 'select-trigger', 'select-value'])
    const trigger = getByRole('combobox', { name: 'Stage' })
    expect(trigger.getAttribute('data-slot')).toBe('select-trigger')
    expect(trigger.textContent).toContain('Beta')
  })

  test('a width class lands on the wrapper and the trigger fills it', () => {
    const { container } = render(<Form />)
    const wrapper = container.querySelector('[data-slot="select"]')
    expect(wrapper?.className).toContain('w-40')
    expect(wrapper?.className).not.toContain('w-full')
  })

  test('the parts form composes the same trigger', () => {
    const { getByRole } = render(
      <Select defaultValue="a">
        <SelectTrigger aria-labelledby="stage-label">
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Alpha</SelectItem>
        </SelectContent>
      </Select>,
    )
    expect(getByRole('combobox').getAttribute('aria-labelledby')).toBe('stage-label')
  })

  test('the parts form shows the selected label in the closed trigger when given items', () => {
    const { getByRole } = render(
      <Select defaultValue="a" items={[{ value: 'a', label: 'Alpha' }]}>
        <SelectTrigger aria-label="Stage">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Alpha</SelectItem>
        </SelectContent>
      </Select>,
    )
    expect(getByRole('combobox').textContent).toContain('Alpha')
  })

  test('the placeholder shows while no value is selected', () => {
    const { getByRole } = render(
      <Select aria-label="Stage" options={OPTIONS} placeholder="Pick one" />,
    )
    expect(getByRole('combobox').textContent).toContain('Pick one')
  })

  test('server render keeps the slots', () => {
    const html = renderToString(<Form />)
    for (const part of ['select', 'select-trigger', 'select-value']) {
      expect(html).toContain(`data-slot="${part}"`)
    }
  })

  test('selectParts lists every slot the module can render', () => {
    expect([...selectParts]).toEqual([
      'select',
      'select-trigger',
      'select-value',
      'select-content',
      'select-item',
      'select-group',
      'native-select',
    ])
  })
})

describe('Select options with an icon and a description', () => {
  test('the trigger shows the icon and the label, never the description', () => {
    const { getByRole, getByTestId } = render(
      <Select
        aria-label="Stage"
        defaultValue="a"
        options={[{ value: 'a', label: 'Alpha', description: 'The first stage', icon: Mark }]}
      />,
    )
    const trigger = getByRole('combobox', { name: 'Stage' })
    expect(trigger.textContent).toContain('Alpha')
    expect(trigger.textContent).not.toContain('The first stage')
    expect(trigger.contains(getByTestId('mark'))).toBe(true)
    expect(getByTestId('mark').getAttribute('aria-hidden')).toBe('true')
  })

  test('an option without an icon or a description keeps the plain label in the trigger', () => {
    const { getByRole, queryByTestId } = render(
      <Select aria-label="Stage" defaultValue="a" options={OPTIONS} />,
    )
    expect(getByRole('combobox', { name: 'Stage' }).textContent).toContain('Alpha')
    expect(queryByTestId('mark')).toBeNull()
  })
})

describe('Select read-only look', () => {
  test('a read-only trigger carries the read-only look and the data-readonly attribute', () => {
    const { getByRole } = render(
      <Select aria-label="Stage" defaultValue="a" readOnly options={OPTIONS} />,
    )
    const trigger = getByRole('combobox', { name: 'Stage' })
    expect(trigger.getAttribute('data-readonly')).not.toBeNull()
    expect(trigger.className).toContain('data-readonly:bg-inset')
    expect(trigger.className).toContain('data-readonly:border-transparent')
    expect(trigger.className).toContain('data-readonly:cursor-default')
  })
})

describe('NativeSelect', () => {
  test('renders a native select with options and a decorative chevron', () => {
    const { container, getByRole } = render(
      <NativeSelect aria-label="Status" options={OPTIONS} defaultValue="b" className="w-40" />,
    )
    const select = getByRole('combobox', { name: 'Status' }) as HTMLSelectElement
    expect(select.tagName).toBe('SELECT')
    expect(select.value).toBe('b')
    expect([...select.options].map((o) => o.disabled)).toEqual([false, false, true])
    expect(container.querySelector('[data-slot="native-select"]')?.className).toContain('w-40')
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  test('option children work and onChange fires with the native event', () => {
    let seen = ''
    const { getByRole } = render(
      <NativeSelect aria-label="Status" onChange={(e) => (seen = e.target.value)}>
        <option value="x">X</option>
        <option value="y">Y</option>
      </NativeSelect>,
    )
    fireEvent.change(getByRole('combobox'), { target: { value: 'y' } })
    expect(seen).toBe('y')
  })

  test('onValueChange fires with the picked value, and onChange still fires', () => {
    let picked = ''
    let changed = ''
    const { getByRole } = render(
      <NativeSelect
        aria-label="Status"
        options={OPTIONS}
        onValueChange={(value) => (picked = value)}
        onChange={(e) => (changed = e.target.value)}
      />,
    )
    fireEvent.change(getByRole('combobox'), { target: { value: 'b' } })
    expect(picked).toBe('b')
    expect(changed).toBe('b')
  })

  test('the picked value reaches a controlled select through onValueChange', () => {
    const { getByRole } = render(<Controlled />)
    fireEvent.change(getByRole('combobox'), { target: { value: 'b' } })
    expect((getByRole('combobox') as HTMLSelectElement).value).toBe('b')
  })

  test('aria-invalid and disabled carry their look on the native select', () => {
    const { getByRole, container } = render(
      <NativeSelect aria-label="Status" options={OPTIONS} aria-invalid="true" disabled />,
    )
    expect(getByRole('combobox').getAttribute('aria-invalid')).toBe('true')
    const wrapper = container.querySelector('[data-slot="native-select"]')?.className ?? ''
    expect(wrapper).toContain('[&_select]:aria-invalid:border-bad')
    expect(wrapper).toContain('[&_select]:disabled:opacity-50')
  })
})

type Contract = { pattern: string; allow: string[]; deny: string[] }
const contracts = (
  JSON.parse(readFileSync(join(import.meta.dirname, 'no-restyle.generated.json'), 'utf8')) as {
    contracts: Contract[]
  }
).contracts

const glob = (g: string): RegExp => new RegExp(`^${g.replace(/\*/g, '.*')}$`)
const denied = (component: string, cls: string): boolean => {
  const contract = contracts.find((c) => new RegExp(c.pattern).test(component))
  return contract?.deny.some((g) => glob(g).test(cls)) ?? false
}

describe('select no-restyle contract', () => {
  test('a width class on Select, NativeSelect and SelectTrigger passes; height and display are denied', () => {
    for (const component of ['Select', 'SelectTrigger', 'NativeSelect']) {
      for (const ok of ['w-40', 'w-full', 'flex-1', 'min-w-0', 'mt-2']) {
        expect(denied(component, ok)).toBe(false)
      }
      for (const bad of ['h-12', 'min-h-10', 'size-8', 'flex', 'hidden']) {
        expect(denied(component, bad)).toBe(true)
      }
    }
  })
})

describe('Select on the list engine', () => {
  const GROUPED = [
    {
      label: 'Europe',
      options: [
        { value: 'de', label: 'Germany' },
        { value: 'fr', label: 'France' },
      ],
    },
    { label: 'Asia', options: [{ value: 'jp', label: 'Japan', description: 'Tokyo' }] },
  ]
  const rows = (): string[] =>
    [
      ...document.querySelectorAll('[data-slot="option-group-label"], [data-slot="option-row"]'),
    ].map((el) =>
      el.getAttribute('data-slot') === 'option-group-label'
        ? `# ${el.textContent ?? ''}`
        : (el.querySelector('[data-slot="option-label"]')?.textContent ?? ''),
    )

  test('groups render as headers over the shared option row', async () => {
    await act(async () => {
      render(<Select aria-label="Country" options={GROUPED} defaultOpen />)
    })
    expect(rows()).toEqual(['# Europe', 'Germany', 'France', '# Asia', 'Japan'])
    expect(document.querySelector('[data-slot="option-description"]')?.textContent).toBe('Tokyo')
  })

  test('searchable adds a search field that ranks across the groups', async () => {
    await act(async () => {
      render(<Select aria-label="Country" options={GROUPED} searchable defaultOpen />)
    })
    const search = document.querySelector('[data-slot="select-search"]') as HTMLInputElement
    expect(search).not.toBeNull()
    await act(async () => {
      fireEvent.change(search, { target: { value: 'jap' } })
    })
    expect(rows()).toEqual(['# Asia', 'Japan'])
    await act(async () => {
      fireEvent.click(document.querySelector('[data-slot="option-row"]') as Element)
    })
    expect(document.querySelector('[data-slot="select-trigger"]')?.textContent).toContain('Japan')
    expect(search.value).toBe('')
  })

  test('a loader makes it searchable and asks it for the text', async () => {
    const queries: string[] = []
    const load = async (query: string) => {
      queries.push(query)
      return [{ value: query, label: `Result for ${query || 'nothing'}` }]
    }
    await act(async () => {
      render(<Select aria-label="Repo" options={load} defaultOpen />)
    })
    await waitFor(() => expect(rows()).toEqual(['Result for nothing']))
    await act(async () => {
      fireEvent.change(document.querySelector('[data-slot="select-search"]') as Element, {
        target: { value: 'ui' },
      })
    })
    await waitFor(() => expect(rows()).toEqual(['Result for ui']))
    expect(queries).toEqual(['', 'ui'])
  })
})
