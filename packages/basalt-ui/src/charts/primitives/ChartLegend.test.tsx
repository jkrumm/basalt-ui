/**
 * `ChartLegend` — the `note` qualifier. Same SSR harness as `ChartFrame.test.tsx`:
 * `src/charts/**` is Mantine-free, so `renderToStaticMarkup` needs no provider wrapper.
 */
import { describe, expect, test } from 'bun:test'
import { fireEvent, render as renderDom, screen } from '@testing-library/react'
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

describe('ChartLegend strokeOpacity — the swatch cannot lie about a dimmed line', () => {
  test('a line swatch honors a fractional strokeOpacity', () => {
    const markup = render([{ ...BASE, shape: 'line', strokeOpacity: 0.4 }])
    expect(markup).toContain('stroke-opacity="0.4"')
  })

  test('defaults to full opacity when unset', () => {
    const markup = render([{ ...BASE, shape: 'line' }])
    expect(markup).toContain('stroke-opacity="1"')
  })

  test('a folded MA-companion child swatch honors it too', () => {
    const markup = render([
      {
        ...BASE,
        children: [
          {
            key: 'ma',
            label: '7d MA',
            color: 'var(--vx-fill-2)',
            shape: 'line',
            strokeOpacity: 0.4,
          },
        ],
      },
    ])
    expect(markup).toContain('stroke-opacity="0.4"')
  })
})

/**
 * The rollup is a DISCLOSURE, not a caption. A phone-tier cap of two left six of eight plotted
 * colours unnamed behind a `<span>` reading `+6 more` — a categorical encoding the chart draws and
 * then refuses to decode, with no way to reach the rest.
 */
describe('ChartLegend rollup — +N more expands', () => {
  const items: LegendEntry[] = ['a', 'b', 'c', 'd', 'e'].map((key) => ({
    key,
    label: `Series ${key}`,
    color: 'var(--vx-fill-1)',
  }))

  test('the chip is a button announcing its collapsed state', () => {
    const markup = renderToStaticMarkup(<ChartLegend items={items} maxRows={2} />)
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).toContain('+3 more')
  })

  test('clicking it reveals every entry, and the chip flips to a collapse', () => {
    renderDom(<ChartLegend items={items} maxRows={2} />)
    expect(screen.queryByRole('button', { name: 'Series e' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '+3 more' }))

    for (const item of items) {
      expect(screen.getByRole('button', { name: item.label })).not.toBeNull()
    }
    const chip = screen.getByRole('button', { name: 'Show less' })
    expect(chip.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(chip)
    expect(screen.queryByRole('button', { name: 'Series e' })).toBeNull()
  })

  test('a legend that already fits renders no chip at all', () => {
    const markup = renderToStaticMarkup(<ChartLegend items={items} maxRows={5} />)
    expect(markup).not.toContain('more')
    expect(markup).not.toContain('aria-expanded')
  })
})
