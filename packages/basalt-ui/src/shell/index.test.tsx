/**
 * Hand-off paths that only `BasaltShell` can break — the sub-components are exercised directly in
 * `app-sidebar.test.tsx` / `app-mobile-nav.test.tsx`, but the shell is where the props are
 * destructured and where `extraMoreRows` is COMPUTED. A typo'd destructure key or a row count that
 * disagrees with the renderer ships silently without a test that renders `BasaltShell` itself.
 */
import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ActionGroup } from '../controls/actions'
import { baseTheme } from '../theme'
import { pxRem } from '../tokens'
import { SPACE_STEP } from '../tokens/palette'
import { PageAside } from './page-aside'
import { BasaltShell, PageBar } from './index'
import { toggleSidebar } from '../commands/shell-bridge'
import type { BasaltAccountProps, SidebarBlock, SidebarSection } from './index'

const BRAND = { name: 'Argo' }
const ONE_SECTION: SidebarSection[] = [
  { label: 'Main', items: [{ key: 'home', label: 'Home', icon: null }] },
]

/**
 * How Mantine's own `rem()` writes a px number into an AppShell variable — the plain rem string
 * (`tokens`' `pxRem`) wrapped in the `--mantine-scale` multiplier. Both the header height and the
 * page gutter below are asserted through it rather than against a typed literal, so a token move
 * updates the expectation instead of reddening a test about something else.
 */
const mantineRem = (px: number): string => `calc(${pxRem(px)} * var(--mantine-scale))`

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
 * What is under test here is the ROW COUNT the shell feeds `projectMobileNav`, not the threshold it
 * is compared against: counting `account` as ONE row while `accountRows` expands it into up to
 * seven is what let a nine-row More surface pick `menu`.
 *
 * The threshold is therefore pinned EXPLICITLY (`mobileNav.menuMax`) rather than inherited from
 * `MOBILE_MENU_MAX_DEFAULT`. That default rose 6 -> 12 in the 2026-09 chrome round once the
 * never-below-the-fold guarantee moved onto `.menuDropdown`'s own `max-height` (the popover scrolls
 * and cannot render off-screen at any row count), so the constant is now a taste bound. A test that
 * rode it would have silently stopped testing the count the day the taste changed.
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
        <BasaltShell
          brand={BRAND}
          sections={NAV}
          account={FAT_ACCOUNT}
          mobileNav={{ menuMax: 6 }}
        />
      </MantineProvider>,
    )

    fireEvent.click(screen.getByLabelText('More'))
    await waitFor(() => expect(document.querySelector('.mantine-Drawer-content')).not.toBeNull())
    expect(document.querySelector('[role="menu"]')).toBeNull()
  })

  /** The other half of the same contract: at the shipped default those seven rows stay a popover. */
  test('the same account stays a MENU at the default menuMax of 12', async () => {
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={NAV} account={FAT_ACCOUNT} />
      </MantineProvider>,
    )

    fireEvent.click(screen.getByLabelText('More'))
    await waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull())
    expect(document.querySelector('.mantine-Drawer-content')).toBeNull()
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

  test("commands/shell-bridge.ts's toggleSidebar flips the SAME persisted state the button does (C5)", () => {
    const key = 'collapse-envelope-bridge'
    localStorage.clear()
    renderShell(key)

    act(() => toggleSidebar())

    expect(localStorage.getItem(`basalt:${key}`)).toBe(JSON.stringify({ v: 1, value: true }))
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
    // The token, expressed the way Mantine's own `rem()` does — read from `SPACE_STEP` rather than
    // typed here, because the literal that used to sit here (`3rem`, the pre-1.30 48) went stale the
    // moment `appShellHeaderHeight` moved to 44 and failed a test that has nothing to do with the
    // number. What this case pins is the COUNT above: one declaration, no media override.
    expect(heights[0]).toBe(mantineRem(SPACE_STEP.appShellHeaderHeight))
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

  /**
   * THE PAGE GUTTER, which was one `'sm'` spacing key — 13px on a 360px phone and 13px on a 2560px
   * monitor, with no token behind it and no `padding` prop on `BasaltShellProps`. It is now the
   * `appShellInsetMobile` / `appShellInset` pair, and this is the case that proves the pair is
   * actually RESPONSIVE rather than merely written as an object.
   *
   * The two roads are asserted separately on purpose, because they are genuinely two mechanisms
   * (verified in the installed Mantine 9.3 source, see `ShellFrame`'s own comment): `AppShell
   * padding` becomes an `--app-shell-padding` variable through `assignPaddingVariables`, while
   * `AppShell.Header px` is a Box STYLE PROP that emits `padding-inline` on a generated class. Both
   * step at the same `(min-width: 48em)`, which is what keeps the header's inline padding on the
   * main column's gutter at every width instead of only at one.
   */
  test('the page gutter is a responsive PAIR — the phone token below `sm`, the desktop token above', () => {
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION} />
      </MantineProvider>,
    )
    const styles = [...document.querySelectorAll('style')].map((tag) => tag.textContent ?? '')

    // Road 1 — `AppShell padding`. Base rule carries the phone value, the `sm` MIN-width block the
    // desktop one (a responsive object emits no max-width twin; it is mobile-first).
    const shellCss = styles.find((text) => text.includes('--app-shell-padding'))
    expect(shellCss).toBeDefined()
    const paddings = [...(shellCss ?? '').matchAll(/--app-shell-padding:\s*([^;]+)/g)].map(
      (m) => m[1],
    )
    expect(paddings).toEqual([
      mantineRem(SPACE_STEP.appShellInsetMobile),
      mantineRem(SPACE_STEP.appShellInset),
    ])
    expect(shellCss).toContain('@media(min-width: 48em)')

    // Road 2 — the header's `px`, on the class Mantine generated for it, so the header's inline
    // padding lands on the same two numbers rather than staying at a third.
    const headerClass = [...(document.querySelector('header')?.classList ?? [])].find((name) =>
      styles.some((text) => text.includes(`.${name}{padding-inline:`)),
    )
    expect(headerClass).toBeDefined()
    const headerCss = styles.find((text) => text.includes(`.${headerClass ?? ''}{padding-inline:`))
    const insets = [...(headerCss ?? '').matchAll(/padding-inline:\s*([^;]+)/g)].map((m) => m[1])
    expect(insets).toEqual([
      mantineRem(SPACE_STEP.appShellInsetMobile),
      mantineRem(SPACE_STEP.appShellInset),
    ])
    expect(headerCss).toContain('@media(min-width: 48em)')
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
