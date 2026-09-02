/**
 * Hand-off paths that only `BasaltShell` can break — the sub-components are exercised directly in
 * `app-sidebar.test.tsx` / `app-mobile-nav.test.tsx`, but the shell is where the props are
 * destructured and where `extraMoreRows` is COMPUTED. A typo'd destructure key or a row count that
 * disagrees with the renderer ships silently without a test that renders `BasaltShell` itself.
 */
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ActionGroup } from '../controls/actions'
import { baseTheme } from '../theme'
import { PageAside } from './page-aside'
import { BasaltShell, PageBar } from './index'
import type { BasaltAccountProps, SidebarBlock, SidebarSection } from './index'

const BRAND = { name: 'Argo' }
const ONE_SECTION: SidebarSection[] = [
  { label: 'Main', items: [{ key: 'home', label: 'Home', icon: null }] },
]

const AWAITING: SidebarBlock = {
  kind: 'list',
  key: 'awaiting',
  label: 'Awaiting action',
  count: 3,
  items: [
    { key: 'a', label: 'Review PR' },
    { key: 'b', label: 'Sign contract' },
    { key: 'c', label: 'Reply to Jo' },
  ],
}

describe('BasaltShell sidebarBlocks', () => {
  test("a 'custom' block reaches the sidebar's nav scroll region through the hand-off", () => {
    const { container } = render(
      <MantineProvider>
        <BasaltShell
          brand={BRAND}
          sections={ONE_SECTION}
          sidebarBlocks={[
            { kind: 'custom', key: 'tree', node: <div data-testid="nav-extra">Extra</div> },
          ]}
        />
      </MantineProvider>,
    )
    const extra = screen.getByTestId('nav-extra')
    const stack = container.querySelector('.mantine-ScrollArea-content > .mantine-Stack-root')
    expect(stack).not.toBeNull()
    expect(stack?.contains(extra)).toBe(true)
  })

  /**
   * Both halves of the SAME prop, which is the point of C13: one declaration renders the desktop
   * block and produces the mobile row. `sidebarNavExtra` + `mobileNav.moreExtra` needed two.
   */
  test('the same block projects to ONE More row that opens a nested sheet of its items', async () => {
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION} sidebarBlocks={[AWAITING]} />
      </MantineProvider>,
    )

    fireEvent.click(screen.getByLabelText('More'))
    await waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull())
    // One row, stating its own count — not three rows, one per item. `Home` took the bar slot, so
    // the block row is the whole More surface here.
    const row = screen.getByText('Awaiting action · 3')
    expect(document.querySelectorAll('.mantine-Menu-item')).toHaveLength(1)

    fireEvent.click(row)
    await waitFor(() => expect(document.querySelector('.mantine-Drawer-content')).not.toBeNull())
    // Scoped to the sheet: the desktop block renders the same three labels, and a bare `getByText`
    // would match both copies rather than proving the sheet holds them.
    const body = document.querySelector('.mantine-Drawer-body')?.textContent ?? ''
    expect(body).toContain('Review PR')
    expect(body).toContain('Reply to Jo')
  })

  test("mobile:'hidden' keeps the block off the More surface entirely", () => {
    render(
      <MantineProvider>
        <BasaltShell
          brand={BRAND}
          sections={[
            { label: 'Main', items: [{ key: 'home', label: 'Home', icon: null, mobile: 'tab' }] },
          ]}
          sidebarBlocks={[{ ...AWAITING, mobile: 'hidden' }]}
        />
      </MantineProvider>,
    )
    // Nothing else feeds More, so a hidden block must not conjure the slot at all.
    expect(screen.queryByLabelText('More')).toBeNull()
  })
})

/**
 * Law C13's enforcement column is "tsc — `sidebarNavExtra` / `mobileNav.moreExtra` removed". These
 * two `@ts-expect-error`s ARE that gate: they fail the build the day either prop comes back, which
 * is the only way a type-level removal can be asserted from a test file.
 */
