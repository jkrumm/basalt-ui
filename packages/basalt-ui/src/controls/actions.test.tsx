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
  test('the primary becomes an icon button and the rest one kebab', () => {
    renderGroup({ primary: { key: 'new', label: 'New run' }, secondary: secondary(4) })
    const row = mobile()
    expect(row).not.toBeNull()
    expect(row?.querySelector('[aria-label="New run"]')).not.toBeNull()
    const kebabs = row?.querySelectorAll('[aria-label="More actions"]')
    expect(kebabs?.length).toBe(1)
  })

  test('an icon-less primary falls back to the first letter of its label', () => {
    renderGroup({ primary: { key: 'new', label: 'New run' } })
    expect(mobile()?.querySelector('[aria-label="New run"]')?.textContent).toBe('N')
  })

  test("mobile: 'hidden' drops the action from the bar AND from the kebab", () => {
    renderGroup({ secondary: [{ key: 'x', label: 'Nowhere', mobile: 'hidden' }] })
    const row = mobile()
    expect(row).toBeNull()
    // Still on desktop, though — `mobile` only decides the small-viewport placement.
    expect(desktop()?.textContent).toContain('Nowhere')
  })

  test("mobile: 'bar' promotes a secondary to an inline icon button", () => {
    renderGroup({ secondary: [{ key: 'live', label: 'Live', mobile: 'bar' }] })
    expect(mobile()?.querySelector('[aria-label="Live"]')).not.toBeNull()
    expect(mobile()?.querySelector('[aria-label="More actions"]')).toBeNull()
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

  test("a mobileOnly action marked 'bar' becomes an inline mobile icon button", () => {
    renderWithExtras(
      <BarActionRow host="page" mobileOnly={[{ key: 'm', label: 'Metrics', mobile: 'bar' }]} />,
    )
    expect(mobile()?.querySelector('[aria-label="Metrics"]')).not.toBeNull()
  })
})
