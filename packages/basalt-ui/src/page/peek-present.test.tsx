/**
 * `Peek` presentations: under a shell the reader opens a record as a side panel, a window or the
 * page, from the header's `Open as` menu, and the device remembers the choice per record kind; a
 * window minimises to a chip and restores. Every presentation closes on Escape and gives focus back
 * to the opener, and previous and next step through the opener's records and stop at the ends. On a
 * phone every presentation is a bottom sheet with the scrim. Geometry is
 * `tests/layout/panels.layout.test.ts`'s.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { useState } from 'react'
import type { ReactElement } from 'react'
import type { RecordSequence } from '../core/ports'
import { presentationStore, windowStore } from './core/panel-store'
import type { Presentation } from './core/panel-store'
import { PageHostContext, ShellOverlayContext } from './page'
import { fakeHost } from './page.test-support'
import { Peek } from './peek'

const original = window.matchMedia
let wide = true

beforeEach(() => {
  wide = true
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: wide,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList
})

afterEach(() => {
  cleanup()
  presentationStore('issue').reset()
  windowStore('issue').reset()
  window.matchMedia = original
  document.body.replaceChildren()
})

const peek = (): HTMLElement | null => document.querySelector('[data-slot="peek"]')

/** A shell's surface with its aside region inside, the way `AppShell` lays them out. */
function shell(): { surface: HTMLElement; region: HTMLElement } {
  const surface = document.createElement('div')
  surface.dataset['slot'] = 'shell-surface'
  const region = document.createElement('div')
  surface.append(region)
  document.body.append(surface)
  return { surface, region }
}

function Shelled({
  region,
  onClose,
  records,
}: {
  region: HTMLElement
  onClose: () => void
  records?: RecordSequence
}): ReactElement {
  const { host } = fakeHost()
  return (
    <PageHostContext value={host}>
      <ShellOverlayContext value={region}>
        <Peek kind="issue" title="Issue 12" onClose={onClose} {...(records && { records })}>
          <input aria-label="note" />
        </Peek>
      </ShellOverlayContext>
    </PageHostContext>
  )
}

function opener(): HTMLButtonElement {
  const button = document.createElement('button')
  button.textContent = 'row'
  document.body.append(button)
  button.focus()
  return button
}

describe('Peek presentations', () => {
  test('a kind with defaultPresent opens in it until the reader picks another', async () => {
    const { region } = shell()
    const { host } = fakeHost()
    const Compose = (): ReactElement => (
      <PageHostContext value={host}>
        <ShellOverlayContext value={region}>
          <Peek kind="compose-test" defaultPresent="window" title="New email" onClose={() => {}}>
            <input aria-label="to" />
          </Peek>
        </ShellOverlayContext>
      </PageHostContext>
    )
    const { unmount } = render(<Compose />)
    expect(peek()?.dataset['present']).toBe('window')
    fireEvent.click(screen.getByRole('button', { name: 'Open as' }))
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Side panel' }))
    expect(peek()?.dataset['present']).toBe('peek')
    unmount()
    render(<Compose />)
    expect(peek()?.dataset['present']).toBe('peek')
    presentationStore('compose-test').reset()
  })

  test('opens as a side panel by default, with the Open as menu in its header', () => {
    const { region } = shell()
    render(<Shelled region={region} onClose={() => {}} />)
    expect(peek()?.dataset['present']).toBe('peek')
    expect(region.contains(peek())).toBe(true)
    expect(screen.getByRole('button', { name: 'Open as' })).toBeTruthy()
  })

  test('the menu switches to a window, and the choice is remembered for the kind', async () => {
    const { region } = shell()
    const { unmount } = render(<Shelled region={region} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open as' }))
    const item = await screen.findByRole('menuitemradio', { name: 'Window' })
    fireEvent.click(item)
    expect(peek()?.dataset['present']).toBe('window')
    expect(region.contains(peek())).toBe(false)
    expect(presentationStore('issue').get()).toBe('window')
    unmount()
    render(<Shelled region={region} onClose={() => {}} />)
    expect(peek()?.dataset['present']).toBe('window')
  })

  test('page covers main and the aside: it is placed on the surface grid, not in the region', () => {
    presentationStore('issue').set('page')
    const { surface, region } = shell()
    render(<Shelled region={region} onClose={() => {}} />)
    const el = peek()
    expect(el?.dataset['present']).toBe('page')
    expect(el?.parentElement).toBe(surface)
    expect(el?.style.gridColumn).toBe('main-start / aside-end')
  })

  for (const present of ['peek', 'window', 'page'] as Presentation[]) {
    test(`as ${present}, Escape closes it and focus goes back to the opener`, () => {
      presentationStore('issue').set(present)
      const row = opener()
      const { region } = shell()
      function Toggle(): ReactElement | null {
        const [open, setOpen] = useState(true)
        return open ? <Shelled region={region} onClose={() => setOpen(false)} /> : null
      }
      render(<Toggle />)
      const el = peek() as HTMLElement
      expect(document.activeElement).toBe(el)
      expect(document.querySelector('[inert]')).toBeNull()
      fireEvent.keyDown(el, { key: 'Escape' })
      expect(peek()).toBeNull()
      expect(document.activeElement).toBe(row)
    })
  }

  test('in a field the first Escape only leaves the field', () => {
    const onClose = mock(() => {})
    const { region } = shell()
    render(<Shelled region={region} onClose={onClose} />)
    const input = screen.getByLabelText('note')
    input.focus()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  test('a window minimises to a chip and restores', async () => {
    presentationStore('issue').set('window')
    const { region } = shell()
    render(<Shelled region={region} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open as' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Minimise' }))
    expect(peek()?.dataset['present']).toBe('chip')
    expect(document.activeElement).toBe(peek())
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
    expect(peek()?.dataset['present']).toBe('window')
  })

  test('a window dragged by its header comes back to the same place after a minimise', async () => {
    presentationStore('issue').set('window')
    const { region } = shell()
    render(<Shelled region={region} onClose={() => {}} />)
    const header = document.querySelector(
      '[data-present="window"] [data-panel="header"]',
    ) as HTMLElement
    const x0 = parseFloat(peek()?.style.getPropertyValue('--win-x') ?? '0')
    act(() => {
      header.dispatchEvent(
        new PointerEvent('pointerdown', { button: 0, clientX: 300, clientY: 300, bubbles: true }),
      )
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 260, clientY: 320 }))
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: 260, clientY: 320 }))
    })
    const moved = parseFloat(peek()?.style.getPropertyValue('--win-x') ?? '0')
    expect(moved).toBe(x0 - 40)
    fireEvent.click(screen.getByRole('button', { name: 'Open as' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Minimise' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
    expect(parseFloat(peek()?.style.getPropertyValue('--win-x') ?? '0')).toBe(moved)
  })

  test('a window resized from a corner keeps its size for the kind', () => {
    presentationStore('issue').set('window')
    const { region } = shell()
    render(<Shelled region={region} onClose={() => {}} />)
    const corner = document.querySelector('[data-edge="se"]') as HTMLElement
    const before = parseFloat(peek()?.style.getPropertyValue('--win-w') ?? '0')
    act(() => {
      corner.dispatchEvent(
        new PointerEvent('pointerdown', { button: 0, clientX: 100, clientY: 100, bubbles: true }),
      )
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 140, clientY: 130 }))
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: 140, clientY: 130 }))
    })
    expect(parseFloat(peek()?.style.getPropertyValue('--win-w') ?? '0')).toBe(before + 40)
    expect(windowStore('issue').get()?.w).toBe(before + 40)
  })
})

