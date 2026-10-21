/**
 * `meta.kind` for `BasaltDataTable` (`docs/waves/design-parity/SPEC.md` § 6.6): the chrome a cell
 * takes by KIND, and the content a kind supplies when its column has no `cell` of its own. The table
 * calls three seams from its header and cell render sites: {@link resolveKind} (validate),
 * {@link kindClass} / {@link kindAlign} (chrome) and {@link KindCell} (content).
 */
import { Badge, Skeleton, Tooltip } from '@mantine/core'
import type { Cell, Column, RowData } from '@tanstack/react-table'
import { FlexRender } from '@tanstack/react-table'
import type { ReactNode } from 'react'
import { cx } from '../common/props'
import { Meter } from '../dashboard/meter'
import { dateTime, integer, relativeTime } from '../format'
import { numberFormat } from '../format/shared'
import { DATA_TABLE_COLUMN_KINDS } from './table-features'
import type { BasaltTableFeatures, DataTableAlign, DataTableColumnKind } from './table-features'
import classes from './cell-kinds.module.css'

/**
 * The table's own default `cell` (TanStack's, restated), installed as `defaultColumn.cell` so a
 * column WITHOUT a renderer is identifiable by identity: v9 merges its default into every
 * `columnDef`, so `columnDef.cell === undefined` can never be asked.
 */
export function DEFAULT_CELL(props: { renderValue(): unknown }) {
  return (props.renderValue() as { toString?(): string } | null | undefined)?.toString?.() ?? null
}

const KINDS: ReadonlySet<string> = new Set(DATA_TABLE_COLUMN_KINDS)

/** Reads `meta.kind`, throwing on a value outside the seven — the check a type cannot make at runtime. */
export function resolveKind<T extends RowData>(
  column: Column<BasaltTableFeatures, T, unknown>,
): DataTableColumnKind | undefined {
  const kind = column.columnDef.meta?.kind
  if (kind === undefined) return undefined
  if (!KINDS.has(kind)) {
    throw new Error(
      `BasaltDataTable: column "${column.id}" has meta.kind=${JSON.stringify(kind)} — ` +
        `expected ${DATA_TABLE_COLUMN_KINDS.map((k) => `'${k}'`).join(' | ')}.`,
    )
  }
  return kind
}

/** Figures read right: the kind's default alignment, which an explicit `meta.align` overrides. */
export function kindAlign(kind: DataTableColumnKind | undefined): DataTableAlign | undefined {
  return kind === 'number' || kind === 'money' ? 'right' : undefined
}

/** Kinds whose column sizes to its content; `text` and kindless columns keep the browser's auto share. */
const FIT_KINDS: ReadonlySet<DataTableColumnKind> = new Set([
  'entity',
  'status',
  'number',
  'money',
  'relative-time',
  'meter',
])

/**
 * Column sizing law (SPEC § 6.6): a kinded data column is as wide as its header or widest cell, and
 * the slack of a wide container goes to ONE column — the first `entity`/`text` one, else a trailing
 * spacer — so a value sits beside its name instead of a third of the table away. `fixedIds` (the
 * checkbox and actions columns) fit their content too but are not data. A kindless or later `text`
 * column keeps its auto share, so a table that uses them is no worse off than before.
 */
export function planColumnSizing<T extends RowData>(
  columns: readonly Column<BasaltTableFeatures, T, unknown>[],
  fixedIds: ReadonlySet<string>,
): { fitIds: ReadonlySet<string>; spacer: boolean } {
  const fitIds = new Set<string>()
  let hasSlack = false
  let hasData = false
  for (const column of columns) {
    if (fixedIds.has(column.id)) {
      fitIds.add(column.id)
      continue
    }
    hasData = true
    const kind = resolveKind(column)
    if (kind === undefined) {
      hasSlack = true
    } else if (!hasSlack && (kind === 'entity' || kind === 'text')) {
      hasSlack = true
    } else if (FIT_KINDS.has(kind)) {
      fitIds.add(column.id)
    } else {
      hasSlack = true
    }
  }
  return { fitIds, spacer: hasData && !hasSlack }
}

