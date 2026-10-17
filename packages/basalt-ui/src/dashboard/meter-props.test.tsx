/**
 * Meter's W35 props: `ticks`, `tone="muted"`, `size="row"`, the one caption size, a target tick that
 * reads at `max`, and the root part types. CSS-module class hashes are unavailable under `bun test`,
 * so structure goes through `data-*` and the stylesheet is read as text.
 */
import { MantineProvider } from '@mantine/core'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { contrastRatio } from '../tokens/hct'
import { INK, NEUTRAL, SURFACE } from '../tokens/palette'
import type { MeterSegment, MeterTick, MeterZone } from '../index'
import { Meter } from './meter'
import type { MeterProps } from './meter'

afterEach(cleanup)

const mount = (props: MeterProps) =>
  render(
    <MantineProvider>
      <Meter {...props} />
    </MantineProvider>,
  )
const marks = (c: HTMLElement, kind: string) => [
  ...c.querySelectorAll<HTMLElement>(`[data-meter-tick="${kind}"]`),
]
const described = (c: HTMLElement) => {
  const id = c.querySelector('[role="meter"]')?.getAttribute('aria-describedby') as string
  return c.querySelector(`[id="${id}"]`)?.textContent ?? ''
}
const css = readFileSync(resolve(import.meta.dirname, 'meter.module.css'), 'utf8')

describe('ticks', () => {
  const ticks = [{ at: 40, label: 'Low' }, { at: 70, label: 'Good' }, { at: 55 }]

  test('draws one mark per tick at its percent of the track (min offset respected)', () => {
    const { container } = mount({ label: 'Recovery', value: 50, min: 0, max: 100, ticks })
    expect(marks(container, 'tick').map((t) => t.style.insetInlineStart)).toEqual([
      '40%',
      '70%',
      '55%',
    ])
    const off = mount({ label: 'Offset', value: 30, min: 10, max: 50, ticks: [{ at: 30 }] })
    expect(marks(off.container, 'tick')[0]?.style.insetInlineStart).toBe('50%')
  })

  test('works with zones (beside the zone bounds) and with target (beside the target tick)', () => {
    const zoned = mount({
      label: 'Load',
      value: 50,
      zones: [
        { from: 0, to: 50, label: 'A' },
        { from: 50, to: 100, label: 'B' },
      ],
      ticks,
    })
    expect(marks(zoned.container, 'tick')).toHaveLength(3)
    expect(marks(zoned.container, 'marker')).toHaveLength(1)
    const targeted = mount({ label: 'Spend', value: 50, target: 80, ticks })
    expect(marks(targeted.container, 'tick')).toHaveLength(3)
    expect(marks(targeted.container, 'target')[0]?.style.insetInlineStart).toBe('80%')
  })

  test('lists every tick in aria-describedby, labelled or not', () => {
    const { container } = mount({ label: 'Recovery', value: 50, ticks, format: (v) => `${v}%` })
    const text = described(container)
    expect(text).toContain('Low 40%')
    expect(text).toContain('Good 70%')
    expect(text).toContain('Tick 55%')
  })

  test('a tick outside [min, max] is DROPPED, not clamped: no mark and no description', () => {
    const { container } = mount({
      label: 'Recovery',
      value: 50,
      ticks: [{ at: -5, label: 'Below' }, { at: 100 }, { at: 101, label: 'Above' }, { at: NaN }],
    })
    expect(marks(container, 'tick')).toHaveLength(1)
    expect(described(container)).toContain('Tick 100')
    expect(described(container)).not.toContain('Below')
    expect(described(container)).not.toContain('Above')
  })

  test('captions only the labelled ticks, and size="row" draws the marks without captions', () => {
    const { container } = mount({ label: 'R', value: 50, ticks })
    expect(
      [...container.querySelectorAll('[data-meter-tick-label]')].map((l) => l.textContent),
    ).toEqual(['Low', 'Good'])
    const row = mount({ label: 'R', value: 50, ticks, size: 'row' })
    expect(row.container.querySelector('[data-meter-tick-label]')).toBeNull()
    expect(marks(row.container, 'tick')).toHaveLength(3)
  })
})

