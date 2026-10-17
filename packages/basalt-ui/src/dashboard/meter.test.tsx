import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

  test('non-zero min: fill, target and marker are normalised against min', () => {
    const bar = mount({ label: 'B', value: 30, min: 10, max: 50, target: 20 })
    expect((bar.container.querySelector('[data-meter-fill]') as HTMLElement).style.width).toBe(
      '50%',
    )
    expect(tick(bar.container, 'target')?.style.insetInlineStart).toBe('25%')
    cleanup()
    const zoned = mount({
      label: 'B',
      value: 30,
      min: 10,
      max: 50,
      zones: [{ from: 10, to: 50, label: 'All' }],
    })
    expect(tick(zoned.container, 'marker')?.style.insetInlineStart).toBe('50%')
  })

  test('segments honour min and stop at the track end', () => {
    const { container } = mount({
      label: 'S',
      min: 10,
      max: 50,
      segments: [
        { value: 30, label: 'a' },
        { value: 30, label: 'b' },
      ],
    })
    const widths = [...container.querySelectorAll<HTMLElement>('[data-meter-fill]')].map(
      (f) => f.style.width,
    )
    expect(widths).toEqual(['75%', '25%'])
    expect(meter(container).getAttribute('aria-valuenow')).toBe('50')
  })

  test('a value below min clamps to an empty fill and aria-valuenow = min', () => {
    const { container } = mount({ label: 'B', value: -5, min: 0, max: 10 })
    expect((container.querySelector('[data-meter-fill]') as HTMLElement).style.width).toBe('0%')
    expect(meter(container).getAttribute('aria-valuenow')).toBe('0')
  })

  test('a forecast in first position names the forecast without a boundary tick', () => {
    const { container, getByText } = mount({
      label: 'S',
      segments: [{ value: 30, label: 'Plan', forecast: true }],
    })
    expect(getByText('Forecast: Plan 30')).toBeTruthy()
    expect(tick(container, 'boundary')).toBeNull()
  })

  test('two forecasts share one caption', () => {
    const { getByText } = mount({
      label: 'S',
      segments: [
        { value: 10, label: 'Done' },
        { value: 10, label: 'A', forecast: true },
        { value: 10, label: 'B', forecast: true },
      ],
    })
    expect(getByText('Forecast: A 10, B 10')).toBeTruthy()
  })

  test('captions: null drops, a node overrides', () => {
    const none = mount({ label: 'B', value: 5, target: 8, startCaption: null, endCaption: null })
    expect(none.container.querySelector('[data-meter-captions]')).toBeNull()
    expect(none.queryByText('5')).toBeNull()
    cleanup()
    const custom = mount({ label: 'B', value: 5, startCaption: 'five', endCaption: 'ten' })
    expect(custom.getByText('five')).toBeTruthy()
    expect(custom.getByText('ten')).toBeTruthy()
  })

  test('a non-finite reading is the empty state', () => {
    const { container, getByText } = mount({ label: 'B', value: Number.NaN })
    expect(meter(container)).toBeNull()
    expect(getByText('No data')).toBeTruthy()
  })

  test('ring: empty, loading and verdict colour', () => {
    const empty = mount({ label: 'R', shape: 'ring', value: null })
    expect(meter(empty.container)).toBeNull()
    expect(empty.container.querySelector('svg')).not.toBeNull()
    cleanup()
    const loading = mount({ label: 'R', shape: 'ring', loading: true })
    expect(loading.container.querySelector('[aria-busy]')).not.toBeNull()
    expect(loading.container.querySelector('svg')).toBeNull()
    cleanup()
    const coloured = mount({ label: 'R', shape: 'ring', value: 50, color: 'var(--vx-status-bad)' })
    const arc = coloured.container.querySelectorAll('circle')[1] as unknown as SVGElement
    expect(arc.style.stroke).toBe('var(--vx-status-bad)')
  })

  test('zones: a zone colour overrides the neutral strength; a value below the first zone is bare', () => {
    const { container, getByText } = mount({
      label: 'Z',
      max: 100,
      value: 5,
      zones: [
        { from: 20, to: 60, label: 'Mid', color: 'var(--vx-status-good)' },
        { from: 60, to: 100, label: 'Top' },
      ],
    })
    const mid = container.querySelector('[data-meter-zone="Mid"]') as HTMLElement
    expect(mid.style.background).toBe('var(--vx-status-good)')
    expect(mid.style.insetInlineStart).toBe('20%')
    expect(mid.style.width).toBe('40%')
    expect(getByText('5')).toBeTruthy()
  })

  test('negative segments draw nothing and never lower the reading below min', () => {
    const { container } = mount({
      label: 'S',
      max: 100,
      segments: [
        { value: -20, label: 'a' },
        { value: 30, label: 'b' },
      ],
    })
    const widths = [...container.querySelectorAll<HTMLElement>('[data-meter-fill]')].map(
      (f) => f.style.width,
    )
    expect(widths).toEqual(['0%', '30%'])
    expect(meter(container).getAttribute('aria-valuenow')).toBe('30')
  })

  test('empty segments render the empty state', () => {
    const { container, getByText } = mount({ label: 'S', segments: [] })
    expect(meter(container)).toBeNull()
    expect(getByText('No data')).toBeTruthy()
  })

  test('a non-finite target draws no tick and no caption', () => {
    const { container, queryByText } = mount({ label: 'B', value: 5, target: Number.NaN })
    expect(tick(container, 'target')).toBeNull()
    expect(queryByText(/Target/)).toBeNull()
  })

  test('the empty state carries the label, ring too', () => {
    const bar = mount({ label: 'Readiness', value: null })
    expect(bar.container.querySelector('output')?.getAttribute('aria-label')).toBe('Readiness')
    cleanup()
    const ring = mount({ label: 'Hit rate', shape: 'ring', value: null })
    expect(ring.container.querySelector('output')?.getAttribute('aria-label')).toBe('Hit rate')
  })

  test('a forecast segment ignores its colour', () => {
    const { container } = mount({
      label: 'S',
      segments: [{ value: 10, label: 'f', forecast: true, color: 'red' }],
    })
    expect((container.querySelector('[data-meter-fill]') as HTMLElement).style.background).toBe('')
  })

  test('adjacent zone bands leave a 1px gap', () => {
    const { container } = mount({
      label: 'Z',
      value: 10,
      zones: [
        { from: 0, to: 50, label: 'A' },
        { from: 50, to: 100, label: 'B' },
      ],
    })
    const b = container.querySelector('[data-meter-zone="B"]') as HTMLElement
    expect(b.style.insetInlineStart).toBe('calc(50% + 1px)')
    expect(b.style.width).toBe('calc(50% - 1px)')
  })

  test('mixing reading forms is a compile error', () => {
    // @ts-expect-error a ring takes a value alone
    const ringSegments: MeterProps = { label: 'R', shape: 'ring', segments: [] }
    // @ts-expect-error segments and zones are different forms
    const both: MeterProps = { label: 'B', segments: [], zones: [] }
    // @ts-expect-error segments carry the reading; a value beside them is ambiguous
    const valueSegments: MeterProps = { label: 'B', value: 1, segments: [] }
    expect([ringSegments, both, valueSegments].length).toBe(3)
  })
})

