/**
 * `ArticleLayout` — the TOC rail's below-breakpoint replacement (docs/waves/RESPONSIVE-SPEC.md §6;
 * docs/archive/CONTENT-SPEC.md §7): a sticky "On this page" trigger opens the SAME
 * `TableOfContents` in a `Popover` instead of the rail vanishing.
 * `article-layout.breakpoint.test.ts` pins the CSS literal (`@media (max-width: 1200px)` ==
 * `BREAKPOINTS.article`); this file pins the JS-side twin (`useSizeClass() !== 'expanded'`) and the
 * overlay's open/close/navigate behaviour, which the CSS-only rail never needed.
 *
 * Every query into the open dropdown passes `{ hidden: true }` — same idiom as
 * `controls/filter-set.test.tsx`'s own popover queries. Under happy-dom every element measures
 * zero-size, so `@floating-ui`'s `hide` middleware (Popover's default `hideDetached`) marks the
 * reference "detached" and the dropdown renders `display: none` throughout — real, but pruned from
 * the accessibility tree, which is exactly what `{ hidden: true }` opts back into seeing.
 */
import type { ReactElement } from 'react'
import { MantineProvider } from '@mantine/core'
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
  return render(
    <MantineProvider>
      <ArticleLayout>{ARTICLE_BODY}</ArticleLayout>
    </MantineProvider>,
  )
}

/** `useSizeClass` reads `window.matchMedia` — every `(min-width)` query matching is the expanded
 *  class (same idiom as `agent-chat/thread-workspace.test.tsx`'s `withWideViewport`). Without this,
 *  the shared `tests/setup/dom.ts` shim pins every query's `matches` to `false`, which is the
 *  `compact` class — the below-breakpoint case exercised by the other describe block. */
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

describe('ArticleLayout — the rail/trigger swap', () => {
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
})

describe('ArticleLayout — the popover overlay', () => {
  test('opens the SAME TableOfContents, and a click on an entry closes it (onNavigate)', async () => {
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
