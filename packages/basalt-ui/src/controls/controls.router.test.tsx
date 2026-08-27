/**
 * Every control, bound to a REAL `createSearchStore` under a REAL memory-history router — the half
 * that cannot be tested headlessly. What each control reads on a deep link, what its pill says, and
 * what lands on the URL when it is operated (C2/C3: there is no `value`/`onChange` to stub, so
 * nothing here can pass against a control that only pretends to write).
 *
 * The harness is the one from `router-tanstack/search-store.router.test.tsx`, narrowed to one route
 * (the position questions are that file's job) and wrapped in a `MantineProvider`.
 */
import { beforeEach, describe, expect, test } from 'bun:test'
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
import { CompareFilter } from './compare-filter'
import { MultiSelectFilter } from './multi-select-filter'
import { RangeFilter } from './range-filter'
import type { RangeCustomPickerProps } from './range-filter'
import { SearchFilter } from './search-filter'
import { SelectFilter } from './select-filter'
import { ToggleFilter } from './toggle-filter'
import { ViewTabs } from './view-tabs'

type Router = { state: { status: string; location: { search: unknown } } }

async function mountPage(input: {
  validateSearch: (raw: Record<string, unknown>) => Record<string, unknown>
  entry: string
  Page: () => ReactNode
}): Promise<Router> {
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/dashboard',
    validateSearch: input.validateSearch,
    component: input.Page,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([pageRoute]),
    history: createMemoryHistory({ initialEntries: [input.entry] }),
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

function search(router: Router): Record<string, unknown> {
  return router.state.location.search as Record<string, unknown>
}

/**
 * Press a pill and let its popover mount. The `act` wrapper is load-bearing: Mantine's `Popover` is
 * a controlled surface behind a `Transition`, so the dropdown appears one flushed effect cycle after
 * the click — a bare `fireEvent.click` leaves the body holding the button and nothing else.
 *
 * Queries INSIDE a dropdown pass `{ hidden: true }`: the dropdown is a portal still carrying its
 * transition styles, which Testing Library reads as outside the accessibility tree. That is a
 * harness fact, not a claim about the control — where visibility IS the assertion (`ViewTabs`'
 * CSS swap below) the bare query is used deliberately.
 */
async function openPill(name: string | RegExp): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

/** A stand-in for `basalt-ui/controls-dates`' `DateRangePicker` — the injected-seam contract, and
 *  nothing else, so the range tests need no `@mantine/dates` at all. */
function Picker({ onChange }: RangeCustomPickerProps): ReactNode {
  return (
    <button
      type="button"
      onClick={() => {
        onChange({ from: '2026-03-01', to: '2026-03-14' })
      }}
    >
      pick march
    </button>
  )
}

beforeEach(() => {
  localStorage.clear()
})

describe('SelectFilter', () => {
  const store = createSearchStore({
    key: 'c-select',
    fields: { currency: field.enum(['USD', 'EUR'], 'USD') },
  })

  test('reads the filter name at its default and the option once set, and writes the URL', async () => {
    const router = await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <SelectFilter field={store.field.currency} label="Currency" />,
    })

    const pill = screen.getByRole('button', { name: 'Currency' })
    expect(pill.hasAttribute('data-active')).toBe(false)

    await openPill('Currency')
    fireEvent.click(screen.getByRole('radio', { name: 'EUR', hidden: true }))

    await waitFor(() => {
      expect(search(router)['currency']).toBe('EUR')
    })
    const active = screen.getByRole('button', { name: 'EUR' })
    expect(active.hasAttribute('data-active')).toBe(true)
  })

  test('the popover names the FILTER, not the value the pill happens to read', async () => {
    // Without this the dropdown announces 'EUR, radio button, 1 of 2' and never the word Currency:
    // the pill's visible text is the VALUE once set, so it cannot be the group's name.
    await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard?currency=EUR',
      Page: () => <SelectFilter field={store.field.currency} label="Currency" />,
    })
    await openPill('EUR')
    expect(screen.getByRole('radiogroup', { name: 'Currency', hidden: true })).toBeDefined()
  })

  test('a deep link is what the pill reads, with no interaction at all', async () => {
    await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard?currency=EUR',
      Page: () => <SelectFilter field={store.field.currency} label="Currency" />,
    })
    expect(screen.getByRole('button', { name: 'EUR' })).toBeDefined()
  })
})

