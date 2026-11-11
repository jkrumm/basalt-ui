/**
 * Ported from the 2.x `tooltip-settle.test.ts` (S3): the card portal places a tooltip inside the
 * nearest `[data-slot=card]` on both axes, clear of the first point's tick labels, and writes its
 * position only when it moves (invariant 29). Geometry is the layout suite's; here the rects are
 * stubs. Not ported, because the mechanism they pinned is deleted (concept section 11): the
 * widen-to-card `maxWidth` cases and the `data-basalt-facts` header floor; the v3 card band sits
 * outside the chart box, so the plot fence covers it.
 */
import { describe, expect, test } from 'bun:test'
import type { ChartTooltipPortalPositionContext } from '@tanstack/charts/tooltip/portal'
import { cardPortal } from './portal'
import type { TipMode } from './portal'

const rect = (left: number, top: number, width: number, height: number): DOMRect =>
  ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect

function setup(opts: { hidden?: boolean; height?: number; mode?: TipMode } = {}) {
  const card = document.createElement('div')
  card.setAttribute('data-slot', 'card')
  card.getBoundingClientRect = () => rect(0, 100, 400, 300)
  const host = document.createElement('div')
  const tip = document.createElement('div')
  Object.defineProperty(tip, 'offsetWidth', { value: 120 })
  Object.defineProperty(tip, 'offsetHeight', { value: opts.height ?? 60 })
  const surface = document.createElement('div')
  surface.getBoundingClientRect = () => rect(0, 100, 400, 200)
  host.append(surface)
  card.append(host)
  document.body.append(card)
  const scheduled = { count: 0 }
  const portal = cardPortal(opts.mode).create(
    { container: host, element: tip, schedulePosition: () => (scheduled.count += 1) },
    {},
  )
  if (opts.hidden) tip.hidden = true
  const ctx = {
    scene: { width: 400, height: 200, margin: { top: 20, right: 10, bottom: 30, left: 40 } },
    surface: { element: surface },
    anchor: { x: 200, y: 20 },
    offset: 10,
  } as unknown as ChartTooltipPortalPositionContext
  const writes = new MutationObserver(() => {})
  writes.observe(tip, { attributes: true, attributeFilter: ['style'] })
  const at = (x: number, y: number): ChartTooltipPortalPositionContext => ({
    ...ctx,
    anchor: { x, y },
  })
  return { card, tip, ctx, at, writes, portal, scheduled }
}

const left = (tip: HTMLElement): number => Number.parseFloat(tip.style.left)
const top = (tip: HTMLElement): number => Number.parseFloat(tip.style.top)

describe('cardPortal', () => {
  test('a second placement writes nothing', () => {
    const { tip, ctx, writes, portal } = setup()
    expect(portal.position(ctx)).toBe(true)
    writes.takeRecords()
    const before = tip.style.cssText
    portal.position(ctx)
    expect(writes.takeRecords()).toHaveLength(0)
    expect(tip.style.cssText).toBe(before)
    // The anchor sits 20px under the card top: 60px of tooltip do not fit above it, so it flips to
    // the other side, `offset` below the anchor (card top 100 + anchor 20 + gap 10).
    expect(tip.dataset['placement']).toBe('bottom')
    expect(top(tip)).toBe(130)
  })

  test('a first-point tooltip keeps clear of the y tick labels and the x ticks', () => {
    const { tip, at, portal } = setup()
    // The anchor sits on the plot's left edge (x 40) at its bottom (y 170): centred it would cover the
    // 40px y-label margin; below the anchor it would cover the 30px x-tick margin.
    portal.position(at(40, 170))
    expect(left(tip)).toBeGreaterThanOrEqual(40)
    // plot bottom = surface top 100 + 200 - 30 = 270; the tooltip is 60 tall.
    expect(top(tip) + 60).toBeLessThanOrEqual(270)
  })

  test('a last-point tooltip stays inside the card on both axes', () => {
    const { tip, at, portal } = setup()
    portal.position(at(390, 20))
    expect(left(tip)).toBeGreaterThanOrEqual(0)
    expect(left(tip) + 120).toBeLessThanOrEqual(400)
    expect(top(tip)).toBeGreaterThanOrEqual(100)
    expect(top(tip) + 60).toBeLessThanOrEqual(400)
  })

  test('a tooltip taller than the plot still keeps its left edge off the y tick labels', () => {
    // 180px tall against a 150px plot: no vertical fence, but the width fits, so the y labels stay clear.
    const { tip, at, portal } = setup({ height: 180 })
    portal.position(at(40, 100))
    expect(left(tip)).toBeGreaterThanOrEqual(40)
    expect(top(tip)).toBeGreaterThanOrEqual(100)
    expect(top(tip) + 180).toBeLessThanOrEqual(400)
  })

  test('an unmeasured tooltip is not written', () => {
    const { tip, ctx, writes, portal } = setup({ height: 0 })
    portal.position(ctx)
    expect(writes.takeRecords()).toHaveLength(0)
    expect(tip.style.left).toBe('')
    expect(tip.style.top).toBe('')
  })

  test('a shown tooltip asks the engine to place again on scroll; a hidden one does not', () => {
    const { tip, ctx, portal, scheduled } = setup()
    portal.position(ctx)
    window.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('resize'))
    expect(scheduled.count).toBe(2)
    portal.hide()
    expect(tip.hidden).toBe(true)
    window.dispatchEvent(new Event('scroll'))
    expect(scheduled.count).toBe(2)
  })

  test('a slot tooltip is the marked chip and stays above the anchor, never flipped below it', () => {
    const { tip, ctx, portal } = setup({ mode: 'slot' })
    expect(tip.dataset['basaltSlot']).toBe('')
    portal.position({ ...ctx, placement: ['top'], offset: 0 })
    expect(tip.dataset['placement']).toBe('top')
    // 120 - 60 is above the card top (100): held inside the card, not pushed below the anchor.
    expect(top(tip)).toBeGreaterThanOrEqual(100)
    expect(top(tip)).toBeLessThan(120)
  })

  test('a strip tooltip is held inside the card sideways only', () => {
    const { tip, at, portal } = setup({ mode: 'strip' })
    portal.position({ ...at(0, 20), placement: 'top' })
    expect(left(tip)).toBeGreaterThanOrEqual(0)
    // The vertical placement is the viewport's: above the card top is allowed.
    expect(tip.dataset['placement']).toBe('top')
    expect(top(tip)).toBeLessThan(100)
  })

  test('destroy detaches the element and its listeners', () => {
    const { tip, ctx, portal, scheduled } = setup()
    portal.position(ctx)
    portal.destroy()
    expect(tip.isConnected).toBe(false)
    window.dispatchEvent(new Event('scroll'))
    expect(scheduled.count).toBe(0)
  })
})
