/**
 * `blocks` — the declared-data seam that replaced `navExtra` (law C13, `docs/CONTROLS-SPEC.md`
 * §2.3), plus the other thing the sidebar owns: the flat-vs-menu settings footer. The `brand.menu`
 * workspace switcher moved out with the brand row itself — see `app-brand.test.tsx`.
 *
 * What is asserted here and what deliberately is not: CSS-module class hashes are unavailable under
 * `bun test` (see `stat-card.test.tsx` for the same constraint), and jsdom evaluates no media query,
 * so the collapsed-rail RULES are not testable. What IS testable is the DOM the rules select
 * against — `data-rail` on every block, a dot node when a count earns one, and the ring on the
 * settings row (the one rail projection that is JS-gated, because it moves the mark to a different
 * node). A regression that reintroduces a JS `collapsed` check for the CSS-only halves fails the
 * "stays mounted when collapsed" assertions instead of only breaking at the rail width in a browser.
 */
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { AppSidebar } from './app-sidebar'
import type { AppSidebarProps } from './app-sidebar'
import type { SidebarBlock } from '../nav/types'

const BRAND = { name: 'Argo' }
const ONE_SECTION: AppSidebarProps['sections'] = [
  { label: 'Main', items: [{ key: 'home', label: 'Home', icon: null }] },
]

function renderSidebar(props: Partial<AppSidebarProps>) {
  return render(
    <MantineProvider>
      <AppSidebar
        brand={BRAND}
        sections={ONE_SECTION}
        collapsed={false}
        onToggleCollapse={() => {}}
        {...props}
      />
    </MantineProvider>,
  )
}

/** The nav `ScrollArea`'s content Stack — the direct parent of `sections` and the `'nav'` blocks. */
function navStack(container: HTMLElement): Element {
  const stack = container.querySelector('.mantine-ScrollArea-content > .mantine-Stack-root')
  if (!stack) throw new Error('expected the nav ScrollArea content Stack to render')
  return stack
}

const AWAITING: SidebarBlock = {
  kind: 'list',
  key: 'awaiting',
  label: 'Awaiting action',
  count: 3,
  items: [
    { key: 'a', label: 'Review PR', tone: 'warn' },
    { key: 'b', label: 'Sign contract', tone: 'bad', href: '/contract' },
    { key: 'c', label: 'Reply to Jo', meta: '2h' },
  ],
}

describe('sidebar blocks — rendering per kind', () => {
  test("a 'list' block renders its label, count badge and rows", () => {
    renderSidebar({ blocks: [AWAITING] })
    expect(screen.getByText('Awaiting action')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('Review PR')).toBeTruthy()
    expect(screen.getByText('Reply to Jo')).toBeTruthy()
  })

  test('a row with nowhere to go is NOT a link — the Recents shape stays plain text', () => {
    renderSidebar({
      blocks: [
        {
          kind: 'list',
          key: 'recents',
          label: 'Recents',
          items: [
            { key: 'r1', label: 'Q3 plan' },
            { key: 'r2', label: 'Q4 plan', href: '/q4' },
          ],
        },
      ],
    })
    // A keyboard walk must not stop on a dead `<a>`; the sibling WITH an href proves the same
    // renderer still produces one when there is somewhere to go.
    expect(screen.getByText('Q3 plan').closest('a')).toBeNull()
    expect(screen.getByText('Q4 plan').closest('a')).not.toBeNull()
  })

  test("a 'progress' block renders label, `n of m` and a Progress track", () => {
    const { container } = renderSidebar({
      blocks: [
        { kind: 'progress', key: 'onboarding', label: 'Getting started', value: 1, total: 5 },
      ],
    })
    expect(screen.getByText('Getting started')).toBeTruthy()
    expect(screen.getByText('1 of 5')).toBeTruthy()
    expect(container.querySelector('.mantine-Progress-root')).not.toBeNull()
  })

  test("a 'custom' block mounts the node verbatim, inside the nav scroll region", () => {
    const { container } = renderSidebar({
      blocks: [{ kind: 'custom', key: 'tree', node: <div data-testid="nav-extra">Extra</div> }],
    })
    const extra = screen.getByTestId('nav-extra')
    const stack = navStack(container)
    expect(stack.contains(extra)).toBe(true)
    expect(stack.lastElementChild?.contains(extra)).toBe(true)
  })

  test('a custom block stays mounted when collapsed — hiding it is CSS-only, not a JS gate', () => {
    const { container } = renderSidebar({
      collapsed: true,
      blocks: [{ kind: 'custom', key: 'tree', node: <div data-testid="nav-extra">Extra</div> }],
    })
    expect(navStack(container).contains(screen.getByTestId('nav-extra'))).toBe(true)
  })

  test('sections={[]} plus one block renders cleanly — no orphan section wrapper', () => {
    const { container } = renderSidebar({
      sections: [],
      blocks: [{ kind: 'custom', key: 'tree', node: <div data-testid="nav-extra">Extra</div> }],
    })
    expect(navStack(container).children.length).toBe(1)
  })

  test("omitting blocks reproduces today's DOM — no stray wrapper for the unused slot", () => {
    const { container } = renderSidebar({})
    expect(navStack(container).children.length).toBe(ONE_SECTION.length)
  })
})

