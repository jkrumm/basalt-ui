/**
 * The mobile `Filters (n)` sheet and the two row primitives every control's sheet form composes
 * (`docs/CONTROLS-SPEC.md` §2.1/§3). A bottom `Drawer`: every child of the `FilterSet` renders its
 * full-width sheet form, edits APPLY IMMEDIATELY (there is no Apply button — the URL is the truth
 * and a filter write is already `history: 'replace'`), and one `Reset all` footer clears every
 * registered filter.
 *
 * 44px rows are the one sheet dimension C15 pins, so they come from
 * `--vx-space-sheet-row-height` — the density-tracking token, not a literal.
 *
 * INTERNAL, like `FilterPill`: `FilterSet` owns when the sheet opens, so a consumer mounting it by
 * hand would own a second, unregistered filter home (C1).
 */
import { Button, Drawer } from '@mantine/core'
import { useId } from 'react'
import type { ReactNode } from 'react'
import classes from './controls.module.css'

export type FilterSheetProps = {
  readonly opened: boolean
  readonly onClose: () => void
  /**
   * Clears every registered filter. OMITTED on a sheet with no census behind it — the aside's
   * mobile projection (`docs/ASIDE-SPEC.md` §0) mounts its children under a `null` registry, so
   * there is nothing to reset and a button that resets nothing is worse than no button.
   */
  readonly onResetAll?: () => void
  readonly title?: string
  readonly children: ReactNode
}

/**
 * `Reset all` rides the HEADER, beside the title and the close ×, not a footer.
 *
 * A bottom drawer's footer is the one region a phone cannot promise is on screen: the sheet grows
 * with its content, so with six filters open the reset button sat below the fold and the only way to
 * reach it was to scroll past every row it would have undone. The header is fixed by construction.
 * It also removes the sheet's last horizontal rule — a footer needs separating from the rows above
 * it, a header does not (`docs/CONTROLS-SPEC.md` §2.1: hairlines between OPTION rows only).
 */
export function FilterSheet({
  opened,
  onClose,
  onResetAll,
  title = 'Filters',
  children,
}: FilterSheetProps): ReactNode {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="bottom"
      radius="sm"
      classNames={{ header: classes.sheetHeader, title: classes.sheetTitle }}
      title={
        <>
          <span className={classes.sheetTitleText}>{title}</span>
          {onResetAll !== undefined && (
            <Button variant="subtle" size="ctl" onClick={onResetAll}>
              Reset all
            </Button>
          )}
        </>
      }
    >
      <div className={classes.sheetBody}>{children}</div>
    </Drawer>
  )
}

/**
 * The selected-row mark — 16px, drawn at the row's trailing edge (`docs/CONTROLS-SPEC.md` §2.1).
 * Exported from the MODULE, not from `./index.ts`: the panel surface's facet list draws the same
 * mark at the same edge, and two hand-drawn checks would drift.
 */
export function CheckGlyph(): ReactNode {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12.5l5 5l9 -11" />
    </svg>
  )
}

/** One row of a {@link SheetOptionList}. */
export type SheetOption = {
  readonly value: string
  readonly label: string
  readonly disabled?: boolean
}

export type SheetOptionListProps = {
  /** `single` renders radio semantics, `multi` checkbox semantics. */
  readonly mode: 'single' | 'multi'
  /** The selected value(s) — a one-element array in `single` mode. */
  readonly selected: readonly string[]
  readonly options: readonly SheetOption[]
  readonly onToggle: (value: string) => void
  /** The `SheetField` heading this list is named by. */
  readonly labelId: string
}

/**
 * The sheet's ONE list form (`docs/CONTROLS-SPEC.md` §2.1): every option is a 44px full-width row,
 * label left, a check at the trailing edge when selected, a 1px hairline between rows and nowhere
 * else.
 *
 * **It replaced a `SegmentedControl` and a Mantine `Radio` list, for two different reasons.** The
 * range presets rendered as a `orientation="vertical"` SegmentedControl, which in a full-width sheet
 * is a stack of left-aligned labels inside a tinted track — it read as a broken control, not as a
 * choice, and it carried the track's own inset so it aligned with nothing else in the sheet. The
 * enum/multi filters rendered Mantine `Radio`/`Checkbox` rows, which put a 20px dot or box in the
 * leading position of every row; at six filters the sheet was a column of controls rather than a
 * column of options, and the leading marks pushed every label off the sheet's own text column.
 *
 * The semantics are a real native `<input>` inside the row's `<label>`, visually hidden — not
 * `role="radio"` on a div. A hidden native input keeps the arrow-key group behaviour, the
 * form-association and the announced state for free, and `<label>` wrapping it makes the whole 44px
 * box the hit target (C15) without a single `onClick` on a non-interactive element.
 */
