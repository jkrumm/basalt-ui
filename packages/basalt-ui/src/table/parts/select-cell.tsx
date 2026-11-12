/**
 * The cell editor of `c.select` (docs/v3/concepts/data-table.md section 3, Inline edit): the one
 * control the framework renders inside a cell. The value comes from the row; `commit(row, next)` is
 * the app's mutation, which owns the optimistic value and the rollback, so the cell keeps no store
 * and is only disabled while the promise is pending. `ui/select` up to 8 options, `ui/combobox`
 * above.
 *
 * Law (I10): Enter and a tap in the control never activate the row. The row keyboard already
 * ignores keys and clicks from a nested control; the wrapper also stops the portalled popup's
 * clicks, which React bubbles through the tree to the row. The control is a tab stop only in the
 * focused row of a table whose rows rove.
 */
import { useState } from 'react'
import type { ReactElement, SyntheticEvent } from 'react'
import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem } from '../../ui/combobox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import type { SelectEdit } from '../core/kinds-spec'

/** Above this many options the cell searches (`ui/combobox`). */
export const SELECT_MAX_OPTIONS = 8

export type SelectCellProps<T> = {
  row: T
  /** The row's current value. */
  value: string
  edit: SelectEdit<T>
  /** `false` takes the control out of the tab order (a row that is not the roving stop). */
  tabbable: boolean
}

const stop = (event: SyntheticEvent): void => event.stopPropagation()

/**
 * Runs a commit and waits for it either way, a synchronous throw included: the app's mutation
 * reports its own failure, the cell only needs to be usable again.
 */
async function settle(run: () => unknown): Promise<void> {
  try {
    await run()
  } catch {
    // Reported by the mutation that rejected (its `onError`, its toast); the cell only re-enables.
  }
}

/**
 * One row's `c.select` control.
 *
 * @useWhen the table renders a `c.select` column (the body does this; apps never mount it)
 * @neverWhen editing several fields of a row (use `detail` and a form)
 *
 * @example
 * <SelectCell row={booking} value={booking.category} edit={spec.edit} tabbable />
 */
export function SelectCell<T>({ row, value, edit, tabbable }: SelectCellProps<T>): ReactElement {
  const [pending, setPending] = useState(false)
  const label = edit.label(row)

  const commit = (next: string | null): void => {
    if (next === null || next === value) return
    setPending(true)
    void settle(() => edit.commit(row, next)).then(() => setPending(false))
  }

  const tabIndex = tabbable ? undefined : -1
  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- stops propagation only; the control inside carries the interaction
    <span
      data-slot="table-select-cell"
      data-pending={pending ? '' : undefined}
      aria-busy={pending || undefined}
      className="block min-w-0"
      onClick={stop}
      onKeyDown={stop}
    >
      {edit.options.length > SELECT_MAX_OPTIONS ? (
        <Combobox items={edit.options} value={value} onValueChange={commit} disabled={pending}>
          <ComboboxInput aria-label={label} size="sm" tabIndex={tabIndex} />
          <ComboboxContent>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxContent>
        </Combobox>
      ) : (
        // theme-allow raw-selection-control — the `c.select` cell editor: the row is its state and `commit` the app mutation (concept section 3, Inline edit)
        <Select
          items={edit.options.map((o) => ({ value: o, label: o }))}
          value={value}
          onValueChange={commit}
          disabled={pending}
        >
          <SelectTrigger aria-label={label} size="sm" tabIndex={tabIndex}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {edit.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </span>
  )
}
