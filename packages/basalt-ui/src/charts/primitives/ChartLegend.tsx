import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BasaltProps } from '../../common/props'
import { alpha, VX } from '../../tokens'
import type { SeriesRole, LegendPlacement } from '../series'
import { DOTS_HIT_GAP, LEGEND_DOT_SIZE, LEGEND_ROW_GAP, orderEntries } from './chart-frame-layout'
import { useChartMetrics, useCoarsePointer } from './chart-tier'

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
  /** line/splitLine swatch stroke opacity — parity with `fillOpacity` above, so a dimmed
   * companion line's swatch cannot lie about its own opacity either. */
  strokeOpacity?: number
  /** Drives `groups` rendering (series → hairline divider → overlay → reference). */
  role?: SeriesRole
  /** Companions folded under this entry via `parent` (`deriveLegend`) — rendered as compact,
   * subordinate sub-entries beside the parent's label instead of vanishing. */
  children?: LegendEntry[]
  /** Short qualifier rendered after the label in muted text — e.g. a flat-at-zero series that is
   * invisible in the plot. */
  note?: string
}

const LEGEND_ITEM_BASE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'default',
  transition: 'opacity 0.15s',
}

// An interactive legend entry is a native <button> (keyboard-focusable, no jsx-a11y role hack) —
// this strips the browser's default button chrome so it renders identically to the static entry.
const LEGEND_ITEM_BUTTON: CSSProperties = {
  ...LEGEND_ITEM_BASE,
  appearance: 'none',
  background: 'none',
  border: 'none',
  padding: 0,
  margin: 0,
  font: 'inherit',
  color: 'inherit',
  textAlign: 'inherit',
}

/** Stable empty set — a fresh `new Set()` default would be a new identity on every render. */
const NO_HIDDEN: ReadonlySet<string> = new Set()

const DISCLOSURE_PANEL: CSSProperties = {
  position: 'fixed',
  zIndex: VX.zIndexFloating,
  display: 'flex',
  flexDirection: 'column',
  gap: LEGEND_ROW_GAP,
  // theme-allow raw-scroll-container — a fixed floating panel of one legend, not app chrome
  overflowY: 'auto',
  // `<dialog open>` brings UA chrome (centring margin, border, fit-content box) this resets.
  margin: 0,
  border: 'none',
  width: 'auto',
  height: 'auto',
  padding: 10,
  boxSizing: 'border-box',
  backgroundColor: VX.surface.overlay,
  boxShadow: VX.shadowOverlay,
  color: VX.muted,
  borderRadius: VX.radiusCard,
}

/** A popover never collapses below one usable row, however little room the chip leaves. */
const DISCLOSURE_MIN_HEIGHT = 96

/** A popover hangs off its chip (flipping above when there is no room below); a sheet is docked. */
function disclosurePlacement(chip: DOMRect, coarse: boolean): CSSProperties {
  if (coarse) {
    return {
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '60dvh',
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
    }
  }
  const below = window.innerHeight - chip.bottom
  const left = Math.max(8, Math.min(chip.left, window.innerWidth - 248))
  const base = { left, right: 'auto', minWidth: 200, maxWidth: 'calc(100vw - 16px)' }
  return below >= 200 || below >= chip.top
    ? { ...base, top: chip.bottom + 4, maxHeight: Math.max(below - 12, DISCLOSURE_MIN_HEIGHT) }
    : {
        ...base,
        bottom: window.innerHeight - chip.top + 4,
        maxHeight: Math.max(chip.top - 12, DISCLOSURE_MIN_HEIGHT),
      }
}

