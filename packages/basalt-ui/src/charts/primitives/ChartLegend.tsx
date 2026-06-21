import { type CSSProperties, type MouseEvent } from 'react'

export type LegendEntry = {
  key: string
  label: string
  color: string
  secondColor?: string
  strokeWidth?: number
  shape?: 'line' | 'bar' | 'split' | 'splitLine'
  /** Render line-style swatches as dashed (only applies to 'line' / 'splitLine'). */
  dashed?: boolean
}

const LEGEND_WRAP_STYLE: CSSProperties = {
  display: 'flex',
  gap: 18,
  justifyContent: 'center',
  padding: '8px 0 2px',
  fontSize: 13,
}

const LEGEND_ITEM_BASE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'default',
  transition: 'opacity 0.15s',
}

/**
 * Shared legend for all non-sparkline charts. `highlighted`/`onHighlight` are
 * optional — omit for static legends without hover interactivity.
 */
export function ChartLegend({
  items,
  highlighted = null,
  onHighlight,
}: {
  items: LegendEntry[]
  highlighted?: string | null
  onHighlight?: (key: string | null) => void
}) {
  const handleEnter = (e: MouseEvent<HTMLDivElement>) => {
    const key = (e.currentTarget as HTMLDivElement).dataset['legendKey']
    if (key !== undefined) onHighlight?.(key)
  }
  const handleLeave = () => onHighlight?.(null)

  return (
    <div style={LEGEND_WRAP_STYLE}>
      {items.map((item) => (
        <div
          key={item.key}
          data-legend-key={item.key}
          style={{
            ...LEGEND_ITEM_BASE,
            opacity: highlighted === null || highlighted === item.key ? 1 : 0.3,
          }}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          {item.shape === 'splitLine' ? (
            <svg width={20} height={14} style={{ flexShrink: 0 }}>
              <line
                x1={0}
                y1={7}
                x2={10}
                y2={7}
                stroke={item.color}
                strokeWidth={item.strokeWidth ?? 2.5}
                strokeDasharray={item.dashed ? '3 2' : undefined}
              />
              <line
                x1={10}
                y1={7}
                x2={20}
                y2={7}
                stroke={item.secondColor}
                strokeWidth={item.strokeWidth ?? 2.5}
                strokeDasharray={item.dashed ? '3 2' : undefined}
              />
            </svg>
          ) : item.shape === 'split' ? (
            <svg width={14} height={14} style={{ flexShrink: 0 }}>
              <defs>
                <clipPath id={`split-top-${item.key}`}>
                  <polygon points="0,0 14,0 0,14" />
                </clipPath>
                <clipPath id={`split-bot-${item.key}`}>
                  <polygon points="14,0 14,14 0,14" />
                </clipPath>
              </defs>
              <rect
                width={14}
                height={14}
                rx={2}
                fill={item.color}
                clipPath={`url(#split-top-${item.key})`}
              />
              <rect
                width={14}
                height={14}
                rx={2}
                fill={item.secondColor}
                clipPath={`url(#split-bot-${item.key})`}
              />
            </svg>
          ) : item.shape === 'bar' ? (
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                backgroundColor: item.color,
                opacity: 0.7,
                flexShrink: 0,
              }}
            />
          ) : (
            <svg width={20} height={14} style={{ flexShrink: 0 }}>
              <line
                x1={0}
                y1={7}
                x2={20}
                y2={7}
                stroke={item.color}
                strokeWidth={item.strokeWidth ?? 2.5}
                strokeDasharray={item.dashed ? '3 2' : undefined}
              />
            </svg>
          )}
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  )
}
