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
 * The priority tiers and the one kebab are v3-shell-i5b-rail's: this file renders every global
 * action in order and clips nothing.
 */
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../../core/cn'
import type { ControlsSlot } from '../../core/ports'
import { Button } from '../../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover'
import type { GlobalAction, ShellBox, ShellBrand, SizeClass } from '../contract'
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

function Brand({ brand }: { brand: ShellBrand }): ReactElement {
  const Logo = brand.logo
  return (
    <div
      data-slot="shell-brand"
      className="flex shrink-0 items-center gap-2 ps-4 pe-2 md:w-(--shell-rail-w) md:overflow-hidden"
    >
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
      <span
        className={cn(
          'hidden truncate font-head text-sm font-semibold',
          // The name shows only when the rail beside it is open.
          'group-data-[rail=expanded]/shell:md:inline group-data-[rail=auto]/shell:xl:inline',
          'group-data-[rail=collapsed]/shell:hidden',
        )}
      >
        {brand.name}
      </span>
    </div>
  )
}

function GlobalActionView({
  action,
  sizeClass,
}: {
  action: GlobalAction
  sizeClass: SizeClass
}): ReactElement {
  const box: ShellBox = { height: HEADER_BOX_HEIGHT, sizeClass }
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
      <Button
        data-slot="shell-action"
        variant="ghost"
        size="icon"
        aria-label={action.label}
        onClick={action.onClick}
      >
        {glyph}
      </Button>
    )
  }
  const count = action.badge ?? 0
  return (
    <Popover>
      <PopoverTrigger
        data-slot="shell-action"
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

export function Header({
  brand,
  breadcrumb,
  globalControls,
  actions,
  globalActions,
  asideTrigger,
  sizeClass,
}: HeaderProps): ReactElement {
  return (
    <header
      data-slot="shell-header"
      className={cn(
        'flex min-w-0 items-center border-b border-border bg-background [grid-area:header]',
        'group-data-[compact-header=hidden]/shell:max-md:hidden',
        PRINT_OFF,
      )}
    >
      <div data-slot="shell-lead" className="flex min-w-0 flex-1 items-center gap-2">
        <Brand brand={brand} />
        <div
          data-slot="shell-breadcrumb"
          className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground [&>*]:min-w-0 [&>*]:truncate [&>[data-slot=page-breadcrumb-leaf]]:font-medium [&>[data-slot=page-breadcrumb-leaf]]:text-foreground [&>[data-slot=page-breadcrumb-parent]]:after:ms-2 [&>[data-slot=page-breadcrumb-parent]]:after:text-faint [&>[data-slot=page-breadcrumb-parent]]:after:content-['/']"
        >
          {breadcrumb}
        </div>
      </div>
      {globalControls !== undefined && (
        <div data-slot="shell-center" className="hidden shrink-0 items-center gap-2 px-3 md:flex">
          {globalControls.render()}
        </div>
      )}
      <div data-slot="shell-end" className="flex shrink-0 items-center gap-2 pe-3 ps-2">
        {actions}
        {asideTrigger}
        {globalActions.length > 0 && (
          <div data-slot="shell-trail" className="flex shrink-0 items-center gap-1">
            {globalActions.map((action) => (
              <GlobalActionView key={action.id} action={action} sizeClass={sizeClass} />
            ))}
          </div>
        )}
      </div>
    </header>
  )
}
