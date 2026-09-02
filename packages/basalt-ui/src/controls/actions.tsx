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
import { createContext, isValidElement, useContext, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { BasaltProps } from '../common/props'
import type { NavAnchor } from '../shell/nav-types'
import type { AnyNavLink } from '../router-tanstack/nav'
import { IconSlot } from '../theme/icon-slot'
import { ControlGroup } from './control-group'
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
  /**
   * Joins this action to its adjacent `group: true` siblings into ONE `ControlGroup` — shared
   * borders, radius on the outer ends only, no gap. Declare it on every member of the run: a set of
   * three where the middle one omits it is two runs of one, which is the same row it was before.
   *
   * It is an opt-in because "these act on the same thing" is a fact only the caller has. A `‹ Today ›`
   * stepper is the shape; three independent actions that happen to sit beside each other are not, and
   * joining those would claim a relationship the reader would then have to un-learn.
   */
  group?: true
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
export type ActionGroupProps = BasaltProps & {
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

/** The compact labelled mobile bar entry's horizontal inset — see {@link MobileBarEntry}. */
const MOBILE_PRIMARY_PADDING_X = 10

/**
 * The gap between two adjacent controls in a bar row — `SPACE_STEP.controlGap`'s level-0 value, the
 * same 6px `--vx-space-control-gap` gives the pill row. A NUMBER and not `gap="xs"`: Mantine's `xs`
 * is 11px, the BODY tier's gap, which made the header's own row looser than the filter row directly
 * under it. `Group`'s `gap` takes a raw px number, so there is no spacing key that resolves to 6.
 */
const BAR_GAP = 6

/**
 * One action as a button. No `size` prop anywhere: the enclosing `CtlSlot` (mounted by the home,
 * never by the action) resolves the `ctl` tier — law C5.
 */
function BarButton({
  action,
  variant,
  px,
}: {
  action: BarActionItem
  variant: 'filled' | 'default'
  /** Overrides the tier's horizontal inset — only the compact mobile primary passes it. */
  px?: number
}): ReactNode {
  const shared = {
    variant,
    ...(px !== undefined && { px }),
    disabled: action.disabled === true,
    loading: action.loading === true,
    // EVERY icon in this file goes through `IconSlot` — the box is the framework's, never the
    // caller's glyph (see `theme/icon-slot.tsx`). Mantine's `leftSection` is a bare flex box with no
    // size of its own, so a consumer's `width="24"` SVG used to set this row's height.
    ...(action.icon !== undefined && { leftSection: <IconSlot>{action.icon}</IconSlot> }),
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
  /** `default` is the bordered desktop form — a joined `ControlGroup` member (see {@link BarEntry}). */
  variant: 'filled' | 'subtle' | 'default'
}): ReactNode {
  const shared = {
    variant,
    'aria-label': action.label,
    disabled: action.disabled === true,
    loading: action.loading === true,
    ...(action.danger === true && { color: 'red' }),
    ...(action.onClick !== undefined && { onClick: action.onClick }),
  }
  const body = <IconSlot>{action.icon}</IconSlot>
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
    ...(action.icon !== undefined && { leftSection: <IconSlot>{action.icon}</IconSlot> }),
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

export type OverflowMenuProps = BasaltProps & {
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
  className,
  style,
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
          // `size="ctl"` explicitly, not inherited: the kebab is rendered by `HeaderGlobalActions`
          // too, which is shell chrome rather than a home's slot, so there is no `CtlSlot` above it
          // there. 28px beside 30px buttons is the mismatch the header read as.
          <ActionIcon
            variant="subtle"
            size="ctl"
            aria-label={label}
            {...(className !== undefined && { className })}
            {...(style !== undefined && { style })}
          >
            <IconSlot className={classes.kebabIcon}>
              <DotsGlyph />
            </IconSlot>
          </ActionIcon>
        ) : (
          <Button
            variant="default"
            rightSection={
              <IconSlot className={classes.chevronIcon}>
                <ChevronGlyph />
              </IconSlot>
            }
            {...(className !== undefined && { className })}
            {...(style !== undefined && { style })}
          >
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
   * kebab below `sm` (`docs/CONTROLS-SPEC.md` §2.1: mobile row 2 is two lines — tabs, then the
   * first pill + `Filters (n)` + the aside's `Panel` pill; `docs/CONTROLS-SPEC.md` §2.1 still
   * describes the pre-aside one-line form). @default 'both'
   */
  viewport?: 'both' | 'desktop'
  /**
   * Actions projected onto the MOBILE variant only, never the desktop row — `PageBar.filtersEnd`,
   * whose desktop home is row 2. Each still obeys its own `mobile` placement, so a `'bar'` one
   * becomes an inline icon button and a `'hidden'` one stays desktop-only.
   */
  mobileOnly?: readonly BarAction[]
  /**
   * The home's `SyncButton`, mounted ONCE between the secondaries and the primary — see the ordering
   * note in the body. Only `PageBar` row 1 passes it; a home with no sync passes nothing and the
   * desktop row stays a single group.
   */
  syncNode?: ReactNode
}

/**
 * Splits a bar row into runs, where a run of length > 1 is rendered as one `ControlGroup`.
 *
 * Two triggers, and they are the same rule read on two viewports (`docs/CONTROLS-SPEC.md` §3):
 *
 * - **`group: true`** — declared adjacency. The caller states that these act on one thing, so they
 *   are joined on both viewports.
 * - **Adjacent ICON-ONLY entries on the mobile bar** (`viewport: 'mobile'`). Below `sm` a
 *   `BarActionItem` carrying an icon renders as an `ActionIcon` and nothing else (`MobileBarEntry`),
 *   so two of them in a row are two 30px squares with a 6px gap — three boxes' worth of border for
 *   two actions, in the one place width is scarce. This half is DERIVED from what is actually
 *   rendered, not declared, which is why it cannot be a prop: the caller does not know which of its
 *   actions the phone form draws icon-only.
 *
 * `excludeKey` is the primary's, and it always breaks the run: a `filled` primary joined to a
 * `default`/`subtle` sibling puts a fill edge against a border edge, which paints a rim in neither
 * colour. A `kind: 'menu'`/`kind: 'custom'` entry breaks it for its own reason — the first is a
 * dropdown trigger with its own overlay, the second is a node basalt does not draw, and neither can
 * be promised the shared-border geometry.
 *
 * **A joined member that ships an icon renders ICON-ONLY, on desktop too**, with its `label` demoted
 * to the accessible name. That is not a saving, it is what a joined set MEANS: `‹ Today ›` is one
 * control whose middle segment names it, and the arrows' content is their direction. Rendered
 * labelled, the same three actions measured 304px against 118px — nearly a quarter of the bar for a
 * word already implied by the arrow. A joined member with no icon (`Absolute | Rate`) keeps its
 * label, so a labelled joined set is unaffected; the rule reads what the caller actually supplied
 * rather than adding a prop to ask.
 */
function joinRuns(
  actions: readonly BarAction[],
  opts: { viewport: 'desktop' | 'mobile'; excludeKey?: string | undefined },
): BarAction[][] {
  const joinable = (action: BarAction): boolean =>
    action.kind === undefined &&
    action.key !== opts.excludeKey &&
    (action.group === true || (opts.viewport === 'mobile' && action.icon !== undefined))

  const runs: BarAction[][] = []
  for (const action of actions) {
    const tail = runs.at(-1)
    if (joinable(action) && tail !== undefined && tail.every(joinable)) tail.push(action)
    else runs.push([action])
  }
  return runs
}

export function BarActionRow({
  primary,
  secondary,
  host,
  viewport = 'both',
  mobileOnly = [],
  syncNode,
  className,
  style,
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

  // The PRIMARY is the row's LAST desktop entry, not its first (`docs/CONTROLS-SPEC.md` §2.1):
  // custom chips · secondaries · `More` · sync · primary. Reading order runs weakest-to-strongest and
  // ends at the header's right edge, where the commit action belongs; leading with it put the one
  // filled button furthest from the edge and left `More` and `Sync` reading as the row's conclusion.
  //
  // `syncNode` is what splits the desktop row in two, and it splits it rather than joining it
  // because a `SyncButton` must be mounted EXACTLY ONCE (law C9 — it holds a live relative age and
  // its own interval). Rendering it inside both the `visibleFrom` and the `hiddenFrom` group would
  // double that. So it sits BETWEEN them, unwrapped, and the primary follows it in a second
  // desktop-only group. With no `syncNode` there is nothing to sit between and the desktop row stays
  // one group — which is also what keeps a plain `ActionGroup` a single element to query.
  const desktopPrimary =
    primary !== undefined ? <BarEntry action={primary} emphasis="primary" /> : null
  const hasDesktop = primary !== undefined || list.length > 0
  const hasMobile = mobileBar.length > 0 || claimsKebab
  if (!hasDesktop && !hasMobile && syncNode === undefined) return null

  const desktopLead = inline.length > 0 || desktopOverflow.length > 0 || syncNode === undefined

  // The caller's `className`/`style` land on the ONE desktop group and the ONE mobile group. A
  // `syncNode` splits the desktop row in two, and with nothing to lead with (no inline actions, no
  // overflow) the lead group does not render at all — the primary-only group beside the sync button
  // IS the desktop row then, so it takes them instead of dropping them. Never both groups: two nodes
  // carrying one `style` is a layout the caller did not write.
  const rootProps = {
    ...(className !== undefined && { className }),
    ...(style !== undefined && { style }),
  }

  return (
    <>
      {hasDesktop && desktopLead && (
        <Group gap={BAR_GAP} wrap="nowrap" visibleFrom="sm" {...rootProps}>
          {joinRuns(inline, { viewport: 'desktop' }).map((run) =>
            run.length === 1 ? (
              <BarEntry key={run[0]!.key} action={run[0]!} emphasis="secondary" />
            ) : (
              <ControlGroup key={`join-${run[0]!.key}`}>
                {run.map((action) => (
                  <BarEntry key={action.key} action={action} emphasis="secondary" iconOnly />
                ))}
              </ControlGroup>
            ),
          )}
          <OverflowMenu actions={desktopOverflow} />
          {syncNode === undefined && desktopPrimary}
        </Group>
      )}
      {syncNode}
      {syncNode !== undefined && desktopPrimary !== null && (
        <Group gap={BAR_GAP} wrap="nowrap" visibleFrom="sm" {...(!desktopLead && rootProps)}>
          {desktopPrimary}
        </Group>
      )}
      {hasMobile && (
        <Group gap={BAR_GAP} wrap="nowrap" hiddenFrom="sm" {...rootProps}>
          {joinRuns(mobileBar, { viewport: 'mobile', excludeKey: primary?.key }).map((run) =>
            run.length === 1 ? (
              <BarEntry
                key={run[0]!.key}
                action={run[0]!}
                emphasis={run[0]!.key === primary?.key ? 'mobile-primary' : 'mobile-secondary'}
              />
            ) : (
              <ControlGroup key={`join-${run[0]!.key}`}>
                {run.map((action) => (
                  <BarEntry
                    key={action.key}
                    action={action}
                    emphasis={action.key === primary?.key ? 'mobile-primary' : 'mobile-secondary'}
                  />
                ))}
              </ControlGroup>
            ),
          )}
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
 * Mobile: `primary` as an icon button when it ships an icon and a compact labelled button when it
 * does not · one kebab holding every `mobile: 'more'` action · `mobile: 'hidden'` drops the action
 * entirely.
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

/**
 * A home's `actions` slot in the two forms it accepts (law C15): typed `BarAction[]` DATA, or an
 * opaque `ReactNode` row the caller drew itself.
 *
 * Three homes took a bare `ReactNode` (`Section`, `BasaltDataTable`, `StatCard`) while `PageBar` and
 * the shell took typed data, so only half the framework got the C6 budget and the C7 overflow fold —
 * the `ReactNode` half was clipped on a phone with no kebab to fold into. Widening those slots to
 * this union is what puts the fold back in basalt's hands without moving any existing call site: a
 * node still renders verbatim.
 */
export type SlotActions = BarAction[] | ReactNode

/**
 * Which arm of {@link SlotActions} a value is, at runtime — the union has no discriminant, and a
 * `ReactNode` can itself be an array (a fragment list), so "is it an array" is not the test.
 *
 * A `BarAction` is a plain object carrying a STRING `key`; a React element carries `key` too (often
 * `null`) but answers `isValidElement`, which is what separates the two. An EMPTY array takes the
 * DATA arm: `[]` is what a caller's `.filter()` returns when nothing survived it, and the data path
 * renders exactly nothing for it (`BarActionRow` bails on an empty row) — so both arms paint the
 * same pixels and the typed one keeps `Section`'s ≤3 count and every other reader on one branch,
 * instead of re-deciding per emptiness.
 */
export function isBarActionList(actions: SlotActions): actions is BarAction[] {
  return (
    Array.isArray(actions) &&
    actions.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        !isValidElement(entry) &&
        typeof (entry as { key?: unknown }).key === 'string',
    )
  )
}

/**
 * Renders a {@link SlotActions} slot: the typed form goes through the SAME projection `PageBar` and
 * `ActionGroup` use — inline up to {@link DESKTOP_SECONDARY_MAX}, the rest folded into `More`, and a
 * mobile kebab below `sm` — and the node form is returned untouched.
 *
 * Every entry lands in `secondary`: a `BarAction[]` carries no primary marker, and law C6's "exactly
 * one primary" is the page bar's rule, enforced by `ActionGroupProps.primary` being singular. A home
 * that wants a filled action passes a node, or an `ActionGroup` of its own.
 *
 * `host="slot"`, never `'page'` — only `PageBar` row 1 may read the shell's global actions and claim
 * the single mobile kebab (see {@link BarActionRowProps}).
 *
 * @example
 * <Section title="Runs" actions={[{ key: 'export', label: 'Export', onClick: exportCsv }]} />
 */
export function BarActionSlot({ actions }: { actions: SlotActions }): ReactNode {
  if (!isBarActionList(actions)) return actions
  return <BarActionRow secondary={actions} host="slot" />
}

/**
 * One bar entry, resolved by kind: a custom node renders itself, a menu group folds to `More`.
 *
 * A `kind: 'custom'` node goes in a `ctl`-height slot rather than straight into the row. It is the
 * one entry basalt does not draw, so it is also the one entry that can arrive at any height — a
 * `Badge` is 20px, a bare `<span>` is its line box — and a 20px chip beside three 30px buttons is
 * exactly the "buttons and badges have different sizes" the header read as. The slot pins the tier's
 * height and centres whatever it holds; it does not restyle the node.
 */
function BarEntry({
  action,
  emphasis,
  iconOnly,
}: {
  action: BarAction
  emphasis: 'primary' | 'secondary' | 'mobile-primary' | 'mobile-secondary'
  /** Set by a JOINED run — see {@link joinRuns}. The label survives as the accessible name. */
  iconOnly?: boolean
}): ReactNode {
  if (action.kind === 'custom') return <span className={classes.customSlot}>{action.node}</span>
  if (action.kind === 'menu') return <OverflowMenu actions={[action]} label={action.label} />
  if (emphasis === 'mobile-primary') return <MobileBarEntry action={action} variant="filled" />
  if (emphasis === 'mobile-secondary') return <MobileBarEntry action={action} variant="subtle" />
  if (iconOnly === true && action.icon !== undefined) {
    return <BarIconButton action={action} variant="default" />
  }
  return <BarButton action={action} variant={emphasis === 'primary' ? 'filled' : 'default'} />
}

/**
 * One action on the mobile bar. With an icon it is an `ActionIcon`; WITHOUT one it is a compact
 * `Button` carrying the label. Both emphases go through it, so the rule is the same for the primary
 * and for a `mobile: 'bar'` secondary.
 *
 * The first-grapheme fallback this replaced (`initial(label)`) drew `S` for `Save as report` and `E`
 * for `Export`, which is an avatar — a glyph a reader has to already know the meaning of. A label is
 * longer and says what the button does, and the breadcrumb beside it now truncates
 * (`shell/app-header.module.css`), so the width is available. Dropping the fallback WITHOUT this
 * branch would have been worse than either: `BarIconButton` renders `action.icon`, so an icon-less
 * action would have become an empty 30px box.
 *
 * `px` is the phone form's own inset — the `ctl` default is sized for a labelled desktop button.
 */
function MobileBarEntry({
  action,
  variant,
}: {
  action: BarActionItem
  variant: 'filled' | 'subtle'
}): ReactNode {
  if (action.icon !== undefined) return <BarIconButton action={action} variant={variant} />
  return (
    <BarButton
      action={action}
      // `subtle` is an ActionIcon variant, not a Button one — the labelled form of a non-primary bar
      // action is a `default` button, which is what a secondary reads as on desktop too.
      variant={variant === 'filled' ? 'filled' : 'default'}
      px={MOBILE_PRIMARY_PADDING_X}
    />
  )
}
