/** `Sparkline` `window`: the span a hosted trend covers, stated at rest. */
import { describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { HOSTED, VisualSlotContext } from '../dashboard/visual-slot'
import { Sparkline } from './Sparkline'

const DAY = 86_400_000
const points = [0, 1, 2, 3].map((i) => ({ at: Date.UTC(2026, 9, 1) + i * 7 * DAY, value: i + 1 }))
const hosted = (node: ReactElement): string =>
  renderToString(<VisualSlotContext.Provider value={HOSTED}>{node}</VisualSlotContext.Provider>)
const windowOf = (html: string): string | undefined => {
  const el = document.createElement('div')
  el.innerHTML = html
  return el.querySelector('[data-basalt-sparkline-window]')?.textContent ?? undefined
}

describe('Sparkline window', () => {
  test('a hosted dated series states its first and last day', () => {
    expect(windowOf(hosted(<Sparkline ariaLabel="S" data={points} height={28} />))).toMatch(
      /^\d+ \w+ – \d+ \w+$|^\w+ \d+ – \w+ \d+$/,
    )
  })
  test('`window` wins, and `false` states none', () => {
    expect(
      windowOf(hosted(<Sparkline ariaLabel="S" data={points} height={28} window="12 wk" />)),
    ).toBe('12 wk')
    expect(
      windowOf(hosted(<Sparkline ariaLabel="S" data={points} height={28} window={false} />)),
    ).toBe(undefined)
  })
  test('a bare sparkline or plain values state no window', () => {
    expect(windowOf(renderToString(<Sparkline ariaLabel="S" data={points} height={28} />))).toBe(
      undefined,
    )
    expect(windowOf(hosted(<Sparkline ariaLabel="S" data={[1, 2, 3]} height={28} />))).toBe(
      undefined,
    )
  })
  test('an hourly series states none: the host names its own ends', () => {
    const hourly = [0, 1, 2].map((i) => ({ at: Date.UTC(2026, 9, 1, i), value: i }))
    expect(windowOf(hosted(<Sparkline ariaLabel="S" data={hourly} height={28} />))).toBe(undefined)
  })
  test('a stated window takes the reference label into the row, out of the plot', () => {
    const html = hosted(
      <Sparkline ariaLabel="S" data={points} height={28} reference="mean" referenceLabel="mean" />,
    )
    const el = document.createElement('div')
    el.innerHTML = html
    expect(el.querySelector('[data-basalt-sparkline-key]')?.textContent).toBe('mean')
    expect(el.querySelector('[data-ts-key="reference-label"]')).toBeNull()
  })
})
