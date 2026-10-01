/**
 * `useCoarsePointer` — reads the `(pointer: coarse)` query through a stubbed `matchMedia` on the
 * FIRST render (a `createRoot` app), and the server snapshot is `false`.
 */
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { useCoarsePointer } from './use-media-query'

afterEach(cleanup)

function Probe() {
  return <span data-testid="result">{String(useCoarsePointer())}</span>
}

function stubPointer(coarse: boolean): () => void {
  const original = window.matchMedia
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: query === '(pointer: coarse)' && coarse,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList
  return () => {
    window.matchMedia = original
  }
}

describe('useCoarsePointer', () => {
  test.each([true, false])('returns %s on the first client render', (coarse) => {
    const restore = stubPointer(coarse)
    try {
      render(<Probe />)
      expect(screen.getByTestId('result').textContent).toBe(String(coarse))
    } finally {
      restore()
    }
  })

  test('the server snapshot is false', () => {
    const restore = stubPointer(true)
    try {
      expect(renderToString(<Probe />)).toContain('false')
    } finally {
      restore()
    }
  })

  test('re-renders when the pointer flips to coarse after mount', () => {
    const original = window.matchMedia
    const listeners = new Set<() => void>()
    const list = {
      matches: false,
      media: '(pointer: coarse)',
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    }
    window.matchMedia = () => list as unknown as MediaQueryList
    try {
      render(<Probe />)
      expect(screen.getByTestId('result').textContent).toBe('false')
      act(() => {
        list.matches = true
        for (const listener of listeners) listener()
      })
      expect(screen.getByTestId('result').textContent).toBe('true')
    } finally {
      window.matchMedia = original
    }
  })
})
