/**
 * Every control, bound to a REAL `createSearchStore` under a REAL memory-history router — the half
 * that cannot be tested headlessly. What each control reads on a deep link, what its pill says, and
 * what lands on the URL when it is operated (C2/C3: there is no `value`/`onChange` to stub, so
 * nothing here can pass against a control that only pretends to write).
 *
 * The harness is the one from `router-tanstack/search-store.router.test.tsx`, narrowed to one route
 * (the position questions are that file's job) and wrapped in a `MantineProvider`.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
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
import { COMPARE_LABELS, COMPARE_VALUES, CompareFilter } from './compare-filter'
import { FilterSetScope } from './filter-context'
import { FilterSet } from './filter-set'
import { MultiSelectFilter } from './multi-select-filter'
import { NumberFilter } from './number-filter'
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

  test('reads the SELECTED option at the fallback too, and writes the URL', async () => {
    // The pill is a READOUT, so it prints the value at every value — including the field's default.
    // It used to print the filter's NAME while `isDefault` held, which is how the playground's bar
    // read `Compare` over a field holding `'previous'`. `data-active` is the channel that says
    // "touched", and it is still the only one.
    const router = await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <SelectFilter field={store.field.currency} label="Currency" />,
    })

    const pill = screen.getByRole('button', { name: 'USD' })
    expect(pill.hasAttribute('data-active')).toBe(false)
    expect(screen.queryByRole('button', { name: 'Currency' })).toBeNull()

    await openPill('USD')
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

/**
 * Every reset a control owns — the `FilterSet` registration and the popover's own `Clear` — calls
 * `field.clear()`, never `setValue(field.fallback)`.
 *
 * On the URL lane the two look identical (`clear()` navigates back to the fallback params, so the
 * search object reads the same either way) and they differ in the MIRROR: writing the fallback
 * PERSISTS it, as if the user had chosen the default, which then outranks a later change to the
 * field's own default and pins a thunk fallback outright. Clearing removes the key.
 */
describe('a control resets by CLEARING its field, never by writing the fallback back', () => {
  const store = createSearchStore({
    key: 'c-reset-clear',
    fields: {
      currency: field.enum(['USD', 'EUR'], 'USD'),
      // A SECOND child, so one folds on mobile and `FilterSet` renders the sheet that owns
      // `Reset all` at all — with a single child there is nothing to fold and no sheet.
      region: field.enum(['all', 'eu'], 'all'),
    },
  })

  /** Did the mirror keep a value for `currency`? */
  function mirrored(): boolean {
    return Object.hasOwn(store.readStored(), 'currency')
  }

  test("Reset all drops the mirror key and leaves the URL on the field's fallback", async () => {
    const router = await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => (
        <FilterSet>
          <SelectFilter field={store.field.currency} label="Currency" />
          <SelectFilter field={store.field.region} label="Region" />
        </FilterSet>
      ),
    })

    await openPill('USD')
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: 'EUR', hidden: true }))
    })
    await waitFor(() => {
      expect(search(router)['currency']).toBe('EUR')
    })
    // The write persisted it — which is what makes the reset's effect on the mirror observable.
    expect(mirrored()).toBe(true)

    // `hidden: true` — the currency popover is still open, and its portal leaves the rest of the
    // document out of the accessibility tree (the same harness fact every in-dropdown query here
    // carries). The count is registry state, so it lands a flush after the write.
    const sheetPill = await waitFor(() =>
      screen.getByRole('button', { name: 'Filters (1)', hidden: true }),
    )
    await act(async () => {
      fireEvent.click(sheetPill)
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reset all', hidden: true }))
    })

    await waitFor(() => {
      expect(search(router)['currency']).toBe('USD')
    })
    expect(mirrored()).toBe(false)
  })

  test("the popover's own Clear action clears too", async () => {
    const router = await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <SelectFilter field={store.field.currency} label="Currency" clearable />,
    })

    await openPill('USD')
    fireEvent.click(screen.getByRole('radio', { name: 'EUR', hidden: true }))
    await waitFor(() => {
      expect(mirrored()).toBe(true)
    })

    await openPill('EUR')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Clear', hidden: true }))
    })

    await waitFor(() => {
      expect(search(router)['currency']).toBe('USD')
    })
    expect(mirrored()).toBe(false)
  })
})

