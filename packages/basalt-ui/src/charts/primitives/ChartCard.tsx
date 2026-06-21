import type { ReactNode } from 'react'
import { VX, alpha } from '../../tokens'

function InfoIcon({ title }: { title: string }) {
  return (
    <span
      title={title}
      aria-label={title}
      style={{
        cursor: 'help',
        marginLeft: 6,
        color: alpha(VX.neutral, 0.55),
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      <svg width={11} height={11} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm0 5a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1z" />
      </svg>
    </span>
  )
}

// Surfaces resolve per theme via CSS vars, so the styles are static (no useMemo/isDark).
// Flat by design — depth is the 1px hairline, never a drop shadow — so a ChartCard reads
// IDENTICALLY to a Mantine Card/Paper (same border token, same radius token, no shadow, no
// intrinsic margin; outer spacing comes from the parent Stack/SimpleGrid gap).
const cardStyle = {
  border: `1px solid ${VX.surface.border}`,
  borderRadius: VX.radiusCard,
  // Clip children to the rounded corners — a chart/header with its own square edges would
  // otherwise poke past the card's border-radius. Trade-off: a chart tooltip that overflows the
  // card bounds is clipped too; the kinds keep tooltips inside the plot area, so this is fine in
  // practice — a consumer rendering an oversized/edge tooltip should portal it out of the card.
  overflow: 'hidden' as const,
  backgroundColor: VX.surface.panel,
}
const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 12px',
  // The INTERNAL header/body divider stays subordinate to the card's OUTER hairline — a muted,
  // lower-contrast line (not the full surface-border) so it doesn't read as a doubled edge.
  borderBottom: `1px solid ${alpha(VX.neutral, 0.12)}`,
}
const titleColumnStyle = {
  display: 'inline-flex',
  flexDirection: 'column' as const,
  lineHeight: 1.15,
}
const titleStyle = { display: 'inline-flex', alignItems: 'center', fontWeight: 500, fontSize: 14 }
const subtitleStyle = {
  fontSize: 11,
  fontWeight: 400,
  color: alpha(VX.neutral, 0.75),
  marginTop: 2,
}

/**
 * Standard wrapper for every visx chart — card with info-tooltip title + optional
 * subtitle (the question the chart answers) + optional extra slot (current value
 * badge etc.). Do not wrap visx charts in bare divs.
 */
export function ChartCard({
  title,
  subtitle,
  tooltip,
  extra,
  children,
}: {
  title: string
  subtitle?: string
  tooltip: string
  extra?: ReactNode
  children: ReactNode
}) {
  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span style={titleColumnStyle}>
          <span style={titleStyle}>
            {title}
            <InfoIcon title={tooltip} />
          </span>
          {subtitle !== undefined && <span style={subtitleStyle}>{subtitle}</span>}
        </span>
        {extra !== undefined && <span>{extra}</span>}
      </div>
      <div style={{ padding: '8px 12px' }}>{children}</div>
    </div>
  )
}
