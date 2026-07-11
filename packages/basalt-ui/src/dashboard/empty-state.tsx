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
import { Stack } from '@mantine/core'
import type { ReactNode } from 'react'
import { VX } from '../tokens'

export type EmptyStateProps = {
  /** Optional glyph slot, rendered faint at ~28-32px. No shipped illustration assets. */
  icon?: ReactNode
  /** Head-font title (15px, weight 550, ink). */
  title: string
  /** Muted 13px description, capped at ~360px so it reads as a short explanation. */
  description: string
  /** Optional call-to-action rendered below the description. */
  action?: ReactNode
  /** `'page'` (default) = generous padding for a full-page state; `'section'` = compact. */
  variant?: 'page' | 'section'
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'page',
}: EmptyStateProps) {
  return (
    <Stack
      align="center"
      gap={10}
      style={{
        padding: variant === 'page' ? '64px 24px' : '32px 20px',
        textAlign: 'center',
      }}
    >
      {icon && (
        <div
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: VX.faint,
          }}
        >
          {icon}
        </div>
      )}
      <span
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
      <span style={{ fontSize: VX.text.md, color: VX.muted, maxWidth: 360 }}>{description}</span>
      {action}
    </Stack>
  )
}
