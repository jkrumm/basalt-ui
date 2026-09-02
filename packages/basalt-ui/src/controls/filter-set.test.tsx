/**
 * `FilterSet`'s four owned behaviours (`docs/CONTROLS-SPEC.md` §2.1/§3), each asserted against real
 * children bound to a real `createSearchStore`: the DERIVED active count, `Reset all` reaching every
 * registered filter, the mobile `inline` budget, and the measured desktop fold.
 *
 * The fold is the one behaviour that needs the DOM stubbed rather than driven — happy-dom lays
 * nothing out, so `offsetWidth`/`clientWidth` are 0 for every element and the no-op
 * `ResizeObserver` from `tests/setup/dom.ts` never fires. Both are replaced here (restored in
 * `afterEach`), which is what lets the fold arithmetic be tested at all instead of only in a
 * browser.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReactNode } from 'react'
import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { field } from '../state'
import { createSearchStore } from '../router-tanstack/search-store'
import { FilterSet } from './filter-set'
import { SelectFilter } from './select-filter'
import { ToggleFilter } from './toggle-filter'

type Router = { state: { status: string; location: { search: unknown } } }

const store = createSearchStore({
  key: 'fs',
  fields: {
    currency: field.enum(['USD', 'EUR'], 'USD'),
    region: field.enum(['all', 'eu', 'us'], 'all'),
    tier: field.enum(['any', 'pro'], 'any'),
    errorsOnly: field.boolean(false),
  },
})

async function mountSet(entry: string, inline?: number): Promise<Router> {
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/dashboard',
    validateSearch: store.validateSearch,
    component: () => (
      <FilterSet {...(inline !== undefined && { inline })}>
        <SelectFilter field={store.field.currency} label="Currency" />
        <SelectFilter field={store.field.region} label="Region" />
        <SelectFilter field={store.field.tier} label="Tier" />
        <ToggleFilter field={store.field.errorsOnly} label="Errors only" />
      </FilterSet>
    ),
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([pageRoute]),
    history: createMemoryHistory({ initialEntries: [entry] }),
  })

  render(
    <MantineProvider>
      <RouterProvider router={router} />
    </MantineProvider>,
  )
  await waitFor(() => {
    expect(router.state.status).toBe('idle')
  })
  return router as unknown as Router
}

function slots(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-filter-slot]')]
}

function row(): HTMLElement {
  const node = document.querySelector<HTMLElement>('[data-filter-row]')
  if (node === null) throw new Error('no filter row rendered')
  return node
}

/** The stubbed layout: every element's width is whatever the test wrote to `data-test-width`. */
function widthFromData(this: HTMLElement): number {
  return Number(this.dataset['testWidth'] ?? '0')
}

beforeEach(() => {
  localStorage.clear()
})

describe('the active count is derived from the children, never passed', () => {
  test('no filter is off its default → the sheet pill states no count', async () => {
    await mountSet('/dashboard')
    expect(screen.getByRole('button', { name: 'Filters' })).toBeDefined()
  })

  test('two non-default fields on a deep link → Filters (2), with nothing told to FilterSet', async () => {
    await mountSet('/dashboard?currency=EUR&errorsOnly=true')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Filters (2)' })).toBeDefined()
    })
  })
})

describe('Reset all reaches every registered filter, including the folded and the inline ones', () => {
  test('one press writes every field back to its fallback', async () => {
    const router = await mountSet('/dashboard?currency=EUR&region=eu&errorsOnly=true')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Filters (3)' })).toBeDefined()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Filters (3)' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reset all', hidden: true }))
    })

    await waitFor(() => {
      const search = router.state.location.search as Record<string, unknown>
      expect(search['currency']).toBe('USD')
      expect(search['region']).toBe('all')
      expect(search['errorsOnly']).toBe(false)
    })
    expect(screen.getByRole('button', { name: 'Filters' })).toBeDefined()
  })
})

describe('the mobile inline budget is per-slot data, not a second mount', () => {
  test('inline defaults to 1 — the first slot only', async () => {
    await mountSet('/dashboard')
    expect(slots().map((slot) => slot.hasAttribute('data-inline'))).toEqual([
      true,
      false,
      false,
      false,
    ])
  })

  test('inline={2} keeps the first two', async () => {
    await mountSet('/dashboard', 2)
    expect(slots().map((slot) => slot.hasAttribute('data-inline'))).toEqual([
      true,
      true,
      false,
      false,
    ])
  })

  test('every child stays mounted regardless of the budget — the row is the whole census', async () => {
    await mountSet('/dashboard')
    expect(slots()).toHaveLength(4)
  })
})