describe('tick caption collision', () => {
  let rowWidth = 300
  let labelWidth = 40
  let observers: { callback: () => void }[] = []
  let ownRect: PropertyDescriptor | undefined
  const realObserver = globalThis.ResizeObserver

  beforeEach(() => {
    ownRect = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'getBoundingClientRect')
    rowWidth = 300
    labelWidth = 40
    observers = []
    globalThis.ResizeObserver = class {
      constructor(readonly callback: () => void) {
        observers.push(this)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const box = (left: number, width: number) =>
        ({ left, right: left + width, width, top: 0, bottom: 10, height: 10 }) as DOMRect
      if (this.hasAttribute('data-meter-tick-label')) {
        const end = this.style.insetInlineEnd
        if (end)
          return box(rowWidth - (Number.parseFloat(end) / 100) * rowWidth - labelWidth, labelWidth)
        return box((Number.parseFloat(this.style.insetInlineStart) / 100) * rowWidth, labelWidth)
      }
      return this.hasAttribute('data-meter-tick-band') ? box(0, rowWidth) : box(0, 0)
    }
  })
  afterEach(() => {
    if (ownRect) Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', ownRect)
    else Reflect.deleteProperty(HTMLElement.prototype, 'getBoundingClientRect')
    globalThis.ResizeObserver = realObserver
  })

  const props = {
    label: 'Recovery',
    value: 50,
    ticks: [
      { at: 40, label: 'Low' },
      { at: 70, label: 'Good' },
    ],
  } as const

  test('sits as a band while the captions are clear and wraps to a list when they touch', () => {
    const { container } = mount(props)
    expect(container.querySelector('[data-meter-tick-list]')).toBeNull()
    rowWidth = 100
    act(() => {
      for (const o of observers) o.callback()
    })
    const list = container.querySelector('[data-meter-tick-list]')
    expect(list).not.toBeNull()
    expect([...(list?.children ?? [])].map((c) => c.textContent)).toEqual(['Low', 'Good'])
  })

  test('a caption that would leave the row at the end is right-aligned to its tick, so it fits', () => {
    const { container } = mount({ label: 'R', value: 50, ticks: [{ at: 95, label: 'Cap' }] })
    expect(container.querySelector('[data-meter-tick-list]')).toBeNull()
    const label = container.querySelector<HTMLElement>('[data-meter-tick-label]')
    expect(label?.style.insetInlineEnd).toBe('5%')
  })
})

