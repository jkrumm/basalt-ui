/**
 * The Kit gallery and the routed recipes: every destination is one click from the nav, and each renders a page
 * with real content through the app's own route tree, shell and peek layer (memory history, no server).
 */
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createQueryClient } from 'basalt-ui/data'
import { BasaltProvider, routerDefaults } from 'basalt-ui/router'
import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ReactNode } from 'react'
import { PHOTOS } from './kit-photos'
import { NAV } from './nav-model'
import { supplierOf } from './ref-inventory'
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
      '/kit/list',
      '/kit/projects',
      '/kit/split',
      '/kit/interval-track',
      '/kit/bar-list-series',
      '/kit/board',
      '/kit/layouts',
      '/kit/chain',
      '/kit/library',
      '/kit/motion',
      '/kit/avatars',
    ])
    expect(navPaths('kit-forms')).toEqual([
      '/kit/forms/inputs',
      '/kit/forms/choices',
      '/kit/forms/dates',
      '/kit/forms/buttons',
      '/kit/forms/whole',
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
    expect(ids.indexOf('kit-forms')).toBe(ids.indexOf('kit') + 1)
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

  test('dependency chain: one dataset as the chain, the nested table and the flat table', async () => {
    mount('/kit/chain')
    expect((await screen.findAllByText('Provision the new cluster')).length).toBeGreaterThan(0)
    const chain = document.querySelector('[data-slot="chain-graph"]')
    expect(chain?.querySelectorAll('[data-slot="chain-node"]').length).toBe(14)
    expect(screen.queryByRole('table')).toBeNull()
    cleanup()
    mount('/kit/chain?as=nested')
    const tree = await screen.findByRole('treegrid')
    expect(tree.querySelectorAll('tbody tr[aria-level="3"]').length).toBeGreaterThan(0)
    expect(document.querySelector('[data-slot="chain-view"]')).toBeNull()
    cleanup()
    mount('/kit/chain?as=table')
    const flat = await screen.findByRole('table')
    expect(flat.querySelectorAll('tbody tr').length).toBe(14)
    expect(flat.querySelector('tbody tr[aria-level]')).toBeNull()
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

describe('the Kit forms', () => {
  test('inputs: every control in its five states', async () => {
    mount('/kit/forms/inputs')
    const text = await screen.findByRole('region', { name: 'Text' })
    expect(within(text).getAllByRole('textbox').length).toBe(5)
    expect(within(text).getByRole('textbox', { name: 'Read-only' })).toHaveProperty(
      'readOnly',
      true,
    )
    expect(within(text).getByText('Enter a full address, like ada@example.com.')).toBeDefined()
    const checks = screen.getByRole('region', { name: 'Checkbox' })
    expect(within(checks).getByRole('checkbox', { name: 'Filled' })).toBeDefined()
  })

  test('choices: select, segmented, radios and a checkbox group', async () => {
    mount('/kit/forms/choices')
    expect(await screen.findByRole('radiogroup', { name: 'Rollout' })).toBeDefined()
    const events = screen.getByRole('group', { name: 'Notify me when' })
    expect(within(events).getAllByRole('checkbox').length).toBe(4)
  })

  test('dates and numbers: the two pickers and the sliders', async () => {
    mount('/kit/forms/dates')
    expect(await screen.findByRole('button', { name: /^Launch day: / })).toBeDefined()
    expect(screen.getAllByRole('slider').length).toBe(3)
  })

  test('buttons: variants, icons, states and the menu button', async () => {
    mount('/kit/forms/buttons')
    expect((await screen.findAllByRole('button', { name: 'Deploy' })).length).toBeGreaterThan(1)
    expect(screen.getByRole('button', { name: 'More actions' })).toBeDefined()
  })

  test('whole forms: the create dialog, the settings form and the steps, each on TanStack Form', async () => {
    mount('/kit/forms/whole')
    expect(await screen.findByRole('button', { name: 'New service' })).toBeDefined()
    expect(screen.getByText('checkout')).toBeDefined()
    cleanup()
    mount('/kit/forms/whole?form=settings')
    expect(await screen.findByRole('button', { name: 'Save settings' })).toBeDefined()
    cleanup()
    mount('/kit/forms/whole?form=steps')
    const steps = await screen.findByRole('navigation', { name: 'Progress' })
    expect(within(steps).getAllByText('Basics').length).toBeGreaterThan(0)
  })
})

describe('the routed recipes', () => {
  const run = RUNS[0]?.name ?? ''

  test('view switch', async () => {
    mount('/recipes/view-switch')
    expect((await screen.findAllByText('Provision the new cluster')).length).toBeGreaterThan(0)
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

describe('the reference pages', () => {
  test('the nav names one page per archetype, the record by its first supplier', () => {
    expect(navPaths('reference')).toEqual([
      '/ref/parts',
      '/ref/notes',
      '/ref/suppliers/$id',
      '/ref/settings',
      '/ref/flow',
    ])
  })

  test('list: the parts load into the grid under the saved views', async () => {
    mount('/ref/parts')
    expect(await screen.findByText('Hex bolt M8 x 40, A2 stainless')).toBeDefined()
    expect(await screen.findByText('To reorder')).toBeDefined()
  })

  test('notes: a note named in the address opens beside the list', async () => {
    mount('/ref/notes?note=note-3')
    const titles = await screen.findAllByText('Shaft seals leaking at 3 bar')
    expect(titles.length).toBeGreaterThan(1)
  })

  test('record: the overview shows the contact and the orders tab lists the orders', async () => {
    mount('/ref/suppliers/sup-4')
    expect(await screen.findByRole('button', { name: 'Edit Contact' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Edit Contact' }).textContent).toBe('Lukas Gruber')
    cleanup()
    mount('/ref/suppliers/sup-4?tab=orders')
    expect((await screen.findAllByText(/^PO-2026-/)).length).toBeGreaterThan(0)
  })

  test('record: the supplier is named once, in the band, and its lead time edits in place', async () => {
    mount('/ref/suppliers/sup-4')
    const lead = await screen.findByRole('button', { name: 'Edit Quoted lead time' })
    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]!.closest('[data-slot="page-bar"]')).not.toBeNull()
    const name = supplierOf('sup-4')!.name
    expect(
      [...document.querySelectorAll('[data-slot="entity-title"]')].filter((el) =>
        el.textContent?.includes(name),
      ),
    ).toHaveLength(1)
    // The band prints it twice (breadcrumb leaf and heading); nothing below the band repeats it.
    const outside = screen
      .getAllByText(name)
      .filter(
        (el) =>
          el.closest('[data-slot="page-bar"]') === null &&
          el.getAttribute('data-slot') !== 'page-breadcrumb-leaf',
      )
    expect(outside).toHaveLength(0)
    fireEvent.click(lead)
    const input = screen.getByRole('textbox', { name: 'Quoted lead time' })
    fireEvent.change(input, { target: { value: '21' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByRole('button', { name: 'Edit Quoted lead time' }).textContent).toBe(
      '21 days',
    )
  })

  test('record: the overview relates the parts it supplies as cards that link their record', async () => {
    mount('/ref/suppliers/sup-4')
    await screen.findByRole('button', { name: 'Edit Quoted lead time' })
    const cards = document.querySelectorAll('[data-slot="relationship-card"]')
    expect(cards.length).toBeGreaterThan(0)
    expect(cards.length).toBeLessThanOrEqual(4)
    for (const card of cards) {
      const href = card.querySelector('[data-slot="relationship-link"]')?.getAttribute('href')
      expect(href).toMatch(/^\/ref\/part\/[^/]+$/)
      expect(card.querySelectorAll('dt').length).toBe(3)
    }
  })

  test('record: the tabs carry counts and the activity tab heads its feed by period', async () => {
    mount('/ref/suppliers/sup-4?tab=activity')
    await screen.findByRole('tab', { name: /^Activity \d+$/ })
    for (const tab of ['Orders', 'Parts', 'Notes']) {
      expect(screen.getByRole('tab', { name: new RegExp(`^${tab} \\d+$`) })).toBeDefined()
    }
    const headings = [...document.querySelectorAll('[data-slot="event-list-header"]')].map((h) =>
      (h.firstChild?.textContent ?? '').trim(),
    )
    expect(headings.length).toBeGreaterThan(0)
    expect(
      headings.every((h) => /^(This week|Earlier this month|[A-Z][a-z]+|\d{4})$/.test(h)),
    ).toBe(true)
    expect(headings).not.toContain('Today')
  })

  test('create flow: the new-order wizard opens on its first step', async () => {
    mount('/ref/suppliers/sup-4?order=true')
    expect(await screen.findByText('Who is the order for?')).toBeDefined()
  })

  test('builder: the workflow groups draw on the canvas and the checklist names the open issue', async () => {
    mount('/ref/flow')
    expect(await screen.findByText('Stock drops under its minimum')).toBeDefined()
    expect(
      screen.getByRole('button', { name: /Connect the accounting app so step 3/ }),
    ).toBeDefined()
  })

  test('settings: the matrix and the danger row sit in their sections', async () => {
    mount('/ref/settings?section=notifications')
    expect((await screen.findAllByText('Events and channels')).length).toBeGreaterThan(0)
    cleanup()
    mount('/ref/settings?section=workspace')
    expect((await screen.findAllByText('Delete inventory')).length).toBeGreaterThan(0)
  })
})
