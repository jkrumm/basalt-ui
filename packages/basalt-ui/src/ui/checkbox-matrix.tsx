import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import { cva } from 'class-variance-authority'
import { useId, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent, ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { base as baseMessages } from '../core/messages/base'
import { useMessages } from '../core/messages/use-messages'
import { checkboxVariants } from './checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table'

/**
 * The `CheckboxMatrix` cva table: the frame around the table, on the card hairline. The table scrolls
 * sideways inside it when the columns outgrow the box, so a phone keeps every column readable.
 *
 * @example
 * checkboxMatrixVariants() // class string for a hand-built frame
 */
export const checkboxMatrixVariants = cva(
  'max-w-full overflow-x-auto rounded-card border border-border bg-background',
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const checkboxMatrixParts = ['checkbox-matrix'] as const

/** One row of the matrix: what the cells of that row grant. */
export type MatrixRow = {
  id: string
  label: ReactNode
  /** A line of help under the label. */
  description?: ReactNode
  /** Disables every cell of the row. */
  disabled?: boolean
  /** Plain text for the row's "all" toggle name when `label` is not a string. */
  name?: string
}

/** One column of the matrix: who or what the cells grant to. */
export type MatrixColumn = {
  id: string
  label: ReactNode
  /** Disables every cell of the column. */
  disabled?: boolean
  /** Plain text for the column's "all" toggle name when `label` is not a string. */
  name?: string
}

/** `disabled`: cannot change, drawn faded. `locked`: cannot change and keeps its state readable. */
export type MatrixCellState = 'disabled' | 'locked'

/** The checked cells: the checked column ids of each row id. A missing row has none checked. */
export type MatrixValue = Readonly<Record<string, readonly string[]>>

export type CheckboxMatrixProps = {
  rows: readonly MatrixRow[]
  columns: readonly MatrixColumn[]
  value?: MatrixValue
  defaultValue?: MatrixValue
  onValueChange?: (value: Record<string, string[]>) => void
  /** Per-cell state. A locked cell keeps its checked state and cannot be toggled by hand or by an "all" toggle. */
  cellState?: (row: MatrixRow, column: MatrixColumn) => MatrixCellState | undefined
  /** Adds an "All" checkbox at the end of each row. */
  rowToggles?: boolean
  /** Adds an "all rows" checkbox in each column heading. */
  columnToggles?: boolean
  /** The heading of the row-label column (the corner cell). */
  rowsLabel?: ReactNode
  /** Submits each row as `<name>[<rowId>]`, one value per checked column. */
  name?: string
  disabled?: boolean
  /** Marks every cell invalid: a red border and `aria-invalid`. */
  'aria-invalid'?: boolean
  /** Names the matrix; one of `aria-label` and `aria-labelledby` is required for assistive tech. */
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  /** Fires once when focus leaves the whole matrix: the validate-on-blur hook. */
  onBlur?: () => void
  /** Layout only (`max-w-2xl`, `w-full`). */
  className?: string
}

const text = (node: ReactNode): string => (typeof node === 'string' ? node : '')

type CellBoxProps = Omit<BaseCheckbox.Root.Props, 'className' | 'children'> & { className?: string }

/**
 * One cell's box: `Checkbox`'s own table and check on the Base UI root. It is not the `Checkbox`
 * part because the matrix is the control and the cells have no home of their own.
 */
function CellBox({ className, ...props }: CellBoxProps): ReactElement {
  return (
    <BaseCheckbox.Root {...props} className={cn(checkboxVariants(), className)}>
      <BaseCheckbox.Indicator className="flex">
        <svg
          viewBox="0 0 12 12"
          className="size-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2.5 6.5l2.5 2.5 4.5-5.5" className="group-data-indeterminate:hidden" />
          <path d="M2.5 6h7" className="hidden group-data-indeterminate:block" />
        </svg>
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  )
}

const ARROW: Record<string, readonly [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
}

/** Moves focus to the nearest enabled cell checkbox in the arrow's direction; a wall stops it. */
function moveFocus(root: HTMLElement, from: HTMLElement, key: string): boolean {
  const step = ARROW[key]
  if (step === undefined) return false
  let row = Number(from.dataset['matrixRow'])
  let col = Number(from.dataset['matrixCol'])
  for (;;) {
    row += step[0]
    col += step[1]
    const next = root.querySelector<HTMLElement>(
      `[data-matrix-row="${row}"][data-matrix-col="${col}"]`,
    )
    if (next === null) return false
    if (next.hasAttribute('data-disabled') || next.hasAttribute('data-readonly')) continue
    next.focus()
    return true
  }
}

/**
 * A matrix of checkboxes on the table primitive: one row per subject, one column per grant, each
 * cell a real checkbox named by its row and column heading. The corner, column and row headings
 * carry `scope`, so a screen reader reads "Billing, Admin, checkbox, checked". Tab visits every
 * cell in reading order and the arrow keys move cell by cell; Space toggles. `rowToggles` and
 * `columnToggles` add tri-state "all" boxes that skip disabled and locked cells. Controlled with
 * `value` and `onValueChange`, or uncontrolled with `defaultValue`.
 *
 * @useWhen a permission or notification grid, where rows and columns are known and each cell is a yes or no
 * @neverWhen the grid is one list of independent choices (use CheckboxGroup) or the rows are data to sort and filter (use DataTable)
 * @example
 * <CheckboxMatrix aria-label="Permissions" value={grants} onValueChange={setGrants}
 *   rows={[{ id: 'billing', label: 'Billing', description: 'Invoices and plans' }]}
 *   columns={[{ id: 'admin', label: 'Admin' }, { id: 'member', label: 'Member' }]}
 *   rowToggles />
 */
export function CheckboxMatrix({
  rows,
  columns,
  value,
  defaultValue,
  onValueChange,
  cellState,
  rowToggles = false,
  columnToggles = false,
  rowsLabel,
  name,
  disabled = false,
  'aria-invalid': invalid = false,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  onBlur,
  className,
}: CheckboxMatrixProps): ReactElement {
  const t = useMessages(baseMessages)
  const uid = useId()
  const frame = useRef<HTMLDivElement>(null)
  const [inner, setInner] = useState<MatrixValue>(defaultValue ?? {})
  const current = value ?? inner

  const stateOf = (row: MatrixRow, column: MatrixColumn): MatrixCellState | undefined => {
    if (disabled || row.disabled === true || column.disabled === true) return 'disabled'
    return cellState?.(row, column)
  }
  const isChecked = (row: MatrixRow, column: MatrixColumn): boolean =>
    current[row.id]?.includes(column.id) ?? false

  const commit = (cells: readonly (readonly [MatrixRow, MatrixColumn])[], on: boolean): void => {
    const next: Record<string, string[]> = Object.fromEntries(
      rows.map((row) => [row.id, [...(current[row.id] ?? [])]]),
    )
    for (const [row, column] of cells) {
      const list = next[row.id] ?? []
      const without = list.filter((id) => id !== column.id)
      next[row.id] = on ? [...without, column.id] : without
    }
    // Column order, so a value is the same list however it was reached.
    for (const row of rows) {
      next[row.id] = columns.map((c) => c.id).filter((id) => next[row.id]?.includes(id))
    }
    setInner(next)
    onValueChange?.(next)
  }

  /** A group's toggle: every cell it can change, and whether they are all on, some on or none. */
  const group = (
    cells: readonly (readonly [MatrixRow, MatrixColumn])[],
  ): { cells: typeof cells; checked: boolean; indeterminate: boolean; allOpenOn: boolean } => {
    const open = cells.filter(([row, column]) => stateOf(row, column) === undefined)
    // A locked cell counts toward what the toggle shows but never changes; a disabled one is left out.
    const shown = cells.filter(([row, column]) => stateOf(row, column) !== 'disabled')
    const on = shown.filter(([row, column]) => isChecked(row, column)).length
    return {
      cells: open,
      checked: shown.length > 0 && on === shown.length,
      indeterminate: on > 0 && on < shown.length,
      // What a click does: switch every open cell off once they are all on, else switch them on.
      allOpenOn: open.every(([row, column]) => isChecked(row, column)),
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement
    if (frame.current === null || target.dataset['matrixRow'] === undefined) return
    if (moveFocus(frame.current, target, event.key)) event.preventDefault()
  }
  const onFocusOut = (event: FocusEvent<HTMLDivElement>): void => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))
      return
    onBlur?.()
  }

  const rowHeadId = (row: MatrixRow): string => `${uid}-r-${row.id}`
  const colHeadId = (column: MatrixColumn): string => `${uid}-c-${column.id}`

  return (
    // The wrapper only forwards arrow keys and the blur of the whole matrix; the checkboxes are the controls.
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- key and blur delegation for the cell checkboxes
    <div
      ref={frame}
      data-slot="checkbox-matrix"
      className={cn(checkboxMatrixVariants(), className)}
      onKeyDown={onKeyDown}
      onBlur={onFocusOut}
    >
      <Table
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
      >
        <TableHeader>
          <TableRow>
            <TableHead scope="col">
              {rowsLabel ?? <span className="sr-only">&nbsp;</span>}
            </TableHead>
            {columns.map((column) => {
              const toggle = group(rows.map((row) => [row, column] as const))
              return (
                <TableHead key={column.id} scope="col" className="px-1.5 text-center">
                  <span className="inline-flex flex-col items-center gap-1 py-1">
                    <span id={colHeadId(column)}>{column.label}</span>
                    {columnToggles && (
                      <CellBox
                        aria-label={t(
                          'base.matrix.allForColumn',
                          column.name ?? text(column.label),
                        )}
                        checked={toggle.checked}
                        indeterminate={toggle.indeterminate}
                        disabled={toggle.cells.length === 0}
                        onCheckedChange={() => commit(toggle.cells, !toggle.allOpenOn)}
                      />
                    )}
                  </span>
                </TableHead>
              )
            })}
            {rowToggles && (
              <TableHead scope="col" className="px-1.5 text-center">
                {t('base.matrix.all')}
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, r) => {
            const toggle = group(columns.map((column) => [row, column] as const))
            return (
              <TableRow key={row.id}>
                <TableHead
                  scope="row"
                  className="max-w-40 min-w-24 py-2 text-left whitespace-normal"
                >
                  <span id={rowHeadId(row)} className="block text-sm font-medium text-foreground">
                    {row.label}
                  </span>
                  {row.description !== undefined && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {row.description}
                    </span>
                  )}
                </TableHead>
                {columns.map((column, c) => {
                  const state = stateOf(row, column)
                  return (
                    <TableCell key={column.id} className="px-1.5 text-center">
                      <CellBox
                        data-matrix-row={r}
                        data-matrix-col={c}
                        aria-labelledby={`${rowHeadId(row)} ${colHeadId(column)}`}
                        aria-invalid={invalid || undefined}
                        checked={isChecked(row, column)}
                        disabled={state === 'disabled'}
                        readOnly={state === 'locked'}
                        {...(name !== undefined && {
                          name: `${name}[${row.id}]`,
                          value: column.id,
                        })}
                        className="aria-invalid:border-bad"
                        onCheckedChange={(on) => commit([[row, column]], on)}
                      />
                    </TableCell>
                  )
                })}
                {rowToggles && (
                  <TableCell className="px-1.5 text-center">
                    <CellBox
                      data-matrix-row={r}
                      data-matrix-col={columns.length}
                      aria-label={t('base.matrix.allForRow', row.name ?? text(row.label))}
                      checked={toggle.checked}
                      indeterminate={toggle.indeterminate}
                      disabled={toggle.cells.length === 0}
                      onCheckedChange={() => commit(toggle.cells, !toggle.allOpenOn)}
                    />
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
