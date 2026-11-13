/**
 * The two perf fixtures (quality-contract section 6, P9): a route switch between two argo-shaped
 * pages, and a 12-card `StatCard` grid on a 1 s ticker. Compiler off: nothing here is precompiled,
 * so the counts are what a consumer without the React Compiler gets.
 */
import { QueryClientProvider, queryOptions, useQuery } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import {
  Link,
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { Profiler, useEffect, useLayoutEffect, useState } from 'react'
import type { ReactElement } from 'react'

import { StatCard } from '../../../src/cards/stat-card'
import { BasaltProvider } from '../../../src/core/provider'
import { liveQuery } from '../../../src/data/live/live-query'
import { makeQueryClient } from '../../../src/data/query-client'
import type { CommitCounter } from './harness'

export const CARDS = 12
export const TICK_MS = 1_000

const cardKey = (i: number) => ['perf', 'ticker', i] as const

/**
 * A ticker-class query whose cache is fed by `setQueryData` only: `enabled: false` keeps the
 * fake-clock run off the network, `liveQuery` still stamps the freshness class the card reads.
 */
const cardQuery = (i: number) =>
  liveQuery(
    queryOptions({ queryKey: cardKey(i), queryFn: () => Promise.resolve(0), enabled: false }),
    { class: 'ticker', every: TICK_MS },
  )

/** What the well-behaved card does: reads the cached figure and renders it. */
function Card({ i }: { i: number }): ReactElement {
  const { data } = useQuery(cardQuery(i))
  return (
    <StatCard
      title={`Metric ${i}`}
      value={data ?? null}
      phase={data === undefined ? 'loading' : 'ready'}
    />
  )
}

/** The offender: derives state from the query in a layout effect, one extra commit per card per tick. */
function OffenderCard({ i }: { i: number }): ReactElement {
  const { data } = useQuery(cardQuery(i))
  const [mirror, setMirror] = useState<number | null>(null)
  useLayoutEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- the seeded offender: this is the defect the lane must catch
    setMirror(data ?? null)
  }, [data])
  return (
    <StatCard title={`Metric ${i}`} value={mirror} phase={mirror === null ? 'loading' : 'ready'} />
  )
}

/** Writes the next figure of every card once per tick, on whatever clock the test installed. */
function Feed({ client }: { client: QueryClient }): null {
  useEffect(() => {
    let tick = 0
    const timer = setInterval(() => {
      tick += 1
      for (let i = 0; i < CARDS; i += 1) client.setQueryData(cardKey(i), tick * 100 + i)
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [client])
  return null
}

export function seedTicker(client: QueryClient): void {
  for (let i = 0; i < CARDS; i += 1) client.setQueryData(cardKey(i), i)
}

/** One `Profiler` per card, all reporting to one counter: the count is commits that touched a card. */
export function TickerGrid({
  client,
  counter,
  offender = false,
}: {
  client: QueryClient
  counter: CommitCounter
  offender?: boolean
}): ReactElement {
  const Cell = offender ? OffenderCard : Card
  return (
    <BasaltProvider>
      <QueryClientProvider client={client}>
        <Feed client={client} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {Array.from({ length: CARDS }, (_, i) => (
            <Profiler key={i} id={`card-${i}`} onRender={counter.onRender}>
              <Cell i={i} />
            </Profiler>
          ))}
        </div>
      </QueryClientProvider>
    </BasaltProvider>
  )
}

// ── Route switch ───────────────────────────────────────────────────────────────────────────────

const PAGE_CARDS = { overview: 6, detail: 8 } as const
type PageName = keyof typeof PAGE_CARDS

const pageKey = (name: PageName) => ['perf', 'page', name] as const

export function seedPages(client: QueryClient): void {
  for (const name of Object.keys(PAGE_CARDS) as PageName[]) {
    client.setQueryData(
      pageKey(name),
      Array.from({ length: PAGE_CARDS[name] }, (_, i) => i * 10),
    )
  }
}

/** An argo-shaped page: a titled grid of stat cards fed by one query already in the cache. */
function Page({ name }: { name: PageName }): ReactElement {
  const { data = [] } = useQuery({ queryKey: pageKey(name), queryFn: () => Promise.resolve([]) })
  return (
    <main aria-label={name}>
      <h1>{name}</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {data.map((value, i) => (
          <StatCard key={i} title={`${name} ${i}`} value={value} phase="ready" />
        ))}
      </div>
    </main>
  )
}

/** A memory router over a persistent layout (nav links + outlet) and two page routes. */
export function makeRouteApp(client: QueryClient, counter: CommitCounter) {
  const root = createRootRoute({
    component: () => (
      <Profiler id="route" onRender={counter.onRender}>
        <nav>
          <Link to="/">Overview</Link>
          <Link to="/detail">Detail</Link>
        </nav>
        <Outlet />
      </Profiler>
    ),
  })
  const overview = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => <Page name="overview" />,
  })
  const detail = createRoute({
    getParentRoute: () => root,
    path: '/detail',
    component: () => <Page name="detail" />,
  })
  const router = createRouter({
    routeTree: root.addChildren([overview, detail]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
    context: { client },
  })
  const App = (): ReactElement => (
    <BasaltProvider>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </BasaltProvider>
  )
  return { router, App }
}

export const newClient = (): QueryClient => makeQueryClient()
