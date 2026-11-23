/**
 * `MailList`: a mailbox's list pane. Rows of sender, subject and snippet under sticky period headers
 * (Today, Yesterday, This week, Earlier this month, then months and years, read by `periodOf`),
 * windowed by the `VirtualList` the app passes, with a selection the caller owns and a floating bulk bar at its foot.
 */
import { useEffect, useId, useRef, useState } from 'react'
import type { ComponentType, FocusEvent, KeyboardEvent, ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { useFormat } from '../core/format'
import { lists } from '../core/messages/lists'
import { useMessages } from '../core/messages/use-messages'
import type { FrameState } from '../core/phase'
import { useIntl } from '../core/provider-props'
import type { IconComponent, NavTarget, VirtualLike } from '../core/ports'
import { Avatar } from '../ui/avatar'
import type { AvatarEntry } from '../ui/avatar'
import { Button } from '../ui/button'
import { CardPhase } from '../ui/card'
import { Checkbox } from '../ui/checkbox'
import { EntityChip } from '../ui/entity'
import type { EntityAvatar } from '../ui/entity'
import { groupByDay, isInstant, periodOf, toInstant } from './event-list-model'
import { usePeriodLabel } from './period-label'

/** An entry as `Avatar` props: absent keys stay absent. */
export const faceOf = (entry: AvatarEntry): AvatarEntry => ({
  name: entry.name,
  ...(entry.src !== undefined && { src: entry.src }),
  ...(entry.icon !== undefined && { icon: entry.icon }),
})

/** Who sent it: a face, and the organisation as a badge on the face's corner where it is known. */
export type MailSender = AvatarEntry & {
  /** The sender's organisation: a small square on the avatar's corner. */
  org?: AvatarEntry | undefined
}

/** One conversation in the list. */
export type MailItem = {
  /** Unique and stable: the row's identity across renders and in the selection. */
  id: string
  from: MailSender
  subject: string
  /** The opening words of the latest message, one line. */
  snippet: string
  /** When the latest message arrived; it files the row under its period. */
  at: Date | number
  /** Draws the unread dot and sets sender and subject in the heavier weight. */
  unread?: boolean | undefined
  starred?: boolean | undefined
  /** Messages in the conversation, printed after the sender from 2. */
  count?: number | undefined
  /** Draws a paperclip after the snippet. */
  attachments?: boolean | undefined
  /** The record the mail is about, as a chip on a fourth line: a purchase order, a supplier. */
  entity?: { label: string; href?: string | NavTarget; avatar?: EntityAvatar } | undefined
}

/** A row action, shown in a small cluster on the row while it is hovered or holds focus. */
export type MailRowAction = {
  id: string
  label: string
  icon: IconComponent
  onClick: (item: MailItem) => void
}

export type MailListProps = FrameState & {
  /** Names the list for assistive tech: the folder (`Inbox`). */
  label: string
  /** Newest first, as the caller sorts them: the list never re-sorts, it groups runs by period. */
  items: readonly MailItem[]
  /** The reading time the period headers are read against; the caller's, so server and client agree. */
  now: Date | number
  /** The first day of the week for the This week header, 0 for Sunday. Default 1, Monday. */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6
  /** The id shown in the reader: its row is marked current. */
  open?: string | null | undefined
  /** A click, Enter or Space on a row. */
  onOpen: (id: string) => void
  /** The selected ids. While any is selected every row shows its checkbox. */
  selected: readonly string[]
  onSelectedChange: (ids: readonly string[]) => void
  /** Draws the star as a button. Without it a starred row shows the star as a mark. */
  onStar?: ((item: MailItem, starred: boolean) => void) | undefined
  /** At most three actions on the hovered or focused row (archive, mark unread). */
  actions?: readonly MailRowAction[] | undefined
  /**
   * The window the rows render through: `VirtualList` from `basalt-ui/ui/virtual-list`, passed in so
   * `./cards` needs no virtual peer. It keeps every period header mounted, so the one above the top
   * edge still sticks.
   */
  virtual: VirtualLike
  /** What the selection can do, drawn floating at the list's foot while any row is selected: a `BulkBar` from `basalt-ui/table` in its list form. */
  bulk?: ReactNode
}

/** Header and row heights in px: fixed, so the window positions every row without measuring. */
const HEADER_H = 32
const ROW_H = 80
const ROW_CHIP_H = 112

type Entry =
  | { kind: 'header'; id: string; label: string; count: number }
  | { kind: 'row'; item: MailItem }

function StarGlyph({ filled }: { filled: boolean }): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn('size-3.5', filled ? 'fill-warn text-warn' : 'fill-none')}
      aria-hidden="true"
    >
      <path
        d="M8 1.75l1.93 3.9 4.3.63-3.11 3.03.73 4.29L8 11.57l-3.85 2.03.73-4.29-3.11-3.03 4.3-.63z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ClipGlyph({ label }: { label: string }): ReactElement {
  return (
    <>
      <span className="sr-only">{label}</span>
      <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="none" aria-hidden="true">
        <path
          d="M13 7.5l-5.2 5.2a3.2 3.2 0 01-4.5-4.5L8.6 2.9a2.1 2.1 0 013 3L6.3 11.2a1 1 0 01-1.5-1.5L9.5 5"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </>
  )
}

