/**
 * Every public composite forwards `data-*` to its ROOT element, in every state it renders. This is
 * the seam `basalt-ui shot` finds an anchor (`data-shot`) and its state crops (`data-shot-states`)
 * through; a composite that routes them into a child's props leaves the page with no anchor (W50
 * trial row 198: `Section` sent them into its `WidgetHeader`).
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { ChartCard } from './charts/ChartCard'
import { BarList } from './dashboard/bar-list'
import { Board } from './dashboard/board'
import { EmptyState } from './dashboard/empty-state'
import { EventList } from './dashboard/event-list'
import { Meter } from './dashboard/meter'
import { PageSummary } from './dashboard/page-summary'
import { ErrorState, LoadingState, QueryState } from './dashboard/query-state'
import type { QueryStateLike } from './dashboard/query-state'
import { Section } from './dashboard/section'
import { DangerZone, SettingsSection } from './dashboard/settings-section'
import { StatCard } from './dashboard/stat-card'
import { StatGroup } from './dashboard/stat-group'
import { WidgetHeader } from './dashboard/widget-header'
import { BasaltDataTable } from './table/data-table'
import { createColumnHelper } from './table/index'

afterEach(cleanup)

const ANCHOR = { 'data-shot': 'x', 'data-shot-states': 'empty,loading,error' } as const

type Row = { name: string }
const col = createColumnHelper<Row>()
const COLUMNS = [col.accessor('name', { header: 'Name' })]
const ROWS: Row[] = [{ name: 'a' }]

const query = (over: Partial<QueryStateLike<Row[]>>): QueryStateLike<Row[]> => ({
  data: undefined,
  isError: false,
  error: null,
  fetchStatus: 'idle',
  refetch: () => undefined,
  ...over,
})
const FAILED = query({ isError: true, error: new Error('down') })
const PENDING = query({ fetchStatus: 'fetching' })
const READY = query({ data: ROWS })
const EMPTY = query({ data: [] })

const EVENTS = [{ id: '1', title: 'Deploy', at: Date.UTC(2026, 9, 20, 10) }]
const CARD = { id: 'a', title: 'Alpha' }
const COLUMN = { id: 'c', title: 'Col', total: '1', cards: [CARD] }

/** name → the element to render; each entry is one state of one composite. */
const CASES: Record<string, ReactElement> = {
  'Section rest': (
    <Section title="S" {...ANCHOR}>
      body
    </Section>
  ),
  'Section tabs-only': (
    <Section tabs={<span>tabs</span>} aria-label="T" {...ANCHOR}>
      body
    </Section>
  ),
  'Section collapsed': (
    <Section title="S" collapsible defaultOpen={false} {...ANCHOR}>
      body
    </Section>
  ),
  'Section failed': (
    <Section title="S" query={FAILED} {...ANCHOR}>
      body
    </Section>
  ),
  'Section pending': (
    <Section title="S" query={PENDING} {...ANCHOR}>
      body
    </Section>
  ),
  'Section empty': (
    <Section title="S" query={EMPTY} empty={{ title: 'None' }} {...ANCHOR}>
      body
    </Section>
  ),
  'ChartCard rest': (
    <ChartCard title="C" {...ANCHOR}>
      body
    </ChartCard>
  ),
  'ChartCard pending': (
    <ChartCard title="C" state={{ pending: true }} {...ANCHOR}>
      body
    </ChartCard>
  ),
  'ChartCard empty': (
    <ChartCard title="C" state={{ empty: true }} {...ANCHOR}>
      body
    </ChartCard>
  ),
  'ChartCard error': (
    <ChartCard title="C" state={{ error: new Error('down') }} {...ANCHOR}>
      body
    </ChartCard>
  ),
  'StatCard rest': <StatCard title="MRR" value="1" {...ANCHOR} />,
  'StatCard loading': <StatCard title="MRR" value="1" loading {...ANCHOR} />,
  'StatCard failed': <StatCard title="MRR" value="1" query={FAILED} {...ANCHOR} />,
  'StatCard empty': <StatCard title="MRR" value="1" query={EMPTY} {...ANCHOR} />,
  'StatGroup grid': (
    <StatGroup {...ANCHOR}>
      <StatCard title="A" value="1" />
    </StatGroup>
  ),
  'StatGroup strip': (
    <StatGroup
      variant="strip"
      label="Health"
      cells={[{ key: 'a', caption: 'A', value: '1' }]}
      {...ANCHOR}
    />
  ),
  'Board rest': <Board columns={[COLUMN]} {...ANCHOR} />,
  'Board loading': <Board columns={[COLUMN]} loading {...ANCHOR} />,
  'Board empty': <Board columns={[]} {...ANCHOR} />,
  'EventList rest': <EventList items={EVENTS} {...ANCHOR} />,
  'EventList loading': <EventList items={[]} loading {...ANCHOR} />,
  'EventList empty': <EventList items={[]} {...ANCHOR} />,
  'BarList rest': <BarList label="L" items={[{ key: 'a', label: 'A', value: 1 }]} {...ANCHOR} />,
  'BarList loading': <BarList label="L" items={[]} loading {...ANCHOR} />,
  'BarList empty': <BarList label="L" items={[]} {...ANCHOR} />,
  'Meter bar': <Meter label="M" value={5} {...ANCHOR} />,
  'Meter ring': <Meter label="M" shape="ring" value={5} {...ANCHOR} />,
  'Meter loading': <Meter label="M" loading {...ANCHOR} />,
  'Meter ring loading': <Meter label="M" shape="ring" loading {...ANCHOR} />,
  'Meter empty': <Meter label="M" {...ANCHOR} />,
  'PageSummary rest': <PageSummary sentence="3 open" {...ANCHOR} />,
  'PageSummary loading': <PageSummary loading {...ANCHOR} />,
  SettingsSection: (
    <SettingsSection title="S" {...ANCHOR}>
      rows
    </SettingsSection>
  ),
  DangerZone: (
    <DangerZone title="D" {...ANCHOR}>
      rows
    </DangerZone>
  ),
  WidgetHeader: <WidgetHeader tier="section" title="W" {...ANCHOR} />,
  EmptyState: <EmptyState title="None" {...ANCHOR} />,
  'LoadingState page': <LoadingState {...ANCHOR} />,
  'LoadingState section': <LoadingState tier="section" {...ANCHOR} />,
  'ErrorState page': <ErrorState error={new Error('down')} {...ANCHOR} />,
  'ErrorState section': <ErrorState error={new Error('down')} tier="section" {...ANCHOR} />,
  'QueryState failed': (
    <QueryState query={FAILED} {...ANCHOR}>
      body
    </QueryState>
  ),
  'QueryState pending': (
    <QueryState query={PENDING} {...ANCHOR}>
      body
    </QueryState>
  ),
  'QueryState empty': (
    <QueryState query={EMPTY} empty={{ title: 'None' }} {...ANCHOR}>
      body
    </QueryState>
  ),
  'QueryState cached-data banner': (
    <QueryState query={query({ data: ROWS, isError: true, error: new Error('x') })} {...ANCHOR}>
      body
    </QueryState>
  ),
  'BasaltDataTable rest': <BasaltDataTable data={ROWS} columns={COLUMNS} {...ANCHOR} />,
  'BasaltDataTable titled': <BasaltDataTable data={ROWS} columns={COLUMNS} title="T" {...ANCHOR} />,
  'BasaltDataTable loading': <BasaltDataTable data={[]} columns={COLUMNS} isLoading {...ANCHOR} />,
  'BasaltDataTable empty': <BasaltDataTable data={[]} columns={COLUMNS} {...ANCHOR} />,
  'BasaltDataTable error': (
    <BasaltDataTable data={[]} columns={COLUMNS} query={FAILED} {...ANCHOR} />
  ),
}

