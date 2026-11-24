import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import type { ReactElement } from 'react'
import { Sparkline } from './sparkline'
import { LINE_CAP, pool, toRows } from './sparkline-shared'

afterEach(cleanup)

const LABELS = ['Mon', 'Today', 'Sun'] as const
const dom = (node: ReactElement): HTMLElement => {
  const el = document.createElement('div')
  el.innerHTML = renderToString(node)
  return el
}
const segments = (d: string | null | undefined): number => (d ?? '').split('M').length - 1
const middle = (): string | null =>
  document.querySelector('[data-slot="spark-labels"]')!.children[1]!.textContent
const live = (): string | null =>
  document.querySelector('[data-slot="spark-live"]')?.textContent ?? null

describe('Sparkline frame', () => {
  test('without axisLabels it is an image with the name and no tab stop', () => {
    render(<Sparkline points={[1, 3, 2]} label="Shipped per day" height={40} />)
    const img = screen.getByRole('img', { name: 'Shipped per day' })
    expect(img.getAttribute('tabindex')).toBe('-1')
    expect(document.querySelector('[data-slot="spark-labels"]')).toBeNull()
    expect(document.querySelectorAll('[tabindex="0"]')).toHaveLength(0)
  })

  test('with axisLabels it is one chart tab stop that answers: arrows, Home and End move the readout', () => {
    render(<Sparkline points={[10, 20, 30, 40]} label="Shipped" height={72} axisLabels={LABELS} />)
    const host = screen.getByRole('group', { name: 'Shipped' })
    expect(host.getAttribute('aria-roledescription')).toBe('chart')
    expect(host.getAttribute('tabindex')).toBe('0')
    expect(middle()).toBe('Today')
    fireEvent.keyDown(host, { key: 'Home' })
    expect(host.getAttribute('data-active-index')).toBe('0')
    expect(live()).toBe('#1: 10')
    expect(middle()).toBe('10 · #1')
    fireEvent.keyDown(host, { key: 'ArrowRight' })
    expect(host.getAttribute('data-active-index')).toBe('1')
    fireEvent.keyDown(host, { key: 'ArrowLeft' })
    fireEvent.keyDown(host, { key: 'ArrowLeft' })
    expect(host.getAttribute('data-active-index')).toBe('0')
    fireEvent.keyDown(host, { key: 'End' })
    expect(host.getAttribute('data-active-index')).toBe('3')
    expect(middle()).toBe('40 · #4')
    fireEvent.blur(host)
    expect(middle()).toBe('Today')
    expect(live()).toBe('')
  })

  test('a hover over bare numbers reads an x and a y, and draws a guide to each edge', () => {
    render(<Sparkline points={[4, 9, 6, 12]} label="S" height={72} axisLabels={LABELS} />)
    const plot = document.querySelector<HTMLElement>('[data-slot="spark-plot"]')!
    // happy-dom has no layout: a zero-width plot puts every pointer on the last point.
    fireEvent.pointerMove(plot, { clientX: 0 })
    expect(middle()).toBe('12 · #4')
    expect(document.querySelector('[data-slot="spark-guide"]')).not.toBeNull()
    expect(document.querySelector('[data-slot="spark-guide-y"]')).not.toBeNull()
    fireEvent.pointerLeave(plot)
    expect(middle()).toBe('Today')
    expect(document.querySelector('[data-slot="spark-guide-y"]')).toBeNull()
  })

  test('a plain key does nothing', () => {
    render(<Sparkline points={[1, 2]} label="S" height={72} axisLabels={LABELS} />)
    const host = screen.getByRole('group')
    fireEvent.focus(host)
    fireEvent.keyDown(host, { key: 'a' })
    expect(host.getAttribute('data-active-index')).toBe('1')
  })

  test('a named point reads its name in the readout and is announced name first', () => {
    const weeks = [8.1, 6, 38, 7].map((value, i) => ({ value, label: `W${41 + i}` }))
    render(
      <Sparkline
        points={weeks}
        label="Time in queue"
        height={72}
        axisLabels={['W41', 'Time in queue', 'W44']}
        format={(v) => `${v} h`}
      />,
    )
    const host = screen.getByRole('group', { name: 'Time in queue' })
    fireEvent.keyDown(host, { key: 'Home' })
    expect(middle()).toBe('8.1 h · W41')
    expect(live()).toBe('W41: 8.1 h')
    fireEvent.keyDown(host, { key: 'ArrowRight' })
    expect(live()).toBe('W42: 6 h')
  })

  test('a stepped point dims the line and draws a guide at it; rest is full strength', () => {
    render(<Sparkline points={[1, 3, 2]} label="S" height={72} axisLabels={LABELS} />)
    const line = (): Element => document.querySelector('[data-slot="spark-line"]')!
    expect(line().getAttribute('stroke-opacity')).toBe('1')
    expect(document.querySelector('[data-slot="spark-guide"]')).toBeNull()
    fireEvent.keyDown(screen.getByRole('group'), { key: 'Home' })
    expect(Number(line().getAttribute('stroke-opacity'))).toBeLessThan(1)
    expect(document.querySelector('[data-slot="spark-guide"]')?.getAttribute('x1')).toBe('0')
  })

  test('the text alternative is a summary of min, max and last unless one is given', () => {
    expect(dom(<Sparkline points={[2, 9, 4]} label="S" height={30} />).textContent).toContain(
      'Min 2, max 9, last 4',
    )
    expect(
      dom(<Sparkline points={[2, 9, 4]} label="S" height={30} summary="Up on Tuesday" />)
        .textContent,
    ).toContain('Up on Tuesday')
    expect(dom(<Sparkline points={[null]} label="S" height={30} />).textContent).toContain(
      'No data',
    )
  })

  test('a dated point reads its day in the readout and a gap reads an em dash', () => {
    const at = Date.UTC(2026, 9, 12)
    render(
      <Sparkline
        points={[
          { at, value: 3 },
          { at: at + 86_400_000, value: null },
        ]}
        label="S"
        height={72}
        axisLabels={LABELS}
        format={(v) => `${v} items`}
      />,
    )
    const host = screen.getByRole('group')
    fireEvent.keyDown(host, { key: 'Home' })
    expect(middle()).toBe('3 items · Oct 12')
    expect(live()).toBe('Oct 12: 3 items')
    fireEvent.keyDown(host, { key: 'End' })
    expect(middle()).toBe('—')
    expect(live()).toBe('Oct 13: no data')
  })
})

