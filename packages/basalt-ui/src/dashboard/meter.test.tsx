import { MantineProvider } from '@mantine/core'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
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

  test('empty: no meter role, the empty box with its text, no leftover track', () => {
    const { container, getByText } = mount({ label: 'B', value: null, emptyText: 'Nothing yet' })
    expect(meter(container)).toBeNull()
    expect(getByText('Nothing yet')).toBeTruthy()
    expect(container.querySelector('[data-meter-track]')).toBeNull()
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

    const holdingLabel = (container: HTMLElement) =>
      container.querySelector('[data-meter-zone-band] [data-holding]')?.textContent

    test('names every zone under its span and the holding one is marked', () => {
      const { container, getByText } = mount({ ...base, value: 612 })
      const labels = [
        ...container.querySelectorAll('[data-meter-zone-band] [data-meter-zone-label]'),
      ]
      expect(labels.map((l) => l.textContent)).toEqual(['Low', 'Optimal', 'High'])
      expect((labels[1] as HTMLElement).style.insetInlineStart).toBe('52.5%')
      expect(holdingLabel(container)).toBe('Optimal')
      // The zone is named on the band, so the caption is the bare reading.
      expect(getByText('612')).toBeTruthy()
    })

    test('a value on a boundary belongs to the zone that starts there', () => {
      expect(holdingLabel(mount({ ...base, value: 300 }).container)).toBe('Optimal')
    })

    test('a value on the last zone end still belongs to it', () => {
      expect(holdingLabel(mount({ ...base, value: 1000 }).container)).toBe('High')
    })

    test('a value outside every zone marks no zone', () => {
      const { container } = mount({
        ...base,
        value: 50,
        zones: [{ from: 100, to: 200, label: 'Only' }],
      })
      expect(container.querySelector('[data-holding]')).toBeNull()
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
    const { container } = mount({ label: 'B', value: Number.NaN })
    expect(meter(container)).toBeNull()
    expect(container.querySelector('[data-meter-track]')).not.toBeNull()
    expect(container.textContent).not.toContain('—')
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
    const { container } = mount({ label: 'S', segments: [] })
    expect(meter(container)).toBeNull()
    expect(container.textContent).not.toContain('—')
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

describe('Meter — captions and roots', () => {
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
    const swatches = items.map((li) => li.querySelector('[aria-hidden]') as HTMLElement)
    expect(swatches[0]?.style.background).toBe('red')
    // An uncoloured part is the neutral track fill, never an unpainted swatch.
    expect(swatches[1]?.getAttribute('style')).toContain('var(--vx-line)')
    // The default start caption is replaced, not duplicated.
    expect(container.querySelector('[data-meter-captions]')).toBeNull()
  })

  test('an explicit startCaption still shows beside the part captions', () => {
    const { container, getByText } = mount({
      label: 'S',
      segments: [{ value: 10, label: 'A' }],
      startCaption: 'Total 10',
    })
    expect(getByText('Total 10')).toBeTruthy()
    expect(container.querySelector('[data-meter-parts]')).toBeTruthy()
  })

  test('repeated labels still render one caption each', () => {
    const { container } = mount({
      label: 'S',
      segments: [
        { value: 10, label: 'A' },
        { value: 5, label: 'A' },
      ],
    })
    expect(container.querySelectorAll('[data-meter-parts] li').length).toBe(2)
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

  test('empty segments are the empty state: no part list, no captions', () => {
    const { container } = mount({ label: 'S', segments: [] })
    expect(container.textContent).not.toContain('—')
    expect(container.querySelector('[data-meter-parts]')).toBeNull()
    expect(container.querySelector('[data-meter-captions]')).toBeNull()
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

describe('zone name layout', () => {
  const ZONES = [
    { from: 0, to: 250, label: 'Low' },
    { from: 250, to: 500, label: 'Optimal' },
    { from: 500, to: 750, label: 'High' },
  ]
  let labelWidth = 50
  let holdingExtra = 0
  let shortWidth = 20
  let rowWidth = 300
  let observers: FakeResizeObserver[] = []

  class FakeResizeObserver {
    disconnected = false
    constructor(readonly callback: () => void) {
      observers.push(this)
    }
    observe() {}
    unobserve() {}
    disconnect() {
      this.disconnected = true
    }
  }

  let ownRect: PropertyDescriptor | undefined
  let realObserver = globalThis.ResizeObserver

  beforeEach(() => {
    // Captured per test, not at load: other files stub the same prototype.
    ownRect = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'getBoundingClientRect')
    realObserver = globalThis.ResizeObserver
    rowWidth = 300
    labelWidth = 50
    holdingExtra = 0
    shortWidth = 20
    observers = []
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver
    // happy-dom has no layout: the row is `rowWidth` wide, each name `labelWidth` centred on its span.
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const box = (left: number, width: number) =>
        ({ left, right: left + width, width, top: 0, bottom: 10, height: 10 }) as DOMRect
      // A placement's nudge is a `translate`: the layout includes it in the box, as a browser does.
      const nudge = (el: HTMLElement) =>
        Number.parseFloat(el.style.getPropertyValue('--basalt-nudge')) || 0
      if (this.hasAttribute('data-meter-zone-label')) {
        const width = labelWidth + (this.hasAttribute('data-holding') ? holdingExtra : 0)
        const centre = (Number.parseFloat(this.style.insetInlineStart) / 100) * rowWidth
        return box(centre - width / 2 + nudge(this), width)
      }
      if (this.hasAttribute('data-meter-zone-short')) {
        const centre = (Number.parseFloat(this.style.insetInlineStart) / 100) * rowWidth
        return box(centre - shortWidth / 2 + nudge(this), shortWidth)
      }
      return this.hasAttribute('data-meter-zone-band') ? box(0, rowWidth) : box(0, 0)
    }
  })
  afterEach(() => {
    // Restore (or remove) the OWN property: assigning the inherited function back would shadow
    // the `Element.prototype` stub other files install.
    if (ownRect) Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', ownRect)
    else Reflect.deleteProperty(HTMLElement.prototype, 'getBoundingClientRect')
    globalThis.ResizeObserver = realObserver
  })

  const props = { label: 'Load', max: 750, value: 300, zones: ZONES } as const
  const hiddenNames = (c: HTMLElement) =>
    [...c.querySelectorAll('[data-meter-zone-label][data-hidden]')].map((l) => l.textContent)
  // Wave 39: a name that cannot hold the first row stands on the second, still shown.
  const movedNames = (c: HTMLElement) =>
    [...c.querySelectorAll('[data-meter-zone-label][data-row2]:not([data-hidden])')].map(
      (l) => l.textContent,
    )
  const labelRows = (c: HTMLElement) =>
    c.querySelector('[data-meter-zone-band]')?.getAttribute('data-meter-rows')
  const resize = (width: number) => {
    rowWidth = width
    act(() => {
      for (const o of observers) o.callback()
    })
  }

  test('shows every name on a wide row, moves those wider than their span to a second row when narrowed, and returns', () => {
    const { container } = mount(props)
    expect(hiddenNames(container)).toEqual([])
    expect(movedNames(container)).toEqual([])
    expect(labelRows(container)).toBe('1')
    // 120px row: each span is 40px, a 50px name does not fit. The holding name (Optimal) stays on row one.
    resize(120)
    expect(hiddenNames(container)).toEqual([])
    expect(movedNames(container)).toEqual(['Low', 'High'])
    expect(labelRows(container)).toBe('2')
    resize(300)
    expect(hiddenNames(container)).toEqual([])
    expect(movedNames(container)).toEqual([])
    expect(labelRows(container)).toBe('1')
  })

  test('a name too wide for its span shows its short label instead; the full name stays described', () => {
    const zones = ZONES.map((z) => ({ ...z, short: z.label.slice(0, 2) }))
    const { container } = mount({ ...props, zones })
    const visible = () =>
      [...container.querySelectorAll('[data-meter-zone-short]:not([data-hidden])')].map(
        (l) => l.textContent,
      )
    expect(visible()).toEqual([])
    // 120px row: the full names take the second row before any short label is tried (Wave 39).
    resize(120)
    expect(hiddenNames(container)).toEqual([])
    expect(movedNames(container)).toEqual(['Low', 'High'])
    expect(visible()).toEqual([])
    // 30px row: no full name fits either row, so the short labels run as one register; the second
    // short has no room beside the first and hides.
    resize(30)
    expect(visible()).toEqual(['Lo'])
    expect(container.querySelector('[role="meter"]')?.getAttribute('aria-describedby')).toBeTruthy()
    expect(container.textContent).toContain('Low')
  })

  test('there is no list fallback: a hidden name stays in the row', () => {
    const { container } = mount(props)
    resize(120)
    expect(container.querySelector('[data-meter-zone-list]')).toBeNull()
    expect(container.querySelectorAll('[data-meter-zone-label]')).toHaveLength(3)
  })

  test('the holding zone stays flagged when names hide', () => {
    const { container } = mount(props)
    const holding = () =>
      [...container.querySelectorAll('[data-holding]')].map((l) => l.textContent)
    expect(holding()).toEqual(['Optimal'])
    resize(120)
    expect(holding()).toEqual(['Optimal'])
  })

  test('the described-by text names every zone and the holding one, shown or hidden', () => {
    const { container } = mount(props)
    const text = () => {
      const id = meter(container).getAttribute('aria-describedby') as string
      return container.querySelector(`[id="${id}"]`)?.textContent
    }
    for (const width of [300, 120]) {
      resize(width)
      expect(text()).toContain('Low 0 to 250')
      expect(text()).toContain('Optimal 250 to 500')
      expect(text()).toContain('High 500 to 750')
      expect(text()).toContain('300 is in Optimal')
    }
  })

  test('disconnects the observer on unmount', () => {
    const { unmount } = mount(props)
    expect(observers.every((o) => !o.disconnected)).toBe(true)
    unmount()
    expect(observers.length).toBeGreaterThan(0)
    expect(observers.every((o) => o.disconnected)).toBe(true)
  })

  test('without a ResizeObserver it renders every name and does not throw', () => {
    // @ts-expect-error simulating an environment without the API
    delete globalThis.ResizeObserver
    expect(hiddenNames(mount(props).container)).toEqual([])
  })

  test('a reading that moves the bold label re-measures with no resize', () => {
    // 300px row, spans 0-200 / 200-240 / 240-300: B holding is 45 + 40 = 85px wide, over C's name,
    // so C's name borrows room (a nudge) once B is the holding one.
    const zones = [
      { from: 0, to: 500, label: 'A' },
      { from: 500, to: 600, label: 'B' },
      { from: 600, to: 750, label: 'C' },
    ]
    labelWidth = 45
    holdingExtra = 40
    const tree = (value: number) => (
      <MantineProvider>
        <Meter label="Load" max={750} value={value} zones={zones} />
      </MantineProvider>
    )
    const { container, rerender } = render(tree(100))
    expect(hiddenNames(container)).toEqual([])
    const nudged = () =>
      [...container.querySelectorAll<HTMLElement>('[data-meter-zone-label]')].filter(
        (l) => l.style.getPropertyValue('--basalt-nudge') !== '',
      ).length
    const before = nudged()
    // B holding is bolder and claims its place first, so a name moves clear of it. No observer callback fires.
    rerender(tree(550))
    expect(hiddenNames(container)).toEqual([])
    expect(nudged()).toBeGreaterThan(before)
    rerender(tree(100))
    expect(hiddenNames(container)).toEqual([])
    expect(nudged()).toBe(before)
  })

  describe('web fonts', () => {
    let ownFonts: PropertyDescriptor | undefined
    let loadingDone: (() => void) | undefined
    let removed: string[] = []

    beforeEach(() => {
      ownFonts = Object.getOwnPropertyDescriptor(document, 'fonts')
      loadingDone = undefined
      removed = []
      Object.defineProperty(document, 'fonts', {
        configurable: true,
        value: {
          ready: new Promise(() => {}),
          addEventListener: (type: string, fn: () => void) => {
            if (type === 'loadingdone') loadingDone = fn
          },
          removeEventListener: (type: string) => removed.push(type),
        },
      })
    })
    afterEach(() => {
      if (ownFonts) Object.defineProperty(document, 'fonts', ownFonts)
      else Reflect.deleteProperty(document, 'fonts')
    })

    test('loadingdone re-measures: widths that changed with no resize move names to the second row', () => {
      const { container } = mount(props)
      expect(movedNames(container)).toEqual([])
      labelWidth = 120
      act(() => loadingDone?.())
      expect(movedNames(container)).toEqual(['Low', 'High'])
    })

    test('the listener is removed on unmount', () => {
      const { unmount } = mount(props)
      expect(removed).toEqual([])
      unmount()
      expect(removed).toEqual(['loadingdone'])
    })
  })
})

describe('Meter — caption orphans', () => {
  test('the last two words of a composed caption are glued when the last is short', () => {
    const { container } = mount({
      label: 'Wait',
      value: 1,
      max: 5,
      startCaption: 'Warden abandons an item at 7 d',
      endCaption: 'forecast over budget',
    })
    const caps = [...container.querySelectorAll('[data-meter-captions] > span')].map(
      (c) => c.textContent,
    )
    expect(caps).toContain('Warden abandons an item at\u00a07\u00a0d')
    expect(caps).toContain('forecast over\u00a0budget')
  })

  test('a long last word keeps its ordinary space', () => {
    const { container } = mount({
      label: 'Wait',
      value: 1,
      max: 5,
      endCaption: 'over the threshold',
    })
    expect(container.querySelector('[data-meter-captions]')?.textContent).toContain('the threshold')
    expect(container.querySelector('[data-meter-captions]')?.textContent).not.toContain(
      'the\u00a0threshold',
    )
  })
})

describe('Meter without a reading', () => {
  test('prints no filler: no dash, no caption by default, the muted track stays', () => {
    const { container } = mount({ label: 'B', value: null })
    // Announced, not drawn: the state is read as text, never as a glyph.
    expect(container.querySelector('output')?.textContent).toBe('No reading')
    expect(container.querySelector('[data-meter-track]')).not.toBeNull()
  })

  test('ring: the em dash is the reading in the centre, with no caption', () => {
    const { container } = mount({ label: 'R', shape: 'ring', value: null })
    expect(container.querySelector('output')?.textContent).toBe('—')
    // One child span (the ring box holding the dash): no separate caption span follows it.
    expect(container.querySelectorAll('output > span')).toHaveLength(1)
    expect(container.querySelector('output > span > span')?.textContent).toBe('—')
  })

  test('a consumer emptyText replaces it with the EmptyState box, ring and bar alike', () => {
    const ring = mount({ label: 'R', shape: 'ring', value: null, emptyText: 'Not worn' }).container
    expect(ring.querySelector('[data-basalt-meter]')?.textContent).toBe('Not worn')
    expect(ring.querySelector('svg, [data-meter-track]')).toBeNull()
    cleanup()
    const bar = mount({ label: 'B', value: null, emptyText: 'Not worn. Put it on.' }).container
    expect(bar.querySelector('[data-basalt-meter]')?.textContent).toBe('Not wornPut it on.')
    expect(bar.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe('B')
  })

  test('a blank emptyText draws no tile', () => {
    const { container } = mount({ label: 'B', value: null, emptyText: '  ' })
    expect(container.querySelector('[role="status"]')).toBeNull()
    expect(container.querySelector('[data-meter-track]')).not.toBeNull()
  })

  test('a consumer emptyText still replaces it', () => {
    const { container } = mount({ label: 'B', value: null, emptyText: 'Not worn' })
    expect(container.querySelector('[data-basalt-meter]')?.textContent).toBe('Not worn')
  })
})

describe('Meter empty and loading footprint (Wave 38)', () => {
  const lines = (c: HTMLElement) => c.querySelectorAll('[data-meter-line]').length

  test('a null bar keeps one blank caption line below its track, a zoned one two', () => {
    expect(lines(mount({ label: 'B', value: null }).container)).toBe(1)
    cleanup()
    const zones = [{ from: 0, to: 10, label: 'All' }]
    expect(lines(mount({ label: 'Z', value: null, zones }).container)).toBe(2)
  })

  test('a row-size null Meter has no caption line, like a loaded one', () => {
    expect(lines(mount({ label: 'R', value: null, size: 'row' }).container)).toBe(0)
  })

  test('emptyText replaces the blank line', () => {
    const { container } = mount({ label: 'B', value: null, emptyText: 'Not worn' })
    expect(lines(container)).toBe(0)
    expect(container.querySelector('[data-basalt-meter]')?.textContent).toBe('Not worn')
  })

  test('loading is the loaded tree: a plain bar keeps its caption row, a zoned one its name row and reading row', () => {
    const plain = mount({ label: 'B', value: 5, loading: true }).container
    expect(plain.querySelectorAll('[data-meter-captions]')).toHaveLength(1)
    expect(plain.querySelector('[data-meter-track]')).not.toBeNull()
    cleanup()
    const zones = [{ from: 0, to: 10, label: 'All' }]
    const zoned = mount({ label: 'Z', value: 5, zones, loading: true }).container
    expect(zoned.querySelector('[data-meter-zone-band]')).not.toBeNull()
    expect(zoned.querySelector('[data-meter-reading-row]')).not.toBeNull()
  })

  test('loading carries its ticks, target and forecast captions, and no values or meter role', () => {
    const { container } = mount({
      label: 'G',
      max: 28,
      target: 28,
      ticks: [{ at: 14, label: 'Pace', caption: '14 sessions' }],
      loading: true,
    })
    expect(container.querySelector('[data-meter-tick-band]')).not.toBeNull()
    expect(container.textContent).toMatch(/Target.28/)
    expect(container.querySelector('[role="meter"], [aria-valuenow]')).toBeNull()
    expect(container.querySelector('[data-meter-fill], [data-meter-tick]')).toBeNull()
  })
})
