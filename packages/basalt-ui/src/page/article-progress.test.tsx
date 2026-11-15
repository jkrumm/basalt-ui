/**
 * `ArticleProgress` — which element carries which timeline, that nothing listens to the scroll, and
 * that an engine without scroll timelines draws no bar. happy-dom computes no timeline, so the
 * progress itself is held in real Chrome (`tests/layout/article-progress.layout.test.ts`); here the
 * wiring is read off the DOM.
 */
import type { ReactElement, RefObject } from 'react'
import { useRef } from 'react'
import { render } from '@testing-library/react'
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { ArticleProgress } from './article-progress'

let restoreCss = (): void => {}

afterEach(() => {
  mock.restore()
  restoreCss()
  restoreCss = () => {}
})

function Harness({
  tracked = false,
  onPort,
}: {
  tracked?: boolean
  onPort?: (port: HTMLDivElement) => void
}): ReactElement {
  const targetRef: RefObject<HTMLDivElement | null> = useRef(null)
  return (
    <div
      ref={(port) => {
        if (port) onPort?.(port)
      }}
      data-basalt-scrollport
      data-testid="port"
    >
      <div ref={targetRef} data-testid="target" />
      <ArticleProgress {...(tracked && { target: targetRef })} />
    </div>
  )
}

const fillOf = (container: HTMLElement): HTMLElement =>
  container.querySelector<HTMLElement>('[aria-hidden="true"] > div')!

describe('ArticleProgress', () => {
  test('registers no scroll or resize listener and asks for no animation frame', () => {
    const frames = spyOn(window, 'requestAnimationFrame')
    const onWindow = spyOn(window, 'addEventListener')
    const onPorts: Array<{ mock: { calls: unknown[][] } }> = []
    for (const tracked of [false, true]) {
      render(
        <Harness
          tracked={tracked}
          onPort={(port) => onPorts.push(spyOn(port, 'addEventListener'))}
        />,
      )
      const seen = [onWindow, ...onPorts].flatMap((spy) => spy.mock.calls.map((call) => call[0]))
      expect(seen).not.toContain('scroll')
      expect(seen).not.toContain('resize')
    }
    expect(frames).not.toHaveBeenCalled()
  })

  test('without a target the resolved scrollport carries a named scroll timeline the fill reads', () => {
    const { container, getByTestId } = render(<Harness />)
    const name = fillOf(container).style.animationTimeline
    expect(name).toStartWith('--article-progress-')
    expect(getByTestId('port').style.scrollTimeline).toBe(`${name} y`)
  })

  test('with a target the target carries a view timeline, scoped to an ancestor of the bar', () => {
    const { container, getByTestId } = render(<Harness tracked />)
    const name = fillOf(container).style.animationTimeline
    expect(getByTestId('target').style.viewTimeline).toBe(`${name} y`)
    expect(getByTestId('port').style.timelineScope).toBe(name)
    expect(fillOf(container).style.animationRange).toBe('entry 100% exit 0%')
  })

  test('an engine without scroll timelines declares nothing and throws nothing', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'CSS')
    Object.defineProperty(globalThis, 'CSS', {
      value: { supports: () => false },
      configurable: true,
    })
    restoreCss = () => {
      if (original) Object.defineProperty(globalThis, 'CSS', original)
    }
    const { container, getByTestId } = render(<Harness tracked />)
    expect(getByTestId('target').style.viewTimeline).toBe('')
    expect(getByTestId('port').style.timelineScope).toBe('')
    // `hidden` until `@supports (animation-timeline: auto)` shows it.
    expect(container.querySelector('[aria-hidden="true"]')?.className).toContain('hidden')
  })
})
