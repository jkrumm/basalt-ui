/**
 * The derived legend — HTML, Mantine-free, outside the engine. Entries come from `series` only (a
 * legend cannot name what the plot does not draw); a companion (`legend: false` + `parent`) rides
 * its parent's entry. Toggling an entry hides the series from the plot, the tooltip and the auto
 * domain together; hovering one emphasizes it (the definition is rebuilt with `highlighted`).
 */
import type { CSSProperties, ReactElement } from 'react'
import { VX } from '../tokens'
import classes from './chart-legend.module.css'
import type { ChartSeries } from './types'

/** `auto` renders both swatches and lets the container decide: none, dots or chips (CSS). */
export type LegendMode = 'dots' | 'chips' | 'auto'

const ROLE_ORDER = ['series', 'overlay', 'reference'] as const

/**
 * Dots sit wider apart than chips: a dot is 8px, and two 44px coarse-pointer hit areas centred on
 * 8px hosts only stop overlapping once the pitch clears 44 (44 − 8 − 2, plus headroom).
 */
const DOTS_GAP = 38

/** The entries a series list derives, in display order (by role when `groups`). */
export function legendEntries<T>(
  series: readonly ChartSeries<T>[],
  groups: boolean,
): ChartSeries<T>[][] {
  const entries = series.filter((s) => s.legend !== false)
  if (!groups) return entries.length ? [entries] : []
  return ROLE_ORDER.map((role) => entries.filter((s) => (s.role ?? 'series') === role)).filter(
    (g) => g.length > 0,
  )
}

// Everything but `display` and the gaps, which are the stylesheet's in `auto` mode.
const rowBaseStyle: CSSProperties = {
  border: 0,
  margin: 0,
  padding: 0,
  minWidth: 0,
  flexWrap: 'wrap',
  alignItems: 'center',
  rowGap: 4,
  fontSize: VX.legendFontSize,
  color: VX.ink2,
  lineHeight: 1.35,
}
const rowStyle: CSSProperties = { ...rowBaseStyle, display: 'flex' }
/** The gaps `chart-legend.module.css` reads, as custom properties. */
type LegendVars = CSSProperties & Record<'--bc-legend-gap' | '--bc-dots-gap', string>
const autoRowStyle: LegendVars = {
  ...rowBaseStyle,
  '--bc-legend-gap': `${VX.legendGap}px`,
  '--bc-dots-gap': `${DOTS_GAP}px`,
}
const dividerStyle: CSSProperties = { width: 1, alignSelf: 'stretch', background: VX.divider }
const buttonStyle: CSSProperties = {
  all: 'unset',
  // `all: unset` would also drop styles.css's `position: relative` (an inline style outranks the
  // layer), and the `[data-basalt-hit]::after` overlay would anchor to an ancestor — over the plot.
  position: 'relative',
  // theme-allow raw-surface — an invisible 1px: the edge the `[data-basalt-hit]` overlap cap assumes every control carries (styles.css)
  border: '1px solid transparent',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
  borderRadius: VX.radiusCtrl,
}
const noteStyle: CSSProperties = { color: VX.axis }

type SwatchStyle = Pick<
  ChartSeries<never>,
  'color' | 'colorNegative' | 'mark' | 'dash' | 'strokeOpacity' | 'fillOpacity'
>

/** A swatch fill: the series colour, or a hard-stop split for a sign-coloured bar. */
const swatchFill = (s: SwatchStyle): string =>
  s.colorNegative === undefined
    ? s.color
    : `linear-gradient(90deg, ${s.color} 50%, ${s.colorNegative} 50%)`

function Swatch({ s, mode }: { s: SwatchStyle; mode: LegendMode }): ReactElement {
  if (mode === 'auto')
    return (
      <>
        <Swatch s={s} mode="dots" />
        <Swatch s={s} mode="chips" />
      </>
    )
  if (mode === 'dots')
    return (
      <span
        aria-hidden
        className={classes.dot}
        style={{
          width: 8,
          height: 8,
          // theme-allow raw-surface — a legend dot is a circle, not a surface corner
          borderRadius: '50%',
          background: swatchFill(s),
          opacity: s.fillOpacity ?? 1,
          flex: 'none',
        }}
      />
    )
  if ((s.mark ?? 'line') === 'line')
    return (
      <svg aria-hidden className={classes.chip} width={16} height={8} style={{ flex: 'none' }}>
        <line
          x1={1}
          x2={15}
          y1={4}
          y2={4}
          stroke={s.color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeOpacity={s.strokeOpacity ?? 1}
          {...(s.dash === 'dashed' && { strokeDasharray: '4 3' })}
        />
      </svg>
    )
  return (
    <span
      aria-hidden
      className={classes.chip}
      style={{
        width: 10,
        height: 10,
        // theme-allow raw-surface — swatch geometry, not a surface corner
        borderRadius: 2,
        background: swatchFill(s),
        opacity: s.fillOpacity ?? 1,
        flex: 'none',
      }}
    />
  )
}

export type ChartLegendProps<T> = {
  series: readonly ChartSeries<T>[]
  hidden: ReadonlySet<string>
  mode: LegendMode
  groups: boolean
  toggle: boolean
  onToggle: (key: string) => void
  onHighlight: (key: string | null) => void
}

export function ChartLegend<T>(props: ChartLegendProps<T>): ReactElement | null {
  const groups = legendEntries(props.series, props.groups)
  if (groups.length === 0) return null
  const auto = props.mode === 'auto'
  const gap = props.mode === 'dots' ? DOTS_GAP : VX.legendGap
  return (
    <fieldset
      aria-label="Legend"
      data-basalt-chart-legend={props.mode}
      {...(auto && { className: classes.auto })}
      style={
        auto
          ? // `display` and the gaps are the stylesheet's: the container picks them by width.
            autoRowStyle
          : {
              ...rowStyle,
              columnGap: gap,
              // Caps each entry's `[data-basalt-hit]` overlay at the real gap between entries.
              ...({ '--vx-hit-gap': `${gap}px` } as CSSProperties),
            }
      }
    >
      {groups.map((group, gi) => [
        gi > 0 && <span key={`divider-${gi}`} aria-hidden style={dividerStyle} />,
        ...group.map((s) => {
          const off = props.hidden.has(s.key)
          const content = (
            <>
              <Swatch s={s} mode={props.mode} />
              <span>{s.label}</span>
              {s.note !== undefined && <span style={noteStyle}>{s.note}</span>}
            </>
          )
          const itemStyle: CSSProperties = { ...buttonStyle, opacity: off ? 0.4 : 1 }
          if (!props.toggle)
            return (
              <span
                key={s.key}
                data-legend-key={s.key}
                style={itemStyle}
                onMouseEnter={() => props.onHighlight(s.key)}
                onMouseLeave={() => props.onHighlight(null)}
              >
                {content}
              </span>
            )
          return (
            <button
              key={s.key}
              type="button"
              data-legend-key={s.key}
              data-basalt-hit=""
              aria-pressed={!off}
              style={itemStyle}
              onClick={() => props.onToggle(s.key)}
              onMouseEnter={() => props.onHighlight(s.key)}
              onMouseLeave={() => props.onHighlight(null)}
              onFocus={() => props.onHighlight(s.key)}
              onBlur={() => props.onHighlight(null)}
            >
              {content}
            </button>
          )
        }),
      ])}
    </fieldset>
  )
}
