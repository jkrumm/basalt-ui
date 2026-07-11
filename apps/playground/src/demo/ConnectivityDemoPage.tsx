import { ConnectivityIndicator, ConnectivityProvider, useConnectivity } from 'basalt-ui'
import type { ConnectivityOverride } from 'basalt-ui'
import { useState } from 'react'
import { Code, Divider, Group, Paper, SegmentedControl, Stack, Text, Title } from '@mantine/core'

type SignalState = 'live' | 'online' | 'offline'

function signalToOverride(value: SignalState): boolean | undefined {
  if (value === 'online') return true
  if (value === 'offline') return false
  return undefined
}

/** Inner component that reads connectivity and shows the indicator + raw detail. */
function ConnectivityPreview() {
  const snap = useConnectivity()
  return (
    <Stack gap="md">
      <Group>
        <Text size="sm" fw={500}>
          Header indicator preview:
        </Text>
        <ConnectivityIndicator />
      </Group>
      <Paper p="md">
        <Text size="sm" fw={500} mb="xs">
          Current Snapshot
        </Text>
        <Code block>{JSON.stringify(snap, null, 2)}</Code>
      </Paper>
    </Stack>
  )
}

function SignalToggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: SignalState
  onChange: (value: SignalState) => void
}) {
  return (
    <Group justify="space-between" wrap="nowrap">
      <Text size="sm" style={{ minWidth: 120 }}>
        {label}
      </Text>
      <SegmentedControl
        size="xs"
        data={[
          { label: 'Live', value: 'live' },
          { label: 'Online', value: 'online' },
          { label: 'Offline', value: 'offline' },
        ]}
        value={value}
        onChange={(v) => onChange(v as SignalState)}
      />
    </Group>
  )
}

function buildOverride(
  browserState: SignalState,
  queryState: SignalState,
  sseState: SignalState,
  healthState: SignalState,
): ConnectivityOverride {
  const override: ConnectivityOverride = {}
  const bo = signalToOverride(browserState)
  if (bo !== undefined) override.browserOnline = bo
  const qo = signalToOverride(queryState)
  if (qo !== undefined) override.queryOnline = qo
  const so = signalToOverride(sseState)
  if (so !== undefined) override.sseOpen = so
  const hp = signalToOverride(healthState)
  if (hp !== undefined) override.healthPassing = hp
  return override
}

export function ConnectivityDemoPage() {
  const [browserState, setBrowserState] = useState<SignalState>('live')
  const [queryState, setQueryState] = useState<SignalState>('live')
  const [sseState, setSseState] = useState<SignalState>('live')
  const [healthState, setHealthState] = useState<SignalState>('live')

  const override = buildOverride(browserState, queryState, sseState, healthState)
  const hasOverrides = Object.keys(override).length > 0

  return (
    <Stack gap="lg" p="md" maw={600}>
      <Title order={2}>Connectivity Simulator</Title>
      <Text size="sm" c="dimmed">
        Toggle individual signals to see how the connectivity indicator responds. The inner{' '}
        <Code>ConnectivityProvider</Code> shadows the shell&apos;s auto-mounted one.
      </Text>

      <Paper p="md">
        <Stack gap="xs">
          <Text size="sm" fw={500}>
            Signal Overrides
          </Text>
          <Text size="xs" c="dimmed" mb="xs">
            Set each signal to &quot;Live&quot; (use real value from browser/RQ/SSE/health),
            &quot;Online&quot; (force connected), or &quot;Offline&quot; (force disconnected).
          </Text>
          <SignalToggle label="Browser Online" value={browserState} onChange={setBrowserState} />
          <SignalToggle label="React Query Online" value={queryState} onChange={setQueryState} />
          <SignalToggle label="SSE Open" value={sseState} onChange={setSseState} />
          <SignalToggle label="Health Passing" value={healthState} onChange={setHealthState} />
        </Stack>
      </Paper>

      <Divider />

      <ConnectivityProvider {...(hasOverrides ? { override } : {})}>
        <ConnectivityPreview />
      </ConnectivityProvider>
    </Stack>
  )
}
