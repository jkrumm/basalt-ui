/**
 * SidebarAccount — presentational sidebar-footer row for the framework-provided account contract
 * (`BasaltAccountProps`, see `account-types.ts`). Zero auth logic: it renders whatever
 * `BasaltAccountState` the consumer derives from its own auth client and calls back through
 * `BasaltAccountActions` on interaction. See `BasaltAccountProps`' JSDoc for the Better-Auth
 * mapping recipe.
 *
 * Collapsed-rail behavior mirrors `AppSidebar`'s icon-rail convention: the ancestor `.root
 * [data-collapsed]` selector (app-sidebar.module.css) hides the name/email/badge text (nested
 * inside `.accountText`) while keeping the icon visible, and — because the collapse rule never
 * sets `pointer-events: none` on this row (unlike the read-only `sectionBand`) — the menu still
 * opens on click when collapsed.
 *
 * The leading glyph is a generic, non-personalized "person" icon — never an avatar/photo or
 * initials derived from the identity — so the row never implies per-user personalization.
 */
import { Badge, Group, Menu, Skeleton, Stack, Text, UnstyledButton } from '@mantine/core'
import type { AccountBadgeTone, BasaltAccountProps } from './account-types'
import classes from './app-sidebar.module.css'

/** Generic "person" glyph — matches the inline-SVG icon convention used elsewhere in the shell
 * (`IconGear`/`IconClose` in `app-sidebar.tsx`). Never derived from `identity.name`/`identity.image`. */
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
      <Skeleton height={18} width={18} radius="sm" />
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
          <IconUser />
          <Stack gap={2} className={classes.accountText}>
            <Text size="sm" fw={500} truncate>
              {identity.name}
            </Text>
            {showEmail && identity.email && (
              <Text size="xs" c="dimmed" truncate>
                {identity.email}
              </Text>
            )}
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
