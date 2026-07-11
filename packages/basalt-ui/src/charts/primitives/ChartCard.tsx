import type { ReactNode } from 'react'
import { VX } from '../../tokens'

function InfoIcon({ title }: { title: string }) {
  return (
    <span
      title={title}
      aria-label={title}
      style={{
        cursor: 'help',
        marginLeft: 6,
        color: VX.faint,
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
// Depth = `shadow-card` (a whisper shadow + a 1px ring baked into the same value), never a
// `border` property (docs/DESIGN-SPEC.md §5) — so a ChartCard reads IDENTICALLY to a Mantine
// Card/Paper (same shadow token, same radius token, no intrinsic margin; outer spacing comes
// from the parent Stack/SimpleGrid gap). The shadow lives on the OUTER box (unclipped) while an
// INNER box carries the same radius + `overflow: hidden` to clip square-edged children — a
// shadow and its own `overflow: hidden` on the same box would clip the shadow itself.
const cardStyle = {
  borderRadius: VX.radiusCard,
  boxShadow: VX.shadowCard,
}
const clipStyle = {
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
  padding: '16px 18px 10px',
  // The INTERNAL header/body divider is a layout separator (docs/DESIGN-SPEC.md's `divider`
  // token), subordinate to the card's shadow-embedded ring so it doesn't read as a doubled edge.
  borderBottom: `1px solid ${VX.divider}`,
}
const titleColumnStyle = {
  display: 'inline-flex',
  flexDirection: 'column' as const,
  lineHeight: 1.15,
}
const titleStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  fontFamily: 'var(--basalt-font-head)',
  fontStretch: '88%',
  fontWeight: 550,
  fontSize: VX.text.lg,
  color: VX.ink,
}
const subtitleStyle = {
  fontSize: VX.text.md,
  fontWeight: 400,
  color: VX.muted,
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
      <div style={clipStyle}>
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
        <div style={{ padding: '4px 18px 18px' }}>{children}</div>
      </div>
    </div>
  )
}
