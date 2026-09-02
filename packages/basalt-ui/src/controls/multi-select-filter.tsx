/**
 * `MultiSelectFilter` — an any-of set over one closed enum (`docs/CONTROLS-SPEC.md` §3).
 *
 * The pill reads the filter's name while the selection carries no information — empty (no
 * constraint) or every option (the same thing said the long way) — and switches to a count once it
 * does: `All channels` → `3 channels`. `noun` is the plural read in that count and defaults to the
 * label lowercased, so `label="Channels"` needs no second prop.
 *
 * @example
 * <MultiSelectFilter field={analytics.field.channels} label="All channels" noun="channels" />
 *
 * @example
 * // A runtime catalogue over the same closed field — live labels, same values.
 * <MultiSelectFilter
 *   field={analytics.field.channels}
 *   label="All channels"
 *   options={CHANNELS.map((c) => ({ value: c, label: `${c} · ${counts[c]}` }))}
 * />
 *
 * @example
 * // The aside's facet column (`docs/ASIDE-SPEC.md` §1): counts and their bars are DATA, so they
 * // arrive as a map rather than baked into the labels the way the runtime catalogue does it.
 * <MultiSelectFilter field={shipments.field.origin} label="Origin" counts={countsByOrigin} />
 */
import { Button, Checkbox, Stack } from '@mantine/core'
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { BasaltProps } from '../common/props'
import { assertRequiredProps } from '../common/validate'
import type { FieldHandle, MultiField } from '../state'
import type { FilterOption } from './select-filter'
import classes from './controls.module.css'
import { useFilterRegistration, useFilterSurface } from './filter-context'
import { FilterPill } from './filter-pill'
import { CheckGlyph, useControlName } from './filter-sheet'
import { PanelRow } from './panel-row'

/** How many facet rows a panel shows before the rest fold behind `Show N more`. Six is the point at
 *  which a facet column stops being a list you scan and starts being one you scroll. */
const PANEL_FACET_MAX = 6

export type MultiSelectFilterProps<T extends string> = BasaltProps & {
  readonly field: FieldHandle<MultiField<T>>
  readonly label: string
  readonly icon?: ReactNode
  /**
   * The plural noun in the `3 channels` count.
   *
   * @default the label, lowercased
   */
  readonly noun?: string
  /**
   * Overrides `field.options` at render — a runtime catalogue whose labels carry live data
   * (`web · 1.2k`). The VALUES still belong to the field: a multi field is a closed set, so this
   * relabels and reorders rows, it does not open new ones. Unlike `SelectFilter` there is no
   * string-field shape to make it required.
   */
  readonly options?: readonly FilterOption[]
  /**
   * Per-option counts, rendered on the `panel` surface as a mono number plus a bar proportional to
   * the LARGEST count in the map — the Foundry facet column (`docs/ASIDE-SPEC.md` §1). A missing
   * key is a row with no count and no bar, not a zero.
   *
   * Ignored on the pill and sheet surfaces, where there is no room for a second data channel: put
   * the number in the label there (`options`).
   */
  readonly counts?: Record<string, number>
  /**
   * How many facet rows the `panel` surface shows before the rest fold behind a `Show N more` row.
   *
   * @default 6
   */
  readonly max?: number
}

export function MultiSelectFilter<T extends string>(props: MultiSelectFilterProps<T>): ReactNode {
  // F-ERR-1 — without this a missing `field` surfaces as `undefined is not an object
  // (evaluating 'field.use')`, caught by `BasaltErrorBoundary`.
  assertRequiredProps('MultiSelectFilter', props, ['field'], {
    field: 'bind it to a store field (`store.field.<name>`), never a value/onChange pair.',
  })
  const { field, label, icon, noun, counts, max, options: optionsProp, className, style } = props
  const [value, setValue] = field.use()
  const surface = useFilterSurface()
  const isDefault = field.isDefault(value)
  useFilterRegistration(!isDefault, () => {
    field.clear()
  })

  // The prop wins whole, never merged — same rule as `EnumFilter`: a catalogue that dropped a row
  // must be able to drop it, and `All channels` is counted against the rows actually shown.
  const options: readonly FilterOption[] = optionsProp ?? field.options
  const inSheet = surface === 'sheet'
  const inPanel = surface === 'panel'
  const carriesInformation = value.length > 0 && value.length < options.length
  const { labelId } = useControlName(label, inSheet || inPanel)

  // One toggle, shared by both list forms — the rows are rendered from `options`, whose values
  // belong to the field either way (the prop relabels a closed set, it cannot open it), so the cast
  // restores what the codec already guarantees.
  const toggle = (next: string): void => {
    const has = value.includes(next as T)
    setValue(has ? value.filter((v) => v !== next) : [...value, next as T])
  }

  // The SHEET form is the PANEL form — the facet column (`docs/CONTROLS-SPEC.md` §3: "sheet = panel
  // rows inside a Drawer"). It used to render a `SheetOptionList` in `multi` mode (44px rows, a
  // trailing check, no fold), which meant a set with many options was a sheet as tall as the set;
  // the facet column folds past `max` behind `Show N more` instead, which is the shape a set of
  // unknown size actually needs.
  if (inSheet || inPanel) {
    return (
      <PanelRow
        label={label}
        labelId={labelId}
        {...(className !== undefined && { className })}
        {...(style !== undefined && { style })}
      >
        <FacetList
          labelId={labelId}
          options={options}
          selected={value}
          max={max ?? PANEL_FACET_MAX}
          onToggle={toggle}
          {...(counts !== undefined && { counts })}
        />
      </PanelRow>
    )
  }

  const body = (
    // Mantine's own `label`, for the same reason `enum-filter.tsx` uses it — `Checkbox.Group`
    // overwrites any `aria-label`/`aria-labelledby` with its own. Named from `label`, never from the
    // pill text, which reads `3 channels` and describes the selection rather than the filter.
    <Checkbox.Group
      label={label}
      classNames={{ label: classes.groupLabel }}
      value={[...value]}
      onChange={(next) => {
        // The boxes are rendered from `options`, whose values belong to the field either way (the
        // prop relabels a closed set, it cannot open it) — the cast restores what the codec
        // already guarantees.
        setValue(next as readonly T[])
      }}
    >
      <Stack gap={2}>
        {options.map((option) => (
          <Checkbox
            key={option.value}
            value={option.value}
            label={option.label}
            {...(option.disabled === true && { disabled: true })}
          />
        ))}
      </Stack>
      {!isDefault && (
        <Button
          variant="subtle"
          size="ctl"
          onClick={() => {
            field.clear()
          }}
        >
          Clear
        </Button>
      )}
    </Checkbox.Group>
  )

  return (
    <FilterPill
      label={carriesInformation ? `${value.length} ${noun ?? label.toLowerCase()}` : label}
      active={!isDefault}
      {...(icon !== undefined && { icon })}
      {...(className !== undefined && { className })}
      {...(style !== undefined && { style })}
    >
      <div className={classes.optionList}>{body}</div>
    </FilterPill>
  )
}

