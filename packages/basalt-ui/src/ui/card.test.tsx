import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Card, CardBand, CardPhase, IconTile, Inset, cardParts } from './card'

afterEach(cleanup)

const slots = (root: ParentNode): string[] =>
  [...root.querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot') ?? '')

describe('card module', () => {
  test('renders with no provider; every part carries data-slot and cardParts lists them', () => {
    const { container } = render(
      <Card flush>
        <CardBand title="Revenue" info="Billed revenue." />
        <IconTile>i</IconTile>
        <Inset>x</Inset>
        <CardPhase>x</CardPhase>
      </Card>,
    )
    expect(slots(container).toSorted()).toEqual([...cardParts].toSorted())
    expect(container.firstElementChild?.tagName).toBe('DIV')
  })

  test('server render keeps the slot', () => {
    const html = renderToString(
      <Card>
        <CardBand title="x" info="y" />
        <IconTile>i</IconTile>
        <Inset>x</Inset>
        <CardPhase>x</CardPhase>
      </Card>,
    )
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

  test('the band renders icon, title, subtitle and end on one row', () => {
    const Icon = (): string => 'ic'
    const { container, getByText } = render(
      <CardBand icon={Icon} title="Shipped" subtitle="vs last week" end={<i>menu</i>} />,
    )
    expect(container.querySelector('[data-slot="icon-tile"]')?.textContent).toBe('ic')
    expect(getByText('Shipped')).toBeTruthy()
    expect(getByText('vs last week')).toBeTruthy()
    expect(getByText('menu')).toBeTruthy()
  })

  test('info is a native popover: the trigger targets it, no overlay library', () => {
    const { container, getByRole } = render(<CardBand title="Shipped" info="Merged PRs." />)
    const trigger = getByRole('button', { name: 'About Shipped' })
    const popover = container.querySelector('[popover]')
    expect(trigger.getAttribute('data-slot')).toBe('card-info')
    expect(trigger.getAttribute('type')).toBe('button')
    expect(popover?.id).not.toBe('')
    expect(trigger.getAttribute('popovertarget')).toBe(popover?.id ?? null)
    expect(popover?.getAttribute('popover')).toBe('auto')
    expect(popover?.textContent).toBe('Merged PRs.')
  })

  test('no info, no glyph', () => {
    const { container } = render(<CardBand title="Shipped" />)
    expect(container.querySelector('[data-slot="card-info"]')).toBeNull()
  })

  test('Inset takes the inset surface role', () => {
    const { container } = render(<Inset>x</Inset>)
    expect(container.firstElementChild?.getAttribute('data-surface')).toBe('inset')
  })
})
