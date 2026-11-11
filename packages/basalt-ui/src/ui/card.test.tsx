import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Card, cardParts } from './card'

afterEach(cleanup)

const slots = (root: ParentNode): string[] =>
  [...root.querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot') ?? '')

describe('card module', () => {
  test('renders with no provider; every part carries data-slot and cardParts lists them', () => {
    const { container } = render(<Card>Revenue</Card>)
    expect(slots(container)).toEqual([...cardParts])
    expect(container.firstElementChild?.tagName).toBe('DIV')
  })

  test('server render keeps the slot', () => {
    const html = renderToString(<Card>x</Card>)
    for (const part of cardParts) expect(html).toContain(`data-slot="${part}"`)
  })

  test('flush drops the padding', () => {
    const { getByText } = render(
      <>
        <Card>padded</Card>
        <Card flush>flush</Card>
      </>,
    )
    expect(getByText('padded').className).toContain('p-4')
    expect(getByText('flush').className).toContain('p-0')
  })

  test('className merges and DOM props pass through', () => {
    const { getByLabelText } = render(
      <Card aria-label="Orders" className="col-span-2">
        x
      </Card>,
    )
    const el = getByLabelText('Orders')
    expect(el.className).toContain('col-span-2')
    expect(el.className).toContain('bg-card')
  })

  test('polymorphism goes through render and keeps the slot and classes', () => {
    const { container } = render(
      <Card render={<section />} aria-label="Orders">
        x
      </Card>,
    )
    const el = container.firstElementChild
    expect(el?.tagName).toBe('SECTION')
    expect(el?.getAttribute('data-slot')).toBe('card')
    expect(el?.className).toContain('bg-card')
  })
})
