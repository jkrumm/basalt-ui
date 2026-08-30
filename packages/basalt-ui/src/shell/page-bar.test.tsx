/**
 * `PageBar`'s two invariants that only a rendered tree can prove (`docs/CONTROLS-SPEC.md` §2.1):
 * row 1 leaves the page and lands in the app-shell header, row 2 does NOT — it stays in the page
 * flow, sticks under the header, and publishes its measured height. Both are decided by context
 * (is there a `BasaltShell` above me?), so a unit test of the component alone can't see either.
 *
 * The `--basalt-page-bar-h` publish is the one piece needing a real ResizeObserver callback. The
 * harness shim (`tests/setup/dom.ts`) is a deliberate no-op, so this file installs a controllable
 * fake for the duration of the suite and fires the callback by hand against a stubbed rect —
 * happy-dom evaluates no layout, so a genuine observer would only ever report 0 (which the
 * `height > 0` guard correctly refuses to publish).
 */
import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { BasaltShell, PageBar } from './index'
import type { SidebarSection } from './index'

const BRAND = { name: 'Argo' }
const ONE_SECTION: SidebarSection[] = [
  { label: 'Main', items: [{ key: 'home', label: 'Home', icon: null }] },
]

const HEIGHT_VAR = '--basalt-page-bar-h'

type Observed = { node: Element; trigger: () => void }

let observed: Observed[] = []
let nativeResizeObserver: typeof ResizeObserver

/** A ResizeObserver whose callback the test fires — see this file's doc for why the shim can't. */
function installFakeResizeObserver(): void {
  observed = []
  class FakeResizeObserver {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe(node: Element): void {
      observed.push({
        node,
        trigger: () => this.callback([], this as unknown as ResizeObserver),
      })
    }
    unobserve(): void {}
    disconnect(): void {}
  }
  window.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver
}

/** Every element measures `height` — the layout happy-dom never evaluates, for the whole tree. */
function stubEveryRect(height: number): void {
  Element.prototype.getBoundingClientRect = function rect() {
    return { height, width: 0, top: 0, left: 0, right: 0, bottom: height, x: 0, y: 0 } as DOMRect
  }
}

function stubHeight(node: HTMLElement, height: number): void {
  Object.defineProperty(node, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ height, width: 0, top: 0, left: 0, right: 0, bottom: height, x: 0, y: 0 }),
  })
}

beforeEach(() => {
  nativeResizeObserver = window.ResizeObserver
  installFakeResizeObserver()
})

afterEach(() => {
  window.ResizeObserver = nativeResizeObserver
  document.documentElement.style.removeProperty(HEIGHT_VAR)
})

const shellRow = () => document.querySelector<HTMLElement>('[data-basalt-page-bar="shell"]')

describe('PageBar inside a BasaltShell', () => {
  const renderInShell = () =>
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION}>
          <PageBar
            actions={{
              primary: { key: 'row1', kind: 'custom', node: <span data-testid="row1" /> },
            }}
            tabs={<span data-testid="row2" />}
          />
        </BasaltShell>
      </MantineProvider>,
    )

  test('row 1 portals into the app-shell header — every copy of it', () => {
    renderInShell()
    const header = document.querySelector('.mantine-AppShell-header')
    expect(header).not.toBeNull()
    const copies = screen.getAllByTestId('row1')
    expect(copies.length).toBeGreaterThan(0)
    for (const copy of copies) expect(header?.contains(copy)).toBe(true)
  })

  test('row 2 stays in the page flow — NOT in the header', () => {
    renderInShell()
    const header = document.querySelector('.mantine-AppShell-header')
    const row2 = screen.getByTestId('row2')
    expect(header?.contains(row2)).toBe(false)
    expect(shellRow()?.contains(row2)).toBe(true)
  })

  test('a ResizeObserver reading publishes --basalt-page-bar-h on documentElement', () => {
    renderInShell()
    const row = shellRow()
    expect(row).not.toBeNull()
    stubHeight(row as HTMLElement, 44)
    const entry = observed.find((o) => o.node === row)
    expect(entry).toBeDefined()
    entry?.trigger()
    expect(document.documentElement.style.getPropertyValue(HEIGHT_VAR)).toBe('44px')
  })

  test('a zero reading is refused — the guard is what kept a consumer sticky offset from collapsing', () => {
    renderInShell()
    const row = shellRow()
    stubHeight(row as HTMLElement, 0)
    observed.find((o) => o.node === row)?.trigger()
    expect(document.documentElement.style.getPropertyValue(HEIGHT_VAR)).toBe('')
  })

  test('unmounting removes the property, so the next route does not inherit this height', () => {
    const { unmount } = renderInShell()
    const row = shellRow()
    stubHeight(row as HTMLElement, 44)
    observed.find((o) => o.node === row)?.trigger()
    unmount()
    expect(document.documentElement.style.getPropertyValue(HEIGHT_VAR)).toBe('')
  })

  test('title is ignored inside a shell — the breadcrumb names the page (law C8)', () => {
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION}>
          <PageBar title="Ignored" tabs={<span data-testid="row2" />} />
        </BasaltShell>
      </MantineProvider>,
    )
    expect(screen.queryByText('Ignored')).toBeNull()
  })
})

