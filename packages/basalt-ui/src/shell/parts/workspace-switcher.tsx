/**
 * The workspace switcher, in the brand zone: a `Menu` whose trigger is the current workspace's face
 * and name, and whose list is every option as a radio row, then the app's manage link. The rail
 * collapsed (64 px) leaves the face alone; the zone's container is the shell root, so the name
 * hides by the same `data-rail` rules the brand name does. The trigger keeps its accessible name.
 */
import type { ReactElement } from 'react'
import { AppLink } from '../../core/link'
import { cn } from '../../core/cn'
import { Avatar } from '../../ui/avatar'
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from '../../ui/menu'
import type { Workspace, WorkspaceSwitcher as WorkspaceSwitcherProps } from '../contract'
import { RAIL_TEXT } from './rail-text'

/** The classes that hide the name and the chevron while the rail is 64 px. */
export const WORKSPACE_COLLAPSED_HIDE =
  'group-data-[rail=collapsed]/shell:md:hidden group-data-[rail=auto]/shell:md:max-xl:hidden'

/** The workspace's face: its image, else its glyph, else its initials. */
export function WorkspaceFace({ workspace }: { workspace: Workspace }): ReactElement {
  return (
    <Avatar
      name={workspace.label}
      aria-hidden="true"
      size="sm"
      shape="object"
      {...(workspace.avatar !== undefined && { src: workspace.avatar })}
      {...(workspace.icon !== undefined && { icon: workspace.icon })}
    />
  )
}

export function WorkspaceMenu({
  workspace,
  className,
}: {
  workspace: WorkspaceSwitcherProps
  className?: string
}): ReactElement {
  const { current, options, onSwitch, manage } = workspace
  return (
    <Menu>
      <MenuTrigger
        aria-label={`${RAIL_TEXT.switchWorkspace}: ${current.label}`}
        data-slot="shell-workspace"
        className={cn(
          'flex h-8 min-w-0 cursor-pointer items-center gap-2 rounded-ctrl px-1.5 text-start text-sm font-semibold text-foreground hover:bg-accent',
          'group-data-[rail=collapsed]/shell:md:justify-center group-data-[rail=auto]/shell:md:max-xl:justify-center',
          className,
        )}
      >
        <WorkspaceFace workspace={current} />
        <span className={cn('min-w-0 flex-1 truncate font-head', WORKSPACE_COLLAPSED_HIDE)}>
          {current.label}
        </span>
        <svg
          viewBox="0 0 16 16"
          className={cn('size-icon shrink-0 text-faint', WORKSPACE_COLLAPSED_HIDE)}
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5 6.5l3-3 3 3M5 9.5l3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </MenuTrigger>
      <MenuContent side="bottom" align="start" className="w-56">
        <MenuGroup label={RAIL_TEXT.switchWorkspace}>
          <MenuRadioGroup
            value={current.id}
            onValueChange={(id: string) => {
              if (id !== current.id) onSwitch(id)
            }}
          >
            {options.map((option) => (
              <MenuRadioItem key={option.id} value={option.id}>
                <span className="flex min-w-0 items-center gap-2">
                  <WorkspaceFace workspace={option} />
                  <span className="truncate">{option.label}</span>
                </span>
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuGroup>
        {manage !== undefined && (
          <>
            <MenuSeparator />
            <MenuItem render={<AppLink href={manage.href} />}>{manage.label}</MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  )
}
