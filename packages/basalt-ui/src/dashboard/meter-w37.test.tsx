/**
 * Wave 37 Meter: the reading switch, the host tone, a hidden track, muted zones and segments, ring
 * marks, `stops`, row-size part captions and captions at their marks.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { Meter } from './meter'
import type { MeterProps } from './meter'
import {
  RAMP_MAX,
  RAMP_MIN_STEP,
  RAMP_ZONE,
  modelBar,
  partsFitUnder,
  placeMarkCaptions,
  placeRowLabels,
  rampStrength,
  zoneFill,
} from './meter-model'
import { contrastRatio } from '../tokens/hct'
import { INK, SURFACE } from '../tokens/palette'
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
  // happy-dom drops `color-mix` from `style`, so the fill is read from the model that paints it.
  test('muted zones share one flat fill, told apart by a gap, not lightness', () => {
    const muted = zones.map((z) => ({ ...z, tone: 'muted' as const }))
    const bg = muted.map((z, i) => zoneFill(z, i, muted.length))
    for (const b of bg) expect(b).toContain('--vx-muted')
    expect(new Set(bg).size).toBe(1)
    expect(zoneFill({ ...zones[0]!, tone: undefined as never }, 0, 3)).toContain('--vx-line')
    expect(new Set(zones.map((z, i) => zoneFill(z, i, zones.length))).size).toBe(3)
  })

  test('a boundary separator sits between adjacent muted zones', () => {
    const { container } = mount({
      label: 'L',
      value: 400,
      max: 1000,
      zones: zones.map((z) => ({ ...z, tone: 'muted' as const })),
    })
    const bands = [...container.querySelectorAll<HTMLElement>('[data-meter-zone]')]
    expect(bands.length).toBe(3)
    expect(bands[0]?.hasAttribute('data-meter-zone-seam')).toBe(false)
    for (const b of bands.slice(1)) {
      expect(b.hasAttribute('data-meter-zone-seam')).toBe(true)
      expect(b.style.insetInlineStart).toContain('1px')
    }
  })

  test('the marker holds 3:1 against the flat muted fill in both schemes', () => {
    const pct = Number(
      /--vx-muted\) (\d+(?:\.\d+)?)%/.exec(zoneFill({ ...zones[0]!, tone: 'muted' }, 0, 3))?.[1],
    )
    const mix = (fg: string, bg: string) => {
      const ch = (h: string, i: number) => Number.parseInt(h.slice(1 + i * 2, 3 + i * 2), 16)
      const out = [0, 1, 2].map((i) =>
        Math.round((pct / 100) * ch(fg, i) + (1 - pct / 100) * ch(bg, i)),
      )
      return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`
    }
    for (const scheme of ['light', 'dark'] as const) {
      const fill = mix(INK.muted[scheme], SURFACE.subtle[scheme])
      expect(contrastRatio(INK.ink[scheme], fill)).toBeGreaterThanOrEqual(3)
    }
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

  test('muted segments share one flat fill and are seamed apart', () => {
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
    expect(new Set(colours).size).toBe(1)
    for (const c of colours) expect(c).toContain('--vx-muted')
    const { container } = mount({
      label: 'P',
      segments: [
        { value: 30, label: 'A', tone: 'muted' },
        { value: 20, label: 'B', tone: 'muted' },
      ],
    })
    const fills = container.querySelectorAll('[data-meter-fill]')
    expect(fills[0]?.hasAttribute('data-meter-seam')).toBe(false)
    expect(fills[1]?.hasAttribute('data-meter-seam')).toBe(true)
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
      startCaption: null,
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

  test('captions closer than a gap step are pushed apart, in order, the least that clears them', () => {
    expect(placeMarkCaptions([{ width: 40 }, { width: 60, pct: 12 }], 300, 6)).toEqual([0, 46])
    expect(placeMarkCaptions([{ width: 40 }, { width: 60, pct: 30 }], 300, 6)).toEqual([0, 60])
    // Two marks at the end: the later one is pulled back inside the row, the earlier one makes room.
    expect(
      placeMarkCaptions(
        [
          { width: 60, pct: 90 },
          { width: 60, pct: 100 },
        ],
        300,
        6,
      ),
    ).toEqual([174, 240])
  })

  test('captions that cannot all clear each other inside the row fall back to the flow', () => {
    expect(
      placeMarkCaptions([{ width: 40 }, { width: 150, pct: 50 }, { width: 100, pct: 100 }], 300, 6),
    ).toBeNull()
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

describe('the line zone ramp', () => {
  test('neighbouring steps stay ≥15 points apart up to six zones, and never pass the cap', () => {
    for (const count of [2, 3, 4, 5, 6]) {
      const s = Array.from({ length: count }, (_, i) => rampStrength(i, count, RAMP_ZONE))
      for (let i = 1; i < count; i++)
        expect(s[i]! - s[i - 1]!).toBeGreaterThanOrEqual(RAMP_MIN_STEP)
    }
    expect(rampStrength(9, 10, RAMP_ZONE)).toBe(RAMP_MAX)
  })
})

describe('an end figure outranks a zone name', () => {
  test('a zone name that would touch an end figure falls back to its short label, then hides', () => {
    const end = { box: { left: 90, right: 100 }, end: true }
    const name = { box: { left: 70, right: 95 }, span: { left: 60, right: 100 } }
    expect(placeRowLabels([end, name], 100).shown).toEqual([true, false])
    expect(placeRowLabels([end, { ...name, short: { left: 72, right: 82 } }], 100)).toMatchObject({
      shown: [true, true],
      short: [false, true],
    })
    expect(placeRowLabels([end, { ...name, short: { left: 80, right: 92 } }], 100)).toMatchObject({
      shown: [true, false],
    })
  })

  test('both end figures stay unless the track is narrower than both plus a gap', () => {
    const ends = [
      { box: { left: 0, right: 10 }, end: true },
      { box: { left: 90, right: 100 }, end: true },
    ]
    expect(placeRowLabels(ends, 100, 6).shown).toEqual([true, true])
    expect(
      placeRowLabels([ends[0]!, { box: { left: 10, right: 20 }, end: true }], 20, 6).shown,
    ).toEqual([true, false])
  })

  test('an interior tick still keeps its place over an end figure it would touch', () => {
    const labels = [{ box: { left: 90, right: 100 }, end: true }, { box: { left: 85, right: 95 } }]
    expect(placeRowLabels(labels, 100).shown).toEqual([false, true])
    expect(placeRowLabels([{ box: { left: 90, right: 100 } }, labels[1]!], 100).shown).toEqual([
      true,
      false,
    ])
  })
})

describe('a scale labels its start, a tick captions under the track', () => {
  const labels = (c: HTMLElement) =>
    [...c.querySelectorAll('[data-meter-tick-label]')].map((l) => l.textContent)
  const fmt = (v: number) => `${v} sessions`

  test('ticks or a target label the start (`min`) with the Meter format', () => {
    const ticks = mount({ label: 'G', value: 17, max: 28, ticks: [{ at: 14 }], format: fmt })
    expect(labels(ticks.container)).toEqual(['0 sessions'])
    const target = mount({ label: 'G', value: 17, max: 28, target: 28, format: fmt })
    expect(labels(target.container)).toEqual(['0 sessions'])
    expect(q(target.container, '[data-meter-captions]')?.textContent).toContain(
      'Target 28 sessions',
    )
  })

  test('a bare value, a zoned track and size="row" get no start figure', () => {
    expect(labels(mount({ label: 'G', value: 17 }).container)).toEqual([])
    expect(labels(mount({ label: 'G', value: 17, zones, ticks: [{ at: 50 }] }).container)).toEqual(
      [],
    )
    expect(labels(mount({ label: 'G', value: 17, target: 50, size: 'row' }).container)).toEqual([])
  })

  test('startCaption={null} drops the start figure; a tick labelled at the start replaces it', () => {
    const dropped = mount({ label: 'G', value: 17, target: 50, startCaption: null })
    expect(labels(dropped.container)).toEqual([])
    const own = mount({ label: 'G', value: 17, ticks: [{ at: 0, label: 'Start' }] })
    expect(labels(own.container)).toEqual(['Start'])
  })

  test('endCaption={null} drops the target figure', () => {
    const { container } = mount({ label: 'G', value: 17, target: 50, endCaption: null })
    expect(q(container, '[data-meter-captions]')?.textContent ?? '').not.toContain('Target')
  })

  test('a tick `caption` is a caption under the track, in the accessible description', () => {
    const { container } = mount({
      label: 'G',
      value: 17,
      max: 28,
      startCaption: null,
      ticks: [{ at: 14, label: 'Pace', caption: '14 sessions by 16 Oct' }],
    })
    expect(q(container, '[data-meter-captions]')?.textContent).toContain('sessions by')
    expect(labels(container)).toEqual(['Pace'])
    expect(container.textContent).toContain('Pace 14')
  })
})