describe('CompareFilter', () => {
  const store = createSearchStore({
    key: 'c-compare',
    fields: { compare: field.enum(['none', 'previous', 'year'], 'none') },
  }).labels({ compare: { none: 'No comparison', previous: 'Previous period', year: 'Last year' } })

  test('defaults its label to Compare and writes the chosen basis', async () => {
    const router = await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <CompareFilter field={store.field.compare} />,
    })

    await openPill('Compare')
    fireEvent.click(screen.getByRole('radio', { name: 'Previous period', hidden: true }))

    await waitFor(() => {
      expect(search(router)['compare']).toBe('previous')
    })
    expect(screen.getByRole('button', { name: 'Previous period' })).toBeDefined()
  })
})

describe('MultiSelectFilter', () => {
  const store = createSearchStore({
    key: 'c-multi',
    fields: { channels: field.multi(['web', 'email', 'social'], []) },
  })

  test('reads the label while the selection carries no information, then a count', async () => {
    const router = await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => (
        <MultiSelectFilter field={store.field.channels} label="All channels" noun="channels" />
      ),
    })

    expect(screen.getByRole('button', { name: 'All channels' })).toBeDefined()

    await openPill('All channels')
    fireEvent.click(screen.getByRole('checkbox', { name: 'web', hidden: true }))

    await waitFor(() => {
      expect(search(router)['channels']).toEqual(['web'])
    })
    expect(screen.getByRole('button', { name: '1 channels' })).toBeDefined()
  })

  test('every option selected is the same information as none — the label comes back', async () => {
    await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard?channels=web&channels=email&channels=social',
      Page: () => <MultiSelectFilter field={store.field.channels} label="All channels" />,
    })
    expect(screen.getByRole('button', { name: 'All channels' })).toBeDefined()
  })
})

describe('ToggleFilter', () => {
  const store = createSearchStore({
    key: 'c-toggle',
    fields: { errorsOnly: field.boolean(false) },
  })

  test('the pill IS the control — one press writes the field, no popover', async () => {
    const router = await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <ToggleFilter field={store.field.errorsOnly} label="Errors only" />,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Errors only' }))
    await waitFor(() => {
      expect(search(router)['errorsOnly']).toBe(true)
    })
    expect(screen.getByRole('button', { name: 'Errors only' }).hasAttribute('data-active')).toBe(
      true,
    )
  })

  test('the on/off state is announced, not only drawn as a border colour', async () => {
    const router = await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <ToggleFilter field={store.field.errorsOnly} label="Errors only" />,
    })

    expect(screen.getByRole('button', { name: 'Errors only', pressed: false })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Errors only' }))
    await waitFor(() => {
      expect(search(router)['errorsOnly']).toBe(true)
    })
    expect(screen.getByRole('button', { name: 'Errors only', pressed: true })).toBeDefined()
  })
})

describe('RangeFilter', () => {
  const store = createSearchStore({
    key: 'c-range',
    fields: {
      range: field.range({ presets: ['7d', '30d', '90d'], fallback: '30d', custom: true }),
    },
  })

  test('the pill reads the preset label and a press writes the preset param', async () => {
    const router = await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <RangeFilter field={store.field.range} customPicker={Picker} />,
    })

    expect(screen.getByRole('button', { name: '30d' })).toBeDefined()

    await openPill('30d')
    fireEvent.click(screen.getByRole('radio', { name: '7d', hidden: true }))

    await waitFor(() => {
      expect(search(router)['range']).toBe('7d')
    })
  })

  test('the preset track carries the filter name — a radiogroup must not be anonymous', async () => {
    await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <RangeFilter field={store.field.range} label="Window" />,
    })
    await openPill('30d')
    expect(screen.getByRole('radiogroup', { name: 'Window', hidden: true })).toBeDefined()
  })

  test('numeric preset labels get the mono treatment via data-numeric', async () => {
    await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <RangeFilter field={store.field.range} />,
    })
    expect(screen.getByRole('button', { name: '30d' }).hasAttribute('data-numeric')).toBe(true)
  })

  test('the injected picker writes preset=custom plus both ISO dates, and the pill reads the span', async () => {
    const router = await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <RangeFilter field={store.field.range} customPicker={Picker} />,
    })

    await openPill('30d')
    fireEvent.click(screen.getByRole('button', { name: 'pick march', hidden: true }))

    await waitFor(() => {
      expect(search(router)['range']).toBe('custom')
    })
    expect(search(router)['from']).toBe('2026-03-01')
    expect(search(router)['to']).toBe('2026-03-14')
    expect(screen.getByRole('button', { name: /Mar 1/ }).textContent).toContain('Mar 1 – Mar 14')
  })

  test('no picker is injected → no custom affordance, presets only', async () => {
    await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <RangeFilter field={store.field.range} />,
    })
    await openPill('30d')
    expect(screen.queryByRole('button', { name: 'pick march', hidden: true })).toBeNull()
    expect(screen.queryByRole('radio', { name: 'custom', hidden: true })).toBeNull()
  })
})