function wrapperStyle(placement: LegendPlacement, fontSize: number, dots: boolean): CSSProperties {
  const vertical = placement === 'left' || placement === 'right'
  const gap = dots ? DOTS_HIT_GAP : VX.legendGap
  return {
    display: 'flex',
    flexDirection: vertical ? 'column' : 'row',
    flexWrap: vertical ? 'nowrap' : 'wrap',
    alignItems: vertical ? 'flex-start' : 'center',
    justifyContent: 'flex-start',
    columnGap: gap,
    // Always the tight row gap (R2C-9): the wider dots COLUMN gap is a hit-overlap cap, not
    // breathing room between wrapped rows — a dots-mode header legend is 1 row by law
    // (`LEGEND_ROWS.header` in `chart-layout.ts`) anyway, so this only ever shows in the band.
    rowGap: LEGEND_ROW_GAP,
    // Caps each entry's `[data-basalt-hit]` overlay at the real inter-entry gap (styles.css).
    ...({ '--vx-hit-gap': `${gap}px` } as CSSProperties),
    // A dots-mode row has no text baseline to breathe around — the header-fold law (wave 8) is
    // the reason this row exists at all, so it gets the same tight treatment.
    padding: dots ? '4px 0 2px' : '8px 0 2px',
    fontSize,
    color: VX.muted,
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
          strokeOpacity={item.strokeOpacity ?? 1}
          strokeDasharray={item.dashed ? VX.dashArray : undefined}
        />
        <line
          x1={10}
          y1={7}
          x2={20}
          y2={7}
          stroke={item.secondColor}
          strokeWidth={item.strokeWidth ?? 2.5}
          strokeOpacity={item.strokeOpacity ?? 1}
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
          width: 11,
          height: 11,
          borderRadius: 3, // theme-allow raw-surface — sub-scale legend-swatch corner, below the 4px radius floor
          backgroundColor: item.color,
          opacity: item.fillOpacity ?? 0.7,
          flexShrink: 0,
        }}
      />
    )
  }

  // Line series — a 16×3px radius-2 pill (docs/DESIGN-SPEC.md §5). A thick, round-capped stroke
  // reads as a filled pill when solid while still supporting the dashed variant.
  return (
    <svg width={16} height={6} style={{ flexShrink: 0 }}>
      <line
        x1={0}
        y1={3}
        x2={16}
        y2={3}
        stroke={item.color}
        strokeWidth={item.strokeWidth ?? 3}
        strokeOpacity={item.strokeOpacity ?? 1}
        strokeLinecap="round"
        strokeDasharray={item.dashed ? VX.dashArray : undefined}
      />
    </svg>
  )
}

// Same dimming as `LEGEND_CHILD_STYLE` below — the legend wrapper already sets the base text color
// to `VX.muted` (`wrapperStyle`), so subordinate text is just that color at reduced opacity, never
// a second color token.
const LEGEND_NOTE_STYLE: CSSProperties = {
  opacity: 0.75,
}

const LEGEND_CHILD_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  marginLeft: 4,
  fontSize: '0.85em',
  opacity: 0.75,
}

/**
 * The whole entry collapses to its color, in 'dots' mode (`docs/CHARTS-SPEC.md` §5: a short or
 * `compact`-container header has no room for a text label per entry) — a plain 8px circle
 * regardless of the series' own shape, since a two-tone `split`/`splitLine` swatch cannot express
 * two colors in one dot. The name survives via the button's own `aria-label`; sighted users get
 * color-coded identity only, same trade the `compact` container class already made for the y axis.
 */
function LegendDot({ item }: { item: LegendEntry }) {
  return (
    <span
      style={{
        width: LEGEND_DOT_SIZE,
        height: LEGEND_DOT_SIZE,
        borderRadius: '50%', // theme-allow raw-surface — a circle shape, not a surface corner
        backgroundColor: item.color,
        flexShrink: 0,
      }}
    />
  )
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
          borderRadius: 2, // theme-allow raw-surface — sub-scale legend-swatch corner, below the 4px radius floor
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
        strokeOpacity={item.strokeOpacity ?? 1}
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
      {/* No LEGEND_NOTE_STYLE here — LEGEND_CHILD_STYLE already dims the whole child block, and
          compounding the two opacities would push a folded companion's note near-invisible. */}
      {item.note ? <span>{item.note}</span> : null}
    </span>
  )
}

/**
 * Shared legend for all non-sparkline charts. `highlighted`/`onHighlight` are optional — omit for
 * static legends without hover interactivity. `chartId` namespaces `split` clipPath ids so two
 * legends on the same page never collide. `groups` renders series → hairline divider → overlay →
 * reference bands instead of one flat smear. `maxRows` caps the number of rendered ENTRIES and
 * rolls the remainder into an `All N` disclosure chip — it is an entry count, not a row count, in
 * spite of the name (`entries.slice(0, cap)` below is the whole of it). `ChartFrame` derives the
 * cap from the measured fit (`resolveChartLayout().legend`); a caller-stated value wins.
 *
 * `onToggle` makes an entry a real toggle: clicking it hides the series in the plot, the tooltip,
 * and the auto y-domain together (`ChartFrame` owns the `hidden` set — see `docs/CHARTS-SPEC.md`
 * §5). A hidden entry is announced via `aria-pressed`.
 *
 * **The rollup is a disclosure, not a label.** `All N` is a `<button>` carrying `aria-expanded`
 * that opens EVERY entry, toggles included, in a popover under the chip on a fine pointer and a
 * bottom sheet on a coarse one. Both are fixed-position and portalled, so opening one never grows
 * the legend band or moves the plot. Escape, an outside press, a scroll or a resize closes it, and
 * focus returns to the chip on every close.
 */
