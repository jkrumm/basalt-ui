/**
 * IntervalTrack label ink is chosen by what the label sits on (Issue 2451): every label the track
 * draws holds 4.5:1 against its own ground in both schemes, at rest and on the lifted span. A span's
 * fill is its color mixed into the card under `TINT_CAP`, the share at which `ink` still holds for
 * any color at all, so the rule holds for a series color the kit has never seen.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { contrastRatio } from '../../tokens/hct'
import { useChartFocus } from '../focus'
import type { ChartFocus } from '../focus'
import { IntervalTrack, TINT, TINT_CAP } from './interval-track'
import type { IntervalSeries } from './interval-track'

type Scheme = 'light' | 'dark'
const SCHEMES: readonly Scheme[] = ['light', 'dark']

const sheet = readFileSync(join(import.meta.dirname, '../../css/tokens.css'), 'utf8')
const token = (name: string, scheme: Scheme): string => {
  const all = [...sheet.matchAll(new RegExp(`--basalt-${name}: (#[0-9a-f]{6});`, 'g'))]
  const hex = all[scheme === 'light' ? 0 : 1]?.[1]
  if (hex === undefined) throw new Error(`no --basalt-${name} in tokens.css`)
  return hex
}

const toRgb = (hex: string): number[] =>
  [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
const toHex = (rgb: readonly number[]): string =>
  `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
/** `fg` at `share` over `bg`, as `color-mix(in srgb, …)` lays it. */
const mix = (fg: string, bg: string, share: number): string =>
  toHex(toRgb(fg).map((v, i) => v * share + (toRgb(bg)[i] ?? 0) * (1 - share)))

/** The top-level comma-separated arguments of `fn(…)`. */
function args(value: string, fn: string): string[] {
  const inner = value.slice(fn.length + 1, -1)
  const out: string[] = []
  let depth = 0
  let from = 0
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ',' && depth === 0) {
      out.push(inner.slice(from, i).trim())
      from = i + 1
    }
  }
  out.push(inner.slice(from).trim())
  return out
}

/** A paint the track writes, resolved to a hex in one scheme. */
function resolve(value: string, scheme: Scheme): string {
  const v = value.trim()
  if (v.startsWith('#')) return v
  const tokenName = /^var\(--basalt-([a-z0-9-]+)\)$/.exec(v)?.[1]
  if (tokenName !== undefined) return token(tokenName, scheme)
  if (v.startsWith('light-dark(')) {
    const [light, dark] = args(v, 'light-dark')
    return resolve((scheme === 'light' ? light : dark) ?? '', scheme)
  }
  if (v.startsWith('color-mix(')) {
    const [, a = '', b = ''] = args(v, 'color-mix')
    const m = /^(.*) (\d+)%$/.exec(a)
    if (m === null) throw new Error(`unparsed mix ${a}`)
    return mix(resolve(m[1] ?? '', scheme), resolve(b, scheme), Number(m[2]) / 100)
  }
  throw new Error(`unresolved paint ${v}`)
}

describe('the tint cap', () => {
  // The cube's corners and the playground's calendar and sleep series: the darkest and the lightest
  // colors a series file can name, and the ones the kit draws.
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((n) =>
    toHex([4, 2, 1].map((bit) => ((n & bit) !== 0 ? 255 : 0))),
  )
  const kit = [
    '#2871c7',
    '#5190f7',
    '#4a4a4a',
    '#c4c4c4',
    '#9a9a9a',
    '#7d7d7d',
    '#2b4a9b',
    '#6c8cf0',
  ]
  for (const scheme of SCHEMES) {
    test(`${scheme}: ink holds 4.5:1 on any color mixed in at the cap`, () => {
      const card = token('card', scheme)
      for (const c of [...corners, ...kit]) {
        expect(
          contrastRatio(token('ink', scheme), mix(c, card, TINT_CAP[scheme])),
        ).toBeGreaterThanOrEqual(4.5)
      }
    })
    test(`${scheme}: a span at rest sits under the cap`, () => {
      expect(TINT[scheme]).toBeLessThanOrEqual(TINT_CAP[scheme])
    })
  }
})

