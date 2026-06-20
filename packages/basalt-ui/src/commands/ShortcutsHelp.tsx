/**
 * ShortcutsHelp — renders a keyboard shortcut reference list grouped by command group.
 *
 * DISPLAY ONLY in 1.0 — live key binding is deferred to 1.1 (@tanstack/react-hotkeys is alpha).
 * Reads from the active command registry at render time via `toShortcutList()`.
 *
 * Platform-aware label: 'Mod' → '⌘' on mac, 'Ctrl' elsewhere (derived from navigator.platform).
 *
 * @example
 * import { ShortcutsHelp } from 'basalt-ui/commands'
 *
 * // In a help modal or settings panel:
 * <ShortcutsHelp />
 *
 * // With a custom title and max width:
 * <ShortcutsHelp title="Keyboard shortcuts" maw={480} />
 */
import { Box, Group, Kbd, Stack, Text, Title } from '@mantine/core'
import { toShortcutList } from './projectors'

export type ShortcutsHelpProps = {
  /** Section title. Default: 'Keyboard shortcuts'. */
  title?: string
  /** Max-width passthrough (Mantine style prop). */
  maw?: number | string
}

// ── Platform detection ────────────────────────────────────────────────────────

/**
 * Returns true when running on macOS (client-side only; SSR-safe — defaults false).
 * Used to replace 'Mod' with '⌘' vs 'Ctrl'.
 */
function isMac(): boolean {
  if (typeof navigator === 'undefined') return false
  return /mac/i.test(navigator.platform)
}

// ── Shortcut label rendering ──────────────────────────────────────────────────

/**
 * Convert a shortcut string to a list of Kbd-friendly tokens.
 * 'Mod+S' → ['⌘', 'S'] (mac) or ['Ctrl', 'S'] (other).
 * 'Shift+Mod+P' → ['⇧', '⌘', 'P'] (mac) or ['Shift', 'Ctrl', 'P'] (other).
 */
function parseShortcut(shortcut: string): string[] {
  const mac = isMac()
  return shortcut.split('+').map((key) => {
    switch (key.toLowerCase()) {
      case 'mod':
        return mac ? '⌘' : 'Ctrl'
      case 'shift':
        return mac ? '⇧' : 'Shift'
      case 'alt':
        return mac ? '⌥' : 'Alt'
      case 'meta':
        return '⌘'
      case 'ctrl':
        return mac ? '^' : 'Ctrl'
      default:
        return key.toUpperCase()
    }
  })
}

// ── ShortcutRow ───────────────────────────────────────────────────────────────

function ShortcutRow({ label, shortcut }: { label: string; shortcut: string }) {
  const keys = parseShortcut(shortcut)
  return (
    <Group justify="space-between" gap="xs" py={2}>
      <Text size="sm">{label}</Text>
      <Group gap={4}>
        {keys.map((key, i) => (
          <Kbd key={i} size="xs">
            {key}
          </Kbd>
        ))}
      </Group>
    </Group>
  )
}

// ── ShortcutsHelp ─────────────────────────────────────────────────────────────

/**
 * Renders all registered commands that have a `shortcut` field, grouped by `group`.
 * Commands with no `group` are rendered under an implicit ungrouped section.
 *
 * Returns `null` when no commands have shortcuts registered.
 *
 * @example
 * <ShortcutsHelp title="Keyboard shortcuts" />
 */
export function ShortcutsHelp({ title = 'Keyboard shortcuts', maw }: ShortcutsHelpProps) {
  const shortcuts = toShortcutList()

  if (shortcuts.length === 0) return null

  // Group shortcuts by group name; ungrouped go under the empty-string key
  const grouped = new Map<string, typeof shortcuts>()
  for (const entry of shortcuts) {
    const key = entry.group ?? ''
    const bucket = grouped.get(key)
    if (bucket !== undefined) {
      bucket.push(entry)
    } else {
      grouped.set(key, [entry])
    }
  }

  return (
    <Box maw={maw}>
      <Title order={5} mb="sm">
        {title}
      </Title>
      <Stack gap="md">
        {[...grouped.entries()].map(([group, entries]) => (
          <Stack key={group} gap={2}>
            {group !== '' && (
              <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb={4}>
                {group}
              </Text>
            )}
            {entries.map((entry) => (
              <ShortcutRow key={entry.id} label={entry.label} shortcut={entry.shortcut} />
            ))}
          </Stack>
        ))}
      </Stack>
    </Box>
  )
}
