/**
 * Global controls in the shell header (concept 4.1): the slot renders in server HTML, a compact
 * `Filters (n)` sheet carries the same specs, a root `globalControls` and a leaf `PageBar controls`
 * draw together, a global write keeps the retained keys and an explicit `undefined` clears one, and
 * the renders are scoped to the control that changed. The router trap suites themselves stay with
 * `defineControls` (`router/controls/define.router.test.tsx`).
 */
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { memo } from 'react'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { PageBar } from '../page/page-bar'
import { Page } from '../page/page'
import { defineControls, resetControlsOwnersForTests } from '../router/controls/define'
import { field } from '../router/controls/field'
import { AppShell } from '../shell/app-shell'
import type { AppShellProps } from '../shell/contract'
import type { ControlsSlot } from '../core/ports'
import { globalControls } from './globals'
import { filterSlot } from './filter-slot'
import { spec } from './spec'
import { mountApp } from './view-tabs.test-support'

afterEach(() => {
  cleanup()
  resetControlsOwnersForTests()
})
beforeEach(resetControlsOwnersForTests)

const NAV = {
  sections: [
    {
      id: 'main',
      label: 'Main',
      items: [{ id: 'home', label: 'Overview', link: { to: '/p' }, mobile: 'tab' }],
    },
  ],
} satisfies AppShellProps['nav']

const stores = () => {
  const globals = defineControls({
    id: 'hdr-globals',
    scope: 'global',
    fields: {
      range: field
        .enum(['24h', '7d', '30d'], '24h')
        .labels({ '24h': 'Last 24 h', '7d': 'Last 7 days', '30d': 'Last 30 days' }),
      region: field.enum(['all', 'eu'], 'all').labels({ all: 'All regions', eu: 'EU' }),
    },
  })
  const overview = defineControls({
    id: 'hdr-overview',
    scope: 'page',
    fields: { q: field.string('') },
    widgets: { requests: { range: globals.field.range } },
  })
  return { globals, overview }
}

const shell = (slot: ControlsSlot) => (outlet: ReactElement) => (
  <AppShell nav={NAV} brand={{ name: 'Basalt' }} globalControls={slot}>
    {outlet}
  </AppShell>
)

describe('the header slot', () => {
  test('filterSlot renders the global in the header, in the server HTML', async () => {
    const { globals } = stores()
    const { app } = await mountApp({
      url: '/p?range=7d',
      globals,
      page: () => <Page>Body</Page>,
      layout: shell(filterSlot([spec(globals.field.range, 'Range')])),
    })
    const html = renderToString(app)
    const center = html.slice(html.indexOf('data-slot="shell-center"'))
    expect(center.slice(0, center.indexOf('data-slot="shell-end"'))).toContain('Last 7 days')
  })

  test('globalControls draws pills and, below md, a Filters (n) button, both in the server HTML', async () => {
    const { globals } = stores()
    const slot = globalControls([
      spec(globals.field.range, 'Range'),
      spec(globals.field.region, 'Region'),
    ])
    const { app } = await mountApp({
      url: '/p?range=30d',
      globals,
      page: () => <Page>Body</Page>,
      layout: shell(slot),
    })
    const html = renderToString(app)
    expect(html).toContain('data-slot="global-pills"')
    expect(html).toContain('Last 30 days')
    expect(html).toMatch(/data-slot="filter-count">Filters</)
  })

  test('the compact sheet holds the globals as row forms', async () => {
    const { globals } = stores()
    const slot = globalControls([
      spec(globals.field.range, 'Range'),
      spec(globals.field.region, 'Region'),
    ])
    const { app } = await mountApp({
      url: '/p?range=30d&region=eu',
      globals,
      page: () => <Page>Body</Page>,
      layout: shell(slot),
    })
    const { findByRole } = render(app)
    const trigger = await waitFor(() => {
      const el =
        document
          .querySelector('[data-slot="global-compact"] [data-slot="filter-count"]')
          ?.closest('button') ?? null
      if (el === null) throw new Error('no compact trigger')
      return el
    })
    expect(trigger.textContent?.startsWith('Filters')).toBe(true)
    fireEvent.click(trigger)
    const dialog = await findByRole('dialog')
    const sheet = dialog.querySelector('[data-slot="filter-sheet"]') as HTMLElement
    expect(sheet.querySelectorAll('[data-slot="control-view"]')).toHaveLength(2)
    expect(sheet.querySelector('[data-presentation="row"]')).not.toBeNull()
  })

  test('no specs, nothing drawn', async () => {
    expect(globalControls([]).render()).toBeNull()
    expect(globalControls([]).count).toBe(0)
  })

  test('a root globalControls and a leaf PageBar controls draw together', async () => {
    const { globals, overview } = stores()
    const slot = globalControls([spec(globals.field.range, 'Range')])
    const { app } = await mountApp({
      url: '/p',
      globals,
      store: overview,
      page: () => (
        <Page>
          <PageBar controls={filterSlot([spec(overview.field.q, 'Search')])} />
        </Page>
      ),
      layout: shell(slot),
    })
    render(app)
    await waitFor(() => expect(document.querySelector('[data-slot="shell-center"]')).not.toBeNull())
    const center = document.querySelector('[data-slot="shell-center"]') as HTMLElement
    expect(center.querySelector('[data-slot="global-pills"]')).not.toBeNull()
    expect(center.querySelector('[aria-label="Range"]')).not.toBeNull()
    expect(document.querySelector('input[aria-label="Search"]')).not.toBeNull()
    expect(center.querySelector('input[aria-label="Search"]')).toBeNull()
  })
})

