/**
 * The streaming-SSR fixture app: the playground dashboard's shapes (KPI row, two charts, a
 * `BasaltDataTable`) behind `BasaltProvider` and a TanStack Router instance — and the pattern under
 * test: the shell holds no promise; each slow section gets an UNAWAITED loader promise, rendered
 * through `<Await>` inside `<Suspense>` with a fallback that reserves the section's final box.
 *
 * Shared by the server (`server.tsx`) and the hydrating client (`client.tsx`).
 */
import { Title } from '@mantine/core'
import { Await, Outlet, createRootRouteWithContext, createRoute } from '@tanstack/react-router'
import { BasaltDataTable, createColumnHelper } from 'basalt-ui/table'
import { BasaltProvider, StatCard, createBasaltRouter } from 'basalt-ui'
import type { BasaltRouterContext } from 'basalt-ui'
import { Bars, ChartCard, Lines } from 'basalt-ui/charts'
import { VX } from 'basalt-ui/tokens'
import { Suspense, useEffect } from 'react'
import type { ReactNode } from 'react'
import {
  FALLBACK_ATTR,
  MARK_HYDRATE_END,
  READY_ATTR,
  SECTION_DELAYS_MS,
  SHELL_ATTR,
} from './contract'
import type { SectionKey } from './contract'

// Fixed fallback boxes (px): each is the section's measured final height, so a reveal moves nothing.
const FALLBACK_HEIGHT = { kpis: 132, trend: 352, mix: 352, table: 384 } as const

// ── Data: pure functions of a constant seed, so every run renders the same numbers ───────────────

type Point = { x: number; y: number }
type Slice = { label: string; value: number }
type PageRow = { path: string; views: number; conversion: number }

const wave = (i: number, phase: number): number => 50 + 30 * Math.sin(i / 6 + phase)
const trend: Point[] = Array.from({ length: 120 }, (_, i) => ({ x: i, y: Math.round(wave(i, 0)) }))
const mix: Slice[] = ['Search', 'Direct', 'Social', 'Email', 'Referral', 'Ads'].map((label, i) => ({
  label,
  value: Math.round(wave(i * 7, 1) * 10),
}))
const pages: PageRow[] = Array.from({ length: 50 }, (_, i) => ({
  path: `/docs/page-${String(i).padStart(2, '0')}`,
  views: Math.round(wave(i, 2) * 100),
  conversion: Math.round(wave(i, 3)) / 10,
}))

const delay = <T,>(ms: number, value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms))

// ── Sections ─────────────────────────────────────────────────────────────────────────────────────

const col = createColumnHelper<PageRow>()
const columns = [
  col.accessor('path', { header: 'Page' }),
  col.accessor('views', { header: 'Views', meta: { align: 'right' } }),
  col.accessor('conversion', { header: 'Conversion', meta: { align: 'right' } }),
]

function Section({
  name,
  height,
  promise,
  children,
}: {
  name: SectionKey
  height: number
  promise: Promise<unknown>
  children: ReactNode
}) {
  return (
    <Suspense fallback={<div {...{ [FALLBACK_ATTR]: name }} style={{ height }} />}>
      <Await promise={promise}>
        {() => (
          <div {...{ [READY_ATTR]: name }} style={{ minHeight: height }}>
            {children}
          </div>
        )}
      </Await>
    </Suspense>
  )
}

function Page() {
  const data = indexRoute.useLoaderData()
  return (
    <div {...{ [SHELL_ATTR]: '' }} style={{ display: 'grid', gap: 16, padding: 16 }}>
      <Title order={4}>Analytics</Title>
      <Section name="kpis" height={FALLBACK_HEIGHT.kpis} promise={data.kpis}>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {['Sessions', 'Signups', 'Revenue', 'Churn'].map((title, i) => (
            <StatCard key={title} title={title} value={String((i + 1) * 1234)} delta={i * 2 - 3} />
          ))}
        </div>
      </Section>
      <Section name="trend" height={FALLBACK_HEIGHT.trend} promise={data.trend}>
        <ChartCard title="Sessions over time">
          <Lines
            data={trend}
            ariaLabel="Sessions over time"
            x={(d) => d.x}
            y={{ domain: 'auto' }}
            series={[{ key: 'y', label: 'Sessions', color: VX.accent, getValue: (d) => d.y }]}
          />
        </ChartCard>
      </Section>
      <Section name="mix" height={FALLBACK_HEIGHT.mix} promise={data.mix}>
        <ChartCard title="Sessions by channel">
          <Bars
            data={mix}
            ariaLabel="Sessions by channel"
            x={(d) => d.label}
            bars={[{ key: 'value', label: 'Sessions', color: VX.accent, getValue: (d) => d.value }]}
          />
        </ChartCard>
      </Section>
      <Section name="table" height={FALLBACK_HEIGHT.table} promise={data.table}>
        <BasaltDataTable
          title="All pages"
          data={pages}
          columns={columns}
          enablePagination
          initialPagination={{ pageIndex: 0, pageSize: 10 }}
        />
      </Section>
    </div>
  )
}

/** Marks the end of hydration: the first effect to run after the tree commits on the client. */
function HydrationMark() {
  useEffect(() => {
    performance.mark(MARK_HYDRATE_END)
  }, [])
  return null
}

// ── Routes ───────────────────────────────────────────────────────────────────────────────────────

const rootRoute = createRootRouteWithContext<BasaltRouterContext>()({ component: Outlet })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  // Returns the promises UNAWAITED: the loader resolves at once, so the shell flushes at once.
  loader: () => ({
    kpis: delay(SECTION_DELAYS_MS.kpis, true),
    trend: delay(SECTION_DELAYS_MS.trend, true),
    mix: delay(SECTION_DELAYS_MS.mix, true),
    table: delay(SECTION_DELAYS_MS.table, true),
  }),
  component: Page,
})

const routeTree = rootRoute.addChildren([indexRoute])

/** One router per request on the server; one for the page on the client. */
export const createFixtureRouter = () => createBasaltRouter({ routeTree })
export type FixtureRouter = ReturnType<typeof createFixtureRouter>

/**
 * The document, rendered OUTSIDE `BasaltProvider`: the provider emits a palette `<style>` next to the
 * router, so a root route that rendered `<html>` would sit inside it — and the router's stream
 * transform needs the `</body></html>` close in the React stream, so the document must be React's.
 */
function Document({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-mantine-color-scheme="dark" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>basalt-ui ssr fixture</title>
        <link rel="stylesheet" href="/client.css" />
      </head>
      <body>
        <HydrationMark />
        {children}
        <script type="module" src="/client.js" />
      </body>
    </html>
  )
}

/** The tree both sides render: the document around `BasaltProvider` (Mantine, palette, router). */
export function FixtureApp({ router }: { router: FixtureRouter }) {
  return (
    <Document>
      <BasaltProvider router={router} sizeClassHint="expanded" />
    </Document>
  )
}
