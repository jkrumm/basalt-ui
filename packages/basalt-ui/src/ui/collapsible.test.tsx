import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  collapsibleParts,
} from './collapsible'

afterEach(cleanup)

const slots = (root: ParentNode): string[] =>
  [...root.querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot') ?? '')

type SampleProps = { hiddenUntilFound?: boolean; keepMounted?: boolean; defaultOpen?: boolean }

const Sample = ({ hiddenUntilFound, keepMounted, defaultOpen }: SampleProps) => (
  <Collapsible defaultOpen={defaultOpen}>
    <CollapsibleTrigger>Advanced</CollapsibleTrigger>
    <CollapsibleContent hiddenUntilFound={hiddenUntilFound} keepMounted={keepMounted}>
      <input aria-label="Token" defaultValue="" />
    </CollapsibleContent>
  </Collapsible>
)

describe('collapsible module', () => {
  test('renders with no provider; every part carries data-slot and collapsibleParts lists them', () => {
    const { container } = render(<Sample defaultOpen />)
    expect(new Set(slots(container))).toEqual(new Set(collapsibleParts))
  })

  test('server render keeps every slot', () => {
    const html = renderToString(<Sample defaultOpen />)
    for (const part of collapsibleParts) expect(html).toContain(`data-slot="${part}"`)
  })

  test('className is merged and cannot replace the slot', () => {
    const { container } = render(
      <Collapsible className="w-full" data-slot="hijacked">
        <CollapsibleTrigger className="text-sm">T</CollapsibleTrigger>
      </Collapsible>,
    )
    expect(container.firstElementChild?.className).toBe('w-full')
    expect(container.firstElementChild?.getAttribute('data-slot')).toBe('collapsible')
    expect(container.querySelector('button')?.className).toContain('text-sm')
  })

  test('the trigger toggles aria-expanded and mounts the panel', () => {
    const { getByRole, container } = render(<Sample />)
    const trigger = getByRole('button', { name: 'Advanced' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('[data-slot="collapsible-content"]')).toBeNull()
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('[data-slot="collapsible-content"]')).toBeTruthy()
  })

  test('hiddenUntilFound keeps the closed panel findable: hidden="until-found"', () => {
    const { container } = render(<Sample hiddenUntilFound />)
    expect(
      container.querySelector('[data-slot="collapsible-content"]')?.getAttribute('hidden'),
    ).toBe('until-found')
  })

  test('keepMounted keeps state across a close', () => {
    const { getByRole, getByLabelText } = render(<Sample keepMounted defaultOpen />)
    fireEvent.change(getByLabelText('Token'), { target: { value: 'abc' } })
    fireEvent.click(getByRole('button', { name: 'Advanced' }))
    expect(getByRole('button', { name: 'Advanced' }).getAttribute('aria-expanded')).toBe('false')
    expect((getByLabelText('Token', { selector: 'input' }) as HTMLInputElement).value).toBe('abc')
  })
})