export function ChartLegend({
  items,
  highlighted = null,
  onHighlight,
  hidden = NO_HIDDEN,
  onToggle,
  chartId = '',
  placement = 'bottom',
  groups = false,
  maxRows,
  mode = 'chips',
  className,
  style,
}: BasaltProps & {
  items: LegendEntry[]
  highlighted?: string | null
  onHighlight?: (key: string | null) => void
  /** Keys currently toggled off. */
  hidden?: ReadonlySet<string>
  /** Present = entries are clickable toggles. */
  onToggle?: (key: string) => void
  chartId?: string
  placement?: LegendPlacement
  groups?: boolean
  maxRows?: number
  /**
   * `'dots'` collapses every VISIBLE entry to a plain color dot with no label (the name still
   * reaches assistive tech via `aria-label`) — `resolveChartLayout`'s header-slot legend forces
   * this for a short `ChartCard` (wave 11, `docs/CHARTS-SPEC.md` §5) so the legend band's height and
   * width both shrink before it eats plot space. The `All N` disclosure panel is unaffected: it
   * always shows the full swatch + label, `mode` only governs the inline row. Default `'chips'`
   * (today's swatch + label rendering) for every other caller.
   */
  mode?: 'dots' | 'chips'
}) {
  const tier = useChartMetrics()
  const coarse = useCoarsePointer()
  const [disclosure, setDisclosure] = useState<CSSProperties | null>(null)
  // Whichever button opened the panel — the `All N` chip, or (dots mode) any entry — so focus
  // returns to where the user actually tapped, not to a fixed chip that might not exist.
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDialogElement>(null)
  const open = disclosure !== null

  const panelId = useId()
  const wasOpen = useRef(false)

  const openDisclosure = (trigger: HTMLButtonElement) => {
    triggerRef.current = trigger
    setDisclosure(disclosurePlacement(trigger.getBoundingClientRect(), coarse))
  }

  // Focus moves into the panel on open and back to the trigger on EVERY close path.
  useEffect(() => {
    if (open) panelRef.current?.focus()
    else if (wasOpen.current) triggerRef.current?.focus()
    wasOpen.current = open
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = () => setDisclosure(null)
    const inside = (target: EventTarget | null): boolean =>
      target instanceof Node &&
      (panelRef.current?.contains(target) === true || triggerRef.current?.contains(target) === true)
    const onPointerDown = (e: PointerEvent) => {
      if (inside(e.target)) return
      close()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    // The panel is fixed to where the trigger WAS — a scroll (any scroller, hence capture) or a
    // resize leaves it hanging off nothing. The panel's own scroll is not one.
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && panelRef.current?.contains(e.target)) return
      close()
    }
    // Capture phase, like the chart cursors' own outside-dismiss listeners (`useChartCursor.ts`,
    // `useDiscreteCursor.ts`) — a bubble-phase listener never sees a pointerdown a descendant widget
    // stopped from propagating, which would leave the disclosure stuck open under it.
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  // The coarse sheet claims `aria-modal` (below), which is a claim that Tab cannot leave it — a
  // native `<dialog open>` (no `showModal()`) does not enforce that on its own (B14). Wrap Tab at
  // the panel's own first/last focusable rather than the fine popover, which is dismissed by an
  // outside click/Escape just as easily and never claimed to be modal in the first place.
  useEffect(() => {
    if (!open || !coarse) return
    const panel = panelRef.current
    if (panel === null) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, [tabindex]:not([tabindex="-1"])',
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (first === undefined || last === undefined) return
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    panel.addEventListener('keydown', onKeyDown)
    return () => panel.removeEventListener('keydown', onKeyDown)
  }, [open, coarse])

  const handleEnter = (key: string) => onHighlight?.(key)
  const handleLeave = () => onHighlight?.(null)

  const idPrefix = chartId ? `${chartId}-` : ''
  const vertical = placement === 'left' || placement === 'right'
  const { entries, dividerAfter } = orderEntries(items, groups)
  const rolledUp = maxRows === undefined ? 0 : Math.max(entries.length - maxRows, 0)
  const visible = rolledUp > 0 ? entries.slice(0, maxRows) : entries

  // The disclosure panel is a second copy of the same entries: it gets its own id namespace and
  // no `data-legend-key`, so a page query for the band's entries never finds the panel's twins.
  const entryButton = (item: LegendEntry, inPanel = false): ReactNode => {
    // A dots-mode entry names nothing on its own face — its whole point is the color — so a tap
    // opens the same All-N sheet the overflow chip does, rather than silently hiding a series the
    // reader was trying to identify (R2C-8: "what is this?" used to toggle it off instead).
    const isDotTrigger = !inPanel && mode === 'dots' && onToggle !== undefined
    return (
      <button
        key={item.key}
        type="button"
        data-basalt-hit
        {...(!inPanel && { 'data-legend-key': item.key })}
        // The note is the whole point for a series that is invisible in the plot, so it has to
        // reach a screen reader too — an explicit aria-label would otherwise replace it.
        aria-label={item.note ? `${item.label} — ${item.note}` : item.label}
        {...(isDotTrigger && { title: item.label, 'aria-haspopup': 'dialog' as const })}
        {...(isDotTrigger
          ? { 'aria-expanded': open, 'aria-controls': panelId }
          : onToggle !== undefined && { 'aria-pressed': !hidden.has(item.key) })}
        style={{
          ...LEGEND_ITEM_BUTTON,
          cursor: onToggle === undefined ? 'default' : 'pointer',
          // Toggled-off wins over hover-dimming: a hidden series must read as hidden even while
          // it is the one being hovered.
          opacity: hidden.has(item.key)
            ? 0.35
            : highlighted === null || highlighted === item.key
              ? 1
              : 0.3,
          textDecoration: hidden.has(item.key) ? 'line-through' : 'none',
        }}
        {...(isDotTrigger
          ? { onClick: (e: MouseEvent<HTMLButtonElement>) => openDisclosure(e.currentTarget) }
          : onToggle !== undefined && { onClick: () => onToggle(item.key) })}
        onMouseEnter={() => handleEnter(item.key)}
        onMouseLeave={handleLeave}
        onFocus={() => handleEnter(item.key)}
        onBlur={handleLeave}
      >
        {!inPanel && mode === 'dots' ? (
          <LegendDot item={item} />
        ) : (
          <>
            <LegendSwatch item={item} idPrefix={inPanel ? `${idPrefix}disclosure-` : idPrefix} />
            <span>{item.label}</span>
            {item.note ? <span style={LEGEND_NOTE_STYLE}>{item.note}</span> : null}
            {item.children?.map((child) => (
              <LegendChild key={child.key} item={child} />
            ))}
          </>
        )}
      </button>
    )
  }

  const nodes: ReactNode[] = []
  visible.forEach((item, i) => {
    nodes.push(entryButton(item))
    if (dividerAfter.has(i))
      nodes.push(<LegendDivider key={`divider-${item.key}`} columnLayout={vertical} />)
  })
  if (rolledUp > 0) {
    nodes.push(
      <button
        key="legend-more"
        type="button"
        data-basalt-hit
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={panelId}
        onClick={(e) => (open ? setDisclosure(null) : openDisclosure(e.currentTarget))}
        style={{ ...LEGEND_ITEM_BUTTON, cursor: 'pointer', textDecoration: 'underline' }}
      >
        {`All ${entries.length}`}
      </button>,
    )
  }

  return (
    <div
      {...(className !== undefined && { className })}
      style={{ ...wrapperStyle(placement, tier.legendFontSize, mode === 'dots'), ...style }}
    >
      {nodes}
      {open &&
        createPortal(
          <>
            {coarse && (
              <div
                aria-hidden
                onPointerDown={(e) => {
                  e.stopPropagation()
                  setDisclosure(null)
                }}
                style={{
                  position: 'fixed',
                  inset: 0,
                  // One below the panel it sits behind — still `VX.zIndexFloating`-derived, never a
                  // second unrelated literal (B14).
                  zIndex: VX.zIndexFloating - 1,
                  backgroundColor: alpha(VX.neutral, 0.35),
                }}
              />
            )}
            <dialog
              ref={panelRef}
              id={panelId}
              open
              tabIndex={-1}
              aria-label="Legend"
              {...(coarse && { 'aria-modal': true })}
              data-basalt-legend-disclosure={coarse ? 'sheet' : 'popover'}
              style={{ ...DISCLOSURE_PANEL, fontSize: tier.legendFontSize, ...disclosure }}
            >
              {entries.map((item) => entryButton(item, true))}
            </dialog>
          </>,
          document.body,
        )}
    </div>
  )
}