type Span = { id: number; row: string; start: number; end: number; kind: K; label: string | null }
type K = 'deep' | 'pale' | 'blue' | 'grey' | 'free' | 'block'
const SERIES: readonly IntervalSeries<K>[] = [
  { key: 'deep', label: 'Deep', color: { light: '#000000', dark: '#1a1a1a' } },
  { key: 'pale', label: 'Pale', color: { light: '#f0f0f0', dark: '#ffffff' } },
  { key: 'blue', label: 'Blue', color: { light: '#2871c7', dark: '#5190f7' } },
  { key: 'grey', label: 'Grey', color: { light: '#9a9a9a', dark: '#7d7d7d' }, fill: 'outline' },
  {
    key: 'free',
    label: 'Free',
    color: { light: '#2871c7', dark: '#5190f7' },
    fill: 'outline',
    layer: 'back',
  },
  { key: 'block', label: 'Block', color: { light: '#000000', dark: '#ffffff' }, layer: 'back' },
]
const SPANS: readonly Span[] = [
  { id: 0, row: 'Mon', start: 0, end: 300, kind: 'deep', label: 'Deep' },
  { id: 1, row: 'Mon', start: 300, end: 600, kind: 'pale', label: 'Pale' },
  { id: 2, row: 'Tue', start: 0, end: 300, kind: 'blue', label: 'Blue' },
  { id: 3, row: 'Tue', start: 300, end: 330, kind: 'grey', label: 'A long outside label' },
  { id: 4, row: 'Wed', start: 100, end: 500, kind: 'free', label: 'Free' },
  { id: 5, row: 'Thu', start: 300, end: 900, kind: 'block', label: 'Block' },
  { id: 6, row: 'Thu', start: 320, end: 400, kind: 'blue', label: null },
]

let root: ReturnType<typeof createRoot> | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})

const idOf = (key: string | null): number => Number(key?.split(':').at(-1))

describe('every label against its own ground', () => {
  test('inside a span, on the card and on the row band, at rest and lifted, in both schemes', async () => {
    const el = document.createElement('div')
    document.body.append(el)
    root = createRoot(el)
    let handle: ChartFocus<Span> | undefined
    function Track() {
      const focus = useChartFocus(SPANS, { announce: (s) => s.label ?? s.kind })
      useEffect(() => {
        handle = focus
      })
      return (
        <IntervalTrack
          label="Ink"
          data={SPANS}
          rows={['Mon', 'Tue', 'Wed', 'Thu']}
          getRow={(s) => s.row}
          getStart={(s) => s.start}
          getEnd={(s) => s.end}
          series={SERIES}
          getSeries={(s) => s.kind}
          getLabel={(s) => s.label}
          rowExtent={() => [0, 600]}
          xDomain={[0, 1000]}
          focus={focus}
        />
      )
    }
    await act(async () => root?.render(<Track />))

    for (const focusId of [null, 0, 2, 5]) {
      await act(async () => handle?.set(focusId))
      await act(async () => new Promise((r) => setTimeout(r, 20)))
      const rects = [...el.querySelectorAll('rect')]
      const span = (id: number) =>
        rects.find(
          (r) => r.dataset['tsKey']?.startsWith('span:') && idOf(r.dataset['tsKey'] ?? null) === id,
        )
      const lift = rects.find((r) => r.dataset['tsKey']?.startsWith('lift'))
      const band = rects.find((r) => r.dataset['tsKey']?.startsWith('row-extent'))
      const labels = [...el.querySelectorAll('text')].filter((t) =>
        t.dataset['tsKey']?.startsWith('labels:'),
      )
      expect(labels.length).toBeGreaterThan(3)
      let inside = 0
      for (const t of labels) {
        const id = idOf(t.dataset['tsKey'] ?? null)
        const box = span(id)
        const x = Number(t.getAttribute('x'))
        const left = Number(box?.getAttribute('x'))
        const right = left + Number(box?.getAttribute('width'))
        const onSpan = t.getAttribute('text-anchor') === 'end' && x > left && x <= right
        const fill = SERIES.find((s) => s.key === SPANS[id]?.kind)?.fill
        const grounds: string[] = []
        if (onSpan && fill !== 'outline') {
          inside++
          // Inside a tinted span, lane or back, the label is the ink: the cap is set for it.
          expect(t.getAttribute('fill')).toBe('var(--basalt-ink)')
          grounds.push(box?.getAttribute('fill') ?? '')
          const liftFill = lift?.getAttribute('fill') ?? 'none'
          if (id === focusId && liftFill !== 'none') grounds.push(liftFill)
        } else {
          grounds.push('var(--basalt-card)')
          grounds.push(`color-mix(in srgb, var(--basalt-line) 8%, var(--basalt-card))`)
        }
        for (const scheme of SCHEMES)
          for (const ground of grounds) {
            const ratio = contrastRatio(
              resolve(t.getAttribute('fill') ?? '', scheme),
              resolve(ground, scheme),
            )
            expect({ label: t.textContent, scheme, ratio: ratio >= 4.5 }).toEqual({
              label: t.textContent,
              scheme,
              ratio: true,
            })
          }
      }
      expect(inside).toBeGreaterThan(0)
      // A back span lifts as a ring only: a tint over its row would cover the lane spans on it.
      if (focusId === 5) expect(lift?.getAttribute('fill')).toBe('none')
      expect(band?.getAttribute('fill')).toContain('8%')
    }
  })
})
