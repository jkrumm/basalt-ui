/**
 * The header: the breadcrumb strip, the frame's top row beside the brand zone (`BrandZone`, above the
 * rail), so the two share one row's height and baseline; three bare regions on that one row, on the
 * frame's color above the work surface. A compact screen has no rail, so there the strip is the phone
 * header: it leads with the logo, paints the surface's color and closes on a rule. Under
 * `chrome="native-overlay"` the header is the window's title bar instead: a row of the frame over the
 * whole width, the brand zone in it.
 *
 * - `start` (`shell-lead`): the breadcrumb trail (`parts/crumbs.tsx`), on the page's gutter. The
 *   server renders the nav-derived trail; a page's `PageBar title` and `parent` join it.
 * - `center`: the global controls (`AppShell globalControls`). Hidden compact, unless the slot says
 *   `compact: true`: it then draws its own narrow form (`globalControls(specs)`'s `Filters (n)`).
 * - `end`: the aside trigger on a compact screen, then the global actions and status
 *   (`shell-trail`). A page's own actions are its `PageBar` band's, in the surface below.
 *
 * The global actions run in priority tiers (`core/header-tiers.ts` holds the numbers): the header
 * row is a size container, a `priority` 3 action yields below 1040 px of row width, a 2 below 860,
 * a 1 never, and a yielded action is listed in the ONE kebab so nothing is lost. All of it is CSS,
 * so the server markup is right at every width.
 */
import { useRef } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../../core/cn'
import type { ControlsSlot } from '../../core/ports'
import { Button } from '../../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover'
import { NATIVE_BRAND, NATIVE_HEADER, Titlebar } from '../chrome'
import type {
  GlobalAction,
  ShellBox,
  ShellBrand,
  ShellChrome,
  SizeClass,
  WorkspaceSwitcher,
} from '../contract'
import { headerPriority } from '../core/header-tiers'
import { useRailControl } from './grid'
import { HeaderKebab, kebabTiers } from './header-kebab'
import { WORKSPACE_COLLAPSED_HIDE, WorkspaceMenu } from './workspace-switcher'
import { PRINT_OFF } from './print'

/** The height a `custom` or `popover` global action is clipped to: one control row. */
export const HEADER_BOX_HEIGHT = 32

export type HeaderProps = {
  brand: ShellBrand
  /** The breadcrumb trail. */
  breadcrumb: ReactNode
  globalControls: ControlsSlot | undefined
  globalActions: readonly GlobalAction[]
  /** The compact-screen trigger of a claimed aside. */
  asideTrigger: ReactNode
  sizeClass: SizeClass
  workspace?: WorkspaceSwitcher | undefined
  /** `native-overlay` makes the header the window's drag region. */
  chrome?: ShellChrome
}

/**
 * The brand zone, as wide as the rail. The rail's collapse toggle lives here: expanded it sits at the
 * zone's end, collapsed it is the zone's only content, centred on the rail. On the web it is the
 * frame's top cell, above the rail and in one row with the breadcrumb strip; under `native-overlay` it
 * sits in the title bar.
 */
export function BrandZone({
  brand,
  workspace,
}: {
  brand: ShellBrand
  workspace?: WorkspaceSwitcher | undefined
}): ReactElement {
  return <Brand brand={brand} native={false} workspace={workspace} />
}

