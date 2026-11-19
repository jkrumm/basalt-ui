/**
 * `Heatmap` with `states` (expression cycle 6, n08): the ramp legend only when a cell draws the ramp,
 * the legend row inside a `matchHeight` box, a dimmed stated cell whose label stays readable, and
 * cell text at the body step. Through the rendered DOM; geometry is a layout concern (happy-dom has none).
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { BASALT } from '../../tokens'
import { contrastRatio } from '../../tokens/hct'
import { DEFAULT_DERIVE_CONFIG } from '../../tokens/derive'
import { buildPaletteData } from '../../tokens/palette'
import { DIMMED, DIMMED_TEXT } from '../core/theme'
import { useChartFocus } from '../focus'
import { Heatmap } from './heatmap'
import { stateInk } from './heatmap-ink'
import { hexToOklab } from '../../tokens/oklab'

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
  await act(async () => new Promise((r) => setTimeout(r, 20)))
  return el
}

type Cell = { row: string; col: string; v: number | null; s?: 'up' | 'down' }
const MIXED: Cell[] = [
  { row: 'a', col: '1', v: 3 },
  { row: 'a', col: '2', v: null, s: 'up' },
  { row: 'b', col: '1', v: null, s: 'down' },
  { row: 'b', col: '2', v: null, s: 'up' },
]
const ALL_STATED = MIXED.filter((c) => c.s !== undefined)
const STATES = [
  { key: 'up', label: 'Up', tone: 'good' },
  { key: 'down', label: 'Down', tone: 'bad' },
] as const

const getRow = (d: Cell) => d.row
const getCol = (d: Cell) => d.col
const getValue = (d: Cell) => d.v
const getState = (d: Cell) => d.s

const ramp = (el: HTMLElement) => el.querySelector('.ts-chart__legend--gradient')

function Plain(props: { data: Cell[]; legend?: false; matchHeight?: boolean }): ReactElement {
  return (
    <Heatmap
      label="Grid"
      data={props.data}
      getRow={getRow}
      getCol={getCol}
      getValue={getValue}
      getState={getState}
      states={STATES}
      annotate={() => '7'}
      {...(props.legend === false && { legend: false as const })}
      {...(props.matchHeight && { matchHeight: true })}
    />
  )
}

describe('the ramp legend', () => {
  test('a grid whose every cell is stated has no gradient, only the state key', async () => {
    const el = await mount(<Plain data={ALL_STATED} />)
    expect(ramp(el)).toBeNull()
    expect(el.textContent).toContain('Up')
    expect(el.textContent).toContain('Down')
  })

  test('a mix of stated and measured cells keeps the ramp and the key', async () => {
    const el = await mount(<Plain data={MIXED} />)
    expect(ramp(el)).not.toBeNull()
    expect(el.textContent).toContain('Down')
  })

  test('legend={false} still drops both', async () => {
    const el = await mount(<Plain data={MIXED} legend={false} />)
    expect(ramp(el)).toBeNull()
    expect(el.textContent).not.toContain('Down')
  })
})

describe('matchHeight', () => {
  test('the root is a column so the box shrinks to leave the legend row inside the parent height', async () => {
    const el = await mount(<Plain data={MIXED} matchHeight />)
    const rootEl = el.querySelector('[data-basalt-chart]') as HTMLElement
    expect(rootEl.style.display).toBe('flex')
    expect(rootEl.style.flexDirection).toBe('column')
    expect(rootEl.style.height).toBe('100%')
    const box = el.querySelector('[data-basalt-box="fill"]') as HTMLElement
    expect(box.parentElement).toBe(rootEl)
    expect(rootEl.lastElementChild).not.toBe(box)
  })
})

describe('cell text', () => {
  test('annotations draw at the body step, not the nano step', async () => {
    const el = await mount(<Plain data={MIXED} />)
    const sizes = [...el.querySelectorAll('g[data-ts-key="annotations"] text')].map((t) =>
      t.getAttribute('font-size'),
    )
    expect(sizes.length).toBeGreaterThan(0)
    expect(new Set(sizes)).toEqual(new Set([String(BASALT.text.md)]))
  })
})

function Focused(): ReactElement {
  const focus = useChartFocus(MIXED, { announce: (d) => `${d.row}${d.col}` })
  return (
    <Heatmap
      label="Grid"
      data={MIXED}
      getRow={getRow}
      getCol={getCol}
      getValue={getValue}
      getState={getState}
      states={STATES}
      annotate={() => '7'}
      focus={focus}
    />
  )
}

describe('a keyboard-focused cell', () => {
  const key = (el: HTMLElement, k: string) =>
    act(async () => {
      el.querySelector('[data-chart-focus]')?.dispatchEvent(
        new KeyboardEvent('keydown', { key: k, bubbles: true }),
      )
    })
  const ring = (el: HTMLElement) => el.querySelectorAll('g[data-ts-key="focus-ring"] rect')

  test('draws one ring on the cell the arrow keys reached, and none at rest or after Escape', async () => {
    const el = await mount(<Focused />)
    expect(ring(el).length).toBe(0)
    await key(el, 'ArrowRight')
    const cells = ring(el)
    expect(cells.length).toBe(1)
    expect(cells[0]?.getAttribute('stroke')).toBe('var(--basalt-brand)')
    expect(cells[0]?.getAttribute('stroke-width')).toBe('2')
    await key(el, 'Escape')
    expect(ring(el).length).toBe(0)
  })
})

const labelFills = (el: HTMLElement) =>
  [...el.querySelectorAll('g[data-ts-key="annotations"] text')].map((t) => t.getAttribute('fill'))

/** The ink a label takes on a fill: `inkOn`'s switch, black or white by the fill's OKLab lightness. */
const inkHex = (fill: string): string => (hexToOklab(fill).L < 0.565 ? '#ffffff' : '#000000')

