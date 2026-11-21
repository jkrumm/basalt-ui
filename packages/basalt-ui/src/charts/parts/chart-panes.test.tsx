/**
 * `ChartPanes` (expression cycle 14 contract, Issue 2500): a pane group shares its box by weight.
 * Expression cycle 17 (Issue 2717): above a 160 px floor each, and the group grows to hold the floors.
 */
import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import type { Box } from '../../core/ports'
import { ChartPanes, paneHeights, panesFloorCss, panesFloorPx } from './chart-panes'

const host = (markup: string): HTMLElement => {
  const el = document.createElement('div')
  el.innerHTML = markup
  return el
}

describe('ChartPanes', () => {
  test('each pane takes its weight as its share, an absent weight is 1, a bad one none', () => {
    const el = host(
      renderToString(
        <ChartPanes
          box={{ height: 'fill', phase: 'ready' }}
          panes={[
            { weight: 3, chart: () => <svg /> },
            { chart: () => <svg /> },
            { weight: -1, chart: () => <svg /> },
          ]}
        />,
      ),
    )
    const panes = [...el.querySelectorAll<HTMLElement>('[data-slot="chart-pane"]')]
    expect(panes.map((p) => p.style.flexGrow)).toEqual(['3', '1', '0'])
    expect(el.querySelector('[data-slot="chart-panes"]')?.className).toContain('h-full')
  })

  test('every pane is called with a fill box in the phase of the group', () => {
    const seen: Box[] = []
    renderToString(
      <ChartPanes
        box={{ height: 'fill', phase: 'stale' }}
        panes={[
          { chart: (box) => (seen.push(box), null) },
          { chart: (box) => (seen.push(box), null) },
        ]}
      />,
    )
    expect(seen).toEqual([
      { height: 'fill', phase: 'stale' },
      { height: 'fill', phase: 'stale' },
    ])
  })

  test('the floor of n panes is n times 160 px with 4 px gaps, in px and in rem', () => {
    expect([0, 1, 2, 5].map(panesFloorPx)).toEqual([0, 160, 324, 816])
    expect([0, 1, 2, 5].map(panesFloorCss)).toEqual(['0rem', '10rem', '20.25rem', '51rem'])
  })

  test('five equal panes in a 288 px box are held at the floor and the group grows', () => {
    expect(paneHeights(288, [1, 1, 1, 1, 1])).toEqual([160, 160, 160, 160, 160])
  })

  test('a pane under the floor is held there, the rest split what is left by weight', () => {
    // n84 at 390: 3:2 of 284 px would leave the daily pane 114 px.
    expect(paneHeights(288, [3, 2])).toEqual([160, 160])
    // 3:1:1 of 600 px: the two light panes fall to 118 px, are held, the heavy one takes 272.
    expect(paneHeights(600, [3, 1, 1])).toEqual([272, 160, 160])
  })

  test('above the floors the weight split is unchanged', () => {
    const [a, b] = paneHeights(420, [3, 2])
    expect(a).toBeCloseTo(249.6, 5)
    expect(b).toBeCloseTo(166.4, 5)
  })

  test('outside a card a pixel box sets the group height, never under its floors', () => {
    const tall = host(
      renderToString(
        <ChartPanes
          box={{ height: 200, phase: 'ready' }}
          panes={[{ chart: () => null }, { chart: () => null }]}
        />,
      ),
    )
    expect(tall.querySelector<HTMLElement>('[data-slot="chart-panes"]')?.style.height).toBe('324px')
  })

  test('outside a card a pixel box sets the group height', () => {
    const el = host(
      renderToString(
        <ChartPanes box={{ height: 320, phase: 'ready' }} panes={[{ chart: () => null }]} />,
      ),
    )
    expect(el.querySelector<HTMLElement>('[data-slot="chart-panes"]')?.style.height).toBe('320px')
  })
})
