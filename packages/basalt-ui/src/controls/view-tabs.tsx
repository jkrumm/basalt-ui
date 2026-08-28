/**
 * `ViewTabs` — the page's or section's view switch (`docs/CONTROLS-SPEC.md` §3). A tab is store
 * state like any filter (C3): it takes `field`, never `value`/`onChange`, so a deep link and a back
 * navigation land on the same tab the user left.
 *
 * The responsive swap lives HERE, not at the call site (C9), and it is CSS — `visibleFrom` /
 * `hiddenFrom`, one mount each, never a JS media query (which renders differently on the server than
 * on the first client paint). Below `sm` a set of three or fewer stays a full-width
 * `SegmentedControl`; past that a track cannot hold readable labels on a phone, so it becomes a
 * `Select`.
 *
 * `only` is how a tab that exists on ONE viewport is declared instead of hand-rolling a second
 * control: `'sm-up'` keeps it off the phone form, `'sm-down'` keeps it off the desktop form.
 *
 * Inside a `PageAside` it renders as a panel ROW — label above, a full-width track or a `Select`
 * (`docs/ASIDE-SPEC.md` §3). A view switch in a panel is legal; the page bar's tab slot stays its
 * default home, and `only` has no meaning there (the panel is one width).
 *
 * @example
 * <ViewTabs
 *   field={strength.field.tab}
 *   options={[
 *     { value: 'overview', label: 'Overview' },
 *     { value: 'history', label: 'History' },
 *     { value: 'train', label: 'Train', only: 'sm-down' },
 *   ]}
 * />
 */
import { SegmentedControl, Select } from '@mantine/core'
import type { ReactNode } from 'react'
import type { EnumField, FieldHandle } from '../state'
import classes from './controls.module.css'
import { useFilterSurface } from './filter-context'
import { useControlName } from './filter-sheet'
import { PanelChoice, PanelRow } from './panel-row'

/** Past three options the phone form is a `Select`, not a track. */
const PHONE_TRACK_MAX = 3

export type ViewTabsOption<T extends string> = {
  readonly value: T
  readonly label: string
  /** Render this option on ONE viewport only. Omitted → both. */
  readonly only?: 'sm-up' | 'sm-down'
}

export type ViewTabsProps<T extends string> = {
  readonly field: FieldHandle<EnumField<T>>
  /** Defaults to `field.options` (every declared value, labelled by `store.labels()`). */
  readonly options?: readonly ViewTabsOption<T>[]
  /**
   * The switch's accessible name. Both forms render without a visible Mantine `label` (a home has
   * no room for one), so without this the desktop track is an unnamed `radiogroup` and the phone
   * form an unnamed `combobox`.
   *
   * @default 'View'
   */
  readonly label?: string
}

export function ViewTabs<T extends string>({
  field,
  options,
  label = 'View',
}: ViewTabsProps<T>): ReactNode {
  const [value, setValue] = field.use()
  const surface = useFilterSurface()
  const inPanel = surface === 'panel'
  const { labelId, nameProps } = useControlName(label, inPanel)
  const all: readonly ViewTabsOption<T>[] =
    options ?? field.options.map((option) => ({ value: option.value as T, label: option.label }))

  const desktop = all.filter((option) => option.only !== 'sm-down')
  const phone = all.filter((option) => option.only !== 'sm-up')
  // The segments/items are rendered from the option list, so `next` is always a declared value —
  // the cast restores what the codec already guarantees.
  const commit = (next: string): void => {
    setValue(next as T)
  }

  // The panel form. `only` is dropped on purpose: it exists to declare a tab that belongs to ONE
  // viewport, and a panel is not a viewport — every declared option is offered.
  if (inPanel) {
    return (
      <PanelRow label={label} labelId={labelId}>
        <PanelChoice nameProps={nameProps} value={value} options={all} onChange={commit} />
      </PanelRow>
    )
  }

  return (
    <>
      <SegmentedControl
        aria-label={label}
        visibleFrom="sm"
        size="ctl"
        value={value}
        data={desktop.map((option) => ({ value: option.value, label: option.label }))}
        onChange={commit}
      />
      {phone.length <= PHONE_TRACK_MAX ? (
        <SegmentedControl
          aria-label={label}
          hiddenFrom="sm"
          size="ctl"
          fullWidth
          value={value}
          data={phone.map((option) => ({ value: option.value, label: option.label }))}
          onChange={commit}
        />
      ) : (
        <Select
          aria-label={label}
          hiddenFrom="sm"
          size="ctl"
          // BOUNDED, not greedy — see `.phoneSelect`'s comment in `controls.module.css`. This is the
          // control owning its own responsive form (law C9), which is also why it is not a `w` prop
          // at the call site (C5, `basalt/control-size-literal`).
          className={classes.phoneSelect}
          value={value}
          allowDeselect={false}
          data={phone.map((option) => ({ value: option.value, label: option.label }))}
          onChange={(next) => {
            if (next !== null) commit(next)
          }}
        />
      )}
    </>
  )
}