describe('sidebar blocks — placement', () => {
  test("'nav' is the default for list and custom: both land in the scroll region", () => {
    const { container } = renderSidebar({
      blocks: [AWAITING, { kind: 'custom', key: 'tree', node: <span>tree</span> }],
    })
    expect(navStack(container).children.length).toBe(ONE_SECTION.length + 2)
  })

  test("'bottom' pins above the settings footer, OUTSIDE the nav scroll region", () => {
    const { container } = renderSidebar({
      blocks: [{ ...AWAITING, placement: 'bottom' }],
      settingsMenuItems: [{ key: 'theme', label: 'Theme', onClick: () => {} }],
    })
    expect(navStack(container).children.length).toBe(ONE_SECTION.length)
    const label = screen.getByText('Awaiting action')
    expect(label.closest('.mantine-ScrollArea-root')).toBeNull()
    // Above the settings row, not below it.
    const footer = label.closest('.mantine-Stack-root')
    const settings = screen.getByLabelText('Theme')
    expect(footer?.contains(settings)).toBe(true)
  })

  test('a progress block is bottom-placed with no placement stated', () => {
    const { container } = renderSidebar({
      blocks: [{ kind: 'progress', key: 'p', label: 'Getting started', value: 1, total: 5 }],
    })
    expect(navStack(container).children.length).toBe(ONE_SECTION.length)
    expect(screen.getByText('Getting started').closest('.mantine-ScrollArea-root')).toBeNull()
  })
})

describe('sidebar blocks — Show more', () => {
  const LONG: SidebarBlock = {
    kind: 'list',
    key: 'long',
    label: 'Awaiting action',
    max: 3,
    items: Array.from({ length: 6 }, (_, i) => ({ key: `i${i}`, label: `Item ${i}` })),
  }

  test('max shows the first N and a Show more toggle; the toggle reveals the rest', () => {
    renderSidebar({ blocks: [LONG] })
    expect(screen.getByText('Item 2')).toBeTruthy()
    expect(screen.queryByText('Item 3')).toBeNull()

    fireEvent.click(screen.getByText('Show more'))
    expect(screen.getByText('Item 5')).toBeTruthy()
    expect(screen.getByText('Show less')).toBeTruthy()
  })

  test('no max, or a max past the item count, renders no toggle at all', () => {
    renderSidebar({ blocks: [AWAITING, { ...LONG, key: 'long2', max: 99 }] })
    expect(screen.queryByText('Show more')).toBeNull()
  })

  test('Show more is EPHEMERAL — it persists nothing (unlike the fold)', () => {
    localStorage.clear()
    renderSidebar({ blocks: [LONG] })
    fireEvent.click(screen.getByText('Show more'))
    expect(localStorage.getItem('basalt:sidebar-block:long')).toBeNull()
  })
})

