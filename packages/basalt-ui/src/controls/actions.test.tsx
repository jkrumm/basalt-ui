/**
 * `ActionGroup`'s fold and its mobile projection — the two behaviours that make `BarAction[]` data
 * rather than a `ReactNode` row (`docs/CONTROLS-SPEC.md` §2.1, laws C6/C7/C9).
 *
 * Both variants of the group are mounted at once (the swap is CSS, law C9), so every assertion here
 * scopes itself to one variant. A CSS module resolves to `''` under `bun test`, so the variants are
 * told apart by Mantine's own `visibleFrom`/`hiddenFrom` utility classes, which are stable public
 * API (`mantine-visible-from-sm` / `mantine-hidden-from-sm`).
 */
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import {
  ActionGroup,
  BarActionRow,
  BarExtrasProvider,
  OverflowMenu,
  barActionMobile,
  globalActionMobile,
} from './actions'
import type { BarAction, BarExtras } from './actions'

function renderGroup(props: Parameters<typeof ActionGroup>[0]) {
  return render(
    <MantineProvider>
      <ActionGroup {...props} />
    </MantineProvider>,
  )
}

const desktop = () => document.querySelector('.mantine-visible-from-sm')
const mobile = () => document.querySelector('.mantine-hidden-from-sm')

const secondary = (n: number): BarAction[] =>
  Array.from({ length: n }, (_, i) => ({ key: `s${i}`, label: `Second ${i}` }))

describe('ActionGroup — desktop', () => {
  test('the primary renders filled, the secondaries default', () => {
    renderGroup({ primary: { key: 'new', label: 'New run' }, secondary: secondary(1) })
    const row = desktop()
    expect(row).not.toBeNull()
    const primary = row?.querySelector('[data-variant="filled"]')
    expect(primary?.textContent).toBe('New run')
    expect(row?.querySelector('[data-variant="default"]')?.textContent).toBe('Second 0')
  })

  test('three secondaries render inline with no More menu', () => {
    renderGroup({ secondary: secondary(3) })
    const row = desktop()
    expect(row?.querySelectorAll('[data-variant="default"]').length).toBe(3)
    expect(row?.textContent).not.toContain('More')
  })

  test('a fourth secondary folds into ONE More menu instead of widening the row (law C7)', () => {
    renderGroup({ secondary: secondary(5) })
    const row = desktop()
    // Three inline + the `More` trigger, which is itself a `default` button.
    expect(row?.querySelectorAll('[data-variant="default"]').length).toBe(4)
    expect(row?.textContent).toContain('More')
    expect(screen.getAllByRole('button', { name: 'More' }).length).toBe(1)
  })

  test("a kind: 'menu' action never takes bar width — it folds even as the only secondary", () => {
    renderGroup({
      secondary: [{ key: 'more', kind: 'menu', label: 'Export as', items: secondary(2) }],
    })
    expect(desktop()?.textContent).toContain('More')
  })
})

describe('ActionGroup — mobile', () => {
  test('the primary rides the bar and the rest fold into one kebab', () => {
    renderGroup({ primary: { key: 'new', label: 'New run' }, secondary: secondary(4) })
    const row = mobile()
    expect(row).not.toBeNull()
    expect(row?.textContent).toContain('New run')
    const kebabs = row?.querySelectorAll('[aria-label="More actions"]')
    expect(kebabs?.length).toBe(1)
  })

  test('a primary WITH an icon becomes an icon button, named by its label', () => {
    renderGroup({ primary: { key: 'new', label: 'New run', icon: <span>+</span> } })
    const button = mobile()?.querySelector('[aria-label="New run"]')
    expect(button).not.toBeNull()
    // The label is the accessible name only — it is never painted beside the glyph.
    expect(button?.textContent).toBe('+')
  })

  test('an icon-LESS primary keeps its label instead of drawing a first-letter avatar', () => {
    // `N` for `New run` is an avatar: a glyph whose meaning has to be known in advance. The label is
    // wider and says what the button does, and the breadcrumb beside it truncates to make room.
    renderGroup({ primary: { key: 'new', label: 'New run' } })
    const row = mobile()
    expect(row?.textContent).toContain('New run')
    expect(row?.textContent).not.toBe('N')
  })

  test("mobile: 'hidden' drops the action from the bar AND from the kebab", () => {
    renderGroup({ secondary: [{ key: 'x', label: 'Nowhere', mobile: 'hidden' }] })
    const row = mobile()
    expect(row).toBeNull()
    // Still on desktop, though — `mobile` only decides the small-viewport placement.
    expect(desktop()?.textContent).toContain('Nowhere')
  })

  test("mobile: 'bar' promotes a secondary out of the kebab and onto the bar", () => {
    renderGroup({ secondary: [{ key: 'live', label: 'Live', mobile: 'bar' }] })
    // Icon-less, so it takes the labelled form — an ActionIcon with no icon would be an empty box.
    expect(mobile()?.textContent).toContain('Live')
    expect(mobile()?.querySelector('[aria-label="More actions"]')).toBeNull()
  })

  test("an icon-bearing mobile: 'bar' secondary is the icon form, named by its label", () => {
    renderGroup({
      secondary: [{ key: 'live', label: 'Live', mobile: 'bar', icon: <span>●</span> }],
    })
    expect(mobile()?.querySelector('[aria-label="Live"]')).not.toBeNull()
  })
})

