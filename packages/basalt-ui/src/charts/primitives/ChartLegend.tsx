import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { VX, alpha } from '../../tokens'
import type { SeriesRole, LegendPlacement } from '../series'

export type LegendEntry = {
  key: string
  label: string
  color: string
  secondColor?: string
  strokeWidth?: number
  shape?: 'line' | 'bar' | 'split' | 'splitLine'
  /** Render line-style swatches as dashed (only applies to 'line' / 'splitLine'). */
  dashed?: boolean
  /** bar swatch opacity — honored instead of a hardcoded value, so it cannot lie about the fill. */
  fillOpacity?: number
  /** Drives `groups` rendering (series → hairline divider → overlay → reference). */
  role?: SeriesRole
  /** Companions folded under this entry via `parent` (`deriveLegend`) — rendered as compact,
   * subordinate sub-entries beside the parent's label instead of vanishing. */
  children?: LegendEntry[]
}

const LEGEND_ITEM_BASE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'default',
  transition: 'opacity 0.15s',
}

const GROUP_ORDER: SeriesRole[] = ['series', 'overlay', 'reference']

const roleOf = (item: LegendEntry): SeriesRole => item.role ?? 'series'

/** Order entries series → overlay → reference and record where a divider belongs. */
function orderEntries(
  items: LegendEntry[],
  groups: boolean,
): { entries: LegendEntry[]; dividerAfter: Set<number> } {
  if (!groups) return { entries: items, dividerAfter: new Set() }

  const dividerAfter = new Set<number>()
  const entries: LegendEntry[] = []
  const nonEmptyGroups = GROUP_ORDER.map((role) =>
    items.filter((item) => roleOf(item) === role),
  ).filter((group) => group.length > 0)
  nonEmptyGroups.forEach((group, i) => {
    entries.push(...group)
    if (i < nonEmptyGroups.length - 1) dividerAfter.add(entries.length - 1)
  })
  return { entries, dividerAfter }
}

function wrapperStyle(placement: LegendPlacement): CSSProperties {
  const vertical = placement === 'left' || placement === 'right'
  return {
    display: 'flex',
    flexDirection: vertical ? 'column' : 'row',
    flexWrap: vertical ? 'nowrap' : 'wrap',
    alignItems: vertical ? 'flex-start' : 'center',
    justifyContent: vertical ? 'flex-start' : 'center',
    columnGap: VX.legendGap,
    rowGap: VX.legendGap,
    padding: '8px 0 2px',
    fontSize: VX.legendFontSize,
  }
}

/** `columnLayout` = the legend itself stacks entries in a column (left/right placement), so the
 * divider between role groups must be a horizontal hairline rather than a vertical bar. */
function LegendDivider({ columnLayout }: { columnLayout: boolean }) {
  return (
    <span
      aria-hidden
      style={
        columnLayout
          ? { width: '100%', height: 1, backgroundColor: alpha(VX.neutral, 0.25), margin: '2px 0' }
          : { width: 1, alignSelf: 'stretch', backgroundColor: alpha(VX.neutral, 0.25) }
      }
    />
  )
}

function LegendSwatch({ item, idPrefix }: { item: LegendEntry; idPrefix: string }) {
  if (item.shape === 'splitLine') {
    return (
      <svg width={20} height={14} style={{ flexShrink: 0 }}>
        <line
          x1={0}
          y1={7}
          x2={10}
          y2={7}
          stroke={item.color}
          strokeWidth={item.strokeWidth ?? 2.5}
          strokeDasharray={item.dashed ? VX.dashArray : undefined}
        />
        <line
          x1={10}
          y1={7}
          x2={20}
          y2={7}
          stroke={item.secondColor}
          strokeWidth={item.strokeWidth ?? 2.5}
          strokeDasharray={item.dashed ? VX.dashArray : undefined}
        />
      </svg>
    )
  }

  if (item.shape === 'split') {
    const topId = `split-top-${idPrefix}${item.key}`
    const botId = `split-bot-${idPrefix}${item.key}`
    return (
      <svg width={14} height={14} style={{ flexShrink: 0 }}>
        <defs>
          <clipPath id={topId}>
            <polygon points="0,0 14,0 0,14" />
          </clipPath>
          <clipPath id={botId}>
            <polygon points="14,0 14,14 0,14" />
          </clipPath>
        </defs>
        <rect width={14} height={14} rx={2} fill={item.color} clipPath={`url(#${topId})`} />
        <rect width={14} height={14} rx={2} fill={item.secondColor} clipPath={`url(#${botId})`} />
      </svg>
    )
  }

  if (item.shape === 'bar') {
    return (
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          backgroundColor: item.color,
          opacity: item.fillOpacity ?? 0.7,
          flexShrink: 0,
        }}
      />
    )
  }

  return (
    <svg width={20} height={14} style={{ flexShrink: 0 }}>
      <line
        x1={0}
        y1={7}
        x2={20}
        y2={7}
        stroke={item.color}
        strokeWidth={item.strokeWidth ?? 2.5}
        strokeDasharray={item.dashed ? VX.dashArray : undefined}
      />
    </svg>
  )
}