export function SheetOptionList({
  mode,
  selected,
  options,
  onToggle,
  labelId,
}: SheetOptionListProps): ReactNode {
  // ONE name per rendered list, so a sheet holding two range filters keeps two radio groups.
  const name = useId()
  return (
    // A real `<fieldset>`, not `role="group"` on a div — the native element carries the grouping
    // semantics and gets its own box reset in the module (`.sheetList`). `aria-labelledby` points at
    // the `SheetField` heading rather than a `<legend>`: the heading is already visible above the
    // list, and a legend would render it a second time.
    <fieldset className={classes.sheetList} aria-labelledby={labelId}>
      {options.map((option) => {
        const isSelected = selected.includes(option.value)
        return (
          <label
            key={option.value}
            className={classes.sheetOption}
            {...(isSelected && { 'data-selected': true })}
            {...(option.disabled === true && { 'data-disabled': true })}
          >
            {/* theme-allow raw-form-control — the input is NEVER PAINTED. It is visually hidden
                (`.sheetOptionInput`) and exists only to carry the row's semantics: the checked state,
                the radio-group arrow keys, the announced name. The surface the reader sees and taps
                is the `<label>` around it, which the theme's tokens style directly. A Mantine
                `Radio` here would paint the 20px indicator this row form exists to remove — see
                `SheetOptionList`'s doc. */}
            <input
              className={classes.sheetOptionInput}
              type={mode === 'single' ? 'radio' : 'checkbox'}
              name={name}
              value={option.value}
              checked={isSelected}
              disabled={option.disabled === true}
              aria-label={option.label}
              onChange={() => {
                onToggle(option.value)
              }}
            />
            <span className={classes.sheetOptionLabel}>{option.label}</span>
            {isSelected && (
              <span className={classes.sheetOptionCheck} aria-hidden>
                <CheckGlyph />
              </span>
            )}
          </label>
        )
      })}
    </fieldset>
  )
}

export type SheetDisclosureProps = {
  readonly label: string
  readonly expanded: boolean
  readonly onToggle: () => void
  readonly children: ReactNode
}

/**
 * A 44px row that expands its own body inline — the sheet's answer to a control too large to sit in
 * the list unconditionally (`RangeFilter`'s custom date picker, which is a whole calendar). Same row
 * geometry as a {@link SheetOptionList} option, so the disclosure reads as the list's last entry
 * rather than as a different kind of thing.
 */
export function SheetDisclosure({
  label,
  expanded,
  onToggle,
  children,
}: SheetDisclosureProps): ReactNode {
  return (
    <div className={classes.sheetList}>
      <button
        type="button"
        className={classes.sheetOption}
        aria-expanded={expanded}
        {...(expanded && { 'data-selected': true })}
        onClick={onToggle}
      >
        <span className={classes.sheetOptionLabel}>{label}</span>
        {expanded && (
          <span className={classes.sheetOptionCheck} aria-hidden>
            <CheckGlyph />
          </span>
        )}
      </button>
      {expanded && <div className={classes.sheetDisclosureBody}>{children}</div>}
    </div>
  )
}

export type SheetFieldProps = {
  readonly label: string
  /** Stamped on the heading so a control can point `aria-labelledby` at it — see `useControlName`. */
  readonly labelId?: string
  readonly children: ReactNode
}

/** A labelled block inside the sheet — the sheet form's outer shell for every control. */
export function SheetField({ label, labelId, children }: SheetFieldProps): ReactNode {
  return (
    <div className={classes.sheetField}>
      <span className={classes.sheetLabel} {...(labelId !== undefined && { id: labelId })}>
        {label}
      </span>
      {children}
    </div>
  )
}

/**
 * Names a control that has no VISIBLE Mantine `label`, and does it differently per surface — which
 * is the whole reason this is one helper instead of an `aria-label` sprinkled per call site.
 *
 * In the SHEET the visible `SheetField` heading is right there, so the control points at it
 * (`aria-labelledby`) and the heading stops being decoration. In the PILL surface there is no
 * visible name to point at — the pill text is the VALUE (`EUR`, `30d`, `3 channels`) — so the
 * control carries the filter's own name instead. Either way the announced name is what is being
 * filtered, not what it currently holds.
 *
 * The id is generated by the CONTROL, not by `SheetField`, because the control renders its own
 * `SheetField`: an id published downward through context could never reach the sibling that needs it.
 *
 * @example
 * const { labelId, nameProps } = useControlName(label, inSheet)
 * <Radio.Group {...nameProps} …/>
 * // and, in the sheet branch: <SheetField label={label} labelId={labelId}>…</SheetField>
 */
export function useControlName(
  label: string,
  inSheet: boolean,
): {
  labelId: string
  nameProps: { 'aria-labelledby': string } | { 'aria-label': string }
} {
  const labelId = useId()
  return {
    labelId,
    nameProps: inSheet ? { 'aria-labelledby': labelId } : { 'aria-label': label },
  }
}

export type SheetRowProps = {
  readonly children: ReactNode
}

/** One 44px full-width row (`--vx-space-sheet-row-height`). */
export function SheetRow({ children }: SheetRowProps): ReactNode {
  return <div className={classes.sheetRow}>{children}</div>
}

/** The class every sheet-form list item shares, for controls that render their own row element. */
export const sheetRowClass = classes.sheetRow

/**
 * `classNames` for a Radio/Checkbox/Switch rendered as a sheet row — stretches its `body` and
 * `<label>` across the full 44px so the whole row is the touch target, not the middle 20px of it.
 */
export const sheetRowClassNames = {
  root: classes.sheetRow,
  body: classes.sheetRowBody,
  label: classes.sheetRowLabel,
} as const
