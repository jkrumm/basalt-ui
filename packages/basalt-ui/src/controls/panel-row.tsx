/**
 * `PanelRow` — the inspector/facet ROW every control renders on the `panel` surface, and on the
 * mobile `sheet` surface too (`docs/ASIDE-SPEC.md` §1 "Inspector", §3; `docs/CONTROLS-SPEC.md` §3:
 * "sheet = panel rows inside a Drawer") — a labelled block around one control, and a HOME: it wraps
 * its slots in `CtlSlot`, so a control inside carries no `size` of its own (law C5).
 *
 * **Label above, never beside (G4).** At an aside's ~300px, label · control · readout on one line
 * leaves the control about 90px — under 12px per step for a 20-step slider, which is why the CBBI
 * page hand-rolled two-line rows before this existed. The ONE exception is `end`: a control that
 * rides the label line because it is atomic and needs no width (a `Switch`).
 *
 * The skeleton is plain elements plus one CSS module — no Mantine `Group`/`Stack`. A row is drawn
 * dozens of times in one column, and the hairline/inset law it carries (`.row + .row`) is a
 * SIBLING relationship, which a `Stack`'s gap cannot express.
 *
 * @example
 * <PanelRow label="Pi Cycle Top" hint="The 111DMA / 350DMA×2 crossover." readout="0.62">
 *   <SliderControl field={weights.field.piCycle} label="Pi Cycle Top" />
 * </PanelRow>
 *
 * @example
 * // A toggle: one line, the control on the label line, no control line at all.
 * <PanelRow label="Reweighted" end={<Switch checked={on} onChange={…} />} />
 */
import { SegmentedControl, Select } from '@mantine/core'
import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { cx } from '../common/props'
import type { BasaltProps } from '../common/props'
import { CtlSlot } from '../theme'
import { InfoGlyph } from '../dashboard/widget-header'
import classes from './panel-row.module.css'

/**
 * Past three options a panel row's choice is a `Select`, not a track. Same arithmetic as
 * `ViewTabs`' phone form, against the aside's ~300px rather than a phone's: a four-segment track at
 * that width gives each label ~60px, which truncates every word longer than "Previous".
 *
 * **The count, not the whole law.** Three options at three WORDS' worth of label is not the same
 * claim as three options at three SENTENCES' worth — "Same period last year" clipped mid-word
 * inside its equal third even at a set of exactly three. `PANEL_TRACK_MAX` is the cheap first gate;
 * `useTrackFits` (below) is the actual width check that decides whether the track renders at all.
 */
export const PANEL_TRACK_MAX = 3

export type PanelRowProps = BasaltProps & {
  /** The row's name. Rendered above the control, `xs`/550 — never inside it. */
  readonly label: string
  /** Info glyph + tooltip beside the label — the same affordance `WidgetHeader.info` draws. */
  readonly hint?: string
  /**
   * The current value, mono and right-aligned on the label line. A slider's readout, a range's
   * resolved window — anything the control itself does not print.
   */
  readonly readout?: ReactNode
  /**
   * A control that rides the LABEL line instead of taking one of its own — a `Switch`, and by
   * design almost nothing else. Anything with a width belongs in `children`.
   */
  readonly end?: ReactNode
  /** Dims the row. The control inside keeps its own `disabled` — this is the visual half. */
  readonly disabled?: boolean
  /**
   * Stamped on the label so the control can point `aria-labelledby` at it. The CONTROL owns the id
   * (it renders this row), so an id published downward could never reach it — see
   * `useControlName`'s doc.
   */
  readonly labelId?: string
  /**
   * When set, renders the label as a `<label htmlFor={htmlFor}>` instead of a bare `<span>`, so
   * clicking the label text also activates the control — the affordance Mantine's own labelled
   * inputs give for free. Pass the `end` control's id (a `Switch`, typically).
   */
  readonly htmlFor?: string
  /** The full-width control line. Omitted for a row whose control rides `end`. */
  readonly children?: ReactNode
}

