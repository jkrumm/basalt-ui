---
name: Table
use when: 'the rows are static and need no sort, filter, paging or selection: a short list, a spec sheet, a receipt'
never when: 'the table sorts, filters, pages or selects (use `DataTable` over `useDataTable`)'
subpath: basalt-ui/ui/table
peers: []
slots: [table, table-header, table-body, table-row, table-head, table-cell, table-caption]
---

# Table

A plain, static table: hairline rows, a sticky head and a row height from `size`. It renders the
native `<table>` and works with no provider; wrap it in a scroll container to scroll it, and the
head sticks inside that container (or to the page when there is none).

## Props

### `Table`

A plain, static table: hairline rows, a sticky head and a row height from `size`. It renders the
native `<table>` and works with no provider; wrap it in a scroll container to scroll it, and the
head sticks inside that container (or to the page when there is none).

```ts
Table({ size, look, className, ...props }: TableProps): ReactElement
  className?: string  // Layout only (`w-1/3`, `text-right`, `whitespace-nowrap`)
  size?: "sm" | "md" | null
  look?: "grid" | "reading" | null
```

### `TableHeader`

The head group. Its cells stick to the top edge of the scroll container and repeat on every
printed page.

```ts
TableHeader({ className, ...props }: PartProps<"thead">): ReactElement
  className?: string  // Layout only (`w-1/3`, `text-right`, `whitespace-nowrap`)
```

### `TableBody`

The body group. The last row drops its hairline so the surface edge closes the table.

```ts
TableBody({ className, ...props }: PartProps<"tbody">): ReactElement
  className?: string  // Layout only (`w-1/3`, `text-right`, `whitespace-nowrap`)
```

### `TableRow`

A row at the table's row height, with a hover surface on a body row.

```ts
TableRow({ className, ...props }: PartProps<"tr">): ReactElement
  className?: string  // Layout only (`w-1/3`, `text-right`, `whitespace-nowrap`)
```

### `TableHead`

A column heading: sentence-case, muted, on the surface hairline.

```ts
TableHead({ numeric, className, ...props }: PartProps<"th"> & TableColumnProps): ReactElement
  className?: string  // Layout only (`w-1/3`, `text-right`, `whitespace-nowrap`)
  numeric?: boolean  // A numeric column: right-aligned, tabular numerals
```

### `TableCell`

A data cell on a row hairline. `numeric` right-aligns and sets tabular numerals, the one place
the UI ladder uses them besides axis ticks.

```ts
TableCell({ numeric, className, ...props }: PartProps<"td"> & TableColumnProps): ReactElement
  className?: string  // Layout only (`w-1/3`, `text-right`, `whitespace-nowrap`)
  numeric?: boolean  // A numeric column: right-aligned, tabular numerals
```

### `TableCaption`

The table's caption, below the rows: the unit, the range or the source.

```ts
TableCaption({ className, ...props }: PartProps<"caption">): ReactElement
  className?: string  // Layout only (`w-1/3`, `text-right`, `whitespace-nowrap`)
```

## `tableVariants`

Part `table`.

- `size`: `md`, `sm` (default `md`)
- `look`: `reading`, `grid` (default `reading`)

## Slots

- `table`
- `table-header`
- `table-body`
- `table-row`
- `table-head`
- `table-cell`
- `table-caption`
