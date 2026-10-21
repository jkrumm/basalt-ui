/**
 * `meta.kind` for `BasaltDataTable` (`docs/waves/design-parity/SPEC.md` § 6.6): the chrome a cell
 * takes by KIND, and the content a kind supplies when its column has no `cell` of its own. The table
 * calls three seams from its header and cell render sites: {@link resolveKind} (validate),
 * {@link kindClass} / {@link kindAlign} (chrome) and {@link KindCell} (content).
 */
import { Badge, Tooltip } from '@mantine/core'
import type { Cell, Column, RowData } from '@tanstack/react-table'
import { FlexRender } from '@tanstack/react-table'
import type { ReactNode } from 'react'
import { cx } from '../common/props'
import { Meter } from '../dashboard/meter'
import { dateTime, integer, money, relativeTime } from '../format'
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
      return kind === 'money'
        ? money(value, { currency: meta?.currency ?? 'USD' })
        : formatFigure(value)
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
