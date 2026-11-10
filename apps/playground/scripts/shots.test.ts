import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { SHOTS, UsageError, parseArgs, plannedFiles, routeSlug, shotFileName } from './shots'

describe('routeSlug', () => {
  test('the root route is `root`', () => {
    expect(routeSlug('/')).toBe('root')
  })

  test('lowercases and joins segments with a single dash', () => {
    expect(routeSlug('/Scenarios/Kanban.Board/')).toBe('scenarios-kanban-board')
    expect(routeSlug('/cards')).toBe('cards')
  })
})

describe('shotFileName', () => {
  test('is <slug>--<scheme>--<width>x<height>.png', () => {
    expect(shotFileName('/', { scheme: 'light', viewport: { width: 1800, height: 1200 } })).toBe(
      'root--light--1800x1200.png',
    )
    expect(shotFileName('/cards', { scheme: 'dark', viewport: { width: 390, height: 844 } })).toBe(
      'cards--dark--390x844.png',
    )
  })
})

describe('plannedFiles', () => {
  test('the root route yields the four contract names', () => {
    expect(plannedFiles(['/']).toSorted()).toEqual([
      'root--dark--1800x1200.png',
      'root--dark--390x844.png',
      'root--light--1800x1200.png',
      'root--light--390x844.png',
    ])
  })

  test('is routes x schemes x viewports, with no repeated name', () => {
    const files = plannedFiles(['/', '/cards', '/table'])
    expect(files).toHaveLength(3 * SHOTS.length)
    expect(new Set(files).size).toBe(files.length)
  })
})

describe('parseArgs', () => {
  test('collects routes and applies the defaults', () => {
    const args = parseArgs(['/', '/cards'])
    expect(args.routes).toEqual(['/', '/cards'])
    expect(args.outDir.endsWith('/.evidence/v3-shots')).toBe(true)
    expect(args.distDir.endsWith('/apps/playground/dist')).toBe(true)
  })

  test('--out and --dist take a path, resolved', () => {
    const args = parseArgs(['--out', 'shots-here', '/', '--dist', 'some/dist'])
    expect(args.outDir).toBe(resolve('shots-here'))
    expect(args.distDir).toBe(resolve('some/dist'))
  })

  test.each([
    [[], 'at least one route'],
    [['cards'], 'must start with "/"'],
    [['--nope', '/'], 'unknown flag --nope'],
    [['/', '--out'], '--out needs a path'],
    [['/a-b', '/a/b'], 'collide'],
  ])('%j is a usage error', (argv, message) => {
    expect(() => parseArgs(argv)).toThrow(UsageError)
    expect(() => parseArgs(argv)).toThrow(message)
  })
})
