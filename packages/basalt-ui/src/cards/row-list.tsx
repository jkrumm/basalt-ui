import type { CSSProperties, ReactElement } from 'react'
import { AppLink } from '../core/link'
import { cn } from '../core/cn'
import { HostTitleContext } from '../core/could-not-load'
import { resolvePhase } from '../core/phase'
import type { FrameState } from '../core/phase'
import type { ListFocus, Tone } from '../core/ports'
import { useRowsShown } from '../core/rows-shown'
import { useMessages } from '../core/messages/use-messages'
import { lists } from '../core/messages/lists'
import { Card, CardBand, CardPhase, Inset } from '../ui/card'
import { Status } from '../ui/status'
import { bodyHeight, listRows, ScrollRegion } from './bar-list-scroll'
import type { ListRows } from './bar-list-scroll'
import type { CardTarget, FrameHead } from './contract'
import { listFocus, rowFocus } from './list-focus'

/**
 * One row. A row is a link, a button or inert; never a link and a button at once. The type is
 * declared here because `src/cards/contract.ts` has no `RowList` entry.
 */
export type RowListItem = CardTarget & {
  /** Identity across renders; defaults to the label. */
  key?: string
  /** The name, one line: it truncates, never wraps. */
  label: string
  /** A muted word after the label on the same line (a stage, a kind). */
  meta?: string
  /** A muted second line under the label; it truncates. Use `lines={2}` on the list. */
  detail?: string
  /** The figure at the row's end, printed as given (format it yourself). */
  value?: string
  /** A muted second line under `value`. Use `lines={2}` on the list. */
  valueDetail?: string
  /** A dot and a word for the row's verdict, before the value. */
  status?: { tone: Tone; label: string }
  /** The row's depth in a tree or a chain: each level indents the label by 12 px. */
  indent?: number
}

export type RowListProps = FrameHead &
  FrameState & {
    /** Rows in display order: the list never re-sorts. */
    items: readonly RowListItem[]
    /** The body holds this many rows of height at every phase; more rows scroll. Default 5. */
    bodyRows?: ListRows
    /** Lines per row, 1 or 2 (a row with a `detail` or `valueDetail` is two). Sets the body height. Default 1. */
    lines?: 1 | 2
    /** Draw every label in the mono face with tabular figures: ids, hashes, paths. */
    mono?: boolean
    /**
     * What sits between rows. `none` (default): spacing, and a surface under the hovered or focused
     * row. `hairline`: a rule in the grid token, never ink.
     */
    separator?: 'none' | 'hairline'
    /**
     * A chart's focus (`useChartFocus(items, …)`): row i is `focus.items[i]`, so pass the rows in the
     * same order as the chart's items. Pointing at a row focuses its item, an item focused elsewhere
     * marks its row, and the list becomes one tab stop whose arrow keys, Home, End and Escape step
     * the shared focus.
     */
    focus?: ListFocus<unknown>
  }

const ROW_BASE = 'flex w-full min-w-0 items-center justify-between gap-3 rounded-ctrl px-2 -mx-2'
const ROW_HEIGHT = { 1: 'min-h-10', 2: 'min-h-12' } as const

/** The spacing steps of a row: 40 px (`lines` 1) and 48 px (`lines` 2). */
const ROW_STEPS = { 1: 10, 2: 12 } as const
const TARGET =
  'cursor-pointer border-0 bg-transparent text-left text-foreground no-underline hover:bg-accent focus-ring focus-visible:-outline-offset-2'

function RowSkeleton({ rows, lines }: { rows: number; lines: 1 | 2 }): ReactElement {
  const bar = 'animate-pulse rounded-chip bg-foreground/10 motion-reduce:animate-none'
  return (
    <div aria-hidden="true" className="flex h-full flex-col overflow-clip">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className={cn(
            'flex shrink-0 items-center justify-between gap-6',
            lines === 2 ? 'h-12' : 'h-10',
          )}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className={cn(bar, 'h-3.5 w-1/3')} />
            {lines === 2 && <div className={cn(bar, 'h-3 w-2/3')} />}
          </div>
          <div className={cn(bar, 'h-3.5 w-10')} />
        </div>
      ))}
    </div>
  )
}

type RowProps = { item: RowListItem; mono: boolean; lines: 1 | 2 }

