import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { VX } from '../tokens'
import { Status, Swatch, statusParts } from './status'

afterEach(cleanup)

describe('status module', () => {
  test('every part carries data-slot and statusParts lists them', () => {
    const { container } = render(
      <>
        <Status>Idle</Status>
        <Swatch color={VX.good} />
      </>,
    )
    const slots = [...container.querySelectorAll('[data-slot]')].map((el) =>
      el.getAttribute('data-slot'),
    )
    expect(slots).toEqual([...statusParts])
  })

  test('server render keeps the slots', () => {
    expect(renderToString(<Status tone="good">Healthy</Status>)).toContain('data-slot="status"')
  })

  test('Status prints its word and tints the dot by tone', () => {
    const { getByText } = render(
      <>
        <Status tone="bad">Down</Status>
        <Status>Idle</Status>
      </>,
    )
    expect(getByText('Down').className).toContain('before:bg-bad')
    expect(getByText('Idle').className).toContain('before:bg-muted-foreground')
  })

  test('Swatch carries its colour as a variable and is hidden from assistive tech', () => {
    const { container } = render(<Swatch color={VX.good} />)
    const el = container.firstElementChild as HTMLElement
    expect(el.style.getPropertyValue('--swatch')).toBe('var(--vx-good)')
    expect(el.getAttribute('aria-hidden')).toBe('true')
  })
})
