/**
 * The codec matrix (spike S8): every `number`, `boolean`, `range` and full-default `multi` sample is
 * written through its handle, the href is read back, and a FRESH router parses it under the same
 * parse config. Both configs run: Router's default JSON codec and shutterflow's string-only one.
 */
import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { act, render } from '@testing-library/react'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  defaultParseSearch,
  defaultStringifySearch,
  Outlet,
  parseSearchWith,
  RouterProvider,
  stringifySearchWith,
} from '@tanstack/react-router'
import { defineControls, field } from '../../../src/router'

const CONFIGS = {
  json: { parseSearch: defaultParseSearch, stringifySearch: defaultStringifySearch },
  'string-only': {
    parseSearch: parseSearchWith((v) => v),
    stringifySearch: stringifySearchWith((v) => String(v)),
  },
} as const

const EXERCISES = ['squat', 'bench', 'deadlift', 'row'] as const

// Page scope, mounted on the root route of the harness: page params never collide across files.
const gym = defineControls({
  id: 'ctl2-matrix',
  scope: 'page',
  fields: {
    weight: field.number({ fallback: 0, min: -50, max: 500 }),
    reps: field.number({ fallback: 5, min: 1, int: true }),
    done: field.boolean(true),
    compact: field.boolean(false),
    window: field.range({ presets: ['7d', '30d', '90d'], fallback: '30d', custom: true }),
    exercises: field.multi(EXERCISES, EXERCISES),
    levels: field.multi(['1', '2', '3'], []),
  },
})

type Handles = typeof gym.field
type Name = keyof Handles

type Loose = {
  load(): Promise<void>
  navigate(o: object): Promise<void>
  state: { location: { href: string; searchStr: string } }
}

const setters: Partial<Record<Name, (v: never) => void>> = {}

async function mount(config: keyof typeof CONFIGS, url: string, probe = false): Promise<Loose> {
  const root = createRootRoute({
    validateSearch: gym.validateSearch,
    search: { middlewares: gym.middlewares },
    component: () => {
      if (probe) {
        for (const name of Object.keys(gym.field) as Name[]) {
          setters[name] = gym.field[name].use()[1] as (v: never) => void
        }
      }
      return createElement(Outlet)
    },
  })
  const page = createRoute({ getParentRoute: () => root, path: '/p' })
  const create = createRouter as unknown as (o: object) => Loose
  const router = create({
    routeTree: root.addChildren([page]),
    history: createMemoryHistory({ initialEntries: [url] }),
    ...CONFIGS[config],
  })
  await router.load()
  if (probe) render(createElement(RouterProvider as never, { router }))
  return router
}

/** Writes `value` through the handle, then decodes the resulting href in a fresh router. */
async function roundTrip(config: keyof typeof CONFIGS, name: Name, value: unknown) {
  const writer = await mount(config, '/p', true)
  await act(async () => {
    setters[name]?.(value as never)
    await writer.load()
  })
  const href = writer.state.location.href
  const reader = await mount(config, href)
  const search = (
    reader as unknown as { state: { matches: { search: object }[] } }
  ).state.matches.at(-1)?.search as Record<string, unknown>
  return { href, search }
}

const SAMPLES: Record<Name, readonly unknown[]> = {
  weight: [0, 12, -3.5, 499.25, 500],
  reps: [5, 1, 12, 300],
  done: [true, false],
  compact: [true, false],
  window: [
    { preset: '30d' },
    { preset: '7d' },
    { preset: '90d' },
    { preset: 'custom', from: '2025-01-01', to: '2025-02-01' },
    { preset: 'custom', from: '2024-02-29', to: '2024-02-29' },
  ],
  exercises: [EXERCISES, [], ['squat'], ['bench', 'row'], ['squat', 'bench', 'deadlift']],
  levels: [[], ['1'], ['1', '2'], ['1', '2', '3']],
}

/** What the store reads back for a value: a range keeps only its own keys, a multi its order. */
const read = (name: Name, search: Record<string, unknown>): unknown => {
  if (name !== 'window') return search[name]
  const { window: preset, from, to } = search
  return preset === 'custom' ? { preset, from, to } : { preset }
}

describe.each(Object.keys(CONFIGS) as (keyof typeof CONFIGS)[])('codec matrix: %s', (config) => {
  for (const [name, samples] of Object.entries(SAMPLES) as [Name, readonly unknown[]][]) {
    for (const value of samples) {
      test(`${name} = ${JSON.stringify(value)} round-trips`, async () => {
        const { search } = await roundTrip(config, name, value)
        expect(read(name, search)).toEqual(value)
      })
    }
  }

  test('a default is absent from the URL while the validated search stays complete', async () => {
    const { href, search } = await roundTrip(config, 'reps', 5)
    expect(href).toBe('/p')
    expect(search).toMatchObject({ weight: 0, reps: 5, done: true, compact: false, window: '30d' })
    expect(search['exercises']).toEqual(EXERCISES)
    expect(search['levels']).toEqual([])
  })

  test('full-default multi: the full list omits the param, [] is written and stays distinct', async () => {
    expect((await roundTrip(config, 'exercises', EXERCISES)).href).toBe('/p')
    const empty = await roundTrip(config, 'exercises', [])
    expect(empty.href).toBe(config === 'json' ? '/p?exercises=%5B%5D' : '/p?exercises=')
    expect(empty.search['exercises']).toEqual([])
  })

  test('an empty-default multi omits [] and writes the members', async () => {
    expect((await roundTrip(config, 'levels', [])).href).toBe('/p')
    const some = await roundTrip(config, 'levels', ['1', '2'])
    expect(some.search['levels']).toEqual(['1', '2'])
  })

  test('a half or reversed custom range writes nothing', async () => {
    for (const bad of [
      { preset: 'custom', from: '2025-02-01' },
      { preset: 'custom', from: '2025-02-01', to: '2025-01-01' },
      { preset: 'custom', from: '2025-13-40', to: '2025-12-01' },
    ]) {
      expect((await roundTrip(config, 'window', bad)).href).toBe('/p')
    }
  })

  test('hand-written look-alikes decode or fall back, never coerce', async () => {
    const reader = await mount(
      config,
      '/p?reps=1e3&weight=%200x10&done=1&compact=true&levels=2&exercises=zzz&window=custom&from=2025-01-01',
    )
    const search = (
      reader as unknown as { state: { matches: { search: object }[] } }
    ).state.matches.at(-1)?.search as Record<string, unknown>
    expect(search).toMatchObject({ weight: 0, done: true, compact: true, window: '30d' })
    // The JSON parser itself turns `1e3` into the number 1000 before any codec runs; the
    // string-only router hands the codec the string, which NUMERIC_RE refuses.
    expect(search['reps']).toBe(config === 'json' ? 1000 : 5)
    expect(search['levels']).toEqual(['2'])
    expect(search['exercises']).toEqual(EXERCISES)
  })
})
