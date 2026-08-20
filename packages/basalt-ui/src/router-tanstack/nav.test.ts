import { describe, expect, test } from 'bun:test'
import { defineNav, flattenNav, navGroup, navTarget } from './nav'

/**
 * The definition below is deliberately built with the real builders (not object literals) so the
 * runtime-identity assertions below prove the builders are erased at runtime — every bit of value
 * they add is compile-time. The type-level half of the contract lives in the playground's
 * `nav.type-guard.ts` fixture, which is where a registered router exists to validate `to` against.
 */
const NAV = defineNav({
  groups: [
    navGroup({ id: 'main', label: 'Main' }, [
      { id: 'dash', label: 'Dashboard', short: 'Home', mobile: 'tab', link: { to: '/dashboard' } },
      {
        id: 'reports',
        label: 'Reports',
        link: { to: '/reports' },
        children: [
          { id: 'reports-daily', label: 'Daily', link: { to: '/reports/daily' } },
          { id: 'reports-weekly', label: 'Weekly', link: { to: '/reports/weekly' } },
        ],
      },
    ]),
    navGroup({ id: 'system', label: 'System', collapsible: true }, [
      { id: 'usage', label: 'Usage', disabled: true, link: { to: '/usage', search: { r: '30d' } } },
    ]),
  ],
})

describe('defineNav / navGroup', () => {
  test('defineNav is runtime identity — it returns the very object it was given', () => {
    const config = { groups: [] } as const
    expect(defineNav(config)).toBe(config)
  })

  test('navGroup merges meta and items into one plain object, preserving item order', () => {
    const group = navGroup({ id: 'g', label: 'G', collapsible: true }, [
      { id: 'a', label: 'A', link: { to: '/a' } },
      { id: 'b', label: 'B', link: { to: '/b' } },
    ])
    expect(group).toEqual({
      id: 'g',
      label: 'G',
      collapsible: true,
      items: [
        { id: 'a', label: 'A', link: { to: '/a' } },
        { id: 'b', label: 'B', link: { to: '/b' } },
      ],
    })
  })

  test('navGroup does not mutate the meta object it was handed', () => {
    const meta = { id: 'g', label: 'G' }
    navGroup(meta, [{ id: 'a', label: 'A', link: { to: '/a' } }])
    expect(meta).toEqual({ id: 'g', label: 'G' })
  })
})

describe('flattenNav', () => {
  test('walks depth-first — parent immediately before its own children', () => {
    expect(flattenNav(NAV).map((d) => d.id)).toEqual([
      'dash',
      'reports',
      'reports-daily',
      'reports-weekly',
      'usage',
    ])
  })

  test('tags every destination — including nested children — with its declaring group', () => {
    const byId = new Map(flattenNav(NAV).map((d) => [d.id, d]))
    expect(byId.get('dash')).toMatchObject({ groupId: 'main', groupLabel: 'Main' })
    expect(byId.get('reports-weekly')).toMatchObject({ groupId: 'main', groupLabel: 'Main' })
    expect(byId.get('usage')).toMatchObject({ groupId: 'system', groupLabel: 'System' })
  })

  test('carries the authored metadata through untouched', () => {
    const dash = flattenNav(NAV)[0]
    expect(dash).toMatchObject({
      label: 'Dashboard',
      short: 'Home',
      mobile: 'tab',
      link: { to: '/dashboard' },
    })
  })

  test('an empty definition flattens to an empty list', () => {
    expect(flattenNav({ groups: [] })).toEqual([])
  })
})

describe('navTarget', () => {
  test('returns the destination link options by id', () => {
    expect(navTarget(NAV, 'dash')).toEqual({ to: '/dashboard' })
    expect(navTarget(NAV, 'usage')).toEqual({ to: '/usage', search: { r: '30d' } })
  })

  test('returns the SAME object the definition holds — spreadable with no copy', () => {
    expect(navTarget(NAV, 'dash')).toBe(NAV.groups[0].items[0].link)
  })

  test('resolves ids nested under a parent destination', () => {
    expect(navTarget(NAV, 'reports-weekly')).toEqual({ to: '/reports/weekly' })
  })

  test('throws a named error on an unknown id', () => {
    // The id union makes this a compile error for a consumer; the throw is the runtime backstop
    // for the untyped edge (a dynamic id, or an unregistered router degrading `NavItemId` away).
    expect(() => navTarget(NAV, 'zzz' as 'dash')).toThrow('navTarget: no nav item with id "zzz"')
  })
})
