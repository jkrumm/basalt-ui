/**
 * `useCommittedField` through the string and number renderers: debounce 200 ms, Enter flushes
 * outside an IME composition, blur flushes, clear commits on mousedown, unmount flushes.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test'
import { memoryHandle } from './control-view.handles'
import type { MemoryHandle } from './control-view.handles'
import { ControlView } from './control-view'
import { spec } from './spec'

beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

const advance = (ms: number): void => {
  act(() => {
    jest.advanceTimersByTime(ms)
  })
}

const setup = (kind: 'string' | 'number') => {
  const handle =
    kind === 'string'
      ? memoryHandle<string>('q', '', { kind })
      : memoryHandle<number>('n', 1, { kind, bounds: { min: 0, max: 100, int: true } })
  const view = render(
    <ControlView
      spec={
        kind === 'string'
          ? spec(handle as MemoryHandle<string>, 'Field', { clearable: true })
          : spec(handle as MemoryHandle<number>, 'Field', { clearable: true })
      }
    />,
  )
  const input = view.getByLabelText('Field') as HTMLInputElement
  return { handle: handle as { writes: unknown[]; clears: { count: number } }, view, input }
}

const type = (input: HTMLInputElement, text: string): void => {
  act(() => {
    fireEvent.change(input, { target: { value: text } })
  })
}

for (const kind of ['string', 'number'] as const) {
  describe(`${kind} renderer`, () => {
    const text = kind === 'string' ? 'abc' : '42'
    const written = kind === 'string' ? 'abc' : 42

    test('typing writes once, 200 ms after the last keystroke', () => {
      const { handle, input } = setup(kind)
      type(input, kind === 'string' ? 'a' : '4')
      advance(150)
      type(input, text)
      advance(199)
      expect(handle.writes).toEqual([])
      advance(1)
      expect(handle.writes).toEqual([written])
    })

    test('Enter outside an IME composition commits at once', () => {
      const { handle, input } = setup(kind)
      type(input, text)
      expect(handle.writes).toEqual([])
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(handle.writes).toEqual([written])
      advance(500)
      expect(handle.writes).toEqual([written])
    })

    test('Enter during an IME composition does not commit; the pause still does', () => {
      const { handle, input } = setup(kind)
      fireEvent.compositionStart(input)
      type(input, text)
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(handle.writes).toEqual([])
      fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
      fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 })
      expect(handle.writes).toEqual([])
      fireEvent.compositionEnd(input)
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(handle.writes).toEqual([written])
    })

    test('blur commits a pending draft', () => {
      const { handle, input } = setup(kind)
      type(input, text)
      fireEvent.blur(input)
      expect(handle.writes).toEqual([written])
    })

    test('unmount flushes a pending draft instead of dropping it', () => {
      const { handle, input, view } = setup(kind)
      type(input, text)
      expect(handle.writes).toEqual([])
      view.unmount()
      expect(handle.writes).toEqual([written])
    })

    test('clear commits on mousedown, before the click, and cancels a pending draft', () => {
      const { handle, view, input } = setup(kind)
      type(input, text)
      const clear = view.container.querySelector<HTMLElement>('[data-control-clear]')!
      const notPrevented = fireEvent.mouseDown(clear)
      expect(notPrevented, 'mousedown keeps focus in the input').toBe(false)
      if (kind === 'string') expect(handle.writes).toEqual([''])
      else expect(handle.clears.count).toBe(1)
      advance(500)
      expect(handle.writes.length, 'the cancelled draft never lands').toBe(
        kind === 'string' ? 1 : 0,
      )
    })
  })
}

describe('an outside change', () => {
  test('replaces the draft when nothing is pending', () => {
    const handle = memoryHandle<string>('q', '', { kind: 'string' })
    const { getByLabelText } = render(<ControlView spec={spec(handle, 'Field')} />)
    const input = getByLabelText('Field') as HTMLInputElement
    act(() => {
      handle.put('from a link')
    })
    expect(input.value).toBe('from a link')
  })

  test('never overwrites a keystroke that is still waiting to commit', () => {
    const handle = memoryHandle<string>('q', '', { kind: 'string' })
    const { getByLabelText } = render(<ControlView spec={spec(handle, 'Field')} />)
    const input = getByLabelText('Field') as HTMLInputElement
    type(input, 'typing')
    act(() => {
      handle.put('from a link')
    })
    expect(input.value).toBe('typing')
  })
})