describe('the mobile placement law', () => {
  test('a primary rides the bar, everything else folds', () => {
    const action: BarAction = { key: 'a', label: 'A' }
    expect(barActionMobile(action, true)).toBe('bar')
    expect(barActionMobile(action, false)).toBe('more')
  })

  test('an explicit `mobile` wins over both defaults', () => {
    expect(barActionMobile({ key: 'a', label: 'A', mobile: 'more' }, true)).toBe('more')
    expect(barActionMobile({ key: 'a', label: 'A', mobile: 'bar' }, false)).toBe('bar')
  })

  test("a kind: 'menu' group is always a More row, never a bar slot", () => {
    expect(barActionMobile({ key: 'm', kind: 'menu', label: 'M', items: [] }, true)).toBe('more')
  })

  test('the first two global actions ride the bar, the rest fold', () => {
    const global = { key: 'g', node: null }
    expect(globalActionMobile(global, 0)).toBe('bar')
    expect(globalActionMobile(global, 1)).toBe('bar')
    expect(globalActionMobile(global, 2)).toBe('more')
    expect(globalActionMobile({ ...global, mobile: 'hidden' }, 0)).toBe('hidden')
  })
})

describe('OverflowMenu', () => {
  test('renders nothing for an empty action list — an empty home renders nothing (law C14)', () => {
    render(
      <MantineProvider>
        <OverflowMenu actions={[]} />
      </MantineProvider>,
    )
    expect(document.querySelector('button')).toBeNull()
  })

  test('the trigger is a labelled button on desktop and a named icon button as a kebab', () => {
    const { unmount } = render(
      <MantineProvider>
        <OverflowMenu actions={secondary(1)} />
      </MantineProvider>,
    )
    expect(screen.getByRole('button', { name: 'More' })).not.toBeNull()
    unmount()

    render(
      <MantineProvider>
        <OverflowMenu actions={secondary(1)} trigger="kebab" label="More actions" />
      </MantineProvider>,
    )
    expect(screen.getByRole('button', { name: 'More actions' })).not.toBeNull()
  })
})

/**
 * The `host` scoping (`BarActionRowProps.host`). The shell's `mobile: 'more'` global actions belong
 * to ONE kebab, and the leak that made this a law was that every `ActionGroup` read the context:
 * `PageBar.filtersEnd` and any consumer-mounted tier-2 group each grew a second kebab holding a
 * duplicate of the global node, and each took the claim that decides whether the shell renders its
 * own.
 */
