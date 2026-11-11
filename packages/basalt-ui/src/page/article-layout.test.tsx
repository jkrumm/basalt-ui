/**
 * `ArticleLayout`: the header (title once, no empty meta row), the rail/trigger swap at the 1200px
 * breakpoint, the popover overlay, the reading-progress prop and the prev/next footer.
 *
 * Under happy-dom every element measures zero-size, so the popover's `hide` middleware may mark
 * the reference detached; queries into the open popup pass `{ hidden: true }`.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ReactElement } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { ArticleLayout } from './article-layout'

afterEach(cleanup)

const ARTICLE_BODY: ReactElement = (
  <>
    <h2 id="setup">Setup</h2>
    <p>Setup body.</p>
    <h2 id="usage">Usage</h2>
    <p>Usage body.</p>
  </>
)

function renderArticle(): ReturnType<typeof render> {
  return render(<ArticleLayout>{ARTICLE_BODY}</ArticleLayout>)
}

/** Every `(min-width)` query matching is the wide class; the shared dom shim pins them to `false`. */
function withWideViewport<T>(fn: () => T): T {
  const original = window.matchMedia
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: true,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
  try {
    return fn()
  } finally {
    window.matchMedia = original
  }
}

describe('ArticleLayout: the rail/trigger swap', () => {
  test('below the breakpoint: the trigger renders, the rail does not', () => {
    renderArticle()
    expect(screen.getByRole('button', { name: 'On this page' })).toBeDefined()
    expect(screen.queryByRole('navigation', { name: 'On this page' })).toBeNull()
  })

  test('at/above the breakpoint: the rail renders, the trigger does not', () => {
    withWideViewport(() => renderArticle())
    expect(screen.queryByRole('button', { name: 'On this page' })).toBeNull()
    expect(screen.getByRole('navigation', { name: 'On this page' })).toBeDefined()
  })

  test('toc={false} renders neither', () => {
    render(<ArticleLayout toc={false}>{ARTICLE_BODY}</ArticleLayout>)
    expect(screen.queryByRole('button', { name: 'On this page' })).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'On this page' })).toBeNull()
  })
})

describe('ArticleLayout: the popover overlay', () => {
  test('opens the same Toc, and a click on an entry closes it (onNavigate)', async () => {
    renderArticle()
    const trigger = screen.getByRole('button', { name: 'On this page' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('link', { name: 'Usage', hidden: true })).toBeNull()

    await act(async () => {
      fireEvent.click(trigger)
    })
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    await waitFor(
      () => {
        expect(screen.getByRole('link', { name: 'Usage', hidden: true })).toBeDefined()
      },
      { timeout: 2000 },
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('link', { name: 'Usage', hidden: true }))
    })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  test('the trigger toggles the popover closed on a second click', async () => {
    renderArticle()
    const trigger = screen.getByRole('button', { name: 'On this page' })

    await act(async () => {
      fireEvent.click(trigger)
    })
    await waitFor(
      () => {
        expect(screen.getByRole('link', { name: 'Setup', hidden: true })).toBeDefined()
      },
      { timeout: 2000 },
    )

    await act(async () => {
      fireEvent.click(trigger)
    })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('ArticleLayout: the header', () => {
  test('the title renders once, as the only h1', () => {
    const { container } = render(
      <ArticleLayout meta={{ title: 'Example Note' }}>{ARTICLE_BODY}</ArticleLayout>,
    )
    expect(screen.getAllByText('Example Note')).toHaveLength(1)
    expect(container.querySelectorAll('h1')).toHaveLength(1)
  })

  test('no description and no date leave no description paragraph, meta row or separator', () => {
    const { container } = render(
      <ArticleLayout meta={{ title: 'Bare' }}>{ARTICLE_BODY}</ArticleLayout>,
    )
    const header = container.querySelector('header') as HTMLElement
    expect(header.children).toHaveLength(1)
    expect(header.textContent).toBe('Bare')
    expect(header.textContent).not.toContain('·')
  })

  test('a description renders without a meta row', () => {
    const { container } = render(
      <ArticleLayout meta={{ title: 'T', description: 'A short description.' }}>
        {ARTICLE_BODY}
      </ArticleLayout>,
    )
    expect(screen.getByText('A short description.')).toBeDefined()
    expect((container.querySelector('header') as HTMLElement).children).toHaveLength(2)
  })

  test('date and reading time share one row with a separator', () => {
    render(
      <ArticleLayout meta={{ title: 'T', date: '2026-07-16', readingTime: 6 }}>
        {ARTICLE_BODY}
      </ArticleLayout>,
    )
    expect(screen.getByText('Jul 16, 2026')).toBeDefined()
    expect(screen.getByText('6 min read')).toBeDefined()
    expect(screen.getByText('·')).toBeDefined()
  })

  test('only a reading time renders no separator', () => {
    render(<ArticleLayout meta={{ title: 'T', readingTime: 3 }}>{ARTICLE_BODY}</ArticleLayout>)
    expect(screen.getByText('3 min read')).toBeDefined()
    expect(screen.queryByText('·')).toBeNull()
  })
})

describe('ArticleLayout: reading progress and footer', () => {
  test('readingProgress is opt-in', () => {
    renderArticle()
    expect(screen.queryByRole('progressbar')).toBeNull()
    cleanup()
    render(<ArticleLayout readingProgress>{ARTICLE_BODY}</ArticleLayout>)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0')
  })

  test('prev/next render as plain links by default and go through renderLink when given', () => {
    const prev = { label: 'Intro', href: '/intro' }
    const next = { label: 'Charts', href: '/charts' }
    const { container, rerender } = render(
      <ArticleLayout prev={prev} next={next}>
        {ARTICLE_BODY}
      </ArticleLayout>,
    )
    expect(container.querySelector('a[href="/intro"]')?.textContent).toContain('Intro')
    expect(container.querySelector('a[href="/charts"]')?.textContent).toContain('Charts')

    rerender(
      <ArticleLayout
        prev={prev}
        renderLink={(target, node) => <button data-to={target.href}>{node}</button>}
      >
        {ARTICLE_BODY}
      </ArticleLayout>,
    )
    expect(container.querySelector('button[data-to="/intro"]')).not.toBeNull()
    expect(container.querySelector('footer a')).toBeNull()
  })

  test('no prev and no next render no footer', () => {
    const { container } = renderArticle()
    expect(container.querySelector('footer')).toBeNull()
  })
})

describe('ArticleLayout: the breakpoint', () => {
  const dir = dirname(fileURLToPath(import.meta.url))

  test('the JS rail query reads the xl breakpoint the Tailwind theme declares', () => {
    const css = readFileSync(resolve(dir, '../css/tailwind.css'), 'utf8')
    const px = /--breakpoint-xl:\s*(\d+)px/.exec(css)?.[1]
    const source = readFileSync(resolve(dir, 'article-layout.tsx'), 'utf8')
    expect(source).toContain(`(min-width: ${px}px)`)
  })
})
