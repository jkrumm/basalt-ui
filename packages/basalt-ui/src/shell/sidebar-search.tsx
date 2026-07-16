/**
 * Presentational search field rendered directly below the sidebar brand (see the `search` slot on
 * `AppSidebar`/`BasaltShell`). It never imports `basalt-ui/commands` — the consumer wires `onOpen`
 * to whatever palette it uses (typically `openSpotlight` from `basalt-ui/commands`), keeping the
 * shell free of the optional Spotlight peer.
 *
 * Visually replicates the former header search trigger (argo/playground `SearchTrigger`): panel
 * surface + shadow-card, control radius, faint icon/label, mono `Kbd` shortcut hint.
 */
import { ActionIcon, Kbd, Text, UnstyledButton } from '@mantine/core'
import classes from './sidebar-search.module.css'

export type SidebarSearchConfig = {
  /** Opens the search palette — e.g. `openSpotlight` from `basalt-ui/commands`. */
  onOpen: () => void
  /** Placeholder text. Default 'Search…'. */
  placeholder?: string
  /** Keyboard-shortcut hint shown on the right (e.g. '⌘K'). Auto-detected mac/other when omitted. */
  shortcut?: string
}

/** Inline magnifier glyph — keeps the shell icon-dependency-free. */
function IconSearch() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35 -4.35" />
    </svg>
  )
}

export function SidebarSearch({
  onOpen,
  placeholder = 'Search…',
  shortcut,
  collapsed,
}: SidebarSearchConfig & { collapsed?: boolean }) {
  // SSR-safe mac detection, matching the shell's other shortcut-hint logic.
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform)
  const hint = shortcut ?? (isMac ? '⌘K' : 'Ctrl K')

  if (collapsed) {
    return (
      <ActionIcon
        variant="subtle"
        size="md"
        className={classes.railBtn}
        onClick={onOpen}
        aria-label="Open search"
      >
        <IconSearch />
      </ActionIcon>
    )
  }

  return (
    <UnstyledButton
      type="button"
      className={classes.trigger}
      onClick={onOpen}
      aria-label="Open search"
    >
      <IconSearch />
      <Text component="span" className={classes.label}>
        {placeholder}
      </Text>
      <Kbd size="xs">{hint}</Kbd>
    </UnstyledButton>
  )
}
