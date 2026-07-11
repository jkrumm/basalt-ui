import type { CSSProperties, ReactNode, RefObject } from 'react'
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
  borderRadius: 8,
  padding: '0',
  fontSize: VX.text.xs,
  lineHeight: '18px',
  color: VX.ink,
  boxShadow: VX.shadowCard,
  minWidth: 140,
}

/** Theme-aware tooltip container styles — use with useChartTooltip(). */
export function useTooltipStyles(): CSSProperties {
  return TOOLTIP_STYLES
}

/** Outer tooltip shell. Renders nothing when tip is null. */
export function ChartTooltip({
  tip,
  tooltipRef,
  styles,
  children,
}: {
  tip: { x: number; y: number } | null
  tooltipRef?: RefObject<HTMLDivElement | null>
  styles: CSSProperties
  children: ReactNode
}) {
  if (!tip) return null
  return (
    <div ref={tooltipRef} style={{ ...styles, left: tip.x, top: tip.y }}>
      {children}
    </div>
  )
}

/** Tooltip header — shows formatted date + optional right-aligned label with color. */
export function TooltipHeader({
  date,
  label,
  labelColor,
}: {
  date: string
  label?: string
  labelColor?: string
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
        {fmtTooltipDate(date)}
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
              borderRadius: 2,
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
