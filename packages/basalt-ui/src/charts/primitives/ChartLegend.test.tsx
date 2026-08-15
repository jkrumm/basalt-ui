/**
 * `ChartLegend` — the `note` qualifier. Same SSR harness as `ChartFrame.test.tsx`:
 * `src/charts/**` is Mantine-free, so `renderToStaticMarkup` needs no provider wrapper.
 */
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChartLegend } from './ChartLegend'
import type { LegendEntry } from './ChartLegend'

const BASE: LegendEntry = { key: 'cloud-low', label: 'Low cloud', color: 'var(--vx-fill-1)' }

const render = (items: LegendEntry[]): string => renderToStaticMarkup(<ChartLegend items={items} />)

describe('ChartLegend note', () => {
  test('renders after the label when set', () => {
    const markup = render([{ ...BASE, note: '0% all night' }])
    expect(markup).toContain('Low cloud')
    expect(markup).toContain('0% all night')
  })

  test('is absent when unset', () => {
    expect(render([BASE])).not.toContain('<span style="opacity:0.75">')
  })

  test('an empty note renders no span (truthiness, not !== undefined)', () => {
    expect(render([{ ...BASE, note: '' }])).not.toContain('<span style="opacity:0.75">')
  })

  test('reaches the accessible name — the explicit aria-label would otherwise replace it', () => {
    const markup = render([{ ...BASE, note: '0% all night' }])
    expect(markup).toContain('aria-label="Low cloud — 0% all night"')
  })

  test('aria-label stays the bare label when there is no note', () => {
    expect(render([BASE])).toContain('aria-label="Low cloud"')
  })

  test('a folded companion carries its own note', () => {
    const markup = render([
      {
        ...BASE,
        children: [{ key: 'ma', label: '7d MA', color: 'var(--vx-fill-2)', note: 'est.' }],
      },
    ])
    expect(markup).toContain('7d MA')
    expect(markup).toContain('est.')
  })
})
