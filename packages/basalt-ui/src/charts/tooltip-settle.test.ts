/**
 * Wave 39: `settleInCard` writes a tooltip's position only when it moves (a write re-runs the settle,
 * so an unconditional one loops) and leaves a hidden or unmeasured tooltip alone. Geometry is the
 * layout suite's; here the rects are stubs.
 */
import { describe, expect, test } from 'bun:test'
import type { ChartTooltipPortalPositionContext } from '@tanstack/charts/tooltip/portal'
import { settleInCard } from './compile'

const rect = (left: number, top: number, width: number, height: number): DOMRect =>
  ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect

function setup(opts: { hidden?: boolean; height?: number } = {}) {
  const card = document.createElement('div')
  card.setAttribute('data-basalt-chart-card', '')
  card.getBoundingClientRect = () => rect(0, 100, 400, 300)
  const tip = document.createElement('div')
  tip.hidden = opts.hidden ?? false
  tip.style.left = '10px'
  tip.style.top = '90px'
  tip.dataset['placement'] = 'top'
  Object.defineProperty(tip, 'offsetWidth', { value: 120 })
  Object.defineProperty(tip, 'offsetHeight', { value: opts.height ?? 60 })
  const surface = document.createElement('div')
  surface.getBoundingClientRect = () => rect(0, 100, 400, 200)
  card.append(surface)
  document.body.append(card)
  const ctx = {
    scene: { width: 400, height: 200, margin: { top: 20, right: 10, bottom: 30, left: 40 } },
    surface: { element: surface },
    anchor: { x: 200, y: 20 },
    offset: 10,
  } as unknown as ChartTooltipPortalPositionContext
  const writes = new MutationObserver(() => {})
  writes.observe(tip, { attributes: true, attributeFilter: ['style'] })
  return { card, tip, ctx, writes }
}