describe('SearchFilter', () => {
  const store = createSearchStore({
    key: 'c-search',
    fields: { q: field.string({ max: 40 }) },
  })

  test('keystrokes land on the field only after the debounce', async () => {
    const router = await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <SearchFilter field={store.field.q} placeholder="Search" />,
    })

    fireEvent.change(screen.getByPlaceholderText('Search'), { target: { value: 'invo' } })
    // Same tick: the box shows it, the URL does not.
    expect((screen.getByPlaceholderText('Search') as HTMLInputElement).value).toBe('invo')
    expect(search(router)['q']).toBe('')

    await waitFor(() => {
      expect(search(router)['q']).toBe('invo')
    })
  })

  test('the box is named even with no placeholder — and stays named while typing', async () => {
    await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <SearchFilter field={store.field.q} />,
    })
    expect(screen.getByRole('textbox', { name: 'Search' })).toBeDefined()
  })
})

/**
 * `ViewTabs` — the CSS swap, asserted rather than assumed. `MantineProvider` injects the
 * `visible-from`/`hidden-from` media rules as a real stylesheet, and happy-dom evaluates them at its
 * default (desktop) viewport — so the DESKTOP form is in the accessibility tree and the phone form is
 * `display: none`. `{ hidden: true }` counts what is MOUNTED, the bare query counts what is
 * REACHABLE, and the pair is what proves "one mount each, switched by CSS" (C9).
 */
describe('ViewTabs', () => {
  test('three options or fewer: both forms are tracks, one mounted each, only one reachable', async () => {
    const store = createSearchStore({
      key: 'c-tabs-3',
      fields: { tab: field.enum(['a', 'b', 'c'], 'a') },
    })
    const router = await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <ViewTabs field={store.field.tab} />,
    })

    expect(screen.getAllByRole('radio', { name: 'b', hidden: true })).toHaveLength(2)
    expect(screen.getAllByRole('radio', { name: 'b' })).toHaveLength(1)
    expect(screen.queryByRole('combobox', { hidden: true })).toBeNull()

    fireEvent.click(screen.getByRole('radio', { name: 'b' }))
    await waitFor(() => {
      expect(search(router)['tab']).toBe('b')
    })
  })

  test('past three options the phone form becomes a Select, not a track', async () => {
    const store = createSearchStore({
      key: 'c-tabs-4',
      fields: { tab: field.enum(['a', 'b', 'c', 'd'], 'a') },
    })
    await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <ViewTabs field={store.field.tab} />,
    })

    expect(screen.getAllByRole('radio', { name: 'b', hidden: true })).toHaveLength(1)
    expect(screen.getByRole('combobox', { hidden: true })).toBeDefined()
  })

  test('both forms carry an accessible name — neither is an anonymous radiogroup/combobox', async () => {
    const store = createSearchStore({
      key: 'c-tabs-named',
      fields: { tab: field.enum(['a', 'b', 'c', 'd'], 'a') },
    })
    await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <ViewTabs field={store.field.tab} label="Section" />,
    })

    expect(screen.getByRole('radiogroup', { name: 'Section', hidden: true })).toBeDefined()
    expect(screen.getByRole('combobox', { name: 'Section', hidden: true })).toBeDefined()
  })

  test("the name defaults to 'View' rather than being absent", async () => {
    const store = createSearchStore({
      key: 'c-tabs-default-name',
      fields: { tab: field.enum(['a', 'b'], 'a') },
    })
    await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <ViewTabs field={store.field.tab} />,
    })
    // Read off the attribute rather than through the accessible-name query: the phone twin is
    // `display: none` on this viewport, and `dom-accessibility-api` declines to compute a name for a
    // hidden `radiogroup` — which would make the assertion pass for the wrong reason.
    const groups = screen.getAllByRole('radiogroup', { hidden: true })
    expect(groups).toHaveLength(2)
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual(['View', 'View'])
  })

  test("only: 'sm-down' keeps an option off the desktop form entirely", async () => {
    const store = createSearchStore({
      key: 'c-tabs-only',
      fields: { tab: field.enum(['overview', 'train'], 'overview') },
    })
    await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => (
        <ViewTabs
          field={store.field.tab}
          options={[
            { value: 'overview', label: 'Overview' },
            { value: 'train', label: 'Train', only: 'sm-down' },
          ]}
        />
      ),
    })

    expect(screen.getAllByRole('radio', { name: 'Overview', hidden: true })).toHaveLength(2)
    expect(screen.getAllByRole('radio', { name: 'Train', hidden: true })).toHaveLength(1)
    // And the one that exists is the PHONE one — unreachable on this viewport.
    expect(screen.queryAllByRole('radio', { name: 'Train' })).toHaveLength(0)
  })
})
