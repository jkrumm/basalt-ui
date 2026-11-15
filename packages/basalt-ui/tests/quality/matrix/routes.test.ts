import { describe, expect, test } from 'bun:test'
import { routePaths } from './routes'

describe('routePaths', () => {
  test('reads the playground routes', () => {
    const paths = routePaths()
    expect(paths).toContain('/overview')
    expect(paths).toContain('/')
    expect(paths).toContain('/table')
  })

  test('skips the root route and maps the dynamic one to a concrete scenario', () => {
    const paths = routePaths()
    expect(paths.some((p) => p.includes('__root'))).toBe(false)
    expect(paths.some((p) => p.includes('$'))).toBe(false)
    expect(paths.some((p) => p.startsWith('/scenarios/'))).toBe(true)
  })
})