type RowProps = {
  item: MailItem
  current: boolean
  checked: boolean
  time: string
  onOpen: (id: string) => void
  onToggle: (id: string) => void
  onStar: MailListProps['onStar']
  actions: readonly MailRowAction[]
}

function MailRow({
  item,
  current,
  checked,
  time,
  onOpen,
  onToggle,
  onStar,
  actions,
}: RowProps): ReactElement {
  const t = useMessages(lists)
  const unread = item.unread === true
  const starred = item.starred === true
  const name = `${unread ? `${t('lists.mailUnread')}, ` : ''}${item.from.name}, ${item.subject}`
  return (
    <div
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a windowed row among spacer divs, which an li cannot sit beside
      role="listitem"
      data-slot="mail-row"
      data-unread={unread ? '' : undefined}
      data-current={current ? '' : undefined}
      data-checked={checked ? '' : undefined}
      className={cn(
        'group/row relative flex gap-3 border-b border-border px-4 py-3 transition-colors duration-fast motion-reduce:transition-none',
        'hover:bg-accent/60 data-checked:bg-accent/60 data-current:bg-accent',
        item.entity === undefined ? 'h-20' : 'h-28',
      )}
    >
      <button
        type="button"
        data-mail-open={item.id}
        aria-label={name}
        aria-current={current ? 'true' : undefined}
        onClick={() => onOpen(item.id)}
        className="absolute inset-0 cursor-pointer border-0 bg-transparent p-0 focus-ring focus-visible:-outline-offset-2"
      />
      {unread && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute start-1 top-3 flex h-5 items-center"
        >
          <span data-slot="mail-unread" className="size-2 rounded-full bg-brand" />
        </span>
      )}
      <span className="relative size-7 shrink-0">
        <span
          aria-hidden="true"
          className="pointer-events-none group-focus-within/row:invisible group-hover/row:invisible group-data-selecting/mail:invisible"
        >
          <Avatar {...faceOf(item.from)} aria-hidden="true" />
          {item.from.org !== undefined && (
            <Avatar
              {...faceOf(item.from.org)}
              shape="object"
              size="xs"
              aria-hidden="true"
              className="absolute -end-1.5 -bottom-1.5 ring-2 ring-card"
            />
          )}
        </span>
        <span className="invisible absolute inset-0 z-10 flex items-center justify-center group-focus-within/row:visible group-hover/row:visible group-data-selecting/mail:visible">
          <Checkbox
            checked={checked}
            onCheckedChange={() => onToggle(item.id)}
            aria-label={t('lists.mailSelect', item.subject)}
          />
        </span>
      </span>
      <span className="pointer-events-none flex min-w-0 flex-1 flex-col">
        <span className="flex h-5 min-w-0 shrink-0 items-center gap-1.5">
          <span
            data-slot="mail-sender"
            className={cn(
              'min-w-0 truncate text-sm',
              unread ? 'font-medium text-foreground' : 'text-muted-foreground',
            )}
          >
            {item.from.name}
          </span>
          {item.count !== undefined && item.count > 1 && (
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {item.count}
            </span>
          )}
          {onStar !== undefined ? (
            <Button
              variant="ghost"
              size="sm"
              shape="icon"
              aria-label={starred ? t('lists.mailUnstar') : t('lists.mailStar')}
              aria-pressed={starred}
              onClick={() => onStar(item, !starred)}
              className={cn(
                'pointer-events-auto relative z-10 -my-1 text-muted-foreground',
                !starred &&
                  'opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100',
              )}
            >
              <StarGlyph filled={starred} />
            </Button>
          ) : (
            starred && <StarGlyph filled />
          )}
          <span
            className={cn(
              'ms-auto shrink-0 text-xs text-muted-foreground tabular-nums',
              actions.length > 0 && 'group-focus-within/row:invisible group-hover/row:invisible',
            )}
          >
            {time}
          </span>
        </span>
        <span
          data-slot="mail-subject"
          className={cn(
            'h-5 shrink-0 truncate text-sm',
            unread ? 'font-medium text-foreground' : 'text-foreground/80',
          )}
        >
          {item.subject}
        </span>
        <span className="flex h-4 min-w-0 shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">{item.snippet}</span>
          {item.attachments === true && <ClipGlyph label={t('lists.mailAttachment')} />}
        </span>
        {item.entity !== undefined && (
          <span className="pointer-events-auto relative z-10 mt-1 flex min-w-0 shrink-0">
            <EntityChip
              label={item.entity.label}
              {...(item.entity.href !== undefined && { href: item.entity.href })}
              {...(item.entity.avatar !== undefined && { avatar: item.entity.avatar })}
              className="max-w-full"
            />
          </span>
        )}
      </span>
      {actions.length > 0 && (
        <span
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a cluster of three buttons, no toolbar keys of its own
          role="group"
          aria-label={t('lists.mailActions')}
          data-slot="mail-row-actions"
          className="invisible absolute end-3 top-2 z-10 flex gap-0.5 rounded-ctrl border border-border bg-popover p-0.5 shadow-raised group-focus-within/row:visible group-hover/row:visible"
        >
          {actions.slice(0, 3).map((action) => {
            const Icon = action.icon
            return (
              <Button
                key={action.id}
                variant="ghost"
                size="sm"
                shape="icon"
                aria-label={action.label}
                onClick={() => action.onClick(item)}
              >
                <Icon aria-hidden="true" className="size-icon" />
              </Button>
            )
          })}
        </span>
      )}
    </div>
  )
}