describe('Peek records', () => {
  function Stepper({ region }: { region: HTMLElement }): ReactElement {
    const [id, setId] = useState('a')
    return (
      <Shelled
        region={region}
        onClose={() => {}}
        records={{ ids: ['a', 'b', 'c'], id, onStep: setId }}
      />
    )
  }
  const prev = (): HTMLButtonElement => screen.getByRole('button', { name: 'Previous record' })
  const next = (): HTMLButtonElement => screen.getByRole('button', { name: 'Next record' })

  test('previous and next step through the ids and stop at the ends', () => {
    const { region } = shell()
    render(<Stepper region={region} />)
    expect(prev().disabled).toBe(true)
    fireEvent.click(next())
    fireEvent.click(next())
    expect(next().disabled).toBe(true)
    expect(prev().disabled).toBe(false)
    fireEvent.click(prev())
    expect(prev().disabled).toBe(false)
    expect(next().disabled).toBe(false)
  })

  test("ArrowDown and ArrowUp on the panel step in place; in the body they are the body's", () => {
    const { region } = shell()
    const steps = mock((_id: string) => {})
    render(
      <Shelled
        region={region}
        onClose={() => {}}
        records={{ ids: ['a', 'b'], id: 'a', onStep: steps }}
      />,
    )
    fireEvent.keyDown(peek() as HTMLElement, { key: 'ArrowUp' })
    expect(steps).not.toHaveBeenCalled()
    fireEvent.keyDown(peek() as HTMLElement, { key: 'ArrowDown' })
    expect(steps).toHaveBeenCalledWith('b')
    fireEvent.keyDown(screen.getByLabelText('note'), { key: 'ArrowDown' })
    expect(steps).toHaveBeenCalledTimes(1)
  })
})

describe('Peek on a phone', () => {
  test("the sheet's header keeps the record's actions and its steps", () => {
    wide = false
    const { region } = shell()
    const { host } = fakeHost()
    const run = mock(() => {})
    render(
      <PageHostContext value={host}>
        <ShellOverlayContext value={region}>
          <Peek
            title="Issue 12"
            onClose={() => {}}
            records={{ ids: ['a', 'b'], id: 'a', onStep: () => {} }}
            actions={[{ id: 'copy', label: 'Copy link', onClick: run }]}
          />
        </ShellOverlayContext>
      </PageHostContext>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(run).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Next record' })).toBeTruthy()
  })

  for (const present of ['peek', 'window', 'page'] as Presentation[]) {
    test(`a ${present} presentation is a bottom sheet with the scrim`, () => {
      wide = false
      presentationStore('issue').set(present)
      const { region } = shell()
      render(<Shelled region={region} onClose={() => {}} />)
      const sheet = document.querySelector('[data-slot="sheet-content"]') as HTMLElement | null
      expect(sheet).not.toBeNull()
      expect(sheet?.dataset['present']).toBe('sheet')
      expect(sheet?.className).toContain('rounded-t-card')
      expect(peek()).toBeNull()
      expect(screen.queryByRole('button', { name: 'Open as' })).toBeNull()
    })
  }
})
