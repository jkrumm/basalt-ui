/**
 * `ChartLegend` — the `note` qualifier. Same SSR harness as `ChartFrame.test.tsx`:
 * `src/charts/**` is Mantine-free, so `renderToStaticMarkup` needs no provider wrapper.
 */
import { describe, expect, test } from 'bun:test'
import { fireEvent, render as renderDom, screen, within } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { VX } from '../../tokens'
import { ChartLegend } from './ChartLegend'
import { LEGEND_ROW_GAP } from './chart-frame-layout'
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
 * The rollup is a DISCLOSURE, not a caption: an `All N` chip opens every entry (toggles included)
 * in a popover on a fine pointer — a bottom sheet on a coarse one — without touching the band.
 */
describe('ChartLegend rollup — All N discloses', () => {
  const items: LegendEntry[] = ['a', 'b', 'c', 'd', 'e'].map((key) => ({
    key,
    label: `Series ${key}`,
    color: 'var(--vx-fill-1)',
  }))

  test('the chip is a button announcing its collapsed state and the full count', () => {
    const markup = renderToStaticMarkup(<ChartLegend items={items} maxRows={2} />)
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).toContain('All 5')
    expect(markup).not.toContain('more')
  })

  test('clicking it opens a popover with every entry; the band keeps its two', () => {
    const { container } = renderDom(<ChartLegend items={items} maxRows={2} />)
    expect(screen.queryByRole('button', { name: 'Series e' })).toBeNull()

    const chip = screen.getByRole('button', { name: 'All 5' })
    fireEvent.click(chip)

    const panel = screen.getByRole('dialog', { name: 'Legend' })
    expect(panel.getAttribute('data-basalt-legend-disclosure')).toBe('popover')
    for (const item of items) {
      expect(within(panel).getByRole('button', { name: item.label })).not.toBeNull()
    }
    expect(container.querySelectorAll('[data-legend-key]')).toHaveLength(2)
    expect(chip.getAttribute('aria-expanded')).toBe('true')
  })

  test('every disclosed entry keeps its toggle', () => {
    const toggled: string[] = []
    renderDom(<ChartLegend items={items} maxRows={2} onToggle={(key) => toggled.push(key)} />)
    fireEvent.click(screen.getByRole('button', { name: 'All 5' }))
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Legend' })).getByRole('button', {
        name: 'Series e',
      }),
    )
    expect(toggled).toEqual(['e'])
  })

  test('Escape and an outside press both close it', () => {
    renderDom(<ChartLegend items={items} maxRows={2} />)
    const chip = screen.getByRole('button', { name: 'All 5' })
    fireEvent.click(chip)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(chip)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('a legend that already fits renders no chip at all', () => {
    const markup = renderToStaticMarkup(<ChartLegend items={items} maxRows={5} />)
    expect(markup).not.toContain('All ')
    expect(markup).not.toContain('aria-expanded')
  })

  test('with no cap every entry renders — the tier no longer rolls a legend up by default', () => {
    expect(renderToStaticMarkup(<ChartLegend items={items} />)).not.toContain('All ')
  })
})

describe('ChartLegend disclosure — accessibility', () => {
  const items: LegendEntry[] = ['a', 'b', 'c', 'd', 'e'].map((key) => ({
    key,
    label: `Series ${key}`,
    color: 'var(--vx-fill-1)',
  }))
  const open = (extra: Partial<Parameters<typeof ChartLegend>[0]> = {}) => {
    const utils = renderDom(<ChartLegend items={items} maxRows={2} {...extra} />)
    const chip = screen.getByRole('button', { name: 'All 5' })
    fireEvent.click(chip)
    return { ...utils, chip, panel: screen.getByRole('dialog', { name: 'Legend' }) }
  }

  test('opening focuses the panel, and the chip controls it', () => {
    const { chip, panel } = open()
    expect(document.activeElement).toBe(panel)
    expect(panel.id).not.toBe('')
    expect(chip.getAttribute('aria-controls')).toBe(panel.id)
  })

  test('focus returns to the chip on Escape, an outside press and the chip toggle', () => {
    const { chip } = open()
    const focused = () => document.activeElement === chip
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(focused()).toBe(true)
    ;(document.activeElement as HTMLElement).blur()

    fireEvent.click(chip)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(focused()).toBe(true)
    ;(document.activeElement as HTMLElement).blur()

    fireEvent.click(chip)
    fireEvent.click(chip)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(focused()).toBe(true)
  })

  test('a scroll outside the panel or a resize closes it; the panel scrolling does not', () => {
    const { panel } = open()
    fireEvent.scroll(panel)
    expect(screen.queryByRole('dialog')).not.toBeNull()
    fireEvent.scroll(document.body)
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'All 5' }))
    fireEvent(window, new Event('resize'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('the panel copy has its own clipPath ids and no duplicate legend keys', () => {
    const split = items.map((item) => ({
      ...item,
      shape: 'split' as const,
      secondColor: 'var(--vx-fill-2)',
    }))
    renderDom(<ChartLegend items={split} maxRows={2} chartId="c" />)
    fireEvent.click(screen.getByRole('button', { name: 'All 5' }))
    const ids = [...document.querySelectorAll('clipPath')].map((node) => node.id)
    expect(ids.length).toBe(new Set(ids).size)
    expect(ids.some((id) => id.includes('c-disclosure-'))).toBe(true)
    expect(document.querySelectorAll('[data-legend-key="a"]')).toHaveLength(1)
  })

  test('a coarse sheet is modal; a popover is not', () => {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: query === '(pointer: coarse)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia
    try {
      const { panel } = open()
      expect(panel.getAttribute('data-basalt-legend-disclosure')).toBe('sheet')
      expect(panel.getAttribute('aria-modal')).toBe('true')
    } finally {
      window.matchMedia = original
    }
  })

  test('a fine-pointer popover carries no aria-modal', () => {
    const { panel } = open()
    expect(panel.getAttribute('aria-modal')).toBeNull()
  })
})

describe('ChartLegend layout — left-aligned, tight row gap', () => {
  const items: LegendEntry[] = [BASE, { ...BASE, key: 'b', label: 'B' }]

  test('top/bottom placement is flex-start, not centred', () => {
    const { container } = renderDom(<ChartLegend items={items} />)
    expect((container.firstElementChild as HTMLElement).style.justifyContent).toBe('flex-start')
  })

  test('the row gap is the 4-6px band; the entry gap stays VX.legendGap', () => {
    const { container } = renderDom(<ChartLegend items={items} />)
    const style = (container.firstElementChild as HTMLElement).style
    expect(LEGEND_ROW_GAP).toBeGreaterThanOrEqual(4)
    expect(LEGEND_ROW_GAP).toBeLessThanOrEqual(6)
    expect(style.rowGap).toBe(`${LEGEND_ROW_GAP}px`)
    expect(style.columnGap).toBe(`${VX.legendGap}px`)
  })
})
