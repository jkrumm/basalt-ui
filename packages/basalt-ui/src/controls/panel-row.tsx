/**
 * `PanelRow` — the inspector/facet ROW every control renders on the `panel` surface
 * (`docs/ASIDE-SPEC.md` §1 "Inspector", §3). The aside's answer to `SheetField`: same job (a labelled
 * block around one control), different geometry, and it is a HOME — it wraps its slots in `CtlSlot`,
 * so a control inside carries no `size` of its own (law C5).
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
import type { ReactNode } from 'react'
import { CtlSlot } from '../theme'
import { InfoGlyph } from '../widget-header/widget-header'
import classes from './panel-row.module.css'

/**
 * Past three options a panel row's choice is a `Select`, not a track. Same arithmetic as
 * `ViewTabs`' phone form, against the aside's ~300px rather than a phone's: a four-segment track at
 * that width gives each label ~60px, which truncates every word longer than "Previous".
 */
export const PANEL_TRACK_MAX = 3

export type PanelRowProps = {
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
   * Stamped on the label so the control can point `aria-labelledby` at it — the same seam
   * `SheetField.labelId` carries, and for the same reason: the CONTROL owns the id (it renders this
   * row), so an id published downward could never reach it.
   */
  readonly labelId?: string
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
  children,
}: PanelRowProps): ReactNode {
  return (
    <div className={classes.row} {...(disabled === true && { 'data-disabled': true })}>
      {/* ONE slot for the whole row, not one per line: `CtlSlot`'s marker is `display: contents`,
          so both lines stay flex children of `.row` and the tier reaches `end` and `children`
          through a single provider. */}
      <CtlSlot>
        <div className={classes.head}>
          <span className={classes.label} {...(labelId !== undefined && { id: labelId })}>
            {label}
          </span>
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
 * The single-choice control a panel row draws: a full-width track while the set fits
 * ({@link PANEL_TRACK_MAX}), a `Select` past that.
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
  if (options.length <= PANEL_TRACK_MAX) {
    return (
      <SegmentedControl
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
