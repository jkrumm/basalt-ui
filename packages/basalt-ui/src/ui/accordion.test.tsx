import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  accordionParts,
} from './accordion'

afterEach(cleanup)

const slots = (root: ParentNode): string[] =>
  [...root.querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot') ?? '')

type SampleProps = { hiddenUntilFound?: boolean; keepMounted?: boolean; open?: boolean }

const Sample = ({ hiddenUntilFound, keepMounted, open }: SampleProps) => (
  <Accordion
    hiddenUntilFound={hiddenUntilFound}
    keepMounted={keepMounted}
    defaultValue={open ? ['one'] : []}
  >
    <AccordionItem value="one">
      <AccordionTrigger>Shipping</AccordionTrigger>
      <AccordionContent>
        <input aria-label="Note" defaultValue="" />
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="two">
      <AccordionTrigger>Returns</AccordionTrigger>
      <AccordionContent>Thirty days.</AccordionContent>
    </AccordionItem>
  </Accordion>
)

describe('accordion module', () => {
  test('renders with no provider; every part carries data-slot and accordionParts lists them', () => {
    const { container } = render(<Sample open />)
    expect(new Set(slots(container))).toEqual(new Set(accordionParts))
  })

  test('server render keeps every slot', () => {
    const html = renderToString(<Sample open />)
    for (const part of accordionParts) expect(html).toContain(`data-slot="${part}"`)
  })

  test('className is merged and cannot replace the slot', () => {
    const { container } = render(
      <Accordion className="max-w-md" data-slot="hijacked">
        <AccordionItem value="x">
          <AccordionTrigger>T</AccordionTrigger>
          <AccordionContent>C</AccordionContent>
        </AccordionItem>
      </Accordion>,
    )
    const root = container.firstElementChild
    expect(root?.className).toContain('max-w-md')
    expect(root?.getAttribute('data-slot')).toBe('accordion')
  })

  test('the trigger is a button inside a heading and toggles aria-expanded', () => {
    const { getByRole } = render(<Sample />)
    const trigger = getByRole('button', { name: 'Shipping' })
    expect(trigger.parentElement?.tagName).toBe('H3')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  test('a closed panel is unmounted by default', () => {
    const { container } = render(<Sample />)
    expect(container.querySelector('[data-slot="accordion-content"]')).toBeNull()
  })

  test('hiddenUntilFound keeps the closed panel findable: hidden="until-found"', () => {
    const { container } = render(<Sample hiddenUntilFound />)
    const panels = container.querySelectorAll('[data-slot="accordion-content"]')
    expect(panels.length).toBe(2)
    for (const panel of panels) expect(panel.getAttribute('hidden')).toBe('until-found')
  })

  test('keepMounted keeps state across a close', () => {
    const { getByRole, getByLabelText } = render(<Sample keepMounted open />)
    const input = getByLabelText('Note') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'ring twice' } })
    fireEvent.click(getByRole('button', { name: 'Shipping' }))
    expect(getByRole('button', { name: 'Shipping' }).getAttribute('aria-expanded')).toBe('false')
    expect((getByLabelText('Note', { selector: 'input' }) as HTMLInputElement).value).toBe(
      'ring twice',
    )
  })
})
