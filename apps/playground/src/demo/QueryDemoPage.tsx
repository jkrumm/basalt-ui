/**
 * QueryDemoPage — exercises createBasaltQueryClient, unwrap, QueryClientProvider,
 * and BasaltQueryDevtools from basalt-ui/query with a mock Eden-shaped response.
 * No backend required: the mock queryFn resolves a static { data, error } envelope.
 */
import { Badge, Paper, Stack, Table, Text, Title } from '@mantine/core'
import {
  BasaltQueryDevtools,
  createBasaltQueryClient,
  QueryClientProvider,
  unwrap,
  useQueryErrorResetBoundary,
} from 'basalt-ui/query'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

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

/** Simulates an Eden Treaty `.get()` call returning a { data, error } envelope. */
function mockFetchMetrics(): Promise<{ data: MetricRow[]; error: null }> {
  return Promise.resolve({ data: MOCK_ROWS, error: null })
}

// ── Inner content (must be inside QueryClientProvider) ────────────────────────────────────────────

function MetricsTable() {
  const { data, isFetching } = useQuery({
    queryKey: ['demo', 'metrics'],
    queryFn: () => unwrap(mockFetchMetrics()),
  })

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
  const [client] = useState(() => createBasaltQueryClient())
  const staleTimeMs = useMemo(() => {
    const st = client.getDefaultOptions().queries?.staleTime
    return typeof st === 'number' ? st : 30_000
  }, [client])

  return (
    <QueryClientProvider client={client}>
      <Stack gap="md" p="md">
        <div>
          <Title order={3}>./query adapter</Title>
          <Text size="sm" c="dimmed" mt={4}>
            createBasaltQueryClient + unwrap + BasaltQueryDevtools (optional peer, lazy, prod-safe)
          </Text>
        </div>

        <Paper p="sm" radius="md" withBorder>
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

        <Paper p="sm" radius="md" withBorder>
          <Stack gap="sm">
            <Text size="xs" tt="uppercase" fw={600} c="dimmed">
              Mock Eden response via unwrap()
            </Text>
            <MetricsTable />
          </Stack>
        </Paper>

        <ResetBoundaryNote />
      </Stack>

      <BasaltQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
