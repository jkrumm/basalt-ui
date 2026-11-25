/**
 * The dashboard's linked hover: a cycles row holds its run of days on every chart, and a chart
 * datum marks the row of its cycle. Mounted through the app's own route tree, as `kit-routes.test.tsx`.
 */
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createQueryClient } from 'basalt-ui/data'
import { BasaltProvider, routerDefaults } from 'basalt-ui/router'
import { act } from 'react'
import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ReactNode } from 'react'

afterEach(cleanup)

const PLAYGROUND = join(import.meta.dir, '..', '..')
if (!existsSync(join(PLAYGROUND, 'src', 'routeTree.gen.ts'))) {
  const generated = Bun.spawnSync(['bunx', 'tsr', 'generate'], { cwd: PLAYGROUND })
  if (generated.exitCode !== 0)
    throw new Error(`tsr generate failed: ${generated.stderr.toString()}`)
}
const { routeTree } = await import('../routeTree.gen')

function makeRouter(url: string) {
  const queryClient = createQueryClient()
  const defaults = routerDefaults()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [url] }),
    context: { queryClient },
    ...defaults.options,
    Wrap: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  })
  defaults.bind(router)
  return { router, link: defaults.link }
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof makeRouter>['router']
  }
}

async function mount(url: string): Promise<HTMLElement> {
  const { router, link } = makeRouter(url)
  const view = render(
    <BasaltProvider link={link}>
      <RouterProvider router={router} />
    </BasaltProvider>,
  )
  await screen.findByText('2016 halving', {}, { timeout: 5000 })
  return view.container
}

const rows = (el: HTMLElement) => [
  ...el.querySelectorAll<HTMLElement>('[data-slot="table-body"] [role="row"]'),
]
/** Every chart that reads the days: the navigator draws its own strip and joins no focus. */
const dayCharts = (el: HTMLElement) =>
  [...el.querySelectorAll<HTMLElement>('[data-basalt-chart]')].filter(
    (chart) => chart.querySelector('[aria-label="Price history window"]') === null,
  )
const heldBands = (chart: HTMLElement) => chart.querySelectorAll('[data-ts-key="xzone-0"]').length
const state = (row: HTMLElement) =>
  row.hasAttribute('data-focused') ? 'focused' : row.hasAttribute('data-dimmed') ? 'dimmed' : '-'

describe('dashboard', () => {
  test('a cycles row holds its run of days on every chart', async () => {
    const el = await mount('/kit/dashboard')
    const charts = dayCharts(el)
    // The hero and the five default metrics.
    expect(charts.length).toBe(6)
    expect(charts.map(heldBands)).toEqual([0, 0, 0, 0, 0, 0])

    await act(async () => fireEvent.pointerEnter(rows(el)[1] as Element))

    expect(charts.map(heldBands)).toEqual([1, 1, 1, 1, 1, 1])
    expect(rows(el).map(state)).toEqual(['dimmed', 'focused', 'dimmed', 'dimmed'])
  })

  test('a day on the chart marks the row of its cycle', async () => {
    // The 4Y window opens on 2022-11, inside the 2024 cycle, so its first day is that cycle's.
    const el = await mount('/kit/dashboard?window=4y')
    const hero = el.querySelector<HTMLElement>('[aria-label^="Bitcoin price"]') as HTMLElement
    hero.focus()
    await act(async () => fireEvent.keyDown(hero, { key: 'ArrowRight' }))
    expect(rows(el).map(state)).toEqual(['dimmed', 'dimmed', 'dimmed', 'focused'])
  })

  test('the metrics field is the set of cards and the confidence it averages', async () => {
    const el = await mount('/kit/dashboard?metrics=rupl')
    expect(dayCharts(el).length).toBe(2)
    expect(screen.queryByText('RHODL Ratio')).toBeNull()
    expect(screen.getAllByText('RUPL/NUPL').length).toBeGreaterThan(0)
  })

  test('the metrics table lists the same selected metrics as the cards', async () => {
    const el = await mount('/kit/dashboard?metricsView=table')
    expect(dayCharts(el).length).toBe(1)
    expect(screen.getAllByText('MVRV Z-Score').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Mid-cycle').length).toBeGreaterThan(0)
  })
})