export function PanelRow({
  label,
  hint,
  readout,
  end,
  disabled,
  labelId,
  htmlFor,
  children,
  className,
  style,
}: PanelRowProps): ReactNode {
  return (
    <div
      className={cx(classes.row, className)}
      {...(disabled === true && { 'data-disabled': true })}
      {...(style !== undefined && { style })}
    >
      {/* ONE slot for the whole row, not one per line: `CtlSlot`'s marker is `display: contents`,
          so both lines stay flex children of `.row` and the tier reaches `end` and `children`
          through a single provider. */}
      <CtlSlot>
        <div className={classes.head}>
          {htmlFor !== undefined ? (
            <label
              htmlFor={htmlFor}
              className={classes.label}
              {...(labelId !== undefined && { id: labelId })}
            >
              {label}
            </label>
          ) : (
            <span className={classes.label} {...(labelId !== undefined && { id: labelId })}>
              {label}
            </span>
          )}
          {hint !== undefined && <InfoGlyph text={hint} />}
          {readout !== undefined && <span className={classes.readout}>{readout}</span>}
          {end !== undefined && <span className={classes.end}>{end}</span>}
        </div>
        {children !== undefined && <div className={classes.control}>{children}</div>}
      </CtlSlot>
    </div>
  )
}

/** One option as both surfaces render it — `disabled` is the `SegmentedControl` half. */
export type PanelChoiceOption = {
  readonly value: string
  readonly label: string
  readonly disabled?: boolean
}

export type PanelChoiceProps = {
  /** The control's accessible name, as `useControlName` resolved it for this surface. */
  readonly nameProps: { 'aria-labelledby': string } | { 'aria-label': string }
  readonly value: string
  readonly options: readonly PanelChoiceOption[]
  /** Numeric labels (`7d` / `30d`) get the mono treatment `segmented-control.module.css` owns. */
  readonly numeric?: boolean
  readonly onChange: (next: string) => void
}

/**
 * The nearest ANCESTOR that actually occupies layout space — skipping every `display: contents`
 * box on the way up. Every home in this package wraps its slot in `CtlSlot` (`theme/ctl-theme.tsx`)
 * to reach the `ctl` tier, and `CtlSlot`'s own marker is a `display: contents` `Box` (deliberately —
 * it must stay out of the slot's own flex/grid layout). A `display: contents` element generates NO
 * box of its own, so its `clientWidth` is always `0` — reading `root.parentElement.clientWidth`
 * directly would report "zero room" for every control mounted straight into a slot (`ViewTabs`'
 * desktop form, `PageBar`'s `actions`), which is not the constraint being measured at all.
 */
function layoutParent(el: HTMLElement): HTMLElement | null {
  let parent = el.parentElement
  while (parent !== null && getComputedStyle(parent).display === 'contents') {
    parent = parent.parentElement
  }
  return parent
}

/**
 * A `SegmentedControl`'s own semantic class for a rendered option's label (`__staticSelector`,
 * present on every Mantine styles-api part regardless of the CSS-module hash) — stable across a
 * version bump the way a generated `_label_1pq5d_5` class is not.
 */
const TRACK_LABEL_SELECTOR = '.mantine-SegmentedControl-label'

/**
 * The authoritative check, meaningful only while the track is actually mounted — TWO signals, not
 * one, because they catch two DIFFERENT ways a track fails to fit and neither subsumes the other:
 *
 * 1. **Root vs parent** (`root.offsetWidth > parent.clientWidth`) — the track's OWN root refuses to
 *    shrink below `min-width: max-content` (`theme/index.ts`'s `SegmentedControl.extend`), so a
 *    too-narrow ANCESTOR (a header's `actions` slot squeezing a non-`fullWidth` two-option track)
 *    shows up as the root overflowing its container.
 * 2. **Per-label overflow** (`label.scrollWidth > label.clientWidth`) — the ctl-tier `fullWidth`
 *    label carries `width: 100%` (`theme/index.ts`, so it fills its equal `.control` share for
 *    ellipsis to work at all — `PanelChoice`'s doc). A `width: 100%` CHILD cannot contribute an
 *    intrinsic size to its ancestor's max-content computation (percentages are undefined until the
 *    container's own size is known, so the browser treats it as contributing ~nothing) — which is
 *    why `min-width: max-content` on the root measurably FAILS to grow past its available space at
 *    the phone tier: "Week"/"Absolute" clipped inside their equal column ("Wee", "Absolut") while
 *    `root.offsetWidth` still read as fitting its parent. Signal 1 cannot see this at all; only
 *    reading each rendered label directly can.
 *
 * Both signals require REAL layout, so `unknown` (parent not yet settled) takes priority over
 * either — see `useTrackFits`'s own doc for why a `0` reading is not evidence of overflow.
 */
