/**
 * `CodeBlock` (docs/v3/concepts/ai-mdx.md C10): the source is always on screen, highlighted when
 * shiki resolves and plain otherwise; the copy button lives on `ui/button` with the `ai.copy`
 * name and is hidden while the block is still streaming. Highlighting never throws and never
 * rejects: an unknown language and a shiki that fails to load both end in the plain `<pre>`.
 *
 * The failing-peer case loads a FRESH copy of `./highlighter` (a `?query` gives a new module
 * instance, so the module-level singleton starts empty) while `shiki/core` is mocked to fail; the
 * real module is put back afterwards so no later test sees the mock.
 */
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { CodeBlock } from './code-block'

afterEach(cleanup)

/** A computed specifier: a `?query` gives a fresh module instance, which TypeScript cannot resolve. */
const freshSpecifier = (path: string, tag: string): string => `${path}?${tag}`

// bun's `process` typing narrows `on` to its own event names; the Node emitter takes any.
const events: NodeJS.EventEmitter = process
const rejections: unknown[] = []
const onRejection = (reason: unknown): void => {
  rejections.push(reason)
}
beforeEach(() => {
  rejections.length = 0
  events.on('unhandledRejection', onRejection)
})
afterEach(async () => {
  // Lets pending dynamic imports and their `.catch` handlers run before asserting "no rejection".
  await new Promise((resolve) => setTimeout(resolve, 50))
  events.off('unhandledRejection', onRejection)
  expect(rejections).toEqual([])
})

describe('CodeBlock — the plain block', () => {
  test('no language renders the source in a pre with its own scroll box', () => {
    const { container } = render(<CodeBlock code="const x = 1" />)
    const pre = container.querySelector('pre')
    expect(pre?.textContent).toBe('const x = 1')
    expect(pre?.getAttribute('tabindex')).toBe('0')
    expect(pre?.className).toContain('overflow-x-auto')
  })

  test('the root carries data-slot and the language', () => {
    const { container } = render(<CodeBlock lang="ts" code="x" />)
    const root = container.firstElementChild
    expect(root?.getAttribute('data-slot')).toBe('code-block')
    expect(root?.getAttribute('data-lang')).toBe('ts')
  })

  test('the server render carries the source (no Suspense fallback)', () => {
    const html = renderToString(<CodeBlock lang="ts" code="const server = true" />)
    expect(html).toContain('const server = true')
  })
})

describe('CodeBlock — the copy button', () => {
  test('is named ai.copy and copies the source', async () => {
    const written: string[] = []
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string): Promise<void> => {
          written.push(text)
          return Promise.resolve()
        },
      },
    })
    const { getByRole } = render(<CodeBlock code="bun add basalt-ui" />)
    const button = getByRole('button', { name: 'Copy' })
    expect(button.getAttribute('data-slot')).toBe('button')
    fireEvent.click(button)
    await waitFor(() => expect(written).toEqual(['bun add basalt-ui']))
    await waitFor(() => expect(button.hasAttribute('data-copied')).toBe(true))
    expect(getByRole('status').textContent).toBe('Copied')
  })

  test('a failing clipboard leaves the block unchanged and does not throw', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (): Promise<void> => Promise.reject(new Error('denied')) },
    })
    const { getByRole } = render(<CodeBlock code="x" />)
    const button = getByRole('button', { name: 'Copy' })
    fireEvent.click(button)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(button.hasAttribute('data-copied')).toBe(false)
  })

  test('is absent while the block is streaming and present once settled', () => {
    const { queryByRole, rerender } = render(<CodeBlock code="x" settled={false} />)
    expect(queryByRole('button')).toBeNull()
    rerender(<CodeBlock code="x" settled />)
    expect(queryByRole('button', { name: 'Copy' })).not.toBeNull()
  })
})

describe('CodeBlock — shiki', () => {
  test('a known language highlights and keeps the text', async () => {
    const { container } = render(<CodeBlock lang="ts" code="const a: number = 1" />)
    await waitFor(() => expect(container.querySelector('[style*="--shiki-"]')).not.toBeNull())
    expect(container.textContent).toContain('const a: number = 1')
  })

  test('an alias resolves to its grammar', async () => {
    const { container } = render(<CodeBlock lang="TS" code="let b = 2" />)
    await waitFor(() => expect(container.querySelector('[style*="--shiki-"]')).not.toBeNull())
  })

  test.each(['ruby', 'cobol', 'constructor', '__proto__', 'toString'])(
    'language %s (not in the curated map) renders the source in a plain pre and code',
    async (lang) => {
      const { container } = render(<CodeBlock lang={lang} code="let answer = 42" />)
      await new Promise((resolve) => setTimeout(resolve, 30))
      expect(container.querySelector('pre')?.textContent).toContain('let answer = 42')
      expect(container.querySelector('[style*="--shiki-"]')).toBeNull()
    },
  )

  test('shiki missing: highlightCode resolves null once, reported with the fix, never thrown', async () => {
    // A SNAPSHOT: the namespace object is live, so restoring from it would restore the mock.
    const real = { ...(await import('shiki/core')) }
    mock.module('shiki/core', () => ({
      createHighlighterCore: () => Promise.reject(new Error('shiki failed to initialise')),
    }))
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const fresh = (await import(
        freshSpecifier('./highlighter', 'code-block-no-shiki')
      )) as typeof import('./highlighter')
      await expect(fresh.highlightCode('const a = 1', 'ts')).resolves.toBeNull()
      await expect(fresh.highlightCode('const b = 2', 'ts')).resolves.toBeNull()
      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0]?.[0])).toContain(
        'bun add shiki @shikijs/langs @shikijs/themes',
      )
    } finally {
      warn.mockRestore()
      mock.module('shiki/core', () => real)
    }
  })

  test('keeps its text through re-renders with an unhighlightable language', async () => {
    const { container, rerender } = render(<CodeBlock lang="cobol" code="one" />)
    expect(container.querySelector('pre')?.textContent).toBe('one')
    rerender(<CodeBlock lang="cobol" code="one two" />)
    expect(container.querySelector('pre')?.textContent).toBe('one two')
  })
})