const hex = (c: string): number[] => [1, 3, 5].map((i) => Number.parseInt(c.slice(i, i + 2), 16))
const out = (c: number[]): string =>
  `#${c.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`
const over = (fg: number[], a: number, bg: number[]): number[] =>
  fg.map((c, i) => a * c + (1 - a) * (bg[i] as number))

describe('a dimmed stated cell', () => {
  test('every label is the ink its own cell draws; a dimmed stated one takes the dimmed-fill ink', async () => {
    const el = await mount(<Focused />)
    expect(labelFills(el).every((f) => f?.startsWith('oklch(from '))).toBe(true)
    await act(async () => {
      el.querySelector('[data-chart-focus]')?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      )
    })
    const fills = labelFills(el)
    // The measured cell is focused first (reading order); the three stated cells dim.
    expect(fills.filter((f) => f === stateInk('var(--basalt-good)', 1, true)).length).toBe(2)
    expect(fills.filter((f) => f === stateInk('var(--basalt-bad)', 1, true)).length).toBe(1)
  })

  test('the label keeps 3:1 against the dimmed fill in both schemes, for every status tone', async () => {
    const data = buildPaletteData(DEFAULT_DERIVE_CONFIG)
    for (const side of ['light', 'dark'] as const) {
      const card = hex(data.SURFACE.panel[side])
      const muted = hex(data.INK.muted[side])
      for (const tone of ['good', 'warn', 'bad'] as const) {
        const fill = hex(data.SEMANTIC[tone][side])
        // `dimmedPaint` (marks.ts): light is the fill at DIMMED; dark is the fill at DIMMED_TEXT mixed with
        // 30% of the muted ink (alpha-premultiplied by color-mix), both over the card.
        const dimmed =
          side === 'light'
            ? over(fill, DIMMED, card)
            : (() => {
                const alpha = DIMMED_TEXT * 0.7 + 0.3
                const mixed = fill.map(
                  (c, i) => (DIMMED_TEXT * 0.7 * c + 0.3 * (muted[i] as number)) / alpha,
                )
                return over(mixed, alpha, card)
              })()
        const label = out(over(hex(inkHex(out(dimmed))), DIMMED_TEXT, dimmed))
        expect(contrastRatio(label, out(dimmed))).toBeGreaterThanOrEqual(3)
      }
    }
  })
})
