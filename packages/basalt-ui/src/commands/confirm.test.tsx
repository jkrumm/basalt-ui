/**
 * `overlays.confirm` / `overlays.confirmDelete` (audit B #12) — the two-button dialog every
 * consumer was writing as a `defineOverlays` entry with its own button pair.
 *
 * The dialog is served by a SIBLING `ModalsProvider` over `@mantine/modals`' window event bus
 * (see `overlays-mount.tsx`), so these tests mount the provider and drive the real buttons — the
 * promise's value, the exactly-once callbacks and the destructive tone are all DOM-observable.
 *
 * Availability is a COUNTER of live providers, not `BasaltOverlays`' `modals` flag, so both ways of
 * getting one on screen are exercised here: basalt's own mount, and a consumer's provider declared
 * with `registerModalsProvider()`.
 */
import { MantineProvider } from '@mantine/core'
import { ModalsProvider, modals } from '@mantine/modals'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { BasaltOverlays } from './overlays-mount'
import { overlays, registerModalsProvider } from './define-overlays'

/** A consumer mounting the provider ITSELF — the documented remedy, registration included. */
function ConsumerModalsHost({ children }: { children?: ReactNode }) {
  useEffect(() => registerModalsProvider(), [])
  return <ModalsProvider>{children ?? <div />}</ModalsProvider>
}

function renderModalsHost() {
  return render(
    <MantineProvider>
      <ConsumerModalsHost />
    </MantineProvider>,
  )
}

/** `<BasaltOverlays>` with only the modals layer up — basalt's own registration path. */
function renderOverlaysHost() {
  return render(
    <MantineProvider>
      <BasaltOverlays spotlight={false} notifications={false} hotkeys={false}>
        <div />
      </BasaltOverlays>
    </MantineProvider>,
  )
}

