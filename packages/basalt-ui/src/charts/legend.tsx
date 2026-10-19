/**
 * The derived legend — HTML, Mantine-free, outside the engine. Entries come from `series` only (a
 * legend cannot name what the plot does not draw); a companion (`legend: false` + `parent`) rides
 * its parent's entry. Toggling an entry hides the series from the plot, the tooltip and the auto
 * domain together; hovering one emphasizes it (the definition is rebuilt with `highlighted`).
 */
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import { VX } from '../tokens'
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
 * four-entry legend still fits one row at 390px. `--vx-hit-gap` caps each coarse-pointer hit area
 * at the entry plus 2px and this gap (`styles.css`), so neighbours never overlap; the trade is that
 * a dots-mode hit target is 8 + 2 + 30 = 40px, not 44.
 */
const DOTS_GAP = 30

const byReferenceLast = <T,>(a: ChartSeries<T>, b: ChartSeries<T>): number =>
  Number(a.role === 'reference') - Number(b.role === 'reference')

/** The entries a series list derives, in display order (by role when `groups`). */
export function legendEntries<T>(
  series: readonly ChartSeries<T>[],
  groups: boolean,
): ChartSeries<T>[][] {
  const entries = series.filter((s) => s.legend !== false)
  // Series lead, zones and reference lines follow: the compact fold takes the references from the end.
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
  minWidth: 0,
  flexWrap: 'wrap',
  alignItems: 'center',
  rowGap: 4,
  // The tick step: ticks, legend and tooltip are one size, so a chart card has at most three.
  fontSize: VX.text.micro,
  color: VX.ink2,
  lineHeight: 1.35,
}
const rowStyle: CSSProperties = { ...rowBaseStyle, display: 'flex' }
/** The gaps `chart-legend.module.css` reads, as custom properties. */
type LegendVars = CSSProperties & Record<'--bc-legend-gap' | '--bc-dots-gap', string>
// `flex-wrap` is the stylesheet's too, so the same rule wraps at every width.
const { flexWrap: _wrap, ...autoBaseStyle } = rowBaseStyle
const autoRowStyle: LegendVars = {
  ...autoBaseStyle,
  '--bc-legend-gap': `${VX.legendGap}px`,
  '--bc-dots-gap': `${DOTS_GAP}px`,
}
/** The row's layout; a concealed legend keeps it (and so its height) but is not visible. */
function rowLayout(mode: LegendMode, concealed: boolean): CSSProperties {
  // Hidden, not removed: the data arriving must not shift the chart below it.
  const hide: CSSProperties = concealed ? { visibility: 'hidden' } : {}
  // `display` and the gaps are the stylesheet's in `auto`: the container picks them by width.
  if (mode === 'auto') return { ...autoRowStyle, ...hide }
  const gap = mode === 'dots' ? DOTS_GAP : VX.legendGap
  return {
    ...rowStyle,
    columnGap: gap,
    // Caps each entry's `[data-basalt-hit]` overlay at the real gap between entries.
    ...({ '--vx-hit-gap': `${gap}px` } as CSSProperties),
    ...hide,
  }
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
  // An entry never wraps inside itself (a threshold stays with its name) and never outgrows the row:
  // the label ellipsizes at the row's width (`labelStyle`), its full name in `title`.
  whiteSpace: 'nowrap',
  maxWidth: '100%',
  minWidth: 0,
  gap: 6,
  cursor: 'pointer',
  borderRadius: VX.radiusCtrl,
}
const noteStyle: CSSProperties = { color: VX.axis, flex: 'none' }
const labelStyle: CSSProperties = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }

/**
 * A legend entry that may be a sign-coloured bar: `colorNegative` is the below-zero colour and the
 * swatch splits `color` | `colorNegative`. Only `DualPanel`'s bar sets it; the entry stays one
 * toggle, so the sign halves hide together.
 */
export type SignedSeries<T> = ChartSeries<T> & { colorNegative?: string | undefined }

type SwatchStyle = Pick<
  SignedSeries<never>,
  'color' | 'colorNegative' | 'mark' | 'dash' | 'strokeOpacity' | 'fillOpacity'
>

/** A swatch fill: the series colour, or a hard-stop split for a sign-coloured bar. */
const swatchFill = (s: SwatchStyle): string =>
  s.colorNegative ? `linear-gradient(90deg, ${s.color} 50%, ${s.colorNegative} 50%)` : s.color

/**
 * A line series' key: a stroke with its dash, compact below 480px of CHART width (a container
 * query, not the viewport) and wide from 480px. Both are at least 14px with two or more clear
 * dashes: a shorter key reads as two dots. A dashed swatch has BUTT caps: a round cap grows each
 * dash by half the stroke width per end and would close the gap.
 */
export const LINE_SWATCH = {
  compact: { width: 14, dash: '4 3' },
  wide: { width: 16, dash: '4 3' },
} as const

