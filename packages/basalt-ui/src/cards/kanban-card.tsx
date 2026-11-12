import { useEffect, useRef, useState } from 'react'
import type { ComponentType, ReactElement } from 'react'
import { cn } from '../core/cn'
import { kanban } from '../core/messages/kanban'
import { useMessages } from '../core/messages/use-messages'
import { Card } from '../ui/card'
import type { KanbanCardProps } from './contract'
import { kanbanActions } from './kanban-actions'
import type { KanbanAction } from './kanban-actions'
import type { KanbanMenuPopupProps } from './kanban-menu'
import { StatusMark } from './stat-card-parts'

/**
 * The one door to the menu popup. `import()` only: `ui/menu` is +47.3 KB against the card's 16 KB
 * ceiling (concept E6), so it loads on the first intent and never in the card's initial graph. A
 * test swaps `load` to delay the chunk (S6).
 */
export const menuChunk: {
  load: () => Promise<{ KanbanMenuPopup: ComponentType<KanbanMenuPopupProps> }>
} = { load: () => import('./kanban-menu') }

const warned = new Set<string>()

/** Test seam: forget which dev assertions already fired. */
export function resetKanbanWarnings(): void {
  warned.clear()
}

/**
 * The gate is a literal `process.env.NODE_ENV` read, so a bundler folds the body away in
 * production. A `'static'` card inside a draggable wrapper is a card with no keyboard path.
 */
function assertMovable(card: HTMLElement | null, isStatic: boolean): void {
  if (process.env.NODE_ENV === 'production' || !isStatic || warned.has('static-drag')) return
  if ((card?.closest('[draggable="true"]') ?? null) === null) return
  warned.add('static-drag')
  console.warn(
    "KanbanCard: move is 'static' inside a draggable wrapper. A dragged card needs the " +
      'non-drag path (WCAG 2.5.7); pass `move={{ column, index, columns, onMove }}`.',
  )
}

const BUTTON =
  'relative inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-ctrl border-0 bg-secondary p-0 text-muted-foreground no-underline shadow-raised hover:text-foreground focus-ring after:absolute after:inset-0 pointer-coarse:size-11'

/**
 * The card's one menu control. A single action is a plain button or link and never loads the
 * popup; several open the lazily loaded menu. The popup loads on the first hover, focus or touch,
 * and a click that beats the chunk only marks the menu open: focus stays on this button, and the
 * popup opens the moment it arrives.
 */
function CardMenu({
  title,
  moves,
  extras,
}: {
  title: string
  moves: readonly KanbanAction[]
  extras: readonly KanbanAction[]
}): ReactElement {
  const t = useMessages(kanban)
  const button = useRef<HTMLButtonElement>(null)
  const requested = useRef(false)
  const [Popup, setPopup] = useState<ComponentType<KanbanMenuPopupProps> | null>(null)
  const [open, setOpen] = useState(false)
  const all = [...moves, ...extras]
  const only = all.length === 1 ? all[0] : undefined

  const warm = (): void => {
    if (requested.current || only !== undefined) return
    requested.current = true
    menuChunk
      .load()
      .then((chunk) => setPopup(() => chunk.KanbanMenuPopup))
      .catch(() => {
        requested.current = false
        setOpen(false)
      })
  }

  if (only !== undefined) {
    const name = t('kanban.actionFor', only.label, title)
    if ('href' in only) {
      return (
        <a
          data-slot="kanban-menu"
          href={only.href}
          aria-label={name}
          className={cn(BUTTON, 'z-10')}
        >
          <Glyph kind="arrow" />
        </a>
      )
    }
    return (
      <button
        type="button"
        data-slot="kanban-menu"
        aria-label={name}
        onClick={only.run}
        className={cn(BUTTON, 'z-10')}
      >
        <Glyph kind="arrow" />
      </button>
    )
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        data-slot="kanban-menu"
        aria-label={t('kanban.actions', title)}
        aria-haspopup="menu"
        aria-expanded={open}
        onPointerEnter={warm}
        onFocus={warm}
        onTouchStart={warm}
        onClick={() => {
          warm()
          setOpen(!open)
        }}
        className={cn(BUTTON, 'z-10')}
      >
        <Glyph kind="dots" />
      </button>
      {Popup !== null && (
        <Popup anchor={button} open={open} onOpenChange={setOpen} moves={moves} extras={extras} />
      )}
    </>
  )
}

