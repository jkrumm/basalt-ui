/**
 * CommandsDemoPage — exercises basalt-ui/commands:
 * defineCommands, runCommand, defineOverlays, overlays.open, toSpotlightActions,
 * ShortcutsHelp, BasaltOverlays. Commands + overlays are defined here inline for demo;
 * in a real app they would live in dedicated app-level files with a BasaltRegister augment.
 */
import { Button, Divider, Group, Paper, Stack, Text, Title } from '@mantine/core'
import { spotlight } from '@mantine/spotlight'
import {
  defineCommands,
  defineOverlays,
  overlays,
  runCommand,
  ShortcutsHelp,
} from 'basalt-ui/commands'

// ── Demo command registry ─────────────────────────────────────────────────────

// NOTE: in a real app, call defineCommands once in a dedicated commands.ts file
// and augment BasaltRegister.commands there. This page-local call is demo-only.
const DEMO_COMMANDS = defineCommands({
  'demo:greet': {
    label: 'Greet user',
    group: 'Demo',
    shortcut: 'Mod+G',
    run: () => {
      // eslint-disable-next-line no-alert
      alert('Hello from the command bus!')
    },
  },
  'demo:log': {
    label: 'Log to console',
    group: 'Demo',
    shortcut: 'Mod+L',
    run: () => {
      // oxlint-disable-next-line no-console
      console.log('[basalt commands] runCommand demo triggered')
    },
  },
  'demo:overlay': {
    label: 'Open demo overlay',
    group: 'Demo',
    shortcut: 'Mod+Shift+O',
    run: () => {
      // Cast needed: BasaltRegister.overlays is not augmented in the demo (no top-level augment)
      overlays.open('demo:info' as Parameters<typeof overlays.open>[0], {
        message: 'Opened from the command bus!',
      })
    },
  },
  'demo:async': {
    label: 'Async command (1s delay)',
    group: 'Demo',
    run: async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      // oxlint-disable-next-line no-console
      console.log('[basalt commands] async command finished')
    },
  },
})

// The demo augment below would normally live in a top-level commands.ts:
// declare module 'basalt-ui' { interface BasaltRegister { commands: typeof DEMO_COMMANDS } }
// We omit it here to keep this page self-contained (CommandId would be never without the augment).
// The buttons below call runCommand via the string cast path — a real app would use the typed form.
void DEMO_COMMANDS // satisfy TS "declared but never read"

// ── Demo overlay registry ─────────────────────────────────────────────────────

defineOverlays({
  'demo:info': {
    title: 'Demo overlay',
    render: (p: { message: string }) => (
      <Stack gap="sm" p="sm">
        <Text size="sm">{p.message}</Text>
        <Text size="xs" c="dimmed">
          This overlay was opened via overlays.open() from basalt-ui/commands, backed by
          @mantine/modals.
        </Text>
        <Button size="compact-sm" variant="default" onClick={() => overlays.close()}>
          Close
        </Button>
      </Stack>
    ),
  },
})

// ── Demo sections ─────────────────────────────────────────────────────────────

function SpotlightSection() {
  return (
    <Stack gap="xs">
      <Text size="xs" tt="uppercase" fw={600} c="dimmed">
        Spotlight (mod + K)
      </Text>
      <Text size="sm">
        The command palette is mounted via <code>BasaltOverlays</code> in main.tsx. Press{' '}
        <kbd>Mod+K</kbd> or click the button to open it. Commands registered via{' '}
        <code>defineCommands</code> are projected automatically.
      </Text>
      <Group gap="xs">
        <Button size="compact-sm" variant="default" onClick={() => spotlight.open()}>
          Open Spotlight
        </Button>
      </Group>
    </Stack>
  )
}

function RunCommandSection() {
  // In a real app with BasaltRegister.commands augmented, these would be:
  //   runCommand('demo:greet')  — but without the augment CommandId = never
  // We use a cast so the demo compiles without the augment.
  type AnyId = Parameters<typeof runCommand>[0]

  return (
    <Stack gap="xs">
      <Text size="xs" tt="uppercase" fw={600} c="dimmed">
        runCommand
      </Text>
      <Group gap="xs" wrap="wrap">
        <Button size="compact-sm" color="blue" onClick={() => runCommand('demo:greet' as AnyId)}>
          demo:greet
        </Button>
        <Button size="compact-sm" color="blue" onClick={() => runCommand('demo:log' as AnyId)}>
          demo:log (console)
        </Button>
        <Button size="compact-sm" color="blue" onClick={() => runCommand('demo:async' as AnyId)}>
          demo:async (1s)
        </Button>
      </Group>
    </Stack>
  )
}

function OverlaysSection() {
  return (
    <Stack gap="xs">
      <Text size="xs" tt="uppercase" fw={600} c="dimmed">
        overlays.open
      </Text>
      <Text size="sm">
        Opens a modal via <code>@mantine/modals</code>. <code>BasaltOverlays</code> mounts{' '}
        <code>ModalsProvider</code> automatically.
      </Text>
      <Group gap="xs" wrap="wrap">
        <Button
          size="compact-sm"
          color="violet"
          onClick={() =>
            overlays.open('demo:info' as Parameters<typeof overlays.open>[0], {
              message: 'Opened via overlays.open() directly!',
            })
          }
        >
          overlays.open('demo:info', …)
        </Button>
        <Button size="compact-sm" variant="default" onClick={() => overlays.close()}>
          overlays.close()
        </Button>
      </Group>
    </Stack>
  )
}

function ShortcutsSection() {
  return (
    <Stack gap="xs">
      <Text size="xs" tt="uppercase" fw={600} c="dimmed">
        ShortcutsHelp
      </Text>
      <Text size="sm">
        Renders all commands with a <code>shortcut</code> field, grouped by group. Display-only in
        1.0 — live binding deferred to 1.1.
      </Text>
      <Paper p="sm" radius="sm" withBorder>
        <ShortcutsHelp title="Demo shortcuts" />
      </Paper>
    </Stack>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function CommandsDemoPage() {
  return (
    <Stack gap="md" p="md">
      <div>
        <Title order={3}>./commands adapter</Title>
        <Text size="sm" c="dimmed" mt={4}>
          defineCommands + runCommand + defineOverlays + overlays.open + Spotlight + ShortcutsHelp +
          BasaltOverlays mount
        </Text>
      </div>

      <Paper p="sm" radius="md" withBorder>
        <Stack gap="xs">
          <Text size="xs" tt="uppercase" fw={600} c="dimmed">
            About
          </Text>
          <Text size="sm">
            The <code>./commands</code> battery provides a typed command bus (defineCommands +
            runCommand), a typed overlay controller (defineOverlays + overlays.open), Spotlight
            projection (toSpotlightActions), a shortcut display (ShortcutsHelp), and a composable
            overlay mount (BasaltOverlays) that bundles ModalsProvider + Spotlight + Notifications
            in one mount point.
          </Text>
        </Stack>
      </Paper>

      <Paper p="sm" radius="md" withBorder>
        <Stack gap="md">
          <SpotlightSection />
          <Divider />
          <RunCommandSection />
          <Divider />
          <OverlaysSection />
          <Divider />
          <ShortcutsSection />
        </Stack>
      </Paper>
    </Stack>
  )
}