describe('BasaltShell — the removed ReactNode slots', () => {
  test('sidebarNavExtra and mobileNav.moreExtra no longer type-check', () => {
    const removedNavExtra = (
      <BasaltShell
        brand={BRAND}
        sections={ONE_SECTION}
        // @ts-expect-error sidebarNavExtra was replaced by `sidebarBlocks` kind 'custom' (C13)
        sidebarNavExtra={<div />}
      />
    )
    const removedMoreExtra = (
      <BasaltShell
        brand={BRAND}
        sections={ONE_SECTION}
        // @ts-expect-error mobileNav.moreExtra was replaced by `sidebarBlocks` kind 'list' (C13)
        mobileNav={{ moreExtra: <div /> }}
      />
    )
    expect(removedNavExtra).toBeTruthy()
    expect(removedMoreExtra).toBeTruthy()
  })
})

/**
 * §2.2's arithmetic guarantee is that a `menu` never exceeds `menuMax` rows — six rows at 44px fit
 * the headroom above the bar, and the menu runs `flip: false`, so a menu that overflows has no way
 * to escape upward and simply renders off-screen. The guarantee is only as good as the row count
 * the shell feeds `projectMobileNav`: counting `account` as ONE row while `accountRows` expands it
 * into up to seven is what let a nine-row More surface pick `menu`.
 */
describe('BasaltShell extraMoreRows', () => {
  const NAV: SidebarSection[] = [
    { label: 'Main', items: [{ key: 'home', label: 'Home', icon: null, mobile: 'tab' }] },
  ]

  /** Seven account rows: manage + billing + upgrade + three extras + sign out. */
  const FAT_ACCOUNT: BasaltAccountProps = {
    state: {
      status: 'authenticated',
      identity: { id: 'u1', name: 'Jo', email: 'jo@example.com' },
      plan: { key: 'free', label: 'Free', isFree: true },
    },
    actions: {
      onManageAccount: () => {},
      onManageBilling: () => {},
      onUpgrade: () => {},
      onSignOut: () => {},
      extraMenuItems: [
        { key: 'a', label: 'Extra A', onClick: () => {} },
        { key: 'b', label: 'Extra B', onClick: () => {} },
        { key: 'c', label: 'Extra C', onClick: () => {} },
      ],
    },
  }

  test('an account expanding past menuMax raises the SHEET, not an overflowing menu', async () => {
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={NAV} account={FAT_ACCOUNT} />
      </MantineProvider>,
    )

    fireEvent.click(screen.getByLabelText('More'))
    await waitFor(() => expect(document.querySelector('.mantine-Drawer-content')).not.toBeNull())
    expect(document.querySelector('[role="menu"]')).toBeNull()
  })

  /** A `loading` account renders NO rows, so it must not conjure a More slot that opens empty. */
  test('a loading account produces no More slot at all', () => {
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={NAV} account={{ state: { status: 'loading' } }} />
      </MantineProvider>,
    )

    expect(screen.queryByLabelText('More')).toBeNull()
  })
})

/**
 * Collapse persistence goes through the HOUSE api, not `@mantine/hooks`.
 *
 * Round 4 filed the reference consumer's raw `localStorage.getItem('basalt-sidebar-collapsed')` as
 * consumer drift; round 5 corrected it — the shell itself used `useLocalStorage`, so the raw read
 * was the only way to mirror what the shell wrote. These tests pin the shape a consumer now reads.
 */
describe('BasaltShell collapse persistence', () => {
  const COLLAPSE_TOGGLE =
    'button[aria-label="Collapse sidebar"], button[aria-label="Expand sidebar"]'

  const renderShell = (storageKey: string) =>
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION} storageKey={storageKey} />
      </MantineProvider>,
    )

  test('writes the namespaced, versioned envelope — not a bare boolean at a bare key', () => {
    const key = 'collapse-envelope'
    localStorage.clear()
    const { container } = renderShell(key)

    fireEvent.click(container.querySelector(COLLAPSE_TOGGLE) as HTMLElement)

    expect(localStorage.getItem(`basalt:${key}`)).toBe(JSON.stringify({ v: 1, value: true }))
    expect(localStorage.getItem(key)).toBeNull()
  })

  test('adopts a pre-1.20.1 raw value once, so an upgrade keeps the sidebar collapsed', () => {
    const key = 'collapse-legacy'
    localStorage.clear()
    // Exactly what `@mantine/hooks`' useLocalStorage wrote: JSON at the un-namespaced key.
    localStorage.setItem(key, 'true')

    renderShell(key)

    expect(localStorage.getItem(`basalt:${key}`)).toBe(JSON.stringify({ v: 1, value: true }))
  })

  test('a value already in the house key wins over a stale legacy one', () => {
    const key = 'collapse-both'
    localStorage.clear()
    localStorage.setItem(key, 'true')
    localStorage.setItem(`basalt:${key}`, JSON.stringify({ v: 1, value: false }))

    renderShell(key)

    expect(localStorage.getItem(`basalt:${key}`)).toBe(JSON.stringify({ v: 1, value: false }))
  })
})

