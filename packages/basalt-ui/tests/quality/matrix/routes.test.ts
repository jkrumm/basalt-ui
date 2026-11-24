import { describe, expect, test } from 'bun:test'
import { appOf, expressionPaths, parseRoutes, routePaths, scenarioPaths } from './routes'

describe('parseRoutes', () => {
  test('unset or empty keeps every route', () => {
    expect(parseRoutes(undefined)).toBeNull()
    expect(parseRoutes('')).toBeNull()
  })

  test('names a route and a scenario', () => {
    expect([...(parseRoutes('/table, /scenarios/expr-n04, /scenarios') ?? [])]).toEqual([
      '/table',
      '/scenarios/expr-n04',
      '/scenarios',
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

  test('names the expression index and every scenario once, each served by its own app', () => {
    expect(expressionPaths()).toContain('/scenarios')
    expect(expressionPaths()).toContain('/scenarios/expr-n04')
    expect(appOf('/scenarios/expr-n04')).toBe('expression')
    expect(appOf('/scenarios')).toBe('expression')
    expect(appOf('/scenarios/mdx')).toBe('playground')
    expect(appOf('/table')).toBe('playground')
    // The expression app owns every expression scenario: the playground registers none.
    expect(scenarioPaths().filter((p) => p.startsWith('/scenarios/expr-')).length).toBe(
      expressionPaths().length - 1,
    )
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
