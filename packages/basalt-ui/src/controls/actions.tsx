/**
 * `BarAction` — the one typed vocabulary for an action in a home (`docs/CONTROLS-SPEC.md` §2.1),
 * plus the two components that project it: `ActionGroup` (a home's `actions` slot) and
 * `OverflowMenu` (the `More` / kebab fold).
 *
 * The point of typing actions as DATA rather than taking a `ReactNode` row is law C7: a home never
 * scrolls horizontally and never wraps, so the overflow fold has to be COMPUTED by basalt. A
 * `ReactNode` row can only be clipped or scrolled; a `BarAction[]` can be split into "inline" and
 * "in the More menu" without the caller knowing the breakpoint.
 *
 * The desktop/mobile swap belongs to this control, never to the caller (law C9): both variants are
 * rendered, once each, and Mantine's `visibleFrom`/`hiddenFrom` decides which one paints. No JS
 * media query, so there is no first-paint flash and no hook that re-renders on resize.
 */
import { ActionIcon, Button, Group, Menu } from '@mantine/core'
import { createContext, useContext, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { NavAnchor } from '../nav/types'
import type { AnyNavLink } from '../router-tanstack/nav'
import classes from './actions.module.css'

/**
 * A button-shaped action. `Anchor` is the router seam basalt HOSTS (the same seam `SidebarItem`
 * uses — pass the one `useNav` builds, or your router's `Link`); `link` is the no-router fallback
 * and only its `to` is honoured, since resolving `search`/`params` needs a router. Supply `Anchor`
 * whenever the destination carries either.
 */
export type BarActionItem = {
  key: string
  label: string
  kind?: undefined
  icon?: ReactNode
  onClick?: () => void
  link?: AnyNavLink
  Anchor?: NavAnchor
  disabled?: boolean
  loading?: boolean
  danger?: boolean
  /** Mobile placement. @default 'bar' for `primary`, `'more'` for everything else */
  mobile?: 'bar' | 'more' | 'hidden'
}

/** A nested group. Always folds into the `More` menu on both viewports — it never takes bar width. */
export type BarActionMenu = {
  key: string
  kind: 'menu'
  label: string
  icon?: ReactNode
  items: BarAction[]
}

/** An escape hatch for a control basalt does not model (a live chip, a consumer's own widget). */
export type BarActionCustom = {
  key: string
  kind: 'custom'
  node: ReactNode
  mobile?: 'bar' | 'more' | 'hidden'
}

export type BarAction = BarActionItem | BarActionMenu | BarActionCustom

/**
 * A home's `actions` slot. `primary` is SINGULAR by type — that is the whole enforcement of law
 * C6's "exactly one primary"; there is no runtime check because a second one cannot be written.
 */
export type ActionGroupProps = {
  primary?: BarAction
  secondary?: BarAction[]
}

/**
 * A shell-owned, persistent header action (timer, notifications, a global `SyncButton`).
 * `node` is rendered as-is — basalt owns only the placement.
 *
 * Below `sm` a `'more'` action renders inside the header's single kebab, which means its `node` is
 * mounted a second time there (lazily — a Mantine `Menu.Dropdown` mounts its children on open).
 * Keep `'more'` for self-contained nodes and give anything holding live state `mobile: 'bar'`,
 * which renders exactly once.
 */
export type GlobalAction = {
  key: string
  node: ReactNode
  /** @default 'bar' for the first two, `'more'` for the rest */
  mobile?: 'bar' | 'more' | 'hidden'
}

/** Secondaries rendered inline on desktop; the rest fold into `More` (`docs/CONTROLS-SPEC.md` §2.1). */
export const DESKTOP_SECONDARY_MAX = 3

/** `GlobalAction`s without an explicit `mobile` that still land on the mobile bar. */
export const MOBILE_GLOBAL_BAR_MAX = 2

/**
 * What the shell hands the page's `ActionGroup` so the header ends up with ONE kebab instead of
 * two: the shell's `mobile: 'more'` global actions (already mapped to `kind: 'custom'` rows), and
 * a claim the mobile kebab takes on mount. While a page's kebab holds the claim, the shell renders
 * no kebab of its own.
 *
 * Lives here, in the lowest layer, so `src/shell/**` imports downward into `src/controls/**` and
 * never the reverse — a context declared in the shell would make `./controls` pull the shell in.
 */
export type BarExtras = {
  mobileMoreActions: readonly BarAction[]
  /** Claims the single mobile kebab. Returns the release, so it works straight out of an effect. */
  claimKebab: () => () => void
}

const NO_EXTRAS: BarExtras = {
  mobileMoreActions: [],
  claimKebab: () => () => {},
}

const BarExtrasContext = createContext<BarExtras>(NO_EXTRAS)

/** Internal — mounted by `BasaltShell` (via `PageBarProvider`), never by a consumer. */
export function BarExtrasProvider({
  value,
  children,
}: {
  value: BarExtras
  children: ReactNode
}): ReactNode {
  return <BarExtrasContext.Provider value={value}>{children}</BarExtrasContext.Provider>
}

/** Resolved mobile placement of one action. A `kind: 'menu'` group is always a `More` row. */
export function barActionMobile(action: BarAction, isPrimary: boolean): 'bar' | 'more' | 'hidden' {
  if (action.kind === 'menu') return 'more'
  return action.mobile ?? (isPrimary ? 'bar' : 'more')
}

/** `GlobalAction[]` → the same placement law, with "the first two ride the bar" as the default. */
export function globalActionMobile(action: GlobalAction, index: number): 'bar' | 'more' | 'hidden' {
  return action.mobile ?? (index < MOBILE_GLOBAL_BAR_MAX ? 'bar' : 'more')
}

/** A `GlobalAction` reaching a `BarAction` slot — the kebab renders one row shape, not two. */
export function globalActionAsBarAction(action: GlobalAction): BarActionCustom {
  return { key: action.key, kind: 'custom', node: action.node, mobile: 'more' }
}

function DotsGlyph() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx={12} cy={5} r={1.75} />
      <circle cx={12} cy={12} r={1.75} />
      <circle cx={12} cy={19} r={1.75} />
    </svg>
  )
}

function ChevronGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** The first grapheme of a label — the icon-less fallback for the mobile primary icon button. */
function initial(label: string): string {
  return [...label][0]?.toUpperCase() ?? '?'
}

/**
 * One action as a button. No `size` prop anywhere: the enclosing `CtlSlot` (mounted by the home,
 * never by the action) resolves the `ctl` tier — law C5.
 */
function BarButton({
  action,
  variant,
}: {
  action: BarActionItem
  variant: 'filled' | 'default'
}): ReactNode {
  const shared = {
    variant,
    disabled: action.disabled === true,
    loading: action.loading === true,
    ...(action.icon !== undefined && { leftSection: action.icon }),
    ...(action.danger === true && { color: 'red' }),
    ...(action.onClick !== undefined && { onClick: action.onClick }),
  }
  if (action.Anchor !== undefined) {
    return (
      <Button component={action.Anchor} {...shared}>
        {action.label}
      </Button>
    )
  }
  if (action.link !== undefined) {
    return (
      <Button component="a" href={action.link.to} {...shared}>
        {action.label}
      </Button>
    )
  }
  return <Button {...shared}>{action.label}</Button>
}

/** The mobile form of a bar action: icon only, the label demoted to the accessible name. */
function BarIconButton({
  action,
  variant,
}: {
  action: BarActionItem
  variant: 'filled' | 'subtle'
}): ReactNode {
  const shared = {
    variant,
    'aria-label': action.label,
    disabled: action.disabled === true,
    loading: action.loading === true,
    ...(action.danger === true && { color: 'red' }),
    ...(action.onClick !== undefined && { onClick: action.onClick }),
  }
  const body = action.icon ?? initial(action.label)
  if (action.Anchor !== undefined) {
    return (
      <ActionIcon component={action.Anchor} {...shared}>
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

function MenuRow({ action }: { action: BarActionItem }): ReactNode {
  const shared = {
    className:
      action.danger === true ? `${classes.menuItem} ${classes.menuItemDanger}` : classes.menuItem,
    disabled: action.disabled === true,
    ...(action.icon !== undefined && { leftSection: action.icon }),
    ...(action.onClick !== undefined && { onClick: action.onClick }),
  }
  if (action.Anchor !== undefined && action.disabled !== true) {
    return (
      <Menu.Item component={action.Anchor} {...shared}>
        {action.label}
      </Menu.Item>
    )
  }
  if (action.link !== undefined && action.disabled !== true) {
    return (
      <Menu.Item component="a" href={action.link.to} {...shared}>
        {action.label}
      </Menu.Item>
    )
  }
  return <Menu.Item {...shared}>{action.label}</Menu.Item>
}

/** Depth-first: a `kind: 'menu'` group becomes a label plus its items, never a nested dropdown. */
function menuRows(actions: readonly BarAction[]): ReactNode[] {
  return actions.flatMap((action): ReactNode[] => {
    if (action.kind === 'menu') {
      return [
        <Menu.Label key={`${action.key}-label`}>{action.label}</Menu.Label>,
        ...menuRows(action.items),
      ]
    }
    if (action.kind === 'custom') {
      return [
        <div key={action.key} className={classes.customRow}>
          {action.node}
        </div>,
      ]
    }
    return [<MenuRow key={action.key} action={action} />]
  })
}

export type OverflowMenuProps = {
  actions: readonly BarAction[]
  /**
   * `more` — the labelled desktop `More` button. `kebab` — the mobile ⋯ icon button.
   * @default 'more'
   */
  trigger?: 'more' | 'kebab'
  /** Trigger label (and the kebab's accessible name). @default 'More' */
  label?: string
}

/**
 * The overflow fold — the only place an action that doesn't fit goes (law C7). Rows are 44px below
 * `sm` (`--vx-space-sheet-row-height`), so the mobile kebab is already a touch surface without a
 * second, sheet-shaped component.
 */
export function OverflowMenu({
  actions,
  trigger = 'more',
  label = 'More',
}: OverflowMenuProps): ReactNode {
  if (actions.length === 0) return null
  return (
    <Menu
      position="bottom-end"
      offset={6}
      withinPortal
      // AppShell itself sits at z-index 100 (`getDefaultZIndex('app')`), so the menu must clear it.
      zIndex={400}
      closeOnItemClick
      closeOnClickOutside
      closeOnEscape
      trapFocus
      returnFocus
      // Required for a menu following the WAI-ARIA disclosure pattern — Mantine's own note on the
      // prop. Without it every row is `tabindex="-1"`.
      menuItemTabIndex={0}
    >
      <Menu.Target>
        {trigger === 'kebab' ? (
          <ActionIcon variant="subtle" aria-label={label}>
            <DotsGlyph />
          </ActionIcon>
        ) : (
          <Button variant="default" rightSection={<ChevronGlyph />}>
            {label}
          </Button>
        )}
      </Menu.Target>
      <Menu.Dropdown>{menuRows(actions)}</Menu.Dropdown>
    </Menu>
  )
}

/**
 * Internal — the shared projection behind `ActionGroup` (and `PageBar`'s two rows).
 *
 * `host` is the whole reason this is not just `ActionGroup`. The shell's `mobile: 'more'` global
 * actions must land in EXACTLY ONE kebab, and the only instance entitled to them is `PageBar`'s
 * row 1. When every `ActionGroup` read `BarExtrasContext`, a page with `filtersEnd` (or any
 * consumer composing an `ActionGroup` into a `Section`/`ChartCard` `actions` slot) grew a SECOND
 * kebab that re-mounted the shell's global nodes and stole the claim from the shell's own fallback.
 * `host: 'slot'` — the public `ActionGroup`'s value — gets `NO_EXTRAS`: no global rows, no claim.
 */
type BarActionRowProps = ActionGroupProps & {
  /** `page` = `PageBar` row 1, the one instance that reads the shell extras and takes the claim. */
  host: 'page' | 'slot'
  /**
   * `desktop` renders the desktop variant only — `PageBar` row 2, whose items live in the row-1
   * kebab below `sm` (spec §2.1: mobile row 2 is tabs + the first pill + `Filters (n)`, nothing
   * else). @default 'both'
   */
  viewport?: 'both' | 'desktop'
  /**
   * Actions projected onto the MOBILE variant only, never the desktop row — `PageBar.filtersEnd`,
   * whose desktop home is row 2. Each still obeys its own `mobile` placement, so a `'bar'` one
   * becomes an inline icon button and a `'hidden'` one stays desktop-only.
   */
  mobileOnly?: readonly BarAction[]
}

export function BarActionRow({
  primary,
  secondary,
  host,
  viewport = 'both',
  mobileOnly = [],
}: BarActionRowProps): ReactNode {
  const context = useContext(BarExtrasContext)
  // Read unconditionally (hook order), scoped afterwards — see this type's doc.
  const extras = host === 'page' ? context : NO_EXTRAS
  const list = secondary ?? []

  const flat = list.filter((a): a is BarActionItem | BarActionCustom => a.kind !== 'menu')
  const menus = list.filter((a): a is BarActionMenu => a.kind === 'menu')
  const inline = flat.slice(0, DESKTOP_SECONDARY_MAX)
  const desktopOverflow = [...flat.slice(DESKTOP_SECONDARY_MAX), ...menus]

  const wantsMobile = viewport === 'both'
  const mobileList = [...list, ...mobileOnly]
  const mobileBar = wantsMobile
    ? [
        ...(primary !== undefined && barActionMobile(primary, true) === 'bar' ? [primary] : []),
        ...mobileList.filter((a) => barActionMobile(a, false) === 'bar'),
      ]
    : []
  const mobileMore = wantsMobile
    ? [
        ...(primary !== undefined && barActionMobile(primary, true) === 'more' ? [primary] : []),
        ...mobileList.filter((a) => barActionMobile(a, false) === 'more'),
        ...extras.mobileMoreActions,
      ]
    : []

  // The claim is what makes "one kebab per header" true: while this group owns a kebab, the shell
  // renders none, so its `mobile: 'more'` global actions have exactly one home. Only a `page` host
  // can claim — `NO_EXTRAS.claimKebab` is a no-op, and its `mobileMoreActions` is empty.
  const claimsKebab = mobileMore.length > 0
  const claimKebab = extras.claimKebab
  useEffect(() => {
    if (!claimsKebab) return
    return claimKebab()
  }, [claimsKebab, claimKebab])

  const hasDesktop = primary !== undefined || list.length > 0
  const hasMobile = mobileBar.length > 0 || claimsKebab
  if (!hasDesktop && !hasMobile) return null

  return (
    <>
      {hasDesktop && (
        <Group gap="xs" wrap="nowrap" visibleFrom="sm">
          {primary !== undefined && <BarEntry action={primary} emphasis="primary" />}
          {inline.map((action) => (
            <BarEntry key={action.key} action={action} emphasis="secondary" />
          ))}
          <OverflowMenu actions={desktopOverflow} />
        </Group>
      )}
      {hasMobile && (
        <Group gap="xs" wrap="nowrap" hiddenFrom="sm">
          {mobileBar.map((action) => (
            <BarEntry
              key={action.key}
              action={action}
              emphasis={action.key === primary?.key ? 'mobile-primary' : 'mobile-secondary'}
            />
          ))}
          {claimsKebab && (
            <OverflowMenu actions={mobileMore} trigger="kebab" label="More actions" />
          )}
        </Group>
      )}
    </>
  )
}

/**
 * A home's `actions` slot, projected for both viewports.
 *
 * Desktop: `primary` as a `filled` button · up to `DESKTOP_SECONDARY_MAX` secondaries as `default`
 * buttons · everything past that, plus every `kind: 'menu'`, in one `More` menu.
 * Mobile: `primary` as an icon button (its first letter when it ships no icon) · one kebab holding
 * every `mobile: 'more'` action · `mobile: 'hidden'` drops the action entirely.
 *
 * The shell's `mobile: 'more'` global actions are folded in by `PageBar`'s ROW-1 group only, not by
 * this component — see `BarActionRowProps.host` for why every other home has to stay out of them.
 *
 * @example
 * <PageBar actions={{ primary: { key: 'new', label: 'New run', onClick: start },
 *                     secondary: [{ key: 'export', label: 'Export', onClick: exportCsv }] }} />
 */
export function ActionGroup(props: ActionGroupProps): ReactNode {
  return <BarActionRow {...props} host="slot" />
}

/** One bar entry, resolved by kind: a custom node renders itself, a menu group folds to `More`. */
function BarEntry({
  action,
  emphasis,
}: {
  action: BarAction
  emphasis: 'primary' | 'secondary' | 'mobile-primary' | 'mobile-secondary'
}): ReactNode {
  if (action.kind === 'custom') return <>{action.node}</>
  if (action.kind === 'menu') return <OverflowMenu actions={[action]} label={action.label} />
  if (emphasis === 'mobile-primary') return <BarIconButton action={action} variant="filled" />
  if (emphasis === 'mobile-secondary') return <BarIconButton action={action} variant="subtle" />
  return <BarButton action={action} variant={emphasis === 'primary' ? 'filled' : 'default'} />
}
