/**
 * The frame a board or a gallery draws while it has no cards to show (docs/v3/concepts/data-table.md
 * section 3, Layouts): loading, offline, error and empty each in the layout's own shape, never the
 * table's head over a skeleton row. A board holds its columns as skeleton lanes, a gallery its grid
 * as skeleton cards; the message arms are the table's words (`parts/phases`) in a block with no
 * column header above it. A frame's arm (`FrameArm`) fills the height its panel body reserved.
 */
import { useLayoutEffect } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../../core/cn'
import type { FrameArm } from '../../core/frame-arm'
import { OfflineLine } from '../../core/offline-line'
import type { ResolvedPhase } from '../../core/phase'
import { Skeleton } from '../../ui/skeleton'
import { EmptyContent, ErrorContent } from '../parts/phases'
import type { TableModel } from '../use-data-table'
import { boardAxis } from './model'

/** Skeleton cards of a loading gallery. */
const GALLERY_CARDS = 6
/** Skeleton cards of a loading board column. */
const LANE_CARDS = 3

function CardBones({ lines }: { lines: 2 | 3 }): ReactElement {
  return (
    <div
      aria-hidden="true"
      className="flex min-w-0 flex-col gap-3 rounded-inset border border-border bg-background p-4"
    >
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-1/3" />
      {lines === 3 && <Skeleton className="h-3 w-1/2" />}
    </div>
  )
}

function BoardBones<T>({ model }: { model: TableModel<T> }): ReactElement {
  const axis = boardAxis(model)
  const options = model.specs.find((s) => s.id === axis)?.edit?.options.length ?? 3
  const lanes = Math.min(Math.max(options, 2), 4)
  return (
    <div className="@container min-w-0">
      <div className="flex min-w-0 gap-3">
        {Array.from({ length: lanes }, (_, lane) => (
          <div
            key={lane}
            aria-hidden="true"
            className={cn(
              'w-full min-w-0 shrink-0 flex-col gap-2.5 rounded-card bg-secondary p-2.5 @regular:w-72',
              lane === 0 ? 'flex' : 'hidden @regular:flex',
            )}
          >
            <Skeleton className="m-1 h-5 w-1/3" />
            {Array.from({ length: LANE_CARDS }, (_c, card) => (
              <CardBones key={card} lines={3} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function GalleryBones(): ReactElement {
  return (
    <div className="@container min-w-0">
      <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,var(--container-narrow)),1fr))] gap-3">
        {Array.from({ length: GALLERY_CARDS }, (_, card) => (
          <CardBones key={card} lines={3} />
        ))}
      </div>
    </div>
  )
}

/** An app's layout loading: plain lines, since the kit cannot know the shape its `render` draws. */
function LineBones(): ReactElement {
  return (
    <div className="flex min-w-0 flex-col gap-2" data-slot="layout-bones">
      {Array.from({ length: GALLERY_CARDS }, (_, line) => (
        <Skeleton key={line} className="h-4 w-full" />
      ))}
    </div>
  )
}

/** One message block: centred under nothing, the frame's height held when a panel reserved one. */
function Message({
  slot,
  fit,
  children,
}: {
  slot: 'table-error' | 'table-empty' | 'table-offline'
  fit: number | undefined
  children: ReactNode
}): ReactElement {
  return (
    <div
      data-slot={slot}
      role={slot === 'table-error' ? 'alert' : undefined}
      style={fit === undefined ? undefined : { minHeight: fit }}
      className={cn(
        'flex min-w-0 flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground',
        fit === undefined ? 'min-h-24' : 'justify-start pt-8',
      )}
    >
      {children}
    </div>
  )
}

/**
 * A board, a gallery or an app's layout in a phase with no rows: the layout's skeleton while loading (plain lines for an app's), else the arm's
 * message. `frame` is the panel's arm when it handed one (the layout claims it, so the panel drops its own).
 */
export function LayoutPhase<T>({
  model,
  frame,
}: {
  model: TableModel<T>
  frame?: FrameArm
}): ReactElement {
  const claim = frame?.claim
  useLayoutEffect(() => claim?.(), [claim])
  const phase: ResolvedPhase = frame?.arm ?? model.phase
  const fit = frame?.height
  return (
    <div
      data-slot="table-root"
      data-phase={phase.tag}
      data-layout={model.layout}
      aria-busy={phase.tag === 'loading' || undefined}
      className="flex w-full max-w-full min-w-0 flex-col"
    >
      {phase.tag === 'loading' &&
        (model.layout === 'board' ? (
          <BoardBones model={model} />
        ) : model.layout === 'gallery' ? (
          <GalleryBones />
        ) : (
          <LineBones />
        ))}
      {phase.tag === 'offline' && (
        <Message slot="table-offline" fit={fit}>
          <OfflineLine />
        </Message>
      )}
      {phase.tag === 'error' && (
        <Message slot="table-error" fit={fit}>
          <ErrorContent model={model} phase={phase} />
        </Message>
      )}
      {phase.tag === 'empty' && (
        <Message slot="table-empty" fit={fit}>
          <EmptyContent
            cause={phase.empty.cause}
            {...(phase.empty.action !== undefined && { action: phase.empty.action })}
            {...(phase.empty.filtered !== undefined && { reset: phase.empty.filtered.reset })}
          />
        </Message>
      )}
    </div>
  )
}
