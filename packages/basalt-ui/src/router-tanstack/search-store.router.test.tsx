/**
 * `createSearchStore` under a REAL router — the half that cannot be tested headlessly: what
 * `use()` reads on a deep link, whether a write navigates, and from where.
 *
 * A memory-history router with three routes covers the three positions a control can render in:
 * the route that validates the params, a CHILD of it (A3 — no `from`, the param still resolves),
 * and a sibling that knows nothing about the store (A1 — the write persists and does not navigate).
 */
import { beforeEach, describe, expect, spyOn, test } from 'bun:test'
import type { ReactNode } from 'react'
import { act, render, waitFor } from '@testing-library/react'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import type { AnyField, FieldHandle } from '../state'
import { field } from './field'
import { createSearchStore } from './search-store'

type Probe = { value: unknown; set: (next: unknown) => void }
type Sink = { current: Probe | null }

function sink(): Sink {
  return { current: null }
}

/** Renders nothing; publishes one field's `use()` result so a test can read and drive it. */
function fieldProbe<F extends AnyField>(handle: FieldHandle<F>, into: Sink) {
  return function FieldProbe(): ReactNode {
    const [value, set] = handle.use()
    into.current = { value, set: set as (next: unknown) => void }
    return null
  }
}

type AppInput = {
  validateSearch: (raw: Record<string, unknown>) => Record<string, unknown>
  entry: string
  Dashboard?: () => ReactNode
  Detail?: () => ReactNode
  Other?: () => ReactNode
}

const nothing = (): ReactNode => null

async function mountApp(input: AppInput) {
  const Dashboard = input.Dashboard ?? nothing
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const dashboardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/dashboard',
    validateSearch: input.validateSearch,
    component: () => (
      <>
        <Dashboard />
        <Outlet />
      </>
    ),
  })
  const detailRoute = createRoute({
    getParentRoute: () => dashboardRoute,
    path: 'detail',
    component: input.Detail ?? nothing,
  })
  const otherRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/other',
    component: input.Other ?? nothing,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([dashboardRoute.addChildren([detailRoute]), otherRoute]),
    history: createMemoryHistory({ initialEntries: [input.entry] }),
  })

  render(<RouterProvider router={router} />)
  await waitFor(() => {
    expect(router.state.status).toBe('idle')
  })
  return router
}

function currentSearch(router: {
  state: { location: { search: unknown } }
}): Record<string, unknown> {
  return router.state.location.search as Record<string, unknown>
}

/** The `{ fieldName: value }` record the store persisted under `basalt:<key>`. */
function storedRecord(key: string): Record<string, unknown> | null {
  const raw = localStorage.getItem(`basalt:${key}`)
  if (raw === null) return null
  return (JSON.parse(raw) as { value: Record<string, unknown> }).value
}

function persist(key: string, record: Record<string, unknown>): void {
  localStorage.setItem(`basalt:${key}`, JSON.stringify({ v: 1, value: record }))
}

beforeEach(() => {
  localStorage.clear()
})

describe('use() — reading', () => {
  test('a deep link WINS over the localStorage mirror (A8)', async () => {
    const store = createSearchStore({
      key: 'r-deeplink',
      fields: { range: field.enum(['1d', '7d', '30d'], '1d') },
    })
    persist('r-deeplink', { range: '30d' })
    const probe = sink()

    await mountApp({
      validateSearch: store.validateSearch,
      entry: '/dashboard?range=7d',
      Dashboard: fieldProbe(store.field.range, probe),
    })

    // The enum-only store read its localStorage hook here and rendered '30d' — a shared link
    // opened on the wrong window, and nothing said so.
    expect(probe.current?.value).toBe('7d')
  })

  test('falls through to the mirror when the URL carries no value', async () => {
    const store = createSearchStore({
      key: 'r-mirror',
      fields: { range: field.enum(['1d', '7d', '30d'], '1d') },
    })
    persist('r-mirror', { range: '30d' })
    const probe = sink()

    await mountApp({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Dashboard: fieldProbe(store.field.range, probe),
    })

    expect(probe.current?.value).toBe('30d')
  })

  test('falls through to the fallback when neither lane holds a value', async () => {
    const store = createSearchStore({
      key: 'r-fallback',
      fields: { range: field.enum(['1d', '7d'], '7d') },
    })
    const probe = sink()

    await mountApp({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Dashboard: fieldProbe(store.field.range, probe),
    })

    expect(probe.current?.value).toBe('7d')
  })

  test('a CHILD route reads the field with no `from` (A3)', async () => {
    const store = createSearchStore({
      key: 'r-child',
      fields: { range: field.enum(['1d', '7d'], '1d') },
    })
    const probe = sink()

    await mountApp({
      validateSearch: store.validateSearch,
      entry: '/dashboard/detail?range=7d',
      Detail: fieldProbe(store.field.range, probe),
    })

    expect(probe.current?.value).toBe('7d')
  })

  test('a range field reads all three params back as one value', async () => {
    const store = createSearchStore({
      key: 'r-range',
      fields: { range: field.range({ presets: ['7d', '30d'], fallback: '30d', custom: true }) },
    })
    const probe = sink()

    await mountApp({
      validateSearch: store.validateSearch,
      entry: '/dashboard?range=custom&from=2026-01-01&to=2026-02-01',
      Dashboard: fieldProbe(store.field.range, probe),
    })

    expect(probe.current?.value).toEqual({
      preset: 'custom',
      from: '2026-01-01',
      to: '2026-02-01',
    })
  })
})

