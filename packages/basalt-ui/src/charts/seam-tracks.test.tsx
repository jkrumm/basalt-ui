/**
 * The geometry seam's second cut (`v3-expr-2-seam-tracks`): a focus that survives the gap between two
 * marks, the kit's own dim on a seam-drawn mark, group stepping with a linked list of groups, the
 * keyboard step scrolling the focused mark into view, the track axis and row labels, and the card's
 * legend row for seam-drawn marks. Real CSS geometry is in `tests/layout/charts-seam-track`.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act } from 'react'
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { contrastRatio } from '../tokens/hct'
import { chartLabels } from './chart-labels'
import type { ChartFocus } from './contract'
import { DIMMED } from './core/theme'
import { useChartFocus } from './focus'
import { ChartCard } from './parts/chart-card'

let root: ReturnType<typeof createRoot> | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})

async function mount(node: ReactElement): Promise<HTMLElement> {
  const el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
  await act(async () => root?.render(node))
  return el
}

const press = (target: Element, key: string) =>
  act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })

/** React's enter and leave come from `pointerover` and `pointerout` with a related target. */
const move = (from: Element | null, to: Element | null) =>
  act(async () => {
    const init = { bubbles: true, pointerType: 'mouse' }
    from?.dispatchEvent(new PointerEvent('pointerout', { ...init, relatedTarget: to }))
    to?.dispatchEvent(new PointerEvent('pointerover', { ...init, relatedTarget: from }))
  })

const live = (el: HTMLElement) => el.querySelector('[data-chart-focus-live]')?.textContent

type Sample = { version: string; day: number; ok: number }
const SAMPLES: readonly Sample[] = [
  { version: 'v1', day: 1, ok: 99 },
  { version: 'v1', day: 2, ok: 98 },
  { version: 'v2', day: 3, ok: 91 },
  { version: 'v2', day: 4, ok: 97 },
  { version: 'v2', day: 5, ok: 98 },
  { version: 'v3', day: 6, ok: 99 },
]
const VERSIONS = ['v1', 'v2', 'v3']

/** Every focused index the hook held, in render order. */
let seen: (number | null)[] = []

function Track({ grouped = false }: { grouped?: boolean }) {
  const focus = useChartFocus(SAMPLES, {
    announce: (s) => `day ${s.day}: ${s.ok}%`,
    ...(grouped && { group: (s: Sample) => s.version }),
  })
  seen.push(focus.index)
  return (
    <div>
      <div {...focus.target} aria-label="Quality per day" data-track="" className="flex gap-2">
        {SAMPLES.map((s, i) => (
          <div key={s.day} {...focus.item(i)} data-day={s.day}>
            {s.ok}
          </div>
        ))}
      </div>
      <ul>
        {VERSIONS.map((v) => (
          <li key={v} {...focus.groupItem(v)} data-version={v}>
            {v}
          </li>
        ))}
      </ul>
      {focus.live}
    </div>
  )
}

const day = (el: HTMLElement, d: number) => el.querySelector(`[data-day="${d}"]`) as Element
const version = (el: HTMLElement, v: string) => el.querySelector(`[data-version="${v}"]`) as Element

describe('pointer: the container clears, never a mark', () => {
  test('crossing the gap between two marks never drops the focus', async () => {
    seen = []
    const el = await mount(<Track />)
    const track = el.querySelector('[data-track]') as Element
    await move(null, day(el, 1))
    expect(day(el, 1).hasAttribute('data-focused')).toBe(true)
    seen = []
    // Out of mark 1 into the container's gap, then into mark 2.
    await move(day(el, 1), track)
    await move(track, day(el, 2))
    expect(seen.length).toBeGreaterThan(0)
    expect(seen.every((i) => i !== null)).toBe(true)
    expect(day(el, 2).hasAttribute('data-focused')).toBe(true)
    expect(day(el, 1).hasAttribute('data-dimmed')).toBe(true)
    // Leaving the container clears.
    await move(day(el, 2), document.body)
    expect(day(el, 1).hasAttribute('data-dimmed')).toBe(false)
    expect(day(el, 2).hasAttribute('data-focused')).toBe(false)
  })
})