/**
 * Law C14 — an empty home renders nothing, so no route pays for a reserved row. This is the
 * assertion the spec names as the law's gate: through 1.25.0 the mobile header was a 97px SUM whose
 * second row (`appHeaderMobileActionsHeight`, 52px) was reserved on every route whether or not the
 * page portalled anything into it. Both tokens are deleted; the header is `appShellHeaderHeight` at
 * every width, and an empty `PageBar` adds no node in either place.
 */
describe('BasaltShell header height (law C14)', () => {
  test('the AppShell header is ONE row — a single unconditional height declaration, no media override', () => {
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION} />
      </MantineProvider>,
    )
    // Mantine emits the AppShell dimensions as a `<style>` block: one `:root` rule plus one
    // `@media` rule per RESPONSIVE prop. A `{ base, sm }` header height therefore shows up twice;
    // a single number shows up once, which is the invariant.
    const css = [...document.querySelectorAll('style')]
      .map((tag) => tag.textContent ?? '')
      .find((text) => text.includes('--app-shell-header-height'))
    expect(css).toBeDefined()
    const heights = [...(css ?? '').matchAll(/--app-shell-header-height:\s*([^;]+)/g)].map(
      (m) => m[1],
    )
    expect(heights).toHaveLength(1)
    // 48px, expressed the way Mantine's own `rem()` does.
    expect(heights[0]).toContain('3rem')
    // The navbar and footer ARE responsive, so their overrides prove the query blocks still exist —
    // the header simply is not among them any more.
    expect(css).toContain('--app-shell-footer-height:0rem')
  })

  test('a route with no PageAside pays for no aside column — zero width, collapsed', () => {
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION} />
      </MantineProvider>,
    )
    const css = [...document.querySelectorAll('style')]
      .map((tag) => tag.textContent ?? '')
      .find((text) => text.includes('--app-shell-aside-width'))
    expect(css).toBeDefined()
    // Zero-wide at every viewport, and `collapsed.desktop` pins the main column's offset to 0 from
    // `sm` up — the region only exists while a page claims it (`docs/ASIDE-SPEC.md` §0). The
    // width-when-CLAIMED half is `page-aside.test.tsx`'s.
    expect(css).toContain('--app-shell-aside-width:0rem')
    expect(css).toContain('--app-shell-aside-offset:0px !important')
  })

  test('an empty PageBar contributes no node — not in the header, not in the page flow', () => {
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION}>
          <PageBar />
        </BasaltShell>
      </MantineProvider>,
    )
    expect(document.querySelector('[data-basalt-page-bar]')).toBeNull()
  })
})

/**
 * `globalActions` is DECLARED DATA since 1.26.0 (`GlobalAction[]`, was `ReactNode`), which is what
 * lets basalt project it onto mobile at all: the first two ride the bar, the rest fold into the
 * header's ONE kebab, and a `'hidden'` one is dropped below `sm`. A `ReactNode` slot could express
 * none of that, which is why every consumer hand-rolled a responsive twin instead.
 */