function measureMounted(root: HTMLElement, parent: HTMLElement): 'fits' | 'overflow' | 'unknown' {
  if (parent.clientWidth === 0) return 'unknown'
  if (root.offsetWidth > parent.clientWidth) return 'overflow'
  const labels = root.querySelectorAll<HTMLElement>(TRACK_LABEL_SELECTOR)
  for (const label of labels) {
    if (label.scrollWidth > label.clientWidth) return 'overflow'
  }
  return 'fits'
}

/**
 * Fit-checks a full-width track: {@link PANEL_TRACK_MAX} (and `ViewTabs`' own `PHONE_TRACK_MAX`) is
 * the cheap COUNT gate, not the whole law — three short labels and three long ones are not the same
 * claim at a ~300px column or a phone sheet ("Same period last year" clipped mid-word inside its
 * equal third even though the set was exactly three; "Week"/"Absolute" clipped inside their equal
 * column at the phone tier even though the ROOT read as fitting its parent — see
 * {@link measureMounted}'s doc for why that needs a second signal). This hook is the width gate
 * underneath the count cap, shared so `PanelChoice` and `ViewTabs`' phone form cannot drift the way
 * their two hand-rolled ternaries already had once (`PanelChoice`'s own doc).
 *
 * **A LIVE toggle, not a one-way latch — it reverts.** The moment the track overflows, `PanelChoice`
 * swaps it for a `Select`, which un-mounts the only element `measureMounted` could otherwise read.
 * Two refs survive that swap on purpose: `trackWidthRef` remembers the track's own last-measured
 * width (refreshed live whenever it IS mounted, used only as a cheap pre-filter — see below — never
 * as the final answer), and `parentRef` holds the layout parent found once, at the FIRST mount — the
 * same DOM node hosts either form (`PanelChoice`/`ViewTabs` return one or the other as their sole
 * element, never a wrapper that differs between them), so it is never itself removed by the swap.
 * The `ResizeObserver` therefore never watches a node this hook is about to lose: it observes the
 * PARENT for the whole hook's lifetime and the TRACK only while it exists.
 *
 * While `Select` is showing, an observer tick with room to spare (`parent.clientWidth` at or past
 * the remembered `trackWidthRef`) SPECULATIVELY re-mounts the track rather than trying to predict
 * the exact threshold from a cached number — the two-signal check above cannot be run without a
 * live root, and a WRONG guess here is not user-visible: the second effect below re-verifies with
 * `measureMounted` the instant the fresh root exists, inside the SAME `useLayoutEffect` pass, and
 * reverts synchronously before paint if the speculation was wrong. Nothing here can loop — a
 * `ResizeObserver` only fires again on a GENUINE subsequent size change, not because React
 * re-rendered.
 *
 * A SECOND, dependency-free `useLayoutEffect` is what performs that verification (and, on the
 * ordinary growth-first-detected-while-mounted path, is also what re-arms the observer on the
 * track's own root once it exists) — the FIRST effect only runs once per `[countFits, dataKey]`,
 * but the track itself mounts and unmounts every time `fits` changes, and a `ResizeObserver` has to
 * be told about each new node explicitly; this second effect runs after every render and is a
 * no-op unless `rootRef.current` is a node it is not already watching.
 *
 * The check is THREE-VALUED, not two — `unknown` alongside `fits`/`overflow` — because a
 * `clientWidth` of `0` is not evidence of overflow, it is evidence the ancestor chain has not been
 * LAID OUT yet: the aside animates its width in from 0 while `PageAside` claims the region
 * (`docs/ASIDE-SPEC.md` §0), and every ancestor up to the aside panel itself reads `0` for one or
 * more layout passes while that transition is in flight. `unknown` updates nothing — it is simply
 * not yet an answer, and the observer keeps watching for the ancestor chain to settle.
 *
 * `useLayoutEffect` runs BEFORE the browser paints, so a CONFIDENT overflow reading is never
 * actually shown as a track first: the synchronous `setState` for it lands before paint, not after.
 *
 * `dataKey` is a caller-built string identifying the CURRENT option set (not read inside the effect
 * body, just what forces it to re-run — a fresh mount, a fresh `parentRef`/`trackWidthRef` — when
 * the rendered labels change) — primitive on purpose, so it is an honest `useLayoutEffect`
 * dependency rather than a fresh array reference on every render.
 */
