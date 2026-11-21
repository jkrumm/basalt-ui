import { describe, expect, test } from 'bun:test'
import { parseRoutes, routePaths, scenarioPaths } from './routes'

describe('parseRoutes', () => {
  test('unset or empty keeps every route', () => {
    expect(parseRoutes(undefined)).toBeNull()
    expect(parseRoutes('')).toBeNull()
  })

  test('names a route and a scenario', () => {
    expect([...(parseRoutes('/table, /scenarios/expr-n04') ?? [])]).toEqual([
      '/table',
      '/scenarios/expr-n04',
    ])
  })

  test('a path that is no route throws, so a typo cannot run an empty matrix', () => {
    expect(() => parseRoutes('/scenarios/expr-nope')).toThrow('names no route')
  })
})

describe('routePaths', () => {
  test('reads the playground routes', () => {
    const paths = routePaths()
    expect(paths).toContain('/overview')
    expect(paths).toContain('/')
    expect(paths).toContain('/table')
  })

  test('names every scenario once', () => {
    const paths = scenarioPaths()
    expect(paths).toContain('/scenarios/expr-n04')
    expect(new Set(paths).size).toBe(paths.length)
  })

  test('skips the root route and maps the dynamic one to a concrete scenario', () => {
    const paths = routePaths()
    expect(paths.some((p) => p.includes('__root'))).toBe(false)
    expect(paths.some((p) => p.includes('$'))).toBe(false)
    expect(paths.some((p) => p.startsWith('/scenarios/'))).toBe(true)
  })
})
