/**
 * The Kit gallery and the routed recipes: every destination is one click from the nav, and each renders a page
 * with real content through the app's own route tree, shell and peek layer (memory history, no server).
 */
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { cleanup, render, screen, within } from '@testing-library/react'
import { createQueryClient } from 'basalt-ui/data'
import { BasaltProvider, routerDefaults } from 'basalt-ui/router'
import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ReactNode } from 'react'
import { PHOTOS } from './kit-photos'
import { NAV } from './nav-model'
import { RUNS } from './runs'

afterEach(cleanup)

// The route tree is generated (gitignored): the playground's typecheck and build write it, a bare unit run has none.
const PLAYGROUND = join(import.meta.dir, '..', '..')
if (!existsSync(join(PLAYGROUND, 'src', 'routeTree.gen.ts'))) {
  const generated = Bun.spawnSync(['bunx', 'tsr', 'generate'], { cwd: PLAYGROUND })
  if (generated.exitCode !== 0)
    throw new Error(`tsr generate failed: ${generated.stderr.toString()}`)
}
const { routeTree } = await import('../routeTree.gen')

const first = PHOTOS[0]
const second = PHOTOS[1]
if (first === undefined || second === undefined)
  throw new Error('kit fixture: fewer than two photos')

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

// The app registers its router in `main.tsx`, which this test program does not include: `defineNav` checks every
// `to` against the registered tree, so the test registers the same tree here.
declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof makeRouter>['router']
  }
}

function mount(url: string): void {
  const { router, link } = makeRouter(url)
  render(
    <BasaltProvider link={link}>
      <RouterProvider router={router} />
    </BasaltProvider>,
  )
}

/** Every nav destination's path, by section id. */
function navPaths(section: string): string[] {
  const found = NAV.sections.find((s) => s.id === section)
  return (found?.items ?? []).map((item) => String(item.link.to))
}

describe('the Kit nav', () => {
  test('names one destination per capability, ahead of the recipes and the trial evidence', () => {
    expect(navPaths('kit')).toEqual([
      '/kit/controls',
      '/kit/aside',
      '/kit/peek',
      '/kit/split',
      '/kit/interval-track',
      '/kit/library',
    ])
    expect(navPaths('recipes')).toEqual([
      '/recipes/view-switch',
      '/recipes/saved-views',
      '/recipes/two-pane',
    ])
    const ids = NAV.sections.map((s) => s.id)
    const trial = ids.filter(
      (id) => id.startsWith('trial') || id.startsWith('fleet') || id === 'scenarios',
    )
    expect(ids.indexOf('kit')).toBeLessThan(Math.min(...trial.map((id) => ids.indexOf(id))))
    for (const section of NAV.sections.filter((s) => trial.includes(s.id))) {
      expect(section.label).toStartWith('Trial evidence')
    }
  })
})

describe('the Kit pages', () => {
  test('page controls: the view tabs, the four filters and the photos table', async () => {
    mount('/kit/controls')
    expect(await screen.findByText(first.title)).toBeDefined()
    expect(screen.getAllByRole('tab', { name: 'Table' }).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Search').length).toBeGreaterThan(0)
  })

  test('page controls: the cards view lists the same photos', async () => {
    mount('/kit/controls?as=cards')
    expect(await screen.findByText(first.title)).toBeDefined()
  })

  test('inspector aside: a selected row shows its facts, views and actions', async () => {
    mount(`/kit/aside?photo=${second.id}`)
    expect(await screen.findByRole('button', { name: 'Pick' })).toBeDefined()
    expect(screen.getAllByText('Exposure').length).toBeGreaterThan(0)
  })

  test('peek: the list links each photo, and an open peek shows the photo', async () => {
    mount(`/kit/peek?peek=photo/${first.id}`)
    const dialog = await screen.findByRole('dialog', { name: first.title })
    expect(within(dialog).getByText('Exposure')).toBeDefined()
    expect(screen.getAllByRole('link', { name: first.title }).length).toBeGreaterThan(0)
  })

  test('split page: the list, and the chosen photo beside it', async () => {
    mount(`/kit/split?photo=${first.id}`)
    expect(await screen.findByRole('navigation', { name: 'Photos' })).toBeDefined()
    expect(screen.getAllByText('Exposure').length).toBeGreaterThan(0)
  })

  test('library: the filters, the result cards and the aside for a chosen photo', async () => {
    mount(`/kit/library?photo=${second.id}`)
    expect((await screen.findAllByText(second.title)).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Collection').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Exposure').length).toBeGreaterThan(0)
  })

  test("a photo's own page", async () => {
    mount(`/kit/photos/${first.id}`)
    expect(await screen.findByText('Exposure')).toBeDefined()
  })
})

describe('the routed recipes', () => {
  const run = RUNS[0]?.name ?? ''

  test('view switch', async () => {
    mount('/recipes/view-switch')
    expect(await screen.findByText(run)).toBeDefined()
  })

  test('saved views', async () => {
    mount('/recipes/saved-views')
    expect(await screen.findByText(run)).toBeDefined()
  })

  test('two panes', async () => {
    mount('/recipes/two-pane')
    expect(await screen.findByRole('img', { name: 'Price' })).toBeDefined()
    expect(screen.getByRole('img', { name: 'Momentum' })).toBeDefined()
  })
})
