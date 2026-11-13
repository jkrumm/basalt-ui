/**
 * The geometry seam on a segmented `Meter` (Issue 1019): pointer and arrow keys focus one part, the
 * other parts dim, one readout follows and returns to the total on leave, and the live region says it.
 */
import { MantineProvider } from '@mantine/core'
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useChartFocus } from '../charts/focus'
import { Meter } from './meter'
import type { MeterSegment } from './meter-model'

const SEGMENTS: readonly MeterSegment[] = [
  { value: 40, label: 'System' },
  { value: 25, label: 'Tools' },
  { value: 15, label: 'Messages' },
]

function Context() {
  const focus = useChartFocus(SEGMENTS, { announce: (s) => `${s.label}: ${s.value}k` })
  return (
    <div>
      <output data-readout="">{focus.readout('80k used', (s) => `${s.label} ${s.value}k`)}</output>
      <Meter label="Context window" max={100} segments={SEGMENTS} size="lg" focus={focus} />
    </div>
  )
}

let root: ReturnType<typeof createRoot> | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})

function mount(): HTMLElement {
  const el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
  act(() =>
    root?.render(
      <MantineProvider>
        <Context />
      </MantineProvider>,
    ),
  )
  return el
}

const readout = (el: HTMLElement) => el.querySelector('[data-readout]')?.textContent
const fills = (el: HTMLElement) => [...el.querySelectorAll('[data-meter-fill]')]
const dimmed = (el: HTMLElement) => fills(el).map((f) => f.hasAttribute('data-dimmed'))
const live = (el: HTMLElement) => el.querySelector('[data-chart-focus-live]')?.textContent
const key = (target: Element, k: string) =>
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))
  })

describe('Meter focus', () => {
  test('the track is one tab stop and the rest is undimmed at rest', () => {
    const el = mount()
    const stops = el.querySelectorAll('[tabindex="0"]')
    expect(stops.length).toBe(1)
    expect(stops[0]?.getAttribute('role')).toBe('meter')
    expect(readout(el)).toBe('80k used')
    expect(dimmed(el)).toEqual([false, false, false])
  })

  test('arrow keys step the parts, dim the rest and drive the readout', () => {
    const el = mount()
    const track = el.querySelector('[data-meter-focus]') as Element
    key(track, 'ArrowRight')
    expect(readout(el)).toBe('System 40k')
    expect(dimmed(el)).toEqual([false, true, true])
    key(track, 'ArrowRight')
    expect(readout(el)).toBe('Tools 25k')
    expect(dimmed(el)).toEqual([true, false, true])
    expect(live(el)).toBe('Tools: 25k')
    key(track, 'End')
    expect(readout(el)).toBe('Messages 15k')
    key(track, 'Escape')
    expect(readout(el)).toBe('80k used')
    expect(dimmed(el)).toEqual([false, false, false])
    expect(live(el)).toBe('')
  })

  test('pointing at a part focuses it; leaving returns to the total', () => {
    const el = mount()
    const part = fills(el)[2] as Element
    act(() => {
      part.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }))
    })
    expect(readout(el)).toBe('Messages 15k')
    expect(dimmed(el)).toEqual([true, true, false])
    const track = el.querySelector('[data-meter-focus]') as Element
    act(() => {
      track.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, pointerType: 'mouse' }))
      track.dispatchEvent(
        new PointerEvent('pointerleave', { bubbles: false, pointerType: 'mouse' }),
      )
    })
    expect(readout(el)).toBe('80k used')
  })
})