/** A loading bar shaped like the kind's value: a figure short and flush right, a chip chip-sized. */
export function KindSkeleton({
  kind,
  right,
}: {
  kind: DataTableColumnKind | undefined
  right: boolean
}): ReactNode {
  const chip = kind === 'status'
  const width =
    kind === 'number' || kind === 'money'
      ? '3rem'
      : chip || kind === 'relative-time'
        ? '4.5rem'
        : kind === 'meter'
          ? '4rem'
          : kind === 'entity'
            ? '70%'
            : '100%'
  return <Skeleton height={chip ? 20 : 16} radius="sm" w={width} {...(right && { ml: 'auto' })} />
}

const KIND_CLASS: Record<DataTableColumnKind, string> = {
  entity: classes.entity,
  status: classes.status,
  number: classes.number,
  money: classes.number,
  'relative-time': classes.relativeTime,
  meter: classes.meter,
  text: classes.text,
}

export function kindClass(kind: DataTableColumnKind): string {
  return cx(KIND_CLASS[kind])
}

/** A whole number groups; a fraction is kept whole (`integer` would round 12.5 to 13). */
function formatFigure(value: number): string {
  return Number.isInteger(value)
    ? integer(value)
    : numberFormat(undefined, { signDisplay: 'negative', maximumFractionDigits: 20 }).format(value)
}

/**
 * A `money` figure: grouped, with the currency's own minor digits (`120,000.00` USD, `120,000` JPY)
 * and no symbol — the header names the code (`Salary (USD / yr)`, SPEC § 6.6).
 */
function formatMoney(value: number, currency: string): string {
  const digits = numberFormat(undefined, { style: 'currency', currency }).resolvedOptions()
    .maximumFractionDigits
  return numberFormat(undefined, {
    signDisplay: 'negative',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

/** The theme draws no dot for plain `gray`, but every chip in a status column carries one. */
const chipColor = (color: string | undefined): string =>
  color === undefined || color === 'gray' ? 'var(--vx-faint)' : color

const Dash = () => <span className={classes.dash}>—</span>

function isAbsent(value: unknown): boolean {
  return value === null || value === undefined || value === ''
}

function toDate(value: unknown): Date | undefined {
  if (!(value instanceof Date) && typeof value !== 'number' && typeof value !== 'string') {
    return undefined
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function columnLabel<T extends RowData>(column: Column<BasaltTableFeatures, T, unknown>): string {
  const { header } = column.columnDef
  return typeof header === 'string' ? header : column.id
}

function RelativeTime({ value }: { value: unknown }) {
  const date = toDate(value)
  if (date === undefined) return <Dash />
  const full = dateTime(date)
  return (
    <Tooltip label={full}>
      <time dateTime={date.toISOString()} aria-label={full}>
        {relativeTime(date)}
      </time>
    </Tooltip>
  )
}

/** The cell of a column with a `kind`: the column's own `cell` if it has one, else the kind's content. */
export function KindCell<T extends RowData>({
  kind,
  cell,
}: {
  kind: DataTableColumnKind
  cell: Cell<BasaltTableFeatures, T, unknown>
}): ReactNode {
  const { column } = cell
  const { cell: render, meta } = column.columnDef
  if (render !== DEFAULT_CELL) return <FlexRender cell={cell} />
  const value = cell.getValue()
  switch (kind) {
    case 'number':
    case 'money': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return <Dash />
      return kind === 'money' ? formatMoney(value, meta?.currency ?? 'USD') : formatFigure(value)
    }
    case 'relative-time':
      return <RelativeTime value={value} />
    case 'status':
      if (isAbsent(value)) return <Dash />
      return <Badge color={chipColor(meta?.statusColor?.(value))}>{String(value)}</Badge>
    case 'meter':
      return (
        <Meter
          size="row"
          label={columnLabel(column)}
          value={typeof value === 'number' ? value : null}
          max={meta?.meterMax ?? 1}
        />
      )
    case 'entity':
    case 'text':
      return isAbsent(value) ? <Dash /> : String(value)
    default:
      return kind satisfies never
  }
}

/** A cell's content through its kind when it has one — the body cell and the fold disclosure share it. */
export function CellContent<T extends RowData>({
  cell,
}: {
  cell: Cell<BasaltTableFeatures, T, unknown>
}): ReactNode {
  const kind = resolveKind(cell.column)
  return kind === undefined ? <FlexRender cell={cell} /> : <KindCell kind={kind} cell={cell} />
}