describe('dim: the kit dims a seam-drawn mark as it dims its own', () => {
  test('every mark carries data-chart-mark, so the shipped rule reaches it', async () => {
    const el = await mount(<Track />)
    expect(el.querySelectorAll('[data-chart-mark]').length).toBe(SAMPLES.length)
  })

  test('the shipped rule uses DIMMED and fades only without reduced motion', () => {
    const css = readFileSync(join(import.meta.dirname, '../css/tailwind.css'), 'utf8')
    const rule = /\[data-chart-mark\]\[data-dimmed\] \{\s*opacity: ([\d.]+);/.exec(css)
    expect(Number(rule?.[1])).toBe(DIMMED)
    expect(css).toMatch(/prefers-reduced-motion: no-preference\) \{\s*\[data-chart-mark\]/)
  })

  test('the dimmed rest stays readable: ink at DIMMED clears 3:1 on the inset, light and dark', () => {
    const tokens = readFileSync(join(import.meta.dirname, '../css/tokens.css'), 'utf8')
    const all = (name: string) =>
      [...tokens.matchAll(new RegExp(`--vx-${name}: (#[0-9a-f]{6});`, 'g'))].map((m) => m[1])
    const [inkLight, inkDark] = all('ink')
    const [insetLight, insetDark] = all('inset')
    const mix = (fg: string, bg: string): string => {
      const ch = (hex: string, i: number) => Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
      const out = [0, 1, 2].map((i) =>
        Math.round(ch(fg, i) * DIMMED + ch(bg, i) * (1 - DIMMED))
          .toString(16)
          .padStart(2, '0'),
      )
      return `#${out.join('')}`
    }
    for (const [ink, inset] of [
      [inkLight, insetLight],
      [inkDark, insetDark],
    ] as [string, string][]) {
      expect(contrastRatio(mix(ink, inset), inset)).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('group stepping', () => {
  test('PageDown and PageUp move between groups and announce the group on entry', async () => {
    const el = await mount(<Track grouped />)
    const track = el.querySelector('[data-track]') as Element
    await press(track, 'PageDown')
    expect(day(el, 1).hasAttribute('data-focused')).toBe(true)
    expect(live(el)).toBe('v1: day 1: 99%')
    await press(track, 'PageDown')
    expect(day(el, 3).hasAttribute('data-focused')).toBe(true)
    expect(live(el)).toBe('v2: day 3: 91%')
    // Within a group, an arrow says only the datum.
    await press(track, 'ArrowRight')
    expect(live(el)).toBe('day 4: 97%')
    // PageUp goes to the group's start first, then to the previous group.
    await press(track, 'PageUp')
    expect(day(el, 3).hasAttribute('data-focused')).toBe(true)
    await press(track, 'PageUp')
    expect(day(el, 1).hasAttribute('data-focused')).toBe(true)
    expect(live(el)).toBe('v1: day 1: 99%')
    // An arrow that crosses into the next group names it.
    await press(track, 'ArrowRight')
    await press(track, 'ArrowRight')
    expect(live(el)).toBe('v2: day 3: 91%')
    // The last group stays put.
    await press(track, 'End')
    await press(track, 'PageDown')
    expect(day(el, 6).hasAttribute('data-focused')).toBe(true)
  })

  test('without a group, PageUp and PageDown are not the seam’s', async () => {
    const el = await mount(<Track />)
    const track = el.querySelector('[data-track]') as Element
    const event = new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true })
    await act(async () => {
      track.dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(false)
    expect(el.querySelector('[data-focused]')).toBeNull()
  })
})

describe('linked list of groups', () => {
  test('pointing at a group row focuses its first item; any item of the group marks the row', async () => {
    const el = await mount(<Track grouped />)
    await move(null, version(el, 'v2'))
    expect(day(el, 3).hasAttribute('data-focused')).toBe(true)
    expect(version(el, 'v2').hasAttribute('data-focused')).toBe(true)
    expect(version(el, 'v1').hasAttribute('data-focused')).toBe(false)
    await move(version(el, 'v2'), day(el, 5))
    expect(version(el, 'v2').hasAttribute('data-focused')).toBe(true)
    await move(day(el, 5), day(el, 6))
    expect(version(el, 'v3').hasAttribute('data-focused')).toBe(true)
    expect(version(el, 'v2').hasAttribute('data-focused')).toBe(false)
  })

  test('a group row is no tab stop', async () => {
    const el = await mount(<Track grouped />)
    expect(version(el, 'v1').hasAttribute('tabindex')).toBe(false)
  })
})

describe('scroll into view', () => {
  test('a keyboard step scrolls the focused mark and its group row; pointing does not', async () => {
    const calls: string[] = []
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function (this: Element) {
      calls.push(this.getAttribute('data-day') ?? this.getAttribute('data-version') ?? '?')
    }
    try {
      const el = await mount(<Track grouped />)
      const track = el.querySelector('[data-track]') as Element
      await press(track, 'PageDown')
      await press(track, 'PageDown')
      expect(calls).toEqual(['1', 'v1', '3', 'v2'])
      calls.length = 0
      await move(null, day(el, 5))
      expect(calls).toEqual([])
    } finally {
      Element.prototype.scrollIntoView = original
    }
  })
})

describe('host step', () => {
  test('focus.step answers the keys a host forwards, groups included', async () => {
    const handles: ChartFocus<Sample>[] = []
    function Probe() {
      handles.push(useChartFocus(SAMPLES, { announce: (s) => `${s.day}`, group: (s) => s.version }))
      return null
    }
    await mount(<Probe />)
    const handle = handles.at(-1)
    expect(handle?.step('PageDown')).toBe(0)
    expect(handle?.step('ArrowLeft')).toBe(SAMPLES.length - 1)
    expect(handle?.step('Tab')).toBeUndefined()
  })
})

describe('chartLabels.axis', () => {
  const seconds = (ms: number) => `${ms / 1000} s`

  test('the end tick is the niced domain end, end-anchored and nowrap', () => {
    const axis = chartLabels.axis({ domain: [0, 8120], format: seconds })
    expect(axis.domain).toEqual([0, 9000])
    const last = axis.ticks.at(-1)
    expect(last?.value).toBe(9000)
    expect(last?.label.style).toMatchObject({ right: 0 })
    expect(last?.label.className).toContain('whitespace-nowrap')
    expect(axis.ticks[0]?.label.style).toMatchObject({ left: 0 })
    expect(axis.at(4500)).toBe(0.5)
  })

  test('without nice, the domain end is its own tick and never crowds the one before', () => {
    const axis = chartLabels.axis({ domain: [0, 8120], format: seconds, nice: false })
    expect(axis.ticks.at(-1)?.value).toBe(8120)
    // 8 s sits 1.5 % before 8.12 s: no class can show both.
    expect(axis.ticks.some((t) => t.value === 8000 && !t.label.className.includes('@wide'))).toBe(
      false,
    )
  })

  test('the first and last ticks show at every width; narrower classes show a nested subset', () => {
    const axis = chartLabels.axis({ domain: [0, 8120], format: seconds })
    const tierOf = (className: string) =>
      /@(narrow|regular|wide):block/.exec(className)?.[1] ?? 'base'
    const show = (t: (typeof axis.ticks)[number]) => tierOf(t.label.className)
    expect(show(axis.ticks[0] as (typeof axis.ticks)[number])).toBe('base')
    expect(show(axis.ticks.at(-1) as (typeof axis.ticks)[number])).toBe('base')
    const at = (tier: string[]) => axis.ticks.filter((t) => tier.includes(show(t))).length
    expect(at(['base'])).toBeGreaterThanOrEqual(2)
    expect(at(['base', 'narrow', 'regular', 'wide'])).toBeGreaterThan(at(['base']))
    // A gridline shows exactly where its label does.
    for (const t of axis.ticks) expect(tierOf(t.line.className)).toBe(show(t))
  })

  test('no two labels shown at a class overlap at its floor width', () => {
    const axis = chartLabels.axis({ domain: [0, 8120], format: seconds })
    const tiers: [string[], number][] = [
      [['base'], 160],
      [['base', 'narrow'], 240],
      [['base', 'narrow', 'regular'], 480],
      [['base', 'narrow', 'regular', 'wide'], 800],
    ]
    const show = (cls: string) => /@(narrow|regular|wide):block/.exec(cls)?.[1] ?? 'base'
    for (const [shown, width] of tiers) {
      const spans = axis.ticks
        .filter((t) => shown.includes(show(t.label.className)))
        .map((t) => {
          const w = chartLabels.width(t.text)
          const x = t.at * width
          if ('left' in t.label.style && t.label.style.left === 0) return [0, w]
          if ('right' in t.label.style) return [width - w, width]
          return [x - w / 2, x + w / 2]
        })
      for (let i = 1; i < spans.length; i++) {
        expect((spans[i] as number[])[0] as number).toBeGreaterThanOrEqual(
          (spans[i - 1] as number[])[1] as number,
        )
      }
      for (const [l, r] of spans) {
        expect(l as number).toBeGreaterThanOrEqual(0)
        expect(r as number).toBeLessThanOrEqual(width)
      }
    }
  })

  test('a Date domain ticks on round instants', () => {
    const axis = chartLabels.axis({
      domain: [new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 11, 31))],
      format: (d) => d.toISOString().slice(0, 7),
    })
    expect(axis.ticks.length).toBeGreaterThan(2)
    expect(axis.ticks.every((t) => t.value instanceof Date)).toBe(true)
    expect(axis.at(axis.domain[1])).toBe(1)
  })
})

describe('chartLabels.row', () => {
  test('after the end, else inside the end, else before the start, else dropped', () => {
    // One mark per row, as on a waterfall.
    const spot = (from: number, to: number, text = '1.1 s', width = 300) => {
      const row = chartLabels.row([{ key: 'k', text, from, to }], { width })
      return row.placed[0]?.spot ?? 'dropped'
    }
    expect(spot(0, 0.1)).toBe('after')
    expect(spot(0.1, 0.98)).toBe('inside')
    expect(spot(0.6, 0.98)).toBe('inside')
    expect(spot(0.9, 0.98)).toBe('before')
    // No room on either side and too narrow inside.
    expect(spot(0.02, 0.98, 'a label far wider than the track can hold anywhere', 200)).toBe(
      'dropped',
    )
  })

  test('a mark on the same row is an obstacle to the other labels', () => {
    const { placed, dropped } = chartLabels.row(
      [
        { key: 'first', text: '0.4 s', from: 0, to: 0.3, priority: 1 },
        { key: 'second', text: '0.2 s', from: 0.32, to: 0.98 },
      ],
      { width: 300 },
    )
    // `first` cannot go after its end: the second mark starts 6 px later.
    expect(placed.find((p) => p.key === 'first')?.spot).toBe('inside')
    expect(placed.find((p) => p.key === 'second')?.spot).toBe('inside')
    expect(dropped).toEqual([])
  })

  test('a label clears an obstacle and the placed labels, highest priority first', () => {
    const { placed } = chartLabels.row(
      [
        { key: 'a', text: 'notice', from: 0.2, to: 0.22, priority: 1 },
        { key: 'b', text: 'renewal', from: 0.4, to: 0.45 },
      ],
      { width: 400, obstacles: [{ from: 0.23, to: 0.25 }] },
    )
    // `a` cannot go after (the obstacle), nor inside (too narrow): before its start.
    expect(placed.find((p) => p.key === 'a')?.spot).toBe('before')
    expect(placed.find((p) => p.key === 'b')?.spot).toBe('after')
  })

  test('lines drop every gridline under a placed label', () => {
    const axis = chartLabels.axis({ domain: [0, 10], nice: true })
    const row = chartLabels.row([{ key: 'x', text: '3 calls', from: 0, to: 0.18 }], {
      width: 400,
      grid: axis.ticks,
    })
    const label = row.placed[0]
    expect(label?.spot).toBe('after')
    const w = chartLabels.width('3 calls')
    // The label box is [76, 76 + w] at 400 px: the 80 gridline sits under it.
    const under = axis.ticks.filter((t) => t.at * 400 >= 76 && t.at * 400 <= 76 + w)
    expect(under.length).toBeGreaterThan(0)
    for (const t of under) expect(row.lines).not.toContain(t)
    expect(row.lines.length).toBe(axis.ticks.length - under.length)
  })

  test('props anchor at the mark edge in shares, so they hold at any wider width', () => {
    const { placed } = chartLabels.row([{ key: 'x', text: '1 s', from: 0.1, to: 0.25 }])
    expect(placed[0]?.props.style).toMatchObject({ left: '25%' })
    expect(placed[0]?.props['data-spot']).toBe('after')
  })
})

describe('ChartCard legend for seam-drawn marks', () => {
  const SERIES = { light: '#0077bd', dark: '#4aa3df' }
  const entries = [
    { key: 'dot', label: 'Notice', color: SERIES, swatch: 'dot' as const },
    { key: 'ring', label: 'Closed', color: SERIES, swatch: 'ring' as const },
    { key: 'hollow', label: 'Auto-renews', color: SERIES, swatch: 'hollow' as const },
    { key: 'bar', label: 'Step', color: SERIES, swatch: 'bar' as const },
  ]

  test('renders the dot, ring, hollow and bar swatch shapes in the server HTML', () => {
    // The server HTML, as shipped: happy-dom drops a `light-dark()` border from a parsed style.
    const html = renderToString(
      <ChartCard title="Renewals" legend={entries} chart={() => <div />} />,
    )
    const legend = /<div data-slot="chart-legend".*?<\/fieldset>/.exec(html)?.[0] ?? ''
    for (const e of entries) expect(legend).toContain(`>${e.label}<`)
    const swatches = [...legend.matchAll(/<span aria-hidden="true" style="([^"]*)"/g)].map(
      (m) => m[1] ?? '',
    )
    const round = /border-radius:\s*50%/
    const open = /border:\s*1\.5px/
    const shape = (style: string) =>
      round.test(style) ? (open.test(style) ? 'ring' : 'dot') : open.test(style) ? 'hollow' : 'bar'
    const shapes = new Set(swatches.map(shape))
    expect([...shapes].toSorted()).toEqual(['bar', 'dot', 'hollow', 'ring'])
  })

  test('the legend row stays in the loading phase, so the box does not move', async () => {
    const el = await mount(
      <ChartCard title="Renewals" legend={entries} phase="loading" chart={() => <div />} />,
    )
    expect(el.querySelector('[data-slot="chart-legend"]')).not.toBeNull()
  })
})
