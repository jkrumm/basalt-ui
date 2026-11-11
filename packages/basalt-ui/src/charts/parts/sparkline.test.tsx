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

describe('Sparkline frame', () => {
  test('without axisLabels it is an image with the name and no tab stop', () => {
    render(<Sparkline series={[1, 3, 2]} ariaLabel="Shipped per day" height={40} />)
    const img = screen.getByRole('img', { name: 'Shipped per day' })
    expect(img.getAttribute('tabindex')).toBe('-1')
    expect(document.querySelector('[data-slot="spark-labels"]')).toBeNull()
    expect(document.querySelectorAll('[tabindex="0"]')).toHaveLength(0)
  })

  test('with axisLabels it is one tab stop that answers: arrows, Home and End move the readout', () => {
    render(
      <Sparkline series={[10, 20, 30, 40]} ariaLabel="Shipped" height={72} axisLabels={LABELS} />,
    )
    const slider = screen.getByRole('slider', { name: 'Shipped' })
    expect(slider.getAttribute('tabindex')).toBe('0')
    expect(slider.getAttribute('aria-valuenow')).toBe('3')
    const middle = (): string | null =>
      document.querySelector('[data-slot="spark-labels"]')!.children[1]!.textContent
    expect(middle()).toBe('Today')
    fireEvent.keyDown(slider, { key: 'Home' })
    expect(slider.getAttribute('aria-valuenow')).toBe('0')
    expect(slider.getAttribute('aria-valuetext')).toBe('10')
    expect(middle()).toBe('10')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(slider.getAttribute('aria-valuenow')).toBe('1')
    fireEvent.keyDown(slider, { key: 'ArrowLeft' })
    fireEvent.keyDown(slider, { key: 'ArrowLeft' })
    expect(slider.getAttribute('aria-valuenow')).toBe('0')
    fireEvent.keyDown(slider, { key: 'End' })
    expect(slider.getAttribute('aria-valuenow')).toBe('3')
    expect(middle()).toBe('40')
    fireEvent.blur(slider)
    expect(middle()).toBe('Today')
  })

  test('a plain key does nothing', () => {
    render(<Sparkline series={[1, 2]} ariaLabel="S" height={72} axisLabels={LABELS} />)
    const slider = screen.getByRole('slider')
    fireEvent.keyDown(slider, { key: 'a' })
    expect(slider.getAttribute('aria-valuenow')).toBe('1')
  })

  test('the text alternative is a summary of min, max and last unless one is given', () => {
    expect(dom(<Sparkline series={[2, 9, 4]} ariaLabel="S" height={30} />).textContent).toContain(
      'Min 2, max 9, last 4',
    )
    expect(
      dom(<Sparkline series={[2, 9, 4]} ariaLabel="S" height={30} summary="Up on Tuesday" />)
        .textContent,
    ).toContain('Up on Tuesday')
    expect(dom(<Sparkline series={[null]} ariaLabel="S" height={30} />).textContent).toContain(
      'No data',
    )
  })

  test('a dated point reads its day in the readout and a gap reads an em dash', () => {
    const at = Date.UTC(2026, 9, 12)
    render(
      <Sparkline
        series={[
          { at, value: 3 },
          { at: at + 86_400_000, value: null },
        ]}
        ariaLabel="S"
        height={72}
        axisLabels={LABELS}
        format={(v) => `${v} items`}
      />,
    )
    const slider = screen.getByRole('slider')
    fireEvent.keyDown(slider, { key: 'Home' })
    expect(slider.getAttribute('aria-valuetext')).toBe('3 items · Oct 12')
    fireEvent.keyDown(slider, { key: 'End' })
    expect(slider.getAttribute('aria-valuetext')).toBe('—')
  })
})

describe('Sparkline drawing', () => {
  test('a line is neutral and carries no color of its own', () => {
    const el = dom(<Sparkline series={[1, 3, 2]} ariaLabel="S" height={30} />)
    const line = el.querySelector('[data-slot="spark-line"]')
    expect(line?.getAttribute('stroke')).toBe('currentColor')
    expect(el.querySelector('svg')?.getAttribute('class')).toContain('text-muted-foreground')
    expect(el.querySelector('linearGradient')).toBeNull()
  })

  test('the area form fades from the line to nothing', () => {
    const el = dom(<Sparkline series={[1, 3, 2]} ariaLabel="S" height={30} form="area" />)
    const stops = [...el.querySelectorAll('stop')]
    expect(stops.map((s) => s.getAttribute('stop-opacity'))).toEqual(['0.22', '0'])
    expect(el.querySelector('path[fill^="url(#"]')).not.toBeNull()
  })

  test('the now dot sits on the last finite point and reads the frame-set var', () => {
    const el = dom(<Sparkline series={[1, 2, null]} ariaLabel="S" height={30} />)
    const dot = el.querySelector<HTMLElement>('[data-slot="spark-now"]')
    expect(dot?.style.left).toBe('50%')
    expect(dot?.getAttribute('style')).toContain('var(--spark-now, var(--color-foreground))')
  })

  test('a null is a gap, never a zero', () => {
    const el = dom(<Sparkline series={[1, 2, null, 4, 5]} ariaLabel="S" height={30} />)
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
    const el = dom(<Sparkline series={[]} ariaLabel="S" height={30} />)
    expect(el.querySelector('[data-slot="spark-now"]')).toBeNull()
  })

  test('a width pins the box, and a fill height fills it', () => {
    const fixed = dom(<Sparkline series={[1, 2]} ariaLabel="S" height={30} width={120} />)
    const root = fixed.querySelector<HTMLElement>('[data-slot="sparkline"]')
    expect(root?.style.width).toBe('120px')
    expect(root?.style.height).toBe('30px')
    const fill = dom(<Sparkline series={[1, 2]} ariaLabel="S" height="fill" />)
    expect(fill.querySelector('[data-slot="sparkline"]')?.className).toContain('h-full')
  })

  test('with labels the plot is the height minus the 16 px row', () => {
    const el = dom(<Sparkline series={[1, 2]} ariaLabel="S" height={72} axisLabels={LABELS} />)
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
    const el = dom(<Sparkline series={dense} ariaLabel="S" height={30} />)
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
        series={[3, 1, 4, 1, 5, 9, 2, 6]}
        ariaLabel="S"
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
