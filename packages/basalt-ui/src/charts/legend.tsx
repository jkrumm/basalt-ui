/**
 * The derived legend — HTML, outside the engine. Entries come from `series` only (a
 * legend cannot name what the plot does not draw); a companion (`legend: false` + `parent`) rides
 * its parent's entry. Toggling an entry hides the series from the plot, the tooltip and the auto
 * domain together; hovering one emphasizes it (the definition is rebuilt with `highlighted`).
 */
import { useEffect, useId, useLayoutEffect, useRef } from 'react'
import type { CSSProperties, MouseEvent, ReactElement } from 'react'
import { useProviderContext } from '../core/provider'
import { BASALT, alpha } from '../tokens'
import { defaultNumberFormat } from './core/compile'
import { CV } from './core/theme'
import { rampGradientCss, rampStops } from './core/rich-tooltip'
import classes from './chart-legend.module.css'
import type { ChartSeries } from './types'

/**
 * `auto` renders both swatches and lets the container decide: none, dots or chips (CSS). The
 * swatch SHAPE follows the mode for a filled mark, signed split included: below 480px a dot (8px
 * circle), from 480px a chip (10px square) — so one `DualPanel` bar legend is a split circle on a
 * narrow card and a split square on a wide one. A LINE series swaps a short stroke for a shorter
 * one instead, dash included, so it is never a dot. Not a per-chart prop.
 */
export type LegendMode = 'dots' | 'chips' | 'auto'

const ROLE_ORDER = ['series', 'overlay', 'reference'] as const

/**
 * The pitch between dots-mode entries: 8px under the old 38, to pay for the 14px line key so the
 * four-entry legend still fits one row at 390px. `--basalt-hit-gap` caps each coarse-pointer hit area
 * at the entry plus 2px and this gap (`styles.css`), so neighbours never overlap; the trade is that
 * a dots-mode hit target is 8 + 2 + 30 = 40px, not 44.
 */
const DOTS_GAP = 30

/**
 * The pitch between wrapped rows, as the custom property the stylesheet sets: 4px for a fine pointer, 20px for a
 * coarse one (`chart-legend.module.css`). `--basalt-hit-gap-block` caps the hit area's height at the entry plus 2px
 * and this gap, so a wrapped legend's rows never overlap: a coarse row is 24px plus 20px, so every hit target is the
 * full 44px and two rows touch without crossing; a fine row keeps 4px (a 29px target, above the 24px WCAG 2.5.8 floor).
 */
const ROW_GAP = 'var(--bc-legend-row-gap, 4px)'

const byReferenceLast = <T,>(a: ChartSeries<T>, b: ChartSeries<T>): number =>
  Number(a.role === 'reference') - Number(b.role === 'reference')

/** The entries a series list derives, in display order (by role when `groups`). */
export function legendEntries<T>(
  series: readonly ChartSeries<T>[],
  groups: boolean,
): ChartSeries<T>[][] {
  const entries = series.filter((s) => s.legend !== false)
  // Series lead, zones and reference lines follow: the compact row wraps between entries and names them all.
  if (!groups) return entries.length ? [entries.toSorted(byReferenceLast)] : []
  return ROLE_ORDER.map((role) => entries.filter((s) => (s.role ?? 'series') === role)).filter(
    (g) => g.length > 0,
  )
}

// Everything but `display` and the gaps, which are the stylesheet's in `auto` mode.
const rowBaseStyle: CSSProperties = {
  border: 0,
  margin: 0,
  padding: 0,
  // A bleeding card puts its edge here so the plot runs to the card's sides and the legend keeps the page's edge.
  paddingInline: 'var(--chart-legend-inset, 0px)',
  minWidth: 0,
  flexWrap: 'wrap',
  alignItems: 'center',
  rowGap: ROW_GAP,
  // The tick step: ticks, legend and tooltip are one size, so a chart card has at most three.
  fontSize: BASALT.text.micro,
  color: CV.inkMuted,
  lineHeight: 1.35,
}
const rowStyle: CSSProperties = { ...rowBaseStyle, display: 'flex' }
/** The gaps `chart-legend.module.css` reads, and the block-axis hit cap, as custom properties. */
type LegendVars = CSSProperties &
  Record<'--bc-legend-gap' | '--bc-dots-gap' | '--basalt-hit-gap-block', string>