const LEGEND_CHILD_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  marginLeft: 4,
  fontSize: '0.85em',
  opacity: 0.75,
}

/** Compact swatch for a folded child entry — smaller than {@link LegendSwatch}, line/bar only
 * (folded companions are simple line or bar series; `split`/`splitLine` never fold). */
function LegendChildSwatch({ item }: { item: LegendEntry }) {
  if (item.shape === 'bar') {
    return (
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 2,
          backgroundColor: item.color,
          opacity: item.fillOpacity ?? 0.7,
          flexShrink: 0,
        }}
      />
    )
  }
  return (
    <svg width={14} height={10} style={{ flexShrink: 0 }}>
      <line
        x1={0}
        y1={5}
        x2={14}
        y2={5}
        stroke={item.color}
        strokeWidth={item.strokeWidth ?? 2}
        strokeDasharray={item.dashed ? VX.dashArray : undefined}
      />
    </svg>
  )
}

/** A folded companion, rendered subordinate to (and inside) its parent's legend entry. */
function LegendChild({ item }: { item: LegendEntry }) {
  return (
    <span style={LEGEND_CHILD_STYLE}>
      <LegendChildSwatch item={item} />
      <span>{item.label}</span>
    </span>
  )
}

/**
 * Shared legend for all non-sparkline charts. `highlighted`/`onHighlight` are optional — omit for
 * static legends without hover interactivity. `chartId` namespaces `split` clipPath ids so two
 * legends on the same page never collide. `groups` renders series → hairline divider → overlay →
 * reference bands instead of one flat smear. `maxRows` caps the number of rendered entries and
 * rolls the remainder into a `+N more` chip (row-accurate wrap measurement is `ChartFrame`'s job —
 * this is an entry-count cap, a deliberate simplification until that primitive lands).
 */
export function ChartLegend({
  items,
  highlighted = null,
  onHighlight,
  chartId = '',
  placement = 'bottom',
  groups = false,
  maxRows,
}: {
  items: LegendEntry[]
  highlighted?: string | null
  onHighlight?: (key: string | null) => void
  chartId?: string
  placement?: LegendPlacement
  groups?: boolean
  maxRows?: number
}) {
  const handleEnter = (e: MouseEvent<HTMLDivElement>) => {
    const key = (e.currentTarget as HTMLDivElement).dataset['legendKey']
    if (key !== undefined) onHighlight?.(key)
  }
  const handleLeave = () => onHighlight?.(null)

  const idPrefix = chartId ? `${chartId}-` : ''
  const vertical = placement === 'left' || placement === 'right'
  const { entries, dividerAfter } = orderEntries(items, groups)
  const visible =
    maxRows !== undefined && maxRows < entries.length ? entries.slice(0, maxRows) : entries
  const hiddenCount = entries.length - visible.length

  const nodes: ReactNode[] = []
  visible.forEach((item, i) => {
    nodes.push(
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
        <LegendSwatch item={item} idPrefix={idPrefix} />
        <span>{item.label}</span>
        {item.children?.map((child) => (
          <LegendChild key={child.key} item={child} />
        ))}
      </div>,
    )
    if (dividerAfter.has(i))
      nodes.push(<LegendDivider key={`divider-${item.key}`} columnLayout={vertical} />)
  })
  if (hiddenCount > 0) {
    nodes.push(
      <span key="legend-more" style={LEGEND_ITEM_BASE}>
        +{hiddenCount} more
      </span>,
    )
  }

  return <div style={wrapperStyle(placement)}>{nodes}</div>
}
