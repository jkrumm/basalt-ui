/**
 * `useSizeClass`: a movable `matchMedia` stub drives each boundary independently; the server and
 * the hydration pass read `compact`, and a hydrated first render never warns about a mismatch.
 */
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { SIZE_CLASSES } from '../tokens/size-classes'
import { useSizeClass } from './use-size-class'
import type { SizeClass } from './use-size-class'

afterEach(cleanup)

function Probe() {
  return <span data-testid="result">{useSizeClass()}</span>
}

/** Viewport width in px: every `(min-width: Nem)` query answers against it. */
function installViewport(initialPx: number): {
  set: (px: number) => void
  listenerCount: () => number
  restore: () => void
} {
  const original = window.matchMedia
  let width = initialPx
  const listeners = new Set<() => void>()
  window.matchMedia = (query: string): MediaQueryList => {
    const minEm = Number(/min-width: ([\d.]+)em/.exec(query)?.[1])
    return {
      get matches() {
        return width >= minEm * 16
      },
      media: query,
      addEventListener: (_: string, l: () => void) => listeners.add(l),
      removeEventListener: (_: string, l: () => void) => listeners.delete(l),
    } as unknown as MediaQueryList
  }
  return {
    listenerCount: () => listeners.size,
    set: (px) => {
      width = px
      for (const l of listeners) l()
    },
    restore: () => {
      window.matchMedia = original
    },
  }
}

describe('useSizeClass', () => {
  test.each<[number, SizeClass]>([
    [SIZE_CLASSES.medium - 1, 'compact'],
    [SIZE_CLASSES.medium, 'medium'],
    [SIZE_CLASSES.expanded - 1, 'medium'],
    [SIZE_CLASSES.expanded, 'expanded'],
  ])('%ipx is %s', (px, expected) => {
    const viewport = installViewport(px)
    try {
      render(<Probe />)
      expect(screen.getByTestId('result').textContent).toBe(expected)
    } finally {
      viewport.restore()
    }
  })

  test('re-renders when a boundary is crossed', () => {
    const viewport = installViewport(400)
    try {
      render(<Probe />)
      expect(screen.getByTestId('result').textContent).toBe('compact')
      act(() => viewport.set(1300))
      expect(screen.getByTestId('result').textContent).toBe('expanded')
      act(() => viewport.set(900))
      expect(screen.getByTestId('result').textContent).toBe('medium')
    } finally {
      viewport.restore()
    }
  })

  test('the server snapshot is compact', () => {
    expect(renderToString(<Probe />)).toContain('compact')
  })

  test('without matchMedia it reads compact', () => {
    const original = window.matchMedia
    // @ts-expect-error -- simulate a shim that does not ship matchMedia
    window.matchMedia = undefined
    try {
      render(<Probe />)
      expect(screen.getByTestId('result').textContent).toBe('compact')
    } finally {
      window.matchMedia = original
    }
  })

  test('a client-rendered first render already reads matchMedia', () => {
    const viewport = installViewport(1300)
    const seen: SizeClass[] = []
    function Recorder() {
      seen.push(useSizeClass())
      return null
    }
    try {
      render(<Recorder />)
      expect(seen).toEqual(['expanded'])
    } finally {
      viewport.restore()
    }
  })

  test('a hydrated first render reads the server class, then the real one', async () => {
    const viewport = installViewport(1300)
    const seen: SizeClass[] = []
    function Recorder() {
      seen.push(useSizeClass())
      return null
    }
    const container = document.createElement('div')
    container.innerHTML = renderToString(<Recorder />)
    seen.length = 0
    try {
      await act(async () => {
        hydrateRoot(container, <Recorder />)
      })
      expect(seen[0]).toBe('compact')
      expect(seen.at(-1)).toBe('expanded')
    } finally {
      viewport.restore()
    }
  })

  test('hydrating server markup on a wide viewport raises no mismatch warning', async () => {
    const viewport = installViewport(1300)
    const errors = spyOn(console, 'error').mockImplementation(() => {})
    const container = document.createElement('div')
    container.innerHTML = renderToString(<Probe />)
    try {
      await act(async () => {
        hydrateRoot(container, <Probe />)
      })
      expect(errors).not.toHaveBeenCalled()
      expect(container.textContent).toBe('expanded')
    } finally {
      errors.mockRestore()
      viewport.restore()
    }
  })

  test('unmounting removes every listener', () => {
    const viewport = installViewport(400)
    try {
      const { unmount } = render(<Probe />)
      expect(viewport.listenerCount()).toBeGreaterThan(0)
      unmount()
      expect(viewport.listenerCount()).toBe(0)
    } finally {
      viewport.restore()
    }
  })

  test('a viewport that stays inside a class does not re-render', () => {
    const viewport = installViewport(900)
    let renders = 0
    function Counter() {
      renders++
      return <span>{useSizeClass()}</span>
    }
    try {
      render(<Counter />)
      const before = renders
      act(() => viewport.set(1000))
      expect(renders).toBe(before)
    } finally {
      viewport.restore()
    }
  })
})
