/** `ChartPanes` (expression cycle 14 contract, Issue 2500): a pane group shares its box by weight. */
import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import type { Box } from '../../core/ports'
import { ChartPanes } from './chart-panes'

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

  test('outside a card a pixel box sets the group height', () => {
    const el = host(
      renderToString(
        <ChartPanes box={{ height: 320, phase: 'ready' }} panes={[{ chart: () => null }]} />,
      ),
    )
    expect(el.querySelector<HTMLElement>('[data-slot="chart-panes"]')?.style.height).toBe('320px')
  })
})
