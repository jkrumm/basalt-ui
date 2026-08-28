/**
 * `PageAside`'s three context-decided behaviours (`docs/ASIDE-SPEC.md` §0, wave 1): the panel
 * leaves the page and lands inside `AppShell.Aside`, the fold both persists and re-sizes the
 * region, and a shell-less app gets the same node in flow. None of the three is visible to a unit
 * test of the component alone — all of them are decided by "is there a `BasaltShell` above me, and
 * is this viewport at least `sm`".
 *
 * happy-dom ships a real `matchMedia` against a 1024px viewport (the preload's shim is guarded by
 * `typeof … === 'undefined'` and never installs), so the DEFAULT harness viewport is desktop and
 * the region tests need no stub. The below-`sm` case is the one that does: it installs a
 * `matches: false` stub for its duration, the same shape `agent-chat/thread-workspace.test.tsx`
 * uses.
 */
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { BasaltShell, PageAside } from './index'
import type { SidebarSection } from './index'

const BRAND = { name: 'Argo' }
const ONE_SECTION: SidebarSection[] = [
  { label: 'Main', items: [{ key: 'home', label: 'Home', icon: null }] },
]

let restoreMatchMedia: (() => void) | null = null

/** A phone: no `(min-width: …)` query matches. Undone by the suite's `afterEach`, so a failing
 * assertion cannot leak the stub into the next file. */
function installMobileMatchMedia(): void {
  const original = window.matchMedia
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
  restoreMatchMedia = () => {
    window.matchMedia = original
  }
}

/** The AppShell dimension block Mantine emits — the same `<style>` the C14 header-height test reads. */
function asideCss(): string {
  return (
    [...document.querySelectorAll('style')]
      .map((tag) => tag.textContent ?? '')
      .find((text) => text.includes('--app-shell-aside-width')) ?? ''
  )
}

describe('PageAside inside a BasaltShell', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const renderInShell = (aside: ReactNode) =>
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION}>
          <div data-testid="main">Main column</div>
          {aside}
        </BasaltShell>
      </MantineProvider>,
    )

  test('the panel leaves the page flow and lands inside AppShell.Aside', () => {
    renderInShell(
      <PageAside title="Panel">
        <div data-testid="aside-child">Composition</div>
      </PageAside>,
    )

    const aside = document.querySelector('aside.mantine-AppShell-aside')
    expect(aside).not.toBeNull()
    const panel = document.querySelector('[data-basalt-page-aside="shell"]')
    expect(panel).not.toBeNull()
    // Title AND children — the portal moves the whole panel, not just its body.
    expect(aside?.contains(panel as Node)).toBe(true)
    expect(aside?.contains(screen.getByTestId('aside-child'))).toBe(true)
    expect(panel?.textContent).toContain('Panel')
    // The title names the region, so a screen reader reaches it by name (`aria-label`).
    expect(panel?.getAttribute('aria-label')).toBe('Panel')
    // …and the main column stayed where the page wrote it.
    expect(aside?.contains(screen.getByTestId('main'))).toBe(false)
  })

  test('claiming the region gives it its width — the shell needs no prop to know', () => {
    renderInShell(
      <PageAside title="Panel">
        <div />
      </PageAside>,
    )
    // 300px, expressed the way Mantine's own `rem()` does.
    expect(asideCss()).toContain('--app-shell-aside-width:calc(18.75rem * var(--mantine-scale))')
  })

  test('folding persists at basalt:aside:<persistKey> and narrows the region to the rail', () => {
    renderInShell(
      <PageAside title="Panel" persistKey="cbbi">
        <div data-testid="aside-child">Composition</div>
      </PageAside>,
    )

    fireEvent.click(screen.getByLabelText('Collapse panel'))

    expect(localStorage.getItem('basalt:aside:cbbi')).toBe(JSON.stringify({ v: 1, value: true }))
    // 36px — the rail holds the one expand button and nothing else.
    expect(asideCss()).toContain('--app-shell-aside-width:calc(2.25rem * var(--mantine-scale))')
    expect(screen.getByLabelText('Expand panel')).toBeDefined()
    expect(screen.queryByTestId('aside-child')).toBeNull()
  })

  test('a persisted fold outranks defaultFolded on the next visit', () => {
    localStorage.setItem('basalt:aside:cbbi', JSON.stringify({ v: 1, value: true }))
    renderInShell(
      <PageAside title="Panel" persistKey="cbbi" defaultFolded={false}>
        <div data-testid="aside-child">Composition</div>
      </PageAside>,
    )

    expect(screen.getByLabelText('Expand panel')).toBeDefined()
    expect(screen.queryByTestId('aside-child')).toBeNull()
  })

  test('an unpersisted fold writes nothing to storage', () => {
    renderInShell(
      <PageAside title="Panel">
        <div />
      </PageAside>,
    )

    fireEvent.click(screen.getByLabelText('Collapse panel'))

    expect(screen.getByLabelText('Expand panel')).toBeDefined()
    expect(localStorage.getItem('basalt:aside:__local__')).toBeNull()
  })
})

/**
 * Below `sm` and in a shell-less app the panel is ONE node in the page flow, where the page wrote
 * it — never a second mount under a `visibleFrom` twin (law C9), and never a fold control for a
 * region that does not exist.
 */
describe('PageAside in flow', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    restoreMatchMedia?.()
    restoreMatchMedia = null
  })

  test('shell-less: renders in place, marked standalone, with no fold chrome', () => {
    render(
      <MantineProvider>
        <div data-testid="page">
          <PageAside title="Panel">
            <div data-testid="aside-child">Composition</div>
          </PageAside>
        </div>
      </MantineProvider>,
    )

    const panel = document.querySelector('[data-basalt-page-aside="standalone"]')
    expect(panel).not.toBeNull()
    expect(screen.getByTestId('page').contains(panel as Node)).toBe(true)
    expect(panel?.contains(screen.getByTestId('aside-child'))).toBe(true)
    expect(screen.queryByLabelText('Collapse panel')).toBeNull()
    expect(document.querySelector('[data-basalt-page-aside="shell"]')).toBeNull()
  })

  test('below sm inside a shell: still in flow, still exactly one node', () => {
    installMobileMatchMedia()
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION}>
          <div data-testid="main">Main column</div>
          <PageAside title="Panel">
            <div data-testid="aside-child">Composition</div>
          </PageAside>
        </BasaltShell>
      </MantineProvider>,
    )

    expect(document.querySelectorAll('[data-basalt-page-aside]')).toHaveLength(1)
    const panel = document.querySelector('[data-basalt-page-aside="standalone"]')
    expect(panel).not.toBeNull()
    expect(document.querySelector('aside.mantine-AppShell-aside')?.contains(panel as Node)).toBe(
      false,
    )
    // Nothing claimed the region, so it keeps its zero width.
    expect(asideCss()).toContain('--app-shell-aside-width:0rem')
  })
})
