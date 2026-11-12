/**
 * The surfaces a phone tab can raise: the More surface and a section tab that holds several
 * destinations. Both are `ui/sheet`, a bottom panel over the page; the projector picked `menu` or
 * `sheet` from the row count and that is the only difference here:
 *
 * - `sheet` rises from the bottom edge;
 * - `menu` is the same panel lifted clear of the bar, so the tab that opened it stays in view.
 *
 * Either way the panel caps at `min(72dvh, 560px)` (`ui/sheet`'s bottom variant) and its rows scroll
 * INSIDE it with `overscroll-behavior: contain`, so a long list costs scroll, never fold. The rows
 * are the projector's `PhoneRow`s painted as they come; nothing here selects, orders or counts them.
 */
import { useRouter } from '@tanstack/react-router'
import type { MouseEvent, ReactElement, ReactNode } from 'react'
import { cn } from '../../../core/cn'
import { CountBadge } from '../../../ui/badge'
import { Sheet, SheetContent } from '../../../ui/sheet'
import { navAnchor } from '../../../router/nav/anchor'
import type { AnyNavItem } from '../../../router/nav/types'
import type { Account, SidebarBlock } from '../../contract'
import { isLit } from '../../core/badges'
import type { CoreBlock } from '../../core/block-model'
import type { PhoneExtraRow, PhoneGroup, PhoneRow, PhoneSlot } from '../../core/mobile-projection'
import type { NavBadge } from '../../core/types'
import { retap } from './retap'

/** The slots that raise a surface (the More slot, or a section slot holding several destinations). */
export type SurfaceSlot = Extract<PhoneSlot, { kind: 'menu' | 'sheet' }>

/**
 * The part's own strings. `shell.*` message keys belong to the messages concept (v3-qa-i2) and are
 * not there yet; until they land these English defaults stand in, like `SHELL_TEXT`.
 */
export const MOBILE_TEXT = {
  signIn: 'Sign in',
  signOut: 'Sign out',
} as const

/** A destination's own row height: above the 44 px touch floor, below nothing. */
const ROW =
  'flex min-h-12 w-full items-center gap-3 px-4 text-start text-sm text-foreground outline-none focus-ring touch-manipulation hover:bg-accent aria-disabled:opacity-50 aria-disabled:hover:bg-transparent'

/** The scroller of a surface: its rows scroll inside it and never chain to the page. */
const BODY =
  'min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-color:var(--vx-line)_transparent] [scrollbar-gutter:stable_both-edges] [scrollbar-width:thin]'

/** A `menu` surface sits above the bar: the bar's own height (48 + its 1 px seam) plus the inset. */
const LIFT = 'mb-[calc(--spacing(12)+1px+env(safe-area-inset-bottom))] rounded-card'

/** What a custom block's `render` receives: a phone, in a sheet that never exceeds 560 px. */
const BLOCK_BOX = { height: 560, sizeClass: 'compact' } as const

type PanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  variant: 'menu' | 'sheet'
  children: ReactNode
}

/**
 * One panel. `ui/sheet` pads its popup, so the slot element pulls out to the popup's edge (`-mx-4
 * -mb-4`) and owns the inset itself: the sheet is then flush to the viewport floor and the
 * safe-area inset is the one gap under the last row.
 */
