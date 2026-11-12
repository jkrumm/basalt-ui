/**
 * The header: three bare regions on one row of one height.
 *
 * - `start` (`shell-lead`): the brand zone, as wide as the rail so the breadcrumb after it starts on
 *   `Main`'s own edge, then the breadcrumb. The server renders the nav-derived breadcrumb; a page's
 *   `PageBar title` replaces it.
 * - `center`: the global controls (`AppShell globalControls`). Hidden compact.
 * - `end`: the page's claimed actions, the aside trigger on a compact screen, then the global
 *   actions (`shell-trail`).
 *
 * The global actions run in priority tiers (`core/header-tiers.ts` holds the numbers): the header
 * row is a size container, a `priority` 3 action yields below 1280 px of row width, a 2 below 1100,
 * a 1 never, and a yielded action is listed in the ONE kebab so nothing is lost. All of it is CSS,
 * so the server markup is right at every width.
 */
import { useRef } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../../core/cn'
import type { ControlsSlot } from '../../core/ports'
import { Button } from '../../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover'
import type { GlobalAction, ShellBox, ShellBrand, SizeClass } from '../contract'
import { headerPriority } from '../core/header-tiers'
import { useRailControl } from './grid'
import { HeaderKebab, kebabTiers } from './header-kebab'
import { PRINT_OFF } from './print'

/** The height a `custom` or `popover` global action is clipped to: one control row. */
export const HEADER_BOX_HEIGHT = 32

export type HeaderProps = {
  brand: ShellBrand
  /** The breadcrumb's content: the claimed trail, or the nav-derived leaf. */
  breadcrumb: ReactNode
  globalControls: ControlsSlot | undefined
  /** The page's claimed `actions`. */
  actions: ReactNode
  globalActions: readonly GlobalAction[]
  /** The compact-screen trigger of a claimed aside. */
  asideTrigger: ReactNode
  sizeClass: SizeClass
}

/**
 * The brand zone, as wide as the rail so the breadcrumb after it starts on `Main`'s own edge. The
 * rail's collapse toggle lives here: expanded it sits at the zone's end, collapsed it is the zone's
 * only content, centred on the rail.
 */
function Brand({ brand }: { brand: ShellBrand }): ReactElement {
  const Logo = brand.logo
  const rail = useRailControl()
  const label = rail.collapsed ? 'Expand sidebar' : 'Collapse sidebar'
  return (
    <div
      data-slot="shell-brand-zone"
      className={cn(
        'flex shrink-0 items-center gap-2 ps-4 pe-2 md:w-(--shell-rail-w) md:overflow-hidden',
        // Collapsed: the zone is the rail's width and holds the toggle alone, centred.
        'group-data-[rail=collapsed]/shell:md:justify-center group-data-[rail=collapsed]/shell:md:p-0',
        'group-data-[rail=auto]/shell:md:max-xl:justify-center group-data-[rail=auto]/shell:md:max-xl:p-0',
      )}
    >
      {Logo !== undefined ? (
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
      <span
        data-slot="shell-rail-toggle"
        className={cn(
          'ms-auto hidden shrink-0 md:inline-flex',
          'group-data-[rail=collapsed]/shell:md:ms-0 group-data-[rail=auto]/shell:md:max-xl:ms-0',
        )}
      >
        <Button
          variant="ghost"
          size="icon"
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

function ActionBody({ action, box }: { action: GlobalAction; box: ShellBox }): ReactElement {
  if (action.kind === 'custom') {
    return (
      <div data-slot="shell-action" className="h-8 overflow-hidden">
        {action.render(box)}
      </div>
    )
  }
  const Icon = action.icon
  const glyph = <Icon className="size-icon" aria-hidden />
  if (action.kind === 'button') {
    return (
      <Button variant="ghost" size="icon" aria-label={action.label} onClick={action.onClick}>
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
            size="icon"
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

/** One global action in the row: its tier decides from which width it yields to the kebab. */
function GlobalActionView({ action, box }: { action: GlobalAction; box: ShellBox }): ReactElement {
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
        tier === 2 && '@max-[1099.98px]/header:hidden',
        tier === 3 && '@max-[1279.98px]/header:hidden',
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
  actions,
  globalActions,
  asideTrigger,
  sizeClass,
}: HeaderProps): ReactElement {
  const rowRef = useRef<HTMLDivElement>(null)
  const box: ShellBox = { height: HEADER_BOX_HEIGHT, sizeClass }
  const tiers = kebabTiers(globalActions)
  return (
    <header
      data-slot="shell-header"
      className={cn(
        'flex min-w-0 items-center border-b border-border bg-background [grid-area:header]',
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
        {/* The crumb floor: never less than 6 rem of breadcrumb beside the brand zone. */}
        <div
          data-slot="shell-lead"
          className="flex min-w-[calc(var(--shell-rail-w)+6rem)] flex-1 items-center"
        >
          <Brand brand={brand} />
          <div
            data-slot="shell-breadcrumb"
            className="ms-(--shell-gutter) flex min-w-0 items-center gap-2 text-sm text-muted-foreground [&>*]:min-w-0 [&>*]:truncate [&>[data-slot=page-breadcrumb-leaf]]:font-medium [&>[data-slot=page-breadcrumb-leaf]]:text-foreground [&>[data-slot=page-breadcrumb-parent]]:after:ms-2 [&>[data-slot=page-breadcrumb-parent]]:after:text-faint [&>[data-slot=page-breadcrumb-parent]]:after:content-['/']"
          >
            {breadcrumb}
          </div>
        </div>
        {globalControls !== undefined && (
          <div data-slot="shell-center" className="hidden shrink-0 items-center gap-2 px-3 md:flex">
            {globalControls.render()}
          </div>
        )}
        <div data-slot="shell-end" className="flex shrink-0 items-center gap-2 ps-2">
          <div data-slot="shell-page-bar-host" className="flex min-w-0 items-center gap-2">
            {actions}
          </div>
          {asideTrigger}
          {globalActions.length > 0 && (
            <div data-slot="shell-trail" className="flex shrink-0 items-center gap-1">
              {globalActions.map((action) => (
                <GlobalActionView key={action.id} action={action} box={box} />
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
                    tiers.p3 && '@max-[1279.98px]/header:inline-flex',
                    tiers.p2 && '@max-[1099.98px]/header:inline-flex',
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
