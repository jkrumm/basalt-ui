/** `Sparkline` `band`: a productive range behind the line, in the domain, never a series. */
import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Sparkline } from './Sparkline'

const inol = [0.4, 0.5, 0.7, 0.9, 0.8, 0.95]
const dom = (html: string): HTMLElement => {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}
const band = (html: string): Element | null => dom(html).querySelector('rect[data-ts-key^="band"]')

describe('Sparkline band', () => {
  test('draws one quiet band, tokenised, behind the line', () => {
    const html = renderToString(
      <Sparkline ariaLabel="INOL" data={inol} height={28} band={{ from: 0.6, to: 1 }} />,
    )
    const el = band(html)
    expect(el).not.toBeNull()
    expect(el?.outerHTML).toMatch(/--vx-muted/)
    expect(html.indexOf('data-ts-key="band')).toBeLessThan(html.indexOf('data-ts-key="line'))
  })

  test('is not a series: no legend, no tooltip row, no aria change', () => {
    const plain = renderToString(<Sparkline ariaLabel="INOL" data={inol} height={28} />)
    const html = renderToString(
      <Sparkline ariaLabel="INOL" data={inol} height={28} band={{ from: 0.6, to: 1 }} />,
    )
    expect(html).not.toContain('legend')
    expect(html).not.toContain('tooltip')
    expect(dom(html).querySelectorAll('[data-ts-key^="line"]').length).toBe(
      dom(plain).querySelectorAll('[data-ts-key^="line"]').length,
    )
  })

  test('a band above the data widens the domain so it is never clipped', () => {
    const html = renderToString(
      <Sparkline
        ariaLabel="INOL"
        data={[0.1, 0.2, 0.15]}
        height={28}
        band={{ from: 0.6, to: 1 }}
      />,
    )
    const el = band(html)
    const y = Number(el?.getAttribute('y'))
    const h = Number(el?.getAttribute('height'))
    expect(y).toBeGreaterThanOrEqual(0)
    expect(y + h).toBeLessThanOrEqual(320)
    // The band's top edge is the top of the domain plus its 10% air: the whole range fits.
    expect(h).toBeGreaterThan(0)
  })

  test('a band below the data widens the domain too', () => {
    const html = renderToString(
      <Sparkline ariaLabel="INOL" data={[1.4, 1.6, 1.5]} height={28} band={{ from: 0.6, to: 1 }} />,
    )
    const el = band(html)
    expect(Number(el?.getAttribute('y')) + Number(el?.getAttribute('height'))).toBeLessThanOrEqual(
      320,
    )
  })

  test('reversed bounds draw the same band', () => {
    const a = renderToString(
      <Sparkline ariaLabel="S" data={inol} height={28} band={{ from: 0.6, to: 1 }} />,
    )
    const b = renderToString(
      <Sparkline ariaLabel="S" data={inol} height={28} band={{ from: 1, to: 0.6 }} />,
    )
    expect(band(b)?.outerHTML).toBe(band(a)?.outerHTML)
  })

  test('a bar sparkline takes the band too', () => {
    const html = renderToString(
      <Sparkline ariaLabel="S" mark="bar" data={inol} height={28} band={{ from: 0.6, to: 1 }} />,
    )
    expect(band(html)).not.toBeNull()
  })
})