describe('Sparkline cap', () => {
  test('a target range past the cap keeps its band, held at the cap; a lone line past it is not drawn', () => {
    const range = dom(
      <Sparkline
        points={[2, 3, 4]}
        label="S"
        height={40}
        cap={6}
        reference={{ min: 2, max: 20 }}
      />,
    )
    expect(range.querySelectorAll('[data-slot="spark-reference"]')).toHaveLength(2)
    expect(range.querySelector('[data-slot="spark-band"]')).not.toBeNull()
    const line = dom(<Sparkline points={[2, 3, 4]} label="S" height={40} cap={6} reference={9} />)
    expect(line.querySelector('[data-slot="spark-reference"]')).toBeNull()
  })

  test('a point above the cap is held on the top edge under a caret; the summary keeps it', () => {
    const el = dom(<Sparkline points={[2, 3, 38, 4]} label="S" height={40} cap={6} />)
    const carets = el.querySelectorAll('[data-slot="spark-caret"]')
    expect(carets).toHaveLength(1)
    expect(carets[0]?.textContent).toBe('▲')
    expect(el.textContent).toContain('max 38')
    // The plot scales to the cap: the held point and the cap share the top, under the caret's room.
    const d = el.querySelector('[data-slot="spark-line"]')?.getAttribute('d') ?? ''
    const ys = [...d.matchAll(/[ML][\d.]+,([\d.]+)/g)].map((m) => Number(m[1]))
    expect(Math.min(...ys)).toBeGreaterThan(3)
  })

  test('the readout of a held point reads its true value', () => {
    render(<Sparkline points={[2, 38]} label="S" height={72} axisLabels={LABELS} cap={6} />)
    fireEvent.keyDown(screen.getByRole('group'), { key: 'End' })
    expect(middle()).toBe('38 · #2')
  })

  test('no point above the cap draws no caret and keeps the data extent', () => {
    const capped = dom(<Sparkline points={[2, 3, 4]} label="S" height={40} cap={60} />)
    const bare = dom(<Sparkline points={[2, 3, 4]} label="S" height={40} />)
    expect(capped.querySelector('[data-slot="spark-caret"]')).toBeNull()
    expect(capped.querySelector('[data-slot="spark-line"]')?.getAttribute('d')).toBe(
      bare.querySelector('[data-slot="spark-line"]')?.getAttribute('d') ?? '',
    )
  })
})