describe('settleInCard', () => {
  test('a second settle writes nothing', () => {
    const { card, tip, ctx, writes } = setup()
    settleInCard(tip, card, ctx)
    writes.takeRecords()
    const before = tip.style.cssText
    settleInCard(tip, card, ctx)
    expect(writes.takeRecords()).toHaveLength(0)
    expect(tip.style.cssText).toBe(before)
    // The anchor sits 20px under the card top: 60px of tooltip do not fit above it, so it flips to
    // the other side, `offset` below the anchor (card top 100 + anchor 20 + gap 10).
    expect(tip.dataset['placement']).toBe('bottom')
    expect(Number.parseFloat(tip.style.top)).toBe(130)
    // A 400px card: the tooltip grows to its content, capped at the card's width less the air.
    expect(tip.style.maxWidth).toBe('392px')
    expect(tip.style.width).toBe('max-content')
  })

  test('a first-point tooltip keeps clear of the y tick labels and the x ticks', () => {
    const { card, tip, ctx } = setup()
    // The anchor sits on the plot's left edge (x 40) at its bottom (y 170): centred it would cover the
    // 40px y-label margin; below the anchor it would cover the 30px x-tick margin.
    ;(ctx as { anchor: { x: number; y: number } }).anchor = { x: 40, y: 170 }
    tip.dataset['placement'] = 'bottom'
    settleInCard(tip, card, ctx)
    expect(Number.parseFloat(tip.style.left)).toBeGreaterThanOrEqual(40)
    // plot bottom = surface top 100 + 200 - 30 = 270; the tooltip is 60 tall.
    expect(Number.parseFloat(tip.style.top) + 60).toBeLessThanOrEqual(270)
  })

  test('a tooltip taller than the plot still keeps its left edge off the y tick labels', () => {
    // 180px tall against a 150px plot: no vertical fence, but the width fits, so the y labels stay clear.
    const { card, tip, ctx } = setup({ height: 180 })
    ;(ctx as { anchor: { x: number; y: number } }).anchor = { x: 40, y: 100 }
    settleInCard(tip, card, ctx)
    expect(Number.parseFloat(tip.style.left)).toBeGreaterThanOrEqual(40)
  })

  test('a hidden tooltip is not written', () => {
    const { card, tip, ctx, writes } = setup({ hidden: true })
    const before = tip.style.cssText
    settleInCard(tip, card, ctx)
    expect(writes.takeRecords()).toHaveLength(0)
    expect(tip.style.cssText).toBe(before)
  })

  test('an unmeasured tooltip is not written', () => {
    const { card, tip, ctx, writes } = setup({ height: 0 })
    const before = tip.style.cssText
    settleInCard(tip, card, ctx)
    expect(writes.takeRecords()).toHaveLength(0)
    expect(tip.style.cssText).toBe(before)
  })

  test("a card that shrinks under a widened tooltip gives the engine's width and cap back", () => {
    const { card, tip, ctx } = setup()
    tip.style.maxWidth = 'min(24rem, 80%)'
    settleInCard(tip, card, ctx)
    expect(tip.style.width).toBe('max-content')
    card.getBoundingClientRect = () => rect(0, 100, 150, 300)
    settleInCard(tip, card, ctx)
    expect(tip.style.width).toBe('')
    expect(tip.style.maxWidth).toBe('min(24rem, 80%)')
  })

  test('a slot tooltip stays flush above the anchor, never flipped below it', () => {
    const { card, tip, ctx } = setup()
    settleInCard(tip, card, ctx, 'slot')
    expect(tip.dataset['placement']).toBe('top')
    // 120 - 10 - 60 is above the card top (100): held at the card's top, not pushed below the anchor.
    expect(Number.parseFloat(tip.style.top)).toBe(100)
  })

  test('a BandStrip tooltip is clamped sideways only: no flip, no width change, as on master', () => {
    const { card, tip, ctx } = setup()
    tip.style.left = '-30px'
    settleInCard(tip, card, ctx, 'strip')
    expect(Number.parseFloat(tip.style.left)).toBe(4)
    // The vertical placement (90, above the card top at 100) and the width are the engine's.
    expect(tip.style.top).toBe('90px')
    expect(tip.dataset['placement']).toBe('top')
    expect(tip.style.maxWidth).toBe('')
    expect(tip.style.width).toBe('')
  })
  test('a card with facts keeps the tooltip below its header while the plot area holds it', () => {
    const { card, tip, ctx } = setup({ height: 60 })
    const header = document.createElement('div')
    header.getBoundingClientRect = () => rect(0, 100, 400, 50)
    const facts = document.createElement('div')
    facts.setAttribute('data-basalt-facts', '')
    header.append(facts)
    card.append(header)
    // The anchor sits 20px under the card top, inside the header: above fits nowhere, below starts
    // at 130, which is under the header's bottom (150) less the air: it is pushed to 154.
    settleInCard(tip, card, ctx)
    expect(Number.parseFloat(tip.style.top)).toBe(154)
    // A plot area too short to hold it falls back to the card clamp.
    const short = setup({ height: 160 })
    const h2 = document.createElement('div')
    h2.getBoundingClientRect = () => rect(0, 100, 400, 150)
    const f2 = document.createElement('div')
    f2.setAttribute('data-basalt-facts', '')
    h2.append(f2)
    short.card.append(h2)
    settleInCard(short.tip, short.card, short.ctx)
    // Header floor (254) is past the last fit (236): the card clamp stands, `offset` below the anchor.
    expect(Number.parseFloat(short.tip.style.top)).toBe(130)
  })
  test('a card header without facts leaves the card clamp alone', () => {
    const { card, tip, ctx } = setup({ height: 60 })
    const header = document.createElement('div')
    header.getBoundingClientRect = () => rect(0, 100, 400, 50)
    card.append(header)
    settleInCard(tip, card, ctx)
    expect(Number.parseFloat(tip.style.top)).toBe(130)
  })
})