/** Settles the lazy `import('@mantine/modals')` inside `loadModals()` plus React's commit. */
async function flush(): Promise<void> {
  await act(async () => {
    await import('@mantine/modals')
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function click(name: string): Promise<void> {
  const button = screen.getByRole('button', { name })
  await act(async () => {
    button.click()
    await Promise.resolve()
  })
}

afterEach(() => {
  // The modals store is module-level and outlives Testing Library's DOM cleanup.
  modals.closeAll()
})

describe('overlays.confirm', () => {
  test('resolves true and runs onConfirm once when confirmed', async () => {
    const host = renderModalsHost()
    let confirmed = 0
    let cancelled = 0

    const answer = overlays.confirm({
      title: 'Discard draft?',
      body: 'The draft is not saved yet.',
      onConfirm: () => {
        confirmed++
      },
      onCancel: () => {
        cancelled++
      },
    })
    await flush()

    expect(screen.getByText('The draft is not saved yet.')).not.toBeNull()
    await click('Confirm')

    expect(await answer).toBe(true)
    expect(confirmed).toBe(1)
    expect(cancelled).toBe(0)
    host.unmount()
  })

  test('resolves false and runs onCancel once when cancelled', async () => {
    const host = renderModalsHost()
    let confirmed = 0
    let cancelled = 0

    const answer = overlays.confirm({
      title: 'Discard draft?',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
      onConfirm: () => {
        confirmed++
      },
      onCancel: () => {
        cancelled++
      },
    })
    await flush()
    await click('Keep editing')

    expect(await answer).toBe(false)
    expect(confirmed).toBe(0)
    // Mantine fires onCancel AND onClose on the cancel button — the answer settles exactly once.
    expect(cancelled).toBe(1)
    host.unmount()
  })

  test('danger paints the confirm button in the destructive tone', async () => {
    const host = renderModalsHost()
    const answer = overlays.confirm({
      title: 'Revoke access?',
      confirmLabel: 'Revoke',
      danger: true,
      onConfirm: () => {},
    })
    await flush()

    const confirmButton = screen.getByRole('button', { name: 'Revoke' })
    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    expect(confirmButton.getAttribute('style')).toContain('red')
    expect(cancelButton.getAttribute('style') ?? '').not.toContain('red')

    await click('Revoke')
    expect(await answer).toBe(true)
    host.unmount()
  })

  test('a throwing onConfirm still resolves the promise to true', async () => {
    const host = renderModalsHost()

    // `settle(true)` — the exact closure `confirm()` hands Mantine as `onConfirm` — is captured
    // here and invoked DIRECTLY rather than through a real button click. A real click's throw
    // would unwind through React's own synthetic dispatch uncaught (same as any DOM event
    // listener a browser reports rather than propagates back to the caller), which happy-dom
    // reproduces faithfully enough that it destabilizes React's shared act()/scheduler state for
    // every test after it in this process — a harness hazard, not something this test is about.
    // Calling the captured closure directly exercises the identical `settle` code path with none
    // of that risk.
    const openConfirmModal = spyOn(modals, 'openConfirmModal')
    const answer = overlays.confirm({
      title: 'Discard draft?',
      onConfirm: () => {
        throw new Error('boom')
      },
    })
    await flush()

    const payload = openConfirmModal.mock.calls[0]?.[0]
    expect(() => payload?.onConfirm?.()).toThrow('boom')

    expect(await answer).toBe(true)
    openConfirmModal.mockRestore()
    host.unmount()
  })

  test('confirmDelete counts the subject and defaults to the delete idiom', async () => {
    const host = renderModalsHost()
    let deleted = 0
    const answer = overlays.confirmDelete({
      subject: 'item',
      count: 3,
      onConfirm: () => {
        deleted++
      },
    })
    await flush()

    expect(screen.getByText('Delete 3 items?')).not.toBeNull()
    await click('Delete')

    expect(await answer).toBe(true)
    expect(deleted).toBe(1)
    host.unmount()
  })

  test('confirmDelete keeps the subject singular at count 1', async () => {
    const host = renderModalsHost()
    const answer = overlays.confirmDelete({ subject: 'API key', onConfirm: () => {} })
    await flush()

    expect(screen.getByText('Delete API key?')).not.toBeNull()
    await click('Cancel')
    expect(await answer).toBe(false)
    host.unmount()
  })

  /**
   * Escape / click-outside / the X fire Mantine's `onClose` and NOT `onCancel`
   * (`ModalsProvider.closeModal(id)` passes no `canceled`, so `handleCloseModal` skips the
   * confirm-modal `onCancel` branch and calls `onClose` alone) — while the cancel BUTTON fires
   * `onCancel` and then `onClose`. Two different Mantine paths reaching one answer, which is why
   * `confirm` settles once and treats every later edge as a no-op.
   */
  test('escape resolves false through onClose alone, without a second onCancel', async () => {
    const host = renderModalsHost()
    let confirmed = 0
    let cancelled = 0

    const answer = overlays.confirm({
      title: 'Discard draft?',
      onConfirm: () => {
        confirmed++
      },
      onCancel: () => {
        cancelled++
      },
    })
    await flush()

    await act(async () => {
      fireEvent.keyDown(document.body, { key: 'Escape' })
      await Promise.resolve()
    })

    expect(await answer).toBe(false)
    expect(confirmed).toBe(0)
    expect(cancelled).toBe(1)
    host.unmount()
  })
})

/**
 * WHICH modals layer is live, and the counter that answers it. The flag this replaced was
 * `BasaltOverlays`' own `modals` prop, which refused the call whenever a shell passed
 * `modals={false}` — even with the consumer's own `<ModalsProvider>` up, the remedy the error
 * message itself names.
 */
describe('the modals-layer availability counter', () => {
  test('rejects with a named [basalt] error when no provider is mounted at all', async () => {
    let confirmed = 0
    await expect(
      overlays.confirm({
        title: 'Discard draft?',
        onConfirm: () => {
          confirmed++
        },
      }),
    ).rejects.toThrow(/^\[basalt\] overlays\.confirm: needs a mounted <ModalsProvider>/)
    expect(confirmed).toBe(0)
  })

  test("BasaltOverlays' own modals layer serves the dialog", async () => {
    const host = renderOverlaysHost()
    await flush()

    const answer = overlays.confirm({ title: 'Discard draft?', onConfirm: () => {} })
    await flush()
    await click('Confirm')

    expect(await answer).toBe(true)
    host.unmount()
  })

  test('a consumer provider declared with registerModalsProvider serves it too', async () => {
    // The exact combination the old flag refused: basalt's layer off, the consumer's own up.
    const host = render(
      <MantineProvider>
        <BasaltOverlays modals={false} spotlight={false} notifications={false} hotkeys={false}>
          <ConsumerModalsHost />
        </BasaltOverlays>
      </MantineProvider>,
    )
    await flush()

    const answer = overlays.confirm({ title: 'Discard draft?', onConfirm: () => {} })
    await flush()
    await click('Confirm')

    expect(await answer).toBe(true)
    host.unmount()
  })

  test('two overlapping BasaltOverlays mounts keep the count honest', async () => {
    // A route swap mounts the next shell BEFORE unmounting the previous one. A last-write-wins
    // flag reported the old one's teardown as "no layer" while the new one was already serving.
    const first = renderOverlaysHost()
    await flush()
    const second = renderOverlaysHost()
    await flush()
    first.unmount()

    const answer = overlays.confirm({ title: 'Still served?', onConfirm: () => {} })
    await flush()
    await click('Confirm')
    expect(await answer).toBe(true)

    second.unmount()
    await expect(
      overlays.confirm({ title: 'Discard draft?', onConfirm: () => {} }),
    ).rejects.toThrow(/needs a mounted <ModalsProvider>/)
  })
})
