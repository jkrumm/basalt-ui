/** `Sparkline` `reference` and the hover / focus readout, through the rendered DOM. */
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { Sparkline } from './Sparkline'

const data = [10, 20, 30, 40, 50]
const VIEW_H = 320

const dom = (html: string): HTMLElement => {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}
const refs = (html: string): Element[] => [
  ...dom(html).querySelectorAll('[data-ts-key^="reference"]'),
]
/** The y of the reference rule in viewBox px, whichever element the engine draws it as. */
const refY = (html: string): number => {
  const el = refs(html).find((e) => e.getAttribute('y1') !== null || e.getAttribute('d') !== null)
  const y1 = el?.getAttribute('y1')
  if (y1 !== null && y1 !== undefined) return Number(y1)
  return Number(/[ML][\d.]+[ ,]([\d.]+)/.exec(el?.getAttribute('d') ?? '')?.[1])
}
/** The y a value lands on for a domain [lo, hi] over the server frame, inside the line's 3px plot margin. */
const LINE_INSET = 3
const yOf = (v: number, [lo, hi]: [number, number]): number =>
  LINE_INSET + (VIEW_H - 2 * LINE_INSET) * (1 - (v - lo) / (hi - lo))

describe('Sparkline reference', () => {
  test('a number reference draws one rule at y(42), inside the widened domain', () => {
    const html = renderToString(<Sparkline ariaLabel="S" data={data} height={30} reference={42} />)
    // 10% air over the data extent (10..50): domain 6..54.
    expect(refs(html).length).toBeGreaterThan(0)
    expect(refY(html)).toBeCloseTo(yOf(42, [6, 54]), 0)
  })
  test("'mean' draws at the mean of the plotted, non-null values", () => {
    const withGap = [10, null, 30, 20] as unknown as number[]
    const html = renderToString(
      <Sparkline ariaLabel="S" data={withGap} height={30} reference="mean" />,
    )
    // mean(10, 30, 20) = 20; non-finite entries are not plotted.
    expect(refY(html)).toBeCloseTo(yOf(20, [8, 32]), 0)
  })
  test('an out-of-range reference widens the y domain so it is never clipped', () => {
    const html = renderToString(<Sparkline ariaLabel="S" data={data} height={30} reference={100} />)
    const y = refY(html)
    expect(y).toBeGreaterThanOrEqual(0)
    expect(y).toBeLessThanOrEqual(VIEW_H)
    expect(y).toBeCloseTo(yOf(100, [1, 109]), 0)
  })
  test('the reference is dashed, tokenised and not a legend item', () => {
    const html = renderToString(<Sparkline ariaLabel="S" data={data} height={30} reference={30} />)
    const el = refs(html).find((e) => e.tagName === 'line')
    expect(el?.getAttribute('stroke-dasharray')).toBeTruthy()
    expect(el?.getAttribute('stroke')).toMatch(/^var\(--vx-/)
    expect(html).not.toContain('legend')
  })
  test('a bar sparkline includes the reference too', () => {
    const html = renderToString(
      <Sparkline ariaLabel="S" data={data} height={30} mark="bar" reference={30} />,
    )
    expect(refs(html).length).toBeGreaterThan(0)
  })
  test('NaN and an all-gap series draw no reference', () => {
    expect(
      refs(
        renderToString(<Sparkline ariaLabel="S" data={data} height={30} reference={Number.NaN} />),
      ),
    ).toHaveLength(0)
    expect(
      refs(
        renderToString(
          <Sparkline ariaLabel="S" data={[Number.NaN, Number.NaN]} height={30} reference="mean" />,
        ),
      ),
    ).toHaveLength(0)
  })
  test('no reference prop: no reference mark', () => {
    expect(refs(renderToString(<Sparkline ariaLabel="S" data={data} height={30} />))).toHaveLength(
      0,
    )
  })
})

const readout = (el: HTMLElement): HTMLElement | null =>
  el.querySelector<HTMLElement>('[data-basalt-sparkline-readout]')
const key = async (el: HTMLElement, k: string): Promise<void> => {
  const svg = el.querySelector('svg')
  await act(async () => {
    svg?.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))
  })
}
const focus = async (el: HTMLElement): Promise<void> => {
  await act(async () => {
    el.querySelector('svg')?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
  })
}

const dotAt = (el: HTMLElement): { left: number; top: number } => {
  const style = el.querySelector<HTMLElement>('[data-basalt-sparkline-dot]')?.style
  return { left: Number.parseFloat(style?.left ?? ''), top: Number.parseFloat(style?.top ?? '') }
}