describe('tone="muted"', () => {
  const fill = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-meter-fill]')

  test('marks the fill muted without a colour, and a verdict colour still wins', () => {
    const { container } = mount({ label: 'Load', value: 40, tone: 'muted' })
    expect(fill(container)?.getAttribute('data-tone')).toBe('muted')
    expect(fill(container)?.style.background).toBe('')
    const verdict = mount({
      label: 'Load',
      value: 40,
      tone: 'muted',
      color: 'var(--vx-status-warn)',
    })
    expect(fill(verdict.container)?.getAttribute('data-tone')).toBeNull()
    expect(fill(verdict.container)?.style.background).toBe('var(--vx-status-warn)')
  })

  test('with no colour and no tone the fill is muted; tone="ink" opts back into the ink fill', () => {
    expect(fill(mount({ label: 'Load', value: 40 }).container)?.getAttribute('data-tone')).toBe(
      'muted',
    )
    const ink = fill(mount({ label: 'Load', value: 40, tone: 'ink' }).container)
    expect(ink?.hasAttribute('data-tone')).toBe(false)
  })

  test('segments + forecast and zones keep their fills; an explicit tone still applies to them', () => {
    const seg = mount({
      label: 'P',
      segments: [
        { value: 70, label: 'Done' },
        { value: 25, label: 'Planned', forecast: true },
      ],
    })
    expect(seg.container.querySelectorAll('[data-tone]').length).toBe(0)
    const zones = mount({
      label: 'Z',
      max: 1000,
      value: 600,
      zones: [
        { from: 0, to: 500, label: 'Low' },
        { from: 500, to: 1000, label: 'High' },
      ],
    })
    expect(zones.container.querySelectorAll('[data-tone]').length).toBe(0)
    const toned = mount({ label: 'P', segments: [{ value: 70, label: 'Done' }], tone: 'muted' })
    expect(toned.container.querySelectorAll('[data-tone="muted"]').length).toBe(1)
  })

  // The track is always `--vx-surface-subtle`, whatever surface the Meter sits on, so the fill/track
  // ratio below is surface-independent. INK/SURFACE are the derived palette at the default seed.
  test('is built from --vx-muted only (no hex) and clears 3:1 against the track in both schemes', () => {
    const rule =
      /\[data-tone='muted'\][^{]*\{[^}]*background:\s*color-mix\(in srgb, var\(--vx-muted\) (\d+)%, transparent\)/.exec(
        css,
      )
    expect(rule).not.toBeNull()
    const alpha = Number(rule?.[1]) / 100
    const blend = (fg: string, bg: string) => {
      const ch = (h: string, i: number) => Number.parseInt(h.slice(1 + i * 2, 3 + i * 2), 16)
      const out = [0, 1, 2].map((i) => Math.round(alpha * ch(fg, i) + (1 - alpha) * ch(bg, i)))
      return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`
    }
    for (const scheme of ['light', 'dark'] as const) {
      const track = SURFACE.subtle[scheme]
      expect(contrastRatio(blend(INK.muted[scheme], track), track)).toBeGreaterThanOrEqual(3)
    }
  })

  test('in dark the muted fill is darker than the --vx-line fill it replaces', () => {
    const rule = /\[data-tone='muted'\][^{]*\{[^}]*var\(--vx-muted\) (\d+)%/.exec(css)
    const alpha = Number(rule?.[1]) / 100
    const luminance = (hex: string, over?: string) => {
      const ch = (h: string, i: number) => Number.parseInt(h.slice(1 + i * 2, 3 + i * 2), 16)
      const lin = (v: number) =>
        v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4
      const [r, g, b] = [0, 1, 2].map((i) =>
        lin(over ? alpha * ch(hex, i) + (1 - alpha) * ch(over, i) : ch(hex, i)),
      ) as [number, number, number]
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const muted = luminance(INK.muted.dark, SURFACE.subtle.dark)
    expect(muted).toBeLessThan(luminance(NEUTRAL.line.dark))
  })
})

describe('size="row"', () => {
  test('keeps role=meter and the label, with no caption rows of any kind', () => {
    const { container } = mount({
      label: 'Day load',
      value: 6,
      max: 8,
      target: 8,
      size: 'row',
      startCaption: 'start',
      endCaption: 'end',
    })
    const m = container.querySelector('[role="meter"]')
    expect(m?.getAttribute('aria-label')).toBe('Day load')
    expect(container.querySelector('[data-meter-captions]')).toBeNull()
    expect(container.textContent).not.toContain('start')
    expect(container.textContent).not.toContain('end')
  })

  test('drops zone names, the reading and part captions too', () => {
    const zoned = mount({
      label: 'L',
      value: 5,
      size: 'row',
      zones: [{ from: 0, to: 50, label: 'Low' }],
    })
    expect(zoned.container.querySelector('[data-meter-zone-band]')).toBeNull()
    expect(zoned.container.querySelector('[data-meter-reading-row]')).toBeNull()
    expect(marks(zoned.container, 'marker')).toHaveLength(1)
    const parts = mount({
      label: 'P',
      size: 'row',
      segments: [{ value: 30, label: 'Done' }],
    })
    expect(parts.container.querySelector('[data-meter-parts]')).toBeNull()
  })

  test('the track is one text line tall', () => {
    expect(css).toMatch(/\.row \.track\s*\{[^}]*height:\s*1lh/)
  })

  test('the default size is untouched', () => {
    expect(
      mount({ label: 'D', value: 6, target: 8 }).container.querySelector('[data-meter-captions]'),
    ).not.toBeNull()
  })
})

describe('one caption size', () => {
  const sizes = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(([, selector, body]) =>
    [...(body ?? '').matchAll(/font-size:\s*([^;]+);/g)].map((m) => ({
      selector: (selector ?? '').trim(),
      value: (m[1] ?? '').trim(),
    })),
  )

  test('every font-size but the ring value reads the one caption token', () => {
    const captions = sizes.filter((s) => s.selector !== '.ringValue')
    expect(captions.length).toBeGreaterThan(4)
    for (const s of captions) {
      expect(s.value, s.selector).toBe('var(--basalt-meter-caption)')
    }
  })

  test('the token defaults to --vx-text-micro on the root and is the only place a size is chosen', () => {
    const root = /\.root\s*\{[^}]*--basalt-meter-caption:\s*([^;]+);/.exec(css)
    expect(root?.[1]?.trim()).toBe('var(--vx-text-micro)')
    expect(css).not.toMatch(/font-size:\s*var\(--vx-text-(?!kpi)/)
  })
})

describe('caption wrapping', () => {
  const captionText = (c: HTMLElement) =>
    [...c.querySelectorAll('[data-meter-captions] > span')].map((e) => e.textContent)

  test('a value and its unit never split across a line: a no-break space joins them', () => {
    const { container } = mount({
      label: 'Wait',
      value: 3,
      max: 7,
      startCaption: null,
      endCaption: 'Warns at 24 h · abandoned at 7 d',
    })
    expect(captionText(container)).toEqual(['Warns at 24\u00a0h · abandoned at\u00a07\u00a0d'])
  })

  test("'3 of 7' and other non-unit words stay breakable", () => {
    const { container } = mount({
      label: 'B',
      value: 1,
      max: 2,
      startCaption: null,
      endCaption: '3 of 7 · 2 over',
    })
    expect(captionText(container)).toEqual(['3 of 7 · 2\u00a0over'])
  })

  test('words that are not a unit keep their ordinary space', () => {
    const { container } = mount({
      label: 'B',
      value: 1,
      max: 2,
      endCaption: 'Target 2400 over budget',
    })
    expect(captionText(container).join()).toContain('2400 over')
  })

  test('the caption rows set text-wrap: balance so a short caption does not orphan a word', () => {
    for (const selector of ['.captions', '.partCaptions', '.caption']) {
      const body =
        new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? ''
      expect(body, selector).toContain('text-wrap: balance')
    }
  })
})

describe('target at max', () => {
  test('sits inside the track end instead of straddling it', () => {
    const { container } = mount({ label: 'Day', value: 8, max: 8, target: 8 })
    const t = marks(container, 'target')[0]
    expect(t).toBeDefined()
    expect(t?.style.insetInlineStart).toBe('calc(100% - 2px)')
    expect(t?.style.marginInlineStart).toBe('0')
  })

  test('the reading marker stays centred even at the track end', () => {
    const { container } = mount({
      label: 'L',
      value: 100,
      zones: [{ from: 0, to: 100, label: 'All' }],
    })
    const m = marks(container, 'marker')[0]
    expect(m?.style.insetInlineStart).toBe('100%')
    expect(m?.style.marginInlineStart).toBe('')
  })

  test('a target below max keeps its centred percent position', () => {
    const t = marks(mount({ label: 'D', value: 3, max: 8, target: 4 }).container, 'target')[0]
    expect(t?.style.insetInlineStart).toBe('50%')
    expect(t?.style.marginInlineStart).toBe('')
  })

  test('the tick carries a track-coloured halo so ink on an ink fill still reads', () => {
    expect(css).toMatch(/\.tick\s*\{[^}]*box-shadow:[^;]*var\(--vx-surface-subtle\)/)
  })
})

describe('root part types', () => {
  test('MeterSegment, MeterZone and MeterTick import from the root and match the prop shapes', () => {
    const segments: MeterSegment[] = [{ value: 1, label: 'a', forecast: true }]
    const zones: MeterZone[] = [{ from: 0, to: 1, label: 'a' }]
    const ticks: MeterTick[] = [{ at: 1 }, { at: 2, label: 'b' }]
    // argo's idiom: the helper's return type is read off the props union.
    const typed: Extract<MeterProps, { zones: readonly unknown[] }>['zones'] = zones
    const seg: Extract<MeterProps, { segments: readonly unknown[] }>['segments'] = segments
    expect([typed, seg, ticks].every((v) => v.length > 0)).toBe(true)
  })

  test('the root barrel and the dashboard barrel export all three by name', () => {
    for (const file of ['index.ts', 'dashboard/index.ts']) {
      const src = readFileSync(resolve(import.meta.dirname, '..', file), 'utf8')
      for (const name of ['MeterSegment', 'MeterZone', 'MeterTick']) {
        expect(src, `${file} exports ${name}`).toMatch(new RegExp(`\\b${name}\\b`))
      }
    }
  })
})