/**
 * The runtime-catalogue shape: `options` overrides the field's own rows, and a `StringField` handle
 * becomes legal once it does. Both halves are asserted through a REAL `createSearchStore`, because
 * the string lane is where a hand-rolled `value`/`onChange` would look identical and write nothing.
 */
describe('SelectFilter — options as a runtime catalogue', () => {
  const store = createSearchStore({
    key: 'c-select-options',
    fields: { currency: field.enum(['USD', 'EUR'], 'USD'), projectId: field.string() },
  })

  const RATES = [
    { value: 'USD', label: 'USD · 1.00' },
    { value: 'EUR', label: 'EUR · 1.08' },
  ]
  const PROJECTS = [
    { value: 'argo', label: 'Argo' },
    { value: 'linewatch', label: 'Linewatch' },
    { value: 'retired', label: 'Retired app', disabled: true },
  ]

  test('the rows and their labels come from the prop, and the field is still what is written', async () => {
    const router = await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <SelectFilter field={store.field.currency} label="Currency" options={RATES} />,
    })

    // The pill reads the catalogue's label for the CURRENT value, fallback included — `USD · 1.00`,
    // never `Currency`.
    await openPill('USD · 1.00')
    // The override is whole, not a merge: the field's own bare `EUR` row is GONE, which is the
    // property a merge would silently break.
    expect(screen.queryByRole('radio', { name: 'EUR', hidden: true })).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'EUR · 1.08', hidden: true }))

    await waitFor(() => {
      expect(search(router)['currency']).toBe('EUR')
    })
    expect(screen.getByRole('button', { name: 'EUR · 1.08' })).toBeDefined()
  })

  test('a string field plus options round-trips an id no enum could have declared', async () => {
    const router = await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <SelectFilter field={store.field.projectId} label="Project" options={PROJECTS} />,
    })

    expect(screen.getByRole('button', { name: 'Project' })).toBeDefined()
    await openPill('Project')
    fireEvent.click(screen.getByRole('radio', { name: 'Argo', hidden: true }))

    await waitFor(() => {
      expect(search(router)['projectId']).toBe('argo')
    })
    expect(screen.getByRole('button', { name: 'Argo' })).toBeDefined()
  })

  test('a deep link into that id set is read with no interaction at all', async () => {
    await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard?projectId=linewatch',
      Page: () => <SelectFilter field={store.field.projectId} label="Project" options={PROJECTS} />,
    })
    expect(screen.getByRole('button', { name: 'Linewatch' })).toBeDefined()
  })

  test('a disabled catalogue row is offered and refused — it still labels the value it names', async () => {
    await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard?projectId=retired',
      Page: () => <SelectFilter field={store.field.projectId} label="Project" options={PROJECTS} />,
    })
    // A live catalogue cannot express "archived" by omitting the row — the URL may already point at
    // it, and a missing row would read as the filter's default.
    expect(screen.getByRole('button', { name: 'Retired app' })).toBeDefined()
    await openPill('Retired app')
    expect(
      screen.getByRole('radio', { name: 'Retired app', hidden: true }).hasAttribute('disabled'),
    ).toBe(true)
  })
})

