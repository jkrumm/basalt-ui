/**
 * QueryDemoPage — exercises createBasaltQueryClient, unwrap, BasaltQueryDevtools (root barrel,
 * C1 dropped `./query`) + QueryClientProvider from @tanstack/react-query, with a mock Eden-shaped
 * response.
 * No backend required: the mock queryFn resolves a static { data, error } envelope.
 *
 * Edge states: toggle the error switch to force the error envelope — unwrap() throws,
 * the query enters the error state, and the error message renders in the table section.
 */
import {
  Alert,
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  Title,
} from '@mantine/core'
import { BasaltQueryDevtools, createBasaltQueryClient, toErrorMessage, unwrap } from 'basalt-ui'
import {
  QueryClientProvider,
  useQuery,
  useQueryClient,
  useQueryErrorResetBoundary,
} from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { QueryStateDemoPage } from './QueryStateDemoPage'
import { StatesPage } from './StatesPage'

// ── Mock data ─────────────────────────────────────────────────────────────────────────────────────

type MetricRow = {
  id: number
  label: string
  value: number
  unit: string
}

const MOCK_ROWS: MetricRow[] = [
  { id: 1, label: 'Active users', value: 1_284, unit: 'users' },
  { id: 2, label: 'Avg session', value: 4.7, unit: 'min' },
  { id: 3, label: 'Error rate', value: 0.3, unit: '%' },
  { id: 4, label: 'P95 latency', value: 212, unit: 'ms' },
]

/** Simulates an Eden Treaty `.get()` call returning a { data, error } or { data: null, error } envelope. */
function mockFetchMetrics(
  forceError: boolean,
): Promise<{ data: MetricRow[]; error: null } | { data: null; error: { message: string } }> {
  if (forceError)
    return Promise.resolve({ data: null, error: { message: 'Simulated server error (500)' } })
  return Promise.resolve({ data: MOCK_ROWS, error: null })
}

// ── Inner content (must be inside QueryClientProvider) ────────────────────────────────────────────

function MetricsTable({ forceError }: { forceError: boolean }) {
  const qc = useQueryClient()
  const { data, isFetching, isError, error } = useQuery({
    queryKey: ['demo', 'metrics', forceError],
    queryFn: () => unwrap(mockFetchMetrics(forceError)),
    retry: false,
  })

  if (isError) {
    return (
      <Stack gap="xs">
        <Alert color="red" title="Query error">
          {toErrorMessage(error)}
        </Alert>
        <Button
          size="compact-sm"
          variant="default"
          onClick={() => void qc.invalidateQueries({ queryKey: ['demo', 'metrics'] })}
        >
          Retry
        </Button>
      </Stack>
    )
  }

  return (
    <Stack gap="xs">
      <Text size="sm" c="dimmed">
        {isFetching ? 'Fetching…' : `${data?.length ?? 0} rows loaded via unwrap()`}
      </Text>
      <Table striped highlightOnHover withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Metric</Table.Th>
            <Table.Th>Value</Table.Th>
            <Table.Th>Unit</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(data ?? []).map((row) => (
            <Table.Tr key={row.id}>
              <Table.Td>{row.label}</Table.Td>
              <Table.Td fw={600}>{row.value}</Table.Td>
              <Table.Td>
                <Badge size="sm" variant="light">
                  {row.unit}
                </Badge>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  )
}

// ── ResetBoundary demo ────────────────────────────────────────────────────────────────────────────

function ResetBoundaryNote() {
  const { reset } = useQueryErrorResetBoundary()
  return (
    <Text size="xs" c="dimmed">
      useQueryErrorResetBoundary available — reset fn: {reset.name || 'anonymous'}
    </Text>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────────────────────────

export function QueryDemoPage() {
  // oxlint-disable-next-line react/hook-use-state -- stable singleton; setter intentionally omitted
  const [client] = useState(() => createBasaltQueryClient())
  const [forceError, setForceError] = useState(false)
  const staleTimeMs = useMemo(() => {
    const st = client.getDefaultOptions().queries?.staleTime
    return typeof st === 'number' ? st : 30_000
  }, [client])

  return (
    <QueryClientProvider client={client}>
      <Tabs defaultValue="client">
        <Tabs.List>
          <Tabs.Tab value="client">Client</Tabs.Tab>
          <Tabs.Tab value="query-state">Query state</Tabs.Tab>
          <Tabs.Tab value="states">States</Tabs.Tab>
        </Tabs.List>
        {/* `/query-state` and `/states` absorbed here (audit E §7) — neither carries its own
            `PageBar`, so nesting them under this tab set adds none (law C6). */}
        <Tabs.Panel value="client" pt="md">
          <QueryClientPanel
            staleTimeMs={staleTimeMs}
            forceError={forceError}
            setForceError={setForceError}
          />
        </Tabs.Panel>
        <Tabs.Panel value="query-state" pt="md">
          <QueryStateDemoPage />
        </Tabs.Panel>
        <Tabs.Panel value="states" pt="md">
          <StatesPage />
        </Tabs.Panel>
      </Tabs>
      <BasaltQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

function QueryClientPanel({
  staleTimeMs,
  forceError,
  setForceError,
}: {
  staleTimeMs: number
  forceError: boolean
  setForceError: (v: boolean) => void
}) {
  return (
    <>
      <Stack gap="md" p="md">
        <div>
          <Title order={3}>./query adapter</Title>
          <Text size="sm" c="dimmed" mt={4}>
            createBasaltQueryClient + unwrap + BasaltQueryDevtools (optional peer, lazy, prod-safe)
            + error-envelope edge state
          </Text>
        </div>

        <Paper p="sm">
          <Stack gap="xs">
            <Text size="xs" tt="uppercase" fw={600} c="dimmed">
              Client defaults
            </Text>
            <Text size="sm">
              staleTime: <strong>{staleTimeMs}ms</strong> · gcTime: 5 min · retry: 2 ·
              refetchOnWindowFocus: off
            </Text>
          </Stack>
        </Paper>

        <Paper p="sm">
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Text size="xs" tt="uppercase" fw={600} c="dimmed">
                Mock Eden response via unwrap()
              </Text>
              <Switch
                size="sm"
                label="Force error envelope"
                checked={forceError}
                onChange={(e) => setForceError(e.currentTarget.checked)}
              />
            </Group>
            <Text size="xs" c="dimmed">
              Toggle to simulate a server error — the mock returns{' '}
              <code>{'{ data: null, error: { message } }'}</code> and unwrap() throws, driving the
              query into the error state.
            </Text>
            <MetricsTable forceError={forceError} />
          </Stack>
        </Paper>

        <ResetBoundaryNote />
      </Stack>
    </>
  )
}
