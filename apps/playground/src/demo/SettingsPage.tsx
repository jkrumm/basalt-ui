/**
 * Settings page — the theme lab + a light/dark scheme toggle + createPersistedState demo.
 *
 * Mounts `ThemeLabControls` with the framework `COLOR_GROUPS` plus an app-defined Demo group, so a
 * consumer can retune both framework chrome AND its own series colors live. Icons + the copy
 * feedback are injected by the consumer (the framework ships no icon / notification dep).
 *
 * Exercises: ThemeLabControls (groups + copyIcon/resetIcon + onCopy), COLOR_GROUPS, useMantineColorScheme,
 * createPersistedState (factory hook — survives navigate-away/back).
 */
import {
  Badge,
  Button,
  Code,
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  useMantineColorScheme,
} from '@mantine/core'
import { createPersistedState } from 'basalt-ui'
import { COLOR_GROUPS, ThemeLabControls } from 'basalt-ui/theme-lab'
import { useState } from 'react'
import { IconCopy, IconReset } from './icons'
import { DEMO_SERIES } from './series'

// ── createPersistedState demo ─────────────────────────────────────────────────
// Created once at module scope — the hook is stable across renders and tabs.
// Navigate away and back: the counter value survives (stored as basalt:settings-counter).
const useSettingsCounter = createPersistedState({ key: 'settings-counter', version: 1, initial: 0 })

function PersistedStateDemo() {
  const [count, setCount] = useSettingsCounter()
  return (
    <Paper p="sm" radius="md" withBorder>
      <Stack gap="xs">
        <Text size="xs" tt="uppercase" fw={600} c="dimmed">
          createPersistedState
        </Text>
        <Text size="sm">
          Factory hook backed by versioned localStorage. Navigate away and back — the counter
          survives. Cross-tab: open another window and click to see both stay in sync.
        </Text>
        <Group gap="sm" align="center">
          <Button size="compact-sm" variant="default" onClick={() => setCount(count - 1)}>
            −
          </Button>
          <Badge size="lg" variant="default">
            {count}
          </Badge>
          <Button size="compact-sm" variant="default" onClick={() => setCount(count + 1)}>
            +
          </Button>
          <Button size="compact-sm" variant="subtle" color="gray" onClick={() => setCount(0)}>
            Reset
          </Button>
        </Group>
      </Stack>
    </Paper>
  )
}

/** Consumer-augmented theme-lab groups: framework chrome + the app's own Demo series. */
const LAB_GROUPS = [
  ...COLOR_GROUPS,
  {
    title: 'Demo series',
    items: Object.keys(DEMO_SERIES).map((key) => ({
      var: `--vx-demo-${key}`,
      label: key[0]!.toUpperCase() + key.slice(1),
    })),
  },
]

export function SettingsPage() {
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const [copied, setCopied] = useState<string | null>(null)

  return (
    <Stack gap="md">
      <PersistedStateDemo />

      <Paper p="md" radius="md" withBorder>
        <Group justify="space-between" align="center">
          <Stack gap={2}>
            <Text fw={600}>Color scheme</Text>
            <Text size="sm" c="dimmed">
              Charts and chrome share one `--vx-*` identity — toggling restyles both with no React
              re-render.
            </Text>
          </Stack>
          <SegmentedControl
            value={colorScheme}
            onChange={(v) => setColorScheme(v as 'light' | 'dark' | 'auto')}
            data={[
              { label: 'Light', value: 'light' },
              { label: 'Dark', value: 'dark' },
              { label: 'System', value: 'auto' },
            ]}
          />
        </Group>
      </Paper>

      <Paper p="md" radius="md" withBorder>
        <Text fw={600} mb={4}>
          Theme lab
        </Text>
        <Text size="sm" c="dimmed" mb="sm">
          Live-tune the palette. Overrides are written as inline `--vx-*` styles on `&lt;html&gt;`
          and persist to localStorage.
        </Text>
        <ThemeLabControls
          groups={LAB_GROUPS}
          copyIcon={<IconCopy />}
          resetIcon={<IconReset />}
          onCopy={(json) => setCopied(json)}
        />
        {copied && (
          <Stack gap={4} mt="sm">
            <Text size="xs" c="dimmed">
              Copied overrides (paste into palette.ts to bake in):
            </Text>
            <Code block>{copied}</Code>
          </Stack>
        )}
      </Paper>
    </Stack>
  )
}