describe('CompareFilter', () => {
  const store = createSearchStore({
    key: 'c-compare',
    fields: { compare: field.enum(['none', 'previous', 'year'], 'none') },
  }).labels({ compare: { none: 'No comparison', previous: 'Previous period', year: 'Last year' } })

  test('reads the selected basis at the fallback too, and writes the chosen one', async () => {
    const router = await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <CompareFilter field={store.field.compare} />,
    })

    // At the fallback the pill reads `No comparison`, not `Compare` — the exact regression the
    // playground's bar showed, where the pill said `Compare` while the URL said `previous`.
    await openPill('No comparison')
    fireEvent.click(screen.getByRole('radio', { name: 'Previous period', hidden: true }))

    await waitFor(() => {
      expect(search(router)['compare']).toBe('previous')
    })
    expect(screen.getByRole('button', { name: 'Previous period' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Compare' })).toBeNull()
  })

  test('a consumer label wins over basalt’s default for the same value', async () => {
    // This store labels `year` as `Last year`. basalt's default is `Same period last year`; a
    // deliberate label is not something the framework overrides.
    await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard?compare=year',
      Page: () => <CompareFilter field={store.field.compare} />,
    })
    expect(screen.getByRole('button', { name: 'Last year' })).toBeDefined()
  })

  test('label= still names the POPOVER, which is the only thing it names now', async () => {
    await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <CompareFilter field={store.field.compare} />,
    })
    await openPill('No comparison')
    expect(screen.getByRole('radiogroup', { name: 'Compare', hidden: true })).toBeDefined()
  })
})

describe('CompareFilter — the three option labels are basalt’s, not each app’s', () => {
  // An UNLABELLED field: `field.enum` labels each option with the raw value until `store.labels()`
  // is called, so this popover used to read `none` / `previous` / `year` and every consumer wrote
  // the same three strings itself. `COMPARE_LABELS` is the default the control now supplies.
  const store = createSearchStore({
    key: 'c-compare-unlabelled',
    fields: { compare: field.enum(['none', 'previous', 'year'], 'none') },
  })

  test('an unlabelled field still renders the three spec’d strings', async () => {
    await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <CompareFilter field={store.field.compare} />,
    })

    expect(COMPARE_LABELS).toEqual({
      none: 'No comparison',
      previous: 'Previous period',
      year: 'Same period last year',
    })

    await openPill('No comparison')
    for (const value of COMPARE_VALUES) {
      expect(screen.getByRole('radio', { name: COMPARE_LABELS[value], hidden: true })).toBeDefined()
    }
    expect(screen.queryByRole('radio', { name: 'previous', hidden: true })).toBeNull()
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

  test("options relabels the boxes while the values stay the field's own", async () => {
    const router = await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => (
        <MultiSelectFilter
          field={store.field.channels}
          label="All channels"
          noun="channels"
          options={[
            { value: 'web', label: 'web · 1.2k' },
            { value: 'email', label: 'email · 340' },
          ]}
        />
      ),
    })

    await openPill('All channels')
    fireEvent.click(screen.getByRole('checkbox', { name: 'web · 1.2k', hidden: true }))

    await waitFor(() => {
      expect(search(router)['channels']).toEqual(['web'])
    })
    // Two rows shown, not the field's three — so `1 channels` is counted against what is offered.
    expect(screen.getByRole('button', { name: '1 channels' })).toBeDefined()
  })
})

/**
 * The facet row on the `panel`/`sheet` surface (`docs/CONTROLS-SPEC.md` §3, `multi-select-filter.tsx`'s
 * `FacetList`) — an uncounted row used to be plain text with no visible affordance that it toggles
 * at all (only `.facetCheck`'s mark appeared, and only once selected). `.mantine-CheckboxIndicator-
 * indicator` is Mantine's own static class for `Checkbox.Indicator`'s root (the same
 * `__staticSelector` convention `panel-row.test.tsx` reads off `SegmentedControl`'s label).
 */
