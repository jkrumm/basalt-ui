/**
 * Wave 37 Meter: the reading switch, the host tone, a hidden track, muted zones and segments, ring
 * marks, `stops`, row-size part captions and captions at their marks.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { Meter } from './meter'
import type { MeterProps } from './meter'
import { modelBar, placeMarkCaptions, partsFitUnder, placeRowLabels, zoneFill } from './meter-model'
import { VisualSlotContext } from './visual-slot'

afterEach(cleanup)

const mount = (props: MeterProps, slot: { tone?: 'good' | 'warn' | 'bad' } | null = null) =>
  render(
    <MantineProvider>
      <VisualSlotContext.Provider value={slot}>
        <Meter {...props} />
      </VisualSlotContext.Provider>
    </MantineProvider>,
  )

const zones = [
  { from: 0, to: 300, label: 'Low' },
  { from: 300, to: 750, label: 'Optimal' },
  { from: 750, to: 1000, label: 'High' },
]
const q = (c: HTMLElement, s: string) => c.querySelector<HTMLElement>(s)

describe('reading off', () => {
  test('a zoned Meter with reading={false} prints no marker label and keeps its aria value', () => {
    const { container } = mount({ label: 'Load', value: 612, max: 1000, zones, reading: false })
    expect(q(container, '[data-meter-reading-row]')).toBeNull()
    const m = q(container, '[role="meter"]')
    expect(m?.getAttribute('aria-valuenow')).toBe('612')
    expect(m?.getAttribute('aria-valuetext')).toBe('612')
    expect(q(container, '[data-meter-tick="marker"]')).not.toBeNull()
  })

  test('the default still prints it', () => {
    const { container } = mount({ label: 'Load', value: 612, max: 1000, zones })
    expect(q(container, '[data-meter-reading-row]')).not.toBeNull()
  })
})

describe('host tone', () => {
  const fill = (c: HTMLElement) => q(c, '[data-meter-fill]')

  test('a plain bar with no tone/color takes the host tone', () => {
    const { container } = mount({ label: 'L', value: 40 }, { tone: 'bad' })
    expect(fill(container)?.style.background).toContain('var(--vx-status-bad)')
    expect(fill(container)?.getAttribute('data-tone')).toBeNull()
  })

  test('an explicit tone or colour wins; a host without a tone changes nothing', () => {
    const own = mount({ label: 'L', value: 40, color: 'red' }, { tone: 'bad' })
    expect(fill(own.container)?.style.background).toBe('red')
    own.unmount()
    const muted = mount({ label: 'L', value: 40, tone: 'muted' }, { tone: 'bad' })
    expect(fill(muted.container)?.getAttribute('data-tone')).toBe('muted')
    expect(fill(muted.container)?.style.background ?? '').not.toContain('status')
    muted.unmount()
    const plain = mount({ label: 'L', value: 40 }, {})
    expect(fill(plain.container)?.getAttribute('data-tone')).toBe('muted')
  })

  test('the ring arc takes it too', () => {
    const { container } = mount({ shape: 'ring', label: 'R', value: 40 }, { tone: 'warn' })
    expect(q(container, 'circle[stroke-dasharray]')?.style.stroke).toContain('--vx-status-warn')
  })
})

describe('track={false}', () => {
  test('hides the track of a bar with a value and nothing to compare against', () => {
    const { container } = mount({ label: 'Share', value: 40, track: false })
    expect(q(container, '[data-meter-track-hidden]')).not.toBeNull()
    expect(q(container, '[role="meter"]')?.getAttribute('aria-valuenow')).toBe('40')
  })

  test('a target or ticks keep it', () => {
    expect(
      q(
        mount({ label: 'S', value: 40, track: false, target: 50 }).container,
        '[data-meter-track-hidden]',
      ),
    ).toBeNull()
    cleanup()
    expect(
      q(
        mount({ label: 'S', value: 40, track: false, ticks: [{ at: 20 }] }).container,
        '[data-meter-track-hidden]',
      ),
    ).toBeNull()
  })
})

describe('tone="muted" per zone and segment', () => {
  // happy-dom drops `color-mix` from `style`, so the ramp is read from the model that paints it.
  test('muted zones step in strength, so the ramp reads by lightness', () => {
    const muted = zones.map((z) => ({ ...z, tone: 'muted' as const }))
    const bg = muted.map((z, i) => zoneFill(z, i, muted.length))
    for (const b of bg) expect(b).toContain('--vx-muted')
    expect(new Set(bg).size).toBe(3)
    const pct = bg.map((b) => Number(/--vx-muted\) (\d+(?:\.\d+)?)%/.exec(b)?.[1]))
    expect(pct[1]! - pct[0]!).toBeGreaterThanOrEqual(15)
    expect(pct[2]! - pct[1]!).toBeGreaterThanOrEqual(15)
    expect(zoneFill({ ...zones[0]!, tone: undefined as never }, 0, 3)).toContain('--vx-line')
  })

  test('a colour wins over muted; the holding zone keeps ink and weight', () => {
    const { container } = mount({
      label: 'L',
      value: 400,
      max: 1000,
      zones: [{ ...zones[0]!, tone: 'muted', color: 'red' }, ...zones.slice(1)],
    })
    expect(q(container, '[data-meter-zone="Low"]')?.style.background).toBe('red')
    expect(q(container, '[data-holding]')?.getAttribute('data-meter-zone-label')).toBe('Optimal')
  })

  test('muted segments get distinct muted fills', () => {
    const m = modelBar({
      reading: 70,
      min: 0,
      max: 100,
      format: String,
      segments: [
        { value: 30, label: 'A', tone: 'muted' },
        { value: 20, label: 'B', tone: 'muted' },
        { value: 20, label: 'C', tone: 'muted' },
      ],
    })
    const colours = m.parts.map((p) => p.color ?? '')
    expect(new Set(colours).size).toBe(3)
    for (const c of colours) expect(c).toContain('--vx-muted')
  })
})

describe('ring target and ticks', () => {
  test('a target draws one radial tick at its angle; the value stays centred', () => {
    const { container } = mount({
      shape: 'ring',
      label: 'Cache',
      value: 87,
      format: (v) => `${v}%`,
      target: 60,
    })
    const tick = q(container, '[data-meter-ring-tick]')
    expect(tick).not.toBeNull()
    expect(tick?.querySelector('line')?.getAttribute('transform')).toBe('rotate(216 18 18)')
    expect(container.textContent).toContain('87%')
    const id = q(container, '[role="meter"]')?.getAttribute('aria-describedby') as string
    expect(document.getElementById(id)?.textContent).toContain('Target 60%')
  })

  test('ticks too, and an out-of-range one is dropped', () => {
    const { container } = mount({
      shape: 'ring',
      label: 'R',
      value: 50,
      ticks: [{ at: 25, label: 'Low' }, { at: 150 }],
    })
    const angles = [...container.querySelectorAll('[data-meter-ring-tick]')].map((g) =>
      g.querySelector('line')?.getAttribute('transform'),
    )
    expect(angles).toEqual(['rotate(90 18 18)'])
  })
})

describe('stops', () => {
  test('render one gradient track with the reading as a marker and no labels', () => {
    const { container } = mount({
      label: 'Sky',
      value: 30,
      stops: [
        { at: 0, color: 'navy' },
        { at: 50, color: 'orange' },
        { at: 100, color: 'white' },
      ],
    })
    const gradient = q(container, '[data-meter-stops]')
    expect(gradient?.style.getPropertyValue('--basalt-stops')).toContain('navy 0%')
    expect(gradient?.style.getPropertyValue('--basalt-stops')).toContain('orange 50%')
    expect(q(container, '[data-meter-tick="marker"]')?.style.insetInlineStart).toBe('30%')
    expect(q(container, '[data-meter-fill]')).toBeNull()
    expect(q(container, '[data-meter-reading-row]')).toBeNull()
    expect(q(container, '[data-meter-captions]')).toBeNull()
  })

  test('labelled ticks caption on a stops track', () => {
    const { container } = mount({
      label: 'Sky',
      value: 30,
      stops: [
        { at: 0, color: 'navy' },
        { at: 100, color: 'white' },
      ],
      ticks: [{ at: 50, label: 'Dusk' }],
    })
    expect(q(container, '[data-meter-tick-label]')?.textContent).toBe('Dusk')
  })
})

describe('size="row" categorical parts', () => {
  const segments = [
    { value: 30, label: 'Chats' },
    { value: 20, label: 'Mail' },
  ]
  test('keeps part captions; still drops the reading/target captions', () => {
    const { container } = mount({ label: 'P', size: 'row', segments })
    expect(container.querySelectorAll('[data-meter-parts] li')).toHaveLength(2)
    expect(q(container, '[data-meter-captions]')).toBeNull()
  })

  test('startCaption={null} endCaption={null} keeps the zone labels', () => {
    const { container } = mount({
      label: 'L',
      value: 400,
      max: 1000,
      zones,
      startCaption: null,
      endCaption: null,
    })
    expect(container.querySelectorAll('[data-meter-zone-label]')).toHaveLength(3)
    expect(q(container, '[data-meter-captions]')).toBeNull()
  })
})

describe('captions at their marks', () => {
  test('an anchored caption is centred on its mark and clamped inside the row', () => {
    const lefts = placeMarkCaptions(
      [{ width: 40 }, { width: 60, pct: 50 }, { width: 50, pct: 100 }],
      300,
      6,
    )
    expect(lefts).toEqual([0, 120, 250])
    expect(placeMarkCaptions([{ width: 60, pct: 0 }], 300, 6)).toEqual([0])
  })

  test('a start caption and an anchored one closer than a gap step fall back to the flow', () => {
    expect(placeMarkCaptions([{ width: 40 }, { width: 60, pct: 12 }], 300, 6)).toBeNull()
    expect(placeMarkCaptions([{ width: 40 }, { width: 60, pct: 30 }], 300, 6)).not.toBeNull()
  })

  test('nothing anchored, an unmeasured row or an over-wide caption never anchors', () => {
    expect(placeMarkCaptions([{ width: 40 }], 300, 6)).toBeNull()
    expect(placeMarkCaptions([{ width: 40, pct: 50 }], 0, 6)).toBeNull()
    expect(placeMarkCaptions([{ width: 400, pct: 50 }], 300, 6)).toBeNull()
  })

  test('part captions sit under their own segment only when each fits there', () => {
    const parts = [
      { startPct: 0, width: 80 },
      { startPct: 40, width: 90 },
    ]
    expect(partsFitUnder(parts, 300, 6)).toBe(true)
    expect(partsFitUnder([{ startPct: 0, width: 130 }, parts[1]!], 300, 6)).toBe(false)
    expect(
      partsFitUnder(
        [
          { startPct: 0, width: 10 },
          { startPct: 0, width: 10 },
        ],
        300,
        6,
      ),
    ).toBe(false)
    expect(partsFitUnder(parts, 0, 6)).toBe(false)
  })

  test('a zone name and an end tick keep a gap step apart', () => {
    const labels = [
      { box: { left: 0, right: 20 } },
      { box: { left: 24, right: 60 }, span: { left: 20, right: 100 } },
    ]
    expect(placeRowLabels(labels, 100, 0).shown).toEqual([true, true])
    expect(placeRowLabels(labels, 100, 6).shown).toEqual([true, false])
  })
})