/**
 * The fold keys are a CONTRACT, not an implementation detail: a consumer mirroring the state reads
 * them with `readPersistedValue` from `basalt-ui/state`, and renaming one silently resets every
 * user's sidebar. Section folds were a `useState` keyed by label through 1.25.0 — every reload
 * re-opened a section the user had closed.
 */
describe('sidebar blocks — persisted folds', () => {
  test('a block fold writes the versioned envelope at basalt:sidebar-block:<key>', () => {
    localStorage.clear()
    renderSidebar({ blocks: [{ ...AWAITING, key: 'awaiting-fold', collapsible: true }] })

    fireEvent.click(screen.getByText('Awaiting action'))

    expect(localStorage.getItem('basalt:sidebar-block:awaiting-fold')).toBe(
      JSON.stringify({ v: 1, value: true }),
    )
  })

  test('a nav-section fold writes at basalt:sidebar-section:<label-slug>', () => {
    localStorage.clear()
    renderSidebar({
      sections: [
        { label: 'Tools & More', collapsible: true, items: [{ key: 't', label: 'T', icon: null }] },
      ],
    })

    fireEvent.click(screen.getByText('Tools & More'))

    expect(localStorage.getItem('basalt:sidebar-section:tools-more')).toBe(
      JSON.stringify({ v: 1, value: true }),
    )
  })

  test('a persisted fold is restored on the next mount', () => {
    localStorage.clear()
    localStorage.setItem('basalt:sidebar-section:restored', JSON.stringify({ v: 1, value: true }))
    renderSidebar({
      sections: [
        {
          label: 'Restored',
          collapsible: true,
          items: [{ key: 't', label: 'Folded', icon: null }],
        },
      ],
    })
    expect(screen.getByText('Restored').closest('button')?.getAttribute('aria-expanded')).toBe(
      'false',
    )
  })
})

/** The `data-rail` attribute of the nth block — the whole contract with the rail stylesheet. */
const railOf = (container: HTMLElement, index = 0): string | null | undefined =>
  container.querySelectorAll('[data-rail]')[index]?.getAttribute('data-rail')

/**
 * Rail projection. `data-rail` is the whole contract between the resolver and the stylesheet — the
 * CSS selects on it (`.root[data-collapsed] .block[data-rail='hidden']`), so an attribute that
 * stops matching the resolver is a rail that silently stops projecting.
 */