// `flex-wrap` is the stylesheet's too, so the same rule wraps at every width.
const { flexWrap: _wrap, ...autoBaseStyle } = rowBaseStyle
const autoRowStyle: LegendVars = {
  ...autoBaseStyle,
  '--bc-legend-gap': `${BASALT.legendGap}px`,
  '--bc-dots-gap': `${DOTS_GAP}px`,
  '--basalt-hit-gap-block': ROW_GAP,
}
/** The row's layout; a concealed legend keeps it (and so its height) but is not visible. */
function rowLayout(mode: LegendMode, concealed: boolean): CSSProperties {
  // Hidden, not removed: the data arriving must not shift the chart below it.
  const hide: CSSProperties = concealed ? { visibility: 'hidden' } : {}
  // `display` and the gaps are the stylesheet's in `auto`: the container picks them by width.
  if (mode === 'auto') return { ...autoRowStyle, ...hide }
  const gap = mode === 'dots' ? DOTS_GAP : BASALT.legendGap
  return {
    ...rowStyle,
    columnGap: gap,
    // Caps each entry's `[data-basalt-hit]` overlay at the real gaps: columns between entries, rows across a wrap.
    ...({
      '--basalt-hit-gap': `${gap}px`,
      '--basalt-hit-gap-block': ROW_GAP,
    } as CSSProperties),
    ...hide,
  }
}
const dividerStyle: CSSProperties = { width: 1, alignSelf: 'stretch', background: CV.hairline }
const buttonStyle: CSSProperties = {
  all: 'unset',
  // `all: unset` would also drop styles.css's `position: relative` (an inline style outranks the
  // layer), and the `[data-basalt-hit]::after` overlay would anchor to an ancestor — over the plot.
  position: 'relative',
  // No border, not even a transparent one: it makes the entry a nested surface to `shot detect` (its 8px
  // radius then sits within 3px of the card's 10px) and it paints nothing.
  display: 'inline-flex',
  alignItems: 'center',
  // An entry never wraps inside itself (a threshold stays with its name) and never outgrows the row:
  // the label ellipsizes at the row's width (`labelStyle`), its full name in `title`.
  whiteSpace: 'nowrap',
  maxWidth: '100%',
  minWidth: 0,
  gap: 6,
  cursor: 'pointer',
  borderRadius: BASALT.radiusCtrl,
}
const noteStyle: CSSProperties = { color: CV.axis, flex: 'none' }
const labelStyle: CSSProperties = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }

/**
 * A legend entry that may be a sign-colored bar: `colorNegative` is the below-zero color and the
 * swatch splits `color` | `colorNegative`. Only `DualPanel`'s bar sets it; the entry stays one
 * toggle, so the sign halves hide together.
 */
export type SignedSeries<T> = ChartSeries<T> & { colorNegative?: string | undefined }

/**
 * A bar key that carries the mark its cells draw: `glyph` is the text (a `!`, a `×`) and `glyphInk` its
 * color on the swatch's own fill. Only `Heatmap`'s state keys set it, so a stated cell and its key match.
 */
export type GlyphKey = { glyph?: string | undefined; glyphInk?: string | undefined }

type SwatchStyle = Pick<
  SignedSeries<never>,
  'color' | 'colorNegative' | 'mark' | 'dash' | 'strokeOpacity' | 'fillOpacity' | 'role' | 'colorBy'
> &
  GlyphKey

/** The ramp bar's width beside a `colorBy` entry, px. */
const RAMP_KEY_PX = 48

/**
 * A `colorBy` line's key: the reading's name, the low end, the ramp and the high end, muted after the
 * series' own entry, so the legend says what the line's colors mean.
 */
function RampKey({ s }: { s: SwatchStyle }): ReactElement | null {
  const { locale } = useProviderContext()
  const by = s.colorBy
  if (by === undefined) return null
  const format = by.format ?? ((v: number) => defaultNumberFormat(v, locale))
  return (
    <span data-legend-ramp="" style={rampKeyStyle}>
      <span>{by.label}</span>
      <span>{format(by.domain[0])}</span>
      <span
        aria-hidden
        style={{
          width: RAMP_KEY_PX,
          height: 8,
          borderRadius: 2,
          background: rampGradientCss(by.ramp),
          flex: 'none',
        }}
      />
      <span>{format(by.domain[1])}</span>
    </span>
  )
}

const rampKeyStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  color: CV.axis,
  flex: 'none',
  fontVariantNumeric: 'tabular-nums',
}

/** A swatch fill: the series color, or a hard-stop split for a sign-colored bar. */
const swatchFill = (s: SwatchStyle): string =>
  s.colorNegative ? `linear-gradient(90deg, ${s.color} 50%, ${s.colorNegative} 50%)` : s.color

/**
 * A line series' key: a stroke with its dash, narrow below 480px of CHART width (a container
 * query, not the viewport) and wide from 480px. Both are at least 14px with two or more clear
 * dashes: a shorter key reads as two dots. A dashed swatch has BUTT caps: a round cap grows each
 * dash by half the stroke width per end and would close the gap.
 */