/** The first element a composite rendered (`MantineProvider` may put a `<style>` before it). */
const firstRendered = (container: HTMLElement): Element | null =>
  container.querySelector(':scope > :not(style)')

describe('composites forward data-* to their root', () => {
  for (const [name, element] of Object.entries(CASES)) {
    test(name, () => {
      const { container } = render(<MantineProvider>{element}</MantineProvider>)
      const anchors = container.querySelectorAll('[data-shot="x"]')
      expect(anchors).toHaveLength(1)
      const [root] = anchors
      expect(root?.getAttribute('data-shot-states')).toBe('empty,loading,error')
      // The root is the first rendered element — a descendant would not be the box a crop frames.
      expect(root).toBe(firstRendered(container) ?? undefined)
    })
  }

  test('a ready QueryState has no root of its own; the host carries the anchor', () => {
    const { container } = render(
      <MantineProvider>
        <QueryState query={READY} {...ANCHOR}>
          <p>body</p>
        </QueryState>
      </MantineProvider>,
    )
    expect(container.querySelector('[data-shot]')).toBeNull()
  })

  test('only data-* crosses, other attributes stay out', () => {
    const { container } = render(
      <MantineProvider>
        <Section title="S" {...({ 'data-x': '1', role: 'banner' } as object)}>
          body
        </Section>
      </MantineProvider>,
    )
    expect(firstRendered(container)?.getAttribute('data-x')).toBe('1')
    expect(firstRendered(container)?.getAttribute('role')).toBeNull()
  })
})
