/**
 * The small pieces both trial variants draw: the More glyph the shell owns, a section's glyph with a
 * monogram fallback, and the count badge on an icon.
 */
import type { ReactElement } from 'react'
import { cn } from '../../../../core/cn'
import type { IconComponent } from '../../../../core/ports'
import { CountBadge } from '../../../../ui/badge'
import { isLit } from '../../../core/badges'
import type { NavBadge } from '../../../core/types'
import { monogramOf } from '../../rail-text'

/** The variants' own strings, English until the shell's message keys land (see `MOBILE_TEXT`). */
export const VARIANT_TEXT = {
  more: 'More',
  close: 'Close the menu',
} as const

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

/** Three dots: More. */
export function MoreGlyph({ className }: { className?: string }): ReactElement {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-6', className)} {...STROKE} aria-hidden="true">
      <circle cx="5.5" cy="12" r="1.25" />
      <circle cx="12" cy="12" r="1.25" />
      <circle cx="18.5" cy="12" r="1.25" />
    </svg>
  )
}

/** A destination's icon at 24 px, or its first two letters as generated content when it has none. */
export function DestinationGlyph({
  icon,
  short,
}: {
  icon: IconComponent | undefined
  short: string
}): ReactElement {
  const Icon = icon
  if (Icon !== undefined) return <Icon className="size-6" aria-hidden="true" />
  return (
    <span
      aria-hidden="true"
      data-letter={monogramOf(short)}
      className="inline-flex size-6 items-center justify-center text-sm font-semibold before:content-[attr(data-letter)]"
    />
  )
}

/**
 * A lit badge on an icon's corner: the count when there is one, else a dot. A ring in `ringClass`
 * (the surface under the icon) cuts it off the glyph.
 */
export function IconBadge({
  badge,
  ringClass = 'ring-card',
}: {
  badge: NavBadge | null
  ringClass?: string
}): ReactElement | null {
  if (!isLit(badge)) return null
  const attention = badge.attention === true
  if ('dot' in badge) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'absolute -end-0.5 -top-0.5 size-2.5 rounded-full ring-2',
          ringClass,
          attention ? 'bg-warn' : 'bg-brand-fill',
        )}
      />
    )
  }
  return (
    <CountBadge
      aria-hidden="true"
      count={badge.count}
      attention={attention}
      className={cn(
        'absolute -end-2 -top-1.5 ring-2',
        ringClass,
        !attention && 'bg-brand-fill text-on-brand',
      )}
    />
  )
}

/** The accessible name of a slot with a lit badge: the count is spoken, the dot is "new". */
export function badgedLabel(label: string, badge: NavBadge | null): string {
  if (!isLit(badge)) return label
  return 'dot' in badge ? `${label}, new` : `${label}, ${badge.count}`
}