export const LINE_SWATCH = {
  narrow: { width: 14, dash: '4 3' },
  wide: { width: 16, dash: '4 3' },
} as const

function LineSwatch({ s, compact }: { s: SwatchStyle; compact: boolean }): ReactElement {
  const { width, dash } = compact ? LINE_SWATCH.narrow : LINE_SWATCH.wide
  const rampKeyId = `basalt-ramp-key-${useId().replaceAll(/[^\w-]/g, '')}`
  return (
    <svg
      aria-hidden
      className={compact ? classes.dot : classes.chip}
      width={width}
      height={8}
      style={{ flex: 'none' }}
    >
      {s.colorBy && (
        <defs>
          <linearGradient id={rampKeyId} x1="0" x2="1" y1="0" y2="0">
            {rampStops(s.colorBy.ramp).map((color, i, all) => (
              <stop key={color} offset={i / (all.length - 1)} style={{ stopColor: color }} />
            ))}
          </linearGradient>
        </defs>
      )}
      <line
        x1={1}
        x2={width - 1}
        y1={4}
        y2={4}
        stroke={s.colorBy ? `url(#${rampKeyId})` : s.color}
        // A reference line is drawn as a 1px rule (`refLineMarks`), a series from 2px: the key keeps that difference.
        strokeWidth={s.role === 'reference' ? 1 : 2}
        strokeLinecap={s.dash === 'dashed' ? 'butt' : 'round'}
        strokeOpacity={s.strokeOpacity ?? 1}
        {...(s.dash === 'dashed' && { strokeDasharray: dash })}
      />
    </svg>
  )
}

function Swatch({ s, mode }: { s: SwatchStyle; mode: LegendMode }): ReactElement {
  if (mode === 'auto')
    return (
      <>
        <Swatch s={s} mode="dots" />
        <Swatch s={s} mode="chips" />
      </>
    )
  if ((s.mark ?? 'line') === 'line') return <LineSwatch s={s} compact={mode === 'dots'} />
  // One shape per mark kind at every width: a bar is a rounded square, compact (8) or wide (10).
  const size = mode === 'dots' ? 8 : 10
  // A scatter's key: a filled dot, or a hollow ring of the same size and color.
  if (s.mark === 'dot' || s.mark === 'ring')
    return (
      <span
        aria-hidden
        className={mode === 'dots' ? classes.dot : classes.chip}
        style={{
          width: size,
          height: size,
          boxSizing: 'border-box',
          borderRadius: '50%',
          ...(s.mark === 'dot' ? { background: s.color } : { border: `1.5px solid ${s.color}` }),
          flex: 'none',
        }}
      />
    )
  // An open mark's key: the bar's square, outlined in the color.
  if (s.mark === 'hollow')
    return (
      <span
        aria-hidden
        className={mode === 'dots' ? classes.dot : classes.chip}
        style={{
          width: size,
          height: size,
          boxSizing: 'border-box',
          borderRadius: 2,
          border: `1.5px solid ${s.color}`,
          flex: 'none',
        }}
      />
    )
  // A state key carries its cells' mark: a 12 px square (the heat cell's glyph floor) whose fill fades
  // in its own color, so the glyph stays at full ink.
  if (s.glyph)
    return (
      <span
        aria-hidden
        data-legend-glyph=""
        className={mode === 'dots' ? classes.dot : classes.chip}
        style={{
          width: 12,
          height: 12,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 2,
          background: alpha(s.color, s.fillOpacity ?? 1),
          fontSize: BASALT.text.micro,
          fontWeight: 600,
          lineHeight: 1,
          color: s.glyphInk,
          flex: 'none',
        }}
      >
        {s.glyph}
      </span>
    )
  return (
    <span
      aria-hidden
      className={mode === 'dots' ? classes.dot : classes.chip}
      style={{
        width: size,
        height: size,
        borderRadius: 2,
        background: swatchFill(s),
        opacity: s.fillOpacity ?? 1,
        flex: 'none',
      }}
    />
  )
}

/** A toggle: the key flips between shown and hidden. */
export function toggledKeys(prev: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const next = new Set(prev)
  if (!next.delete(key)) next.add(key)
  return next
}

/**
 * An isolate: every other key of `keys` hidden and this one shown; isolating the entry already shown
 * alone shows them all again. A key outside `keys` (a reference line) keeps its state.
 */
export function isolatedKeys(
  prev: ReadonlySet<string>,
  key: string,
  keys: readonly string[],
): ReadonlySet<string> {
  const others = keys.filter((k) => k !== key)
  const alone = !prev.has(key) && others.length > 0 && others.every((k) => prev.has(k))
  const next = new Set([...prev].filter((k) => !keys.includes(k)))
  if (!alone) for (const k of others) next.add(k)
  return next
}