describe('MultiSelectFilter — the facet row on the panel/sheet surface', () => {
  const store = createSearchStore({
    key: 'c-multi-facet',
    fields: { channels: field.multi(['web', 'email', 'social'], []) },
  })

  test('with no counts, every row draws a visible checkbox box — not only a mark once selected', async () => {
    await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => (
        <FilterSetScope surface="panel" registry={null}>
          <MultiSelectFilter field={store.field.channels} label="All channels" />
        </FilterSetScope>
      ),
    })

    // Three rows, three visible boxes — drawn whether or not the row is selected.
    expect(document.querySelectorAll('.mantine-CheckboxIndicator-indicator')).toHaveLength(3)

    const input = screen.getByRole('checkbox', { name: 'web' }) as HTMLInputElement
    expect(input.checked).toBe(false)
    fireEvent.click(input)
    await waitFor(() => {
      expect(input.checked).toBe(true)
    })
    // Still three boxes — selecting a row does not remove or replace its own.
    expect(document.querySelectorAll('.mantine-CheckboxIndicator-indicator')).toHaveLength(3)
  })

  test('with counts, the bar/count rendering stays — no checkbox box drawn', async () => {
    await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => (
        <FilterSetScope surface="panel" registry={null}>
          <MultiSelectFilter
            field={store.field.channels}
            label="All channels"
            counts={{ web: 12, email: 4, social: 1 }}
          />
        </FilterSetScope>
      ),
    })

    expect(document.querySelectorAll('.mantine-CheckboxIndicator-indicator')).toHaveLength(0)
    expect(screen.getByText('12')).toBeDefined()
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

  test('the pill never reads `label`, at the fallback or anywhere else', async () => {
    // Same law as `SelectFilter`/`CompareFilter`: `label` is the popover heading and the accessible
    // name, and the pill text is the value. `30d` here IS the fallback.
    await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <RangeFilter field={store.field.range} label="Window" customPicker={Picker} />,
    })
    expect(screen.getByRole('button', { name: '30d' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Window' })).toBeNull()
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

  /**
   * The `custom` disclosure is LOCAL state seeded from the field, so it has to re-sync when the
   * field moves under it. A `Reset all` or a `field.clear()` from anywhere else left the panel's
   * Select reading `Custom range…` with the calendar still open beneath it, over a field back on
   * `30d` — two controls disagreeing about one value, and only one of them right.
   */
  test('an external clear closes the custom picker on the panel surface', async () => {
    const router = await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard?range=custom&from=2026-03-01&to=2026-03-14',
      Page: () => (
        <>
          <FilterSetScope surface="panel" registry={null}>
            <RangeFilter field={store.field.range} label="Window" customPicker={Picker} />
          </FilterSetScope>
          <button
            type="button"
            onClick={() => {
              store.field.range.clear()
            }}
          >
            reset elsewhere
          </button>
        </>
      ),
    })

    expect(screen.getByRole('button', { name: 'pick march' })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'reset elsewhere' }))

    await waitFor(() => {
      expect(search(router)['range']).toBe('30d')
    })
    expect(screen.queryByRole('button', { name: 'pick march' })).toBeNull()
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

  describe('the phone form is fit-checked, not only count-checked', () => {
    // happy-dom lays nothing out (`offsetWidth`/`clientWidth` are 0 for every element), which
    // `useTrackFits` reads as `'unknown'` (not yet laid out) rather than "fits" — it is why every
    // OTHER ViewTabs test above sees a track within the count cap. The overflow case has to be
    // driven by hand: stub BOTH properties on `HTMLElement.prototype` (same technique
    // `panel-row.test.tsx` uses for `PanelChoice`'s copy of this same gate) to a confident,
    // uniform "does not fit" reading. Saved and restored via the ORIGINAL descriptor, never
    // `Reflect.deleteProperty` — deleting would remove the descriptor happy-dom itself installed
    // rather than reveal it, leaving both properties `undefined` for every test that runs after
    // this block in the same file (same pattern `filter-set.test.tsx` uses).
    const originalOffsetWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetWidth',
    )
    const originalClientWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'clientWidth',
    )

    afterEach(() => {
      if (originalOffsetWidth !== undefined) {
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth)
      }
      if (originalClientWidth !== undefined) {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth)
      }
    })

    test('three options within a phone label that overflows: falls back to Select, not a clipped track', async () => {
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        configurable: true,
        get: () => 200,
      })
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        get: () => 80,
      })
      const store = createSearchStore({
        key: 'c-tabs-3-overflow',
        fields: { tab: field.enum(['a', 'b', 'c'], 'a') },
      })
      await mountPage({
        validateSearch: store.validateSearch,
        entry: '/dashboard',
        Page: () => <ViewTabs field={store.field.tab} />,
      })

      // The phone form (`hidden: true` — below-`sm` reachability isn't what this asserts) is a
      // `combobox`, not a second `radiogroup`: within the count cap, the width gate alone decided.
      expect(screen.getAllByRole('radiogroup', { hidden: true })).toHaveLength(1)
      expect(screen.getByRole('combobox', { hidden: true })).toBeDefined()
    })
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

