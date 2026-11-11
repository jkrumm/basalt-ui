import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps, ReactElement } from 'react'
import { cn } from '../core/cn'

/**
 * The `Table` cva table: the row height every part reads. `md` follows the density row height
 * (`--vx-row-h`); `compact` is a fixed 28 px row for a table that sits in a card and carries many
 * rows. A coarse pointer takes the density floor in both, so a row stays a touch target.
 *
 * @example
 * tableVariants({ size: 'compact' }) // class string for a non-`Table` element
 */
export const tableVariants = cva(
  'w-full caption-bottom border-separate border-spacing-0 text-sm text-foreground [--table-row-h:var(--vx-row-h)]',
  {
    variants: {
      size: {
        md: '',
        compact: '[--table-row-h:1.75rem] pointer-coarse:[--table-row-h:var(--vx-row-h)]',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const tableParts = [
  'table',
  'table-header',
  'table-body',
  'table-row',
  'table-head',
  'table-cell',
  'table-caption',
] as const

type PartProps<E extends 'table' | 'thead' | 'tbody' | 'tr' | 'th' | 'td' | 'caption'> = Omit<
  ComponentProps<E>,
  'className'
> & {
  /** Layout only (`w-1/3`, `text-right`, `whitespace-nowrap`). */
  className?: string
}

export type TableProps = PartProps<'table'> & VariantProps<typeof tableVariants>

/**
 * A plain, static table: hairline rows, a sticky head and a row height from `size`. It renders the
 * native `<table>` and works with no provider; wrap it in a scroll container to scroll it, and the
 * head sticks inside that container (or to the page when there is none).
 *
 * @example
 * <Table size="compact">
 *   <TableHeader><TableRow><TableHead>Order</TableHead></TableRow></TableHeader>
 *   <TableBody><TableRow><TableCell>#4821</TableCell></TableRow></TableBody>
 * </Table>
 */
export function Table({ size, className, ...props }: TableProps): ReactElement {
  return <table {...props} data-slot="table" className={cn(tableVariants({ size }), className)} />
}

/**
 * The head group. Its cells stick to the top edge of the scroll container and repeat on every
 * printed page.
 *
 * @example
 * <TableHeader><TableRow><TableHead>Status</TableHead></TableRow></TableHeader>
 */
export function TableHeader({ className, ...props }: PartProps<'thead'>): ReactElement {
  return (
    <thead
      {...props}
      data-slot="table-header"
      className={cn(
        '[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-(--vx-surface) print:[&_th]:static',
        className,
      )}
    />
  )
}

/**
 * The body group. The last row drops its hairline so the surface edge closes the table.
 *
 * @example
 * <TableBody><TableRow><TableCell>#4821</TableCell></TableRow></TableBody>
 */
export function TableBody({ className, ...props }: PartProps<'tbody'>): ReactElement {
  return (
    <tbody
      {...props}
      data-slot="table-body"
      className={cn('[&_tr:last-child>*]:border-b-0', className)}
    />
  )
}

/**
 * A row at the table's row height, with a hover surface on a body row.
 *
 * @example
 * <TableRow><TableCell>#4821</TableCell><TableCell numeric>1,204.00</TableCell></TableRow>
 */
export function TableRow({ className, ...props }: PartProps<'tr'>): ReactElement {
  return (
    <tr
      {...props}
      data-slot="table-row"
      className={cn(
        'h-(--table-row-h) print:break-inside-avoid [tbody>&]:hover:bg-accent',
        className,
      )}
    />
  )
}

export type TableColumnProps = {
  /** A numeric column: right-aligned, tabular numerals. Set it on the head and on every cell. */
  numeric?: boolean
}

/**
 * A column heading: sentence-case, muted, on the surface hairline.
 *
 * @example
 * <TableHead numeric>Amount</TableHead>
 */
export function TableHead({
  numeric = false,
  className,
  ...props
}: PartProps<'th'> & TableColumnProps): ReactElement {
  return (
    <th
      {...props}
      data-slot="table-head"
      className={cn(
        'border-b border-border px-3 text-xs font-medium whitespace-nowrap text-muted-foreground first:pl-4 last:pr-4',
        numeric ? 'text-right tabular-nums' : 'text-left',
        className,
      )}
    />
  )
}

/**
 * A data cell on a row hairline. `numeric` right-aligns and sets tabular numerals, the one place
 * the UI ladder uses them besides axis ticks.
 *
 * @example
 * <TableCell numeric>1,204.00</TableCell>
 */
export function TableCell({
  numeric = false,
  className,
  ...props
}: PartProps<'td'> & TableColumnProps): ReactElement {
  return (
    <td
      {...props}
      data-slot="table-cell"
      className={cn(
        'border-b border-border px-3 whitespace-nowrap first:pl-4 last:pr-4',
        numeric && 'text-right tabular-nums',
        className,
      )}
    />
  )
}

/**
 * The table's caption, below the rows: the unit, the range or the source.
 *
 * @example
 * <TableCaption>Amounts in EUR. Updated hourly.</TableCaption>
 */
export function TableCaption({ className, ...props }: PartProps<'caption'>): ReactElement {
  return (
    <caption
      {...props}
      data-slot="table-caption"
      className={cn('px-4 py-2 text-left text-xs text-muted-foreground', className)}
    />
  )
}
