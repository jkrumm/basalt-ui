/**
 * `Peek`: the non-modal panel. Without a shell it is a block in flow; with one it portals into the
 * shell's aside region and waits for it. Focus moves in on mount and back to the opener on unmount.
 * The address, the click handler and Escape are `usePeek`'s (`src/router/peek.router.test.tsx`);
 * geometry is `tests/layout/peek.layout.test.ts`'s.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { PageHostContext, ShellOverlayContext } from './page'
import { fakeHost } from './page.test-support'
import { Peek } from './peek'

afterEach(cleanup)

const panel = (): HTMLElement | null => document.querySelector('[data-slot="peek"]')

describe('Peek: standalone', () => {
  test('is a labelled, non-modal dialog with no scrim and nothing inert', () => {
    render(
      <main>
        <p>the page</p>
        <Peek title="Issue 12" onClose={() => {}}>
          <p>body</p>
        </Peek>
      </main>,
    )
    const el = panel()
    expect(el?.tagName).toBe('DIALOG')
    expect(el?.hasAttribute('open')).toBe(true)
    expect(el?.getAttribute('aria-label')).toBe('Issue 12')
    expect(screen.getByText('the page').closest('[inert],[aria-hidden="true"]')).toBeNull()
    expect(document.querySelector('[data-slot="sheet-content"], [role="presentation"]')).toBeNull()
  })

  test('draws its title, tag and body; the title is the heading', () => {
    render(
      <Peek title="Issue 12" tag="#12" onClose={() => {}}>
        <p>body</p>
      </Peek>,
    )
    expect(screen.getByRole('heading', { name: 'Issue 12' })).toBeTruthy()
    expect(screen.getByText('#12')).toBeTruthy()
    expect(screen.getByText('body')).toBeTruthy()
  })

  test('the close button calls onClose', () => {
    const onClose = mock(() => {})
    render(<Peek title="Issue 12" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('the full-page link sits inside data-peek="off" so the click handler leaves it alone', () => {
    render(<Peek title="Issue 12" fullPage="/issues/12" onClose={() => {}} />)
    const anchor = screen.getByRole('link', { name: 'Open full page' })
    expect(anchor.getAttribute('href')).toBe('/issues/12')
    expect(anchor.closest('[data-peek="off"]')).not.toBeNull()
  })

  test('draws no link without a full page', () => {
    render(<Peek title="Issue 12" onClose={() => {}} />)
    expect(screen.queryByRole('link')).toBeNull()
  })
})

function Harness(): ReactElement {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      {open && (
        <Peek title="Issue 12" onClose={() => setOpen(false)}>
          <input aria-label="inside" />
        </Peek>
      )}
    </>
  )
}

describe('Peek: focus', () => {
  test('moves in when it opens and back to the opener when it closes', () => {
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'open' })
    opener.focus()
    fireEvent.click(opener)
    expect(document.activeElement).toBe(panel())
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(document.activeElement).toBe(opener)
  })

  test('leaves focus alone on close when the reader already moved on', () => {
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'open' })
    opener.focus()
    fireEvent.click(opener)
    const elsewhere = document.createElement('button')
    document.body.append(elsewhere)
    elsewhere.focus()
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    })
    expect(document.activeElement).toBe(elsewhere)
    elsewhere.remove()
  })
})

describe('Peek: under a shell', () => {
  test('portals into the shell region, over main, and is positioned there', () => {
    const { host } = fakeHost()
    const region = document.createElement('div')
    document.body.append(region)
    render(
      <PageHostContext value={host}>
        <ShellOverlayContext value={region}>
          <Peek title="Issue 12" onClose={() => {}} />
        </ShellOverlayContext>
      </PageHostContext>,
    )
    expect(region.querySelector('[data-slot="peek"]')).not.toBeNull()
    expect(region.querySelector('[data-slot="peek"]')?.className).toContain('absolute')
    region.remove()
  })

  test('renders nothing until the region has mounted', () => {
    const { host } = fakeHost()
    render(
      <PageHostContext value={host}>
        <ShellOverlayContext value={null}>
          <Peek title="Issue 12" onClose={() => {}} />
        </ShellOverlayContext>
      </PageHostContext>,
    )
    expect(panel()).toBeNull()
  })
})