function Panel({ open, onOpenChange, title, variant, children }: PanelProps): ReactElement {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} placement="bottom">
      <SheetContent title={title} className={variant === 'menu' ? LIFT : ''}>
        {variant === 'menu' ? (
          <div data-slot="shell-menu" className={cn(BODY, '-mx-4 -mb-4')}>
            {children}
          </div>
        ) : (
          <div
            data-slot="shell-sheet"
            className="-mx-4 -mb-4 flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)]"
          >
            <div data-slot="shell-sheet-body" className={BODY}>
              {children}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function RowBadge({ badge }: { badge: NavBadge | null }): ReactElement | null {
  if (!isLit(badge)) return null
  if ('dot' in badge) {
    return (
      <span
        aria-hidden="true"
        className={cn('size-2 rounded-full', badge.attention === true ? 'bg-warn' : 'bg-muted')}
      />
    )
  }
  return <CountBadge count={badge.count} attention={badge.attention === true} />
}

function RowBody({ row }: { row: PhoneRow }): ReactElement {
  const Icon = row.icon
  return (
    <>
      {Icon !== undefined && (
        <Icon className="size-icon shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1 truncate">{row.label}</span>
      <RowBadge badge={row.badge} />
    </>
  )
}

type DestinationProps = {
  row: PhoneRow
  depth: number
  close: () => void
}

/** One destination: the item's own router anchor, so preload, middle click and back all work. */
function DestinationRow({ row, depth, close }: DestinationProps): ReactElement {
  const router = useRouter()
  const className = cn(ROW, depth > 0 && 'ps-9', row.active && 'bg-selected font-medium')
  if (row.disabled) {
    return (
      <span data-slot="shell-sheet-rows" aria-disabled="true" className={className}>
        <RowBody row={row} />
      </span>
    )
  }
  const Anchor = navAnchor(row.item as unknown as AnyNavItem)
  const onClick = (event: MouseEvent<HTMLElement>): void => {
    if (retap(row, event, router.state.location.href)) close()
  }
  return (
    // oxlint-disable-next-line react/static-components -- `navAnchor` is cached per item object: one stable component type
    <Anchor
      data-slot="shell-sheet-rows"
      aria-current={row.active ? 'page' : undefined}
      className={className}
      onClick={onClick}
    >
      <RowBody row={row} />
    </Anchor>
  )
}

/** Depth-first: a parent, then its children as indented rows, so nesting survives to the phone. */
function destinationRows(rows: readonly PhoneRow[], depth: number, close: () => void): ReactNode[] {
  return rows.flatMap((row) => [
    <DestinationRow key={row.id} row={row} depth={depth} close={close} />,
    ...destinationRows(row.children, depth + 1, close),
  ])
}

function GroupHeading({ group }: { group: PhoneGroup }): ReactElement | null {
  if (group.label === undefined) return null
  return (
    <p className="px-4 pt-3 pb-1 text-micro font-medium text-muted-foreground">{group.label}</p>
  )
}

function ActionRow({
  label,
  onClick,
  icon,
}: {
  label: string
  onClick: () => void
  icon?: ReactElement | undefined
}): ReactElement {
  return (
    <button type="button" data-slot="shell-sheet-rows" className={ROW} onClick={onClick}>
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  )
}

/** `Awaiting action · 3`: the row's whole job is to say how much is behind it. */
export function blockRowLabel(block: CoreBlock): string {
  if (block.kind === 'custom') return block.mobile?.label ?? block.id
  if (block.kind === 'list') return `${block.label} · ${block.count ?? block.items.length}`
  return `${block.label} · ${Math.round(block.value * 100)}%`
}

export type MoreSurfaceProps = {
  slot: SurfaceSlot
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The settings and account declared on the shell; the projector holds only their row ids. */
  account: Account | undefined
  /** A list or custom block raised its own sheet; the bar opens it one frame after this closes. */
  onBlock: (block: CoreBlock) => void
}

function ExtraRow({
  extra,
  account,
  close,
  onBlock,
}: {
  extra: PhoneExtraRow
  account: Account | undefined
  close: () => void
  onBlock: (block: CoreBlock) => void
}): ReactElement | null {
  if (extra.kind === 'block') {
    return (
      <ActionRow
        label={blockRowLabel(extra.block)}
        onClick={() => {
          close()
          onBlock(extra.block)
        }}
      />
    )
  }
  if (extra.kind === 'settings') {
    const Icon = extra.item.icon
    return (
      <ActionRow
        label={extra.item.label}
        icon={
          Icon === undefined ? undefined : (
            <Icon className="size-icon shrink-0 text-muted-foreground" aria-hidden="true" />
          )
        }
        onClick={() => {
          close()
          extra.item.onClick()
        }}
      />
    )
  }
  if (account === undefined || account.status === 'loading') return null
  if (extra.role === 'sign-in' && account.status === 'signed-out') {
    return (
      <ActionRow
        label={MOBILE_TEXT.signIn}
        onClick={() => {
          close()
          account.onSignIn()
        }}
      />
    )
  }
  if (account.status !== 'signed-in') return null
  if (extra.role === 'identity') {
    return (
      <div data-slot="shell-sheet-rows" className={cn(ROW, 'hover:bg-transparent')}>
        {account.avatar !== undefined && (
          <img src={account.avatar} alt="" className="size-8 shrink-0 rounded-full" />
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{account.name}</span>
          {account.detail !== undefined && (
            <span className="truncate text-xs text-muted-foreground">{account.detail}</span>
          )}
        </span>
      </div>
    )
  }
  if (extra.role === 'row' && extra.row !== undefined) {
    const { label, onClick } = extra.row
    return (
      <ActionRow
        label={label}
        onClick={() => {
          close()
          onClick()
        }}
      />
    )
  }
  if (extra.role === 'sign-out' && account.onSignOut !== undefined) {
    const { onSignOut } = account
    return (
      <ActionRow
        label={MOBILE_TEXT.signOut}
        onClick={() => {
          close()
          onSignOut()
        }}
      />
    )
  }
  return null
}

/** The surface of one slot: its destination groups, then the rows that are not destinations. */
export function MoreSurface({
  slot,
  open,
  onOpenChange,
  account,
  onBlock,
}: MoreSurfaceProps): ReactElement {
  const close = (): void => onOpenChange(false)
  const hasGroups = slot.groups.some((group) => group.rows.length > 0)
  return (
    <Panel
      open={open}
      onOpenChange={onOpenChange}
      title={slot.label}
      variant={slot.kind === 'menu' ? 'menu' : 'sheet'}
    >
      {slot.groups.map((group) => (
        <div key={group.id} className="flex flex-col">
          <GroupHeading group={group} />
          {destinationRows(group.rows, 0, close)}
        </div>
      ))}
      {slot.extras.length > 0 && (
        // A separator separates: with no destination above it the tail opens no band.
        <div className={cn('flex flex-col', hasGroups && 'mt-1 border-t border-border pt-1')}>
          {slot.extras.map((extra) => (
            <ExtraRow
              key={extra.id}
              extra={extra}
              account={account}
              close={close}
              onBlock={onBlock}
            />
          ))}
        </div>
      )}
    </Panel>
  )
}

/** The nested sheet a block row raises: a list's rows, or a custom block's own node. */
export function BlockSheet({
  block,
  contract,
  open,
  onOpenChange,
}: {
  block: CoreBlock
  /** The declared blocks, for a custom block's `render` (the core block carries no node). */
  contract: readonly SidebarBlock[]
  open: boolean
  onOpenChange: (open: boolean) => void
}): ReactElement | null {
  if (block.kind === 'progress') return null
  const title = blockRowLabel(block)
  const declared = contract.find((candidate) => candidate.id === block.id)
  return (
    <Panel open={open} onOpenChange={onOpenChange} title={title} variant="sheet">
      {block.kind === 'list'
        ? block.items.map((item) => (
            <ActionRow
              key={item.id}
              label={item.meta === undefined ? item.label : `${item.label} · ${item.meta}`}
              onClick={() => {
                onOpenChange(false)
                item.onClick?.()
              }}
            />
          ))
        : declared?.kind === 'custom'
          ? declared.render(BLOCK_BOX)
          : null}
    </Panel>
  )
}