describe('the desktop fold is measured, and it never scrolls', () => {
  const offsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')
  const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
  let observers: (() => void)[] = []

  function stubLayout(): void {
    observers = []
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get: widthFromData,
    })
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: widthFromData,
    })
    class ResizeObserverStub {
      constructor(callback: () => void) {
        observers.push(callback)
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
  }

  afterEach(() => {
    if (offsetWidth !== undefined) {
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', offsetWidth)
    }
    if (clientWidth !== undefined) {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth)
    }
  })

  async function resizeTo(available: number, perSlot: number): Promise<void> {
    row().dataset['testWidth'] = String(available)
    for (const slot of slots()) slot.dataset['testWidth'] = String(perSlot)
    await act(async () => {
      for (const notify of observers) notify()
    })
  }

  test('four 100px pills in 250px: the tail folds into +3, and the row keeps one', async () => {
    stubLayout()
    await mountSet('/dashboard')
    await resizeTo(250, 100)

    expect(slots().map((slot) => slot.hasAttribute('data-folded'))).toEqual([
      false,
      true,
      true,
      true,
    ])
    const fold = screen.getByRole('button', { name: '3 more filters' })
    expect(fold.hasAttribute('data-shown')).toBe(true)
  })

  test('slots of DIFFERENT widths fold at the right index, not at a uniform one', async () => {
    // The uniform-100px case can be satisfied by arithmetic that ignores which slot is which. Here
    // the widths are 40/40/300/40: the wide third pill is what pushes the row over, so the fold has
    // to land at 2 rather than at some average-derived index.
    stubLayout()
    await mountSet('/dashboard')
    row().dataset['testWidth'] = '250'
    const widths = ['40', '40', '300', '40']
    slots().forEach((slot, index) => {
      slot.dataset['testWidth'] = widths[index] ?? '40'
    })
    await act(async () => {
      for (const notify of observers) notify()
    })

    expect(slots().map((slot) => slot.hasAttribute('data-folded'))).toEqual([
      false,
      false,
      true,
      true,
    ])
    expect(screen.getByRole('button', { name: '2 more filters' }).hasAttribute('data-shown')).toBe(
      true,
    )
  })

  test('the same four pills in 900px: nothing folds and the +N pill stays unshown', async () => {
    stubLayout()
    await mountSet('/dashboard')
    await resizeTo(900, 100)

    expect(slots().some((slot) => slot.hasAttribute('data-folded'))).toBe(false)
    expect(screen.getByRole('button', { name: '0 more filters' }).hasAttribute('data-shown')).toBe(
      false,
    )
  })
})

describe('a folded filter is still operable from inside the +N dropdown', () => {
  const offsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')
  const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')

  afterEach(() => {
    if (offsetWidth !== undefined) {
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', offsetWidth)
    }
    if (clientWidth !== undefined) {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth)
    }
  })

  test('opening +N and changing a folded field writes the URL, and +N stays open', async () => {
    // The regression this pins: rendering the fold body in PILL form gave each folded filter its own
    // `withinPortal` Popover, whose mousedown is outside the +N dropdown's `composedPath()` — so +N
    // closed, the pill unmounted, and the click never landed. The sheet form has no nested overlay.
    let observers: (() => void)[] = []
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get: widthFromData,
    })
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: widthFromData,
    })
    class ResizeObserverStub {
      constructor(callback: () => void) {
        observers.push(callback)
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver

    const router = await mountSet('/dashboard')
    row().dataset['testWidth'] = '250'
    for (const slot of slots()) slot.dataset['testWidth'] = '100'
    await act(async () => {
      for (const notify of observers) notify()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '3 more filters' }))
    })

    // The folded children render their sheet form — the same `PanelChoice` the panel surface
    // renders, no second pill. `radiogroup`, not `group`: past 1.28 the sheet form for a ≤3-option
    // enum is a `SegmentedControl` (`PanelChoice`), which carries Mantine's own `role="radiogroup"`
    // — the SAME role the popover's `Radio.Group` carries.
    const group = screen.getByRole('radiogroup', { name: 'Region', hidden: true })
    expect(group).toBeDefined()

    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: 'eu', hidden: true }))
    })

    await waitFor(() => {
      expect((router.state.location.search as Record<string, unknown>)['region']).toBe('eu')
    })
    // Still open: the write did not tear its own container down.
    expect(screen.getByRole('radiogroup', { name: 'Region', hidden: true })).toBeDefined()
    observers = []
  })
})

describe('the sheet names every control it holds', () => {
  test('the option lists and the Switch row carry the filter name, not the pill text', async () => {
    await mountSet('/dashboard?currency=EUR')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Filters (1)' }))
    })

    // `Currency`, not `EUR` — the pill reads the VALUE once set, which names the selection rather
    // than the filter. `radiogroup`, not `group`: each ≤3-option enum's sheet form is now the same
    // `PanelChoice` `SegmentedControl` the panel surface renders, and it carries Mantine's own
    // `role="radiogroup"`, pointed at its own visible `PanelRow` heading.
    for (const name of ['Currency', 'Region', 'Tier']) {
      expect(screen.getByRole('radiogroup', { name, hidden: true })).toBeDefined()
    }
    expect(screen.getByRole('switch', { name: 'Errors only', hidden: true })).toBeDefined()
  })
})

