/**
 * CommandsDemoPage — exercises basalt-ui/commands:
 * runCommand, defineOverlays, overlays.open, toSpotlightActions,
 * ShortcutsHelp, BasaltOverlays, useCommandHotkeys (live keybindings), openSpotlight.
 *
 * The commands themselves (including this page's `demo:*` showcase set) are registered once, at
 * app boot, in `./commands.ts` — see that file's header for why: `defineCommands`'s own contract
 * is "call it once, the last call wins", so a real app's whole registry lives in one dedicated
 * file, imported eagerly by main.tsx. This page only *exercises* that shared registry (runCommand,
 * useCommandHotkeys, ShortcutsHelp) and augments `BasaltRegister.overlays` for its demo overlay.
 *
 * LIVE KEYBINDINGS PROOF: Pressing Mod+G greets, Mod+L logs to console, Mod+T toggles
 * the highlight box below. useCommandHotkeys() is called here so the shortcuts are active
 * while this page is rendered.
 */
import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Divider, Group, Paper, Stack, Text, Title } from '@mantine/core'
import {
  defineOverlays,
  openSpotlight,
  overlays,
  runCommand,
  ShortcutsHelp,
  toShortcutList,
  toSpotlightActions,
  useCommandHotkeys,
} from 'basalt-ui/commands'
import { registerDemoToggleSetter } from './commands'

// ── Typed registry augmentation ───────────────────────────────────────────────
// commands.ts owns the `commands` slot augmentation (it's the single defineCommands call); this
// page only adds its own demo overlay to the `overlays` slot.
declare module 'basalt-ui' {
  interface BasaltRegister {
    overlays: typeof DEMO_OVERLAYS
  }
}

// ── Demo overlay registry ─────────────────────────────────────────────────────

const DEMO_OVERLAYS = defineOverlays({
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
        <code>defineCommands</code> are projected automatically. Spotlight uses a basalt-owned store
        (<code>basaltSpotlight</code>) — import <code>openSpotlight</code> from{' '}
        <code>basalt-ui/commands</code> for programmatic control.
      </Text>
      <Group gap="xs">
        <Button size="compact-sm" variant="default" onClick={() => openSpotlight()}>
          Open Spotlight
        </Button>
      </Group>
    </Stack>
  )
}

function LiveHotkeysSection({ toggled }: { toggled: boolean }) {
  const shortcuts = toShortcutList()
  const spotlightActions = toSpotlightActions()
  return (
    <Stack gap="xs">
      <Text size="xs" tt="uppercase" fw={600} c="dimmed">
        Live keybindings (useCommandHotkeys)
      </Text>
      <Text size="sm">
        <code>useCommandHotkeys()</code> is called in this page — the shortcuts below are LIVE.
        Press them now and observe the effect.
      </Text>
      <Alert color={toggled ? 'teal' : 'gray'} title={toggled ? 'Toggled ON ✓' : 'Toggled OFF'}>
        Press <kbd>Mod+T</kbd> to toggle this box. Each press runs the <code>demo:toggle</code>{' '}
        command via live keybinding.
      </Alert>
      <Paper p="sm">
        <Stack gap={4}>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb={4}>
            Active shortcuts ({shortcuts.length}) · Spotlight actions ({spotlightActions.length})
          </Text>
          {shortcuts.map((s) => (
            <Group key={s.id} justify="space-between" gap="xs">
              <Text size="sm">{s.label}</Text>
              <Badge size="sm" variant="outline">
                {s.shortcut}
              </Badge>
            </Group>
          ))}
        </Stack>
      </Paper>
    </Stack>
  )
}

function RunCommandSection() {
  return (
    <Stack gap="xs">
      <Text size="xs" tt="uppercase" fw={600} c="dimmed">
        runCommand
      </Text>
      <Group gap="xs" wrap="wrap">
        <Button size="compact-sm" color="blue" onClick={() => runCommand('demo:greet')}>
          demo:greet
        </Button>
        <Button size="compact-sm" color="blue" onClick={() => runCommand('demo:log')}>
          demo:log (console)
        </Button>
        <Button size="compact-sm" color="teal" onClick={() => runCommand('demo:toggle')}>
          demo:toggle (Mod+T)
        </Button>
        <Button size="compact-sm" color="blue" onClick={() => runCommand('demo:async')}>
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
            overlays.open('demo:info', { message: 'Opened via overlays.open() directly!' })
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
        Renders all commands with a <code>shortcut</code> field, grouped by group. Platform-aware: ⌘
        on macOS, Ctrl on other platforms.
      </Text>
      <Paper p="sm">
        <ShortcutsHelp title="Demo shortcuts" />
      </Paper>
    </Stack>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function CommandsDemoPage() {
  const [toggled, setToggled] = useState(false)

  // Wire commands.ts's demo:toggle target to this component's state while mounted; clear it on
  // unmount so a stray Mod+T elsewhere in the app is a safe no-op.
  useEffect(() => {
    registerDemoToggleSetter(setToggled)
    return () => registerDemoToggleSetter(null)
  }, [])

  // LIVE KEYBINDINGS: activate all registered command shortcuts for this page.
  // useCommandHotkeys() degrades to a no-op when @tanstack/react-hotkeys is absent.
  useCommandHotkeys()

  return (
    <Stack gap="md" p="md">
      <div>
        <Title order={3}>./commands adapter</Title>
        <Text size="sm" c="dimmed" mt={4}>
          defineCommands + runCommand + defineOverlays + overlays.open + Spotlight + ShortcutsHelp +
          BasaltOverlays mount + useCommandHotkeys (live keybindings)
        </Text>
      </div>

      <Paper p="sm">
        <Stack gap="xs">
          <Text size="xs" tt="uppercase" fw={600} c="dimmed">
            About
          </Text>
          <Text size="sm">
            The <code>./commands</code> battery provides a typed command bus (defineCommands +
            runCommand), a typed overlay controller (defineOverlays + overlays.open), Spotlight
            projection (toSpotlightActions) with a live basalt-owned store, a shortcut display
            (ShortcutsHelp), live keybindings (useCommandHotkeys), and a composable overlay mount
            (BasaltOverlays) that bundles ModalsProvider + Spotlight + Notifications + hotkeys.
          </Text>
        </Stack>
      </Paper>

      <Paper p="sm">
        <Stack gap="md">
          <LiveHotkeysSection toggled={toggled} />
          <Divider />
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
