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
import type { ReactNode } from 'react'
import { OverflowMenu } from '../controls/actions'
import type { BarAction } from '../controls/actions'
import classes from './sidebar-search.module.css'

/**
 * The ⌘K row's trailing icon buttons — ONE or TWO, by type (`docs/CONTROLS-SPEC.md` §2.3).
 *
 * The tuple IS the enforcement: a third button pushes the search trigger under the width where its
 * placeholder stays readable, and there is no third thing a sidebar search row is for. Each entry
 * renders icon-only at the `icon` tier (24px, `--ai-size-icon`) with `label` demoted to the
 * accessible name; a `kind: 'menu'` entry becomes an `OverflowMenu` kebab, a `kind: 'custom'` one
 * is mounted verbatim.
 */
export type SidebarSearchActions = [BarAction] | [BarAction, BarAction]

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

/** The first grapheme of a label — the fallback body for an action shipping no icon. */
function initial(label: string): string {
  return [...label][0]?.toUpperCase() ?? '?'
}

/**
 * One trailing action as an icon-only button. `size="icon"` is EXPLICIT here, not inherited: the
 * search row is chrome, not a control home, so no `CtlSlot` wraps it and nothing else would resolve
 * the tier (`--ai-size-icon`, declared by `cssVariablesResolver` — spec §5).
 */
function SearchAction({ action }: { action: BarAction }): ReactNode {
  if (action.kind === 'custom') return action.node
  if (action.kind === 'menu') {
    return <OverflowMenu actions={action.items} trigger="kebab" label={action.label} />
  }
  const shared = {
    variant: 'subtle' as const,
    size: 'icon',
    className: classes.actionBtn,
    'aria-label': action.label,
    disabled: action.disabled === true,
    ...(action.onClick !== undefined && { onClick: action.onClick }),
  }
  const body = action.icon ?? initial(action.label)
  const Anchor = action.Anchor
  if (Anchor !== undefined) {
    return (
      <ActionIcon component={Anchor} {...shared}>
        {body}
      </ActionIcon>
    )
  }
  if (action.link !== undefined) {
    return (
      <ActionIcon component="a" href={action.link.to} {...shared}>
        {body}
      </ActionIcon>
    )
  }
  return <ActionIcon {...shared}>{body}</ActionIcon>
}

export function SidebarSearch({
  onOpen,
  placeholder = 'Search…',
  shortcut,
  actions,
  collapsed,
}: SidebarSearchConfig & { actions?: SidebarSearchActions; collapsed?: boolean }) {
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

  const trigger = (
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

  // No wrapper without actions — the trigger stays the row's only node, exactly as it shipped.
  if (actions === undefined) return trigger

  return (
    <div className={classes.row}>
      {trigger}
      {actions.map((action) => (
        <SearchAction key={action.key} action={action} />
      ))}
    </div>
  )
}
