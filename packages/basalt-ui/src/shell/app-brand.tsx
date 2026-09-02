/**
 * `AppBrand` — the brand identity plus the sidebar-collapse toggle, rendered as the HEADER's
 * leading zone.
 *
 * It used to be the sidebar's own first row, an `appShellHeaderHeight` band under `layout="alt"`
 * where the header was inset beside the navbar and the two bands sat side by side. With the header
 * spanning the full viewport width, that band became a SECOND 48px row painted under the header
 * seam — two horizontal rules where the design has one. So the markup moved up into the header,
 * unchanged: same `BrandConfig`, same `brand.menu` workspace switcher, same collapse toggle, same
 * rail behaviour (the lead hides, the toggle centres).
 *
 * It is internal — `BasaltShell` is the only mount. `AppSidebar` still takes `brand` because
 * `brand.version` labels its settings footer; it simply no longer paints the row.
 */
import { ActionIcon, Group, Menu, Text, UnstyledButton } from '@mantine/core'
import { cx } from '../common/props'
import type { BasaltProps } from '../common/props'
import type { AccountMenuItem } from './account-types'
import type { BrandConfig } from './index'
import { IconChevron } from './sidebar-blocks'
import { VX } from '../tokens'
import { useBasaltSpacing } from '../theme'
import classes from './app-brand.module.css'

/** Inline collapse/expand chevrons — keeps the shell icon-dependency-free. */
function IconCollapse({ collapsed }: { collapsed: boolean }) {
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
      <path d="M4 4h16v16H4z" />
      <path d="M9 4v16" />
      {collapsed ? <path d="M14 9l3 3l-3 3" /> : <path d="M16 9l-3 3l3 3" />}
    </svg>
  )
}

/**
 * The brand name, and — when `brand.menu` is supplied — the workspace switcher it becomes.
 *
 * The entries are `AccountMenuItem`s: the shell already had exactly this row shape (label, icon,
 * onClick, danger) for the account menu, and a second vocabulary for the same dropdown would be
 * two things to keep in step for no gain. The chevron is inline text, not an icon dependency.
 */
function BrandName({
  brand,
  menuWidth,
}: {
  brand: BrandConfig & { menu?: AccountMenuItem[] }
  menuWidth: number
}) {
  const label = (
    <Text className={classes.brandName} fz={VX.text.xl} fw={550}>
      {brand.name}
    </Text>
  )
  const menu = brand.menu
  if (menu === undefined || menu.length === 0) return label

  return (
    <Menu position="bottom-start" withArrow width={menuWidth} zIndex={500}>
      <Menu.Target>
        <UnstyledButton className={classes.brandButton} aria-label={`${brand.name} workspace`}>
          {label}
          {/* `open` is the DOWN glyph — a switcher's affordance points at its dropdown, and this is
              the same chevron every fold in the sidebar uses rather than a second one. */}
          <IconChevron open />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        {menu.map((entry) => (
          <Menu.Item
            key={entry.key}
            leftSection={entry.icon}
            {...(entry.danger === true && { color: 'red' })}
            onClick={entry.onClick}
          >
            {entry.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  )
}

export type AppBrandProps = BasaltProps & {
  brand: BrandConfig & { menu?: AccountMenuItem[] }
  /** Desktop rail state — the zone narrows with the navbar and shows the toggle alone. */
  collapsed: boolean
  onToggleCollapse: () => void
}

export function AppBrand({ brand, collapsed, onToggleCollapse, className, style }: AppBrandProps) {
  // Density-tracking Menu dropdown width, read at the ACTIVE resolved level — same reason
  // `AppSidebar` reads it rather than the frozen level-0 constant (`tokens/palette.ts`).
  const { step } = useBasaltSpacing()
  return (
    <Group
      className={cx(classes.brand, className)}
      gap="sm"
      wrap="nowrap"
      {...(style !== undefined && { style })}
    >
      <Group className={classes.brandLead} gap="sm" wrap="nowrap">
        {brand.logoSrc && (
          <img
            src={brand.logoSrc}
            alt={brand.logoAlt ?? brand.name}
            width={26}
            height={26}
            style={{ display: 'block' }}
          />
        )}
        <BrandName brand={brand} menuWidth={step.sidebarAccountMenuWidth} />
      </Group>
      <ActionIcon
        variant="subtle"
        // A numeric size, not the named `"md"` — same opt-out as `connectivity-indicator.tsx`'s
        // toolbar icon (see that comment): this is a plain collapse-toggle icon, not a control meant
        // to match a `size="md"` Input/Button, so it must not pick up the theme's `ActionIcon.extend`
        // control-height override. Reproduces Mantine's own static `--ai-size-md` (28px).
        size={28}
        visibleFrom="sm"
        className={classes.ghostIcon}
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <IconCollapse collapsed={collapsed} />
      </ActionIcon>
    </Group>
  )
}
