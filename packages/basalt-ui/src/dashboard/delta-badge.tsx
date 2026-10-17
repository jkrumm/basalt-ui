/**
 * DeltaBadge — the KPI trend readout (docs/DESIGN-CORE.md: "up/down deltas are text colour only,
 * never a fill"): a glyph and a signed figure in the trend colour, proportional-sans `sm` with
 * lining figures, with NO fill, border or padding in either scheme. The optional ▲/▼ glyph sits on the `micro` rung and `period` is
 * `micro` muted. `polarity` decides the TONE the sign maps to — `'up-good'` (default) reads a rise
 * as success and a fall as danger; `'up-bad'` inverts that for a metric where a rise is the worse
 * reading (a cycle-top index, latency, error rate); `'neutral'` renders every sign in a faint,
 * non-verdict
 * colour. Zero is always faint with no glyph, under every polarity. The label never carries a
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
 * <DeltaBadge value={12.4} />                          // ▲ 12.4%, success colour
 * <DeltaBadge value={-3.1} />                           // ▼ 3.1%, danger colour
 * <DeltaBadge value={0} />                              // 0.0%, faint, no glyph
 * <DeltaBadge value={182} format={(v) => `${Math.abs(v)}ms`} withGlyph={false} />
 * <DeltaBadge value={35.9} polarity="up-bad" />         // ▲ 35.9%, danger — a rise is bad here
 * <DeltaBadge value={4.2} period="last week" />         // ▲ 4.2% vs last week
 */
import { VX } from '../tokens'
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
  /** Optional comparison period rendered after the value, muted, as `<periodPrefix> <period>`
   * (`period="last week"` → "vs last week"). One rule: the prefix is prepended unless the period
   * already starts with it (case-insensitive, optional trailing dot: "vs", "VS", "vs."), so a caller
   * still writing "vs last week" renders it once. Other words ("versus") are not detected. */
  period?: string | undefined
  /** The word composed before `period`. Defaults to `'vs'`; pass your locale's word, or `''` to
   * render `period` raw. */
  periodPrefix?: string
}

const defaultFormat = (value: number): string => `${Math.abs(value).toFixed(1)}%`

function composePeriod(period: string, prefix: string): string {
  if (prefix === '') return period
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escaped}\\.?(\\s|$)`, 'i').test(period) ? period : `${prefix} ${period}`
}

function resolveTone(value: number, polarity: DeltaPolarity): string {
  if (value === 0 || polarity === 'neutral') return VX.faint
  const rose = value > 0
  const good = polarity === 'up-good' ? rose : !rose
  return good ? VX.status.good : VX.status.bad
}

/** The direction mark for a signed value; zero has none. Direction only, never the verdict. */
function directionGlyph(value: number): '▲' | '▼' | undefined {
  if (value > 0) return '▲'
  if (value < 0) return '▼'
  return undefined
}

export function DeltaBadge({
  value,
  polarity = 'up-good',
  format = defaultFormat,
  withGlyph = true,
  period,
  periodPrefix = 'vs',
}: DeltaBadgeProps) {
  const tone = resolveTone(value, polarity)
  const glyph = directionGlyph(value)
  const showGlyph = withGlyph && glyph !== undefined

  return (
    <span className={classes.deltaBadge} style={{ color: tone }}>
      {showGlyph && <span className={classes.deltaGlyph}>{glyph}</span>}
      {format(value)}
      {period !== undefined && ' '}
      {period !== undefined && (
        <span className={classes.deltaPeriod}>{composePeriod(period, periodPrefix)}</span>
      )}
    </span>
  )
}