/**
 * A consumer's own test DOM has no `ResizeObserver` unless it installs a shim — happy-dom and jsdom
 * both lack it. An unguarded `new ResizeObserver` in the effect turned that into a hard throw from
 * every page test that mounted a bar, which is a framework bug, not a consumer one.
 */
describe('PageBar with no ResizeObserver at all', () => {
  test('a shell-less bar still mounts, and publishes nothing rather than throwing', () => {
    // @ts-expect-error deliberately removing a DOM global the guard exists to survive
    window.ResizeObserver = undefined
    expect(() =>
      render(
        <MantineProvider>
          <PageBar title="linewatch" tabs={<span data-testid="row2" />} />
        </MantineProvider>,
      ),
    ).not.toThrow()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('linewatch')
    // happy-dom evaluates no layout, so the one-shot measure reads 0 and the guard refuses it.
    expect(document.documentElement.style.getPropertyValue(HEIGHT_VAR)).toBe('')
  })

  test('a filters row mounts too, and unmounting still cleans up', () => {
    // Only the SHELL-LESS form is exercised: `BasaltShell` mounts a Mantine `AppShell` whose own
    // internals construct a `ResizeObserver`, so that half can never run without one — which is
    // also why the guard matters for the shell-less consumer (linewatch) specifically.
    // @ts-expect-error see above
    window.ResizeObserver = undefined
    const { unmount } = render(
      <MantineProvider>
        <PageBar title="linewatch" filters={<span data-testid="filters" />} />
      </MantineProvider>,
    )
    expect(screen.getByTestId('filters')).toBeDefined()
    expect(() => unmount()).not.toThrow()
    expect(document.documentElement.style.getPropertyValue(HEIGHT_VAR)).toBe('')
  })
})

describe('PageBar without a shell', () => {
  test('renders the title as the page heading and sticks both rows at the top', () => {
    render(
      <MantineProvider>
        <PageBar title="linewatch" tabs={<span data-testid="row2" />} />
      </MantineProvider>,
    )
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.textContent).toBe('linewatch')
    const bar = document.querySelector<HTMLElement>('[data-basalt-page-bar="standalone"]')
    expect(bar).not.toBeNull()
    expect(bar?.contains(heading)).toBe(true)
    expect(bar?.contains(screen.getByTestId('row2'))).toBe(true)
  })

  test('renders nothing at all when every slot is empty (law C14)', () => {
    render(
      <MantineProvider>
        <PageBar />
      </MantineProvider>,
    )
    expect(document.querySelector('[data-basalt-page-bar]')).toBeNull()
  })
})

/**
 * The sticky offsets and law C7's no-horizontal-scroll rule live entirely in CSS, and a CSS module
 * resolves to `''` under `bun test` (no bundler in the loop) — so they are asserted against the
 * shipped CSS TEXT, the same pattern `prose.module.css.test.ts` and `styles.floor.test.ts` use.
 */
describe('page-bar.module.css', () => {
  const css = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), 'page-bar.module.css'),
    'utf8',
  )
  /** Declarations only — the block comments above them discuss `::before` and `overflow` by name. */
  const decls = css.replace(/\/\*[\s\S]*?\*\//g, '')

  test('row 2 inside a shell sticks at the AppShell header-height VAR, never a measured number', () => {
    const rule = decls.match(/\.row2Sticky\s*\{([^}]+)\}/)
    expect(rule).not.toBeNull()
    expect(rule?.[1]).toContain('position: sticky')
    expect(rule?.[1]).toContain('top: var(--app-shell-header-height, 0px)')
  })

  test('the shell-less bar sticks at the top of the document', () => {
    const rule = decls.match(/\.bar\s*\{([^}]+)\}/)
    expect(rule?.[1]).toContain('position: sticky')
    expect(rule?.[1]).toContain('top: 0')
  })

  test('no row ever scrolls sideways or wraps (law C7)', () => {
    expect(decls).not.toContain('overflow-x')
    expect(decls).not.toMatch(/overflow(-y)?:\s*(auto|scroll)/)
    expect(decls.match(/flex-wrap: nowrap/g)?.length).toBeGreaterThanOrEqual(5)
  })

  test('the mobile hit area rides ::after — Mantine owns Button::before for its loading overlay', () => {
    expect(decls).toContain('::after')
    expect(decls).not.toContain('::before')
    expect(decls).toContain('min-height: var(--vx-space-touch-control-height)')
  })

  test('the hit area un-clips its own host — Mantine roots are overflow: hidden', () => {
    // Without this the overlay is clipped back to the 30px box and law C15's 36px target does not
    // exist at all, which no token assertion can catch.
    expect(decls).toMatch(/:not\(\[data-loading\]\)[\s\S]{0,80}overflow: visible/)
  })
})