/** The keys an isolate acts on: the entries that are series, never a reference line or a zone. */
export const isolatableKeys = <T,>(series: readonly ChartSeries<T>[]): string[] =>
  legendEntries(series, false)
    .flat()
    .filter((s) => s.role !== 'reference')
    .map((s) => s.key)

/** A click with a modifier isolates, as a double click does. */
const isolating = (e: MouseEvent): boolean => e.altKey || e.metaKey || e.ctrlKey || e.shiftKey

export type ChartLegendProps<T> = {
  series: readonly (SignedSeries<T> & GlyphKey)[]
  hidden: ReadonlySet<string>
  mode: LegendMode
  groups: boolean
  toggle: boolean
  onToggle: (key: string) => void
  /** A modifier click (Alt, Shift, Ctrl or Cmd) or a double click: this entry alone, again all of them. */
  onIsolate?: (key: string) => void
  onHighlight: (key: string | null) => void
  /** Keeps the legend's box but shows and offers nothing: a chart with no marks names no series. */
  concealed?: boolean
  /** `auto` mode only: gone from the wide class up, where end labels name the lines (CSS). */
  hideAtWide?: boolean
  /** The narrow class names the lines at their ends (`Lines`' `auto`, where they fit), so this legend goes there too. */
  hideAtNarrow?: boolean
}

/**
 * The compact legend names every entry at every width: nothing folds, the row wraps between entries
 * (series, then overlays, then references). A label that ellipsizes carries its full name in
 * `title`; one that fits carries none. Measured on the node, never in React state.
 */
function titleClipped(row: HTMLElement): void {
  for (const label of row.querySelectorAll<HTMLElement>('[data-legend-label]')) {
    if (label.scrollWidth > label.clientWidth + 0.5) label.title = label.textContent ?? ''
    else label.removeAttribute('title')
  }
}

export function ChartLegend<T>(props: ChartLegendProps<T>): ReactElement | null {
  const rowRef = useRef<HTMLFieldSetElement>(null)
  const auto = props.mode === 'auto'
  // Re-title when the entries change; a resize re-titles through the observer.
  const signature = props.series.map((s) => s.key).join('|')
  // `signature` is intentionally an extra dep: the titles must re-run when the entries change.
  useLayoutEffect(() => {
    if (auto && rowRef.current !== null) titleClipped(rowRef.current)
  }, [auto, signature])
  // Same: `signature` re-subscribes the observer to the re-rendered row.
  useEffect(() => {
    const row = rowRef.current
    if (!auto || row === null || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => titleClipped(row))
    observer.observe(row)
    // A web font landing changes the entry widths without resizing the row.
    let live = true
    void document.fonts?.ready?.then(() => live && titleClipped(row))
    return () => {
      live = false
      observer.disconnect()
    }
  }, [auto, signature])
  const groups = legendEntries(props.series, props.groups)
  if (groups.length === 0) return null
  return (
    <fieldset
      ref={rowRef}
      aria-label="Legend"
      data-basalt-chart-legend={props.mode}
      // `visibility: hidden` is the real guard (nothing is announced, focused or clickable);
      // `aria-hidden` is belt-and-braces for a tree that ignores computed visibility.
      {...(props.concealed && { 'aria-hidden': true })}
      {...(auto && { className: classes.auto })}
      {...(auto && props.hideAtWide && { 'data-hide-wide': '' })}
      {...(auto && props.hideAtNarrow && { 'data-hide-narrow': '' })}
      style={rowLayout(props.mode, props.concealed === true)}
    >
      {groups.map((group, gi) => [
        gi > 0 && <span key={`divider-${gi}`} aria-hidden style={dividerStyle} />,
        ...group.map((s) => {
          const off = props.hidden.has(s.key)
          const content = (
            <>
              <Swatch s={s} mode={props.mode} />
              <span style={labelStyle} data-legend-label="">
                {s.label}
              </span>
              {s.note !== undefined && <span style={noteStyle}>{s.note}</span>}
              <RampKey s={s} />
            </>
          )
          const itemStyle: CSSProperties = { ...buttonStyle, opacity: off ? 0.4 : 1 }
          if (!props.toggle)
            return (
              <span
                key={s.key}
                data-legend-key={s.key}
                data-legend-role={s.role ?? 'series'}
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
              data-legend-role={s.role ?? 'series'}
              data-basalt-hit=""
              className={classes.toggle}
              aria-pressed={!off}
              style={itemStyle}
              onClick={(e) => {
                // The two clicks of a double click toggle twice and cancel; the dblclick isolates.
                if (props.onIsolate !== undefined && isolating(e)) props.onIsolate(s.key)
                else props.onToggle(s.key)
              }}
              onDoubleClick={() => props.onIsolate?.(s.key)}
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
