/**
 * EmptyState — a centered icon/title/description/action stack for empty data regions (no shipped
 * illustration assets — `icon` is a plain, faint-rendered `ReactNode` slot). `variant="page"` uses
 * generous vertical padding for a full-page empty state; `variant="section"` is compact, for an
 * empty card/panel region.
 *
 * @example
 * import { EmptyState } from 'basalt-ui'
 *
 * <EmptyState
 *   icon={<IconInboxEmpty />}
 *   title="No results"
 *   description="Try adjusting your filters or search terms."
 *   action={<Button onClick={onReset}>Clear filters</Button>}
 *   variant="section"
 * />
 */
import { Center, Stack } from '@mantine/core'
import type { ReactNode } from 'react'
import { VX } from '../tokens'
import { cx } from '../common/props'
import type { BasaltProps, SlotStylesProps } from '../common/props'

/** The five boxes `EmptyState` paints, and the whole styling seam it offers (`common/props.ts`). */
export type EmptyStateSlot = 'root' | 'icon' | 'title' | 'description' | 'action'

export type EmptyStateProps = BasaltProps &
  SlotStylesProps<EmptyStateSlot> & {
    /** Optional glyph slot, rendered faint at ~28-32px. No shipped illustration assets. */
    icon?: ReactNode
    /** Head-font title (18px, weight 550, ink). */
    title: string
    /**
     * Muted 15px description, capped at ~360px so it reads as a short explanation. Optional: a
     * compact panel ("No data yet") should not have to invent a second sentence, and five argo
     * features wrapped this component solely to avoid doing so.
     */
    description?: string
    /** Optional call-to-action rendered below the description. */
    action?: ReactNode
    /** `'page'` (default) = generous padding for a full-page state; `'section'` = compact. */
    variant?: 'page' | 'section'
  }

// The finest density-tracking rhythm step (`--vx-space-stack-xs`, 4px at level 0) scaled by an
// exact integer, so the padding renders at today's px value at level 0 and rides the same
// `1 + 0.1 * level` multiplier every other `--vx-space-*` token does at every other density level
// (`docs/STATUS.md`'s density pass) — `LoadingState`'s `'page'` variant shares `PAGE_PADDING_Y`,
// same concept: a page-level async/empty region's vertical padding.
const STACK_XS = 'var(--vx-space-stack-xs, 0.25rem)'
const PAGE_PADDING_Y = `calc(${STACK_XS} * 16)` // 64px at level 0
const PAGE_PADDING_X = `calc(${STACK_XS} * 6)` // 24px at level 0
const SECTION_PADDING_Y = `calc(${STACK_XS} * 8)` // 32px at level 0
const SECTION_PADDING_X = `calc(${STACK_XS} * 5)` // 20px at level 0

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'page',
  className,
  style,
  classNames,
}: EmptyStateProps) {
  return (
    <Stack
      align="center"
      gap="xs"
      className={cx(classNames?.root, className)}
      style={{
        padding:
          variant === 'page'
            ? `${PAGE_PADDING_Y} ${PAGE_PADDING_X}`
            : `${SECTION_PADDING_Y} ${SECTION_PADDING_X}`,
        textAlign: 'center',
        ...style,
      }}
    >
      {icon && (
        // 32px is a fixed glyph-box size, not a density-tracking inset — no `--vx-icon-*` token
        // exists for a generic (non-`WidgetHeader`-tiered) icon slot, so it stays a structural rem.
        <Center
          {...(classNames?.icon !== undefined && { className: classNames.icon })}
          style={{ width: '2rem', height: '2rem', color: VX.faint }}
        >
          {icon}
        </Center>
      )}
      <span
        className={classNames?.title}
        style={{
          fontFamily: 'var(--basalt-font-head)',
          fontStretch: '88%',
          fontSize: VX.text.xl,
          fontWeight: 550,
          color: VX.ink,
        }}
      >
        {title}
      </span>
      {description !== undefined && (
        // 360px (22.5rem) is a reading-width cap, not a density inset — kept structural.
        <span
          className={classNames?.description}
          style={{ fontSize: VX.text.md, color: VX.muted, maxWidth: '22.5rem' }}
        >
          {description}
        </span>
      )}
      {action !== undefined && <div className={classNames?.action}>{action}</div>}
    </Stack>
  )
}
