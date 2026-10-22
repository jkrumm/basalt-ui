/**
 * The pieces `StatCard` lays out around its value row: the caption row, the foot, and the
 * skeletons that hold their footprint while a reading is pending. Split out so `stat-card.tsx`
 * orchestrates (which branch, which placement) and these draw. Internal: not exported from any barrel.
 */
import { Skeleton } from '@mantine/core'
import type { CSSProperties, ReactNode } from 'react'
import { IconSlot } from '../theme/icon-slot'
import { CtlSlot } from '../theme'
import { StatusVerdict } from '../theme/status-verdict'
import { VX } from '../tokens'
import type { Tone } from '../common/props'
import { InfoGlyph } from './widget-header'
import classes from './stat-card.module.css'

export type CaptionRowProps = {
  title: string
  icon?: ReactNode
  info?: string
  qualifier?: string
  tone?: Tone
  actions?: ReactNode
}

/** Visible verdict word, and the full phrase a screen reader hears instead of a bare "Over". */
const TONE_WORD: Record<Tone, { word: string; phrase: string }> = {
  good: { word: 'OK', phrase: 'Within the good threshold' },
  warn: { word: 'Watch', phrase: 'Past the warning threshold' },
  bad: { word: 'Over', phrase: 'Past the severe threshold' },
}

/**
 * Title, `info` glyph and `qualifier` in one wrapping group, `actions` pinned at the end. When
 * caption + info + qualifier do not fit, the qualifier wraps UNDER the caption instead of truncating
 * either: the container's width decides, never the viewport's.
 */
export function CaptionRow({ title, icon, info, qualifier, tone, actions }: CaptionRowProps) {
  return (
    <div className={classes.captionRow}>
      <div className={classes.captionMain}>
        <div className={classes.lead}>
          <h3 className={classes.caption}>
            {icon !== undefined && <IconSlot className={classes.icon}>{icon}</IconSlot>}
            <span className={classes.captionText} title={title} data-widget-title>
              {title}
            </span>
          </h3>
          {/* OUTSIDE the heading on purpose: `info` would otherwise become part of its name. */}
          {info !== undefined && <InfoGlyph text={info} />}
          {tone !== undefined && (
            <StatusVerdict
              color={VX.status[tone]}
              word={TONE_WORD[tone].word}
              phrase={TONE_WORD[tone].phrase}
            />
          )}
        </div>
        {qualifier !== undefined && (
          <span className={classes.qualifier} title={qualifier} data-stat-qualifier>
            {qualifier}
          </span>
        )}
      </div>
      {/* `tier="widget"`: the caption row is 24px (`--vx-space-control-height-widget`), so a card
          with a kebab is the same height as one without (`theme/ctl-theme.tsx`). */}
      {actions !== undefined && (
        <span className={classes.actions} data-basalt-hit-scope>
          <CtlSlot tier="widget">{actions}</CtlSlot>
        </span>
      )}
    </div>
  )
}

export type FootProps = {
  /** Reserve the foot's height (a visual AND a footer line) even when a branch shows neither. */
  reserve: boolean
  /** The visual band is part of the reservation only for the `bleed` placement; `right` keeps its
   * slot beside the breakdown, so a footer there reserves one line, not a band. */
  visualBand: boolean
  visualNode: ReactNode
  footerNode: ReactNode
}

/**
 * The visual and its footer line, pinned to the card's bottom. It reserves visual + gap + footer
 * whenever `reserve` is set, so a card with a sparkline and no footer, one with both, and one in a
 * pending or failed branch are the same height (SPEC § 6.1 footprint).
 */
export function Foot({ reserve, visualBand, visualNode, footerNode }: FootProps) {
  if (!reserve) return null
  return (
    <div className={classes.foot} data-band={visualBand}>
      {visualNode}
      {footerNode}
    </div>
  )
}

/** The `'right'` slot's size, handed to CSS as custom properties (an inline `flex-basis` would also
 * apply in a narrow card, where the row is a column and the basis becomes the HEIGHT). */
export function rightSlotStyle(width: number, height: number): CSSProperties {
  return {
    '--basalt-stat-sparkline-w': `${width}px`,
    '--basalt-stat-sparkline-h': `${height}px`,
  } as CSSProperties
}

/** The value bar, and a delta chip beside it when the loaded card carries a delta. */
export function ValueSkeleton({ delta }: { delta: boolean }) {
  if (!delta) return <Skeleton className={classes.skeletonValue} radius="sm" />
  return (
    <div className={classes.skeletonValueRow}>
      <Skeleton className={classes.skeletonValueWithDelta} radius="sm" />
      <Skeleton className={classes.skeletonDelta} radius="sm" data-stat-skeleton-delta="" />
    </div>
  )
}

/** A mild rise across the width in a 100 x 40 box: the sparkline's shape, not data. */
const SPARK_GHOST = '0,30 12,26 25,28 38,18 50,22 62,12 75,16 88,8 100,12'

/** The visual slot's loading shape: a line ghost at the sparkline's own height, no spinner. */
export function VisualSkeleton() {
  return (
    <div aria-hidden="true" className={classes.skeletonVisual} data-stat-skeleton-spark="">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none">
        <polyline points={SPARK_GHOST} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}

export function FooterSkeleton() {
  return <Skeleton className={classes.skeletonFooter} radius="sm" />
}

/** One placeholder row per `breakdown` row, each at the real row's height. */
export function BreakdownSkeleton({ rows }: { rows: number }) {
  return (
    <div className={classes.breakdown} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={classes.skeletonRowBox}>
          <Skeleton className={classes.skeletonRow} radius="sm" />
        </div>
      ))}
    </div>
  )
}