describe('retained keys', () => {
  async function mountProbe(url: string) {
    const { globals, overview } = stores()
    const probe: { set?: (v: string) => void } = {}
    const Probe = (): ReactElement => {
      const [, set] = globals.field.range.use()
      probe.set = set as (v: string) => void
      return <i />
    }
    const mounted = await mountApp({
      url,
      globals,
      store: overview,
      page: () => <Probe />,
    })
    render(mounted.app)
    await waitFor(() => expect(probe.set).toBeDefined())
    return { ...mounted, globals, probe }
  }

  test('a global write on a deep link keeps the page keys of the link', async () => {
    const { router, probe } = await mountProbe('/p?query=boom&range=7d')
    await act(async () => {
      probe.set?.('30d')
    })
    await waitFor(() => expect(router.state.location.search['range']).toBe('30d'))
    expect(router.state.location.search['query']).toBe('boom')
  })

  test('a global survives a navigation that names no search', async () => {
    const { router } = await mountProbe('/p?range=7d')
    await act(async () => {
      await router.navigate({ to: '/p' })
    })
    expect(router.state.location.search['range']).toBe('7d')
  })

  test('an explicit undefined clears a retained key, and it stays cleared', async () => {
    const { router, globals } = await mountProbe('/p?range=7d')
    await act(async () => {
      globals.field.range.clear()
    })
    await waitFor(() => expect(router.state.location.search['range']).toBeUndefined())
    expect(router.state.location.href).not.toContain('range')
    await act(async () => {
      await router.navigate({ to: '/p' })
    })
    expect(router.state.location.href).not.toContain('range')
  })
})

describe.each([
  ['filterSlot', filterSlot],
  ['globalControls', globalControls],
] as const)('render counts through %s', (_name, makeSlot) => {
  test('a widget override re-renders neither the header pill nor a memoised sibling; global G re-renders only its pill', async () => {
    const { globals, overview } = stores()
    const uses = { range: 0, region: 0 }
    const counted = <H extends { useSource(): unknown }>(handle: H, name: keyof typeof uses): H =>
      Object.create(handle, {
        useSource: {
          value: () => {
            uses[name] += 1
            return handle.useSource()
          },
        },
      }) as H
    const slot = makeSlot([
      spec(counted(globals.field.range, 'range'), 'Range'),
      spec(counted(globals.field.region, 'region'), 'Region'),
    ])

    let siblingRenders = 0
    const Sibling = memo(function Sibling(): ReactElement {
      siblingRenders += 1
      return <b data-testid="sibling">sibling</b>
    })
    const probe: { setWidget?: (v: string) => void; setRegion?: (v: string) => void } = {}
    const Card = (): ReactElement => {
      const [, set] = overview.widget.requests.range.use()
      probe.setWidget = set as (v: string) => void
      return <Sibling />
    }
    const RegionProbe = (): ReactElement => {
      const [, set] = globals.field.region.use()
      probe.setRegion = set as (v: string) => void
      return <i />
    }
    const { app, router } = await mountApp({
      url: '/p',
      globals,
      store: overview,
      page: () => (
        <Page>
          <Card />
          <RegionProbe />
        </Page>
      ),
      layout: shell(slot),
    })
    render(app)
    await waitFor(() => expect(probe.setWidget).toBeDefined())
    await act(async () => {})
    const before = { ...uses, sibling: siblingRenders }

    await act(async () => {
      probe.setWidget?.('7d')
    })
    await waitFor(() => expect(router.state.location.search['w.requests.range']).toBe('7d'))
    expect(uses.range).toBe(before.range)
    expect(uses.region).toBe(before.region)
    expect(siblingRenders).toBe(before.sibling)

    const mid = { ...uses }
    await act(async () => {
      probe.setRegion?.('eu')
    })
    await waitFor(() => expect(router.state.location.search['region']).toBe('eu'))
    expect(uses.region).toBeGreaterThan(mid.region)
    expect(uses.range).toBe(mid.range)
  })
})
