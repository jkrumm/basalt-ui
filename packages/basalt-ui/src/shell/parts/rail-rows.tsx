/**
 * One rail nav row, for every width. The DOM is the same expanded and collapsed; the rail is a size
 * container (`@container` on the `<nav>`) and the collapsed form is `@max-[120px]` (the rail is 64
 * px collapsed, 240 expanded), so the server markup needs no JS to be right.
 *
 * - The anchor is `navAnchor(row.item)`: keyed on the declared item object, never a copy, so a
 *   re-projection never remounts the link (anchor identity law).
 * - Only the active row carries `aria-current="page"`; an ancestor carries `data-ancestor`.
 * - The accessible name is the label plus the count, so the collapsed rail (label visually gone)
 *   still says `Calendar, 3`.
 * - Collapsed: the label is `sr-only`, a lit badge becomes a dot on the icon, a tooltip names the
 *   row. A parent opens a popover with its children there; expanded they sit inline.
 */
import { createElement, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { cn } from '../../core/cn'
import { CountBadge } from '../../ui/badge'
import { Popover, PopoverContent } from '../../ui/popover'
import { Tooltip } from '../../ui/tooltip'
import { isLit } from '../core/badges'
import type { RailRow } from '../core/projector'
import type { NavBadge } from '../core/types'
import { navAnchor } from '../../router/nav/anchor'
import type { AnyNavItem } from '../../router/nav/types'
import { useRailControl } from './grid'
import { rowName } from './rail-text'

/** First grapheme of a label: the icon an icon-less item falls back to. */
const segmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : undefined

export function initialOf(label: string): string {
  const first = segmenter
    ? segmenter.segment(label)[Symbol.iterator]().next().value?.segment
    : [...label][0]
  return first?.toUpperCase() ?? '?'
}

/** The row's own count, when it carries one. */
const countOf = (badge: NavBadge | null): number | undefined =>
  badge !== null && 'count' in badge && isLit(badge) ? badge.count : undefined

const ROW =
  'group/row flex h-8 w-full min-w-0 items-center gap-2.5 rounded-ctrl px-2.5 text-sm text-muted-foreground outline-none select-none hover:bg-accent hover:text-foreground focus-ring aria-[current=page]:bg-selected aria-[current=page]:font-medium aria-[current=page]:text-foreground data-ancestor:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50'

/** The dot: the collapsed rail's form of a lit badge, on the icon's corner. */
function Dot({ row }: { row: RailRow }): ReactElement | null {
  if (!isLit(row.rollup)) return null
  return (
    <span
      data-slot="shell-rail-dot"
      aria-hidden="true"
      data-tone={row.tone}
      className={cn(
        'absolute end-0 top-0 hidden size-1.5 rounded-full @max-[120px]:block',
        row.tone === 'warn' ? 'bg-warn' : 'bg-muted-foreground',
      )}
    />
  )
}

function Icon({ row }: { row: RailRow }): ReactElement {
  const Glyph = row.icon
  return (
    <span
      data-slot="shell-rail-row-icon"
      className="relative flex size-4 shrink-0 items-center justify-center"
    >
      {Glyph ? (
        <Glyph className="size-4" aria-hidden />
      ) : (
        // The letter is generated content, never text: a screen reader and axe's label-in-name rule
        // both read the visible label alone.
        <span
          aria-hidden="true"
          data-nav-glyph={initialOf(row.label)}
          className="text-xs leading-none font-medium before:content-[attr(data-nav-glyph)]"
        />
      )}
      <Dot row={row} />
    </span>
  )
}

/** The expanded row-end badge. Hidden in the collapsed rail, where the dot stands in. */
function EndBadge({ row }: { row: RailRow }): ReactElement | null {
  const { badge } = row
  if (!isLit(badge)) return null
  const attention = badge.attention === true
  if ('dot' in badge) {
    return (
      <span
        data-slot="shell-rail-row-badge"
        aria-hidden="true"
        className={cn(
          'ms-auto size-1.5 shrink-0 rounded-full @max-[120px]:hidden',
          attention ? 'bg-warn' : 'bg-muted-foreground',
        )}
      />
    )
  }
  return (
    <span
      data-slot="shell-rail-row-badge"
      aria-hidden="true"
      className="ms-auto flex @max-[120px]:hidden"
    >
      <CountBadge count={badge.count} attention={attention} />
    </span>
  )
}

type RowProps = { row: RailRow }

/** The link (or, for a disabled row, the inert span) with its icon, label and badge. */
function RowBody({
  row,
  className,
  ...rest
}: RowProps & { className?: string; onClick?: () => void }): ReactElement {
  const name = rowName(row.label, countOf(row.badge))
  const body = (
    <>
      <Icon row={row} />
      <span className="min-w-0 flex-1 truncate text-start @max-[120px]:sr-only">{row.label}</span>
      <EndBadge row={row} />
    </>
  )
  // `rest` carries what a trigger (tooltip, popover) merges in; the row's own identity wins over it.
  const common = {
    ...rest,
    'data-slot': 'shell-rail-row',
    'data-depth': row.depth,
    'aria-label': name,
    className: cn(ROW, className),
  }
  if (row.disabled) {
    return (
      <span {...common} aria-disabled="true" data-disabled="">
        {body}
      </span>
    )
  }
  return createElement(
    navAnchor(row.item as AnyNavItem),
    {
      ...common,
      ...(row.active && { 'aria-current': 'page' as const }),
      ...(row.ancestor && { 'data-ancestor': '' }),
    },
    body,
  )
}

/** A parent's children as rows, in the popover. Plain geometry: the popover sits outside the container. */
function ChildRows({ rows }: { rows: readonly RailRow[] }): ReactElement {
  return (
    <div className="flex flex-col gap-px">
      {rows.map((child) => (
        <RailRowView key={child.id} row={child} />
      ))}
    </div>
  )
}

/**
 * A row and, expanded, its children inline beneath it. In the collapsed rail the inline list is
 * display-none and a popover beside the group lists them instead. The popover is controlled and
 * anchored to the group, not a trigger: a trigger would turn the link into a button, and the parent
 * must stay a link in both forms. Hover, press and focus on the group open it; React events bubble
 * out of the portal, so the pointer resting on the popover keeps it open.
 */
function ParentRow({ row }: RowProps): ReactElement {
  const { collapsed } = useRailControl()
  const [open, setOpen] = useState(false)
  const group = useRef<HTMLDivElement>(null)
  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- hover and focus only reveal a popover; the row inside is the interactive element
    <div
      ref={group}
      data-slot="shell-rail-group"
      className="flex flex-col gap-px"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
    >
      <RowBody row={row} onClick={() => setOpen(true)} />
      <div
        data-slot="shell-rail-children"
        className="flex flex-col gap-px ps-3 @max-[120px]:hidden"
      >
        {row.children.map((child) => (
          <RailRowView key={child.id} row={child} />
        ))}
      </div>
      <Popover open={collapsed && open} onOpenChange={setOpen}>
        <PopoverContent
          anchor={group}
          side="right"
          align="start"
          aria-label={row.label}
          initialFocus={false}
          className="w-56 p-1.5"
        >
          <ChildRows rows={row.children} />
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function RailRowView({ row }: RowProps): ReactElement {
  const { collapsed } = useRailControl()
  if (row.children.length > 0) return <ParentRow row={row} />
  return (
    <Tooltip label={row.label} side="right" disabled={!collapsed}>
      <RowBody row={row} />
    </Tooltip>
  )
}
