---
name: CheckboxMatrix
use when: 'a permission or notification grid, where rows and columns are known and each cell is a yes or no'
never when: 'the grid is one list of independent choices (use CheckboxGroup) or the rows are data to sort and filter (use DataTable)'
subpath: basalt-ui/ui/checkbox-matrix
peers: ['@base-ui/react']
slots: [checkbox-matrix]
---

# CheckboxMatrix

A matrix of checkboxes on the table primitive: one row per subject, one column per grant, each
cell a real checkbox named by its row and column heading. The corner, column and row headings
carry `scope`, so a screen reader reads "Billing, Admin, checkbox, checked". Tab visits every
cell in reading order and the arrow keys move cell by cell; Space toggles. `rowToggles` and
`columnToggles` add tri-state "all" boxes that skip disabled and locked cells. Controlled with
`value` and `onValueChange`, or uncontrolled with `defaultValue`.

## Props

### `CheckboxMatrix`

```ts
CheckboxMatrix({ rows, columns, value, defaultValue, onValueChange, cellState, rowToggles, columnToggles, rowsLabel, name, disabled, "aria-invalid": invalid, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy, "aria-describedby": ariaDescribedBy, onBlur, className, }: CheckboxMatrixProps): ReactElement
  rows: readonly MatrixRow[]
  columns: readonly MatrixColumn[]
  value?: Readonly<Record<string, readonly string[]>>
  defaultValue?: Readonly<Record<string, readonly string[]>>
  onValueChange?: (value: Record<string, string[]>) => void
  cellState?: (row: MatrixRow, column: MatrixColumn) => MatrixCellState  // Per-cell state
  rowToggles?: boolean  // Adds an "All" checkbox at the end of each row
  columnToggles?: boolean  // Adds an "all rows" checkbox in each column heading
  rowsLabel?: ReactNode  // The heading of the row-label column (the corner cell)
  name?: string  // Submits each row as `<name>[<rowId>]`, one value per checked column
  disabled?: boolean
  aria-invalid?: boolean
  aria-label?: string
  aria-labelledby?: string
  aria-describedby?: string
  onBlur?: () => void  // Fires once when focus leaves the whole matrix: the validate-on-blur hook
  className?: string  // Layout only (`max-w-2xl`, `w-full`)
```

## `checkboxMatrixVariants`

Part `checkbox-matrix`.

No variant axes.

## Slots

- `checkbox-matrix`