function Brand({
  brand,
  native,
  workspace,
}: {
  brand: ShellBrand
  native: boolean
  workspace?: WorkspaceSwitcher | undefined
}): ReactElement {
  const Logo = brand.logo
  const rail = useRailControl()
  const label = rail.collapsed ? 'Expand sidebar' : 'Collapse sidebar'
  return (
    <div
      data-slot="shell-brand-zone"
      className={cn(
        'flex shrink-0 items-center gap-2 ps-4 pe-2 md:w-(--shell-rail-w) md:overflow-hidden',
        // On the web the zone is a frame cell: hidden with the rail, in one row with the strip.
        !native && 'hidden min-w-0 [grid-area:brand] md:flex',
        !native && PRINT_OFF,
        // Collapsed: the zone is the rail's width and holds the toggle alone, centred.
        'group-data-[rail=collapsed]/shell:md:justify-center group-data-[rail=collapsed]/shell:md:px-0',
        'group-data-[rail=auto]/shell:md:max-xl:justify-center group-data-[rail=auto]/shell:md:max-xl:px-0',
        native && NATIVE_BRAND,
      )}
    >
      {workspace !== undefined ? (
        <WorkspaceMenu workspace={workspace} className="min-w-0 flex-1" />
      ) : Logo !== undefined ? (
        <Logo
          className={cn(
            'size-6 shrink-0',
            'group-data-[rail=collapsed]/shell:md:hidden group-data-[rail=auto]/shell:md:max-xl:hidden',
          )}
          aria-hidden
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            'grid size-6 shrink-0 place-items-center rounded-ctrl bg-primary font-head text-xs font-semibold text-primary-foreground',
            'group-data-[rail=collapsed]/shell:md:hidden group-data-[rail=auto]/shell:md:max-xl:hidden',
          )}
        >
          {brand.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      {workspace === undefined && (
        <span
          className={cn(
            'hidden min-w-0 truncate font-head text-sm font-semibold',
            // The name shows only when the rail beside it is open.
            'group-data-[rail=expanded]/shell:md:inline group-data-[rail=auto]/shell:xl:inline',
            'group-data-[rail=collapsed]/shell:hidden',
          )}
        >
          {brand.name}
        </span>
      )}
      <span
        data-slot="shell-rail-toggle"
        className={cn(
          'ms-auto hidden shrink-0 md:inline-flex',
          workspace !== undefined && WORKSPACE_COLLAPSED_HIDE,
          'group-data-[rail=collapsed]/shell:md:ms-0 group-data-[rail=auto]/shell:md:max-xl:ms-0',
        )}
      >
        <Button
          variant="ghost"
          shape="icon"
          aria-label={label}
          aria-expanded={!rail.collapsed}
          onClick={rail.toggle}
        >
          <svg viewBox="0 0 16 16" className="size-icon" fill="none" aria-hidden="true">
            <rect
              x="2"
              y="3"
              width="12"
              height="10"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="M6 3v10" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </Button>
      </span>
    </div>
  )
}

/** The logo alone at the identity row's lead edge, where a compact screen has no brand zone. */
function BrandMark({ brand }: { brand: ShellBrand }): ReactElement {
  const Logo = brand.logo
  return (
    <span data-slot="shell-brand-mark" className="flex shrink-0 items-center ps-4 pe-2 md:hidden">
      {Logo !== undefined ? (
        <Logo className="size-6 shrink-0" aria-hidden />
      ) : (
        <span
          aria-hidden="true"
          className="grid size-6 shrink-0 place-items-center rounded-ctrl bg-primary font-head text-xs font-semibold text-primary-foreground"
        >
          {brand.name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  )
}

function ActionBody({ action, box }: { action: GlobalAction; box: ShellBox }): ReactElement {
  if (action.kind === 'custom') {
    return (
      // Clipped to one control row, with the focus ring's room around it: the padding widens the clip
      // and the matching negative margin keeps the footprint at the row's 32 px.
      <div
        data-slot="shell-action"
        className="-m-1 box-content flex h-8 items-center overflow-hidden p-1"
      >
        {action.render(box)}
      </div>
    )
  }
  const Icon = action.icon
  const glyph = <Icon className="size-icon" aria-hidden />
  if (action.kind === 'button') {
    return (
      <Button variant="ghost" shape="icon" aria-label={action.label} onClick={action.onClick}>
        {glyph}
      </Button>
    )
  }
  const count = action.badge ?? 0
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            shape="icon"
            aria-label={count > 0 ? `${action.label} (${count})` : action.label}
          />
        }
      >
        {glyph}
        {count > 0 && (
          <span
            aria-hidden="true"
            className="absolute end-0.5 top-0.5 min-w-4 rounded-full bg-warn px-1 text-center text-[10px]/4 font-medium text-primary-foreground"
          >
            {count}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent aria-label={action.label}>{action.content(box)}</PopoverContent>
    </Popover>
  )
}

/**
 * The row widths below which a tier yields (`core/header-tiers.ts`), as literal classes. Under
 * `native-overlay` the title bar's row also holds the brand zone, as wide as the expanded rail, so
 * each threshold takes that 240 px more.
 */
const YIELD = {
  web: { 2: '@max-[859.98px]/header:hidden', 3: '@max-[1039.98px]/header:hidden' },
  titlebar: { 2: '@max-[1099.98px]/header:hidden', 3: '@max-[1279.98px]/header:hidden' },
} as const
const KEBAB_SHOWN = {
  web: { 2: '@max-[859.98px]/header:inline-flex', 3: '@max-[1039.98px]/header:inline-flex' },
  titlebar: { 2: '@max-[1099.98px]/header:inline-flex', 3: '@max-[1279.98px]/header:inline-flex' },
} as const

/** One global action in the row: its tier decides from which width it yields to the kebab. */
function GlobalActionView({
  action,
  box,
  row,
}: {
  action: GlobalAction
  box: ShellBox
  row: keyof typeof YIELD
}): ReactElement {
  const tier = headerPriority(action.priority)
  const phoneOff = action.mobile === 'more' || action.mobile === 'hidden'
  return (
    <div
      data-item={action.id}
      data-label={action.label}
      data-priority={tier}
      data-phone-off={phoneOff ? '' : undefined}
      className={cn(
        'flex shrink-0 items-center',
        tier !== 1 && YIELD[row][tier],
        phoneOff && 'max-md:hidden',
      )}
    >
      <ActionBody action={action} box={box} />
    </div>
  )
}

export function Header({
  brand,
  breadcrumb,
  globalControls,
  globalActions,
  asideTrigger,
  sizeClass,
  workspace,
  chrome,
}: HeaderProps): ReactElement {
  const native = chrome === 'native-overlay'
  const rowRef = useRef<HTMLDivElement>(null)
  const box: ShellBox = { height: HEADER_BOX_HEIGHT, sizeClass }
  const tiers = kebabTiers(globalActions)
  return (
    <header
      data-slot="shell-header"
      data-tauri-drag-region={native ? 'deep' : undefined}
      className={cn(
        'relative flex min-w-0 items-center [grid-area:header]',
        native
          ? cn(NATIVE_HEADER, 'bg-background')
          : cn(
              // From `md` the strip is bare on the frame; the surface's own edge is the line under it.
              // The phone header paints the surface's color and closes on a hairline, which gives way
              // to a page's band, whose own rule closes the bar: header and band read as one.
              'max-md:bg-card',
              "max-md:after:pointer-events-none max-md:after:absolute max-md:after:inset-x-0 max-md:after:bottom-0 max-md:after:h-px max-md:after:bg-border max-md:after:content-['']",
              'group-data-page-band/shell:after:hidden',
            ),
        'group-data-[compact-header=hidden]/shell:max-md:hidden',
        PRINT_OFF,
      )}
    >
      {/* The row is the tier container: its content box is the window less the 12 px end padding. */}
      <div
        ref={rowRef}
        data-slot="shell-header-row"
        className="@container/header flex h-full w-full min-w-0 items-center pe-3"
      >
        {/* The crumb floor: never less than 6 rem of breadcrumb, beside the brand zone in a title bar. */}
        <div
          data-slot="shell-lead"
          className={cn(
            'flex flex-1 items-center',
            native ? 'min-w-[calc(var(--shell-rail-w)+6rem)]' : 'min-w-24',
          )}
        >
          {native && <Titlebar />}
          {native ? (
            <Brand brand={brand} native workspace={workspace} />
          ) : (
            <BrandMark brand={brand} />
          )}
          <div
            data-slot="shell-breadcrumb"
            className="ms-(--shell-gutter) flex min-w-0 items-center gap-2 text-sm text-muted-foreground [&>*]:min-w-0 [&>*]:truncate [&>[data-slot=page-breadcrumb-leaf]]:font-medium [&>[data-slot=page-breadcrumb-leaf]]:text-foreground [&>[data-slot=page-breadcrumb-separator]]:shrink-0 [&>[data-slot=page-breadcrumb-separator]]:overflow-visible"
          >
            {breadcrumb}
          </div>
        </div>
        {globalControls !== undefined && (
          <div
            data-slot="shell-center"
            className={cn(
              'shrink-0 items-center gap-2 px-2 md:px-3',
              // A slot with its own compact form stays in the row; any other hides below md.
              globalControls.compact === true ? 'flex' : 'hidden md:flex',
            )}
          >
            {globalControls.render()}
          </div>
        )}
        <div data-slot="shell-end" className="flex shrink-0 items-center gap-2 ps-2">
          {asideTrigger}
          {globalActions.length > 0 && (
            <div data-slot="shell-trail" className="flex shrink-0 items-center gap-1">
              {globalActions.map((action) => (
                <GlobalActionView
                  key={action.id}
                  action={action}
                  box={box}
                  row={native ? 'titlebar' : 'web'}
                />
              ))}
              {(tiers.p2 || tiers.p3) && (
                <HeaderKebab
                  actions={globalActions}
                  sizeClass={sizeClass}
                  rowRef={rowRef}
                  box={box}
                  className={cn(
                    'hidden shrink-0',
                    !tiers.phone && 'max-md:hidden!',
                    tiers.p3 && KEBAB_SHOWN[native ? 'titlebar' : 'web'][3],
                    tiers.p2 && KEBAB_SHOWN[native ? 'titlebar' : 'web'][2],
                  )}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
