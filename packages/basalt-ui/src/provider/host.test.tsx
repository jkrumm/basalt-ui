/** `data-basalt-host` on `<html>` — set by `BasaltProvider`, the only `display-mode` reader. */
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { BasaltProvider, useHostAttribute } from './index'

afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute('data-basalt-host')
})

function stubDisplayMode(standalone: boolean): () => void {
  const original = window.matchMedia
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: query === '(display-mode: standalone)' && standalone,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList
  return () => {
    window.matchMedia = original
  }
}

/** A standalone stub whose `change` listeners the test can fire after flipping `matches`. */
function stubChangeableDisplayMode(): { flip: (standalone: boolean) => void; restore: () => void } {
  const original = window.matchMedia
  let standalone = false
  const listeners = new Set<(event: { matches: boolean }) => void>()
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      get matches() {
        return query === '(display-mode: standalone)' && standalone
      },
      media: query,
      addEventListener: (_: string, l: (event: { matches: boolean }) => void) => listeners.add(l),
      removeEventListener: (_: string, l: (event: { matches: boolean }) => void) =>
        listeners.delete(l),
    }) as unknown as MediaQueryList
  return {
    flip: (next) => {
      standalone = next
      for (const l of listeners) l({ matches: next })
    },
    restore: () => {
      window.matchMedia = original
    },
  }
}

function HostProbe(): null {
  useHostAttribute(undefined)
  return null
}

describe('BasaltProvider data-basalt-host', () => {
  test('web in a browser tab', () => {
    const restore = stubDisplayMode(false)
    try {
      render(<BasaltProvider>x</BasaltProvider>)
      expect(document.documentElement.getAttribute('data-basalt-host')).toBe('web')
    } finally {
      restore()
    }
  })

  test('pwa when display-mode is standalone', () => {
    const restore = stubDisplayMode(true)
    try {
      render(<BasaltProvider>x</BasaltProvider>)
      expect(document.documentElement.getAttribute('data-basalt-host')).toBe('pwa')
    } finally {
      restore()
    }
  })

  test('host="native" wins over display-mode', () => {
    const restore = stubDisplayMode(true)
    try {
      render(<BasaltProvider host="native">x</BasaltProvider>)
      expect(document.documentElement.getAttribute('data-basalt-host')).toBe('native')
    } finally {
      restore()
    }
  })

  test('the attribute is removed on unmount', () => {
    const restore = stubDisplayMode(false)
    try {
      const { unmount } = render(<BasaltProvider>x</BasaltProvider>)
      unmount()
      expect(document.documentElement.getAttribute('data-basalt-host')).toBeNull()
    } finally {
      restore()
    }
  })

  test('follows a display-mode change between web and pwa', () => {
    const stub = stubChangeableDisplayMode()
    try {
      render(<BasaltProvider>x</BasaltProvider>)
      expect(document.documentElement.getAttribute('data-basalt-host')).toBe('web')
      act(() => stub.flip(true))
      expect(document.documentElement.getAttribute('data-basalt-host')).toBe('pwa')
      act(() => stub.flip(false))
      expect(document.documentElement.getAttribute('data-basalt-host')).toBe('web')
    } finally {
      stub.restore()
    }
  })

  test('web when matchMedia is missing', () => {
    const original = window.matchMedia
    // @ts-expect-error -- simulate a shim that does not ship matchMedia
    window.matchMedia = undefined
    try {
      // Mantine's own provider needs `matchMedia`, so the hook is mounted alone.
      render(<HostProbe />)
      expect(document.documentElement.getAttribute('data-basalt-host')).toBe('web')
    } finally {
      window.matchMedia = original
    }
  })
})
