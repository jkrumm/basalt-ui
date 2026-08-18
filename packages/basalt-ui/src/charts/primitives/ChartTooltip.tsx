import type { CSSProperties, ReactNode } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { VX } from '../../tokens'
import { fmtTooltipDate } from '../utils/format'

// Panel bg + shadow-card, radius 8 (docs/DESIGN-SPEC.md §5's "Tooltip/popover/menu" idiom) — the
// same depth-via-shadow treatment as ChartCard, never a `border` property. Surfaces resolve per
// theme via CSS vars, so this is a static object (no useMemo/hook needed).
const TOOLTIP_STYLES: CSSProperties = {
  position: 'fixed',
  pointerEvents: 'none',
  zIndex: 9999,
  backgroundColor: VX.surface.panel,
  borderRadius: 'var(--vx-radius-floating)',
  padding: '0',
  fontSize: VX.text.xs,
  lineHeight: '18px',
  color: VX.ink,
  boxShadow: VX.shadowCard,
  minWidth: 140,
}

/** Tooltip header — shows formatted date + optional right-aligned label with color. */
export function TooltipHeader({
  date,
  label,
  labelColor,
  format = fmtTooltipDate,
}: {
  date: string
  label?: string
  labelColor?: string
  /** Overrides `fmtTooltipDate` for the header text. Default: today's `fmtTooltipDate` behavior,
   * unchanged. The seam exists because `fmtTooltipDate` regexes `YYYY-MM-DD` out of the key and
   * builds a LOCAL `Date`, so a UTC ISO domain key names the wrong day next to `formatX`/the
   * tooltip badge, which both resolve locally — a caller with a UTC key needs to supply its own. */
  format?: (date: string) => string
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        padding: '6px 10px',
        borderBottom: `1px solid ${VX.divider}`,
      }}
    >
      <span
        style={{
          fontSize: VX.text.micro,
          fontWeight: 600,
          fontFamily: 'var(--basalt-font-mono)',
          color: VX.ink,
        }}
      >
        {format(date)}
      </span>
      {label !== undefined && (
        <span
          style={{
            fontSize: VX.text.micro,
            fontWeight: 500,
            fontFamily: 'var(--basalt-font-mono)',
            color: labelColor,
          }}
        >
          {label}
        </span>
      )}
    </div>
  )
}

/** Tooltip row — swatch + label + value. */
export function TooltipRow({
  color,
  label,
  value,
  valueColor,
  shape,
  strokeWidth,
  dashed,
}: {
  color: string
  label: string
  value: string
  valueColor?: string
  shape?: 'dot' | 'line' | 'bar'
  strokeWidth?: number
  /** Render the line swatch as dashed (only applies to shape='line'). */
  dashed?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        padding: '0 10px',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {shape === 'line' ? (
          <svg width={12} height={10} style={{ flexShrink: 0 }}>
            <line
              x1={0}
              y1={5}
              x2={12}
              y2={5}
              stroke={color}
              strokeWidth={strokeWidth ?? VX.lineWidth}
              strokeDasharray={dashed ? VX.dashArray : undefined}
            />
          </svg>
        ) : (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 2, // theme-allow: sub-scale tooltip micro-corner, below the 4px radius floor
              backgroundColor: color,
              flexShrink: 0,
            }}
          />
        )}
        {label}
      </span>
      <span style={{ fontWeight: 400, fontFamily: 'var(--basalt-font-mono)', color: valueColor }}>
        {value}
      </span>
    </div>
  )
}

export function TooltipBody({ children }: { children: ReactNode }) {
  return <div style={{ padding: '5px 0' }}>{children}</div>
}

/** Gap between the anchor point and the tooltip box, and the minimum distance kept from the
 * viewport edge. */
const TOOLTIP_GAP = 12
const VIEWPORT_MARGIN = 8

/**
 * Floating tooltip positioned against a viewport-space anchor, with flip + clamp handled once for
 * every chart instead of per call site (this used to be recomputed inside each chart's own `useChartTooltip`, and only for
 * charts that remembered to use it).
 *
 * The box is measured after mount via `useLayoutEffect`, so the first paint of a given tooltip is
 * hidden rather than misplaced — a tooltip that flashes at the wrong corner reads as a bug.
 */
export function ChartTooltipFloat({
  anchor,
  children,
}: {
  anchor: { x: number; y: number } | null
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ width: number; height: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (el === null) return
    const { offsetWidth, offsetHeight } = el
    setBox((prev) =>
      prev !== null && prev.width === offsetWidth && prev.height === offsetHeight
        ? prev
        : { width: offsetWidth, height: offsetHeight },
    )
  }, [children, anchor])

  if (anchor === null) return null
  // SSR guard: react-dom/server has no jsdom and does not support portals.
  if (typeof document === 'undefined') return null

  const width = box?.width ?? 0
  const height = box?.height ?? 0
  const vw = window.innerWidth
  const vh = window.innerHeight

  const flipsLeft = anchor.x + TOOLTIP_GAP + width + VIEWPORT_MARGIN > vw
  const left = flipsLeft
    ? Math.max(VIEWPORT_MARGIN, anchor.x - TOOLTIP_GAP - width)
    : anchor.x + TOOLTIP_GAP
  const top = Math.min(
    Math.max(VIEWPORT_MARGIN, anchor.y - TOOLTIP_GAP),
    Math.max(VIEWPORT_MARGIN, vh - height - VIEWPORT_MARGIN),
  )

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      aria-live="polite"
      style={{ ...TOOLTIP_STYLES, left, top, visibility: box === null ? 'hidden' : 'visible' }}
    >
      {children}
    </div>,
    document.body,
  )
}
