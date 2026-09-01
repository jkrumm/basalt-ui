/**
 * R1 — `BasaltOverlays` used to render `<Suspense fallback={<>{content}</>}><LazyModalsProvider>
 * {content}</LazyModalsProvider></Suspense>` with the consumer's `children` inside `content`.
 * `React.lazy` suspends on its FIRST render even when the module is warm, so the app's first
 * commit was deferred past a microtask (TanStack Router then setState'd onto a not-yet-mounted
 * fiber) and `children` mounted TWICE — once in the fallback tree, once in the resolved one.
 *
 * These tests pin the structural invariant instead of the React warning string (a microtask race
 * that happy-dom cannot reproduce): children commit on the first pass and mount exactly once,
 * while the imperative modals API still works from a SIBLING ModalsProvider.
 *
 * ORDER MATTERS: the first test must run first — once any test resolves `LazyModalsProvider`'s
 * payload, `React.lazy` stops suspending and the "before the import resolves" half is vacuous.
 */
import { MantineProvider } from '@mantine/core'
import { modals } from '@mantine/modals'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { useLayoutEffect } from 'react'
import { BasaltOverlays } from './overlays-mount'

/**
 * Settles the modals layer's real dynamic `import()` inside `act`. A couple of `Promise.resolve()`
 * ticks is NOT enough — measured against the old wrapping shape, the second mount only lands after
 * the import plus a macrotask, so a microtask-only flush makes the post-resolution assertions
 * vacuous rather than green.
 */
async function flushLazyImports(): Promise<void> {
  await act(async () => {
    await import('@mantine/modals')
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('BasaltOverlays — children never sit under a lazy boundary (R1)', () => {
  test('children commit on the first pass and mount exactly once', async () => {
    let mounts = 0
    function Probe() {
      useLayoutEffect(() => {
        mounts++
      }, [])
      return <div data-testid="app" />
    }

    const { unmount } = render(
      <MantineProvider>
        <BasaltOverlays spotlight={false} notifications={false} hotkeys={false}>
          <Probe />
        </BasaltOverlays>
      </MantineProvider>,
    )

    // Before the @mantine/modals chunk resolves: already committed, exactly one mount.
    expect(mounts).toBe(1)
    expect(screen.getByTestId('app')).not.toBeNull()

    await flushLazyImports()

    // After it resolves: still ONE mount — no fallback-then-resolved double mount.
    expect(mounts).toBe(1)
    expect(screen.getByTestId('app')).not.toBeNull()
    unmount()
  })

  test('the sibling ModalsProvider still serves the imperative modals API', async () => {
    const { unmount } = render(
      <MantineProvider>
        <BasaltOverlays spotlight={false} notifications={false} hotkeys={false}>
          <div data-testid="app" />
        </BasaltOverlays>
      </MantineProvider>,
    )
    await flushLazyImports()

    await act(async () => {
      modals.open({ title: 'Confirm', children: <div>modal body</div> })
      await Promise.resolve()
    })

    expect(screen.getByText('modal body')).not.toBeNull()

    await act(async () => {
      modals.closeAll()
      await Promise.resolve()
    })
    unmount()
  })

  test('modals={false} mounts no ModalsProvider — the imperative API opens nothing', async () => {
    const { unmount } = render(
      <MantineProvider>
        <BasaltOverlays modals={false} spotlight={false} notifications={false} hotkeys={false}>
          <div data-testid="app" />
        </BasaltOverlays>
      </MantineProvider>,
    )
    await flushLazyImports()

    await act(async () => {
      modals.open({ title: 'Confirm', children: <div>disabled body</div> })
      await Promise.resolve()
    })

    expect(screen.queryByText('disabled body')).toBeNull()
    expect(screen.getByTestId('app')).not.toBeNull()
    unmount()
  })
})