describe('Meter — round-1 board fixes', () => {
  const css = readFileSync(resolve(import.meta.dirname, 'meter.module.css'), 'utf8')
  const rule = (selector: string) =>
    css.match(new RegExp(`${selector.replace('.', '\\.')} \\{([^}]*)\\}`))?.[1] ?? ''

  test('categorical segments caption every part, in order: swatch + name + value', () => {
    const { container } = mount({
      label: 'Spend',
      max: 100,
      format: (v) => `€${v}`,
      segments: [
        { value: 40, label: 'Support', color: 'red' },
        { value: 20, label: 'Infra' },
      ],
    })
    const items = [...container.querySelectorAll('[data-meter-parts] li')]
    expect(items.map((li) => li.textContent)).toEqual(['Support €40', 'Infra €20'])
    for (const li of items) expect(li.querySelector('[aria-hidden]')).toBeTruthy()
    const swatch = items[0]?.querySelector('[aria-hidden]') as HTMLElement
    expect(swatch.style.background).toBe('red')
    // The default start caption is replaced, not duplicated.
    expect(container.querySelector('[data-meter-captions]')).toBeNull()
  })

  test('committed/forecast keeps its caption form and gets no part list', () => {
    const { container, getByText } = mount({
      label: 'C',
      segments: [
        { value: 60, label: 'Done' },
        { value: 20, label: 'Planned', forecast: true },
      ],
    })
    expect(container.querySelector('[data-meter-parts]')).toBeNull()
    expect(getByText('Forecast: Planned 20')).toBeTruthy()
    expect(getByText('80')).toBeTruthy()
  })

  test('marker and ticks take a § 5 radius step, not a literal', () => {
    for (const sel of ['.marker', '.tick'])
      expect(rule(sel)).toContain('border-radius: var(--vx-radius-fine)')
    expect(css).not.toMatch(/border-radius: \d+px/)
  })

  test('captions wrap and never truncate; the end caption stays end-aligned', () => {
    expect(rule('.captions')).toContain('flex-wrap: wrap')
    expect(rule('.caption')).not.toContain('nowrap')
    expect(rule('.caption')).not.toContain('ellipsis')
    expect(rule('.captionEnd')).toContain('margin-inline-start: auto')
  })

  test('the ring value and captions use type roles only (micro, sm, kpi)', () => {
    const sizes = new Set(css.match(/var\(--vx-text-[a-z]+\)/g))
    expect([...sizes].toSorted()).toEqual(
      ['var(--vx-text-kpi)', 'var(--vx-text-micro)', 'var(--vx-text-sm)'].toSorted(),
    )
  })

  test.each([
    ['bar', { label: 'L', value: 5 } as const],
    ['ring', { label: 'L', value: 5, shape: 'ring' } as const],
    ['empty', { label: 'L' } as const],
    ['loading', { label: 'L', loading: true } as const],
  ])('the %s root carries data-basalt-meter', (_, props) => {
    const { container } = mount(props)
    expect(container.querySelector('[data-basalt-meter]')).toBeTruthy()
  })
})