/**
 * The sheet form is the panel form (`docs/CONTROLS-SPEC.md` §3: "sheet = panel rows inside a
 * Drawer") — asserted at the SOURCE, since a `.module.css` import resolves to `undefined` under
 * `bun test` (so the emitted `class` attribute carries only Mantine's own names). What IS checkable
 * is that every filter capable of drawing a sheet row goes through `PanelRow`, and that the sheet's
 * own pre-1.28 row primitives (a `SheetOptionList` of 44px rows with a hairline between them) are
 * gone rather than left as dead, divergent code.
 */
describe('the sheet renders the panel row primitive, not its own list', () => {
  const filterFiles = [
    'enum-filter.tsx',
    'multi-select-filter.tsx',
    'number-filter.tsx',
    'range-filter.tsx',
    'search-filter.tsx',
    'toggle-filter.tsx',
  ]

  test('every filter with a sheet form imports PanelRow, not a deleted sheet-list primitive', () => {
    for (const file of filterFiles) {
      const source = readFileSync(join(import.meta.dir, file), 'utf8')
      expect(source).toContain('PanelRow')
      // The deleted names may still appear in a doc comment (recording what a rewrite replaced) —
      // what may NOT appear is a JSX usage of one.
      for (const deleted of ['SheetOptionList', 'SheetField', 'SheetDisclosure', 'SheetRow']) {
        expect(source).not.toContain(`<${deleted}`)
      }
      expect(source).not.toContain('sheetRowClassNames')
    }
  })

  test('the deleted sheet-list primitives no longer exist as exports or as stylesheet selectors', () => {
    const module = readFileSync(join(import.meta.dir, 'filter-sheet.tsx'), 'utf8')
    for (const deleted of ['SheetOptionList', 'SheetField', 'SheetDisclosure', 'SheetRow']) {
      expect(module).not.toContain(`export function ${deleted}`)
      expect(module).not.toContain(`export type ${deleted}`)
    }
    expect(module).not.toContain('export const sheetRowClassNames')
    const css = readFileSync(join(import.meta.dir, 'controls.module.css'), 'utf8')
    for (const selector of [
      '.sheetOption',
      '.sheetList',
      '.sheetField',
      '.sheetRow',
      '.sheetDisclosureBody',
      '.sheetLabel',
    ]) {
      expect(css.includes(`${selector} {`)).toBe(false)
    }
  })
})

describe('an empty home renders nothing (C14)', () => {
  test('no children → no row, so no route pays for a reserved bar', async () => {
    const rootRoute = createRootRoute({ component: () => <Outlet /> })
    const pageRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/dashboard',
      component: (): ReactNode => <FilterSet>{null}</FilterSet>,
    })
    const router = createRouter({
      routeTree: rootRoute.addChildren([pageRoute]),
      history: createMemoryHistory({ initialEntries: ['/dashboard'] }),
    })
    render(
      <MantineProvider>
        <RouterProvider router={router} />
      </MantineProvider>,
    )
    await waitFor(() => {
      expect(router.state.status).toBe('idle')
    })

    expect(document.querySelector('[data-filter-row]')).toBeNull()
  })
})

/**
 * The `Filters (n)` pill is the mobile SHEET TRIGGER, and the sheet only ever holds what the
 * `inline` budget folded away. With nothing folded it opens a drawer showing a copy of the pills
 * already on screen — while costing the mobile row the width of a pill to say so.
 */
describe('the mobile sheet trigger appears only when a child is folded', () => {
  async function mountOne(inline?: number): Promise<void> {
    const rootRoute = createRootRoute({ component: () => <Outlet /> })
    const pageRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/dashboard',
      validateSearch: store.validateSearch,
      component: (): ReactNode => (
        <FilterSet {...(inline !== undefined && { inline })}>
          <SelectFilter field={store.field.currency} label="Currency" />
        </FilterSet>
      ),
    })
    const router = createRouter({
      routeTree: rootRoute.addChildren([pageRoute]),
      history: createMemoryHistory({ initialEntries: ['/dashboard'] }),
    })
    render(
      <MantineProvider>
        <RouterProvider router={router} />
      </MantineProvider>,
    )
    await waitFor(() => {
      expect(router.state.status).toBe('idle')
    })
  }

  test('one child at the default budget → no Filters pill at all', async () => {
    await mountOne()
    expect(screen.queryByRole('button', { name: 'Filters' })).toBeNull()
    // …and the filter itself is still there, inline.
    expect(slots()).toHaveLength(1)
  })

  test('inline={0} folds that same child → the pill is back', async () => {
    await mountOne(0)
    expect(screen.getByRole('button', { name: 'Filters' })).toBeDefined()
  })

  test('four children at the default budget keep the pill', async () => {
    await mountSet('/dashboard')
    expect(screen.getByRole('button', { name: 'Filters' })).toBeDefined()
  })
})
