/**
 * DeltaBadge — the KPI trend chip (docs/DESIGN-SPEC.md §5): mono 11.5px weight 600, status-color
 * text on a status-13% tint, radius 6, 2px/7px padding, optional ▲/▼ glyph at 9px. Sign alone
 * drives the tone — positive reads as success, negative as danger, zero as a neutral faint tint
 * with no glyph. The label never carries a leading "+"; pass `format` to control the magnitude
 * string (defaults to a one-decimal percentage of the absolute value).
 *
 * @example
 * import { DeltaBadge } from 'basalt-ui'
 *
 * <DeltaBadge value={12.4} />                          // ▲ 12.4%, success tint
 * <DeltaBadge value={-3.1} />                           // ▼ 3.1%, danger tint
 * <DeltaBadge value={0} />                              // 0.0%, neutral faint tint, no glyph
 * <DeltaBadge value={182} format={(v) => `${Math.abs(v)}ms`} withGlyph={false} />
 */
import { Badge } from '@mantine/core'
import { alpha, VX } from '../tokens'

export type DeltaBadgeProps = {
  /** Signed delta driving tone (positive/negative/zero) and, by default, the label magnitude. */
  value: number
  /** Formats the value into the label text. Defaults to `${Math.abs(value).toFixed(1)}%`. */
  format?: (value: number) => string
  /** Render the ▲/▼ direction glyph. Defaults to `true`; a zero value never shows a glyph. */
  withGlyph?: boolean
  /** Optional comparison timeframe rendered directly after the value in a dimmer shade of the same
   * tone (e.g. `MoM`, `WoW`, `YTD`) — states what the delta is measured against without a hover. */
  period?: string | undefined
}

const defaultFormat = (value: number): string => `${Math.abs(value).toFixed(1)}%`

export function DeltaBadge({
  value,
  format = defaultFormat,
  withGlyph = true,
  period,
}: DeltaBadgeProps) {
  const tone = value > 0 ? VX.status.good : value < 0 ? VX.status.bad : VX.faint
  const glyph = value > 0 ? '▲' : value < 0 ? '▼' : undefined
  const showGlyph = withGlyph && glyph !== undefined

  return (
    <Badge
      styles={{
        root: {
          backgroundColor: alpha(tone, 0.13),
          padding: '2px 7px',
          height: 'auto',
        },
        label: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          fontFamily: 'var(--basalt-font-mono)',
          fontSize: VX.text.xs,
          fontWeight: 600,
          textTransform: 'none',
          letterSpacing: 'normal',
          color: tone,
        },
      }}
    >
      {/* optical glyph ratio relative to the label, not a scale step */}
      {showGlyph && <span style={{ fontSize: '0.8em' }}>{glyph}</span>}
      {format(value)}
      {period && <span style={{ marginLeft: 4, fontWeight: 500, opacity: 0.6 }}>{period}</span>}
    </Badge>
  )
}
