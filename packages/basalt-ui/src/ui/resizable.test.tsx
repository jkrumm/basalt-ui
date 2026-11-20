import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup, resizableParts } from './resizable'

const rect = Element.prototype.getBoundingClientRect
const offsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')

beforeEach(() => {
  // happy-dom lays nothing out: a 1000 x 600 box for every element is enough for the group maths.
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: () => 1000,
  })
  Element.prototype.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1000,
      bottom: 600,
      width: 1000,
      height: 600,
      toJSON() {},
    }) as DOMRect
})

afterEach(() => {
  cleanup()
  Element.prototype.getBoundingClientRect = rect
  if (offsetWidth !== undefined)
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', offsetWidth)
})

const settle = (): Promise<void> =>
  act(async () => void (await new Promise((r) => setTimeout(r, 30))))

function Split({
  onLayoutChanged,
}: {
  onLayoutChanged?: (l: Record<string, number>, user: boolean) => void
}) {
  return (
    <ResizablePanelGroup
      id="g"
      className="h-96"
      defaultLayout={{ list: 70, detail: 30 }}
      onLayoutChanged={(l, meta) => onLayoutChanged?.(l, meta.isUserInteraction)}
    >
      <ResizablePanel id="list">list</ResizablePanel>
      <ResizableHandle grip aria-label="Resize list" />
      <ResizablePanel id="detail" minSize="10%" maxSize="60%">
        detail
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

describe('resizable', () => {
  test('lists its parts in export order', () => {
    expect(resizableParts).toEqual(['resizable-panel-group', 'resizable-panel', 'resizable-handle'])
  })

  test('server render carries the saved layout as flex-grow ratios and no window', () => {
    const html = renderToString(<Split />)
    expect(html).toContain('data-slot="resizable-panel-group"')
    expect(html).toContain('flex-grow:70')
    expect(html).toContain('flex-grow:30')
    expect(html).toContain('role="separator"')
    expect(html).toContain('data-slot="resizable-handle"')
  })

  test('server render carries a percent defaultSize as a flex basis, so the first paint is the hydrated layout', () => {
    const html = renderToString(
      <ResizablePanelGroup className="h-96">
        <ResizablePanel defaultSize="35%">a</ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize="65%">b</ResizablePanel>
      </ResizablePanelGroup>,
    )
    expect(html).toContain('flex-basis:35%')
    expect(html).toContain('flex-basis:65%')
  })

  test('a panel clips instead of scrolling, so the page keeps one scrollport', () => {
    const { container } = render(<Split />)
    const inner = container.querySelector('[data-slot="resizable-panel"] > div')
    expect((inner as HTMLElement).style.overflow).toBe('clip')
  })

  test('the handle is a focusable separator with a value and reports keyboard resizes as user input', async () => {
    const onLayoutChanged = mock((_l: Record<string, number>, _user: boolean) => {})
    const { container } = render(<Split onLayoutChanged={onLayoutChanged} />)
    await settle()
    const handle = container.querySelector('[role="separator"]') as HTMLElement
    expect(handle.getAttribute('aria-label')).toBe('Resize list')
    expect(handle.getAttribute('aria-orientation')).toBe('vertical')
    expect(handle.tabIndex).toBe(0)
    expect(handle.getAttribute('aria-valuenow')).toBe('70')
    handle.focus()
    await act(async () => void fireEvent.keyDown(handle, { key: 'ArrowLeft' }))
    expect(handle.getAttribute('aria-valuenow')).toBe('65')
    await act(async () => void fireEvent.keyDown(handle, { key: 'End' }))
    expect(handle.getAttribute('aria-valuenow')).toBe('90')
    await act(async () => void fireEvent.keyDown(handle, { key: 'Home' }))
    expect(handle.getAttribute('aria-valuenow')).toBe('40')
    const user = onLayoutChanged.mock.calls.filter((c) => c[1])
    expect(user.map((c) => c[0]['list'])).toEqual([65, 90, 40])
  })

  test('the grip is decorative and absent unless asked for', () => {
    const { container } = render(<Split />)
    const grip = container.querySelector('[data-slot="resizable-handle"] > span')
    expect(grip?.getAttribute('aria-hidden')).toBe('true')
    cleanup()
    const plain = render(
      <ResizablePanelGroup>
        <ResizablePanel id="a">a</ResizablePanel>
        <ResizableHandle />
        <ResizablePanel id="b">b</ResizablePanel>
      </ResizablePanelGroup>,
    )
    expect(plain.container.querySelector('[data-slot="resizable-handle"] > span')).toBeNull()
  })
})
