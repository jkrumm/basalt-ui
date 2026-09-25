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
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import {
  ActionGroup,
  BarActionRow,
  BarActionSlot,
  BarExtrasProvider,
  OverflowMenu,
  barActionMobile,
  globalActionMobile,
  isBarActionList,
  BAR_KEY_ATTR,
  PAGE_BAR_END_ATTR,
  planBarFold,
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

  test('without a measurable row nothing folds — a zero reading is not overflow', () => {
    renderGroup({ secondary: secondary(5) })
    expect(desktop()?.querySelectorAll('[data-variant="default"]').length).toBe(5)
    expect(desktop()?.textContent).not.toContain('More')
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

/**
 * `BarActionSlot` — the shared renderer behind law C15's widened `actions` slots (`Section`,
 * `BasaltDataTable`). The union has no discriminant, so the two things worth pinning are that the
 * runtime test tells DATA from a NODE correctly, and that the data arm gets the real projection
 * (the C7 fold and the mobile kebab) rather than a hand-rolled row.
 */
describe('BarActionSlot — the SlotActions union', () => {
  test('isBarActionList reads a BarAction[] as data and everything else as a node', () => {
    expect(isBarActionList([{ key: 'a', label: 'A' }])).toBe(true)
    expect(isBarActionList([{ key: 'm', kind: 'menu', label: 'M', items: [] }])).toBe(true)
    // A React element carries `key` too, which is exactly why `isValidElement` is the separator.
    expect(isBarActionList(<button key="a">A</button>)).toBe(false)
    expect(isBarActionList([<button key="a">A</button>, <button key="b">B</button>])).toBe(false)
    expect(isBarActionList('Export')).toBe(false)
    expect(isBarActionList(undefined)).toBe(false)
    // An empty array is DATA — a `.filter()` that matched nothing — and the data path renders
    // nothing for it, so both arms paint the same pixels down one branch.
    expect(isBarActionList([])).toBe(true)
  })

  test('an empty data array renders nothing at all — no group, no kebab', () => {
    const { container } = render(
      <MantineProvider>
        <BarActionSlot actions={[]} />
      </MantineProvider>,
    )
    expect(container.querySelector('.mantine-visible-from-sm')).toBeNull()
    expect(container.querySelector('.mantine-hidden-from-sm')).toBeNull()
    expect(container.querySelector('button')).toBeNull()
  })

  test('the node arm renders verbatim — no group, no fold', () => {
    render(
      <MantineProvider>
        <BarActionSlot actions={<button type="button">Export</button>} />
      </MantineProvider>,
    )
    expect(screen.getByRole('button', { name: 'Export' })).toBeDefined()
    expect(document.querySelector('.mantine-visible-from-sm')).toBeNull()
  })

  test('the data arm renders its actions on the desktop group', () => {
    render(
      <MantineProvider>
        <BarActionSlot actions={secondary(2)} />
      </MantineProvider>,
    )
    const desktop = document.querySelector('.mantine-visible-from-sm')
    if (!desktop) throw new Error('expected the desktop group')
    expect(desktop.textContent).toContain('Second 0')
    expect(desktop.textContent).toContain('Second 1')
  })

  test('the data arm mounts the mobile kebab — the projection a ReactNode row never got', () => {
    render(
      <MantineProvider>
        <BarActionSlot actions={secondary(2)} />
      </MantineProvider>,
    )
    const mobile = document.querySelector('.mantine-hidden-from-sm')
    if (!mobile) throw new Error('expected the mobile group')
    expect(mobile.querySelector('[aria-label="More actions"]')).not.toBeNull()
  })
})

const item = (key: string, full: number, icon?: number) => ({ key, full, icon })

describe('planBarFold', () => {
  const base = { gap: 6, hasMenus: false }

  test('a row that fits folds nothing', () => {
    const items = [item('a', 90, 32), item('b', 90, 32)]
    expect(planBarFold({ ...base, room: 400, fixed: 100, items })).toEqual({})
  })

  test('folds from the last item back, icon-only first', () => {
    const items = [item('a', 90, 32), item('b', 90, 32), item('c', 90, 32)]
    // 100 + 3 x 96 = 388 overflows both rooms; c at icon width leaves 330, b and c leave 272.
    expect(planBarFold({ ...base, room: 350, fixed: 100, items })).toEqual({ c: 'icon' })
    expect(planBarFold({ ...base, room: 300, fixed: 100, items })).toEqual({ b: 'icon', c: 'icon' })
  })

  test('an icon-less item skips the icon step and goes straight to More', () => {
    const items = [item('a', 90, 32), item('b', 90)]
    expect(planBarFold({ ...base, room: 230, fixed: 100, items })).toEqual({
      a: 'icon',
      b: 'overflow',
    })
  })

  test('More reserves its own width once anything overflows', () => {
    const items = [item('a', 90), item('b', 90)]
    // fixed 100 + a 96 = 196 fits 200, but with More (86) it is 282 -> a overflows too.
    expect(planBarFold({ ...base, room: 200, fixed: 100, items })).toEqual({
      a: 'overflow',
      b: 'overflow',
    })
  })

  test('a menu action reserves More from the start', () => {
    const items = [item('a', 90, 32)]
    expect(planBarFold({ ...base, hasMenus: true, room: 250, fixed: 100, items })).toEqual({
      a: 'icon',
    })
  })
})

describe('planBarFold — edges', () => {
  const base = { gap: 6, hasMenus: false }

  test('no room at all pushes everything into More, icons first tried and abandoned', () => {
    const items = [item('a', 90, 32), item('b', 90)]
    expect(planBarFold({ ...base, room: 0, fixed: 0, items })).toEqual({
      a: 'overflow',
      b: 'overflow',
    })
    expect(planBarFold({ ...base, room: -40, fixed: 0, items })).toEqual({
      a: 'overflow',
      b: 'overflow',
    })
  })

  test('no items and no menus is nothing to fold, whatever the room', () => {
    expect(planBarFold({ ...base, room: 0, fixed: 500, items: [] })).toEqual({})
  })

  test('only menus: nothing to fold even when More alone overflows the room', () => {
    expect(planBarFold({ ...base, hasMenus: true, room: 10, fixed: 0, items: [] })).toEqual({})
  })

  test('every item icon-less goes straight to More, last first', () => {
    const items = [item('a', 90), item('b', 90), item('c', 90)]
    // 3 x 96 = 288 overflows 250; c out leaves 192 + More 86 = 278, still over; b out leaves 96 + 86.
    expect(planBarFold({ ...base, room: 250, fixed: 0, items })).toEqual({
      c: 'overflow',
      b: 'overflow',
    })
  })

  test('a single item steps whole, then icon-only, then More as the room shrinks', () => {
    const items = [item('a', 90, 32)]
    expect(planBarFold({ ...base, room: 100, fixed: 0, items })).toEqual({})
    expect(planBarFold({ ...base, room: 60, fixed: 0, items })).toEqual({ a: 'icon' })
    expect(planBarFold({ ...base, room: 20, fixed: 0, items })).toEqual({ a: 'overflow' })
  })
})

/**
 * `useMeasuredFold` reaching the DOM. happy-dom does no layout, so the boxes are stubbed: a
 * labelled button is 10px per label character, an icon-only one (it carries an `aria-label`) 32px,
 * the row's own width is `ROW_ROOM`, and the row's one flow child spans every rendered action.
 */
describe('BarActionRow — the measured fold reaching the DOM', () => {
  const GAP = 6
  let room = 0
  const saved: [object, string, PropertyDescriptor | undefined][] = []
  const original = globalThis.ResizeObserver

  const stub = (target: object, key: string, descriptor: PropertyDescriptor): void => {
    saved.push([target, key, Object.getOwnPropertyDescriptor(target, key)])
    Object.defineProperty(target, key, { configurable: true, ...descriptor })
  }
  const widthOf = (el: Element): number =>
    el.hasAttribute('aria-label') ? 32 : (el.textContent?.length ?? 0) * 10

  beforeEach(() => {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver
    stub(HTMLElement.prototype, 'offsetWidth', {
      get(this: HTMLElement) {
        return this.hasAttribute(BAR_KEY_ATTR) ? widthOf(this) : 0
      },
    })
    stub(HTMLElement.prototype, 'offsetHeight', {
      get(this: HTMLElement) {
        return this.hasAttribute(BAR_KEY_ATTR) ? 32 : 0
      },
    })
    stub(HTMLElement.prototype, 'clientWidth', {
      get(this: HTMLElement) {
        return this.hasAttribute(PAGE_BAR_END_ATTR) ? room : 0
      },
    })
    stub(Element.prototype, 'getBoundingClientRect', {
      value(this: Element) {
        const inRow = this.parentElement?.hasAttribute(PAGE_BAR_END_ATTR) === true
        const right = inRow
          ? Array.from(this.querySelectorAll(`[${BAR_KEY_ATTR}]`)).reduce(
              (sum, el) => sum + widthOf(el) + GAP,
              0,
            )
          : 0
        return { left: 0, right, width: right, top: 0, bottom: 0, height: 0, x: 0, y: 0 }
      },
    })
  })

  afterEach(() => {
    globalThis.ResizeObserver = original
    for (const [target, key, descriptor] of saved.reverse()) {
      if (descriptor) Object.defineProperty(target, key, descriptor)
      else Reflect.deleteProperty(target, key)
    }
    saved.length = 0
  })

  const glyph = <svg data-testid="glyph" />
  const actions = (labels: string[], icons: boolean): BarAction[] =>
    labels.map((label, i) => ({
      key: `k${i}`,
      label,
      ...(icons && { icon: glyph }),
      onClick: () => {},
    }))
  const ui = (secondary: BarAction[]): ReactNode => (
    <MantineProvider>
      <div {...{ [PAGE_BAR_END_ATTR]: '' }}>
        <BarActionRow host="page" secondary={secondary} />
      </div>
    </MantineProvider>
  )
  const barKeys = (): (string | null)[] =>
    Array.from(document.querySelectorAll(`[${BAR_KEY_ATTR}][class*="Group"], [${BAR_KEY_ATTR}]`))
      .filter((el) => el.closest('.mantine-visible-from-sm') !== null)
      .map((el) => el.getAttribute(BAR_KEY_ATTR))

  test('a row that overflows renders the tail icon-only, its label kept as the accessible name', () => {
    room = 250
    render(ui(actions(['AAAAAAAAAA', 'BBBBBBBBBB', 'CCCCCCCCCC'], true)))

    const c = document.querySelector(`[${BAR_KEY_ATTR}="k2"]`)
    expect(c?.getAttribute('aria-label')).toBe('CCCCCCCCCC')
    expect(document.querySelector(`[${BAR_KEY_ATTR}="k0"]`)?.hasAttribute('aria-label')).toBe(false)
    expect(document.querySelector(`[${BAR_KEY_ATTR}="k1"]`)?.hasAttribute('aria-label')).toBe(false)
  })

  test('icon-less items that overflow leave the row and land in More', async () => {
    room = 300
    render(ui(actions(['AAAAAAAAAA', 'BBBBBBBBBB', 'CCCCCCCCCC'], false)))

    expect(barKeys()).toEqual(['k0', 'k1'])
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    await waitFor(() => expect(screen.getByText('CCCCCCCCCC')).toBeDefined())
  })

  test('a row that fits renders whole with no More', () => {
    room = 400
    render(ui(actions(['AAAAAAAAAA', 'BBBBBBBBBB', 'CCCCCCCCCC'], false)))

    expect(barKeys()).toEqual(['k0', 'k1', 'k2'])
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull()
  })

  test('a shorter label on a folded action re-measures instead of trusting the stale width', () => {
    room = 250
    const { rerender } = render(ui(actions(['AAAAAAAAAA', 'BBBBBBBBBB', 'CCCCCCCCCC'], true)))
    expect(document.querySelector(`[${BAR_KEY_ATTR}="k2"]`)?.hasAttribute('aria-label')).toBe(true)

    rerender(ui(actions(['A', 'B', 'C'], true)))

    expect(document.querySelector(`[${BAR_KEY_ATTR}="k2"]`)?.hasAttribute('aria-label')).toBe(false)
  })

  test('an unmeasurable row (zero width) never folds', () => {
    room = 0
    render(ui(actions(['AAAAAAAAAA', 'BBBBBBBBBB', 'CCCCCCCCCC'], true)))

    expect(barKeys()).toEqual(['k0', 'k1', 'k2'])
    expect(document.querySelector('[aria-label="CCCCCCCCCC"]')).toBeNull()
  })
})
