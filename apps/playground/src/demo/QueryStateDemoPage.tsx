/**
 * QueryStateDemoPage — every branch of `QueryState`, driven from one control row.
 *
 * The point of the page is the branch that used to be missing: flip to "server 500" and the
 * region must show the DECODED server message with a Retry, never "No results". Flip to
 * "opaque 500" and it must show the fallback copy plus the HTTP status rather than a literal `{}`.
 *
 * The "malformed result" switch drops `isError` from the object passed in, which throws — a
 * structural subset cannot be compile-checked, and a silently missing branch flag is exactly how
 * a 500 came to render as an empty state in the first place.
 */
import { Alert, Button, Code, Group, Paper, Skeleton, Stack, Switch, Text } from '@mantine/core'
import { ErrorState, LoadingState, QueryState, Section } from 'basalt-ui'
import type { QueryStateLike } from 'basalt-ui'
import { ViewTabs } from 'basalt-ui/controls'
import { createLocalStore, field } from 'basalt-ui/state'
import { Component, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

type Row = { id: number; label: string }

const ROWS: Row[] = [
  { id: 1, label: 'fuji/2026-04-porto' },
  { id: 2, label: 'fuji/2026-05-lisbon' },
  { id: 3, label: 'share/friends' },
]

const SCENARIO_VALUES = [
  'success',
  'loading',
  'empty',
  'disabled',
  'error',
  'opaque',
  'stale',
] as const
type Scenario = (typeof SCENARIO_VALUES)[number]

const SCENARIOS: { value: Scenario; label: string }[] = [
  { value: 'success', label: 'Success' },
  { value: 'loading', label: 'Loading' },
  { value: 'empty', label: 'Empty' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'error', label: 'Server 500' },
  { value: 'opaque', label: 'Opaque 500' },
  { value: 'stale', label: 'Stale + failed refresh' },
]

function buildQuery(scenario: Scenario, refetch: () => void): QueryStateLike<Row[]> {
  const base = { isError: false, error: null, refetch } as const
  switch (scenario) {
    case 'success':
      return { ...base, data: ROWS, fetchStatus: 'idle' }
    case 'empty':
      return { ...base, data: [], fetchStatus: 'idle' }
    case 'loading':
      return { ...base, data: undefined, fetchStatus: 'fetching' }
    // `enabled: false` — nothing was ever asked for, so this is empty, not pending.
    case 'disabled':
      return { ...base, data: undefined, fetchStatus: 'idle' }
    case 'error':
      return {
        ...base,
        isError: true,
        error: { status: 500, value: { message: 'the index is rebuilding — try again shortly' } },
        data: undefined,
        fetchStatus: 'idle',
      }
    case 'opaque':
      return {
        ...base,
        isError: true,
        error: { status: 502, value: {} },
        data: undefined,
        fetchStatus: 'idle',
      }
    case 'stale':
      return {
        ...base,
        isError: true,
        error: new Error('connection reset'),
        data: ROWS,
        fetchStatus: 'idle',
      }
  }
}

/** Catches the deliberate throw so the page stays usable while demonstrating it. */
class ThrowBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  override state = { message: null as string | null }
  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : String(error) }
  }
  override componentDidCatch(_error: Error, _info: ErrorInfo) {
    // The demo shows the message in-page; nothing to report.
  }
  override render() {
    if (this.state.message !== null)
      return (
        <Alert color="orange" variant="light" title="QueryState threw — as designed">
          <Code block>{this.state.message}</Code>
        </Alert>
      )
    return this.props.children
  }
}

/**
 * The scenario axis is a `createLocalStore` field, not `useState`: a tab is state (law C3), and the
 * local lane is what a control that has no business in the URL binds to. Same `FieldHandle`, so
 * `ViewTabs` cannot tell this store from a `createSearchStore` one.
 */
const demoStore = createLocalStore({
  key: 'query-state-demo',
  fields: { scenario: field.enum(SCENARIO_VALUES, 'success') },
})

export function QueryStateDemoPage() {
  const [scenario] = demoStore.field.scenario.use()
  const [malformed, setMalformed] = useState(false)
  const [skeleton, setSkeleton] = useState(false)
  const [retries, setRetries] = useState(0)

  const query = buildQuery(scenario, () => setRetries((n) => n + 1))
  // Drop the branch flag a structural subset cannot police.
  const passed = malformed
    ? ({ ...query, isError: undefined } as unknown as QueryStateLike<Row[]>)
    : query

  return (
    <Stack gap="lg">
      {/* The scenario switcher and the two flags are the section's HEADER slots (law C1) — the row
          of ephemeral controls that used to sit in the body is gone, and with it the `size="xs"`
          on each one: a home sets the tier (law C5). */}
      <Section
        title="QueryState"
        subtitle={`Loading / error-with-retry / empty / success around one async result — the sibling EmptyState shipped without. refetch() calls: ${retries}`}
        tabs={<ViewTabs field={demoStore.field.scenario} options={SCENARIOS} />}
        actions={
          <Group gap="lg" wrap="nowrap">
            <Switch
              label="Skeletons"
              checked={skeleton}
              onChange={(event) => setSkeleton(event.currentTarget.checked)}
            />
            <Switch
              label="Malformed"
              checked={malformed}
              onChange={(event) => setMalformed(event.currentTarget.checked)}
            />
          </Group>
        }
      >
        <Paper py="xs" px="sm" withBorder mih={220}>
          <ThrowBoundary key={`${scenario}-${String(malformed)}-${String(skeleton)}`}>
            <QueryState
              query={passed}
              variant="section"
              errorTitle="Could not load albums"
              errorFallback="The library did not answer."
              errorAction={
                <Button size="xs" variant="subtle">
                  Back to shares
                </Button>
              }
              empty={{
                title: 'No albums yet',
                description: 'Tag images in Lightroom and re-index to see them here.',
                action: <Button size="xs">Re-index</Button>,
              }}
              {...(skeleton && {
                loading: (
                  <Stack gap={4}>
                    {Array.from({ length: 4 }, (_, i) => (
                      <Skeleton key={`s-${i}`} h={28} radius="sm" />
                    ))}
                  </Stack>
                ),
              })}
            >
              {(rows) => (
                <Stack gap={4}>
                  {rows.map((row) => (
                    <Text key={row.id} size="sm">
                      {row.label}
                    </Text>
                  ))}
                </Stack>
              )}
            </QueryState>
          </ThrowBoundary>
        </Paper>
      </Section>

      <Section
        title="The building blocks, used directly"
        subtitle="An auth gate or an error boundary renders these outside a query."
      >
        <Group align="flex-start" grow>
          <Paper py="xs" px="sm" withBorder>
            <LoadingState variant="section" label="Minting an asset token" />
          </Paper>
          <Paper py="xs" px="sm" withBorder>
            <ErrorState
              error={{ status: 401, value: {} }}
              title="Could not start the admin"
              fallback="Minting the image asset token failed. The API may be down."
              variant="section"
              onRetry={() => setRetries((n) => n + 1)}
              action={
                <Button size="xs" variant="subtle">
                  Use a different token
                </Button>
              }
            />
          </Paper>
        </Group>
      </Section>
    </Stack>
  )
}