/** What the list passes `VirtualList` beyond the port: several kept rows, the row to reveal, the list's name and keys. */
type ListHost = ComponentType<
  Omit<Parameters<VirtualLike>[0], 'keepIndex'> & {
    keepIndex?: readonly number[]
    revealIndex?: number | undefined
    className?: string
    role?: string
    'aria-labelledby'?: string
    onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void
    onFocus?: (event: FocusEvent<HTMLDivElement>) => void
  }
>

const STEP_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Home', 'End'])

/** Rows of placeholder lines at the rows' own height, while the mail loads. */
function MailSkeleton(): ReactElement {
  const bar = 'animate-pulse rounded-chip bg-foreground/10 motion-reduce:animate-none'
  return (
    <div aria-hidden="true" className="flex h-full flex-col overflow-clip">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="flex h-20 shrink-0 gap-3 border-b border-border px-4 py-3">
          <div className={cn(bar, 'size-7 rounded-full')} />
          <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
            <div className={cn(bar, 'h-3 w-1/3')} />
            <div className={cn(bar, 'h-3 w-3/4')} />
            <div className={cn(bar, 'h-2.5 w-2/3')} />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * A mailbox's list: each row a face (the organisation as a corner badge), the sender, a star, the
 * time, the subject, a snippet and the record it is about; an unread row carries a dot and the
 * heavier weight. The face turns into a checkbox while the row is hovered or holds focus, and on
 * every row while any is selected; the selection is the caller's, and `bulk` floats at the foot
 * inside the list's box. Rows sit under sticky period headers and are windowed, so a mailbox of
 * thousands mounts a screenful. ArrowUp, ArrowDown, Home and End move between rows; `x` selects
 * the focused one. The list fills its parent's height and scrolls itself: place it in a bounded
 * pane (`SplitPage scroll="panes"`).
 *
 * @useWhen a list of conversations or notifications read newest first, opened into a reader beside it (a mailbox, an inbox, a support queue)
 * @neverWhen the rows are compared by columns (use DataTable), or a feed of events that are not opened (use EventList)
 *
 * @example
 * <MailList
 *   label="Inbox"
 *   items={mail}
 *   now={now}
 *   open={values.mail}
 *   onOpen={store.field.mail.set}
 *   selected={ids}
 *   onSelectedChange={setIds}
 *   virtual={VirtualList}
 *   bulk={<BulkBar count={ids.length} onClear={() => setIds([])} actions={bulk} />}
 * />
 */
export function MailList({
  label,
  items,
  now,
  weekStartsOn,
  open,
  onOpen,
  selected,
  onSelectedChange,
  onStar,
  actions = [],
  virtual,
  bulk,
  phase,
  empty,
}: MailListProps): ReactElement {
  const f = useFormat()
  const t = useMessages(lists)
  const periodLabel = usePeriodLabel()
  const { timeZone } = useIntl()
  const labelId = useId()
  const scroller = useRef<HTMLDivElement>(null)
  const [cursor, setCursor] = useState<number | null>(null)
  const [reveal, setReveal] = useState<number | undefined>(undefined)
  const today = toInstant(now)
  const period = (at: Date) =>
    periodOf(at, today, { timeZone, ...(weekStartsOn !== undefined && { weekStartsOn }) })
  const stamp = (at: Date | number): string => {
    const kind = period(toInstant(at)).kind
    if (kind === 'today' || kind === 'yesterday') return f.time(at)
    if (kind === 'week') return f.date(at, 'weekday')
    if (kind === 'year') return f.date(at, 'short')
    return f.date(at, 'day')
  }
  const heading = (day: Date): string => periodLabel(period(day), day)
  const entries: Entry[] = groupByDay(items, (at) => period(at).key).flatMap((g) => [
    ...(isInstant(g.day)
      ? [{ kind: 'header' as const, id: g.id, label: heading(g.day), count: g.items.length }]
      : []),
    ...g.items.map((item) => ({ kind: 'row' as const, item })),
  ])
  const headers = entries.flatMap((e, i) => (e.kind === 'header' ? [i] : []))
  const rowAt = (i: number): number | undefined => (entries[i]?.kind === 'row' ? i : undefined)
  const picked = new Set(selected)
  const selecting = picked.size > 0

  const toggle = (id: string): void =>
    onSelectedChange(picked.has(id) ? selected.filter((s) => s !== id) : [...selected, id])

  // Keys move a cursor of entry indexes; the row it lands on takes focus once it is mounted.
  const [pending, setPending] = useState<{ id: string } | null>(null)
  useEffect(() => {
    if (pending === null) return
    const button = scroller.current?.querySelector<HTMLElement>(
      `[data-mail-open="${CSS.escape(pending.id)}"]`,
    )
    if (button === null || button === undefined) return
    button.focus({ preventScroll: true })
  }, [pending])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement
    const id = target.dataset['mailOpen']
    if (id === undefined) return
    if (event.key === 'x' && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault()
      toggle(id)
      return
    }
    if (!STEP_KEYS.has(event.key)) return
    const at = entries.findIndex((e) => e.kind === 'row' && e.item.id === id)
    const rows = entries.flatMap((e, i) => (e.kind === 'row' ? [i] : []))
    const k = rows.indexOf(at)
    const next =
      event.key === 'Home'
        ? rows[0]
        : event.key === 'End'
          ? rows.at(-1)
          : rows[Math.min(rows.length - 1, Math.max(0, k + (event.key === 'ArrowDown' ? 1 : -1)))]
    if (next === undefined) return
    event.preventDefault()
    const entry = entries[next]
    if (entry?.kind !== 'row') return
    setCursor(next)
    setReveal(next)
    setPending({ id: entry.item.id })
  }

  const List = virtual as unknown as ListHost
  const keep = cursor !== null && rowAt(cursor) !== undefined ? [...headers, cursor] : headers
  const resolvedEmpty = empty ?? (items.length === 0 ? { cause: t('lists.noMail') } : null)

  return (
    <div
      data-slot="mail-list"
      data-selecting={selecting ? '' : undefined}
      className="group/mail relative flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <CardPhase
        phase={phase}
        empty={resolvedEmpty}
        skeleton={<MailSkeleton />}
        className="flex min-h-0 flex-1 flex-col"
      >
        {() => (
          <div ref={scroller} className="flex min-h-0 flex-1 flex-col">
            <List
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- the window's rows sit beside spacer divs, which a ul cannot hold
              role="list"
              aria-labelledby={labelId}
              className="flex-1"
              count={entries.length}
              estimateSize={(i) => {
                const e = entries[i]
                if (e === undefined || e.kind === 'header') return HEADER_H
                return e.item.entity === undefined ? ROW_H : ROW_CHIP_H
              }}
              getItemKey={(i) => {
                const e = entries[i]
                if (e === undefined) return i
                return e.kind === 'header' ? `h:${e.id}` : e.item.id
              }}
              keepIndex={keep}
              revealIndex={reveal}
              onKeyDown={onKeyDown}
              onFocus={(event) => {
                const id = (event.target as HTMLElement).dataset['mailOpen']
                if (id === undefined) return
                const at = entries.findIndex((e) => e.kind === 'row' && e.item.id === id)
                if (at !== cursor) setCursor(at)
              }}
            >
              {([virtual]) => {
                const e = virtual === undefined ? undefined : entries[virtual.index]
                if (e === undefined) return null
                if (e.kind === 'header') {
                  return (
                    <div
                      role="presentation"
                      data-slot="mail-list-header"
                      className="sticky top-0 z-20 flex h-8 items-center gap-1 border-b border-border bg-card px-4 text-xs font-medium text-muted-foreground"
                    >
                      {e.label}
                      <span className="font-normal tabular-nums">· {f.number(e.count)}</span>
                    </div>
                  )
                }
                return (
                  <MailRow
                    item={e.item}
                    current={open === e.item.id}
                    checked={picked.has(e.item.id)}
                    time={stamp(e.item.at)}
                    onOpen={onOpen}
                    onToggle={toggle}
                    onStar={onStar}
                    actions={actions}
                  />
                )
              }}
            </List>
          </div>
        )}
      </CardPhase>
      <span id={labelId} hidden>
        {label}
      </span>
      {selecting && bulk !== undefined && (
        <div
          data-slot="mail-list-bulk"
          className="pointer-events-none absolute inset-x-3 bottom-3 z-30 flex justify-center *:pointer-events-auto"
        >
          {bulk}
        </div>
      )}
    </div>
  )
}