/**
 * `NumberFilter` — the numeric lane, and the one control whose two forms are genuinely different
 * components. `options` renders the same radio body every enum filter renders (through
 * `EnumFilter`'s `ChoiceHandle`), so what needs asserting there is that the URL still holds a
 * NUMBER; without `options` it is a stepper, and what needs asserting is WHEN a keystroke becomes a
 * navigation.
 */
describe('NumberFilter — the options form', () => {
  const store = createSearchStore({
    key: 'c-number-options',
    fields: { nights: field.number({ fallback: 2, min: 1, max: 14, int: true }) },
  })

  const NIGHTS = [
    { value: 1, label: '1 night' },
    { value: 2, label: '2 nights' },
    { value: 7, label: 'A week' },
  ]

  test('the pill reads the selected label and the URL keeps a NUMBER, not a numeral string', async () => {
    const router = await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <NumberFilter field={store.field.nights} label="Nights" options={NIGHTS} />,
    })

    const pill = screen.getByRole('button', { name: '2 nights' })
    expect(pill.hasAttribute('data-active')).toBe(false)
    // Mono, because the values ARE numbers — the same law a numeric SegmentedControl label follows.
    expect(pill.hasAttribute('data-numeric')).toBe(true)

    await openPill('2 nights')
    fireEvent.click(screen.getByRole('radio', { name: 'A week', hidden: true }))

    await waitFor(() => {
      // The whole reason this control exists: argo widened `nights` into a string enum and got
      // `'7'` in the URL, which makes every downstream comparison a parse.
      expect(search(router)['nights']).toBe(7)
    })
    expect(typeof search(router)['nights']).toBe('number')
    expect(screen.getByRole('button', { name: 'A week' }).hasAttribute('data-active')).toBe(true)
  })

  test('the popover names the FILTER — the pill text is the value', async () => {
    await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard?nights=7',
      Page: () => <NumberFilter field={store.field.nights} label="Nights" options={NIGHTS} />,
    })
    await openPill('A week')
    expect(screen.getByRole('radiogroup', { name: 'Nights', hidden: true })).toBeDefined()
  })

  test('a deep link is what the pill reads, with no interaction', async () => {
    await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard?nights=1',
      Page: () => <NumberFilter field={store.field.nights} label="Nights" options={NIGHTS} />,
    })
    expect(screen.getByRole('button', { name: '1 night' })).toBeDefined()
  })
})

