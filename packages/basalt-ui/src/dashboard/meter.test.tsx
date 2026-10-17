import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { Meter } from './meter'
import type { MeterProps } from './meter'

afterEach(cleanup)

function mount(props: MeterProps) {
  return render(
    <MantineProvider>
      <Meter {...props} />
    </MantineProvider>,
  )
}

const meter = (c: HTMLElement) => c.querySelector('[role="meter"]') as HTMLElement
const tick = (c: HTMLElement, kind: string) =>
  c.querySelector(`[data-meter-tick="${kind}"]`) as HTMLElement | null

describe('Meter', () => {
  test('exposes aria-valuenow/min/max and the label', () => {
    const { container } = mount({ label: 'Budget', value: 40, min: 10, max: 50 })
    const m = meter(container)
    expect(m.getAttribute('aria-label')).toBe('Budget')
    expect(m.getAttribute('aria-valuenow')).toBe('40')
    expect(m.getAttribute('aria-valuemin')).toBe('10')
    expect(m.getAttribute('aria-valuemax')).toBe('50')
  })

  test('lists segments in the aria-describedby text', () => {
    const { container } = mount({
      label: 'Course',
      max: 100,
      segments: [
        { value: 60, label: 'Done' },
        { value: 20, label: 'Planned', forecast: true },
      ],
    })
    const id = meter(container).getAttribute('aria-describedby') as string
    const text = container.querySelector(`[id="${id}"]`)?.textContent
    expect(text).toContain('Done 60')
    expect(text).toContain('Planned 20 (forecast)')
    expect(meter(container).getAttribute('aria-valuenow')).toBe('80')
  })

  test('names the forecast and ticks the committed/forecast boundary', () => {
    const { container, getByText } = mount({
      label: 'Course',
      segments: [
        { value: 60, label: 'Done' },
        { value: 20, label: 'Planned', forecast: true },
      ],
    })
    expect(tick(container, 'boundary')?.style.insetInlineStart).toBe('60%')
    expect(getByText('Forecast: Planned 20')).toBeTruthy()
  })

  test('places the target tick as a percent of the track and states it', () => {
    const { container, getAllByText } = mount({
      label: 'B',
      value: 20,
      min: 0,
      max: 200,
      target: 50,
    })
    expect(tick(container, 'target')?.style.insetInlineStart).toBe('25%')
    expect(getAllByText('Target 50').length).toBeGreaterThan(0)
  })

  test('renders no tick without a target', () => {
    const { container } = mount({ label: 'B', value: 20 })
    expect(tick(container, 'target')).toBeNull()
  })

  test('value 0 fills nothing, value max fills the track', () => {
    const zero = mount({ label: 'B', value: 0 })
    expect((zero.container.querySelector('[data-meter-fill]') as HTMLElement).style.width).toBe(
      '0%',
    )
    cleanup()
    const full = mount({ label: 'B', value: 100 })
    expect((full.container.querySelector('[data-meter-fill]') as HTMLElement).style.width).toBe(
      '100%',
    )
  })

  test('over-max clamps the fill and aria-valuenow, caption states the real value', () => {
    const { container, getByText } = mount({ label: 'B', value: 130, max: 100 })
    expect((container.querySelector('[data-meter-fill]') as HTMLElement).style.width).toBe('100%')
    expect(meter(container).getAttribute('aria-valuenow')).toBe('100')
    expect(getByText('130')).toBeTruthy()
  })

  test('a verdict colour paints the fill', () => {
    const { container } = mount({ label: 'B', value: 90, color: 'var(--vx-status-bad)' })
    expect((container.querySelector('[data-meter-fill]') as HTMLElement).style.background).toBe(
      'var(--vx-status-bad)',
    )
  })

  test('ring shows the formatted value centred', () => {
    const { container } = mount({ label: 'Hit', shape: 'ring', value: 87, format: (v) => `${v}%` })
    expect(meter(container).textContent).toBe('87%')
    expect(container.querySelector('svg')).not.toBeNull()
  })

  test('empty: no meter role, empty text, track kept', () => {
    const { container, getByText } = mount({ label: 'B', value: null, emptyText: 'Nothing yet' })
    expect(meter(container)).toBeNull()
    expect(getByText('Nothing yet')).toBeTruthy()
    expect(container.querySelector('[data-meter-track]')).not.toBeNull()
  })

  test('loading: skeleton, busy, no meter role', () => {
    const { container } = mount({ label: 'B', value: 5, loading: true })
    expect(meter(container)).toBeNull()
    expect(container.querySelector('[aria-busy]')?.getAttribute('aria-busy')).toBe('true')
  })

  describe('zones', () => {
    const zones = [
      { from: 0, to: 300, label: 'Low' },
      { from: 300, to: 750, label: 'Optimal' },
      { from: 750, to: 1000, label: 'High' },
    ]
    const base = { label: 'Training load', max: 1000, zones } as const

    test('names the zone that holds the value in the caption', () => {
      const { getByText } = mount({ ...base, value: 612 })
      expect(getByText('Optimal · 612')).toBeTruthy()
    })

    test('a value on a boundary belongs to the zone that starts there', () => {
      const { getByText } = mount({ ...base, value: 300 })
      expect(getByText('Optimal · 300')).toBeTruthy()
    })

    test('a value on the last zone end still belongs to it', () => {
      const { getByText } = mount({ ...base, value: 1000 })
      expect(getByText('High · 1000')).toBeTruthy()
    })

    test('draws bands and a marker at the value, no fill', () => {
      const { container } = mount({ ...base, value: 612 })
      expect(container.querySelectorAll('[data-meter-zone]').length).toBe(3)
      expect(container.querySelector('[data-meter-fill]')).toBeNull()
      expect(tick(container, 'marker')?.style.insetInlineStart).toBe('61.2%')
    })

    test('lists the zones and the holding one in the described-by text', () => {
      const { container } = mount({ ...base, value: 612 })
      const id = meter(container).getAttribute('aria-describedby') as string
      const text = container.querySelector(`[id="${id}"]`)?.textContent
      expect(text).toContain('Low 0 to 300')
      expect(text).toContain('612 is in Optimal')
    })

    test('a value outside every zone shows the bare value and says so', () => {
      const { container, getByText } = mount({
        ...base,
        value: 50,
        zones: [{ from: 100, to: 200, label: 'Only' }],
      })
      expect(getByText('50')).toBeTruthy()
      const id = meter(container).getAttribute('aria-describedby') as string
      expect(container.querySelector(`[id="${id}"]`)?.textContent).toContain(
        '50 is outside every zone',
      )
    })

    test('zones and a target tick coexist', () => {
      const { container, getAllByText } = mount({ ...base, value: 612, target: 500 })
      expect(tick(container, 'marker')).not.toBeNull()
      expect(tick(container, 'target')?.style.insetInlineStart).toBe('50%')
      expect(getAllByText(/Target 500/).length).toBeGreaterThan(0)
    })
  })

  test('over a target, the end caption states the overage', () => {
    const { getByText } = mount({ label: 'Spend', value: 512, max: 600, target: 450 })
    expect(getByText('Target 450 · 62 over')).toBeTruthy()
  })
})