describe('Sparkline readout', () => {
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
  test('no readout before interaction, and the SSR markup carries none', () => {
    expect(renderToString(<Sparkline ariaLabel="S" data={data} height={30} />)).not.toContain(
      'data-basalt-sparkline-readout',
    )
  })
  test('focus + arrow keys read the value through the formatter, with its x label', async () => {
    const el = await mount(
      <Sparkline
        ariaLabel="S"
        data={data}
        height={30}
        labels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri']}
        format={(v) => `${v} bpm`}
      />,
    )
    expect(readout(el)).toBeNull()
    await focus(el)
    // Focus lands on the latest point.
    expect(readout(el)?.textContent).toContain('50 bpm')
    expect(readout(el)?.textContent).toContain('Fri')
    await key(el, 'ArrowLeft')
    expect(readout(el)?.textContent).toContain('40 bpm')
    expect(readout(el)?.textContent).toContain('Thu')
    await key(el, 'Home')
    expect(readout(el)?.textContent).toContain('10 bpm')
    await key(el, 'Escape')
    expect(readout(el)).toBeNull()
  })
  test('pointer hover reads the point under the cursor and leave clears it', async () => {
    const el = await mount(<Sparkline ariaLabel="S" data={data} height={30} width={100} />)
    const host = el.querySelector<HTMLElement>('[data-basalt-sparkline]')
    if (host === null) throw new Error('no host')
    host.getBoundingClientRect = () => new DOMRect(0, 0, 100, 30)
    await act(async () => {
      host.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 0, clientY: 5 }))
    })
    expect(readout(el)?.textContent).toContain('10')
    await act(async () => {
      host.dispatchEvent(new MouseEvent('pointerout', { bubbles: true }))
    })
    expect(readout(el)).toBeNull()
  })
  test('the readout sits inside the cell and marks the hovered point with a dot', async () => {
    const el = await mount(<Sparkline ariaLabel="S" data={data} height={30} />)
    await focus(el)
    expect(el.querySelector('[data-basalt-sparkline-dot]')).not.toBeNull()
  })
  test('no data: no readout', async () => {
    const el = await mount(<Sparkline ariaLabel="S" data={[]} height={30} />)
    await focus(el)
    expect(readout(el)).toBeNull()
  })
  test('under an aria-hidden ancestor: no readout', async () => {
    const el = await mount(
      <div aria-hidden="true">
        <Sparkline ariaLabel="S" data={data} height={30} />
      </div>,
    )
    await focus(el)
    expect(readout(el)).toBeNull()
  })
  test('the dot lands on the point: line, and a bar with a negative value', async () => {
    const line = await mount(<Sparkline ariaLabel="S" data={data} height={30} />)
    await focus(line)
    // x domain [-0.16, 4.16] (end-dot air), y domain [6, 54]; the last point is (4, 50).
    expect(dotAt(line).left).toBeCloseTo((4.16 / 4.32) * 100, 1)
    expect(dotAt(line).top).toBeCloseTo((4 / 48) * 100, 1)
    act(() => root?.unmount())
    document.body.innerHTML = ''
    const bar = await mount(<Sparkline ariaLabel="S" data={[-10, 20, 30]} height={30} mark="bar" />)
    await focus(bar)
    await key(bar, 'Home')
    // Band centre of bar 0 of 3; y domain [-10, 30], so -10 sits on the bottom edge.
    expect(dotAt(bar).left).toBeCloseTo((0.5 / 3) * 100, 1)
    expect(dotAt(bar).top).toBeCloseTo(100, 1)
    expect(readout(bar)?.textContent).toContain('-10')
  })
  test('pointer hover on a bar sparkline reads the bar under the cursor', async () => {
    const el = await mount(
      <Sparkline ariaLabel="S" data={data} height={30} width={100} mark="bar" />,
    )
    const host = el.querySelector<HTMLElement>('[data-basalt-sparkline]')
    if (host === null) throw new Error('no host')
    host.getBoundingClientRect = () => new DOMRect(0, 0, 100, 30)
    await act(async () => {
      host.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 90 }))
    })
    expect(readout(el)?.textContent).toContain('50')
    await act(async () => {
      host.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 10 }))
    })
    expect(readout(el)?.textContent).toContain('10')
  })
  test('pointer leave hands the readout back to the focused point', async () => {
    const el = await mount(<Sparkline ariaLabel="S" data={data} height={30} width={100} />)
    const host = el.querySelector<HTMLElement>('[data-basalt-sparkline]')
    if (host === null) throw new Error('no host')
    host.getBoundingClientRect = () => new DOMRect(0, 0, 100, 30)
    await focus(el)
    await act(async () => {
      host.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 0 }))
    })
    expect(readout(el)?.textContent).toContain('10')
    expect(readout(el)?.getAttribute('aria-live')).toBe('off')
    await act(async () => {
      host.dispatchEvent(new MouseEvent('pointerout', { bubbles: true }))
    })
    expect(readout(el)?.textContent).toContain('50')
    expect(readout(el)?.getAttribute('aria-live')).toBe('polite')
  })
  test('End and ArrowRight stop at the edges; ArrowLeft stops at the first point', async () => {
    const el = await mount(<Sparkline ariaLabel="S" data={data} height={30} />)
    await focus(el)
    await key(el, 'ArrowRight')
    expect(readout(el)?.textContent).toContain('50')
    await key(el, 'End')
    expect(readout(el)?.textContent).toContain('50')
    await key(el, 'Home')
    await key(el, 'ArrowLeft')
    expect(readout(el)?.textContent).toContain('10')
  })
})