describe('sidebar blocks — rail projection', () => {
  test("a list with a count is data-rail='dot' and renders the dot node", () => {
    const { container } = renderSidebar({
      blocks: [{ ...AWAITING, icon: <span data-testid="block-icon" /> }],
    })
    expect(railOf(container)).toBe('dot')
    // The dot lives inside the icon wrapper — that is what the rail shows instead of the badge.
    expect(screen.getByTestId('block-icon').parentElement?.children).toHaveLength(2)
  })

  test("a list with NO count is data-rail='hidden' — a dot with no number behind it means nothing", () => {
    const { container } = renderSidebar({
      blocks: [
        { kind: 'list', key: 'recents', label: 'Recents', items: [{ key: 'a', label: 'A' }] },
      ],
    })
    expect(railOf(container)).toBe('hidden')
  })

  test("rail:'hidden' overrides the count default", () => {
    const { container } = renderSidebar({
      blocks: [{ ...AWAITING, icon: <span />, rail: 'hidden' }],
    })
    expect(railOf(container)).toBe('hidden')
  })

  test('a count with NO icon leaves the rail — a dot has to sit on something', () => {
    const { container } = renderSidebar({ blocks: [AWAITING] })
    expect(railOf(container)).toBe('hidden')
  })

  test('a custom block is always hidden in the rail, as navExtra was', () => {
    const { container } = renderSidebar({
      blocks: [{ kind: 'custom', key: 'tree', node: <span>tree</span> }],
    })
    expect(railOf(container)).toBe('hidden')
  })

  test("a progress block is data-rail='ring', and the ring renders on the SETTINGS row when collapsed", () => {
    const { container } = renderSidebar({
      collapsed: true,
      blocks: [{ kind: 'progress', key: 'p', label: 'Getting started', value: 1, total: 5 }],
      settingsMenuItems: [{ key: 'theme', label: 'Theme', onClick: () => {} }],
    })
    expect(railOf(container)).toBe('ring')
    const ring = container.querySelector('[data-basalt-rail-ring]')
    expect(ring).not.toBeNull()
    expect(screen.getByLabelText('Theme').contains(ring as Node)).toBe(true)
  })

  test('expanded, there is no ring — the block paints its own track instead', () => {
    const { container } = renderSidebar({
      blocks: [{ kind: 'progress', key: 'p', label: 'Getting started', value: 1, total: 5 }],
      settingsMenuItems: [{ key: 'theme', label: 'Theme', onClick: () => {} }],
    })
    expect(container.querySelector('[data-basalt-rail-ring]')).toBeNull()
  })

  test("rail:'hidden' on a progress block puts no ring on the settings row", () => {
    const { container } = renderSidebar({
      collapsed: true,
      blocks: [
        {
          kind: 'progress',
          key: 'p',
          label: 'Getting started',
          value: 1,
          total: 5,
          rail: 'hidden',
        },
      ],
      settingsMenuItems: [{ key: 'theme', label: 'Theme', onClick: () => {} }],
    })
    expect(container.querySelector('[data-basalt-rail-ring]')).toBeNull()
  })
})

/**
 * The footer threshold. A menu that opens to show two rows costs a click for nothing; eight flat
 * rows cost the nav its height. Three is the line (`docs/CONTROLS-SPEC.md` §2.3), and it is
 * basalt's — there is no prop.
 */
describe('settingsMenuItems — flat at three or fewer', () => {
  const three = [
    { key: 'settings', label: 'Settings', onClick: () => {} },
    { key: 'integrations', label: 'Integrations', onClick: () => {} },
    { key: 'invite', label: 'Invite teammates', onClick: () => {} },
  ]

  test('three entries render as three link rows, each firing its own handler', () => {
    let fired = ''
    renderSidebar({
      settingsMenuItems: three.map((entry) => ({ ...entry, onClick: () => (fired = entry.key) })),
    })
    expect(screen.getByText('Integrations')).toBeTruthy()
    expect(screen.getByText('Invite teammates')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Invite teammates'))
    expect(fired).toBe('invite')
  })

  test('four entries collapse into the single gear menu', async () => {
    renderSidebar({
      settingsMenuItems: [...three, { key: 'devtools', label: 'Devtools', onClick: () => {} }],
    })
    // Only the gear trigger is present until it opens.
    expect(screen.queryByText('Integrations')).toBeNull()
    fireEvent.click(screen.getByLabelText('Settings'))
    await waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull())
    expect(screen.getByText('Integrations')).toBeTruthy()
  })

  test('the version rides the flat rows as a faint label, and the menu as a Menu.Label', async () => {
    renderSidebar({ brand: { name: 'Argo', version: '2.1.0' }, settingsMenuItems: three })
    expect(screen.getByText('Argo v2.1.0')).toBeTruthy()
  })

  test('no entries at all renders no footer row', () => {
    renderSidebar({})
    expect(screen.queryByLabelText('Settings')).toBeNull()
  })

  /**
   * The count is not the whole question — three rows that are each a control (a theme radio group,
   * a devtools switch) read as a widget pile flat, and the count rule cannot see the difference.
   * `settingsMenu` is that override and nothing more: it moves the form, never the entries.
   */
  describe('settingsMenu forces the form', () => {
    test("'menu' collapses two entries into the gear dropdown", async () => {
      renderSidebar({ settingsMenuItems: three.slice(0, 2), settingsMenu: 'menu' })
      expect(screen.queryByText('Integrations')).toBeNull()
      fireEvent.click(screen.getByLabelText('Settings'))
      await waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull())
      expect(screen.getByText('Integrations')).toBeTruthy()
    })

    test("'flat' keeps four entries as four link rows", () => {
      renderSidebar({
        settingsMenuItems: [...three, { key: 'devtools', label: 'Devtools', onClick: () => {} }],
        settingsMenu: 'flat',
      })
      // No dropdown to open — every entry is its own row, and the gear trigger is not one of them.
      expect(document.querySelector('[role="menu"]')).toBeNull()
      expect(screen.getByText('Devtools')).toBeTruthy()
      expect(screen.getByText('Integrations')).toBeTruthy()
    })

    test("'auto' is the default — the count rule, unchanged", () => {
      renderSidebar({ settingsMenuItems: three, settingsMenu: 'auto' })
      expect(screen.getByText('Integrations')).toBeTruthy()
    })
  })
})

