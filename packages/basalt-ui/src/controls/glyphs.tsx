/**
 * The control tier's own inline glyphs (`docs/CONTROLS-SPEC.md` §3).
 *
 * basalt ships NO icon dependency — every `icon` slot in the public API takes a `ReactNode` the
 * consumer fills. These are the few glyphs the FRAMEWORK draws for itself, where a default icon is
 * part of the control's identity rather than a caller's decision: a range filter reads as a date
 * picker because it carries a calendar, a compare filter because it carries the swap arrows, and
 * the mobile `Filters (n)` pill because it carries a funnel. Same convention the shell already uses
 * for its own chrome (`shell/sidebar-search.tsx`, `shell/app-sidebar.tsx`): a 24×24 `viewBox`,
 * `stroke="currentColor"`, sized down by the `size` prop.
 *
 * INTERNAL — not on the `./controls` barrel. A consumer wanting a different glyph passes `icon`.
 */
import type { ReactNode } from 'react'

/** The tier's icon box: 16px inside a button, 14px for a trailing affordance. */
const ICON_SIZE = 16
const AFFORDANCE_SIZE = 14

function Stroke({ size = ICON_SIZE, children }: { size?: number; children: ReactNode }): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

/** `RangeFilter`'s default leading icon. */
export function CalendarGlyph(): ReactNode {
  return (
    <Stroke>
      <rect x={3} y={5} width={18} height={16} rx={2.5} />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </Stroke>
  )
}

/** `CompareFilter`'s default leading icon — the arrows-swap glyph. */
export function SwapGlyph(): ReactNode {
  return (
    <Stroke>
      <path d="M4 8h13l-3.5 -3.5" />
      <path d="M20 16h-13l3.5 3.5" />
    </Stroke>
  )
}

/** The mobile `Filters (n)` pill's leading icon. */
export function FunnelGlyph(): ReactNode {
  return (
    <Stroke>
      <path d="M4 4h16l-6.5 8v7l-3 -1.5v-5.5z" />
    </Stroke>
  )
}

/**
 * Every pill's trailing affordance — 14px, muted, and an SVG rather than the `⇅` character it
 * replaced. A text glyph rendered at the label's own font metrics, so it sat off the optical centre
 * and shifted with the font stack; the path is centred in its own box.
 */
export function UpDownGlyph(): ReactNode {
  return (
    <Stroke size={AFFORDANCE_SIZE}>
      <path d="M8 9l4 -4l4 4" />
      <path d="M8 15l4 4l4 -4" />
    </Stroke>
  )
}
