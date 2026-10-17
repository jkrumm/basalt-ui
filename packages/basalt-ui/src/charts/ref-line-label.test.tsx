/** `RefLine.label`: on-plot text at the line's plot end — flips below near the top, follows the legend toggle. */
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { Bars } from './Bars'
import { Lines } from './Lines'
import type { ChartSeries, RefLine } from './types'

type Row = { t: Date; a: number }
const data: Row[] = [1, 2, 3, 4].map((d) => ({ t: new Date(Date.UTC(2026, 8, d)), a: d * 100 }))
const x = (d: Row): Date => d.t
const a: ChartSeries<Row> = {
  key: 'a',
  label: 'Alpha',
  color: 'var(--vx-line)',
  getValue: (d) => d.a,
}

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

const ssr = (node: React.ReactNode): HTMLElement => {
  const el = document.createElement('div')
  el.innerHTML = renderToString(node)
  return el
}

const labelOf = (el: Element, i: number): Element | null =>
  el.querySelector(`g[data-ts-key="ref-${i}-label"]`)
const ruleOf = (el: Element, i: number): Element | null =>
  el.querySelector(`g[data-ts-key="ref-${i}"]`)

/** The label's y minus its line's y: negative above, positive below. */
const offset = (el: Element, i: number): number => {
  const line = ruleOf(el, i)?.querySelector('line')
  const label = labelOf(el, i)?.querySelector('text')
  return Number(label?.getAttribute('y')) - Number(line?.getAttribute('y1'))
}

const ref = (over: Partial<RefLine> = {}): RefLine => ({
  value: 250,
  color: 'var(--vx-good-ref)',
  label: '250 target',
  ...over,
})
const lines = (refLines: RefLine[], extra: object = {}) => (
  <Lines ariaLabel="L" data={data} x={x} series={[a]} refLines={refLines} {...extra} />
)

describe('RefLine.label', () => {
  test('renders the text, in the ink token rather than the line colour', () => {
    const el = ssr(lines([ref()]))
    const group = labelOf(el, 0)
    expect(group?.textContent).toBe('250 target')
    expect(group?.innerHTML).toContain('var(--vx-ink2)')
    expect(group?.innerHTML).not.toContain('--vx-good-ref')
  })

  test('sits above the line by default', () => {
    const el = ssr(lines([ref()]))
    expect(offset(el, 0)).toBeLessThan(0)
  })

  test('flips below the line near the top of the plot', () => {
    const el = ssr(lines([ref({ value: 400 })], { y: { domain: [0, 400] } }))
    expect(offset(el, 0)).toBeGreaterThan(0)
  })

  test('works on Bars', () => {
    const el = ssr(<Bars ariaLabel="B" data={data} x={x} bars={[a]} refLines={[ref()]} />)
    expect(labelOf(el, 0)?.textContent).toBe('250 target')
  })

  test('a right-axis line labels at the left end, clear of the right tick labels', () => {
    const b: ChartSeries<Row> = { ...a, key: 'b', axis: 'right' }
    const el = ssr(
      <Lines
        ariaLabel="L"
        data={data}
        x={x}
        series={[a, b]}
        y2={{}}
        refLines={[ref({ axis: 'right' })]}
      />,
    )
    expect(labelOf(el, 0)?.innerHTML).toContain('text-anchor="start"')
  })

  test('a left-axis line labels at the right end', () => {
    const el = ssr(lines([ref()]))
    expect(labelOf(el, 0)?.innerHTML).toContain('text-anchor="end"')
  })

  test('toggling the line off in the legend hides its label too', async () => {
    const el = await mount(lines([ref({ legend: { label: 'Target' } })]))
    expect(labelOf(el, 0)).not.toBeNull()
    const toggle = el.querySelector('button[data-legend-key="__ref-0"]')
    if (!(toggle instanceof HTMLButtonElement)) throw new Error('no toggle')
    await act(async () => {
      toggle.click()
    })
    expect(ruleOf(el, 0)).toBeNull()
    expect(labelOf(el, 0)).toBeNull()
  })

  test('no label: no label mark', () => {
    const el = ssr(lines([ref({ label: undefined })]))
    expect(labelOf(el, 0)).toBeNull()
    expect(el.querySelector('g[data-ts-key$="-label"]')).toBeNull()
  })
})
