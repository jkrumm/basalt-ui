/**
 * `Dock`: the shell-owned record panel. Without a shell it is a block in flow; with one it portals
 * into the dock region, waits for it and tells the shell it is mounted (the claim that reserves
 * the column). Escape inside it closes it; focus moves in on mount and back on unmount. The
 * address and the pin are `usePeek`'s (`src/router/peek.router.test.tsx`); the reflow and its
 * motion are `tests/layout/dock.layout.test.ts`'s.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { Dock } from './dock'
import { PageHostContext, ShellDockContext } from './page'
import type { ShellDock } from './page'
import { fakeHost } from './page.test-support'

afterEach(cleanup)

const panel = (): HTMLElement | null => document.querySelector('[data-slot="dock"]')

describe('Dock: standalone', () => {
  test('is a labelled landmark in flow with its title, tag and body, nothing inert', () => {
    render(
      <main>
        <p>the page</p>
        <Dock title="Issue 12" tag="#12" onClose={() => {}}>
          <p>body</p>
        </Dock>
      </main>,
    )
    expect(panel()?.tagName).toBe('ASIDE')
    expect(screen.getByRole('complementary', { name: 'Issue 12' })).toBe(panel() as HTMLElement)
    expect(screen.getByRole('heading', { name: 'Issue 12' })).toBeTruthy()
    expect(screen.getByText('#12')).toBeTruthy()
    expect(screen.getByText('body')).toBeTruthy()
    expect(screen.getByText('the page').closest('[inert],[aria-hidden="true"]')).toBeNull()
  })

  test('the close button and Escape inside the panel call onClose; the pin button is not drawn', () => {
    const onClose = mock(() => {})
    render(
      <Dock title="Issue 12" onClose={onClose}>
        <input aria-label="inside" />
      </Dock>,
    )
    expect(screen.queryByRole('button', { name: 'Dock panel' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    fireEvent.keyDown(panel() as HTMLElement, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  test('in a field the first Escape only leaves the field, so a draft is not thrown away', () => {
    const onClose = mock(() => {})
    render(
      <Dock title="Issue 12" onClose={onClose}>
        <input aria-label="inside" />
      </Dock>,
    )
    const input = screen.getByLabelText('inside')
    input.focus()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(document.activeElement).not.toBe(input)
  })

  test('leaves an Escape another control already used', () => {
    const onClose = mock(() => {})
    render(
      <Dock title="Issue 12" onClose={onClose}>
        <input
          aria-label="inside"
          onKeyDown={(event) => {
            if (event.key === 'Escape') event.preventDefault()
          }}
        />
      </Dock>,
    )
    fireEvent.keyDown(screen.getByLabelText('inside'), { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  test('moves focus in on mount and back to the opener on unmount', () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const { unmount } = render(<Dock title="Issue 12" onClose={() => {}} />)
    expect(document.activeElement).toBe(panel())
    unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })
})

function shelled(dock: ShellDock | null, present?: 'popup' | 'sheet'): void {
  const { host } = fakeHost()
  render(
    <PageHostContext value={host}>
      <ShellDockContext value={dock}>
        <Dock title="Issue 12" onClose={() => {}} {...(present !== undefined && { present })} />
      </ShellDockContext>
    </PageHostContext>,
  )
}

describe('Dock: under a shell', () => {
  test('portals into the dock region, pinned to the end edge, and claims the region', () => {
    const region = document.createElement('div')
    document.body.append(region)
    const release = mock(() => {})
    const claim = mock((_id: string) => release)
    shelled({ slot: region, docked: true, claim })
    const el = region.querySelector('[data-slot="dock"]')
    expect(el).not.toBeNull()
    expect(el?.className).toContain('absolute')
    expect(el?.getAttribute('data-state')).toBe('docked')
    expect(claim).toHaveBeenCalledTimes(1)
    cleanup()
    expect(release).toHaveBeenCalledTimes(1)
    region.remove()
  })

  test('a Dock drawn as a sheet claims no region and publishes no width', () => {
    const region = document.createElement('div')
    document.body.append(region)
    const claim = mock((_id: string) => () => {})
    const setWidth = mock((_px: number) => () => {})
    shelled({ slot: region, docked: true, claim, setWidth }, 'sheet')
    expect(claim).not.toHaveBeenCalled()
    expect(setWidth).not.toHaveBeenCalled()
    region.remove()
  })

  test('is the overlay form when the region does not dock', () => {
    const region = document.createElement('div')
    document.body.append(region)
    shelled({ slot: region, docked: false, claim: () => () => {} })
    expect(region.querySelector('[data-slot="dock"]')?.getAttribute('data-state')).toBe('overlay')
    region.remove()
  })

  test('renders nothing until the region has mounted', () => {
    shelled({ slot: null, docked: false, claim: () => () => {} })
    expect(panel()).toBeNull()
  })
})