describe('BasaltShell globalActions mobile policy', () => {
  const ACTIONS = [
    { key: 'timer', node: <span data-testid="g-timer" /> },
    { key: 'bell', node: <span data-testid="g-bell" /> },
    { key: 'theme', node: <span data-testid="g-theme" /> },
    { key: 'devtools', node: <span data-testid="g-devtools" />, mobile: 'hidden' as const },
  ]

  const renderWithGlobals = () =>
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION} globalActions={ACTIONS} />
      </MantineProvider>,
    )

  test('the first two are mounted ONCE, unwrapped — visible at every width', () => {
    renderWithGlobals()
    for (const id of ['g-timer', 'g-bell']) {
      const node = screen.getByTestId(id)
      expect(node.closest('.mantine-visible-from-sm')).toBeNull()
      expect(node.closest('.mantine-hidden-from-sm')).toBeNull()
    }
  })

  test("the third defaults to 'more': desktop-only inline, plus the header's one kebab", () => {
    renderWithGlobals()
    expect(screen.getByTestId('g-theme').closest('.mantine-visible-from-sm')).not.toBeNull()
    const kebabs = document.querySelectorAll('[aria-label="More actions"]')
    expect(kebabs).toHaveLength(1)
    expect(kebabs[0]?.closest('.mantine-hidden-from-sm')).not.toBeNull()
  })

  test("'hidden' drops it below sm and never reaches the kebab", () => {
    renderWithGlobals()
    expect(screen.getByTestId('g-devtools').closest('.mantine-visible-from-sm')).not.toBeNull()
  })

  test('a page ActionGroup takes over the kebab, so the header never shows two', () => {
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION} globalActions={ACTIONS}>
          <PageBar actions={{ secondary: [{ key: 'export', label: 'Export' }] }} />
        </BasaltShell>
      </MantineProvider>,
    )
    expect(document.querySelectorAll('[aria-label="More actions"]')).toHaveLength(1)
  })

  test('filtersEnd folds into the SAME kebab — never a second one in row 2', () => {
    // The bug this pins: every `ActionGroup` used to read the shell's `mobile: 'more'` globals and
    // claim a kebab, so `PageBar.filtersEnd` (projected through its own group in row 2) grew a
    // SECOND kebab that re-mounted the global node. Now only row 1 is `host: 'page'`.
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION} globalActions={ACTIONS}>
          <PageBar
            actions={{ secondary: [{ key: 'export', label: 'Export CSV' }] }}
            filtersEnd={[{ key: 'metrics', label: 'Manage metrics' }]}
          />
        </BasaltShell>
      </MantineProvider>,
    )

    const kebabs = document.querySelectorAll('[aria-label="More actions"]')
    expect(kebabs).toHaveLength(1)
    // And it is the HEADER's, not row 2's.
    expect(kebabs[0]?.closest('[data-basalt-page-bar="shell"]')).toBeNull()
    expect(document.querySelector('.mantine-AppShell-header')?.contains(kebabs[0] as Node)).toBe(
      true,
    )
  })

  test('the global node reaches ONE dropdown, not two', async () => {
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION} globalActions={ACTIONS}>
          <PageBar
            actions={{ secondary: [{ key: 'export', label: 'Export CSV' }] }}
            filtersEnd={[{ key: 'metrics', label: 'Manage metrics' }]}
          />
        </BasaltShell>
      </MantineProvider>,
    )

    // One inline copy (the desktop-only `visibleFrom` box) before any dropdown opens.
    expect(screen.getAllByTestId('g-theme')).toHaveLength(1)
    fireEvent.click(screen.getByLabelText('More actions'))
    await waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull())
    // Exactly one more copy — the open dropdown's — so the node is never live in two menus at once.
    expect(screen.getAllByTestId('g-theme')).toHaveLength(2)
    expect(document.querySelectorAll('[role="menu"]')).toHaveLength(1)
  })

  test("filtersEnd alone still yields exactly one kebab, and it is the header's", () => {
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION} globalActions={ACTIONS}>
          <PageBar filtersEnd={[{ key: 'metrics', label: 'Manage metrics' }]} />
        </BasaltShell>
      </MantineProvider>,
    )
    const kebabs = document.querySelectorAll('[aria-label="More actions"]')
    expect(kebabs).toHaveLength(1)
    expect(document.querySelector('.mantine-AppShell-header')?.contains(kebabs[0] as Node)).toBe(
      true,
    )
  })

  test('a PageBar with no row-1 actions and no filtersEnd hands the kebab BACK to the shell', () => {
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION} globalActions={ACTIONS}>
          <PageBar tabs={<span data-testid="tabs" />} />
        </BasaltShell>
      </MantineProvider>,
    )
    const kebabs = document.querySelectorAll('[aria-label="More actions"]')
    expect(kebabs).toHaveLength(1)
    expect(kebabs[0]?.closest('.mantine-hidden-from-sm')).not.toBeNull()
  })

  test('an ActionGroup mounted in some OTHER home inherits no global rows and no claim', () => {
    // A consumer's tier-2 kebab (a `Section`/`ChartCard` actions slot) must not swallow the shell's
    // globals — nor steal the claim, which would leave the shell's own kebab unrendered.
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION} globalActions={ACTIONS}>
          <ActionGroup secondary={[{ key: 'a', label: 'Section action' }]} />
        </BasaltShell>
      </MantineProvider>,
    )
    // Two kebabs is CORRECT here: the shell's (globals) and the section's (its own rows). What must
    // not happen is the global node appearing in the section's.
    const shellKebab = document
      .querySelector('.mantine-AppShell-header')
      ?.querySelector('[aria-label="More actions"]')
    expect(shellKebab).not.toBeNull()
    expect(screen.getAllByTestId('g-theme')).toHaveLength(1)
  })

  test('no globalActions at all renders no kebab', () => {
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION} />
      </MantineProvider>,
    )
    expect(document.querySelector('[aria-label="More actions"]')).toBeNull()
  })
})

