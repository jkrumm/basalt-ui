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

/**
 * The selected-row mark — 16px, drawn at the row's trailing edge (`docs/CONTROLS-SPEC.md` §2.1).
 * Shared by the facet list and any other row that marks a selection at its trailing edge, so two
 * hand-drawn checks cannot drift.
 */
export function CheckGlyph(): ReactNode {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12.5l5 5l9 -11" />
    </svg>
  )
}

/** `SearchFilter`'s leading icon. */
export function SearchGlyph(): ReactNode {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35 -4.35" />
    </svg>
  )
}

/** `SyncButton`'s icon; the caller owns the spin class, which lives in its own stylesheet. */
export function RefreshGlyph({ className }: { className?: string | undefined }): ReactNode {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      {...(className !== undefined && { className })}
    >
      <path
        d="M20 11a8 8 0 1 0-2.34 5.66M20 5v6h-6"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
