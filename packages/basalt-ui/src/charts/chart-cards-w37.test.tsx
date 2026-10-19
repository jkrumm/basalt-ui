/**
 * Wave 37, the card half: `ChartFact` tone and several trailing texts, a stale `ChartCard`, the
 * `Sparkline` tone / reference label / day readout, per-state glyphs on `BandStrip` and `Heatmap`,
 * the `Heatmap` status tone, and the generic error noun.
 */
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { BandStrip } from './BandStrip'
import type { BandStripSeries } from './BandStrip'
import { DEFAULT_DERIVE_CONFIG } from '../tokens/derive'
import { contrastRatio } from '../tokens/hct'
import { buildPaletteData } from '../tokens/palette'
import { ChartCard } from './ChartCard'
import { Heatmap } from './Heatmap'
import { Sparkline } from './Sparkline'

const css = readFileSync(new URL('./chart-card.module.css', import.meta.url), 'utf8')
const sparkCss = readFileSync(new URL('./sparkline.module.css', import.meta.url), 'utf8')
const block = (source: string, selector: string): string =>
  source.match(new RegExp(`${selector.replaceAll('"', `["']`)}[^{]*\\{([^}]*)\\}`))?.[1] ?? ''

let root: ReturnType<typeof createRoot> | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})
async function mount(node: React.ReactNode): Promise<HTMLElement> {
  const el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
  await act(async () => {
    root?.render(node)
  })
  return el
}
const dom = (html: string): HTMLElement => {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}
const glyphs = (root: ParentNode, mark = '[data-ts-key$="glyphs"]'): string[] =>
  [...root.querySelectorAll(`svg ${mark} text`)].map((t) => t.textContent ?? '')

describe('ChartFact tone and trailing texts (item 1)', () => {
  test('tone is carried on the fact and paints ink only, never a fill', () => {
    const { container } = render(<ChartCard title="W" facts={{ value: '81', tone: 'warn' }} />)
    expect(container.querySelector('[data-basalt-fact]')?.getAttribute('data-tone')).toBe('warn')
    for (const tone of ['warn', 'bad', 'good', 'muted']) {
      const rule = block(css, `\\.fact\\[data-tone="${tone}"\\]`)
      expect(rule).toContain('color')
      expect(rule).not.toContain('background')
    }
    expect(block(css, '\\.fact\\[data-tone="warn"\\]')).toContain('--vx-status-warn')
    expect(block(css, '\\.fact\\[data-tone="muted"\\]')).toContain('--vx-muted')
  })
  test('no tone: no attribute', () => {
    const { container } = render(<ChartCard title="W" facts={{ value: '81' }} />)
    expect(container.querySelector('[data-basalt-fact]')?.hasAttribute('data-tone')).toBe(false)
  })
  test('period takes a list, joined by the house separator', () => {
    const { container } = render(
      <ChartCard
        title="W"
        facts={{ value: '81', period: ['last entry 3 d ago', '12 entries', '7 d mean'] }}
      />,
    )
    expect(container.querySelector('[data-basalt-fact]')?.textContent).toContain(
      'last entry 3 d ago · 12 entries · 7 d mean',
    )
  })
  test('a single string period still works', () => {
    const { getByText } = render(
      <ChartCard title="W" facts={{ value: '81', period: 'last 30 d' }} />,
    )
    expect(getByText('last 30 d')).toBeTruthy()
  })
})

describe('ChartCard stale facts (item 2)', () => {
  test('stale dims the facts with the strip cell value, not the plot', () => {
    const { container } = render(
      <ChartCard title="W" stale facts={{ value: '81' }}>
        <i data-testid="plot" />
      </ChartCard>,
    )
    expect(container.querySelector('[data-basalt-facts-row]')?.hasAttribute('data-stale')).toBe(
      true,
    )
    // The dim is the facts row's: the basis subtitle under it stays full ink.
    expect(container.querySelector('[data-basalt-facts]')?.hasAttribute('data-stale')).toBe(false)
    expect(block(css, '\\.factsRow\\[data-stale\\]')).toContain('opacity: 0.55')
    const strip = readFileSync(
      new URL('../dashboard/stat-strip.module.css', import.meta.url),
      'utf8',
    )
    expect(block(strip, '\\.content\\[data-stale\\]')).toContain('opacity: 0.55')
  })
  test('not stale: no attribute', () => {
    const { container } = render(<ChartCard title="W" facts={{ value: '81' }} />)
    expect(container.querySelector('[data-basalt-facts]')?.hasAttribute('data-stale')).toBe(false)
  })
})

describe('Sparkline (items 3 and 7)', () => {
  const data = [10, 20, 30, 40, 50]
  test("tone='muted' draws the muted line", () => {
    const html = renderToString(<Sparkline ariaLabel="S" data={data} height={30} tone="muted" />)
    expect(html).toContain('--vx-muted')
    expect(renderToString(<Sparkline ariaLabel="S" data={data} height={30} />)).not.toContain(
      '--vx-muted',
    )
  })
  test('an explicit color beats tone', () => {
    const html = renderToString(
      <Sparkline ariaLabel="S" data={data} height={30} tone="muted" color="var(--vx-good)" />,
    )
    expect(html).toContain('--vx-good')
    expect(html).not.toContain('--vx-muted')
  })
  test('the reference takes a short label drawn in the plot', () => {
    const labelled = renderToString(
      <Sparkline ariaLabel="S" data={data} height={30} reference={42} referenceLabel="PR" />,
    )
    expect(glyphs(dom(labelled), '[data-ts-key="reference-label"]')).toContain('PR')
    const bare = renderToString(<Sparkline ariaLabel="S" data={data} height={30} reference={42} />)
    expect(glyphs(dom(bare), '[data-ts-key="reference-label"]')).not.toContain('PR')
  })
  test('the end marker sits inside the svg box with air for the focus outline', () => {
    const svg = dom(
      renderToString(<Sparkline ariaLabel="S" data={data} height={30} />),
    ).querySelector('svg')
    const [, , w, h] = (svg?.getAttribute('viewBox') ?? '').split(' ').map(Number)
    const dot = svg?.querySelector('circle')
    const [cx = 0, cy = 0, r = 0] = ['cx', 'cy', 'r'].map((a) => Number(dot?.getAttribute(a)))
    expect(cx + (r ?? 0)).toBeLessThanOrEqual((w ?? 0) - 2)
    expect(cy - (r ?? 0)).toBeGreaterThanOrEqual(2)
    expect(cy + (r ?? 0)).toBeLessThanOrEqual((h ?? 0) - 2)
  })
  test('focus lands on the last point and the readout states value then day', async () => {
    const el = await mount(
      <Sparkline
        ariaLabel="S"
        data={[1, 2, 3]}
        height={30}
        labels={['10 Oct', '11 Oct', '12 Oct']}
        format={(v) => `${v} items`}
      />,
    )
    await act(async () => {
      el.querySelector('svg')?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    })
    const readout = el.querySelector<HTMLElement>('[data-basalt-sparkline-readout]')
    expect(readout?.textContent?.replace(/\s+/g, ' ').trim()).toBe('3 items · 12 Oct')
  })
  test('the readout sits next to the point, not pinned to a corner', async () => {
    const el = await mount(
      <Sparkline ariaLabel="S" data={[1, 2, 3]} height={48} labels={['a', 'b', 'c']} />,
    )
    await act(async () => {
      el.querySelector('svg')?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    })
    const style = el.querySelector<HTMLElement>('[data-basalt-sparkline-readout]')?.style
    // The last point is at the right edge: the chip hangs off its left, a fraction of the box.
    expect(style?.right).toMatch(/%/)
    expect(block(sparkCss, '\\.readout')).not.toContain('right: 0')
  })
})

describe('BandStrip per-state glyph (item 4)', () => {
  type Day = { t: string; s: 'ok' | 'warn' | 'bad' }
  const states: (BandStripSeries<Day> & { key: Day['s'] })[] = [
    { key: 'ok', label: 'OK', color: 'var(--vx-good)' },
    { key: 'warn', label: 'Warn', color: 'var(--vx-status-warn)', glyph: '!' },
    { key: 'bad', label: 'Bad', color: 'var(--vx-status-bad)', glyph: '×' },
  ]
  const data: Day[] = [
    { t: 'a', s: 'ok' },
    { t: 'b', s: 'warn' },
    { t: 'c', s: 'bad' },
    { t: 'd', s: 'bad' },
  ]
  test('a state with a glyph draws it in each of its bands, a state without draws none', () => {
    const html = renderToString(
      <BandStrip
        ariaLabel="B"
        data={data}
        x={(d) => d.t}
        states={states}
        getBand={(d) => ({ state: d.s })}
      />,
    )
    expect(glyphs(dom(html)).toSorted()).toEqual(['!', '×', '×'])
  })
})

describe('Heatmap status states (items 5 and 6)', () => {
  type Cell = { row: string; col: string; s?: 'ok' | 'down' | 'degraded' }
  const data: Cell[] = [
    { row: 'a', col: '0', s: 'ok' },
    { row: 'a', col: '1', s: 'down' },
    { row: 'b', col: '0', s: 'degraded' },
    { row: 'b', col: '1', s: 'ok' },
  ]
  const base = {
    ariaLabel: 'H',
    data,
    getRow: (d: Cell) => d.row,
    getCol: (d: Cell) => d.col,
    getValue: () => null,
    getState: (d: Cell) => d.s,
  }
  test('tone maps a category straight to the status colour, no dist-reading', () => {
    const el = dom(
      renderToString(
        <Heatmap
          {...base}
          states={[
            { key: 'ok', label: 'OK', tone: 'good' },
            { key: 'degraded', label: 'Degraded', tone: 'warn' },
            { key: 'down', label: 'Down', tone: 'bad' },
          ]}
        />,
      ),
    )
    const fills = [...el.querySelectorAll('rect')].map((r) => r.getAttribute('fill'))
    expect(fills).toContain('var(--vx-status-bad)')
    expect(fills).toContain('var(--vx-status-warn)')
    expect(fills).toContain('var(--vx-status-good)')
  })
  test('warn and bad carry a default glyph (a second channel); good does not', () => {
    const el = dom(
      renderToString(
        <Heatmap
          {...base}
          states={[
            { key: 'ok', label: 'OK', tone: 'good' },
            { key: 'degraded', label: 'Degraded', tone: 'warn' },
            { key: 'down', label: 'Down', tone: 'bad' },
          ]}
        />,
      ),
    )
    const g = glyphs(el)
    expect(g).toHaveLength(2)
    expect(new Set(g).size).toBe(2)
  })
  test('an explicit glyph on a colour state is drawn; glyph "" opts out', () => {
    const el = dom(
      renderToString(
        <Heatmap
          {...base}
          states={[
            { key: 'ok', label: 'OK', color: 'var(--vx-good)' },
            { key: 'degraded', label: 'Degraded', color: 'var(--vx-status-warn)', glyph: '~' },
            { key: 'down', label: 'Down', tone: 'bad', glyph: '' },
          ]}
        />,
      ),
    )
    expect(glyphs(el)).toEqual(['~'])
  })
})

describe('Error state noun (item 7)', () => {
  test('the default names no noun', () => {
    const { container } = render(<ChartCard title="T" state={{ error: new Error('boom') }} />)
    const text = container.querySelector('[role="alert"]')?.textContent ?? ''
    expect(text).toContain('Could not load')
    expect(text).not.toContain('this chart')
  })
  test('the card takes its own noun', () => {
    const { container } = render(
      <ChartCard title="T" stateNoun="stuck items" state={{ error: new Error('boom') }} />,
    )
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not load stuck items',
    )
  })
})