function Glyph({ kind }: { kind: 'dots' | 'arrow' }): ReactElement {
  return kind === 'dots' ? (
    <svg viewBox="0 0 16 16" className="size-icon" fill="currentColor" aria-hidden="true">
      <circle cx="3.5" cy="8" r="1.25" />
      <circle cx="8" cy="8" r="1.25" />
      <circle cx="12.5" cy="8" r="1.25" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" className="size-icon" fill="none" aria-hidden="true">
      <path
        d="M3 8h10m-4-4 4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * A work item on a board: a title that is the card's link (two lines, then clipped), an age that
 * gives way to the menu on hover and focus (and sits beside it on a coarse pointer), up to two
 * meta lines, up to four chips, a reason line and a verdict. Two tab stops: the link and the menu.
 *
 * `move` is required, so no card exists without the non-drag path (WCAG 2.5.7): the menu offers
 * Move up and Move down where `index` allows and one move per other column, and calls `onMove`
 * with the `Move` a drop produces. `'static'` is a read-only board. There is no drag engine: an
 * app's drag library attaches to a wrapper around the card. The menu loads on first intent.
 *
 * @useWhen a board column lists work items that move between states
 * @neverWhen the items are rows to compare (use a table) or a headline figure (use a stat card)
 *
 * @example
 * <KanbanCard
 *   id={issue.id}
 *   title={issue.title}
 *   href={`/issues/${issue.id}`}
 *   age="2 h"
 *   meta={['EP-412']}
 *   chips={[{ label: 'api' }]}
 *   move={{ column, index, columns, onMove: moveIssue }}
 * />
 */
export function KanbanCard<C extends string>(props: KanbanCardProps<C>): ReactElement {
  const { id, title, href, age, meta, chips, reason, status, menu, move } = props
  const t = useMessages(kanban)
  const root = useRef<HTMLDivElement>(null)
  const isStatic = move === 'static'
  useEffect(() => assertMovable(root.current, isStatic), [isStatic])

  const { moves, extras } = kanbanActions(id, move, menu, t)
  const hasMenu = moves.length + extras.length > 0
  const shownChips = (chips ?? []).filter((chip) => chip !== undefined)
  const Reason = reason?.icon

  return (
    <div
      ref={root}
      data-slot="kanban-card"
      data-card-id={id}
      data-dragging={move !== 'static' && move.dragging === true ? '' : undefined}
      className="group/kanban @container min-w-0 data-dragging:opacity-60"
    >
      <Card flush className="relative">
        {href !== undefined && (
          <a
            data-slot="kanban-target"
            href={href}
            aria-label={title}
            className="absolute inset-0 z-0 cursor-pointer rounded-card focus-ring focus-visible:-outline-offset-2"
          />
        )}
        <div className="flex flex-col gap-1.5 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <p
              data-slot="kanban-title"
              className="m-0 line-clamp-2 min-w-0 flex-1 text-sm font-medium text-foreground"
            >
              {title}
            </p>
            {(age !== undefined || hasMenu) && (
              <div className="grid shrink-0 items-center justify-items-end pointer-coarse:flex pointer-coarse:gap-1">
                {age !== undefined && (
                  <span
                    data-slot="kanban-age"
                    className={cn(
                      'col-start-1 row-start-1 text-xs text-muted-foreground tabular-nums',
                      hasMenu &&
                        'group-focus-within/kanban:opacity-0 group-hover/kanban:opacity-0 group-has-[[aria-expanded=true]]/kanban:opacity-0 pointer-coarse:opacity-100!',
                    )}
                  >
                    {age}
                  </span>
                )}
                {hasMenu && (
                  <div className="col-start-1 row-start-1 opacity-0 group-focus-within/kanban:opacity-100 group-hover/kanban:opacity-100 group-has-[[aria-expanded=true]]/kanban:opacity-100 pointer-coarse:opacity-100">
                    <CardMenu title={title} moves={moves} extras={extras} />
                  </div>
                )}
              </div>
            )}
          </div>
          {meta?.map((line) => (
            <p
              key={line}
              data-slot="kanban-meta"
              className="m-0 truncate text-xs text-muted-foreground"
            >
              {line}
            </p>
          ))}
          {shownChips.length > 0 && (
            <ul data-slot="kanban-chips" className="m-0 flex list-none flex-wrap gap-1 p-0">
              {shownChips.map((chip) => (
                <li
                  key={chip.label}
                  className="inline-flex h-5 max-w-full items-center gap-1 rounded-chip bg-secondary px-1.5 text-xs text-muted-foreground"
                >
                  {chip.icon !== undefined && <chip.icon className="size-3 shrink-0" aria-hidden />}
                  <span className="truncate">{chip.label}</span>
                </li>
              ))}
            </ul>
          )}
          {reason !== undefined && (
            <p className="m-0 flex items-start gap-1.5 text-xs text-muted-foreground">
              {Reason !== undefined && <Reason className="mt-0.5 size-3 shrink-0" aria-hidden />}
              <span className="line-clamp-2">{reason.text}</span>
            </p>
          )}
          {status !== undefined && <StatusMark status={status} />}
        </div>
      </Card>
    </div>
  )
}