function LineSwatch({ s, compact }: { s: SwatchStyle; compact: boolean }): ReactElement {
  const { width, dash } = compact ? LINE_SWATCH.compact : LINE_SWATCH.wide
  return (
    <svg
      aria-hidden
      className={compact ? classes.dot : classes.chip}
      width={width}
      height={8}
      style={{ flex: 'none' }}
    >
      <line
        x1={1}
        x2={width - 1}
        y1={4}
        y2={4}
        stroke={s.color}
        strokeWidth={2}
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
  return (
    <span
      aria-hidden
      className={mode === 'dots' ? classes.dot : classes.chip}
      style={{
        width: size,
        height: size,
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
  series: readonly SignedSeries<T>[]
  hidden: ReadonlySet<string>
  mode: LegendMode
  groups: boolean
  toggle: boolean
  onToggle: (key: string) => void
  onHighlight: (key: string | null) => void
  /** Keeps the legend's box but shows and offers nothing: a chart with no marks names no series. */
  concealed?: boolean
  /** `auto` mode only: gone from the wide class up, where end labels name the lines (CSS). */
  hideAtWide?: boolean
}

const VISUALLY_HIDDEN = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
} as const

/**
 * The number of lines the visible entries (and the chip) sit on. Bucketed by vertical centre, so the
 * chip's own height (shorter than an entry's) does not read as another line.
 */
function lineCount(row: HTMLElement, more: HTMLElement): number {
  const shown = [...row.querySelectorAll<HTMLElement>('[data-legend-key]')].filter(
    (it) => !it.hasAttribute('data-legend-folded'),
  )
  if (!more.hidden) shown.push(more)
  const centres = shown
    .map((it) => {
      const r = it.getBoundingClientRect()
      return r.top + r.height / 2
    })
    .toSorted((x, y) => x - y)
  // A new line starts where the centre jumps by more than half an entry's height.
  return centres.filter((c, i) => i === 0 || c - (centres[i - 1] ?? c) > 6).length
}

/**
 * The compact legend names every series at every width. When the row wraps below 480px, the
 * zone / reference entries fold into a `+N` chip (named for assistive tech by the folded labels), the
 * last first, only while the row has more lines than the series alone would; a series never folds.
 * The entries are in display order: series, then zones / references.
 * Measured on the node, never in React state, so a hover or a resize does not re-render.
 */
function foldLegend(row: HTMLElement): void {
  const items = [...row.querySelectorAll<HTMLElement>('[data-legend-key]')]
  const more = row.querySelector<HTMLElement>('[data-legend-more]')
  for (const it of items) it.removeAttribute('data-legend-folded')
  more?.setAttribute('hidden', '')
  // A label that ellipsizes carries its full name in `title`; one that fits carries none.
  for (const label of row.querySelectorAll<HTMLElement>('[data-legend-label]')) {
    if (label.scrollWidth > label.clientWidth + 0.5) label.title = label.textContent ?? ''
    else label.removeAttribute('title')
  }
  // `--bc-fold` is the stylesheet's compact flag (chart-legend.module.css); wide keeps every entry.
  if (more === null || getComputedStyle(row).getPropertyValue('--bc-fold').trim() !== '1') return
  const references = items.filter((it) => it.dataset['legendRole'] === 'reference')
  // The series-only line count is the floor: folding a reference that frees no line only hides a name.
  for (const r of references) r.setAttribute('data-legend-folded', '')
  const floor = lineCount(row, more)
  for (const r of references) r.removeAttribute('data-legend-folded')
  const folded: HTMLElement[] = []
  while (folded.length < references.length && lineCount(row, more) > floor) {
    const last = references[references.length - 1 - folded.length]
    if (last === undefined) break
    last.setAttribute('data-legend-folded', '')
    folded.push(last)
    more.removeAttribute('hidden')
    const names = folded.map((f) => f.textContent).join(', ')
    more.textContent = `+${folded.length}`
    more.title = names
    // The folded labels, visually hidden: assistive tech reads `+2: Caution, Danger`.
    const hiddenNames = document.createElement('span')
    hiddenNames.textContent = `: ${names}`
    Object.assign(hiddenNames.style, VISUALLY_HIDDEN)
    more.append(hiddenNames)
  }
  // Folding freed no line (the chip's own width cost it): show every name instead.
  if (folded.length > 0 && lineCount(row, more) > floor) {
    for (const f of folded) f.removeAttribute('data-legend-folded')
    more.setAttribute('hidden', '')
  }
}

export function ChartLegend<T>(props: ChartLegendProps<T>): ReactElement | null {
  const rowRef = useRef<HTMLFieldSetElement>(null)
  const auto = props.mode === 'auto'
  // Re-fold when the entries change; a resize re-folds through the observer.
  const signature = props.series.map((s) => s.key).join('|')
  // `signature` is intentionally an extra dep: the fold must re-run when the entries change.
  useLayoutEffect(() => {
    if (auto && rowRef.current !== null) foldLegend(rowRef.current)
  }, [auto, signature])
  // Same: `signature` re-subscribes the observer to the re-rendered row.
  useEffect(() => {
    const row = rowRef.current
    if (!auto || row === null || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => foldLegend(row))
    observer.observe(row)
    // A web font landing changes the entry widths without resizing the row.
    let live = true
    void document.fonts?.ready?.then(() => live && foldLegend(row))
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
      {auto && <span data-legend-more="" hidden style={noteStyle} />}
    </fieldset>
  )
}
