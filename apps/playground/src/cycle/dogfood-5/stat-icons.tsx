/**
 * The console's Phosphor stat glyphs (RocketLaunch, Hourglass, Queue, CheckCircle) as outline SVGs:
 * the playground has no icon library. Counted apart from the slice: the console imports them.
 */
import type { ReactElement, ReactNode } from 'react'
import type { FlowStat } from './flow-fixtures'

type Glyph = (props: { className?: string }) => ReactElement

function glyph(paths: ReactNode): Glyph {
  return function StatGlyph({ className }) {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {paths}
      </svg>
    )
  }
}

export const STAT_ICON: Record<FlowStat['key'], Glyph> = {
  working: glyph(<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M14 4c3-1 6-1 6-1s0 3-1 6l-7 7-5-5z" />),
  waiting: glyph(<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9" />),
  queued: glyph(<path d="M4 6h16M4 12h16M4 18h10" />),
  shipped: glyph(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </>,
  ),
}
