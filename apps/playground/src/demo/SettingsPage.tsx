/**
 * Settings page — the theme lab + a light/dark scheme toggle.
 *
 * Mounts `ThemeLabControls` with the framework `COLOR_GROUPS` plus an app-defined Demo group, so a
 * consumer can retune both framework chrome AND its own series colors live. Icons + the copy
 * feedback are injected by the consumer (the framework ships no icon / notification dep).
 *
 * Exercises: ThemeLabControls (groups + copyIcon/resetIcon + onCopy), COLOR_GROUPS, useMantineColorScheme.
 */
import {
  Code,
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  useMantineColorScheme,
} from '@mantine/core'
import { COLOR_GROUPS, ThemeLabControls } from 'basalt-ui/theme-lab'
import { useState } from 'react'
import { IconCopy, IconReset } from './icons'
import { DEMO_SERIES } from './series'

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

  const scheme = colorScheme === 'auto' ? 'dark' : colorScheme

  return (
    <Stack gap="md">
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
            value={scheme}
            onChange={(v) => setColorScheme(v as 'light' | 'dark')}
            data={[
              { label: 'Light', value: 'light' },
              { label: 'Dark', value: 'dark' },
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
