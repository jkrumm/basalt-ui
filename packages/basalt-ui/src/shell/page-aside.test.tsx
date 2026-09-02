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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { FilterSet, ToggleFilter } from '../controls'
import { useFilterSurface } from '../controls/filter-context'
import { Section } from '../section'
import { createLocalStore, field } from '../state'
import { BasaltShell, PageAside, PageBar } from './index'
import type { PageAsideProps, SidebarSection } from './index'

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

  test('a Section child resolves the group tier — the aside decides, not the call site', () => {
    renderInShell(
      <PageAside title="Composition">
        <Section title="Presets">
          <div>body</div>
        </Section>
      </PageAside>,
    )

    expect(screen.getByRole('heading', { level: 3, name: 'Presets' })).toBeDefined()
    // The Section ROOT, not WidgetHeader's — both carry `data-tier`, so `closest` from the heading
    // would resolve on WidgetHeader's own root first. Walk up from the body instead.
    const root = screen.getByText('body').parentElement?.parentElement
    expect(root?.getAttribute('data-tier')).toBe('group')
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

/** Reports the surface it was mounted under, so a test can assert what a CHILD of the aside sees. */
function SurfaceProbe(): ReactNode {
  return <span data-testid="surface">{useFilterSurface()}</span>
}

/**
 * Wave 2 (`docs/ASIDE-SPEC.md` §4): the aside body is the `panel` filter surface, and below `sm` it
 * PROJECTS into the page bar's row 2 instead of stacking in flow — one node either way (law C9).
 */
describe('PageAside — the panel surface and the mobile projection', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    restoreMatchMedia?.()
    restoreMatchMedia = null
  })

  const store = createLocalStore({
    key: 'aside-panel',
    fields: { reweighted: field.boolean(false) },
  })

  test('a child of the aside body sees the `panel` surface, not `pill`', () => {
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION}>
          <div data-testid="main">Main column</div>
          <PageAside title="Panel">
            <SurfaceProbe />
          </PageAside>
        </BasaltShell>
      </MantineProvider>,
    )

    expect(screen.getByTestId('surface').textContent).toBe('panel')
  })

  test('below sm with a PageBar row 2: the aside projects into the bar and renders no in-flow node', async () => {
    installMobileMatchMedia()
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION}>
          <PageBar
            filters={
              <FilterSet>
                <ToggleFilter field={store.field.reweighted} label="Reweighted" />
              </FilterSet>
            }
          />
          <PageAside title="Weights">
            <div data-testid="aside-child">Composition</div>
          </PageAside>
        </BasaltShell>
      </MantineProvider>,
    )

    // No panel node anywhere — neither the portalled form nor the in-flow one (C9: ONE node).
    expect(document.querySelectorAll('[data-basalt-page-aside]')).toHaveLength(0)
    expect(screen.queryByTestId('aside-child')).toBeNull()
    // …and the trigger is in row 2, named by the aside's title.
    const trigger = screen.getByRole('button', { name: 'Weights' })
    expect(trigger.textContent).toContain('Panel')

    fireEvent.click(trigger)

    // The sheet holds the children — the Drawer mounts its body through a transition, so the assert
    // waits rather than reading the frame the click landed on.
    await waitFor(() => {
      expect(screen.getByTestId('aside-child')).toBeDefined()
    })
    expect(screen.getByText('Weights')).toBeDefined()
  })

  test('a Section child also resolves the group tier inside the mobile sheet projection', async () => {
    installMobileMatchMedia()
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION}>
          <PageBar
            filters={
              <FilterSet>
                <ToggleFilter field={store.field.reweighted} label="Reweighted" />
              </FilterSet>
            }
          />
          <PageAside title="Weights">
            <Section title="Presets">
              <div>body</div>
            </Section>
          </PageAside>
        </BasaltShell>
      </MantineProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Weights' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 3, name: 'Presets' })).toBeDefined()
    })
    const root = screen.getByText('body').parentElement?.parentElement
    expect(root?.getAttribute('data-tier')).toBe('group')
  })

  /**
   * The sheet's open flag lives on `PageBar`, and `FilterSheet`'s `onClose` used to be the only
   * thing clearing it — so a route change that released the aside's claim mid-sheet left `true`
   * behind, and the NEXT page's `PageAside` mounted its sheet already open with nobody having
   * touched it. The claim's identity is what the flag is keyed on now.
   */
  test('a released claim closes the sheet, so the next aside does not inherit it open', async () => {
    installMobileMatchMedia()
    const Page = ({ aside }: { aside: 'weights' | 'origins' | null }) => (
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION}>
          <PageBar
            filters={
              <FilterSet>
                <ToggleFilter field={store.field.reweighted} label="Reweighted" />
              </FilterSet>
            }
          />
          {aside !== null && (
            <PageAside title={aside === 'weights' ? 'Weights' : 'Origins'}>
              <div data-testid={`child-${aside}`}>body</div>
            </PageAside>
          )}
        </BasaltShell>
      </MantineProvider>
    )

    const { rerender } = render(<Page aside="weights" />)
    fireEvent.click(screen.getByRole('button', { name: 'Weights' }))
    await waitFor(() => {
      expect(screen.getByTestId('child-weights')).toBeDefined()
    })

    // The route leaves, then the next one claims. The sheet must come back CLOSED.
    rerender(<Page aside={null} />)
    rerender(<Page aside="origins" />)

    expect(screen.getByRole('button', { name: 'Origins' })).toBeDefined()
    await waitFor(() => {
      expect(screen.queryByTestId('child-origins')).toBeNull()
    })
  })

  test('below sm with no PageBar row 2: wave 1 in-flow rendering, no trigger', () => {
    installMobileMatchMedia()
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION}>
          <div data-testid="main">Main column</div>
          <PageAside title="Weights">
            <div data-testid="aside-child">Composition</div>
          </PageAside>
        </BasaltShell>
      </MantineProvider>,
    )

    expect(document.querySelector('[data-basalt-page-aside="standalone"]')).not.toBeNull()
    expect(screen.getByTestId('aside-child')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Weights' })).toBeNull()
  })
})

describe('common props (`common/props.ts`)', () => {
  test('className and classNames.body reach the in-flow panel (shell-less)', () => {
    render(
      <MantineProvider>
        <PageAside title="Panel" className="my-aside" classNames={{ body: 'my-aside-body' }}>
          <div>Composition</div>
        </PageAside>
      </MantineProvider>,
    )
    expect(document.querySelector('.my-aside')).toBeTruthy()
    expect(document.querySelector('.my-aside-body')).toBeTruthy()
  })

  // F-ERR-1: `title` is the header text AND the landmark's `aria-label`, so losing it ships a
  // nameless region rather than a crash — the failure a raw `TypeError` would never have named.
  test('a missing title throws a message naming the component, the prop and why', () => {
    expect(() =>
      render(
        <MantineProvider>
          <PageAside {...({} as unknown as PageAsideProps)}>
            <div>Composition</div>
          </PageAside>
        </MantineProvider>,
      ),
    ).toThrow(
      '[basalt] PageAside: prop "title" is required — it names the region — it is the header ' +
        'text AND the `aria-label` on the landmark.',
    )
  })
})
