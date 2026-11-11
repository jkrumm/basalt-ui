import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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
