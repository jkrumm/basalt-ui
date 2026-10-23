/** Skeleton rows in the loaded shape of an `EventList`, enough to fill a bounded height. */
import { Skeleton } from '@mantine/core'
import classes from './event-list.module.css'
import { rowAttributes } from './event-list-model'
import type { RowContext } from './event-list-model'

/** Rows per skeleton day header. */
const SKELETON_GROUP = 3
/** Skeleton rows per px of a bounded height (feed ≈ 48 px a row, timeline ≈ 76). */
const SKELETON_ROW_PX = { feed: 48, timeline: 76 } as const

/** Skeleton rows in the loaded shape (header bars when grouped, glyph, sentence, time, meta and, on
 * a timeline, chips), enough to fill a bounded height. */
export function SkeletonRows({
  count,
  ctx,
  grouped,
  height,
}: {
  count: number
  ctx: RowContext
  grouped: boolean
  height: number | string | undefined
}) {
  const total =
    typeof height === 'number'
      ? Math.max(count, Math.ceil(height / SKELETON_ROW_PX[ctx.density]) + 1)
      : count
  return Array.from({ length: total }, (_, i) => (
    <div key={i} className={classes.skeletonGroup} aria-hidden>
      {grouped && i % SKELETON_GROUP === 0 && (
        <div className={classes.header}>
          <Skeleton className={classes.skeletonHeader} />
        </div>
      )}
      <div
        className={classes.row}
        {...rowAttributes(ctx, i % SKELETON_GROUP === 0, i === total - 1)}
      >
        {ctx.lead && (
          <span className={classes.leading}>
            <Skeleton className={classes.skeletonGlyph} circle />
          </span>
        )}
        <span className={classes.line}>
          <Skeleton className={classes.skeletonLine} />
        </span>
        <span className={classes.time}>
          <Skeleton className={classes.skeletonTime} />
        </span>
        <div className={classes.meta}>
          <Skeleton className={classes.skeletonMeta} />
        </div>
        {ctx.density === 'timeline' && (
          <div className={classes.chips}>
            <Skeleton className={classes.skeletonChip} />
          </div>
        )}
      </div>
    </div>
  ))
}