describe('NumberFilter — the stepper form', () => {
  const store = createSearchStore({
    key: 'c-number-stepper',
    fields: { minDuration: field.number({ fallback: 0, min: 0, max: 600 }) },
  })

  function box(): HTMLInputElement {
    return screen.getByRole('textbox', { name: 'Min duration', hidden: true }) as HTMLInputElement
  }

  test('typing does not navigate; blur is what commits', async () => {
    const router = await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <NumberFilter field={store.field.minDuration} label="Min duration" step={30} />,
    })

    await openPill('0')
    fireEvent.change(box(), { target: { value: '120' } })
    // Same tick: the box shows it, the URL does not. An un-gated write would have navigated on
    // `1`, `12` and `120` — three loader runs for one intended threshold, two of them values the
    // user never meant.
    expect(box().value).toBe('120')
    expect(search(router)['minDuration']).toBe(0)

    fireEvent.blur(box())
    await waitFor(() => {
      expect(search(router)['minDuration']).toBe(120)
    })
  })

  test('Enter commits without leaving the field', async () => {
    const router = await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <NumberFilter field={store.field.minDuration} label="Min duration" />,
    })

    await openPill('0')
    fireEvent.change(box(), { target: { value: '45' } })
    fireEvent.keyDown(box(), { key: 'Enter' })
    await waitFor(() => {
      expect(search(router)['minDuration']).toBe(45)
    })
  })

  test('the field CLAMPS and the box follows it down — never a readout over a different URL', async () => {
    const router = await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <NumberFilter field={store.field.minDuration} label="Min duration" />,
    })

    await openPill('0')
    fireEvent.change(box(), { target: { value: '9999' } })
    fireEvent.blur(box())

    await waitFor(() => {
      expect(search(router)['minDuration']).toBe(600)
    })
    // The bound is the FIELD's, applied on write — so the input has to accept the correction rather
    // than keep displaying a value the app is not filtering by.
    await waitFor(() => {
      expect(box().value).toBe('600')
    })
  })

  /**
   * The SECOND out-of-range commit is the one that used to desync, and it desynced because nothing
   * moved: the store already held `600`, so the write clamped to the value it was already at, the
   * `[value]` effect never fired, and the box went on reading `8888` over a URL filtering at 600 —
   * the exact readout `useCommittedNumber` exists to prevent. `commit` now clamps locally first, so
   * the draft follows the bound whether or not the store value changes.
   */
  test('a REPEATED out-of-range Enter still leaves the box on the clamped value', async () => {
    const router = await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <NumberFilter field={store.field.minDuration} label="Min duration" />,
    })

    await openPill('0')
    fireEvent.change(box(), { target: { value: '9999' } })
    fireEvent.keyDown(box(), { key: 'Enter' })
    await waitFor(() => {
      expect(search(router)['minDuration']).toBe(600)
    })
    await waitFor(() => {
      expect(box().value).toBe('600')
    })

    // An intermediate in-range keystroke, then a second out-of-range one: react-number-format dedups
    // an identical string, so re-firing `9999` in happy-dom would not register as a change at all.
    // A real browser needs no such help — the digits arrive one keystroke at a time.
    fireEvent.change(box(), { target: { value: '500' } })
    fireEvent.change(box(), { target: { value: '8888' } })
    fireEvent.keyDown(box(), { key: 'Enter' })

    expect(box().value).toBe('600')
    expect(search(router)['minDuration']).toBe(600)
  })

  test('an unparseable draft restores the field rather than committing NaN', async () => {
    const router = await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard?minDuration=90',
      Page: () => <NumberFilter field={store.field.minDuration} label="Min duration" />,
    })

    await openPill('90')
    fireEvent.change(box(), { target: { value: '' } })
    fireEvent.blur(box())
    expect(box().value).toBe('90')
    expect(search(router)['minDuration']).toBe(90)
  })

  /**
   * The bounds now come off the HANDLE (`NumberHandleExtras`), so the STEPPER stops at the field's
   * limit instead of letting the codec correct the value one commit later. Asserted through the
   * arrow keys rather than a `min`/`max` DOM attribute: Mantine's `NumberInput` is a text input
   * (`inputmode=decimal`) and clamps in JS, so the attributes do not exist to read — the observable
   * is that stepping cannot leave the range.
   *
   * The clamp test above still stands. It is the backstop for a value that never came through this
   * box at all (a hand-typed URL, a stale deep link).
   */
  test('the field s min stops the stepper — no `min` prop reached the input before this', async () => {
    await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <NumberFilter field={store.field.minDuration} label="Min duration" step={30} />,
    })
    await openPill('0')
    // At the fallback 0 against `min: 0`. Without the handle's bound this would read `-30`, and a
    // negative threshold is a value the codec would then clamp back — visibly, after the fact.
    fireEvent.keyDown(box(), { key: 'ArrowDown' })
    expect(box().value).toBe(String(store.field.minDuration.min))
  })

  test('the field s max stops it at the other end', async () => {
    await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard?minDuration=590',
      Page: () => <NumberFilter field={store.field.minDuration} label="Min duration" step={30} />,
    })
    await openPill('590')
    // 590 + 30 would be 620; the field declares `max: 600`.
    fireEvent.keyDown(box(), { key: 'ArrowUp' })
    expect(box().value).toBe(String(store.field.minDuration.max))
  })

  test('the explicit step is the one the stepper uses', async () => {
    await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => <NumberFilter field={store.field.minDuration} label="Min duration" step={30} />,
    })
    await openPill('0')
    fireEvent.keyDown(box(), { key: 'ArrowUp' })
    expect(box().value).toBe('30')
  })

  test('an int field refuses a decimal and steps by 1 with no step prop at all', async () => {
    const ints = createSearchStore({
      key: 'c-number-int',
      fields: { nights: field.number({ fallback: 2, min: 1, max: 14, int: true }) },
    })
    const router = await mountPage({
      validateSearch: ints.validateSearch,
      entry: '/dashboard',
      Page: () => <NumberFilter field={ints.field.nights} label="Nights" />,
    })

    const input = () =>
      screen.getByRole('textbox', { name: 'Nights', hidden: true }) as HTMLInputElement
    await openPill('2')

    // `int` also picks the GRAIN: no `step` prop, and the field's own declaration produces 1.
    fireEvent.keyDown(input(), { key: 'ArrowUp' })
    expect(input().value).toBe('3')

    // `allowDecimal={false}` — Mantine drops the separator rather than accepting a value the codec
    // would decode to `null`, which would silently resurrect the fallback.
    fireEvent.change(input(), { target: { value: '3.5' } })
    expect(input().value).not.toContain('.')
    fireEvent.blur(input())
    await waitFor(() => {
      expect(Number.isInteger(search(router)['nights'])).toBe(true)
    })
  })

  test('the pill reads the value and marks itself active off the fallback', async () => {
    await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard?minDuration=90',
      Page: () => <NumberFilter field={store.field.minDuration} label="Min duration" />,
    })
    const pill = screen.getByRole('button', { name: '90' })
    expect(pill.hasAttribute('data-active')).toBe(true)
    expect(pill.hasAttribute('data-numeric')).toBe(true)
  })
})

