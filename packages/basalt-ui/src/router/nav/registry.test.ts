import { describe, expect, test } from 'bun:test'
import { navDirection, navFor, registerNav } from './registry'
import { resolveActive } from './resolve-active'
import { defineNav } from '../../../tests/support/router-nav'

const A = defineNav({
  sections: [
    {
      id: 's',
      label: 'S',
      items: [
        { id: 'one', label: 'One', link: { to: '/one' } },
        {
          id: 'two',
          label: 'Two',
          link: { to: '/two' },
          children: [{ id: 'two-a', label: 'Two A', link: { to: '/two/a' } }],
        },
      ],
    },
  ],
  pinned: [{ id: 'settings', label: 'Settings', link: { to: '/settings' } }],
})
const B = defineNav({
  sections: [{ id: 'other', label: 'Other', items: [{ id: 'x', label: 'X', link: { to: '/x' } }] }],
})

describe('defineNav is pure', () => {
  test('returns the very object it was given and writes no module global', () => {
    const config = { sections: [] }
    expect(defineNav(config)).toBe(config)
  })

  test('two configs give independent resolvers', () => {
    expect(resolveActive(A, '/one').activeId).toBe('one')
    expect(resolveActive(B, '/one').activeId).toBeUndefined()
    expect(resolveActive(B, '/x').activeId).toBe('x')
    expect(resolveActive(A, '/x').activeId).toBeUndefined()
  })
})

describe('registerNav / navFor', () => {
  test('are keyed per router object, with no shared state between routers', () => {
    const r1 = {}
    const r2 = {}
    expect(navFor(r1)).toBeUndefined()
    registerNav(r1, A)
    registerNav(r2, B)
    expect(navFor(r1)).toBe(A)
    expect(navFor(r2)).toBe(B)
    registerNav(r1, B)
    expect(navFor(r1)).toBe(B)
    expect(navFor(r2)).toBe(B)
    expect(navFor({})).toBeUndefined()
  })
})

describe('navDirection', () => {
  test('follows the flattened nav order: sections, then pinned, parent before children', () => {
    expect(navDirection(A, '/one', '/two')).toBe('forward')
    expect(navDirection(A, '/two', '/one')).toBe('back')
    expect(navDirection(A, '/two', '/two/a')).toBe('forward')
    expect(navDirection(A, '/two/a', '/settings')).toBe('forward')
    expect(navDirection(A, '/settings', '/one')).toBe('back')
  })

  test('is undefined when either side is unresolved or both land on the same item', () => {
    expect(navDirection(A, '/one', '/nowhere')).toBeUndefined()
    expect(navDirection(A, '/nowhere', '/one')).toBeUndefined()
    expect(navDirection(A, '/one', '/one')).toBeUndefined()
    expect(navDirection(A, '/two/zzz', '/two')).toBeUndefined()
  })
})