type FacetListProps = {
  readonly labelId: string
  readonly options: readonly FilterOption[]
  readonly selected: readonly string[]
  readonly counts?: Record<string, number>
  /** Rows shown before the rest fold behind `Show N more`. */
  readonly max: number
  readonly onToggle: (value: string) => void
}

/**
 * The facet column's rows. INTERNAL to this control: a list of counted checkboxes not bound to a
 * `field.multi` is a hand-rolled filter (`basalt/hand-rolled-filter`), so there is no separate
 * `FacetList` export to reach for — the counts are a prop on the control that already owns the set.
 *
 * The bar is scaled against the LARGEST count present, not against a total: a facet column is read
 * as a comparison between its own rows, and dividing by a total nobody supplied would render every
 * bar as a sliver on a set with many options.
 */
function FacetList({
  labelId,
  options,
  selected,
  counts,
  max,
  onToggle,
}: FacetListProps): ReactNode {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? options : options.slice(0, max)
  const hidden = options.length - shown.length
  // `0` as the seed, so an empty map (or one whose keys miss every option) yields a peak of 0 rather
  // than `-Infinity`, and every bar resolves to a width of 0 instead of `NaN%`.
  const peak = options.reduce((top, option) => Math.max(top, counts?.[option.value] ?? 0), 0)

  return (
    // A real `<fieldset>` named by the row's own label — the native element carries the grouping
    // semantics, and the heading is already visible.
    <fieldset className={classes.facetList} aria-labelledby={labelId}>
      {shown.map((option) => {
        const isSelected = selected.includes(option.value)
        const count = counts?.[option.value]
        return (
          <label
            key={option.value}
            className={classes.facetOption}
            {...(isSelected && { 'data-selected': true })}
            {...(option.disabled === true && { 'data-disabled': true })}
          >
            {/* theme-allow raw-form-control — the input is NEVER PAINTED. Visually hidden
                (`.facetInput`), it exists only to carry the row's semantics; the surface the reader
                sees and clicks is the `<label>` around it. */}
            <input
              className={classes.facetInput}
              type="checkbox"
              value={option.value}
              checked={isSelected}
              disabled={option.disabled === true}
              aria-label={option.label}
              onChange={() => {
                onToggle(option.value)
              }}
            />
            {count === undefined ? (
              // No count/bar on this row — without a visible box, an unselected row was plain
              // text with no affordance that it toggles at all (only a checkmark appeared, and
              // only once selected). `size="ctl"` reads `--checkbox-size-ctl`
              // (`theme/index.ts`'s `ctlSizeVars`), the same var every other home's `Checkbox`
              // resolves through. Decorative — the real toggle semantics live on `.facetInput`.
              <Checkbox.Indicator
                className={classes.facetCheckbox}
                size="ctl"
                checked={isSelected}
                aria-hidden
                {...(option.disabled === true && { disabled: true })}
              />
            ) : (
              peak > 0 && (
                <span
                  className={classes.facetBar}
                  aria-hidden
                  style={{ '--facet-fill': `${(count / peak) * 100}%` } as CSSProperties}
                />
              )
            )}
            <span className={classes.facetLabel}>{option.label}</span>
            {count !== undefined && <span className={classes.facetCount}>{count}</span>}
            {count !== undefined && isSelected && (
              <span className={classes.facetCheck} aria-hidden>
                <CheckGlyph />
              </span>
            )}
          </label>
        )
      })}
      {hidden > 0 && (
        <button
          type="button"
          className={classes.facetMore}
          onClick={() => {
            setExpanded(true)
          }}
        >
          {`Show ${hidden} more`}
        </button>
      )}
    </fieldset>
  )
}