describe('BasaltShell region seams', () => {
  test('header, navbar and footer carry data-with-border, coloured through the theme', () => {
    const { container } = render(
      <MantineProvider theme={baseTheme}>
        <BasaltShell brand={BRAND} sections={ONE_SECTION} />
      </MantineProvider>,
    )
    for (const cls of ['header', 'navbar', 'footer']) {
      const region = container.querySelector(`.mantine-AppShell-${cls}`)
      expect(region).not.toBeNull()
      expect(region?.getAttribute('data-with-border')).not.toBeNull()
    }
    const root = container.querySelector('.mantine-AppShell-root')
    expect(root?.getAttribute('style')).toContain('--app-shell-border-color: var(--vx-divider)')
  })

  // A collapsed aside keeps its border-box, so its seam must follow the CLAIM — otherwise every
  // aside-less page paints a 1px ghost at the viewport's right edge.
  test('the aside seam exists only while a PageAside claims the region', () => {
    const unclaimed = render(
      <MantineProvider theme={baseTheme}>
        <BasaltShell brand={BRAND} sections={ONE_SECTION} />
      </MantineProvider>,
    )
    expect(
      unclaimed.container
        .querySelector('.mantine-AppShell-aside')
        ?.getAttribute('data-with-border'),
    ).toBeNull()
    unclaimed.unmount()

    const claimed = render(
      <MantineProvider theme={baseTheme}>
        <BasaltShell brand={BRAND} sections={ONE_SECTION}>
          <PageAside title="Panel">
            <div />
          </PageAside>
        </BasaltShell>
      </MantineProvider>,
    )
    expect(
      claimed.container.querySelector('.mantine-AppShell-aside')?.getAttribute('data-with-border'),
    ).not.toBeNull()
  })

  // The guard against the suppression creeping back — the only `withBorder` in the shell is the
  // aside's claim-bound one.
  test('index.tsx never suppresses a region border except the unclaimed aside', () => {
    const source = readFileSync(join(import.meta.dir, 'index.tsx'), 'utf8')
    expect(source.match(/withBorder/g)).toHaveLength(1)
    expect(source).toContain('withBorder={aside.claimed}')
  })
})

describe('common props (`common/props.ts`)', () => {
  test('className reaches the AppShell root', () => {
    const { container } = render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION} className="my-shell" />
      </MantineProvider>,
    )
    expect(container.querySelector('.mantine-AppShell-root.my-shell')).not.toBeNull()
  })
})
