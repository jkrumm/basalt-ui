/** `Sparkline` `band`: a productive range behind the line, in the domain, never a series. */
import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Sparkline } from './Sparkline'
import type { SparklineProps } from './Sparkline'

const inol = [0.4, 0.5, 0.7, 0.9, 0.8, 0.95]
const BAND = { from: 0.6, to: 1 }
/** The server frame's plot height (viewBox px); a line's plot margin is 3px of it, a bar's none. */
const VIEW_H = 320
const LINE_INSET = 3

const render = (props: Partial<SparklineProps> = {}): HTMLElement => {
  const el = document.createElement('div')
  el.innerHTML = renderToString(
    <Sparkline ariaLabel="INOL" data={inol} height={28} band={BAND} {...props} />,
  )
  return el
}
const bandRect = (el: HTMLElement): Element | null => el.querySelector('rect[data-ts-key^="band"]')
const box = (r: Element | null) => ({
  x: Number(r?.getAttribute('x')),
  y: Number(r?.getAttribute('y')),
  w: Number(r?.getAttribute('width')),
  h: Number(r?.getAttribute('height')),
})
const viewWidth = (el: HTMLElement): number =>
  Number(el.querySelector('svg')?.getAttribute('viewBox')?.split(' ')[2])

describe('Sparkline band', () => {
  test('draws one tokenised neutral band, under the line', () => {
    const el = render()
    expect(el.querySelectorAll('rect[data-ts-key^="band"]').length).toBe(1)
    expect(bandRect(el)?.getAttribute('fill')).toContain('--vx-neutral')
    const keys = [...el.querySelectorAll('[data-ts-key]')].map((n) => n.getAttribute('data-ts-key'))
    expect(keys.findIndex((k) => k?.startsWith('band'))).toBeLessThan(
      keys.findIndex((k) => k?.startsWith('line')),
    )
  })

  test('is not a series: the line count and the markup outside the band are unchanged', () => {
    // A band inside the data extent leaves the domain, so every other mark is byte-identical.
    const withBand = render({ band: { from: 0.5, to: 0.9 } })
    const plain = render({ band: undefined })
    const strip = (el: HTMLElement): string => {
      el.querySelectorAll('[data-ts-key^="band"]').forEach((n) => n.remove())
      return el.innerHTML.replace(/\s+/g, ' ')
    }
    expect(withBand.querySelectorAll('[data-ts-key^="line"]').length).toBe(
      plain.querySelectorAll('[data-ts-key^="line"]').length,
    )
    // Same series, same aria, same hidden-from-AT paint: the band adds nothing else.
    expect(
      withBand.querySelector('[data-ts-key^="band"]')?.closest('[aria-hidden="true"]'),
    ).not.toBeNull()
    expect(strip(withBand)).toBe(strip(plain))
  })

  test('a line band spans the plot and sits strictly inside it, vertically', () => {
    const el = render()
    const b = box(bandRect(el))
    expect(b.x).toBe(LINE_INSET)
    expect(b.w).toBeCloseTo(viewWidth(el) - 2 * LINE_INSET, 1)
    expect(b.y).toBeGreaterThan(LINE_INSET)
    expect(b.y + b.h).toBeLessThan(VIEW_H - LINE_INSET)
  })

  test('a bar band covers the outer half-bars: the whole plot, edge to edge', () => {
    const el = render({ mark: 'bar' })
    const b = box(bandRect(el))
    expect(b.x).toBe(0)
    expect(b.w).toBeCloseTo(viewWidth(el), 1)
  })

  test('a band above the data grows the domain to hold it', () => {
    const el = render({ data: [0.1, 0.2, 0.15] })
    const b = box(bandRect(el))
    expect(b.y).toBeGreaterThan(LINE_INSET)
    expect(b.y + b.h).toBeLessThan(VIEW_H - LINE_INSET)
    // Domain 0.01..1.09 (data 0.1..1 with the band's 1, plus 10% air): 0.4 of 1.08 of the plot.
    expect(b.h).toBeCloseTo((0.4 / 1.08) * (VIEW_H - 2 * LINE_INSET), 1)
  })

  test('a band below the data grows the domain to hold it', () => {
    const el = render({ data: [1.4, 1.6, 1.5] })
    const b = box(bandRect(el))
    expect(b.y).toBeGreaterThan(LINE_INSET)
    expect(b.y + b.h).toBeLessThan(VIEW_H - LINE_INSET)
    // Domain 0.5..1.7 (the band's 0.6 below the data, plus 10% air): 0.4 of 1.2 of the plot.
    expect(b.h).toBeCloseTo((0.4 / 1.2) * (VIEW_H - 2 * LINE_INSET), 1)
  })

  test('reversed bounds draw the same band', () => {
    expect(bandRect(render({ band: { from: 1, to: 0.6 } }))?.outerHTML).toBe(
      bandRect(render())?.outerHTML,
    )
  })

  test('an empty range (from === to) draws nothing and leaves the domain alone', () => {
    const el = render({ band: { from: 2, to: 2 } })
    expect(bandRect(el)).toBeNull()
    // The line is where it is without a band: a stray 2 did not stretch the domain.
    expect(el.querySelector('path[d]')?.getAttribute('d')).toBe(
      render({ band: undefined }).querySelector('path[d]')?.getAttribute('d'),
    )
  })

  test('a NaN or infinite bound draws nothing and leaves the domain alone', () => {
    const plain = render({ band: undefined }).querySelector('path[d]')?.getAttribute('d')
    for (const band of [
      { from: Number.NaN, to: 1 },
      { from: 0.6, to: Number.POSITIVE_INFINITY },
    ]) {
      const el = render({ band })
      expect(bandRect(el)).toBeNull()
      expect(el.querySelector('path[d]')?.getAttribute('d')).toBe(plain)
    }
  })
})
