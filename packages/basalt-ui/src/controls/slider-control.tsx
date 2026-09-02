/**
 * `SliderControl` — a `field.number` as an inspector row (`docs/ASIDE-SPEC.md` §1 "Inspector", G7).
 * Bound like every other control on this subpath: it takes `field`, never `value`/`onChange`/`size`
 * (C2/C5), and `min`/`max`/`step` come off the HANDLE rather than the call site, so the track's
 * grain is the field's own declaration and not a second copy of it.
 *
 * **It is a ROW on every surface, and that is deliberate.** Unlike the filters it has no pill form:
 * a chip whose label is a number, opening a popover holding a track, is two presses to change a
 * value the row states and edits in place. So it renders {@link PanelRow} regardless of
 * `useFilterSurface()`, and it is not a filter — it registers no `{ isActive, reset }` with a
 * `FilterSet`, never counts toward `Filters (n)`, and never answers `Reset all`. Its home is an
 * aside body or a section body, not a bar row.
 *
 * **The write lands on drag END, not on every frame.** A slider emits a value per pointer move; on
 * the URL lane that is one navigation per pixel. The draft is local while dragging and commits
 * once — the same law `NumberFilter`'s stepper states for keystrokes.
 *
 * @example
 * // piCycle: field.number({ fallback: 1, min: 0, max: 2, step: 0.05 })
 * <SliderControl
 *   field={weights.field.piCycle}
 *   label="Pi Cycle Top"
 *   hint="The 111DMA / 350DMA×2 crossover."
 *   format={(v) => `${v.toFixed(2)}×`}
 * />
 *
 * @example
 * // A COMPOSITION row: the readout states the metric's own reading beside the weight, and the
 * // switch that governs the row rides the label line — neither is the field's value, so both are
 * // overrides rather than a `format`.
 * <SliderControl
 *   field={weights.field.piCycle}
 *   label="Pi Cycle Top"
 *   readout="0.35 · ×1.00"
 *   end={<Switch checked={on} onChange={toggle} aria-label="Include Pi Cycle Top" />}
 *   disabled={!on}
 * />
 */
import { Slider } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { BasaltProps } from '../common/props'
import { assertRequiredProps } from '../common/validate'
import type { FieldHandle, NumberField } from '../state'
import { PanelRow } from './panel-row'

export type SliderControlProps = BasaltProps & {
  readonly field: FieldHandle<NumberField>
  /** The row's label, and the thumb's accessible name. */
  readonly label: string
  /** Info glyph + tooltip beside the label — see {@link PanelRow}. */
  readonly hint?: string
  /**
   * The mono readout on the label line. The raw number when omitted, so a unit, a precision or a
   * ratio is one function rather than a second row.
   *
   * @default String(v)
   */
  readonly format?: (v: number) => string
  /**
   * Replaces the formatted value in the row's readout slot.
   *
   * `format` prints the FIELD; this prints whatever the row is actually about. The composition row
   * that motivated it states a metric's reading beside its weight — `0.35 · ×1.00` — which is one
   * mono string over two numbers, only one of which this control owns. Prefer `format` whenever the
   * readout is the field's own value. A FUNCTION form receives the live drag value, so a composed
   * readout tracks the thumb per frame instead of updating on drag end.
   */
  readonly readout?: ReactNode | ((value: number) => ReactNode)
  /**
   * A control riding the LABEL line, forwarded to {@link PanelRow.end} — a `Switch` and, by design,
   * almost nothing else. The composition row's use case is enabling the metric the slider weights:
   * the toggle governs the row, so it cannot live inside the track it disables.
   */
  readonly end?: ReactNode
  readonly disabled?: boolean
}

export function SliderControl(props: SliderControlProps): ReactNode {
  // F-ERR-1 — without this a missing `field` surfaces as `undefined is not an object
  // (evaluating 'field.use')`, caught by `BasaltErrorBoundary`.
  assertRequiredProps('SliderControl', props, ['field'], {
    field: 'bind it to a store field (`store.field.<name>`), never a value/onChange pair.',
  })
  const { field, label, hint, format, readout, end, disabled, className, style } = props
  const [value, setValue] = field.use()
  const draft = useDraggedNumber(value, setValue)

  return (
    <PanelRow
      label={label}
      readout={
        typeof readout === 'function'
          ? readout(draft.value)
          : (readout ?? (format ?? String)(draft.value))
      }
      {...(hint !== undefined && { hint })}
      {...(end !== undefined && { end })}
      {...(disabled === true && { disabled: true })}
      {...(className !== undefined && { className })}
      {...(style !== undefined && { style })}
    >
      <Slider
        // The tier, stated by the control the way every control on this subpath does
        // (`docs/CONTROLS-SPEC.md` §3) — `Slider` is deliberately absent from `CTL_THEME`, see
        // `theme/ctl-theme.tsx`'s note, so the row's slot cannot supply it.
        size="ctl"
        // The drag tooltip is off: the row already prints the value, in mono, in a fixed place —
        // a bubble that follows the thumb states the same number twice and jumps while reading.
        label={null}
        thumbLabel={label}
        // The FIELD's declaration, straight off the handle. An undeclared bound leaves Mantine's own
        // default (0..100) rather than passing `undefined` through as a bound.
        {...(field.min !== undefined && { min: field.min })}
        {...(field.max !== undefined && { max: field.max })}
        {...(field.step !== undefined && { step: field.step })}
        {...(disabled === true && { disabled: true })}
        value={draft.value}
        onChange={draft.set}
        onChangeEnd={draft.commit}
      />
    </PanelRow>
  )
}

/**
 * A local draft that follows the thumb and lands on the field once, on `onChangeEnd` — plus the
 * usual outside-change backstop (`Reset all`, a deep link, a back navigation, the codec's clamp).
 *
 * `seen` is what separates the two directions, exactly as in `SearchFilter`'s debounce and
 * `NumberFilter`'s commit: it holds the last value this hook itself committed, so an incoming change
 * it did not cause is the only thing that overwrites the draft mid-drag.
 */
function useDraggedNumber(
  value: number,
  setValue: (next: number) => void,
): { value: number; set: (next: number) => void; commit: (next: number) => void } {
  const [draft, setDraft] = useState(value)
  const seen = useRef(value)
  const commitRef = useRef(setValue)
  commitRef.current = setValue

  useEffect(() => {
    if (seen.current === value) return
    seen.current = value
    setDraft(value)
  }, [value])

  return {
    value: draft,
    set: setDraft,
    commit: (next) => {
      setDraft(next)
      if (next === value) return
      seen.current = next
      commitRef.current(next)
    },
  }
}
