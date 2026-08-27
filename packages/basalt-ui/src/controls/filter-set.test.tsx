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
import { field } from '../router-tanstack/field'
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

    // The folded children render their sheet form — a named radio group, no second pill.
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
  test('the radio groups and the Switch row carry the filter name, not the pill text', async () => {
    await mountSet('/dashboard?currency=EUR')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Filters (1)' }))
    })

    // `Currency`, not `EUR` — the pill reads the VALUE once set, which names the selection rather
    // than the filter. Each group points at its own visible SheetField heading.
    for (const name of ['Currency', 'Region', 'Tier']) {
      expect(screen.getByRole('radiogroup', { name, hidden: true })).toBeDefined()
    }
    expect(screen.getByRole('switch', { name: 'Errors only', hidden: true })).toBeDefined()
  })
})

/**
 * The 44px touch target, asserted at the SOURCE. Neither half is checkable in the DOM here:
 * happy-dom lays nothing out (so no bounding box), and a `.module.css` import resolves to `undefined`
 * under `bun test` (so the emitted `class` attribute carries only Mantine's own names). What IS
 * checkable is the pair that produces it — the CSS stretching the body and label to the row, and
 * every row-rendering control actually passing those classes. A row whose height sits on a
 * non-interactive wrapper is C15's number without C15's behaviour, which is the defect this pins.
 */
describe('sheet rows are tappable across their full height (C15)', () => {
  const css = readFileSync(join(import.meta.dir, 'controls.module.css'), 'utf8')

  function block(selector: string): string {
    const start = css.indexOf(`${selector} {`)
    expect(start).toBeGreaterThan(-1)
    return css.slice(start, css.indexOf('}', start))
  }

  test('.sheetRow pins the height to the sheet-row token, not a literal', () => {
    expect(block('.sheetRow')).toContain('var(--vx-space-sheet-row-height')
  })

  test('.sheetRowBody and .sheetRowLabel stretch the interactive element to that height', () => {
    for (const selector of ['.sheetRowBody', '.sheetRowLabel']) {
      const rule = block(selector)
      expect(rule).toContain('flex: 1')
      expect(rule).toContain('min-height: inherit')
    }
  })

  test('every control that renders a sheet row passes sheetRowClassNames', () => {
    for (const file of ['enum-filter.tsx', 'multi-select-filter.tsx', 'toggle-filter.tsx']) {
      const source = readFileSync(join(import.meta.dir, file), 'utf8')
      expect(source).toContain('sheetRowClassNames')
    }
  })

  test('no control wraps its sheet row in a plain div — the height must sit on the label', () => {
    // `SheetRow` puts `min-height` on a non-interactive wrapper, which is exactly the 20px-strip
    // defect. It stays exported for a future non-interactive row; no filter may use it.
    for (const file of ['enum-filter.tsx', 'multi-select-filter.tsx', 'toggle-filter.tsx']) {
      const source = readFileSync(join(import.meta.dir, file), 'utf8')
      expect(source).not.toContain('<SheetRow>')
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
