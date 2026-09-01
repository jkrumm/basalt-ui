/**
 * StatesPage — audit-c-charts.md top-15 #15: `QueryState` wrapping a `CartesianChart` kind through
 * all four variants (pending → error → empty → data), driven by a store-bound `ViewTabs`, inside a
 * dashboard widget with a range store — `isPending` on a chart is otherwise demoed exactly once, on
 * a `Donut`, driven by a bare `Switch`. Plus `EmptyState`/`LoadingState`/`ErrorState` in both their
 * `page` and `section` variants.
 */
import { useState } from 'react'
import { Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core'
import { EmptyState, ErrorState, LoadingState, QueryState } from 'basalt-ui'
import type { QueryStateLike } from 'basalt-ui'
import { ChartCard, MultiLine } from 'basalt-ui/charts'
import { RangeFilter, ViewTabs } from 'basalt-ui/controls'
import { createLocalStore, field } from 'basalt-ui/state'
import { SERIES_DATA } from './data'
import type { DayPoint } from './data'
import { demoColors } from './series'

const VARIANT_VALUES = ['pending', 'error', 'empty', 'data'] as const
type Variant = (typeof VARIANT_VALUES)[number]

const VARIANT_OPTIONS: { value: Variant; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'error', label: 'Error' },
  { value: 'empty', label: 'Empty' },
  { value: 'data', label: 'Data' },
]

const statesStore = createLocalStore({
  key: 'states-chart',
  fields: {
    variant: field.enum(VARIANT_VALUES, 'data'),
    range: field.range({ presets: ['7d', '30d'], fallback: '30d' }),
  },
}).labels({
  variant: { pending: 'Pending', error: 'Error', empty: 'Empty', data: 'Data' },
  range: { '7d': 'Last 7 days', '30d': 'Last 30 days' },
})

function buildChartQuery(variant: Variant, refetch: () => void): QueryStateLike<DayPoint[]> {
  const base = { isError: false, error: null, refetch } as const
  switch (variant) {
    case 'data':
      return { ...base, data: SERIES_DATA, fetchStatus: 'idle' }
    case 'empty':
      return { ...base, data: [], fetchStatus: 'idle' }
    case 'pending':
      return { ...base, data: undefined, fetchStatus: 'fetching' }
    case 'error':
      return {
        ...base,
        isError: true,
        error: {
          status: 500,
          value: { message: 'the sessions index is rebuilding — try again shortly' },
        },
        data: undefined,
        fetchStatus: 'idle',
      }
  }
}

function ChartStatesWidget() {
  const [variant] = statesStore.field.variant.use()
  const [retries, setRetries] = useState(0)
  const query = buildChartQuery(variant, () => setRetries((n) => n + 1))

  return (
    <ChartCard
      title="Sessions"
      subtitle={`QueryState wrapping a MultiLine kind through pending / error / empty / data — refetch() calls: ${retries}`}
      info="The three-state honesty rule the visx doctrine calls the most common dashboard lie, driven all the way through a real chart kind rather than isPending alone: pending shows a placeholder with the SAME footprint as the plot, error shows the decoded server message with a Retry, empty says so rather than rendering an axis with nothing on it."
      actions={
        <Group gap="sm" wrap="nowrap">
          <RangeFilter field={statesStore.field.range} />
          <ViewTabs field={statesStore.field.variant} options={VARIANT_OPTIONS} />
        </Group>
      }
    >
      <div style={{ minHeight: 240 }}>
        <QueryState
          query={query}
          variant="section"
          errorTitle="Could not load sessions"
          errorFallback="The sessions index did not answer."
          empty={{
            title: 'No sessions yet',
            description: 'Nothing has been measured for this range.',
          }}
        >
          {(rows) => (
            <MultiLine<DayPoint>
              data={rows}
              height={220}
              chartId="states-chart"
              getX={(d) => d.date}
              series={[
                {
                  key: 'sessions',
                  label: 'Sessions',
                  color: demoColors.sessions,
                  mark: 'line',
                  getValue: (d) => d.sessions,
                },
              ]}
            />
          )}
        </QueryState>
      </div>
    </ChartCard>
  )
}

function BuildingBlocksBlock() {
  return (
    <Stack gap="xs">
      <Text size="sm" c="dimmed">
        <code>EmptyState</code> / <code>LoadingState</code> / <code>ErrorState</code>, `page` and
        `section` variants, rendered directly — an auth gate or an error boundary composes these
        outside a query. Density retuning (−3/0/+3) is ONE global config knob on{' '}
        <code>createBasaltTheme</code>, not a per-component prop, and a nested `BasaltProvider` now
        warns rather than isolating a subtree — so the honest way to see these at another density is
        the theme-lab's Density control on <code>/settings</code>, not a second provider mounted
        here.
      </Text>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
        <Paper p="sm" withBorder>
          <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb="xs">
            LoadingState — section
          </Text>
          <LoadingState variant="section" label="Loading sessions" />
        </Paper>
        <Paper p="sm" withBorder mih={140}>
          <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb="xs">
            LoadingState — page
          </Text>
          <LoadingState variant="page" label="Loading the page" />
        </Paper>
        <Paper p="sm" withBorder>
          <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb="xs">
            ErrorState — section
          </Text>
          <ErrorState
            error={{ status: 500, value: {} }}
            title="Could not load sessions"
            fallback="The sessions index did not answer."
            variant="section"
          />
        </Paper>
        <Paper p="sm" withBorder>
          <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb="xs">
            ErrorState — page
          </Text>
          <ErrorState
            error={{ status: 401, value: {} }}
            title="Could not start the admin"
            fallback="Minting the asset token failed."
            variant="page"
          />
        </Paper>
        <Paper p="sm" withBorder>
          <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb="xs">
            EmptyState — section
          </Text>
          <EmptyState
            variant="section"
            title="No sessions yet"
            description="Nothing measured for this range."
          />
        </Paper>
        <Paper p="sm" withBorder>
          <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb="xs">
            EmptyState — page
          </Text>
          <EmptyState
            variant="page"
            title="Nothing here yet"
            description="Once data arrives, it renders here."
          />
        </Paper>
      </SimpleGrid>
    </Stack>
  )
}

export function StatesPage() {
  return (
    <Stack gap="lg">
      <ChartStatesWidget />
      <BuildingBlocksBlock />
    </Stack>
  )
}
