/**
 * DeltaBadge — the KPI trend chip (docs/DESIGN-SPEC.md §5): mono 11.5px weight 600, status-color
 * text on a status-13% tint, control radius, 2px/7px padding, optional ▲/▼ glyph at 9px.
 * `polarity` decides the TONE the sign maps to — `'up-good'` (default) reads a rise as success and
 * a fall as danger; `'up-bad'` inverts that for a metric where a rise is the worse reading (a
 * cycle-top index, latency, error rate); `'neutral'` renders every sign in a faint, non-verdict
 * tint. Zero is always faint with no glyph, under every polarity. The label never carries a
 * leading "+"; pass `format` to control the magnitude string (defaults to a one-decimal percentage
 * of the absolute value). The ▲/▼ glyph is DIRECTION, not verdict, and stays polarity-independent —
 * governed only by `withGlyph` and the sign.
 *
 * Mantine-free (plain `<span>` + this folder's CSS module, docs/CONTROLS-SPEC.md §2.2) so
 * `WidgetHeader` can compose it from inside `charts/` without tripping `basalt/token-layer-
 * boundary` or `check-dist-layering.mjs`.
 *
 * @example
 * import { DeltaBadge } from 'basalt-ui'
 *
 * <DeltaBadge value={12.4} />                          // ▲ 12.4%, success tint
 * <DeltaBadge value={-3.1} />                           // ▼ 3.1%, danger tint
 * <DeltaBadge value={0} />                              // 0.0%, neutral faint tint, no glyph
 * <DeltaBadge value={182} format={(v) => `${Math.abs(v)}ms`} withGlyph={false} />
 * <DeltaBadge value={35.9} polarity="up-bad" />         // ▲ 35.9%, danger tint — a rise is bad here
 */
import { alpha, VX } from '../tokens'
import classes from './widget-header.module.css'

export type DeltaPolarity = 'up-good' | 'up-bad' | 'neutral'

export type DeltaBadgeProps = {
  /** Signed delta driving tone (positive/negative/zero) and, by default, the label magnitude. */
  value: number
  /** Which sign reads as the good verdict. `'up-good'` (default) is today's behaviour — positive
   * success, negative danger. `'up-bad'` inverts it for a metric where a rise is the worse reading.
   * `'neutral'` renders every sign in the faint tint — a change with no verdict attached. Zero is
   * always faint regardless. */
  polarity?: DeltaPolarity
  /** Formats the value into the label text. Defaults to `${Math.abs(value).toFixed(1)}%`. */
  format?: (value: number) => string
  /** Render the ▲/▼ direction glyph. Defaults to `true`; a zero value never shows a glyph. */
  withGlyph?: boolean
  /** Optional comparison timeframe rendered directly after the value in a dimmer shade of the same
   * tone (e.g. `MoM`, `WoW`, `YTD`) — states what the delta is measured against without a hover. */
  period?: string | undefined
}

const defaultFormat = (value: number): string => `${Math.abs(value).toFixed(1)}%`

function resolveTone(value: number, polarity: DeltaPolarity): string {
  if (value === 0 || polarity === 'neutral') return VX.faint
  const rose = value > 0
  const good = polarity === 'up-good' ? rose : !rose
  return good ? VX.status.good : VX.status.bad
}

export function DeltaBadge({
  value,
  polarity = 'up-good',
  format = defaultFormat,
  withGlyph = true,
  period,
}: DeltaBadgeProps) {
  const tone = resolveTone(value, polarity)
  const glyph = value > 0 ? '▲' : value < 0 ? '▼' : undefined
  const showGlyph = withGlyph && glyph !== undefined

  return (
    <span
      className={classes.deltaBadge}
      style={{ backgroundColor: alpha(tone, 0.13), color: tone }}
    >
      {showGlyph && <span className={classes.deltaGlyph}>{glyph}</span>}
      {format(value)}
      {period !== undefined && <span className={classes.deltaPeriod}>{period}</span>}
    </span>
  )
}
