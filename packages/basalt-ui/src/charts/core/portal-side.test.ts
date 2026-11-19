/**
 * The card portal keeps a tooltip's side for as long as it shows (owner review 2): the side it took
 * first is tried first at every later datum, so it changes only when that side would leave the plot,
 * and a hide lets the next showing pick afresh.
 */
import { describe, expect, test } from 'bun:test'
import type { ChartTooltipPortalPositionContext } from '@tanstack/charts/tooltip/portal'
import { cardPortal } from './portal'

const PLOT = { left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300, x: 0, y: 0 }

function mount(): {
  place: (y: number) => string | undefined
  hide: () => void
} {
  const container = document.createElement('div')
  document.body.append(container)
  const element = document.createElement('div')
  Object.defineProperty(element, 'offsetWidth', { value: 100 })
  Object.defineProperty(element, 'offsetHeight', { value: 40 })
  const surface = document.createElement('div')
  surface.getBoundingClientRect = () => ({ ...PLOT, toJSON: () => PLOT })
  container.append(surface)
  const host = cardPortal('card').create({ container, element, schedulePosition: () => {} }, {})
  const place = (y: number): string | undefined => {
    host.position({
      scene: { width: 400, height: 300, margin: { left: 0, top: 0, right: 0, bottom: 0 } },
      surface: { element: surface },
      anchor: { x: 200, y },
      placement: undefined,
      offset: 10,
    } as unknown as ChartTooltipPortalPositionContext)
    return element.dataset['placement']
  }
  return { place, hide: () => host.hide() }
}

describe('the card portal keeps a tooltip on one side', () => {
  test('a tooltip that had to open below stays below where above would fit again', () => {
    const tip = mount()
    expect(tip.place(150)).toBe('top')
    expect(tip.place(30)).toBe('bottom')
    expect(tip.place(150)).toBe('bottom')
    expect(tip.place(160)).toBe('bottom')
  })

  test('it changes side only when the kept side would leave the plot', () => {
    const tip = mount()
    expect(tip.place(30)).toBe('bottom')
    expect(tip.place(280)).toBe('top')
    expect(tip.place(150)).toBe('top')
  })

  test('a hide ends the showing: the next one picks afresh', () => {
    const tip = mount()
    expect(tip.place(30)).toBe('bottom')
    tip.hide()
    expect(tip.place(150)).toBe('top')
  })
})