/**
 * The SHEET form of both branches, through a real `FilterSet` — the surface is chosen by context,
 * never by a media query (C9), so this is the only way to reach it.
 */
describe('NumberFilter — the sheet form', () => {
  const store = createSearchStore({
    key: 'c-number-sheet',
    fields: {
      nights: field.number({ fallback: 2, min: 1, max: 14, int: true }),
      minDuration: field.number({ fallback: 0, min: 0, max: 600 }),
    },
  })

  async function openSheet(): Promise<void> {
    await mountPage({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Page: () => (
        <FilterSet>
          <NumberFilter
            field={store.field.nights}
            label="Nights"
            options={[
              { value: 1, label: '1 night' },
              { value: 2, label: '2 nights' },
            ]}
          />
          <NumberFilter field={store.field.minDuration} label="Min duration" />
        </FilterSet>
      ),
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
    })
  }

  test('the options form is a named choice, the stepper form a named input row', async () => {
    await openSheet()
    // The sheet form is the panel form (`docs/CONTROLS-SPEC.md` §3): a 2-option preset set is a
    // `PanelChoice` `SegmentedControl`, which carries Mantine's own `role="radiogroup"`, pointed at
    // its own visible `PanelRow` heading.
    expect(screen.getByRole('radiogroup', { name: 'Nights', hidden: true })).toBeDefined()
    // The stepper is the input itself in a `PanelRow` — no pill, no popover, one full-width row.
    // Exactly ONE input in the document: `FilterSet` keeps the bar-row copy of every child mounted
    // (hidden slots are `display: none`, never unmounted), but the bar copy is a PILL whose popover
    // is closed, so the only rendered box is the sheet's.
    expect(screen.getAllByRole('textbox', { name: 'Min duration', hidden: true })).toHaveLength(1)
  })

  test('a sheet edit writes the field immediately — there is no Apply', async () => {
    await openSheet()
    fireEvent.click(screen.getByRole('radio', { name: '1 night', hidden: true }))
    await waitFor(() => {
      expect(store.field.nights.isDefault(1)).toBe(false)
    })
  })
})