describe('use() — writing', () => {
  test('a write from the owning route lands in the URL AND in the mirror', async () => {
    const store = createSearchStore({
      key: 'r-write',
      fields: { range: field.enum(['1d', '7d'], '7d') },
    })
    const probe = sink()

    const router = await mountApp({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Dashboard: fieldProbe(store.field.range, probe),
    })

    await act(async () => {
      probe.current?.set('1d')
    })

    await waitFor(() => {
      expect(currentSearch(router)['range']).toBe('1d')
    })
    expect(storedRecord('r-write')).toEqual({ range: '1d' })
    expect(probe.current?.value).toBe('1d')
  })

  test('a range write clears a stale from/to when the preset stops being custom', async () => {
    const store = createSearchStore({
      key: 'r-range-clear',
      fields: { range: field.range({ presets: ['7d', '30d'], fallback: '30d', custom: true }) },
    })
    const probe = sink()

    const router = await mountApp({
      validateSearch: store.validateSearch,
      entry: '/dashboard?range=custom&from=2026-01-01&to=2026-02-01',
      Dashboard: fieldProbe(store.field.range, probe),
    })

    await act(async () => {
      probe.current?.set({ preset: '7d' })
    })

    await waitFor(() => {
      expect(currentSearch(router)['range']).toBe('7d')
    })
    expect(currentSearch(router)['from']).toBeUndefined()
    expect(currentSearch(router)['to']).toBeUndefined()
  })

  test('a write from a FOREIGN route persists only — it never navigates (A1)', async () => {
    const store = createSearchStore({
      key: 'r-foreign',
      fields: { range: field.enum(['1d', '7d'], '7d') },
    })
    const probe = sink()

    const router = await mountApp({
      validateSearch: store.validateSearch,
      entry: '/other',
      Other: fieldProbe(store.field.range, probe),
    })

    await act(async () => {
      probe.current?.set('1d')
    })

    expect(router.state.location.pathname).toBe('/other')
    expect(currentSearch(router)['range']).toBeUndefined()
    // …and `validateSearch` picks it up on the next visit to the owning route.
    expect(storedRecord('r-foreign')).toEqual({ range: '1d' })
    expect(store.validateSearch({})).toEqual({ range: '1d' })
  })

  test('`persist: false` writes the URL and never touches storage', async () => {
    const store = createSearchStore({
      key: 'r-nopersist',
      fields: { page: field.number({ fallback: 1, int: true }, { persist: false }) },
    })
    const probe = sink()

    const router = await mountApp({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Dashboard: fieldProbe(store.field.page, probe),
    })

    await act(async () => {
      probe.current?.set(3)
    })

    await waitFor(() => {
      expect(currentSearch(router)['page']).toBe(3)
    })
    expect(storedRecord('r-nopersist')).toBeNull()
  })

  test('`url: false` writes storage and never touches the URL', async () => {
    const store = createSearchStore({
      key: 'r-nourl',
      fields: { compact: field.boolean(false, { url: false }) },
    })
    const probe = sink()

    const router = await mountApp({
      validateSearch: store.validateSearch,
      entry: '/dashboard',
      Dashboard: fieldProbe(store.field.compact, probe),
    })

    await act(async () => {
      probe.current?.set(true)
    })

    await waitFor(() => {
      expect(probe.current?.value).toBe(true)
    })
    expect(currentSearch(router)['compact']).toBeUndefined()
    expect(storedRecord('r-nourl')).toEqual({ compact: true })
  })
  test('a `persist: false` write from a foreign route is a silent no-op — so it warns in dev', async () => {
    const store = createSearchStore({
      key: 'r-nowhere',
      fields: { page: field.number({ fallback: 1, int: true }, { persist: false }) },
    })
    const probe = sink()
    const warn = spyOn(console, 'warn').mockImplementation(() => {})

    const router = await mountApp({
      validateSearch: store.validateSearch,
      entry: '/other',
      Other: fieldProbe(store.field.page, probe),
    })

    await act(async () => {
      probe.current?.set(3)
    })

    // No URL (this route validates no `page`), no mirror (the field opted out) — nothing happened.
    expect(router.state.location.pathname).toBe('/other')
    expect(currentSearch(router)['page']).toBeUndefined()
    expect(storedRecord('r-nowhere')).toBeNull()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('persist: false')

    // Once per field, not once per click.
    await act(async () => {
      probe.current?.set(4)
    })
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  test('a persisted field written from a foreign route does NOT warn — it has somewhere to go', async () => {
    const store = createSearchStore({
      key: 'r-nowhere-ok',
      fields: { range: field.enum(['1d', '7d'], '7d') },
    })
    const probe = sink()
    const warn = spyOn(console, 'warn').mockImplementation(() => {})

    await mountApp({
      validateSearch: store.validateSearch,
      entry: '/other',
      Other: fieldProbe(store.field.range, probe),
    })
    await act(async () => {
      probe.current?.set('1d')
    })

    expect(storedRecord('r-nowhere-ok')).toEqual({ range: '1d' })
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('store hooks', () => {
  test('useValues returns every URL-lane param, resolved', async () => {
    const store = createSearchStore({
      key: 'r-values',
      fields: {
        range: field.enum(['1d', '7d'], '1d'),
        compare: field.enum(['none', 'previous'], 'none'),
        compact: field.boolean(false, { url: false }),
      },
    })
    persist('r-values', { compare: 'previous', compact: true })
    const seen: { current: Record<string, unknown> | null } = { current: null }

    await mountApp({
      validateSearch: store.validateSearch,
      entry: '/dashboard?range=7d',
      Dashboard: () => {
        seen.current = store.useValues()
        return null
      },
    })

    expect(seen.current).toEqual({ range: '7d', compare: 'previous' })
  })

  test('useActiveCount counts the fields that differ from their fallback — both lanes', async () => {
    const store = createSearchStore({
      key: 'r-count',
      fields: {
        range: field.enum(['1d', '7d'], '1d'),
        compare: field.enum(['none', 'previous'], 'none'),
        compact: field.boolean(false, { url: false }),
      },
    })
    persist('r-count', { compact: true })
    let count = -1

    await mountApp({
      validateSearch: store.validateSearch,
      entry: '/dashboard?range=7d',
      Dashboard: () => {
        count = store.useActiveCount()
        return null
      },
    })

    // range (URL) + compact (local); compare is still its fallback.
    expect(count).toBe(2)
  })

  test('useReset returns every field to its fallback in ONE navigate call', async () => {
    const store = createSearchStore({
      key: 'r-reset',
      fields: {
        range: field.range({ presets: ['7d', '30d'], fallback: '30d', custom: true }),
        compare: field.enum(['none', 'previous'], 'none'),
        compact: field.boolean(false, { url: false }),
      },
    })
    persist('r-reset', { compact: true })
    let reset: (() => void) | null = null

    const router = await mountApp({
      validateSearch: store.validateSearch,
      entry: '/dashboard?range=custom&from=2026-01-01&to=2026-02-01&compare=previous',
      Dashboard: () => {
        reset = store.useReset()
        return null
      },
    })

    const navigate = spyOn(router, 'navigate')
    await act(async () => {
      reset?.()
    })

    expect(navigate).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(currentSearch(router)['range']).toBe('30d')
    })
    expect(currentSearch(router)['compare']).toBe('none')
    expect(currentSearch(router)['from']).toBeUndefined()
    expect(storedRecord('r-reset')).toEqual({
      range: { preset: '30d' },
      compare: 'none',
      compact: false,
    })
    navigate.mockRestore()
  })
})