export function useTrackFits(
  countFits: boolean,
  dataKey: string,
): { rootRef: RefObject<HTMLDivElement | null>; fits: boolean } {
  const rootRef = useRef<HTMLDivElement>(null)
  const [rootFits, setRootFits] = useState(true)
  const observerRef = useRef<ResizeObserver | null>(null)
  const parentRef = useRef<HTMLElement | null>(null)
  const trackWidthRef = useRef(0)
  const observedRootRef = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    if (!countFits) return
    const root = rootRef.current
    if (root === null) return
    const parent = layoutParent(root)
    if (parent === null) return
    parentRef.current = parent
    trackWidthRef.current = root.offsetWidth

    const resolve = (): void => {
      const p = parentRef.current
      if (p === null) return
      const liveRoot = rootRef.current

      if (liveRoot !== null) {
        const result = measureMounted(liveRoot, p)
        trackWidthRef.current = liveRoot.offsetWidth
        if (result === 'unknown') return
        const fits = result === 'fits'
        setRootFits((current) => (current === fits ? current : fits))
        return
      }

      // `Select` is mounted — speculate rather than measure (see this hook's own doc). No-op
      // while shrinking or unmeasured: only an actual increase past the last known track width is
      // worth a remount attempt.
      if (p.clientWidth === 0 || trackWidthRef.current === 0) return
      if (p.clientWidth >= trackWidthRef.current) setRootFits(true)
    }

    if (typeof ResizeObserver === 'undefined') {
      // No recovery path exists without an observer, so a same-tick confident read is the only
      // chance this environment gets.
      resolve()
      return
    }

    const observer = new ResizeObserver(resolve)
    observerRef.current = observer
    observer.observe(parent)
    observer.observe(root)
    observedRootRef.current = root

    // Resolve once, synchronously, so a track that is ALREADY confidently measurable (its
    // ancestors settled before this component even mounted — the common case) decides before
    // paint instead of waiting for the observer's first async tick.
    resolve()

    return () => {
      observer.disconnect()
      observerRef.current = null
      observedRootRef.current = null
    }
  }, [countFits, dataKey])

  // Re-arms the SAME observer on a fresh track root whenever one (re)mounts, AND is what actually
  // VERIFIES a speculative remount (see this hook's own doc) — a wrong guess reverts here,
  // synchronously, before this render ever paints. A no-op on every render where the track is
  // absent (`Select` showing) or already the node being watched — deliberately NO dependency
  // array, since a `ResizeObserver` has to be told about each fresh root explicitly and a fresh
  // root can appear on any render. Cannot loop: every `setRootFits` call below is a functional
  // update gated on the value actually CHANGING, so a render this effect does not alter never
  // re-triggers it.
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- deliberately runs every render, see above
  useLayoutEffect(() => {
    const observer = observerRef.current
    const root = rootRef.current
    const parent = parentRef.current
    if (observer === null || root === null || observedRootRef.current === root) return
    if (observedRootRef.current !== null) observer.unobserve(observedRootRef.current)
    observer.observe(root)
    observedRootRef.current = root
    trackWidthRef.current = root.offsetWidth

    if (parent === null) return
    const result = measureMounted(root, parent)
    if (result === 'unknown') return
    const fits = result === 'fits'
    setRootFits((current) => (current === fits ? current : fits))
  })

  return { rootRef, fits: countFits && rootFits }
}

/**
 * The single-choice control a panel row draws: a full-width track while the set fits both
 * {@link PANEL_TRACK_MAX} and the width check {@link useTrackFits} runs, a `Select` past either.
 *
 * Internal, and one component rather than the same ternary in each control: `EnumFilter` and
 * `ViewTabs` both wrote it out and had already drifted — `ViewTabs`' copy lost `data-numeric`, so a
 * numeric tab set rendered proportional in the aside and mono everywhere else. The split point is
 * the geometry of a ~300px column, which is a property of the ROW, not of any one filter, so it
 * belongs beside the row that imposes it.
 */
export function PanelChoice({
  nameProps,
  value,
  options,
  numeric,
  onChange,
}: PanelChoiceProps): ReactNode {
  const data = options.map((option) => ({
    value: option.value,
    label: option.label,
    disabled: option.disabled === true,
  }))
  const countFits = options.length <= PANEL_TRACK_MAX
  const { rootRef, fits } = useTrackFits(countFits, data.map((d) => d.value).join('|'))

  if (fits) {
    return (
      <SegmentedControl
        ref={rootRef}
        {...nameProps}
        fullWidth
        value={value}
        data={data}
        {...(numeric === true && { 'data-numeric': true })}
        onChange={onChange}
      />
    )
  }
  return (
    <Select
      {...nameProps}
      value={value}
      allowDeselect={false}
      data={data}
      onChange={(next) => {
        if (next !== null) onChange(next)
      }}
    />
  )
}