describe('search.actions', () => {
  test('no actions: the trigger is the row, with no wrapper and no extra buttons', () => {
    const { container } = renderSidebar({ search: { onOpen: () => {} } })
    // ONE button: the search trigger. The collapse toggle used to be the second — it moved into the
    // header's brand zone (`app-brand.tsx`) with the brand row.
    expect(container.querySelectorAll('button')).toHaveLength(1)
  })

  test('two actions render as icon-only buttons at the icon tier, right of the ⌘K row', () => {
    let created = 0
    renderSidebar({
      search: {
        onOpen: () => {},
        actions: [
          { key: 'new', label: 'New note', icon: <span />, onClick: () => (created += 1) },
          { key: 'filter', label: 'Filter', icon: <span /> },
        ],
      },
    })
    const newButton = screen.getByLabelText('New note')
    expect(newButton.getAttribute('data-size')).toBe('icon')
    expect(screen.getByLabelText('Filter')).toBeTruthy()
    fireEvent.click(newButton)
    expect(created).toBe(1)
  })

  test('an action with no icon falls back to its first grapheme, label as the accessible name', () => {
    renderSidebar({
      search: { onOpen: () => {}, actions: [{ key: 'new', label: 'New note' }] },
    })
    expect(screen.getByLabelText('New note').textContent).toBe('N')
  })
})

describe('nav item active/ancestor state (useNav exclusivity — router-tanstack/use-nav.test.tsx)', () => {
  test('only the active row carries aria-current="page"', () => {
    renderSidebar({
      sections: [
        {
          label: 'Main',
          items: [
            { key: 'home', label: 'Home', icon: null, active: true },
            { key: 'charts', label: 'Charts', icon: null, active: false },
          ],
        },
      ],
    })
    expect(screen.getByText('Home').closest('a')?.getAttribute('aria-current')).toBe('page')
    expect(screen.getByText('Charts').closest('a')?.hasAttribute('aria-current')).toBe(false)
  })

  test('an ancestor row carries data-ancestor and no aria-current', () => {
    renderSidebar({
      sections: [
        {
          label: 'Main',
          items: [
            {
              key: 'dashboard',
              label: 'Dashboard',
              icon: null,
              active: false,
              ancestor: true,
              children: [{ key: 'sessions', label: 'Sessions', icon: null, active: true }],
            },
          ],
        },
      ],
    })
    const dashboardAnchor = screen.getByText('Dashboard').closest('a')
    expect(dashboardAnchor?.hasAttribute('data-ancestor')).toBe(true)
    expect(dashboardAnchor?.hasAttribute('aria-current')).toBe(false)
  })
})

describe('common props (`common/props.ts`)', () => {
  test('className reaches the sidebar root', () => {
    const { container } = renderSidebar({ className: 'my-sidebar' })
    expect(container.querySelector('.my-sidebar')).toBeTruthy()
  })
})