describe('Sparkline drawing', () => {
  test('a line is neutral and carries no color of its own', () => {
    const el = dom(<Sparkline points={[1, 3, 2]} label="S" height={30} />)
    const line = el.querySelector('[data-slot="spark-line"]')
    expect(line?.getAttribute('stroke')).toBe('currentColor')
    expect(el.querySelector('svg')?.getAttribute('class')).toContain('text-muted-foreground')
    expect(el.querySelector('linearGradient')).toBeNull()
  })

  test('the area form fades from the line to nothing', () => {
    const el = dom(<Sparkline points={[1, 3, 2]} label="S" height={30} form="area" />)
    const stops = [...el.querySelectorAll('stop')]
    expect(stops.map((s) => s.getAttribute('stop-opacity'))).toEqual(['0.22', '0'])
    expect(el.querySelector('path[fill^="url(#"]')).not.toBeNull()
  })

  test('the now dot sits on the last finite point and reads the frame-set var', () => {
    const el = dom(<Sparkline points={[1, 2, null]} label="S" height={30} />)
    const dot = el.querySelector<HTMLElement>('[data-slot="spark-now"]')
    expect(dot?.style.left).toBe('50%')
    expect(dot?.getAttribute('style')).toContain('var(--spark-now, var(--color-foreground))')
  })

  test('a null is a gap, never a zero', () => {
    const el = dom(<Sparkline points={[1, 2, null, 4, 5]} label="S" height={30} />)
    const d = el.querySelector('[data-slot="spark-line"]')?.getAttribute('d')
    expect(segments(d)).toBe(2)
    expect(d).not.toContain('NaN')
  })

  test('a non-finite value is a gap, an empty series draws nothing', () => {
    expect(toRows([1, Number.NaN, Number.POSITIVE_INFINITY]).map((r) => r.v)).toEqual([
      1,
      null,
      null,
    ])
    const el = dom(<Sparkline points={[]} label="S" height={30} />)
    expect(el.querySelector('[data-slot="spark-now"]')).toBeNull()
  })

  test('a width pins the box, and a fill height fills it', () => {
    const fixed = dom(<Sparkline points={[1, 2]} label="S" height={30} width={120} />)
    const root = fixed.querySelector<HTMLElement>('[data-slot="sparkline"]')
    expect(root?.style.width).toBe('120px')
    expect(root?.style.height).toBe('30px')
    const fill = dom(<Sparkline points={[1, 2]} label="S" height="fill" />)
    expect(fill.querySelector('[data-slot="sparkline"]')?.className).toContain('h-full')
  })

  test('with labels the plot is the height minus the 16 px row', () => {
    const el = dom(<Sparkline points={[1, 2]} label="S" height={72} axisLabels={LABELS} />)
    expect(el.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 100 56')
  })
})

describe('Sparkline pooling', () => {
  const dense = Array.from({ length: 5000 }, (_, i) => (i * 37) % 53)

  test('a series within its cap is untouched', () => {
    const rows = toRows([1, 2, 3])
    expect(pool(rows, LINE_CAP, 'line')).toBe(rows)
  })

  test('a long line holds the cap and keeps every bucket peak and dip', () => {
    const rows = toRows(dense)
    const out = pool(rows, LINE_CAP, 'line')
    expect(out.length).toBeLessThanOrEqual(LINE_CAP)
    expect(Math.max(...out.map((r) => r.v ?? -1))).toBe(52)
    expect(Math.min(...out.map((r) => r.v ?? 99))).toBe(0)
  })

  test('a gap survives pooling', () => {
    const series = dense.map((v, i) => (i >= 2000 && i < 2500 ? null : v))
    const out = pool(toRows(series), LINE_CAP, 'line')
    expect(out.some((r) => r.v === null)).toBe(true)
  })

  test('a bar series keeps the value furthest from zero per bucket', () => {
    const out = pool(toRows([1, -9, 2, 3, 4, 5, 6, 7]), 4, 'bar')
    expect(out.map((r) => r.v)).toEqual([-9, 3, 5, 7])
  })

  test('a 5,000-row series draws within the cap', () => {
    const el = dom(<Sparkline points={dense} label="S" height={30} />)
    const d = el.querySelector('[data-slot="spark-line"]')?.getAttribute('d') ?? ''
    expect(d.split('L').length).toBeLessThanOrEqual(LINE_CAP + 1)
  })
})

describe('Sparkline hydration', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  test.each(['line', 'area'] as const)('the %s form hydrates with no mismatch', async (form) => {
    const node = (
      <Sparkline
        points={[3, 1, 4, 1, 5, 9, 2, 6]}
        label="S"
        height={72}
        form={form}
        reference="mean"
        axisLabels={LABELS}
      />
    )
    const container = document.createElement('div')
    container.innerHTML = renderToString(node)
    document.body.append(container)
    const server = container.innerHTML
    const problems: string[] = []
    const spy = spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      problems.push(args.map(String).join(' '))
    })
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, node, { onRecoverableError: (e) => problems.push(String(e)) })
    })
    spy.mockRestore()
    expect(problems).toEqual([])
    expect(container.innerHTML).toBe(server)
    await act(async () => root?.unmount())
  })
})
