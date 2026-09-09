import {
  ConnectivityIndicator,
  ConnectivityProvider,
  SettingsRow,
  SettingsSection,
  useConnectivity,
} from 'basalt-ui'
import type { ConnectivityOverride } from 'basalt-ui'
import { useState } from 'react'
import { Code, Divider, Group, Paper, SegmentedControl, Stack, Text } from '@mantine/core'

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
      <Paper py="xs" px="sm">
        <Text size="sm" fw={500} mb="xs">
          Current Snapshot
        </Text>
        <Code block>{JSON.stringify(snap, null, 2)}</Code>
      </Paper>
    </Stack>
  )
}

/**
 * One signal's override, as a settings ROW rather than a bare control.
 *
 * The `SegmentedControl` is declared inside the `SettingsRow` it belongs to, not in a helper handed
 * to a `control=` prop further down: a form row is law C1's third home, and
 * `basalt/control-outside-home` (warn today, error at 1.30.0) reads the control's OWN ancestry — a
 * helper component is a different subtree, so the home was invisible from where the control is
 * written. Folding the label in makes the home literal and shortens every call site.
 */
function SignalRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: SignalState
  onChange: (value: SignalState) => void
}) {
  return (
    <SettingsRow
      label={label}
      control={
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
      }
    />
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
    <Stack gap="lg" maw={600}>
      <Text size="sm" c="dimmed">
        Toggle individual signals to see how the connectivity indicator responds. The inner{' '}
        <Code>ConnectivityProvider</Code> shadows the shell&apos;s auto-mounted one.
      </Text>

      <SettingsSection
        title="Signal Overrides"
        subtitle={
          'Set each signal to "Live" (use real value from browser/RQ/SSE/health), "Online" ' +
          '(force connected), or "Offline" (force disconnected).'
        }
      >
        <SignalRow label="Browser Online" value={browserState} onChange={setBrowserState} />
        <SignalRow label="React Query Online" value={queryState} onChange={setQueryState} />
        <SignalRow label="SSE Open" value={sseState} onChange={setSseState} />
        <SignalRow label="Health Passing" value={healthState} onChange={setHealthState} />
      </SettingsSection>

      <Divider />

      <ConnectivityProvider {...(hasOverrides ? { override } : {})}>
        <ConnectivityPreview />
      </ConnectivityProvider>
    </Stack>
  )
}
