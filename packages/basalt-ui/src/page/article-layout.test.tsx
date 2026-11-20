/**
 * `ArticleLayout`: the header (title once, no empty meta row), the rail/trigger swap by the `@wide`
 * container query, the popover overlay, the reading-progress prop and the prev/next footer.
 *
 * Under happy-dom every element measures zero-size, so the popover's `hide` middleware may mark
 * the reference detached; queries into the open popup pass `{ hidden: true }`.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { LinkContext } from '../core/link'
import type { LinkComponent } from '../core/ports'
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

describe('ArticleLayout: the rail/trigger swap', () => {
  // Under happy-dom no stylesheet is loaded, so both are in the tree; the container query shows one.
  test('the server HTML holds both: the trigger hides at @wide, the rail shows from @wide', () => {
    const { container } = renderArticle()
    const trigger = screen.getByRole('button', { name: 'On this page' })
    expect(trigger.parentElement?.className).toContain('@wide:hidden')
    const rail = container.querySelector('nav[aria-label="On this page"]')?.parentElement
    expect(rail?.className).toContain('hidden')
    expect(rail?.className).toContain('@wide:block')
  })

  test('the layout is a container and the grid takes the rail column from @wide', () => {
    const { container } = renderArticle()
    const root = container.querySelector('[data-slot="article-layout"]')
    expect(root?.className).toContain('@container')
    expect(root?.firstElementChild?.className).toContain('@wide:grid-cols-[minmax(0,72ch)_14rem]')
  })

  test('toc={false} renders neither and keeps one column', () => {
    const { container } = render(<ArticleLayout toc={false}>{ARTICLE_BODY}</ArticleLayout>)
    expect(screen.queryByRole('button', { name: 'On this page' })).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'On this page' })).toBeNull()
    expect(container.querySelector('[data-slot="article-layout"]')?.innerHTML).not.toContain(
      '@wide:grid-cols',
    )
  })

  test('server render matches the browser: no measured size picks the layout', () => {
    const html = renderToString(<ArticleLayout>{ARTICLE_BODY}</ArticleLayout>)
    expect(html).toContain('On this page')
    expect(html).toContain('@wide:hidden')
    expect(html).toContain('@wide:block')
  })
})

/** A link inside the open popover; the rail holds the same entries, so a screen query would match both. */
function popupLink(name: string): HTMLElement {
  const popup = document.querySelector<HTMLElement>('[data-slot="popover-content"]')
  if (popup === null) throw new Error('the popover is not open')
  return within(popup).getByRole('link', { name, hidden: true })
}

describe('ArticleLayout: the popover overlay', () => {
  test('opens the same Toc, and a click on an entry closes it (onNavigate)', async () => {
    renderArticle()
    const trigger = screen.getByRole('button', { name: 'On this page' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.querySelector('[data-slot="popover-content"]')).toBeNull()

    await act(async () => {
      fireEvent.click(trigger)
    })
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    await waitFor(
      () => {
        expect(popupLink('Usage')).toBeDefined()
      },
      { timeout: 2000 },
    )

    await act(async () => {
      fireEvent.click(popupLink('Usage'))
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
        expect(popupLink('Setup')).toBeDefined()
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
    const bar = () => document.querySelector('.fixed.inset-x-0.top-0[aria-hidden="true"]')
    expect(bar()).toBeNull()
    cleanup()
    render(<ArticleLayout readingProgress>{ARTICLE_BODY}</ArticleLayout>)
    expect(bar()).not.toBeNull()
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

  test('a route target goes through the installed link', () => {
    const target = { __brand: 'NavTarget' } as const
    const installed: LinkComponent = ({ href, children }) => (
      <a href="#installed" data-installed={typeof href === 'string' ? href : 'route'}>
        {children}
      </a>
    )
    const { container } = render(
      <LinkContext value={installed}>
        <ArticleLayout next={{ label: 'Charts', href: target }}>{ARTICLE_BODY}</ArticleLayout>
      </LinkContext>,
    )
    expect(container.querySelector('footer a[data-installed="route"]')?.textContent).toContain(
      'Charts',
    )
  })

  test('no prev and no next render no footer', () => {
    const { container } = renderArticle()
    expect(container.querySelector('footer')).toBeNull()
  })
})

describe('ArticleLayout: the breakpoint', () => {
  const dir = dirname(fileURLToPath(import.meta.url))

  test('it reads the wide container size, never a measured width or a media query', () => {
    const source = readFileSync(resolve(dir, 'article-layout.tsx'), 'utf8')
    expect(source).not.toContain('matchMedia')
    expect(source).not.toContain('useSyncExternalStore')
    expect(source).toContain('@wide:')
  })

  test('the wide container size is the one the theme declares', () => {
    const css = readFileSync(resolve(dir, '../css/tailwind.css'), 'utf8')
    expect(/--container-wide:\s*50rem/.test(css)).toBe(true)
  })
})