describe('BandStrip default glyphs and glyph contrast (review round 1)', () => {
  type Day = { t: string; s: 'ok' | 'warn' | 'bad' }
  const data: Day[] = [
    { t: 'a', s: 'ok' },
    { t: 'b', s: 'warn' },
    { t: 'c', s: 'bad' },
  ]
  const strip = (states: BandStripSeries<Day>[]) =>
    dom(
      renderToString(
        <BandStrip
          ariaLabel="B"
          data={data}
          x={(d) => d.t}
          states={states as (BandStripSeries<Day> & { key: Day['s'] })[]}
          getBand={(d) => ({ state: d.s })}
        />,
      ),
    )
  test('a warn / bad status state draws ! / × without naming a glyph', () => {
    const el = strip([
      { key: 'ok', label: 'OK', color: 'var(--vx-status-good)' },
      { key: 'warn', label: 'Warn', color: 'var(--vx-status-warn)' },
      { key: 'bad', label: 'Bad', color: 'var(--vx-status-bad)', tone: 'bad' },
    ])
    expect(glyphs(el).toSorted()).toEqual(['!', '×'])
  })
  test("glyph '' opts out, and a non-status colour draws nothing", () => {
    const el = strip([
      { key: 'ok', label: 'OK', color: 'var(--vx-good)' },
      { key: 'warn', label: 'Warn', color: 'var(--vx-status-warn)', glyph: '' },
      { key: 'bad', label: 'Bad', color: 'var(--vx-accent)' },
    ])
    expect(glyphs(el)).toEqual([])
  })
  test('the glyph ink is the panel surface, which clears 3:1 on every status fill in both schemes', () => {
    const el = strip([
      { key: 'ok', label: 'OK', color: 'var(--vx-good)' },
      { key: 'warn', label: 'Warn', color: 'var(--vx-status-warn)' },
      { key: 'bad', label: 'Bad', color: 'var(--vx-status-bad)' },
    ])
    for (const t of el.querySelectorAll('svg [data-ts-key$="glyphs"] text'))
      expect(t.getAttribute('fill')).toBe('var(--vx-surface-panel)')
    const data = buildPaletteData(DEFAULT_DERIVE_CONFIG)
    for (const side of ['light', 'dark'] as const)
      for (const kind of ['good', 'warn', 'bad'] as const)
        expect(
          contrastRatio(data.SURFACE.panel[side], data.STATUS[kind][side]),
        ).toBeGreaterThanOrEqual(3)
  })
})
