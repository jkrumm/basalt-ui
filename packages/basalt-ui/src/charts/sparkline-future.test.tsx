/** `Sparkline` `future`: the planned tail draws dashed, the past stays solid. */
import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Sparkline } from './Sparkline'

const data = [3, 5, 4, 6, 7, 6, 8, 9, 9]
const html = (future?: number): string =>
  renderToString(<Sparkline ariaLabel="S" data={data} height={30} future={future} />)
/** The mark's path: `line` is the solid past, `line-future` the planned tail. */
const mark = (h: string, key: string): Element | null => {
  const el = document.createElement('div')
  el.innerHTML = h
  return el.querySelector(`path[data-ts-key^="${key}:"]`)
}

describe('Sparkline future', () => {
  test('a start index draws a second, dashed line; the first stays solid', () => {
    const out = html(7)
    expect(mark(out, 'line')).not.toBeNull()
    const planned = mark(out, 'line-future')
    expect(planned).not.toBeNull()
    expect(planned?.getAttribute('stroke-dasharray')).toBeTruthy()
    expect(mark(out, 'line')?.getAttribute('stroke-dasharray')).toBeNull()
  })

  test.each([undefined, 0, 9, 40, 1.5])('%p draws a plain line', (future) => {
    expect(mark(html(future), 'line-future')).toBeNull()
    expect(mark(html(future), 'line')).not.toBeNull()
  })
})