describe('shell kebab extras are scoped to the page bar', () => {
  const GLOBAL_ROW: BarAction = { key: 'g', kind: 'custom', node: <span data-testid="global" /> }

  function renderWithExtras(node: ReactNode) {
    const claims: number[] = []
    const extras: BarExtras = {
      mobileMoreActions: [GLOBAL_ROW],
      claimKebab: () => {
        claims.push(1)
        return () => claims.push(-1)
      },
    }
    const result = render(
      <MantineProvider>
        <BarExtrasProvider value={extras}>{node}</BarExtrasProvider>
      </MantineProvider>,
    )
    return { ...result, claims }
  }

  test('a public ActionGroup takes neither the global rows nor the claim', async () => {
    const { claims } = renderWithExtras(
      <ActionGroup secondary={[{ key: 'a', label: 'Own action' }]} />,
    )
    expect(claims).toHaveLength(0)
    // Its own kebab exists (its secondary defaults to `more`) but holds only its own row.
    fireEvent.click(screen.getByLabelText('More actions'))
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Own action' })).toBeDefined())
    expect(screen.queryByTestId('global')).toBeNull()
  })

  test('the page-bar row-1 group DOES take them — it is the one instance entitled to', async () => {
    const { claims } = renderWithExtras(
      <BarActionRow host="page" secondary={[{ key: 'a', label: 'Own action' }]} />,
    )
    expect(claims).toEqual([1])
    fireEvent.click(screen.getByLabelText('More actions'))
    await waitFor(() => expect(screen.getByTestId('global')).toBeDefined())
  })

  test("viewport: 'desktop' renders no mobile half at all — no kebab, no claim", () => {
    const { claims } = renderWithExtras(
      <BarActionRow host="page" viewport="desktop" secondary={[{ key: 'a', label: 'Row 2' }]} />,
    )
    expect(claims).toHaveLength(0)
    expect(document.querySelector('.mantine-hidden-from-sm')).toBeNull()
    expect(desktop()?.textContent).toContain('Row 2')
  })

  test('mobileOnly actions join the mobile kebab without widening the desktop row', async () => {
    renderWithExtras(
      <BarActionRow
        host="page"
        secondary={[{ key: 'a', label: 'Own action' }]}
        mobileOnly={[{ key: 'metrics', label: 'Manage metrics' }]}
      />,
    )
    expect(desktop()?.textContent).not.toContain('Manage metrics')
    fireEvent.click(screen.getByLabelText('More actions'))
    await waitFor(() =>
      expect(screen.getByRole('menuitem', { name: 'Manage metrics' })).toBeDefined(),
    )
  })

  test("a mobileOnly action marked 'bar' renders inline on the mobile bar", () => {
    renderWithExtras(
      <BarActionRow host="page" mobileOnly={[{ key: 'm', label: 'Metrics', mobile: 'bar' }]} />,
    )
    expect(mobile()?.textContent).toContain('Metrics')
  })
})

/**
 * `className`/`style` on the row, which is a FRAGMENT — so the question is which of its groups the
 * caller's class lands on, and how many of them. Both variants get it (the swap is CSS, law C9),
 * and the desktop half gets it exactly once even when `syncNode` splits it in two.
 */
function renderRow(props: Parameters<typeof BarActionRow>[0]) {
  return render(
    <MantineProvider>
      <BarActionRow {...props} />
    </MantineProvider>,
  )
}

describe('BarActionRow — className placement across the sync split', () => {
  test('with a syncNode and nothing to lead with, the primary-only group takes className/style', () => {
    renderRow({
      host: 'slot',
      primary: { key: 'new', label: 'New run' },
      syncNode: <span>sync</span>,
      className: 'my-actions',
      style: { marginInlineStart: 'auto' },
    })
    // Both variants are mounted at once (the swap is CSS, law C9), so the class lands on the mobile
    // group too — the assertion is about the DESKTOP half, which is the one the sync node splits.
    const desktopClassed = [...document.querySelectorAll('.my-actions')].filter((el) =>
      el.className.includes('mantine-visible-from-sm'),
    )
    expect(desktopClassed).toHaveLength(1)
    const group = desktopClassed[0] as HTMLElement
    expect(group.textContent).toBe('New run')
    expect(group.getAttribute('style') ?? '').toContain('margin-inline-start: auto')
  })

  test('with a lead group present the class stays there — never on both desktop groups', () => {
    renderRow({
      host: 'slot',
      primary: { key: 'new', label: 'New run' },
      secondary: secondary(1),
      syncNode: <span>sync</span>,
      className: 'my-actions',
    })
    const desktopClassed = [...document.querySelectorAll('.my-actions')].filter((el) =>
      el.className.includes('mantine-visible-from-sm'),
    )
    expect(desktopClassed).toHaveLength(1)
    expect(desktopClassed[0]?.textContent).toContain('Second 0')
  })
})
