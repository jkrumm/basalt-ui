/**
 * Fence renderers degrade, never throw (docs/V2-SPEC.md § 6 "code and diagrams"): an unknown
 * language, an absent `shiki`, an absent `beautiful-mermaid` and a mermaid body that does not
 * parse all end in a plain `<pre><code>` with the source text intact — and none of it surfaces as
 * an unhandled rejection. (A truly ABSENT peer cannot be simulated in-process — the specifier
 * resolves — so shiki's init rejecting stands in for it; both land in the same `.catch`.)
 *
 * The failing-peer cases load a FRESH copy of `./highlighter` / `./mermaid` (a `?query` gives a new
 * module instance, so the module-level singleton promises start empty) while the peer's module is
 * mocked to fail; the real module is restored afterwards so no later test sees the mock.
 */
import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { CodeBlock } from './code-block'
import { Markdown } from './markdown'

/** MermaidDiagram's wrapper — `CodeBlock`'s copy icon is an `<svg>` too, so `svg` alone proves nothing. */
const DIAGRAM = '[role="img"] svg'

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

/** A computed specifier: a `?query` gives a fresh module instance, which TypeScript cannot resolve. */
const freshSpecifier = (path: string, tag: string): string => `${path}?${tag}`

function renderMd(text: string, streaming = false) {
  return render(
    <MantineProvider>
      <Markdown streaming={streaming} contentTrust="untrusted">
        {text}
      </Markdown>
    </MantineProvider>,
  )
}

async function plainPre(container: HTMLElement, text: string): Promise<HTMLPreElement> {
  const pre = await waitFor(() => {
    const found = container.querySelector('pre')
    expect(found).not.toBeNull()
    return found as HTMLPreElement
  })
  expect(pre.textContent).toContain(text)
  return pre
}

describe('shiki degrade', () => {
  test.each(['ruby', 'cobol', 'constructor', '__proto__', 'toString'])(
    'language %s (not in the curated map) renders the source in a plain <pre><code>',
    async (language) => {
      const { container } = renderMd(`\`\`\`${language}\nlet answer = 42\n\`\`\``)
      const pre = await plainPre(container, 'let answer = 42')
      expect(pre.querySelector('code')).not.toBeNull()
    },
  )

  test('a known language still highlights', async () => {
    const { container } = renderMd('```ts\nconst a: number = 1\n```')
    await waitFor(() => expect(container.querySelector('[style*="--shiki-"]')).not.toBeNull())
    expect(container.textContent).toContain('const a: number = 1')
  })

  test('shiki missing: highlightCode resolves null and CodeBlock keeps the text', async () => {
    // A SNAPSHOT: the namespace object is live, so restoring from it would restore the mock.
    const real = { ...(await import('shiki/core')) }
    mock.module('shiki/core', () => ({
      createHighlighterCore: () => Promise.reject(new Error('shiki failed to initialise')),
    }))
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const fresh = (await import(
        freshSpecifier('./highlighter', 'no-shiki')
      )) as typeof import('./highlighter')
      await expect(fresh.highlightCode('const a = 1', 'ts')).resolves.toBeNull()
      // Cached: the failed load is not retried per call, and still never rejects.
      await expect(fresh.highlightCode('const b = 2', 'ts')).resolves.toBeNull()
      // Reported once, with the fix, never thrown into the tree.
      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0]?.[0])).toContain(
        'bun add shiki @shikijs/langs @shikijs/themes',
      )
    } finally {
      warn.mockRestore()
      mock.module('shiki/core', () => real)
    }
  })

  test('CodeBlock with an unhighlightable language keeps its text through re-renders', async () => {
    const { container, rerender } = render(
      <MantineProvider>
        <CodeBlock code="one" language="cobol" />
      </MantineProvider>,
    )
    await plainPre(container, 'one')
    rerender(
      <MantineProvider>
        <CodeBlock code="one two" language="cobol" />
      </MantineProvider>,
    )
    await plainPre(container, 'one two')
  })
})

describe('mermaid degrade', () => {
  test('a settled, valid diagram renders an SVG with no executable markup', async () => {
    const { container } = renderMd(
      '```mermaid\ngraph TD\n  A["<img src=x onerror=alert(1)>"] --> B\n```\n\nafter\n',
      true,
    )
    await waitFor(() => expect(container.querySelector(DIAGRAM)).not.toBeNull())
    expect(container.querySelector('svg script, svg img, [onerror], [onload]')).toBeNull()
  })

  test('a settled diagram that does not parse stays a source block, no throw', async () => {
    const { container } = renderMd('```mermaid\nthis is {{ not a diagram\n```\n\nafter\n', true)
    const pre = await plainPre(container, 'this is {{ not a diagram')
    expect(container.querySelector(DIAGRAM)).toBeNull()
    expect(pre.querySelector('code')).not.toBeNull()
  })

  test('an empty mermaid fence degrades instead of throwing', async () => {
    const { container } = renderMd('```mermaid\n```\n\nafter\n', true)
    await screen.findByText('after')
    const pre = container.querySelector('pre')
    expect(pre?.querySelector('code')).not.toBeNull()
    expect(container.querySelector(DIAGRAM)).toBeNull()
  })

  test('a half-written diagram streams char by char without ever throwing', async () => {
    const source =
      '```mermaid\nflowchart LR\n  A[Start] --> B{Ok?}\n  B -->|yes| C[Done]\n```\n\nend\n'
    const { rerender } = renderMd('', true)
    for (let end = 1; end <= source.length; end++) {
      rerender(
        <MantineProvider>
          <Markdown streaming contentTrust="untrusted">
            {source.slice(0, end)}
          </Markdown>
        </MantineProvider>,
      )
    }
    await screen.findByText('end')
  })

  test('a renderer that always throws leaves MermaidDiagram on the source block', async () => {
    const real = { ...(await import('beautiful-mermaid')) }
    mock.module('beautiful-mermaid', () => ({
      renderMermaidSVG: (): never => {
        throw new Error('beautiful-mermaid is broken')
      },
    }))
    try {
      const { MermaidDiagram } = (await import(
        freshSpecifier('./mermaid', 'no-mermaid')
      )) as typeof import('./mermaid')
      const { container } = render(
        <MantineProvider>
          <MermaidDiagram code={'graph TD\n  A --> B'} />
        </MantineProvider>,
      )
      await plainPre(container, 'A --> B')
      expect(container.querySelector(DIAGRAM)).toBeNull()
    } finally {
      mock.module('beautiful-mermaid', () => real)
    }
  })
})
