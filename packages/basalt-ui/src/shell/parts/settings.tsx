/**
 * The rail's Settings row: one footer row (gear + "Settings") opening a `Menu` of
 * `settings.items`. Collapsed, the row is icon-only with a Tooltip, and the one rail projection of
 * a `progress` block lands here: a ring around the gear (`ring`), absent while the rail is open.
 */
import type { ReactElement } from 'react'
import { cn } from '../../core/cn'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../../ui/menu'
import { Ring } from '../../ui/progress'
import { Tooltip } from '../../ui/tooltip'
import type { SettingsConfig } from '../contract'
import { useRailControl } from './grid'

const COLLAPSED = '@max-[120px]'

function Gear(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-icon"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export type RailSettingsProps = {
  settings: SettingsConfig | undefined
  /** The collapsed rail's stand-in for a `progress` block; `value` is a fraction, 0 to 1. */
  ring: { value: number; label: string } | undefined
}

/** One footer row, or null when there is nothing to open. */
export function RailSettings({ settings, ring }: RailSettingsProps): ReactElement | null {
  const { collapsed } = useRailControl()
  if (settings === undefined || settings.items.length === 0) return null
  return (
    <Menu>
      <Tooltip label="Settings" side="right" disabled={!collapsed}>
        <MenuTrigger
          aria-label="Settings"
          className={cn(
            'flex h-8 w-full min-w-0 cursor-pointer items-center gap-2 rounded-ctrl px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground',
            `${COLLAPSED}:justify-center`,
          )}
        >
          <span className="relative grid size-6 shrink-0 place-items-center">
            <Gear />
            {ring !== undefined && (
              <Ring
                value={Math.min(1, Math.max(0, ring.value)) * 100}
                aria-label={ring.label}
                className={cn(
                  'absolute inset-0 size-6 [&>span]:hidden',
                  'hidden',
                  `${COLLAPSED}:inline-grid`,
                )}
              />
            )}
          </span>
          <span className={cn('truncate', `${COLLAPSED}:hidden`)}>Settings</span>
        </MenuTrigger>
      </Tooltip>
      <MenuContent side="right" align="end">
        {settings.items.map((item) => {
          const Icon = item.icon
          return (
            <MenuItem key={item.id} onClick={item.onClick}>
              <span className="flex items-center gap-2">
                {Icon !== undefined && <Icon className="size-icon" aria-hidden />}
                {item.label}
              </span>
            </MenuItem>
          )
        })}
      </MenuContent>
    </Menu>
  )
}
