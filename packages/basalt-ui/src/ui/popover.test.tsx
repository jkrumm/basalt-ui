import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { Popover, PopoverContent, PopoverTrigger, popoverParts } from './popover'

afterEach(cleanup)

const slots = (): string[] =>
  [...document.querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot') ?? '')

describe('popover module', () => {
  test('closed, it renders its trigger and no panel', () => {
    render(
      <Popover>
        <PopoverTrigger>Filters</PopoverTrigger>
        <PopoverContent aria-label="Filters">Body</PopoverContent>
      </Popover>,
    )
    expect(slots()).toEqual(['popover-trigger'])
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  test('open, the panel is portalled to the body, named, and on the z-50 positioner', () => {
    const { container } = render(
      <Popover defaultOpen>
        <PopoverTrigger>Filters</PopoverTrigger>
        <PopoverContent aria-label="Filters">Body</PopoverContent>
      </Popover>,
    )
    expect(container.querySelector('[data-slot="popover-content"]')).toBeNull()
    const panel = document.querySelector('[data-slot="popover-content"]')
    expect(panel?.getAttribute('aria-label')).toBe('Filters')
    expect(panel?.parentElement?.className).toContain('z-50')
    for (const slot of slots()) expect(popoverParts as readonly string[]).toContain(slot)
  })

  test('openOnHover is a trigger prop and a className on the panel is layout only', () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger openOnHover delay={100}>
          Details
        </PopoverTrigger>
        <PopoverContent aria-label="Details" className="w-96">
          Body
        </PopoverContent>
      </Popover>,
    )
    const panel = document.querySelector('[data-slot="popover-content"]')
    expect(panel?.className).toContain('w-96')
    expect(panel?.className).not.toContain('w-72')
  })
})
