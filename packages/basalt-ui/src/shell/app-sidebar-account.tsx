/**
 * SidebarAccount — presentational sidebar-footer row for the framework-provided account contract
 * (`BasaltAccountProps`, see `account-types.ts`). Zero auth logic: it renders whatever
 * `BasaltAccountState` the consumer derives from its own auth client and calls back through
 * `BasaltAccountActions` on interaction. See `BasaltAccountProps`' JSDoc for the Better-Auth
 * mapping recipe.
 *
 * Collapsed-rail behavior mirrors `AppSidebar`'s icon-rail convention: the ancestor `.root
 * [data-collapsed]` selector (app-sidebar.module.css) hides the name/email/badge text while
 * keeping the avatar visible, and — because the collapse rule never sets `pointer-events: none`
 * on this row (unlike the read-only `sectionBand`) — the menu still opens on click when collapsed.
 */
import { Avatar, Badge, Group, Menu, Skeleton, Stack, Text, UnstyledButton } from '@mantine/core'
import type { AccountBadgeTone, BasaltAccountProps } from './account-types'
import classes from './app-sidebar.module.css'

/** Maps the tone union to a Mantine theme color name — never a literal hex/rgb value. `brand` has
 * no entry so the Badge/Menu.Item omits `color` and falls back to the theme's `primaryColor`. */
const TONE_COLOR: Partial<Record<AccountBadgeTone, string>> = {
  neutral: 'gray',
  success: 'teal',
  warn: 'yellow',
}

/** `exactOptionalPropertyTypes`-safe prop spread — omits `color` entirely (rather than passing
 * `color={undefined}`) when the tone has no mapped color. */
function toneColorProp(tone: AccountBadgeTone): { color: string } | Record<string, never> {
  const color = TONE_COLOR[tone]
  return color === undefined ? {} : { color }
}

function AccountSkeleton() {
  return (
    <Group className={classes.accountRow} gap="sm" wrap="nowrap">
      <Skeleton height={32} width={32} circle />
      <Stack gap={4} className={classes.accountText}>
        <Skeleton height={10} width="70%" radius="sm" />
        <Skeleton height={9} width="50%" radius="sm" />
      </Stack>
    </Group>
  )
}

export function SidebarAccount({ state, actions }: BasaltAccountProps) {
  if (state.status === 'loading') {
    return <AccountSkeleton />
  }

  if (state.status === 'unauthenticated') {
    return (
      <UnstyledButton className={classes.accountRow} onClick={actions?.onSignIn}>
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
          <Avatar
            src={identity.image ?? null}
            name={identity.name}
            color="initials"
            radius="xl"
            size="sm"
          />
          <Stack gap={2} className={classes.accountText}>
            <Text size="sm" fw={500} truncate>
              {identity.name}
            </Text>
            <Text size="xs" c="dimmed" truncate>
              {identity.email}
            </Text>
          </Stack>
          {(plan || role) && (
            <Group gap={4} className={classes.accountBadges} wrap="nowrap">
              {plan && (
                <Badge size="xs" variant="light" {...toneColorProp(plan.tone ?? 'neutral')}>
                  {plan.label}
                </Badge>
              )}
              {role && (
                <Badge size="xs" variant="light" {...toneColorProp(role.tone ?? 'neutral')}>
                  {role.label}
                </Badge>
              )}
            </Group>
          )}
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
