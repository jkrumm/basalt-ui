import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Separator, separatorParts } from './separator'

afterEach(cleanup)

describe('separator module', () => {
  test('renders with no provider; the part carries data-slot and separatorParts lists it', () => {
    const { container } = render(<Separator />)
    const slots = [...container.querySelectorAll('[data-slot]')].map((el) =>
      el.getAttribute('data-slot'),
    )
    expect(slots).toEqual([...separatorParts])
  })

  test('server render keeps the slot', () => {
    expect(renderToString(<Separator />)).toContain('data-slot="separator"')
  })

  test('is a separator role, horizontal by default, vertical on request', () => {
    const { container } = render(
      <>
        <Separator />
        <Separator orientation="vertical" />
      </>,
    )
    const [h, v] = [...container.querySelectorAll('[role="separator"]')] as HTMLElement[]
    expect(h?.getAttribute('aria-orientation')).toBe('horizontal')
    expect(h?.className).toContain('h-px')
    expect(v?.getAttribute('aria-orientation')).toBe('vertical')
    expect(v?.className).toContain('w-px')
  })

  test('draws the hairline token and takes layout classes', () => {
    const { container } = render(<Separator className="my-4" />)
    const el = container.firstElementChild as HTMLElement
    expect(el.className).toContain('bg-border')
    expect(el.className).toContain('my-4')
  })
})