function Row({ item, mono, lines }: RowProps): ReactElement {
  const indent = item.indent ?? 0
  const content = (
    <>
      <span
        data-slot="row-list-main"
        className="flex min-w-0 flex-1 flex-col"
        {...(indent > 0 && {
          style: { paddingInlineStart: `calc(var(--spacing) * ${indent * 3})` } as CSSProperties,
        })}
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span
            data-slot="row-list-label"
            className={cn('min-w-0 truncate text-sm', mono && 'font-mono tabular-nums')}
            title={item.label}
          >
            {item.label}
          </span>
          {item.meta !== undefined && (
            <span data-slot="row-list-meta" className="shrink-0 text-xs text-muted-foreground">
              {item.meta}
            </span>
          )}
        </span>
        {item.detail !== undefined && (
          <span data-slot="row-list-detail" className="truncate text-xs text-muted-foreground">
            {item.detail}
          </span>
        )}
      </span>
      {item.status !== undefined && (
        <Status tone={item.status.tone} className="shrink-0">
          {item.status.label}
        </Status>
      )}
      {(item.value !== undefined || item.valueDetail !== undefined) && (
        <span className="flex shrink-0 flex-col items-end text-sm tabular-nums">
          {item.value !== undefined && <span data-slot="row-list-value">{item.value}</span>}
          {item.valueDetail !== undefined && (
            <span data-slot="row-list-value-detail" className="text-xs text-muted-foreground">
              {item.valueDetail}
            </span>
          )}
        </span>
      )}
    </>
  )
  const row = cn(ROW_BASE, ROW_HEIGHT[lines])
  if (item.href !== undefined) {
    return (
      <AppLink data-slot="row-list-target" href={item.href} className={cn(row, TARGET)}>
        {content}
      </AppLink>
    )
  }
  if (item.onClick !== undefined) {
    return (
      <button
        data-slot="row-list-target"
        type="button"
        onClick={item.onClick}
        className={cn(row, TARGET)}
      >
        {content}
      </button>
    )
  }
  return <div className={row}>{content}</div>
}

/**
 * A list of rows beside a chart: a label with a muted word and a second line, a verdict dot and
 * word, and a figure at the end. Quiet by default: rows are separated by spacing, the hovered or
 * focused row takes a surface, and `separator="hairline"` opts in to a rule in the grid token. Each
 * row is a link, a button or plain text. Pass the chart's `useChartFocus` as `focus` and a row and
 * its mark are one item. It holds one body height at every phase, scrolls past `bodyRows` and its
 * loading skeleton draws the rows it will become.
 *
 * @useWhen the rows are things of one kind, each with a name, an optional second line, a verdict and a figure, shown beside a chart that draws the same items (ids with ages, windows with hours, resources with a hop)
 * @neverWhen the rows have several columns to compare (use a table), rank by one number with a bar (use a bar list) or are a stream of things that happened (use an event list)
 *
 * @example
 * <RowList
 *   title="Open Issues"
 *   items={[
 *     {
 *       label: 'issue_2283',
 *       meta: 'building',
 *       detail: 'Lists: a bare border',
 *       value: '3.1 d',
 *       valueDetail: '2.4× typical',
 *     },
 *   ]}
 *   lines={2}
 *   mono
 *   focus={focus}
 *   phase={query}
 * />
 */
export function RowList(props: RowListProps): ReactElement {
  const { items, phase, empty, focus, title, subtitle, icon, info } = props
  const rows = listRows(props.bodyRows)
  const lines = props.lines ?? 1
  const mono = props.mono ?? false
  const hairline = props.separator === 'hairline'
  const t = useMessages(lists)
  const rowsShown = useRowsShown()
  const emptyState = empty ?? (items.length === 0 ? { cause: t('lists.noRows') } : null)
  const scrolls = items.length > rows && resolvePhase({ phase, empty: emptyState }).body
  return (
    <div data-slot="row-list" className="@container min-w-0">
      <Card flush>
        <CardBand
          title={title}
          {...(subtitle !== undefined && { subtitle })}
          {...(icon !== undefined && { icon })}
          {...(info !== undefined && { info })}
          {...(scrolls && {
            end: (
              <span
                data-slot="row-list-scroll-cue"
                className="text-xs whitespace-nowrap text-muted-foreground tabular-nums"
              >
                {rowsShown(rows, items.length)}
              </span>
            ),
          })}
        />
        <Inset className="flex grow flex-col" style={bodyHeight(rows, ROW_STEPS[lines])}>
          <HostTitleContext.Provider value={title}>
            <CardPhase
              phase={phase}
              empty={emptyState}
              skeleton={<RowSkeleton rows={rows} lines={lines} />}
              className="flex flex-1 flex-col"
            >
              {() => (
                <ScrollRegion label={title}>
                  {/* The explicit role is deliberate: `list-style: none` makes Safari drop the implicit one. */}
                  <ul
                    // oxlint-disable-next-line jsx-a11y/no-redundant-roles
                    role="list"
                    aria-label={title}
                    className="m-0 list-none p-0"
                    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- with a shared focus the list is the one tab stop that steps it
                    {...(focus !== undefined && listFocus(focus))}
                  >
                    {items.map((item, i) => (
                      <li
                        key={item.key ?? `${item.label}-${i}`}
                        data-slot="row-list-row"
                        {...(focus !== undefined && rowFocus(focus, i))}
                        className={cn(
                          focus !== undefined && '[&[data-focused]>*]:bg-accent',
                          hairline && 'border-b border-grid last:border-b-0',
                        )}
                      >
                        <Row item={item} mono={mono} lines={lines} />
                      </li>
                    ))}
                  </ul>
                </ScrollRegion>
              )}
            </CardPhase>
          </HostTitleContext.Provider>
        </Inset>
      </Card>
    </div>
  )
}