/**
 * The height has to exist at the FIRST paint, not one frame later: `Section`'s scroll anchor reads
 * `var(--basalt-page-bar-h, 0px)`, so a cold load of `/page#anchor` that scrolls before the property
 * lands leaves the anchored heading under the sticky bar.
 *
 * The probe is what makes the timing observable. Passive effects run child-first, so a probe INSIDE
 * the bar reads the property before the bar's own passive effect would have written it — it can only
 * see `44px` if the publish happened in the layout phase.
 */
describe('the height var is published before first paint', () => {
  const nativeRect = Element.prototype.getBoundingClientRect

  afterEach(() => {
    Element.prototype.getBoundingClientRect = nativeRect
  })

  test('a passive effect inside the bar already sees --basalt-page-bar-h', () => {
    const seen: { current: string | null } = { current: null }
    function Probe(): ReactNode {
      useEffect(() => {
        seen.current = document.documentElement.style.getPropertyValue(HEIGHT_VAR)
      }, [])
      return <span data-testid="row2" />
    }

    stubEveryRect(44)
    render(
      <MantineProvider>
        <PageBar title="linewatch" tabs={<Probe />} />
      </MantineProvider>,
    )

    expect(seen.current).toBe('44px')
  })
})

describe('className reaches the bar root in both forms', () => {
  test('shell-less: it joins the standalone root, keeping the module class', () => {
    render(
      <MantineProvider>
        <PageBar title="linewatch" tabs={<span data-testid="row2" />} className="lw-bleed" />
      </MantineProvider>,
    )
    const bar = document.querySelector<HTMLElement>('[data-basalt-page-bar="standalone"]')
    expect(bar?.classList.contains('lw-bleed')).toBe(true)
  })

  test('in a shell: it joins row 2s sticky wrapper, not the portalled row 1', () => {
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION}>
          <PageBar tabs={<span data-testid="row2" />} className="argo-bleed" />
        </BasaltShell>
      </MantineProvider>,
    )
    expect(shellRow()?.classList.contains('argo-bleed')).toBe(true)
  })
})

/**
 * Row 2's phone form is a declared TWO-LINE column below `sm` — tabs, then pills — never a wrap
 * (`agent/rules/basalt-controls.md`, law C7/C14). These three cases pin the DOM shape a wrap-based
 * layout cannot express: a line renders only when its content does, and the tabs line always
 * precedes the pills line.
 */
describe('row 2 folds into two declared lines, not a wrap', () => {
  const row2Line = (name: 'tabs' | 'pills') =>
    shellRow()?.querySelector<HTMLElement>(`[data-basalt-page-bar-line="${name}"]`) ?? null

  test('tabs + filters: the tabs line precedes the pills line, both direct children of row 2', () => {
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION}>
          <PageBar tabs={<span data-testid="tabs" />} filters={<span data-testid="filters" />} />
        </BasaltShell>
      </MantineProvider>,
    )
    const row = shellRow()
    const tabsLine = row2Line('tabs')
    const pillsLine = row2Line('pills')
    expect(tabsLine).not.toBeNull()
    expect(pillsLine).not.toBeNull()
    expect(row?.contains(tabsLine)).toBe(true)
    expect(row?.contains(pillsLine)).toBe(true)
    // Both lines are direct children of the same row-2 box.
    expect(tabsLine?.parentElement).toBe(pillsLine?.parentElement)
    // DOM order: tabs before pills.
    expect(tabsLine?.compareDocumentPosition(pillsLine as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  test('tabs only: no pills line renders (law C14 — an empty line reserves nothing)', () => {
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION}>
          <PageBar tabs={<span data-testid="tabs" />} />
        </BasaltShell>
      </MantineProvider>,
    )
    expect(row2Line('tabs')).not.toBeNull()
    expect(row2Line('pills')).toBeNull()
  })

  test('filters only: no tabs line renders', () => {
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION}>
          <PageBar filters={<span data-testid="filters" />} />
        </BasaltShell>
      </MantineProvider>,
    )
    expect(row2Line('pills')).not.toBeNull()
    expect(row2Line('tabs')).toBeNull()
  })

  /**
   * Pins the DOM shape `page-bar.module.css`'s mobile `.tabs > [data-basalt-tier] > *` selector
   * depends on. `CtlSlot` renders a `display: contents` `<Box data-basalt-tier>` as `.tabs`' only
   * direct child — a bare `.tabs > *` rule matches THAT box and nothing past it, which is exactly the
   * dead-selector bug this test would have caught (a CSS-text test alone cannot: it can assert the
   * selector's TEXT, never that the text reaches a real element).
   */
  test('the tabs line wraps its content in exactly one `data-basalt-tier` slot — what the mobile CSS selects through', () => {
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION}>
          <PageBar tabs={<span data-testid="tabs" />} />
        </BasaltShell>
      </MantineProvider>,
    )
    const tabsLine = row2Line('tabs')
    const slot = tabsLine?.firstElementChild
    expect(slot).not.toBeNull()
    expect(slot?.hasAttribute('data-basalt-tier')).toBe(true)
    expect(slot?.contains(screen.getByTestId('tabs'))).toBe(true)
  })
})
