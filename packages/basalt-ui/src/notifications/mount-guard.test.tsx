/**
 * F15 — `overlays-mount.tsx`'s own JSDoc warns: mount exactly ONE `<BasaltOverlays notifications
 * />` per app (double-mount of `<Notifications />`). `useNotificationsMountGuard` is the shared
 * counter that enforces it.
 */
import { MantineProvider } from '@mantine/core'
import { act, render } from '@testing-library/react'
import { describe, expect, spyOn, test } from 'bun:test'
import type { ReactElement } from 'react'
import { BasaltOverlays } from '../commands/overlays-mount'

function renderWith(node: ReactElement) {
  return render(<MantineProvider>{node}</MantineProvider>)
}

/**
 * `BasaltOverlays`' notifications layer is `React.lazy` (`@mantine/notifications` resolves via a
 * real dynamic `import()`) — the guard warning itself fires synchronously in `NotificationsLayer`'s
 * effect, before the import settles, but the import still resolves later and React complains if
 * that resolution lands outside `act`. A couple of `Promise.resolve()` ticks does NOT actually
 * settle it (`commands/overlays-mount.test.tsx`'s `flushLazyImports` measured the real shape: the
 * resolved mount lands only after the import plus a macrotask) — await the real dynamic import
 * itself, then a macrotask, the same way.
 */
async function flushLazyImport(): Promise<void> {
  await act(async () => {
    await import('@mantine/notifications')
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

function overlays() {
  return (
    <BasaltOverlays modals={false} spotlight={false} hotkeys={false}>
      <div>app</div>
    </BasaltOverlays>
  )
}

describe('duplicate Notifications-mount guard (F15)', () => {
  test('one BasaltOverlays with its notifications layer enabled does not warn', async () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    const { unmount } = renderWith(overlays())
    expect(warn).not.toHaveBeenCalled()
    await flushLazyImport()
    unmount()
    warn.mockRestore()
  })

  test('mounting TWO BasaltOverlays at once warns', async () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    const first = renderWith(overlays())
    const second = renderWith(overlays())
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('more than one Notifications overlay')
    await flushLazyImport()
    first.unmount()
    second.unmount()
    warn.mockRestore()
  })

  test('a second BasaltOverlays with notifications={false} contributes no mount — stays unwarned', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    const first = renderWith(overlays())
    const second = renderWith(
      <BasaltOverlays modals={false} spotlight={false} hotkeys={false} notifications={false}>
        <div>app</div>
      </BasaltOverlays>,
    )
    expect(warn).not.toHaveBeenCalled()
    first.unmount()
    second.unmount()
    warn.mockRestore()
  })

  test('in a production build, mounting TWO at once does NOT warn — isDev() folds to false', async () => {
    const originalEnv = process.env['NODE_ENV']
    process.env['NODE_ENV'] = 'production'
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const first = renderWith(overlays())
      const second = renderWith(overlays())
      expect(warn).not.toHaveBeenCalled()
      await flushLazyImport()
      first.unmount()
      second.unmount()
    } finally {
      warn.mockRestore()
      if (originalEnv === undefined) delete process.env['NODE_ENV']
      else process.env['NODE_ENV'] = originalEnv
    }
  })
})
