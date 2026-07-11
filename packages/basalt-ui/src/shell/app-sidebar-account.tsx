/**
 * SidebarAccount — presentational sidebar-footer row for the framework-provided account contract
 * (`BasaltAccountProps`, see `account-types.ts`). Zero auth logic: it renders whatever
 * `BasaltAccountState` the consumer derives from its own auth client and calls back through
 * `BasaltAccountActions` on interaction. See `BasaltAccountProps`' JSDoc for the Better-Auth
 * mapping recipe.
 *
 * Collapsed-rail behavior mirrors `AppSidebar`'s icon-rail convention: the ancestor `.root
 * [data-collapsed]` selector (app-sidebar.module.css) hides the name/email/meta text (nested
 * inside `.accountText`) while keeping the icon visible, and — because the collapse rule never
 * sets `pointer-events: none` on this row (unlike the read-only `sectionBand`) — the menu still
 * opens on click when collapsed.
 *
 * The authenticated row leads with an initials block derived from `identity.name`
 * (docs/DESIGN-SPEC.md §5) — never `identity.image` (basalt-ui ships no avatar/photo rendering).
 * The unauthenticated "Sign in" row has no identity to derive initials from, so it keeps the
 * generic person glyph below.
 */
import { Group, Menu, Skeleton, Stack, Text, UnstyledButton } from '@mantine/core'
import type { BasaltAccountProps } from './account-types'
import classes from './app-sidebar.module.css'

/** First letter of the first + last name parts, uppercased — the sidebar-footer initials block. */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return `${first}${last}`.toUpperCase()
}

/** Identity initials block — 28px, radius 7, ink-10% bg, mono 10.5px (docs/DESIGN-SPEC.md §5). */
function InitialsBlock({ name }: { name: string }) {
  return (
    <div className={classes.avatar} aria-hidden>
      {getInitials(name)}
    </div>
  )
}

/** Generic "person" glyph for the unauthenticated row — matches the inline-SVG icon convention
 * used elsewhere in the shell (`IconGear`/`IconClose` in `app-sidebar.tsx`). */
function IconUser() {
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
      <path d="M12 12a5 5 0 1 0 0 -10a5 5 0 0 0 0 10z" />
      <path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />
    </svg>
  )
}

function AccountSkeleton() {
  return (
    <Group className={classes.accountRow} gap="sm" wrap="nowrap">
      <Skeleton height={28} width={28} radius={7} />
      <Stack gap={4} className={classes.accountText}>
        <Skeleton height={10} width="70%" radius="sm" />
        <Skeleton height={9} width="50%" radius="sm" />
      </Stack>
    </Group>
  )
}

export function SidebarAccount({ state, actions, showEmail }: BasaltAccountProps) {
  if (state.status === 'loading') {
    return <AccountSkeleton />
  }

  if (state.status === 'unauthenticated') {
    return (
      <UnstyledButton className={classes.accountRow} onClick={actions?.onSignIn}>
        <IconUser />
        <Text className={classes.accountText} size="sm" fw={500}>
          Sign in
        </Text>
      </UnstyledButton>
    )
  }

  const { identity, role, plan } = state
  const canUpgrade = Boolean(plan?.isFree && actions?.onUpgrade)

  return (
    <Menu position="right-end" withArrow width={220} zIndex={500}>
      <Menu.Target>
        <UnstyledButton className={classes.accountRow} aria-label="Account menu">
          <InitialsBlock name={identity.name} />
          <Stack gap={2} className={classes.accountText}>
            <Text className={classes.accountName} truncate>
              {identity.name}
            </Text>
            {showEmail && identity.email && (
              <Text className={classes.accountMeta} truncate>
                {identity.email}
              </Text>
            )}
            {(plan || role) && (
              <Text className={classes.accountMeta} truncate>
                {[plan?.label, role?.label].filter(Boolean).join(' · ')}
              </Text>
            )}
          </Stack>
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>
        {actions?.onManageAccount && (
          <Menu.Item onClick={actions.onManageAccount}>Account settings</Menu.Item>
        )}
        {actions?.onManageBilling && (
          <Menu.Item onClick={actions.onManageBilling}>Billing & payment</Menu.Item>
        )}
        {canUpgrade && <Menu.Item onClick={actions?.onUpgrade}>Upgrade</Menu.Item>}
        {actions?.extraMenuItems?.map((item) => (
          <Menu.Item
            key={item.key}
            leftSection={item.icon}
            onClick={item.onClick}
            {...(item.danger ? { color: 'red' } : {})}
          >
            {item.label}
          </Menu.Item>
        ))}
        <Menu.Divider />
        {actions?.onSignOut && (
          <Menu.Item color="red" onClick={actions.onSignOut}>
            Sign out
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  )
}
