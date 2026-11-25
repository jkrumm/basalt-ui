/**
 * The trail against the playground's shapes: a flat tour, a forms group, a nav item with children,
 * a record route and a route that names itself through `staticData.title`.
 */
import { describe, expect, test } from 'bun:test'
import { buildCrumbs } from './crumbs'
import type { CrumbInput, CrumbNavEntry, CrumbNavItem, CrumbTrail } from './crumbs'

const item = (id: string, label: string, to: string, params?: object): CrumbNavItem => ({
  id,
  label,
  link: params === undefined ? { to } : { to, params },
})

const FLEET = item('fleet', 'Fleet', '/fleet')
const ENTRIES: CrumbNavEntry[] = [
  { item: item('home', 'Start', '/'), ancestors: [], section: 'Tour' },
  { item: item('parts', 'Parts', '/ref/parts'), ancestors: [], section: 'Tour' },
  {
    item: item('supplier', 'Supplier', '/ref/suppliers/$id', { id: 'sup-1' }),
    ancestors: [],
    section: 'Tour',
  },
  { item: FLEET, ancestors: [], section: 'Tour' },
  { item: item('services', 'Services', '/fleet/services'), ancestors: [FLEET], section: 'Tour' },
  {
    item: item('inputs', 'Inputs and states', '/kit/forms/inputs'),
    ancestors: [],
    section: 'Kit: Forms',
  },
  { item: item('run', 'Run', '/runs/$id'), ancestors: [], section: 'Runs' },
]

function trail(
  pathname: string,
  activeId: string | undefined,
  over: Partial<CrumbInput> = {},
): CrumbTrail {
  return buildCrumbs({
    entries: ENTRIES,
    activeId,
    pathname,
    routes: [],
    claim: undefined,
    fallbackLabel: ENTRIES.find((e) => e.item.id === activeId)?.item.label,
    compact: false,
    missing: false,
    ...over,
  })
}

const labels = (t: CrumbTrail): (string | undefined)[] => [
  t.section,
  ...t.ancestors.map((a) => a.label),
  t.leaf,
]

describe('buildCrumbs', () => {
  test('a top-level page is its section and its label', () => {
    expect(labels(trail('/ref/parts', 'parts'))).toEqual(['Tour', 'Parts'])
    expect(labels(trail('/kit/forms/inputs', 'inputs'))).toEqual([
      'Kit: Forms',
      'Inputs and states',
    ])
  })

  test('a route two levels under a nav item names every ancestor, each a link', () => {
    const t = trail('/fleet/services/checkout/logs', 'services', {
      routes: [{ pathname: '/fleet/services/checkout', title: 'checkout' }],
      claim: { title: 'Logs' },
    })
    expect(labels(t)).toEqual(['Tour', 'Fleet', 'Services', 'checkout', 'Logs'])
    expect(t.ancestors.map((a) => a.kind)).toEqual(['nav', 'nav', 'href'])
    const last = t.ancestors.at(-1)
    expect(last?.kind === 'href' && last.href).toBe('/fleet/services/checkout')
  })

  test('a record route ends on its record name, after the parent the page names', () => {
    const t = trail('/ref/suppliers/sup-1', 'supplier', {
      claim: {
        title: 'Brenner Verbindungstechnik',
        parent: { label: 'Parts', href: '/ref/parts' },
      },
    })
    expect(labels(t)).toEqual(['Tour', 'Parts', 'Brenner Verbindungstechnik'])
  })

  test('a parent the trail already names is not repeated', () => {
    const t = trail('/fleet/services/checkout', 'services', {
      claim: { title: 'checkout', parent: { label: 'Services', href: '/fleet/services' } },
    })
    expect(labels(t)).toEqual(['Tour', 'Fleet', 'Services', 'checkout'])
  })

  test('a parent that links where an ancestor does takes its place', () => {
    const t = trail('/fleet/services/checkout', 'services', {
      claim: { title: 'checkout', parent: { label: 'All services', href: '/fleet/services?q=' } },
    })
    expect(labels(t)).toEqual(['Tour', 'Fleet', 'All services', 'checkout'])
  })

  test('a nav item on a param route is concrete against the pathname', () => {
    const t = trail('/runs/7/logs', 'run', { claim: { title: 'Logs' } })
    expect(labels(t)).toEqual(['Runs', 'Run', 'Logs'])
    const run = t.ancestors[0]
    expect(run?.kind === 'nav' && run.item.id).toBe('run')
  })

  test('a compact screen keeps the nearest ancestor and the leaf', () => {
    const t = trail('/fleet/services/checkout', 'services', {
      claim: { title: 'checkout' },
      compact: true,
    })
    expect(labels(t)).toEqual([undefined, 'Services', 'checkout'])
  })

  test('a path no route matched is the leaf alone', () => {
    const t = trail('/fleet/nope', 'fleet', { missing: true, fallbackLabel: 'Not found' })
    expect(labels(t)).toEqual([undefined, 'Not found'])
  })
})
